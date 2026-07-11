# API Reference

Every endpoint lives under `/api/*` (Next.js route handlers, Node runtime). This reference is generated from the actual route files in `src/app/api/`.

## Conventions

**Envelope** — every JSON endpoint (except file downloads from `/api/export`):

```json
{ "success": true,  "data": { } }
```
```json
{ "success": false, "error": "human-readable message" }
```

**Authentication** — session cookie issued by Auth.js (`POST /api/auth/callback/credentials`). The edge middleware returns `401 {"success":false,"error":"Sign in required"}` for any non-public API without a session. Additional per-route guards:

| Guard | Meaning |
| --- | --- |
| `user` | any signed-in, non-blocked account (impersonated identity counts as the target user) |
| `admin` | role `admin`/`superadmin` **or** legacy admin-PIN cookie (catalog operations only) |
| `role-admin` | role `admin`/`superadmin` account required (attributable; PIN not accepted) |
| `superadmin` | role `superadmin` only |
| `cron` | `Authorization: Bearer $REMINDER_CRON_SECRET` (timing-safe) or superadmin session |

**Rate limits** (per user id, or IP when anonymous; Upstash sliding window when configured, else per-instance):

| Bucket | Limit | Applied to |
| --- | --- | --- |
| `auth` | 10/min | register |
| `read` | 240/min | GET endpoints |
| `mutate` | 60/min | state-changing user endpoints |
| `heavy` | 5/5min | import, export, seed, reset-progress, reminder runs |
| `global` | 400/min/IP | middleware backstop on everything |

Exceeding a limit returns `429` with a `Retry-After` header. Mutating cross-origin browser requests are rejected `403` at the middleware; request bodies are capped (1 MB default, 8 MB for import) with `413`.

**Common errors** — `401` (no/dead session), `403` (insufficient role, cross-origin write), `404` (unknown id/slug), `409` (uniqueness conflict), `413` (body too large), `422` (zod validation, message names the field), `429` (rate limit), `500/503` (generic in production; detail is logged server-side).

---

## Auth

### `POST /api/auth/register`
Create an account. **Auth:** none · **Rate:** `auth` (per IP).

Body: `{ "name"?: string≤80, "email": string, "password": string≥8 (letter+number) }`
`201 {"registered":true}` · `409` email exists · `422` validation.

```bash
curl -X POST https://app.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","password":"passw0rd1"}'
```

### `GET|POST /api/auth/[...nextauth]`
Auth.js internals: `GET /api/auth/csrf`, `GET /api/auth/session`, `POST /api/auth/callback/credentials` (form-encoded `csrfToken`, `email`, `password`), `POST /api/auth/signout`. Sign-in failure codes surfaced to the client: `locked`, `blocked`, `suspended`, generic invalid.

```bash
# scripted sign-in (cookie jar)
CSRF=$(curl -s -c jar https://app.example.com/api/auth/csrf | jq -r .csrfToken)
curl -s -b jar -c jar -X POST https://app.example.com/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=ada@example.com" \
  --data-urlencode "password=passw0rd1"
```

---

## Activity

### `POST /api/activity`
Study-time heartbeat (sent by the client tracker; sendBeacon-compatible — body parsed from raw text). **Auth:** `user` · **Rate:** `mutate`.

Body: `{ "seconds": int 0..600, "tz"?: IANA string, "active": boolean, "final"?: boolean }`
Server caps credited seconds at real elapsed time since the previous heartbeat (+90s grace).
`200 {"dateKey":"2026-07-12","activeMinutes":42,"goalMinutes":60,"goalCompleted":false}`

---

## Questions

### `GET /api/questions`
Paginated catalog list overlaid with the **caller's** progress. **Auth:** `user` · **Rate:** `read`.

Query params: `search` (≤200 chars, regex-escaped; also searches your notes) · `topic` `subtopic` `pattern` (legacy name) `patterns` (slug) `platform` `difficulty` `company` · user-state filters `status` `favorite=true` `revision=true` `minRating` · `archived=true` · `sort` = `createdAt|updatedAt|title|difficulty|rating|attemptCount` + `:asc|:desc` · `page` (≤10000) `limit` (≤100).

`200 {"items":[Question...],"total":n,"page":1,"limit":20,"totalPages":n}` — `Question` includes your `status/favorite/notes/rating/...` merged in.

```bash
curl -b jar "https://app.example.com/api/questions?topic=Graph&difficulty=Hard&favorite=true&limit=10"
```

### `POST /api/questions` — **admin**, `mutate`
Create a catalog question. Body: full question shape (zod `questionCreateSchema`). `201 Question` · audited `question.create`.

### `GET /api/questions/[id]` — `user`, `read`
One question + your progress. `404` invalid/unknown id.

### `PATCH /api/questions/[id]` — split authorization, `mutate`
One endpoint, two scopes decided by payload keys:
- **User-state keys** (`status,favorite,revisionNeeded,lastRevisedAt("now" supported),revisionDate,attemptCount,rating,notes,revisionNotes`) → upserts **your own** progress row. Any signed-in user.
- **Catalog keys** (title/links/topic/archived/…) → requires **admin**; audited `question.update`.
Response: the merged question. Archive/restore = `{"archived":true|false}` (admin).

```bash
curl -b jar -X PATCH https://app.example.com/api/questions/665f... \
  -H "Content-Type: application/json" \
  -d '{"status":"Solved","rating":4,"notes":"two-pointer from both ends"}'
```

---

## Stats & analytics

### `GET /api/stats` — `user`, `read`
The dashboard payload (`Stats` type): totals, per-difficulty/topic/pattern/company splits (catalog totals + your solved counts), byStatus, 6-month monthly progress, 182-day heatmap, recently added/solved, revision counts. Same computation the admin viewer uses (`lib/user-stats.ts`).

### `GET /api/google` — `user`, `read`
Google-prep roadmap: readiness scores (coverage 40% + progress 60%, priority-weighted), per-topic rows with coverage targets, difficulty tiers, weekly recommendations (top-25 unsolved by priority), Google-hard list, company overlap.

---

## Learning

### `GET /api/learn` — `user`, `read`
Overview: stage stats (Foundation/Intermediate/Advanced/Expert + unlock state), scored continue-learning queue (`?section=continue&stage=&skip=&limit=` for load-more, limit ≤50), mixed challenge (best unsolved per topic), topic + pattern roadmaps. All solved/unlock math is per-caller.

### `GET /api/learn/topic/[slug]` — `user`, `read`
Progressive-unlock topic view: stages of 5 ordered by `difficultyRank, learningScore`; next stage unlocks at ≥80% of the previous; `?reveal=n` reveals up to n stages, `?view=all&page=&limit=` is the flat list. Returns continue-question id, est. remaining minutes, recommendations. `404` unknown topic slug.

---

## Patterns & sheets

### `GET /api/patterns` — `user`, `read`
163-pattern dashboard grouped by category: catalog counts per pattern + your solved counts, most/least used, classification summary.

### `GET /api/patterns/[slug]` — `user`, `read`
One pattern: stats + paginated questions (`page,limit≤100,difficulty,status` — status filters on *your* state), overlaid with your progress. `404` unknown slug.

### `GET /api/sheets` — `user`, `read`
All sheets (Blind 75 + 8 dynamic) with your solved counts.

### `GET /api/sheets/[key]` — `user`, `read`
Sheet detail + paginated questions (`page,limit,difficulty,status`), favorites-first ordering, your progress overlaid. `404` unknown key.

---

## App settings

### `GET /api/settings` — `user`, `read`
App settings singleton (site name, revision intervals, UI prefs).

### `PATCH /api/settings` — **admin**, `mutate`
Whitelisted fields only (`siteName,accentColor,defaultPageSize,defaultTheme,revisionIntervals,showConfetti,compactMode,preferences`). Audited.

---

## WhatsApp reminders

### `GET /api/reminders/settings` — `user`, `read`
Your reminder prefs + live today-snapshot (active minutes, goal state, last heartbeat) + `whatsappConfigured` + last send status.

### `PUT /api/reminders/settings` — `user`, `mutate`
Body: `{reminderEnabled, countryCode "+NN", phoneNumber digits, timezone IANA, goalMinutes 5..960, reminderStart "HH:mm", reminderEnd "HH:mm" (> start), reminderInterval 15|30|45|60}`.
Enabling **requires** phone + country code + timezone (`422` otherwise). Audited with masked phone (last 4 digits only).

### `POST /api/reminders/run` — **cron**, `heavy` (shared key)
The scheduler entrypoint (public path; self-authenticated). `?dryRun=1` evaluates without sending/claiming.
`200` stats: `{configured,dryRun,checked,sent,failed,wouldSend,skipped:{reason:n},haltedEarly,durationMs,decisions[≤50]}` · `401` bad/missing token.

```bash
curl -X POST "https://app.example.com/api/reminders/run?dryRun=1" \
  -H "Authorization: Bearer $REMINDER_CRON_SECRET"
```

---

## Admin — catalog plane (**admin**: role OR legacy PIN)

### `GET /api/admin/auth` — none required
Panel state: `{configured, authenticated, locked, lockedUntil, attemptsRemaining}`.

### `POST /api/admin/auth` — rate-limited per IP
PIN login. Body `{password: 8 digits}`. Sets `admin_session` cookie (HMAC, 8h). `423` when locked (5 fails / 15 min, DB-backed) · `401` wrong key with attempts remaining.

### `POST /api/admin/setup`
One-time PIN creation (`409` once configured — takeover-safe). Body `{password, confirm}`.

### `POST /api/admin/logout`
Clears the PIN session cookie.

### `POST /api/import` — **admin**, `heavy`, body ≤8 MB
Bulk import. Body `{mode:"append"|"upsert", questions: row[] ≤5000}`. Rows are header-normalized (accepts `title/Title`, `link/url`, CSV-ish arrays), zod-validated per row (invalid rows counted as `skipped`, never abort the batch). Upsert matches `problemLink`, falling back to `title+platform`. `200 {inserted,updated,skipped}` · audited.

### `GET /api/export` — **admin**, `heavy`
File download (no envelope): `?format=json|csv`, `?all=true` includes archived. CSV is spreadsheet-safe (quoted/escaped). Audited.

### `POST /api/seed` — **admin**, `heavy`
Insert curated sample questions; idempotent by title. `200 {inserted}`.

---

## Admin — people plane (**role-admin** unless noted)

### `GET /api/admin/users` — `read`
Cursor-paginated directory. Params: `search` (name/email substring or exact ObjectId), `status` (`active|blocked|suspended|deleted|never-logged-in`), `role`, `sort` (`createdAt|lastLoginAt|name|loginCount|solved`), `dir`, `cursor`, `limit≤50`.
`200 {items:[{id,email,name,role,status,createdAt,lastLoginAt,lastActiveAt,loginCount,solved,progressPct,favorites,revision,notes,lastActivity}],total,nextCursor,catalogTotal}`.

### `GET /api/admin/users/[id]` — `read`
The User Dashboard Viewer payload: `{profile, stats (full user Stats), learning:{stages,currentStage}, googleReadiness, sheets, revision buckets + recentlyRevised, timeline[≤40], weakTopics}`.

### `PATCH /api/admin/users/[id]` — `mutate`
Edit `{name?, email?, role?: "user"|"admin"}`. Role changes and edits to admin accounts require **superadmin**; superadmin role itself is env-managed (`403`); self-role-change blocked; email uniqueness `409`. Audited with prev/next.

### `POST /api/admin/users/[id]/status` — `mutate`
Body `{action: block|unblock|suspend|reactivate|delete|restore}`. Block/suspend/delete bump `sessionVersion` (live sessions die ≤30s). delete/restore = **superadmin**; admins can't moderate admins (superadmin can, except superadmins are immune); self-moderation blocked. Audited.

### `POST /api/admin/users/[id]/logout` — `mutate`
Force-invalidate all sessions (sessionVersion bump). Audited.

### `POST /api/admin/users/[id]/reset-progress` — **superadmin**, `heavy`
Body `{scope:"all"|"topic"|"pattern", value?}`. Deletes matching progress rows, recounts `solvedCount`. Audited with counts.

### `POST /api/admin/users/[id]/impersonate` — **superadmin**, `mutate`
Start impersonation: sets 30-min HMAC httpOnly cookie. Only active, non-deleted, role-`user` targets. Audited `admin.impersonate_start`.

### `GET|DELETE /api/admin/impersonation` — **superadmin**
Banner state / one-click stop (audited).

### `GET /api/admin/users/[id]/questions` — `read`
Target user's history: `filter=all|solved|attempted|favorite|revision|notes`, `topic`, `search` (question titles + their notes), cursor on `(updatedAt,_id)`, `limit≤50`. Returns progress + slim catalog join per row.

### `GET /api/admin/audit-logs` — `read`
Cursor-paginated trail: `action` (exact or `prefix*`), `userId`, `targetUserId`, `limit≤100`. Actor/target emails resolved.

### `GET /api/admin/reminders` — `read`
Reminder ops: summary (enabled/sent24h/failed24h), per-user rows (phone, window, today's minutes, goal state, active-now, last send), recent failures, `nextCursor`.

---

## Endpoint index

| Method | Path | Guard |
| --- | --- | --- |
| POST | `/api/auth/register` | — |
| * | `/api/auth/[...nextauth]` | — |
| POST | `/api/activity` | user |
| GET/POST | `/api/questions` | user / admin |
| GET/PATCH | `/api/questions/[id]` | user (+admin for catalog keys) |
| GET | `/api/stats` · `/api/google` · `/api/learn` · `/api/learn/topic/[slug]` · `/api/patterns` · `/api/patterns/[slug]` · `/api/sheets` · `/api/sheets/[key]` | user |
| GET/PATCH | `/api/settings` | user / admin |
| GET/PUT | `/api/reminders/settings` | user |
| POST | `/api/reminders/run` | cron/superadmin |
| GET/POST | `/api/admin/auth` · POST `/api/admin/setup` · POST `/api/admin/logout` | PIN flow |
| POST | `/api/import` · `/api/seed` · GET `/api/export` | admin |
| GET | `/api/admin/users` · `/api/admin/users/[id]` · `.../questions` · `/api/admin/audit-logs` · `/api/admin/reminders` | role-admin |
| PATCH | `/api/admin/users/[id]` | role-admin / superadmin |
| POST | `.../status` · `.../logout` | role-admin (rules) |
| POST | `.../reset-progress` · `.../impersonate` · GET/DELETE `/api/admin/impersonation` | superadmin |
