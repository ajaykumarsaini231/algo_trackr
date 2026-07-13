# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

- Complete project documentation suite (`README`, `docs/*`, security policy, community templates)

### Performance — end-to-end audit + optimizations (no UI/feature changes)
- Audit + results reports: `PERFORMANCE-AUDIT.md`, `PERFORMANCE-RESULTS.md`
- **Indexes:** added `{archived,createdAt,_id}`, `{archived,updatedAt,_id}`, `{archived,topic,createdAt,_id}` on `questions` and `{loginCount}` on `users` — the default question-list sort went from examining all 15,267 docs (126–173 ms, in-memory sort) to 20 docs (3 ms, index-covered). Idempotent builder: `scripts/ensure-perf-indexes.mjs`
- **Question list:** slim `.select()`/`$project` projection cut the 20-item payload 89% (116 kB → 13 kB); difficulty/rating/attempt sorts no longer load the whole catalog (was 6–10 s) — difficulty now sorts+paginates at the DB; `countDocuments` runs concurrently with the page fetch
- **Catalog cache** (`src/lib/catalog-cache.ts`, 60 s TTL, invalidated on any question write): removes the per-user recomputation of user-independent aggregations in `stats`, `patterns`, `sheets`, `learn`
- **Parallelized** sequential DB round-trips in `computeUserStats`, `/api/questions`, `/api/questions/[id]`, `/api/patterns`, `/api/sheets`, `/api/learn`; removed a duplicate `continueLearning` call and an N+1 stage-count loop
- **App-wide SSR:** every data page now server-renders its initial data and seeds SWR `fallback` so real content paints on first byte instead of blank→skeleton→fetch — dashboard, statistics, google, sheets, learn, topics, companies, patterns, and the question-list pages (favorites, search, revision, topic/pattern/company detail). Route handlers were thinned to share one compute fn each (`computeUserStats`, `computeGoogleRoadmap`, `computeSheetsProgress`, `computeLearnOverview`, `listQuestions`) so the API and SSR can't drift; `initialData` is applied only to the initial un-touched list view
- **/api/google:** was ~12 sequential queries/request; the user-independent catalog half is now one cached, fully parallel batch (only overlay + recommendations are per-user)
- **Bundle:** removed framer-motion from `question-card.tsx` and `template.tsx` (now a Server Component with a CSS transition) — six question-list routes −39 kB First Load JS each (−18%)
- **Loading:** per-segment `loading.tsx` (dashboard + list segments) replacing the single dashboard-shaped global; neutral generic global
- **App-shell chrome by auth, not just route:** `/topics`, `/patterns`, `/companies`, `/sheets`, `/algorithm-patterns` previously rendered the public marketing header/footer for *everyone*, so a signed-in user clicking them from the sidebar lost the app chrome (looked like landing on the home page). Now signed-in users keep the sidebar on these pages; signed-out visitors/crawlers still get the public chrome (SEO preserved)

## [1.0.0] — 2026-07-12

Initial public release (`a8a7ff1`). Highlights of what shipped in it, grouped by era of development:

### Added — platform
- Question catalog (15k+ problems) with topics/subtopics, tags, links, editorial fields; archive-not-delete policy
- Learning system: staged Foundation→Expert path, scored continue-learning queue, per-topic progressive unlock (stages of 5, 80% gate)
- 163-pattern engine with auto-classification; curated + dynamic sheets (Blind 75, Striver A2Z, DP/Graph/Trees/…)
- Google interview prep: readiness scores, coverage targets, tiers, weekly recommendations
- Statistics: per-user splits, monthly trends, 182-day heatmap with streaks
- Search & filtering across catalog fields and personal notes

### Added — multi-user & security (breaking: auth required everywhere)
- Auth.js v5 credentials auth, JWT sessions, register/sign-in pages
- Per-user progress isolation (`user_progress`), overlay read architecture preserving response shapes
- Roles (user/admin/superadmin) via env allowlists; account gate with live revocation (block/suspend/soft-delete/force-logout)
- Edge middleware: auth gate, global rate limiting, request-size caps, cross-origin write rejection
- Brute-force lockouts, security headers + CSP, zod validation on all writes, 90-day audit trail

### Added — admin console
- User directory (cursor pagination, search/filter/sort), read-only User Dashboard Viewer sharing the user-stats pipeline
- Moderation actions with prev/next auditing; superadmin impersonation (30-min signed cookie, banner, one-click return)
- Catalog tooling: bulk import (append/upsert), JSON/CSV export, idempotent seed; audit log browser

### Added — WhatsApp reminder system
- Active-study-time tracker (visibility/focus/idle aware) + heartbeat API with anti-gaming caps
- Reminder engine: per-user timezone windows, goal detection, never-message-active rule, slot-claim duplicate prevention, classified Meta failures with next-slot retries
- GitHub Actions scheduler (`*/15`) with retries/dry-run; approved 5-parameter `task_due_reminder` template integration
- Settings UI + admin reminder operations dashboard

### Changed
- Rebranded AlgoTrackr → **DSAspire** (logo, wordmark, favicon, teal accent); flat information-dense design system; dashboard rebuilt

### Known gaps at release
- No automated tests; no LICENSE file; company catalog data sparse; CSP allows inline/eval scripts (Next hydration); regex search pending `$text` migration
