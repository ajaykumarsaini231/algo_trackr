# Environment Variables

Single source of truth for configuration. Validation lives in [`src/lib/env.ts`](../src/lib/env.ts) — the app fails fast with a list of every problem instead of crashing mid-request. Copy [.env.local.example](../.env.local.example) to `.env.local` for local dev; set the same keys in Vercel for production. **Never commit real values** — `.env` and `.env.local` are git-ignored.

## Database

| Variable | Required | Default | Example | Notes |
| --- | --- | --- | --- | --- |
| `MONGODB_URI` | ✅ | — | `mongodb+srv://user:pass@cluster0.x.mongodb.net/dsa-tracker` | Must start `mongodb://` or `mongodb+srv://`. Validated shape. |
| `MONGODB_DB` | — | db from URI | `dsa-tracker` | Explicit database name override. |
| `MONGODB_DNS` | — | system DNS | `8.8.8.8,1.1.1.1` | Local-only workaround for networks refusing SRV lookups (`querySrv ECONNREFUSED`). A DNS-over-HTTPS fallback also activates automatically. Leave unset on Vercel. |

## Authentication & roles

| Variable | Required | Default | Example | Notes |
| --- | --- | --- | --- | --- |
| `AUTH_SECRET` | ✅ | — | output of `openssl rand -hex 32` | ≥32 chars enforced. Signs session JWTs and the impersonation cookie. Rotating it signs everyone out. |
| `ADMIN_EMAILS` | — | `""` | `ops@example.com,lead@example.com` | Comma-separated; matching accounts get role `admin` at register/login. |
| `SUPER_ADMIN_EMAILS` | — | `""` | `owner@example.com` | Grants `superadmin` (impersonation, role changes, deletes, resets). **Wins over** `ADMIN_EMAILS`. Set before the owner registers. |

## Rate limiting (optional, recommended in production)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | — | unset | With the token, upgrades all rate limits to durable sliding windows shared across serverless instances. |
| `UPSTASH_REDIS_REST_TOKEN` | — | unset | Without Upstash, limits degrade to per-instance memory (fine for dev/single node). |

## WhatsApp reminders (feature-flagged: off until set)

Both spellings are accepted where noted — the project's `.env` historically used the left-hand names.

| Variable | Required for reminders | Default | Notes |
| --- | --- | --- | --- |
| `WHATSAPP_TOKEN` *(or `WHATSAPP_ACCESS_TOKEN`)* | ✅ | unset | Meta permanent access token. Never logged; sends fail with classified `auth` errors when expired. |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | unset | The sender phone-number id from the Meta app. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | — | unset | WABA id; used for template introspection/tooling, not for sending. |
| `WHATSAPP_GRAPH_VERSION` *(or `GRAPH_API_VERSION`)* | — | `v20.0` | Graph API version segment. |
| `WHATSAPP_TEMPLATE_LANG` | — | `en` | Language code of the approved `task_due_reminder` template. |
| `REMINDER_CRON_SECRET` | ✅ | unset | Bearer token for `POST /api/reminders/run`. Must equal the GitHub repository secret of the same name. Compared timing-safely. |

Unset credentials never crash the app: the settings UI shows a "not configured" notice and the engine reports `configured: false`.

## Runtime

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | set by tooling | `development` | Controls secure cookies, error detail hiding, etc. |

## Security notes

- Generate secrets with `openssl rand -hex 32`; use different values per environment.
- The Meta token and Mongo URI are the two highest-value secrets — scope the DB user to this database only, and prefer a Meta **system-user** token with only WhatsApp permissions.
- If a secret ever lands in git history: rotate it immediately (history rewrite alone is not sufficient once pushed).

## GitHub repository secrets (Actions)

Not environment variables of the app, but part of configuration:

| Secret | Purpose |
| --- | --- |
| `REMINDER_APP_URL` | Deployed base URL the workflow calls (no trailing slash). |
| `REMINDER_CRON_SECRET` | Same value as the server env var above. |
