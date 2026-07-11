# Admin Guide

Operating DSAspire day-to-day. Admin surfaces live under `/admin` with a sub-nav: **Panel · Users · Reminders · Audit logs**.

## Permissions model (read this first)

| Capability | Legacy PIN | `admin` role | `superadmin` role |
| --- | :-: | :-: | :-: |
| Catalog: create/edit/archive questions, import, export, seed, app settings | ✅ | ✅ | ✅ |
| Users directory, user viewer, audit logs, reminder dashboard | — | ✅ | ✅ |
| Block/suspend/reactivate/force-logout **normal users**, edit their names | — | ✅ | ✅ |
| Anything targeting an **admin** account | — | — | ✅ |
| Role changes, soft delete/restore, progress resets, **impersonation** | — | — | ✅ |

Roles come from `ADMIN_EMAILS` / `SUPER_ADMIN_EMAILS` (applied at register/login). The 8-digit PIN (set up once on `/admin`) deliberately does **not** open user management — those actions must be attributable to a named account in the audit log. Nobody can moderate themselves; superadmins are immune to moderation and impersonation.

## Admin Panel (catalog)

`/admin` → unlock with the PIN (or be a role admin):
- **Load sample data** — idempotent starter set.
- **Import** — paste/upload up to 5000 rows; `append` or `upsert` mode (match by problem link, else title+platform); malformed rows are skipped and counted, never fatal. Result shows inserted/updated/skipped.
- **Export** — JSON or CSV of the catalog (`all=true` includes archived). Content export, not a user-data backup.
- **App settings** — site name, revision intervals, UI preferences (also editable from `/settings` by admins).
- Question editing happens in-place across the app (detail pages/forms) once admin-authenticated; questions are archived, never deleted.

## Users page (`/admin/users`)

Search (name / email / exact user ID), filter (status, role, never-logged-in), sort (newest, last login, most logins, most solved, name), cursor-paginated "Load more". Columns include solved + progress %, favorites, revision count, notes count, logins, last login/activity. Click a row → the user's page.

## User Dashboard Viewer (`/admin/users/[id]`)

Read-only by default ("Viewing as admin" badge). You see exactly what the user sees — same stats pipeline — plus operational context:
profile facts (ID, registered, last login/active, login count) · overview strip + difficulty progress · Google readiness + learning stage · topic/pattern progress · sheets · activity heatmap + streaks · revision buckets (due today / missed / upcoming) · learning timeline · **question history** with tabs (All/Solved/Attempted/Favorites/Revision/Notes), topic filter and title+notes search.

**Controls** (top right, per your role): Edit name · role select (superadmin) · **Login as user** (superadmin) · Force logout · Block/Unblock · Suspend/Reactivate · Reset progress (all/topic/pattern; superadmin; confirmed) · Delete/Restore (soft; superadmin).

Effects to know: block/suspend/delete kill the target's live sessions within seconds and block sign-in with a friendly message; restore brings a deleted account back fully intact; reset-progress is the only destructive data operation and is audited with counts.

## Impersonation

"Login as user" opens the app **as** that user for up to 30 minutes: same pages, same data, real validation — ideal for support and for editing progress/notes "as the user" with full auditing. A sticky banner shows who you're viewing as; **Return to admin** ends it instantly. You never see or change their password; admins can't be impersonated; the impersonated identity has zero admin power.

## Reminder dashboard (`/admin/reminders`)

- Summary: enabled count, sent (24h), failed (24h); a banner warns when WhatsApp credentials aren't configured.
- Per-user rows: phone, timezone + window, today's active minutes vs goal, goal state, **active-now** indicator (heartbeat ≤2 min), last heartbeat, last reminder + status, sent/failed today.
- **Recent failed messages**: classified errors (`auth` = token problem — rotate it; `invalid_number` = fix or disable that user's number; `template` = template/params mismatch; `rate_limit`/`network` = self-healing next slot).
- **Dry-run now** (superadmin): evaluates everyone immediately and shows the would-send/skip decision per user — the fastest way to answer "why didn't X get a reminder?".

## Audit logs (`/admin/audit`)

90-day trail of every auth event and admin action with actor, target, IP, user-agent and prev/next values. Filter by class (Authentication, Admin actions, Impersonation, Blocks, Progress resets). Actor/target link to user pages.

## Statistics

Global platform statistics are per-user by design (each account sees its own `/statistics`). Cross-user operational numbers live on the Users list (per-user solved/progress) and the reminder dashboard; a dedicated global-analytics page is not implemented.

## Troubleshooting

| Situation | Do this |
| --- | --- |
| "Admin account required" on Users page | You're PIN-authed only — sign in with an allowlisted account |
| User says "I'm logged out constantly" | Check their status + audit log for force-logout/block events |
| Reminders not sending at all | `/admin/reminders` banner (credentials) → GitHub Action logs (secrets) → Dry-run (eligibility) |
| One user gets no reminders | Dry-run: you'll see `currently_active`, `goal_completed`, window or slot as the reason |
| Import rejected rows | Rows failing validation are counted as `skipped` — export a sample row that works and match its columns |
| Locked out of PIN panel | Lockout clears after 15 min; the PIN hash can be reset by clearing the `admin` collection (DB access required) |
