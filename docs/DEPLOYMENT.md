# Deployment Guide

Tested target: **Vercel + MongoDB Atlas + GitHub Actions + Meta Cloud API**. No other infrastructure is required.

## 1. MongoDB Atlas

1. Create a cluster (M0 free tier works to start) and a database user with readWrite on one database (e.g. `dsa-tracker`).
2. **Network access**: allow `0.0.0.0/0` (Vercel egress IPs are dynamic) — security relies on the credential, so make it strong and scoped.
3. Copy the `mongodb+srv://` URI → `MONGODB_URI`.
4. No migrations: Mongoose creates collections and indexes on first use. For the 15k question catalog, run the [`dsa-question-db/`](../dsa-question-db) import once (locally, pointing at the production URI) or use Admin → Import.

## 2. Vercel

1. *Import Project* → select the GitHub repo. Framework auto-detects Next.js; default build (`npm run build`) works as-is.
2. Set environment variables (Production + Preview): everything in [ENVIRONMENT.md](ENVIRONMENT.md) — at minimum `MONGODB_URI`, `AUTH_SECRET`, `SUPER_ADMIN_EMAILS`; add `REMINDER_CRON_SECRET` + `WHATSAPP_*` for reminders and `UPSTASH_*` for durable rate limits.
3. Deploy. First visit → register with your superadmin email.
4. Notes baked into the code for serverless: pooled connections (`maxPoolSize 10`), `maxDuration = 60` on the reminder run route, JWT sessions (no session store).

## 3. GitHub

- Repo secrets `REMINDER_APP_URL` + `REMINDER_CRON_SECRET` (Actions → the reminder workflow needs both; it fails with a clear error otherwise).
- The workflow is committed at `.github/workflows/reminder.yml` and starts running on schedule as soon as the repo has it — set the secrets first (or disable the workflow) to avoid red runs.

## 4. Meta Cloud API

1. Meta developer app → WhatsApp product → note the **phone number ID** and create a **permanent token** (System User → WhatsApp permissions).
2. Ensure the **`task_due_reminder`** template is approved with 5 positional body params ([exact body](GITHUB_ACTIONS.md#the-whatsapp-template)).
3. Development-mode apps only deliver to allowlisted recipient numbers; production mode requires business verification. Undeliverable numbers surface as classified failures in `/admin/reminders`.

## 5. Domain

Vercel → Domains → add + follow DNS instructions. HSTS is already emitted with `includeSubDomains; preload`, so commit to HTTPS before adding to the preload list. Update `REMINDER_APP_URL` if the canonical URL changes.

## 6. Production build (self-hosted alternative)

```bash
npm ci
npm run build
npm run start          # binds :3000; put a TLS-terminating proxy in front
```
Self-hosting notes: single instance ⇒ in-memory rate limits are fine; replace the GitHub Action with any cron capable of the same authenticated curl if desired (the endpoint contract is identical).

## 7. Monitoring

What exists today:
- **Audit trail** (`/admin/audit`) — auth events, admin actions, reminder runs with stats.
- **Reminder ops** (`/admin/reminders`) — 24h send/failure counts, per-user state, failure feed.
- **GitHub Actions history** — every scheduler run with the JSON stats it received.
- Server logs: Vercel → Functions (errors are logged with detail server-side, generic in responses).

Not included (recommended additions): uptime checks against `/signin`, error tracking (e.g. Sentry), a `/api/health` endpoint.

## 8. Scaling

- Stateless app tier — Vercel scales horizontally; DB pool per instance is capped.
- Turn on **Upstash** in production so rate limits and abuse controls are shared across instances.
- MongoDB: upgrade cluster tier before you hit connection/IOPS ceilings; all hot queries are indexed (see [DATABASE.md](DATABASE.md)); admin surfaces use keyset pagination and remain fast at 100k+ users.
- Reminder engine: batches of 200, send concurrency 8, ≤500 sends/run — raise caps in `lib/reminder-engine.ts` alongside your Meta throughput tier.

## 9. Backup & restore

- **Atlas backups**: enable Cloud Backup (continuous or snapshot). That is the real safety net.
- App-level: Admin → Export (JSON/CSV) covers the question catalog only — *not* user accounts/progress; treat it as a content export, not a backup.
- Restore: Atlas point-in-time restore to a new cluster → repoint `MONGODB_URI` → redeploy. Nothing app-side stores state outside MongoDB.

## 10. Rollback

- **Code**: Vercel → Deployments → Promote a previous deployment (instant). Git-level: `git revert` the offending commit and push.
- **Data**: schema changes are additive-by-convention (new collections/fields, defaults for old docs), so old code runs against new data; use Atlas restore for data incidents.
- **Secrets**: rotating `AUTH_SECRET` invalidates all sessions (users just sign in again); rotating `REMINDER_CRON_SECRET` requires updating the GitHub secret in the same change.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Build fails on Vercel with env validation error | A required var missing in that environment — the message lists exactly which |
| `querySrv ECONNREFUSED` locally | Automatic DoH fallback engages; or set `MONGODB_DNS`. Never needed on Vercel |
| Action red: "secrets are not configured" | Add both repo secrets |
| Action red: HTTP 401 | Secret mismatch between GitHub and Vercel env |
| Reminders "configured: false" | `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` unset in that environment |
| Meta 132000 on sends | Template body params ≠ 5 positional — align template or code |
| Users report instant logouts | `sessionVersion` bumped (force logout), account blocked, or `AUTH_SECRET` rotated |
