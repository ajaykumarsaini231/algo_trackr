# Feature List

Complete, categorized, and honest — items marked ⚠ are present but data- or config-dependent; ✗ items are explicitly not implemented.

## Authentication & accounts
- Email/password registration with strong validation; Auth.js v5 credentials sign-in
- JWT sessions (14d, rolling), secure cookies; `/` shortcut-friendly public pages: `/signin`, `/signup`
- Roles: `user`, `admin`, `superadmin` via env allowlists, re-derived every login
- Brute-force lockout (per email + per IP), timing-hardened login, friendly blocked/suspended/locked messages
- Live session revocation: force logout, block, suspend, soft delete (sessionVersion gate)
- ✗ OAuth providers, email verification, password reset (roadmap)

## Dashboard
- Progress overview strip (total/solved %/attempted/unsolved/revision due/favorites)
- Easy/Medium/Hard solve progress + difficulty distribution donut (lazy recharts)
- Continue practicing + revision-due cards; topic progress; recently added/solved
- 182-day activity heatmap with current/max streaks

## Learning system
- Four stages (Foundation→Expert) with unlock thresholds (0/15/25/15 solved in previous)
- Priority-scored continue-learning queue (Blind75 +50, Striver +40, LeetCode +15, topic priority)
- Mixed challenge (best unsolved per topic); topic + pattern roadmaps
- Per-topic progressive unlock: stages of 5, ordered by difficulty rank + learning score, 80% to unlock; flat "view all" escape hatch; est. time remaining

## Questions & tracking
- 15k+ catalog: title/links/platform/difficulty/topic/subtopic/tags/editorial fields
- Per-user: 6-state status, favorite, rating (0–5), attempt count, personal + revision notes, revision date scheduling, solvedAt stamping
- Archive-not-delete catalog policy (admin)

## Topics · Patterns · Companies · Sheets
- 17-topic taxonomy with subtopics; topic pages + per-topic learning
- 163-pattern engine (multikey slugs, auto-classified 94%), category dashboard, per-pattern pages ­— plus the legacy 17-pattern view
- Sheets: Blind 75 (curated, link-matched) + Striver A2Z, DP, Graph, Trees, Greedy, Binary Search, Sliding Window, Two Pointers (dynamic)
- ⚠ Company progress: full UI + queries exist; `companies[]` catalog data is sparse until the fill tooling (`roadmap-tools/fill-companies.mjs`) is run — honest empty states meanwhile

## Statistics & analytics
- Full per-user stats: splits by difficulty/topic/pattern/company/platform/status, monthly added/solved, heatmap, completion %
- Google readiness: priority-weighted coverage + progress scores, tiers, per-topic coverage targets

## Recommendations (rule-based)
- Weekly Google list (top unsolved by priority), Google-hard set
- Weak-topic detection (Critical/High priority, lowest completion)
- Next-topic and related-sheet suggestions in topic learning
- ✗ ML personalization

## Revision
- Flagging via statuses or explicit flag; scheduled revision dates; last-revised stamps
- Revision page + dashboard due-count; admin viewer buckets (due today/missed/upcoming)

## Search & filtering
- Escaped regex search across catalog fields + your own notes
- Filters: topic, subtopic, pattern (name or slug), platform, difficulty, company, status, favorites, revision, min rating, archived
- Whitelisted sorts incl. per-user rating/attempts; bounded pagination

## Admin
- Catalog: PIN-or-role gated import (append/upsert, 5000 rows), JSON/CSV export, idempotent seed, app settings, question CRUD
- Users: cursor-paginated directory (search/filter/sort incl. solved), per-user activity columns
- User Dashboard Viewer: read-only mirror of the user's dashboard + history/timeline/revision + moderation controls
- Moderation: block/suspend/reactivate, force logout, soft delete/restore, name/role edits, progress resets (scoped)
- Superadmin impersonation with banner + one-click return, fully audited
- Audit log browser; reminder operations dashboard with dry-run

## WhatsApp reminders
- Per-user settings: phone/country/timezone (mandatory to enable), goal, window, interval
- Active-time tracking (visibility+focus+idle aware), 60s heartbeats, close beacons, anti-gaming caps
- Engine: timezone-local windows, never-message-active rule (2-min heartbeat), goal cutoff, slot-based duplicate prevention (unique claims), classified failures + next-slot retries, dead-token fuse
- Approved 5-param `task_due_reminder` template; per-user last-send status; ⚠ requires Meta credentials + GitHub secrets
- ✗ Delivery/read webhooks (send-accepted is the tracked state)

## GitHub Actions
- `*/15` scheduler with retries, concurrency guard, manual + dry-run dispatch, secret validation, response logging — the only scheduler

## Security
- Middleware auth gate on every page/API; same-origin write enforcement; body-size caps
- Rate limiting (Upstash/memory) in 5 buckets + global IP backstop
- Zod everywhere, whitelisted sorts, regex escaping, ObjectId validation
- Security headers + CSP, HSTS, audit trail (90d TTL), masked PII in logs

## Performance
- Catalog-facet + user-overlay query architecture (no N+1, no giant lookups)
- Keyset pagination on all admin surfaces; denormalized `solvedCount`
- Lazy chart bundles, SWR dedupe/keep-previous, in-process gates/caches, heartbeat write batching
