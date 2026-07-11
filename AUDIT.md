# Production Audit — AlgoTrackr (DSA Question Tracker)

_Next.js 15 · React 19 · TypeScript (strict) · MongoDB/Mongoose · Tailwind · App Router · SWR_

Audit performed by reading the actual source (17 API routes, 21 pages, 125 TS/TSX files, all
security-critical libs), a real `npm audit`, a production build, and a runtime header/CSP check.
Findings are evidence-based; nothing was assumed. Metrics I could not measure without a live
profiling/load run (Core Web Vitals, real load tests) are marked **unverified**.

---

## Overall Production Readiness: **78 / 100** (post-fix)

> Verdict: **genuinely well-built for its stage** — production-ready for **thousands** of users
> today. Before **"millions"**, close the HIGH items (stats-route memory, tests, durable rate
> limiting). There are **no Critical** issues: authentication, authorization, and input
> validation are strong.

| Category | Score | Notes |
|---|---:|---|
| Architecture | 82 | Clean App Router, no circular deps; a few oversized components |
| Security | 84 | Strong auth core; headers/leakage fixed this pass |
| Backend | 83 | Consistent `handle()`/validation/admin-gating; N+1 in import |
| Frontend | 79 | Good states/dark-mode; heavier chart bundles |
| MongoDB | 83 | Good indexes + archive model; pool cap fixed |
| Performance | 74 | Regex search + heavy chart pages; no caching layer |
| Scalability | 70 | `/api/stats` loads whole collection into JS ⚠ |
| Accessibility | 68 | Some ARIA present; **not formally audited (unverified)** |
| UX | 83 | Coherent flows, good empty states |
| Code Quality | 82 | Strict TS + zod; minor dead code |
| Testing | 12 | **Zero tests** in the project |
| Deployment / DevOps | 66 | Vercel-ready; no CI/CD, Docker, health check, monitoring |

---

## ✅ Fixes applied this pass (verified: typecheck + production build + runtime header check)

| # | Fix | File |
|---|---|---|
| F1 | **Security headers** added (X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy, CSP with `frame-ancestors 'none'`/`object-src 'none'`/`base-uri 'self'`) + `poweredByHeader:false` | `next.config.mjs` |
| F2 | **Removed `images.remotePatterns: "**"`** — an open image-proxy/SSRF vector. Verified no `next/image` is used, so removal is zero-risk. | `next.config.mjs` |
| F3 | **Stopped error-message leakage** — 500s now return a generic message in production (details logged server-side only); dev keeps detail. | `src/lib/api-response.ts` |
| F4 | **Connection-pool cap** `maxPoolSize:10` (+ socket timeout) — prevents Atlas connection exhaustion from many serverless instances. | `src/lib/db.ts` |

Runtime check confirmed the CSP does **not** break the app (page hydrates, zero console violations, same-origin `/api` calls allowed by `connect-src 'self'`).

---

## Issue Register

Severity → **Impact · Solution · Priority · Est. fix**

### 🔴 Critical — none
Auth is HMAC-signed with **constant-time comparison** (timing-safe), secret stored per-admin in
DB (not env), bcrypt cost 12, DB-backed global brute-force lockout (5 / 15 min), all mutation
routes admin-gated, admin setup is takeover-safe (`countDocuments>0 → 409`), and every write is
zod-validated with max-lengths. This is a strong baseline.

### 🟠 High
- **H1 · `/api/stats` loads the entire collection into memory.** `Question.find({}).lean()` then
  computes in JS. Fine at 15k; at 100k–1M it will OOM / time out. **Fix:** replace with a
  `$facet` aggregation pipeline (like `/api/patterns`). **Priority: now. ~3h.**
- **H2 · No automated tests (0 coverage).** Every change risks silent regressions. **Fix:** Vitest
  for lib/aggregation units, a Node test-runner suite hitting API routes against a throwaway DB,
  Playwright for critical E2E (login, solve→unlock, search). **Priority: high. ~2–3 days for a baseline.**
- **H3 · In-memory rate limiter doesn't span serverless instances.** The DB lockout (global) stops
  password brute-force, but request throttling resets per lambda cold-start. **Fix:** Upstash/Redis
  or Vercel Edge rate limiting keyed by IP. **Priority: high. ~4h.**

### 🟡 Medium
- **M1 · Error leakage** — ✅ fixed (F3).
- **M2 · Missing security headers / CSP / clickjacking** — ✅ fixed (F1).
- **M3 · Open image proxy (`remotePatterns: **`)** — ✅ fixed (F2).
- **M4 · No connection pool cap** — ✅ fixed (F4).
- **M5 · Weak admin password policy** — key is `^\d{8}$` (8 numeric digits, ~10⁸). Online guessing
  is blocked by the global lockout, but entropy is low. **Fix:** allow a longer alphanumeric
  passphrase; keep the lockout. **~1h.**
- **M6 · N+1 writes in import/seed** — upsert does `findOne`+`save` per row in a loop. **Fix:**
  `bulkWrite`, but preserve the `pre('save')` hook that stamps `solvedAt`/`revisionNeeded`
  (bulk `$set` skips hooks — replicate that logic). **~3h.**
- **M7 · Unindexed regex search.** `/api/questions?search=` builds a case-insensitive `RegExp`
  across many fields → collection scan. A `title/concept/approach/notes/tags` **text index already
  exists but is unused by this path.** **Fix:** use `$text` (or Atlas Search) for the free-text
  query. **~3h.**
- **M8 · 2 moderate npm vulns** (postcss `<8.5.10` via Next's bundled copy — build-time XSS in CSS
  stringify). **Do NOT run `npm audit fix --force`** (it downgrades to `next@9`). **Fix:** bump Next
  to the latest 15.x patch. **~1h + smoke test.**
- **M9 · DevOps gaps** — no CI/CD, Dockerfile, health-check route, monitoring, or documented
  backup/restore. **Fix:** GitHub Actions (typecheck+build+test), `/api/health`, Sentry/logs,
  Atlas backups. **~1 day.**
- **M10 · CSRF** — state-changing routes rely on a `sameSite=lax` httpOnly cookie + JSON body.
  Real-world risk is low (lax + JSON content-type block classic CSRF), but there's no explicit
  CSRF token. **Note / optional double-submit token. ~2h.**

### 🔵 Low
- **L1 · Dead code** — unused exports `CHART_PALETTE` (`lib/constants.ts`), `clamp()` &
  `sanitizeString()` (`lib/utils.ts`). Safe to remove (left in place pending your OK).
- **L2 · Oversized components** — `questions/[id]/page.tsx` (432), `question-form.tsx` (380),
  `admin-panel.tsx` (316) mix concerns; split view/edit and extract field components.
- **L3 · Duplicated aggregation shape** across `/api/stats`, `/api/learn`, `/api/google` — extract
  a shared `topicDifficultyPlatform` group stage.
- **L4 · `getClientIp` trusts `x-forwarded-for`** (spoofable) — only affects the soft throttle;
  the global lockout is unaffected. Pin to a trusted proxy header on your host.
- **L5 · Bundle size** — `/statistics` 270 kB, several detail pages ~211 kB first-load (recharts +
  framer). Lazy-load charts with `next/dynamic`.

### ⚪ Informational
- **I1 · Accessibility unverified** — good signs (the Google table rows have `role/tabIndex/aria-label`),
  but no axe/contrast audit was run. Recommend an `@axe-core/playwright` pass.
- **I2 · Core Web Vitals unverified** — needs a Lighthouse/field run; can't be measured statically.
- **I3 · Hooks live in `/hooks` not `/lib/hooks`** — cosmetic path inconsistency.

---

## Phase coverage map

- **1 Structure:** clean; no circular deps; 3 refactor candidates (L2); dead code (L1).
- **2 Security:** strong core (see Critical box); fixed F1/F3; open items M5/M8/M10, H3.
- **3 MongoDB:** solid indexes (text, `{archived,topic,subtopic}`, multikey `patterns[]`,
  `{archived,topic,difficultyRank,learningScore}`), archive-not-delete, upsert-safe seed/import;
  fixed pool cap (F4); H1 + M7 for scale.
- **4 API:** consistent envelope (`ok/fail/handle`), zod validation, admin-gating, `force-dynamic`;
  add caching/rate-limit (H3) + fix leakage (done).
- **5 Frontend:** loading skeletons, error boundaries, dark mode, responsive; bundle (L5).
- **8 Performance / 9 Scalability:** H1 is the headline blocker for 100k+; also M7, no CDN caching
  (all dynamic). Staged learning fetch is correctly **bounded** (good).
- **10 Admin:** import/export gated + validated + capped (5000 rows); no audit-log/rollback (M9).
- **12 Code quality:** strict TS + zod, good naming; L1–L3.
- **13 Dependencies:** M8.
- **14 DevOps:** Vercel-ready; M9.
- **16 Testing:** **none** → H2.

---

## Recommended path to "millions of users"

1. **H1** — aggregate `/api/stats` (unblocks scale). 2. **H3** — durable rate limiting.
3. **H2** — test baseline + **M9** CI so regressions are caught. 4. **M7/M6** — search + import
performance. 5. **M8** — dependency bump. 6. **M5** — password policy. 7. Load-test at 100k docs /
1k concurrent and re-measure.

_Fixes F1–F4 are already applied and verified. No existing feature or user data was changed._
