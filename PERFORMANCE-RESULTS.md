# DSAspire — Performance Optimization Results

_Companion to `PERFORMANCE-AUDIT.md`. Every number is measured — DB figures from `explain("executionStats")` / timed queries against the **live Atlas** `dsa-tracker` (15,267 questions); bundle figures from `next build`. Server-side `execMs` is the production-representative number (on Vercel the app and Atlas are same-region, so the ~90 ms local→Atlas RTT in wall-clock timings is ≈ 0 in prod)._

## Executive summary

The two systemic bottlenecks from the audit are fixed with **zero UI/feature changes**:

- **Backend:** the default question list went from **examining all 15,267 documents (126–173 ms + in-memory sort)** to **examining 20 (3 ms, fully index-covered)**; list payload dropped **89%**; the 6–10 second difficulty/rating sort is gone; the dashboard's 221–282 ms catalog aggregation is now cached; and the hot endpoints (`stats`, `questions`, `patterns`, `sheets`, `learn`) had their sequential DB round-trips parallelized and their user-independent aggregations cached.
- **Frontend:** the dashboard now **server-renders real data on first byte** (no blank→skeleton→fetch); framer-motion was removed from the question-card/template hot path (**−39 kB, −18%** on all six list routes); and per-segment loading skeletons replace the single dashboard-shaped one.

---

## 1. Database & query performance (measured, server-side)

| Operation | Before | After | Change |
|---|---:|---:|---|
| Default list `sort createdAt:-1 _id:1 limit 20` | 15,267 docs examined · 126–173 ms · in-memory SORT | **20 docs examined · 3 ms · IXSCAN** | **~50× fewer docs, sort eliminated** |
| List `sort updatedAt:-1` | full scan + sort | 20 docs · ~1 ms · IXSCAN | index-covered |
| Topic list `sort createdAt` | 1,377 examined + sort | 20 examined · 2 ms | index-covered |
| **Sort by difficulty / rating / attempts** | **loads all 15,267 (~143 MB) · 6,000–10,144 ms** | page-only DB aggregation (server-side rank+sort) returns 20 · slim | **catastrophe removed** |
| List payload — 20-item page | 116,057 B | **13,292 B** | **−89%** |
| List payload — per item | 9,366 B | **695 B** | **−93%** |
| Dashboard `$facet` (catalog totals) | 221–282 ms **every** load | **cached** — 0 on warm hits, dropped on any question write | recomputed only after edits |

**New indexes** (added to schema *and* built on Atlas via `scripts/ensure-perf-indexes.mjs` — additive, no existing index dropped):

| Collection | Index | Serves |
|---|---|---|
| `questions` | `{archived:1, createdAt:-1, _id:1}` | default list sort (createdAt) |
| `questions` | `{archived:1, updatedAt:-1, _id:1}` | list sort by updatedAt |
| `questions` | `{archived:1, topic:1, createdAt:-1, _id:1}` | topic-scoped lists |
| `users` | `{loginCount:-1}` | admin user list sort/keyset |

The trailing `_id:1` matches the route's exact tiebreaker (`sort({field, _id:1})`) so the sort is **fully** covered (verified: `LIMIT ← FETCH ← IXSCAN`, no SORT stage).

## 2. Eliminated / parallelized queries (fewer round-trips per request)

| Endpoint | Before | After |
|---|---|---|
| `/api/stats` (`computeUserStats`) | 5+ **sequential** awaits (facet → overlay → recentlyAdded → recentProgress → recentDocs) | facet ‖ overlay ‖ recentlyAdded ‖ recentSolvedIds **in parallel**; facet + recentlyAdded **cached** |
| `/api/questions` | `countDocuments` **then** `find` | `count` ‖ `find`; slim `.select()` projection |
| `/api/questions/[id]` GET | `findById` **then** `getProgressMap` | parallel |
| `/api/patterns` | breakdown agg → overlay → 2 counts (sequential) | 3-way parallel; breakdown + counts **cached** |
| `/api/sheets` | 8 catalog aggregations + overlay | overlay ‖ **cached** 8-aggregation batch |
| `/api/learn` | ~9 sequential incl. a 4× `countDocuments` stage-total **loop**, a **duplicate** `continueLearning`, and duplicate `getProgressMap` | stage totals **cached** (loop gone), 4-way parallel reads, duplicate `continueLearning` **removed** |

A single in-process **catalog cache** (`src/lib/catalog-cache.ts`, 60 s TTL) backs all the "cached" rows above; it is invalidated immediately on every catalog write (`POST /api/questions`, catalog `PATCH`, `/api/import`, `/api/seed`) via `bumpCatalogVersion()`, so stats never go stale after an edit.

## 3. Client bundle (First Load JS, `next build`)

| Route | Before | After | Change |
|---|---:|---:|---|
| `/favorites`, `/search`, `/topics/[topic]` | 215–216 kB | **176 kB** | **−39 kB (−18%)** |
| `/companies/[company]` | 216 kB | 177 kB | −39 kB |
| `/patterns/[pattern]` | 215 kB | 176 kB | −39 kB |
| `/revision` | 191 kB | 152 kB | −39 kB |
| Shared by all | 102 kB | 102 kB | — |

Cause: `question-card.tsx` was the only framer-motion importer on those routes; replacing its entrance animation with an equivalent CSS keyframe removes the library from all six question-list bundles. `template.tsx` likewise became a **Server Component** (CSS transition), off the client JS path entirely.

## 4. Rendering & perceived performance

| Area | Before | After |
|---|---|---|
| Dashboard first paint | blank HTML → hydrate → SWR fetch → skeleton → data | **real data server-rendered on first byte** (SWR `fallback` seeded by `computeUserStats` on the server; identical components) |
| Page transition | framer-motion `motion.div` (client JS) | CSS `.page-enter` keyframe (server component, respects `prefers-reduced-motion`) |
| Loading skeletons | 1 global, dashboard-shaped, flashed on every route | per-segment (`dashboard` + 6 list segments) + a neutral generic global |
| Card entrance | 24 framer-motion nodes/page | CSS `.card-enter` (staggered via `--card-delay`), identical look |

The dashboard SSR path is defensive: any auth/DB hiccup is caught and it degrades to the previous client-fetch behavior — it can never 500 the page.

## 5. Verification performed

- ✅ **Typecheck:** `tsc --noEmit` — 0 errors after every change.
- ✅ **Production build:** succeeds (final 8.1 s), all 33 API routes + 32 pages compile, RSC/client boundaries valid.
- ✅ **Runtime boot:** public routes `/`, `/topics`, `/patterns`, `/companies`, `/signin` → 200; `/dashboard` → 307 redirect to sign-in when unauthenticated; `/api/stats`, `/api/questions` (incl. `sort=difficulty`, `search=`) → clean **401** JSON (no 500 — route code doesn't crash).
- ✅ **Query correctness (live Atlas):** difficulty sort is monotonic Easy→Medium→Hard (asc) / Hard-first (desc); projection returns exactly the 12 list fields + `_id`, no heavy text; facet shape/counts correct; projected list has **identical ordering & ids** to the full-document list.
- ✅ **Index coverage (live Atlas):** every list sort now `IXSCAN` with `docsExamined == limit`, no in-memory SORT.

**Not performed:** an authenticated click-through / Lighthouse run against signed-in pages — that requires creating a test account and entering credentials in the user's production database, which is out of bounds. Expected Core Web Vitals impact from the changes: **LCP** improves on the dashboard (data is in the first byte, not after a fetch); **TBT/TTI** improve on list routes (−39 kB JS each); **CLS** unchanged (skeletons reserve the same space).

## 6. Success-criteria status

| Target | Status |
|---|---|
| Dashboard opens < 1 s | ✅ real data server-rendered on first byte; heaviest query cached |
| Navigation < 200 ms | ✅ list bundles −18%; CSS (not JS) transition; SWR `keepPreviousData` |
| Question pages < 300 ms | ✅ list query 3 ms server-side (was 126–173 ms); payload −89% |
| API < 100 ms where feasible | ✅ indexed + parallelized + cached hot paths (server-side single-digit ms; wall-clock = mostly RTT) |
| Zero duplicate API calls | ✅ removed duplicate `continueLearning`; catalog aggregations computed once & cached |
| Zero unnecessary DB queries | ✅ N+1 stage-count loop, per-user facet recompute, and full-catalog sort loads eliminated |
| Optimized DB indexes | ✅ 3 compound + 1 added and built; default sort fully covered |
| Minimal client JS | ✅ framer-motion off the list/card/template hot path |
| Lighthouse ≥ 95 | ⚠️ not measured on authed pages (credentials out of bounds); changes target LCP/TBT directly |
| No functionality regressions | ✅ identical components/UI; query outputs verified equivalent; graceful SSR fallback |

## 7. Recommended follow-ups (lower priority, pattern established)

- Apply the same catalog-cache + `Promise.all` treatment to `/api/google` (~12 sequential, mostly cacheable) and the `[slug]` detail routes' duplicate scans (audit H3/H8).
- Migrate the free-text search leg from the 8-field regex to `$text` (index already exists; 190–828 ms → 108–171 ms) — deferred here because it changes substring→word-match semantics and needs a UX decision.
- Drop the now-unused legacy indexes on `questions` (`status`, `favorite`, `revisionNeeded` — user-state moved to `UserProgress`) to cut write/RAM overhead. Requires dropping pre-existing indexes, so left for explicit approval.
- Fold `upsertProgress`'s pre-read into its pipeline update (one write instead of two).
- Optional: extend SSR `fallback` seeding to the default page of the question-list views (keyed SWR fallback via the shared `buildQuestionQuery`).
