# 13 · Deployment & Operations

Covers **#70 deployment strategy** + env, CI/CD, config, monitoring, security, launch checklist. Target: **Vercel** (matches Next 15 + your existing setup).

---

## 1. Environments

| Env | Branch | URL | DB | Purpose |
|---|---|---|---|---|
| Production | `main` | `dsaspire.com` | Atlas `prod` cluster | Live |
| Preview | every PR | `*.vercel.app` | Atlas `preview` (or prod read-only + isolated writes) | Review each PR |
| Local | — | `localhost:3000` | `mongodb-memory-server` (`npm run db:mem`) or Atlas `dev` | Dev (you already support in-memory) |

- **Custom domain**: move off `dsaspire.vercel.app` → `dsaspire.com`. Set apex + `www` in Vercel; 301 `www→apex` (or vice-versa, pick one — doc 07). Set `NEXT_PUBLIC_SITE_URL=https://dsaspire.com`. Vercel handles TLS.
- **Preview safety**: preview deployments get `robots: noindex` (env flag `NEXT_PUBLIC_NOINDEX=1` → factory forces noindex) so staging never gets indexed.

## 2. Environment variables (`.env.example`)

```bash
# --- Core ---
NEXT_PUBLIC_SITE_URL=https://dsaspire.com
NEXT_PUBLIC_NOINDEX=0                       # 1 on preview/staging
MONGODB_URI=mongodb+srv://user:pass@cluster/db
MONGODB_DB=dsaspire
# MONGODB_DNS=8.8.8.8,1.1.1.1               # only if SRV DNS blocked locally (you support this)

# --- Auth.js v5 ---
AUTH_SECRET=                                # openssl rand -base64 33
AUTH_URL=https://dsaspire.com
AUTH_GITHUB_ID=       AUTH_GITHUB_SECRET=   # new OAuth (doc 11)
AUTH_GOOGLE_ID=       AUTH_GOOGLE_SECRET=

# --- Rate limit / cache (Upstash, already used) ---
UPSTASH_REDIS_REST_URL=      UPSTASH_REDIS_REST_TOKEN=

# --- AI (doc 11) ---
AI_API_KEY=                                 # LLM provider key (server-only)
AI_MODEL=                                   # default model id
AI_DAILY_TOKEN_LIMIT=200000                 # per-user quota guard

# --- Content / media ---
BLOB_READ_WRITE_TOKEN=                      # Vercel Blob (CMS uploads)

# --- Comms (existing + new) ---
WHATSAPP_TOKEN=  WHATSAPP_PHONE_ID=  WHATSAPP_TEMPLATE=   # existing reminders
RESEND_API_KEY=                             # transactional email (verify/reset)

# --- Ops ---
REVALIDATE_SECRET=                          # guards POST /api/revalidate
CRON_SECRET=                                # guards cron endpoints
SENTRY_DSN=          NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_ANALYTICS_ID=

# --- Billing (if Pro) ---
STRIPE_SECRET_KEY=  STRIPE_WEBHOOK_SECRET=  NEXT_PUBLIC_STRIPE_PRICE_PRO=
```
Secrets live in Vercel Project → Settings → Environment Variables (scoped per env). Never commit `.env.local`.

## 3. `next.config.mjs` (extend existing)

```js
import createMDX from "@next/mdx";
const withMDX = createMDX({ options: { remarkPlugins: [/* gfm, reading-time, entity-autolink */],
                                       rehypePlugins: [/* slug, autolink-headings, shiki */] } });
/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },        // company logos
    ],
  },
  async redirects() {
    return [
      // legacy → new taxonomy (also handled dynamically via slug_redirects)
      { source: "/algorithm-patterns/:slug", destination: "/patterns/:slug", permanent: true },
      { source: "/sheets/:key", destination: "/sheets/:key", permanent: false }, // if key→slug changes
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];       // keep your CSP + security headers
  },
  experimental: { /* ppr: true (when stable), optimizePackageImports: ["lucide-react", "recharts"] */ },
};
export default withMDX(nextConfig);
```
Keep your existing **CSP + security headers** (`lib/security.ts`); extend CSP to allow the AI stream endpoint, analytics, Blob, and `img-src` for logos/avatars. Test CSP in report-only first.

## 4. `middleware.ts` (invert the default — doc 02)

```ts
// Public-first: gate ONLY (app) routes; everything else open to crawlers.
const APP_PREFIXES = ["/dashboard","/practice","/revision","/mock","/notes","/playlists",
  "/onboarding","/settings","/admin","/studio"];
export async function middleware(req) {
  // 1) slug_redirects 301 (public) — cheap lookup / edge cache
  // 2) if path in APP_PREFIXES and no session → redirect /signin?next=…
  // 3) security headers (existing)
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon|.*\\.(?:png|svg|xml|txt|webmanifest)).*)"] };
```

## 5. CI/CD (GitHub Actions + Vercel)

- **Vercel Git integration**: push → preview; merge to `main` → production. Zero-config builds.
- **PR checks** (`.github/workflows/ci.yml`): `typecheck` (`tsc --noEmit`), `lint`, unit tests (Vitest), build, **Lighthouse-CI** budgets (doc 12), **axe** a11y smoke, and a **schema validation** smoke (fetch sample templates, assert valid JSON-LD).
- **Content publish → ISR**: `/studio` publish calls `POST /api/revalidate` (secret) → `revalidateTag('content')` + affected paths; sitemap reflects on next crawl.
- **Existing cron** (WhatsApp reminders via GitHub Actions) stays; add Vercel Cron for: sitemap warmup, leaderboard recompute, SRS due-digest, achievement backfills, search-index rebuild. Guard cron endpoints with `CRON_SECRET`.
- **Data migrations/backfills** (`scripts/*.mjs`): run as one-off Actions jobs (backfill-slugs, build-search-index) — idempotent, no-delete.

## 6. Database ops

- **Atlas**: dedicated cluster (M10+ for prod), automated backups + point-in-time recovery, alerts on connections/CPU. Keep `maxPoolSize:10` (serverless-safe, already set).
- **Indexes**: ensure all doc-04 indexes built (`Question.slug` unique, SRS `dueAt`, etc.). Build in background; verify with Atlas Performance Advisor.
- **Migrations**: additive only (no-delete rule); every change is a script + a documented run. Keep a `migrations/` log.
- **Scaling**: add read replicas + read-preference for public reads if traffic grows; consider Atlas Search for the `search_index`.

## 7. Monitoring & alerting

- **Uptime**: external monitor hitting `/api/health` (DB ping) + `/` every minute.
- **Errors**: Sentry (client/server/edge), alert on error-rate spikes + AI-route failures.
- **Performance**: Vercel Speed Insights (field CWV), Analytics; weekly CWV-by-route review.
- **SEO**: Search Console coverage/enhancement alerts; scheduled crawl (`scripts/check-orphans.mjs`) for orphans/dead links.
- **Cost**: watch AI token spend (per-user quota + global cap `AI_DAILY_TOKEN_LIMIT`), Vercel function usage, Atlas ops.
- **Logs**: structured logs on API routes; scrub PII; retain per policy (you already keep 90-day audit trail).

## 8. Security (keep + extend)

- Existing: middleware gate, Upstash rate-limit, CSP + headers, Zod on writes, same-origin write check, request-size caps, roles, impersonation audit, 90-day audit trail. **Keep all.**
- Add: OAuth secrets rotation, email-verification, AI prompt-injection guards (server-built prompts, output filtering, never execute model-returned code server-side), CMS role checks, webhook signature verification (Stripe/Resend), Dependabot.

## 9. Go-live checklist

- [ ] `NEXT_PUBLIC_SITE_URL` = prod domain; `metadataBase` correct; preview `noindex`.
- [ ] `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `llms.txt` live and valid.
- [ ] Submit sitemap to GSC + Bing; verify property; request indexing on pillars.
- [ ] Rich Results Test passes on each template; OG/Twitter validators pass.
- [ ] Lighthouse ≥95 (mobile) on home/problem/topic/blog; CWV green in field.
- [ ] Auth (credentials + OAuth), email verify/reset working; sessions secure.
- [ ] AI routes quota'd + streaming; error fallbacks; Sentry receiving.
- [ ] `slug_redirects` + `next.config` redirects cover all legacy URLs (no 404 regressions).
- [ ] Backups + uptime + error alerts configured; health check green.
- [ ] Analytics + AI-referral tracking firing.

➡ Continue to **[14-roadmap.md](./14-roadmap.md)**.
