# Project Audit — DSAspire

_Point-in-time engineering audit, updated 2026-07-12 (post multi-user refactor, admin console, WhatsApp reminder system, and documentation suite). Supersedes the pre-multi-user audit. Evidence: source review of all 35 API routes / 11 models / middleware, `npm run typecheck` + production builds, and scripted live verification (two-account isolation, privilege-escalation matrix, impersonation round-trip, reminder eligibility + live Meta sends). Anything not measurable statically is marked **unverified**._

## Scores

| Dimension | Score | Basis |
| --- | ---: | --- |
| Architecture | 86 | Clean layering (routes → lib → models), overlay pattern, split-config auth; a few oversized page components |
| Security | 87 | Live-revocable sessions, role matrix verified by escalation tests, lockouts, headers/CSP, audit trail; CSP still allows inline/eval scripts, no CAPTCHA |
| Performance | 80 | Facet+overlay reads, keyset pagination, indexed everything, batched heartbeats; regex search leg and `$nin(solvedIds)` are known ceilings |
| Scalability | 80 | Designed-for-100k admin surfaces + reminder batching; Meta throughput and regex search are the first real walls |
| Maintainability | 82 | Strict TS, consistent route skeleton, honest docs suite; JS-twin predicates need discipline, some 700-line pages |
| Accessibility | 66 | Semantic markup, labels, focus states exist; **no formal axe/contrast audit (unverified)** |
| Code quality | 84 | Uniform envelopes/guards, zod everywhere; localized `any` casts around aggregation results |
| **Production readiness** | **81 / 100** | Ready for real multi-user traffic; the test gap is the main risk multiplier |

## Strengths

- **Isolation by construction** — every user-data query is session-scoped in one layer (`lib/progress.ts` + guards); verified empirically with two accounts across all read paths.
- **Revocable stateless auth** — JWT + 30s DB gate gives both serverless scale and ~instant block/suspend/force-logout, proven live.
- **Idempotency discipline** — unique-index claims (reminder slots, progress rows, emails) make retries and races harmless; verified with overlapping runs.
- **Honest degradation** — WhatsApp/Upstash features flag off cleanly; empty-data states (companies) never fabricate numbers.
- **Operational visibility** — audit trail with prev/next values, reminder ops dashboard with classified failures, dry-run mode.

## Weaknesses / risks

1. **Zero automated tests** (unchanged from v1 audit) — every guarantee above is re-verified by hand/scripts, not CI. Highest-leverage fix: Vitest over `reminder-engine` rules, `local-time`, `upsertProgress`; route tests on `db:mem`. (~2–3 days for a meaningful baseline.)
2. **Search** — free-text leg is an escaped regex scan; fine at 15k, wrong at 100k+. The text index already exists; migrate the search leg to `$text`/Atlas Search. (~3h)
3. **CSP** — `script-src 'unsafe-inline' 'unsafe-eval'` (Next hydration); nonce-based CSP is the follow-up. (~0.5–1 day incl. regression testing)
4. **Dependency advisories** — 2 moderate (Next-bundled postcss) at last check; fix = Next patch bump, never `npm audit fix --force`. (~1h)
5. **`$nin: solvedIds`** in learn queries grows with a user's solve count (thousands of ObjectIds inline). Acceptable now; consider a per-user solved-set collection join later.
6. **solvedCount drift window** — read-then-inc has a self-limited race; recount runs on admin resets. Periodic reconcile job would close it fully.
7. **No CI** — only the scheduler workflow exists; add typecheck+build (+tests) on PR. (~1h)
8. **Deleted-account JWT UX** — middleware (edge, no DB) admits the shell; APIs 401. Cosmetic edge: client could auto-signOut on repeated 401s.

## Technical debt register

| Item | Cost of ignoring | Effort |
| --- | --- | --- |
| Test suite | regressions land silently | 2–3 days |
| `$text` search migration | search latency grows with catalog | ~3h |
| CSP nonces | XSS blast-radius larger than needed | ~1 day |
| Next patch bump | known advisories linger | ~1h + smoke |
| CI pipeline | gates rely on developer discipline | ~1h |
| Oversized components (`questions/[id]/page`, `question-form`, admin user viewer) | slower changes in those areas | opportunistic |
| Legacy user-state fields frozen on `questions` | schema confusion for new devs (documented in DATABASE.md) | remove after a data backfill audit |

## Future improvements (beyond debt)

OAuth + email verification + password reset · WhatsApp delivery webhooks · global admin analytics page · company-data enrichment run at scale · virtualized long lists · APM/error tracking (Sentry) · nightly counter-reconciliation job.

## Verdict

The platform is **genuinely production-ready for real multi-user use today**: authentication, isolation, moderation, scheduling and messaging are implemented coherently and were verified against live systems. The gap between "solid" and "bulletproof" is almost entirely **automated testing + CI**; close that before inviting significant traffic or contributors.
