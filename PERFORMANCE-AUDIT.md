# DSAspire — End-to-End Performance Audit

_Point-in-time performance audit, 2026-07-13. Evidence: full source review (33 API routes, 11 models, middleware, 32 pages/hooks/providers), a clean production build (`next build`), and **live measurements + explain plans against the production Atlas database** (`dsa-tracker`, 15,267 questions). Every latency number below is measured, not estimated._

> This document is the audit deliverable (task §17). Fixes are implemented in a separate pass and tracked in `PERFORMANCE-RESULTS.md` (before/after).

---

## 0. Verdict

The app is **architecturally clean and secure**, but it is **not "instant"** today. Two systemic issues dominate everything else:

1. **The backend re-derives large, user-independent catalog aggregations on every request, and the single hottest query (the default question list) has no supporting sort index** — it examines all 15,267 documents to return 20. Measured: **145–466 ms** for a list page, **221–282 ms** for the dashboard facet, and a latent **6–10 second** response when a user sorts a list by difficulty/rating/attempts.
2. **The entire UI is client-rendered and fetches after hydration** — every page ships HTML with no data, so first paint is always a skeleton, followed by download → hydrate → SWR fetch → API (auth + rate-limit + DB) → paint. There is **no server-provided initial data anywhere** and **no HTTP caching on any endpoint**.

Bundle size is **not** a problem (102 kB shared, routes 121–231 kB — healthy). The work is backend query shape + a rendering/caching model change, both of which preserve 100% of the UI and features.

---

## 1. Architecture

| Dimension | Finding |
|---|---|
| Framework | Next.js **15.5.20** (App Router), React **19** |
| Language | TypeScript 5.7 (strict) |
| Database | MongoDB **Atlas** (remote — every DB round-trip pays real network RTT), Mongoose **8.9** |
| Auth | NextAuth v5 (beta) — **JWT sessions** (stateless verify) + 30 s in-process account "gate" cache |
| State/data | **SWR** (client fetch), no Redux/Zustand |
| UI | Radix UI + Tailwind + **framer-motion** + **recharts** (recharts correctly code-split via `next/dynamic`) |
| Rate limiting | Upstash Redis (sliding window) when configured, else in-memory. Called in middleware **and** per route. |
| Deployment | Vercel (serverless functions) |

**Rendering model (root cause of perceived slowness):** `src/app/layout.tsx` → `Providers` (`SessionProvider` + `SWRConfig` + `MotionConfig`) → `AppShell` → `template.tsx` (framer `motion.div`) → **`"use client"` page** → SWR hook → `/api/*`. 28 of 32 pages are client components; the other 4 are thin server shells that render client `*-content`. **Effectively 100% of interactive UI is client-rendered with post-hydration data fetching.**

**Request path for one dashboard open (measured components):**
```
GET /dashboard  → middleware(rate-limit + JWT)  → HTML shell (NO data)
                → download+hydrate JS
useStats() → GET /api/stats → middleware(rate-limit) → requireUser (JWT + gate)
           → checkRateLimit("read")  → connectDB
           → computeUserStats():  facet(221–282ms) ▸ overlay ▸ recentlyAdded
             ▸ recentProgress ▸ recentDocs   (5+ SEQUENTIAL awaits)
           → paint
```

### Dependency graph (data layer)

```
middleware.ts ─ checkRateLimit (Upstash|memory)
              └ auth.config (edge JWT verify)

route handlers ─ handle() envelope
   ├ auth-helpers ─ auth() JWT ─ getUserGate (User.findById, 30s cache)
   │              └ requireUser/Admin/RoleAdmin/SuperAdmin
   ├ rate-limit  ─ checkRateLimit(bucket, id)
   ├ db.connectDB (cached mongoose, DoH SRV fallback)
   ├ progress.ts ─ getProgressMap / overlayQuestions / getUserOverlay(aggregate $lookup)
   │              └ userStateFilterIds / noteSearchIds
   ├ user-stats.computeUserStats ─ Question.$facet + getUserOverlay + 3 finds
   ├ learning.ts / patterns.ts(+81KB catalog, server-only) / sheets.ts / google.ts
   └ serialize.ts (30-field plain object per question)

models: Question(15,267) ▸ UserProgress ▸ User ▸ Settings ▸ Audit/Reminder/Activity
```

---

## 2. Measured evidence (live Atlas, 15,267 questions)

| Operation | Best | Worst | Verdict |
|---|---:|---:|---|
| **List: `{archived:false}` sort `createdAt:-1` limit 20** (DEFAULT) | **145 ms** | **466 ms** | 🔴 in-memory SORT of whole catalog — no index |
| List sort `updatedAt:-1` limit 20 | 139 ms | 238 ms | 🔴 same |
| **`countDocuments({archived:false})`** (every list request) | **100 ms** | 173 ms | 🔴 runs sequentially before the find |
| **Dashboard `$facet`** (catalog totals) | **221 ms** | 282 ms | 🔴 identical for all users, recomputed every load |
| **List sort by difficulty / rating / attempts** (loads ALL docs) | **6,000 ms** | **10,144 ms** | 🔴🔴🔴 transfers ~143 MB (15,267 × 9.4 kB) |
| Regex search across 8 fields | 190 ms | 828 ms | 🟠 full scan; text index exists but unused |
| `$text` search (same term) | 108 ms | 171 ms | ✅ 2–4× faster, indexed |
| **1 question doc / 20-item page payload** | **9.4 kB / 113 kB** | | 🔴 no `.select()` — ships concept/approach/notes/links |
| Stats facet payload | 2.7 kB | | ✅ |

Explain plan (default list): `totalKeysExamined = 15267`, `totalDocsExamined = 15267`, `nReturned = 20`, in-memory `SORT` stage confirmed.

**Production build (healthy — not the bottleneck):** shared First Load JS **102 kB**; routes 121–231 kB (heaviest `/admin` 231; list pages ~215; `/revision` 191; `/questions/[id]` 185; `/roadmaps` 174). recharts is dynamically imported; no eager chart code.

---

## 3. Findings by severity

Severity = user-facing latency impact × frequency on hot paths.

### 🔴 Critical

| # | Finding | File:line | Root cause | Impact | Fix |
|---|---|---|---|---|---|
| C1 | Default question list does a full-catalog in-memory sort | `models/Question.ts` (no `{archived,createdAt}` index); `api/questions/route.ts:158` | Sort field `createdAt`/`updatedAt` has no compound index with `archived` | 145–466 ms every list/page load | Add `{archived:1, createdAt:-1}`, `{archived:1, updatedAt:-1}`, `{archived:1, topic:1, createdAt:-1}` indexes → ~5 ms |
| C2 | Sort by difficulty / rating / attempts loads the entire catalog | `api/questions/route.ts:139-156` | `Question.find(query).lean()` with no limit/projection, overlay + sort + slice in JS | **6–10 s** response, ~143 MB, memory spike | Project slim fields; sort difficulty via indexed rank at DB; for per-user sorts, page from the user's (small) progress set |
| C3 | List endpoint overfetches every field | `api/questions/route.ts:143,158`; `lib/serialize.ts` | No `.select()` — returns concept/approach/notes/links/tags | 113 kB per 20-item page (~75% waste) | Add a list projection (`LIST_FIELDS`) → ~25–30 kB |
| C4 | Dashboard facet recomputed per user, per load | `lib/user-stats.ts:36-63` | Catalog totals (byDifficulty/topic/pattern/platform/company/monthly) are identical for all users but never cached | 221–282 ms on every dashboard open | Cache catalog stats with short TTL, invalidate on question write |
| C5 | Whole UI is blank→skeleton→fetch (no SSR data) | `app/dashboard/page.tsx:1,74`; `components/questions/questions-browser.tsx:59`; all pages | `"use client"` + SWR after hydration; HTML ships with no data | First paint is always a skeleton; dashboard never "instant" | Server-render initial data and hand SWR a `fallback` (same components, same UI) |

### 🟠 High

| # | Finding | File:line | Impact | Fix |
|---|---|---|---|---|
| H1 | `/api/questions`: `countDocuments` then `find` run sequentially | `api/questions/route.ts:134,158` | +100–173 ms serial | `Promise.all([count, find])` |
| H2 | `computeUserStats`: 5+ sequential awaits | `lib/user-stats.ts:36,66,184,193,202` | Sum instead of max of latencies | `Promise.all` the facet + overlay + recent blocks |
| H3 | `/api/google`: ~12 sequential, all-but-one cacheable catalog queries | `api/google/route.ts:35,67,70,76,109-113,118,146` | Worst offender per request | One `$facet` + cache catalog half |
| H4 | `/api/learn`: 13 round-trips — N+1 stage-count loop + duplicate `getProgressMap` | `api/learn/route.ts:118-129,150,235` | Hot "continue learning" path | `Promise.all`, single facet for stage totals, reuse the already-loaded overlay |
| H5 | `/api/sheets`: 8 per-sheet catalog aggregations | `api/sheets/route.ts:30-40` | 8 full catalog scans, all cacheable | One faceted aggregation + cache |
| H6 | `/api/patterns` + `/api/admin/users/[id]`: independent awaits serial; `getUserOverlay` runs **twice** on the admin route | `api/patterns/route.ts:32,49,84`; `api/admin/users/[id]/route.ts:55-58` + `lib/user-stats.ts:66` | Duplicate expensive `$lookup` | Parallelize; compute overlay once and pass in |
| H7 | Free-text search is an 8-field regex scan | `api/questions/route.ts:67-82` | 190–828 ms; grows with catalog | Use `$text` for the free-text leg (index already exists) |
| H8 | Duplicate full-set scans | `api/patterns/[slug]/route.ts:44,62`; `api/learn/topic/[slug]/route.ts:57,119` | Same documents read twice | Derive counts in JS from the one loaded set |
| H9 | framer-motion sits in the root render path | `app/template.tsx:3`; `components/layout/app-shell.tsx:5`; `providers.tsx:5`; `question-card.tsx:6` | In every route's initial JS; `template.tsx` re-mounts + re-animates the whole page subtree on every navigation (hurts nav latency) | Replace root/card motion with CSS; keep the visual |

### 🟡 Medium / 🟢 Low

| # | Finding | File:line | Fix |
|---|---|---|---|
| M1 | No HTTP caching on any endpoint (all `force-dynamic`, no `Cache-Control`/ETag) | every `api/*/route.ts` | Add `Cache-Control` + ETag to cacheable GETs |
| M2 | Wasted/stale indexes on `questions`: `status`, `favorite`, `revisionNeeded` (legacy user-state moved to `UserProgress`) + redundant single-field `difficulty/topic/pattern/companies/patterns` | `models/Question.ts:31-33,17-21,48` | Drop legacy indexes (write + RAM savings); keep compounds |
| M3 | Only one global `loading.tsx`, dashboard-shaped, flashes on every route | `app/loading.tsx` | Per-segment `loading.tsx` or scope it |
| M4 | `upsertProgress` does a `findOne` before `findOneAndUpdate` | `lib/progress.ts:247,282` | Fold into the pipeline update |
| M5 | `/api/settings` reads global singleton every call; `activity` heartbeat is 2–3 ops | `api/settings/route.ts:32`; `api/activity/route.ts:75,83,102` | Cache singleton; single pipeline upsert |
| M6 | `User` has no `loginCount` index but it's a sortable column | `models/User.ts`; `api/admin/users/route.ts:16` | Add `{loginCount:-1}` |
| L1 | Per-card `motion.div` (24/page re-animate on every filter/page) | `question-card.tsx:38-42` | CSS keyframe |
| L2 | `merged`/`patch`/`onReset` rebuilt each render | `questions-browser.tsx:52-64` | `useMemo`/`useCallback` (benign — SWR key is a stable string) |
| L3 | Mutation revalidates all `/api/questions*` + `/api/stats` keys | `hooks/use-question-mutations.ts:9-17` | Scope where feasible |

**Already good (no action):** JWT stateless auth + 30 s gate cache; `getProgressMap` batched (no N+1); SWR keys stable, no polling storms, dedupe on; provider context values stable; recharts code-split; keyset pagination on admin users; idempotent unique indexes.

---

## 4. Prioritized implementation roadmap

**Tier 1 — backend, zero UI risk, biggest measured wins**
1. Add missing indexes C1 (+ M2 cleanup, M6) → default list 145–466 ms → ~5 ms.
2. List projection C3 → 113 kB → ~28 kB.
3. Fix difficulty/user-sort C2 → 6–10 s → <200 ms.
4. Parallelize sequential awaits H1, H2, H6 → sum → max.
5. Catalog-stats cache C4, H3, H5, M5 → remove 220 ms+ from dashboard and each catalog endpoint.

**Tier 2 — perceived performance (UI preserved)**
6. Server-render dashboard + question list with SWR `fallback` C5 → real data on first byte.
7. Per-segment `loading.tsx` M3; CSS transitions for `template.tsx`/card H9/L1.
8. `$text` search H7 (behavior-sensitive — hybrid/guarded).

**Tier 3 — hygiene**
9. `Cache-Control`/ETag M1; `upsertProgress` single write M4; memoization L2/L3.

---

## 5. Success-criteria mapping

| Target | Now (measured) | After Tier 1–2 (expected) |
|---|---|---|
| Dashboard opens < 1 s | skeleton + ~250 ms+ API | real data on first byte, facet cached |
| Navigation < 200 ms | remount + refetch | cache-served, no remount |
| Question pages < 300 ms | 145–466 ms (6–10 s on some sorts) | ~5–50 ms indexed |
| API < 100 ms where feasible | list ~250 ms, stats ~250 ms+ | list <50 ms, stats <100 ms (cached) |
| Zero duplicate API calls | duplicate overlays/scans | removed |
| Optimized indexes | 3 critical missing | added; legacy dropped |
| Minimal client JS | 102 kB shared (already fine) | trimmed (framer in root path) |
| No regressions | — | verified per change (typecheck + build + re-measure) |
