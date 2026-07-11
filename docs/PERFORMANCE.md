# Performance Guide

What keeps DSAspire fast, and where the ceilings are.

## Query architecture (the big one)

The multi-user design keeps per-request work proportional to the **user's own data**, not the catalog:

- **Catalog totals** come from one `$facet` aggregation over `questions` (a single round trip, identical for every user).
- **User overlays** come from the user's own `user_progress` rows — one indexed `$match userId` (+ slim `$lookup`) — then merged in JS. A user with 500 solves costs ~500 rows of work regardless of the 15k catalog.
- **Page overlays** batch-fetch progress for the visible page ids with one `$in` query — the codebase has no N+1 read paths.

## Indexes

Every hot path is index-backed (full list in [DATABASE.md](DATABASE.md#indexes-complete-list)): compound `(userId, X)` on all user-state queries, unique claims for idempotency, learning-order compound on the catalog, TTL indexes for log retention. The admin directory's sortable columns each map to an index, including the denormalized `users.solvedCount` that exists purely so "sort by solved" doesn't aggregate 100k users' progress.

## Pagination

- User-facing lists: bounded page/limit (`limit ≤ 100`, `page ≤ 10000`) — acceptable at catalog scale.
- Admin surfaces (users, audit, reminder ops, question history): **keyset/cursor pagination only** — `(sortField, _id)` comparisons, no skip/offset, constant cost at any depth.

## Search

Regex search is escaped, length-capped and ANDed with indexed filters; the user-notes leg resolves ids from the user's own rows first. Known ceiling: an unanchored regex over 15k docs is a scan (~fine today). The `title/concept/approach/notes/tags` **text index already exists** — switching the free-text leg to `$text` (or Atlas Search) is the documented next step for 100k+ catalogs.

## Aggregation discipline

`$facet` for one-trip dashboards; `$unwind` only on bounded arrays (companies, patterns); per-page `$in` groups for admin enrichment; **no unbounded `$lookup` fan-outs** (the overlay pattern exists precisely to avoid 15k indexed lookups per request). The learn queue's `_id: { $nin: solvedIds }` grows with a power user's solve count — bounded in practice (id arrays of a few thousand), noted in AUDIT.md.

## Write minimization

- Heartbeats: client accumulates locally, flushes ≤1 write/user/minute, goes silent when idle; server caps credited time (no gaming, no write amplification).
- Reminder engine: keyset batches of 200, send concurrency 8, ≤500 sends/run; settings/history writes only on actual sends.
- Account gate + activity prefs use in-process TTL caches (30s / 60s) so per-request DB overhead is one cheap read at most, amortized.

## React / Next.js optimization

- **Bundle**: recharts is lazy-loaded (`next/dynamic`, `ssr: false`) — dashboards ship hand-rolled CSS/SVG charts by default; first-load JS ~102 kB shared.
- **SWR**: global `dedupingInterval: 5s`, `keepPreviousData` (no skeleton flashes on filter changes), focus revalidation off; mutations revalidate targeted key prefixes.
- Memoized heavy components (`QuestionCard` is `React.memo` + hover-preloads its detail data); `MotionConfig reducedMotion="user"`.
- All API routes `force-dynamic` — correctness over ISR for per-user data; static assets and pages benefit from Vercel's edge cache.

## Virtualization

Not implemented — current list sizes (≤100/page) render fine. If page sizes grow, virtualize the questions browser first.

## Scaling profile

| Load axis | Mechanism | Ceiling to watch |
| --- | --- | --- |
| Users (accounts) | keyset pagination, indexed filters, `solvedCount` denormalization | none practical at 100k+ |
| Per-user activity | 1 write/min/user heartbeats | Mongo write IOPS ≫ headroom |
| Catalog size | facets + indexes | regex search leg → move to `$text` |
| Reminder fan-out | batches + caps + slot idempotency | Meta throughput tier; raise engine caps together |
| Serverless concurrency | pool cap 10/instance, Upstash limits | Atlas connection ceiling → raise tier |

## Monitoring performance

Watch: Vercel function durations (stats/learn are the heaviest reads), Atlas slow-query log (should be empty — everything indexed), reminder `durationMs` in run stats, Action run times. No APM is wired today; adding one is listed in the roadmap.
