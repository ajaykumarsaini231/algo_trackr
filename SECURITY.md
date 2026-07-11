# Security

This document is both the **security model reference** and the **vulnerability reporting policy** for DSAspire.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Report privately via GitHub's **Security → Report a vulnerability** (private advisory) on this repository, or contact the owner directly. Include reproduction steps and impact. You should receive an acknowledgement within a few days; please allow reasonable time for a fix before disclosure.

---

## Authentication

- **Auth.js (NextAuth v5)** credentials provider — `src/auth.ts`. Passwords hashed with **bcrypt cost 12**; hash stored with `select: false` so it never leaves queries accidentally.
- **JWT sessions**: 14-day max age, refreshed at most every 24h. Cookies are httpOnly, `SameSite=Lax`, `Secure` + `__Secure-` prefix in production (Auth.js defaults pinned in `auth.config.ts`).
- **Timing-hardened login**: unknown emails still burn a bcrypt comparison (constant-shape failure), so response timing doesn't reveal registration; lockout messages don't distinguish wrong-password from unknown-email.
- **Registration**: zod-validated, rate-limited per IP, duplicate-email race handled via the unique index (E11000 → 409).

## Session management & revocation

Stateless JWTs are augmented by a DB-backed **account gate** (`lib/auth-helpers.ts`): each request re-validates status, soft-deletion and `sessionVersion` through a 30-second cache. Consequences:

- **Force logout** (self-serve for admins, per-user in user management) bumps `sessionVersion` → every outstanding JWT dies within ~30s.
- **Block / suspend / soft-delete** also bump the version → sessions die immediately; sign-in shows a friendly blocked/suspended message (codes surfaced from `CredentialsSignin`).
- Sessions survive nothing: role demotions apply live because role is read from the gate, not the token.

## Authorization / role system

| Tier | Grants | Source of truth |
| --- | --- | --- |
| `user` | own data only — every query is scoped by the session's `userId` server-side | default |
| `admin` | catalog ops (questions, import/export/seed, app settings) + user management reads/moderation of non-admins | `ADMIN_EMAILS` allowlist |
| `superadmin` | impersonation, role changes, soft delete/restore, progress resets, moderating admins | `SUPER_ADMIN_EMAILS` allowlist |
| legacy PIN | catalog ops **only** (8-digit key, bcrypt-12, HMAC cookie, 8h TTL, DB lockout) | Admin Panel setup |

Escalation guards enforced in routes: nobody moderates themselves; admins cannot touch other admins; superadmins cannot be moderated or impersonated; role changes can't target superadmins or the caller; user-management endpoints refuse the PIN (auditability requires an identified account).

**Impersonation** (`lib/impersonation.ts`): superadmin-only, 30-minute HMAC-signed httpOnly cookie; the effective identity's role is forced **down** to `user`; admin checks always evaluate the raw session; start/stop are audit-logged. Credentials of the target are never read or altered.

## CSRF

- Auth routes: Auth.js built-in CSRF tokens.
- App APIs: `SameSite=Lax` httpOnly cookies + JSON content type, **plus** middleware defense-in-depth — mutating requests with a cross-site `Sec-Fetch-Site` or mismatched `Origin` are rejected `403` before any handler runs.

## XSS

- React escaping everywhere; **zero** `dangerouslySetInnerHTML` in the codebase.
- Restrictive **CSP** (`next.config.mjs`): `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. (`script-src` currently allows `unsafe-inline`/`unsafe-eval` for Next hydration — nonce migration is a known improvement.)
- All user-supplied strings are length-capped by zod; output is rendered as text, never HTML.

## NoSQL injection

- Every write body passes zod schemas that **strip unknown keys** — user JSON can never introduce `$` operators into documents.
- Query building uses explicit whitelists: sort fields, filter enums, ObjectId validation (`isValidObjectId`) before casts.
- Free-text search input is regex-**escaped** (`replace(/[.*+?^${}()|[\]\\]/g, ...)`) and length-capped, preventing both operator injection and ReDoS.

## Rate limiting & abuse prevention

`lib/rate-limit.ts` — Upstash sliding windows when configured (durable across serverless instances), in-memory fixed windows otherwise: `auth` 10/min, `mutate` 60/min, `read` 240/min, `heavy` 5/5min, plus a **global 400/min/IP** backstop in the middleware. Request bodies are size-capped at the edge (1 MB; 8 MB import). Scraping is blunted by mandatory authentication on all data endpoints + pagination caps (`limit ≤ 50–100`, `page ≤ 10000`).

## Brute-force protection

DB-backed rolling lockout (`failed_attempts`): 5 failures / 15 minutes per **email** and per **IP** independently (`lib/security.ts`), surviving serverless cold starts; the legacy admin PIN has the same lockout on its own key. Successful login resets counters. Heartbeat deltas are capped by server-side elapsed time (anti-gaming of study stats).

## Secrets & environment

- All secrets come from environment variables, validated once by zod (`lib/env.ts`) with fail-fast messages. Nothing secret is hardcoded, logged, or returned in responses (WhatsApp raw responses are stored truncated and never include the token; audit logs mask phone numbers to the last 4 digits).
- `.env` / `.env.local` are git-ignored; `.env.local.example` documents every variable with placeholders. The repository history contains no secrets (verified by staged-content scans before the initial publish).
- `REMINDER_CRON_SECRET` comparisons use `crypto.timingSafeEqual`.

## Security headers

Set globally in `next.config.mjs`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (2y, preload), `Permissions-Policy` (camera/mic/geo off), full CSP (above), `poweredByHeader: false`.

## Audit logging

`audit_logs` (90-day TTL): every auth event (login, failures, blocked attempts), all admin actions with **prev/next values**, actor + target + IP + user-agent, impersonation start/stop, imports/exports/seeds, reminder runs. Browsable at `/admin/audit` with filters.

## OWASP Top-10 mapping (2021)

| Risk | Posture |
| --- | --- |
| A01 Broken access control | Guard helpers on every route; per-user scoping at query level; escalation rules tested live |
| A02 Cryptographic failures | bcrypt-12, HMAC-SHA256 tokens, HSTS; no custom crypto beyond HMAC cookies |
| A03 Injection | zod strip + whitelists + regex escaping (see NoSQL/XSS above) |
| A04 Insecure design | claim-first idempotency, deny-by-default middleware, soft deletes |
| A05 Security misconfiguration | headers + CSP + env validation; `poweredByHeader` off |
| A06 Vulnerable components | 2 moderate advisories in the Next-bundled postcss chain at last audit — fix is bumping Next patch (do **not** `npm audit fix --force`) |
| A07 Auth failures | lockouts, timing-hardened login, session revocation |
| A08 Integrity failures | GitHub Actions pinned to first-party `curl`; no third-party build steps |
| A09 Logging failures | structured audit trail w/ TTL; server-side error logging without client leakage |
| A10 SSRF | no user-supplied URL fetching server-side (outbound calls go only to Meta's fixed host) |

## Production checklist

- [ ] `AUTH_SECRET` ≥ 32 bytes, unique per environment
- [ ] `SUPER_ADMIN_EMAILS` set **before** first registration
- [ ] Upstash configured (durable rate limits across instances)
- [ ] Atlas network access restricted; DB user least-privilege
- [ ] Vercel env vars set (see [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)); nothing in git
- [ ] GitHub secrets `REMINDER_APP_URL` / `REMINDER_CRON_SECRET` set
- [ ] Next.js on latest 15.x patch (`npm audit` clean of the postcss advisory)
- [ ] HTTPS only (HSTS preload implies commitment)
- [ ] Review `/admin/audit` and Action logs periodically

## Known gaps (tracked honestly)

- CSP still allows `unsafe-inline`/`unsafe-eval` scripts (Next hydration); nonce-based CSP is future work.
- No CAPTCHA on register/login (rate limits + lockouts are the current control).
- No automated security test suite; posture verified by scripted manual testing (see [docs/TESTING.md](docs/TESTING.md)).
- Phone numbers stored in plaintext in `reminder_settings` (standard for messaging apps; field-level encryption would require KMS infrastructure not present today).
