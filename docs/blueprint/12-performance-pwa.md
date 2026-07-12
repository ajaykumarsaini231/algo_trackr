# 12 · Performance, Core Web Vitals, PWA, Analytics

Covers **#51 performance · #52 lazy loading · #53 image optimization · #54 CWV · #55 Lighthouse ≥95 · #57 PWA · #62 analytics.**

---

## 1. Performance budget (enforced, not aspirational)

| Metric | Target | Notes |
|---|---|---|
| **LCP** | < 2.0s (good ≤2.5s) | Server-render + priority hero image/text; no client fetch for above-fold |
| **INP** | < 200ms | Minimal client JS; RSC by default; break up long tasks |
| **CLS** | < 0.05 | width/height on all media; reserved space for ads/embeds; `next/font` (done) |
| **TTFB** | < 0.5s | ISR/edge cache for public; cached Mongoose for dynamic |
| **JS shipped (route)** | < 130KB gzip | Budget per route; audit with `@next/bundle-analyzer` |
| **Lighthouse (mobile)** | ≥95 Perf / ≥95 SEO / ≥95 A11y / ≥95 BP | CI gate on key templates |

**Route JS budget in CI:** fail the build if a public route's first-load JS exceeds budget (`next build` output + a check script).

## 2. Rendering & data (biggest wins, mostly from doc 02)

- **RSC + SSG/ISR for all public pages** → HTML arrives complete; near-zero client JS. This alone fixes the current CSR-shell LCP/SEO problem.
- **Streaming + Suspense** — wrap below-fold/expensive sections (related problems, comments) in `<Suspense>` so the shell paints instantly.
- **`unstable_cache` + tags** on repositories (doc 05) → cheap TTFB; bust on publish.
- **Edge cache headers** on `api/public/*`; ISR pages served from Vercel's edge network.
- **Partial Prerendering (PPR)** — as it stabilizes in Next 15, wrap the personalization island in dynamic while keeping the static shell prerendered.

## 3. Lazy loading (#52)

- **Component-level**: `next/dynamic` for heavy, below-fold, or interaction-gated widgets — `RoadmapGraph`, code editor (Monaco), charts (recharts), whiteboard, AI panels, command palette. `ssr:false` only for truly client-only (editor/whiteboard).
```ts
const RoadmapGraph = dynamic(() => import("@/components/content/roadmap-graph"),
  { loading: () => <GraphSkeleton />, ssr: false });
```
- **Route-level**: App Router code-splits per route automatically; keep shared client bundles lean.
- **Media/iframes**: `loading="lazy"` for below-fold; defer YouTube embeds behind a facade (click-to-load thumbnail) — saves ~500KB+ per solution page.
- **Data**: paginate/virtualize long lists (`@tanstack/react-virtual`) — leaderboard, 15k problem index.

## 4. Image optimization (#53)

- **`next/image` everywhere** — automatic AVIF/WebP, responsive `srcset`, lazy by default, explicit `width`/`height` (no CLS). `priority` only on the LCP image.
- Configure `next.config` `images` (remote patterns for company logos/avatars/blob); serve modern formats; cap `deviceSizes`.
- **OG images** generated via `next/og` at the edge (doc 07) — cached, no runtime cost per share.
- **Icons**: lucide (SVG, tree-shaken) — no icon fonts. Logo/illustrations as inline SVG.
- Company logos & avatars → optimize + cache; fall back to `CompanyAvatar` (exists) initials.

## 5. Lighthouse ≥95 checklist (#55)

- Server-rendered content, `next/font` (done), preconnect only what's needed, no render-blocking third-party JS.
- Defer/async all non-critical scripts; analytics via `next/script strategy="afterInteractive"` or `worker`.
- Compress (Vercel gzip/br by default), long cache TTL on static assets (immutable hashed).
- No layout shift: reserve space for images, embeds, and the personalization overlay (skeleton same size).
- A11y (doc 06) + SEO (doc 07) already push those categories to ≥95.
- **CI**: Lighthouse-CI (`@lhci/cli`) on `/`, `/problems/[sample]`, `/topics/[sample]`, `/blog/[sample]` per PR; assert budgets.

## 6. PWA (#57)

**`src/app/manifest.ts`:**
```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DSAspire — Master DSA & Coding Interviews",
    short_name: "DSAspire",
    description: "15,000+ DSA problems, roadmaps, patterns, company prep and AI tutoring.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b12",
    theme_color: "#0b0b12",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Continue learning", url: "/dashboard" },
      { name: "Due revision", url: "/revision" },
      { name: "Random problem", url: "/problems/random" },
    ],
  };
}
```
- **Service worker**: use `@serwist/next` (or `next-pwa`) — precache the app shell + offline fallback page; runtime-cache public content (stale-while-revalidate) so problems/notes are readable offline. **Do not** cache authed API responses.
- **Installability**: manifest + SW + HTTPS + icons → install prompt; add an "Install app" CTA in settings.
- **Offline**: cache the user's due-revision list + saved problems for commute study (killer feature for the audience).
- Push notifications (Web Push) optional — complements existing WhatsApp reminders.

## 7. Analytics & RUM (#62)

- **Product analytics**: privacy-friendly (Plausible/PostHog/Umami) or Vercel Analytics — pageviews, funnels (visit→signup→solve), feature usage. Cookieless where possible (consent-light, GEO-privacy compliant).
- **Real User Monitoring**: `@vercel/speed-insights` + `web-vitals` → send LCP/INP/CLS to your analytics; dashboard field-CWV by route to catch regressions.
- **AI-referral tracking (doc 09)**: middleware tags sessions whose `referer` matches `chatgpt.com|perplexity.ai|gemini.google.com|claude.ai` → `utm_source=ai:<engine>`; report as a first-class channel.
- **Search Console + Bing Webmaster**: index coverage, queries, CTR, CWV report. Weekly export into a growth dashboard.
- **Error monitoring**: Sentry (client + server + edge) — track JS errors, API 5xx, AI failures.
- **Custom events**: `problem_solved`, `hint_used`, `mock_completed`, `streak_extended`, `revision_graded` → power recommendations + retention analysis.
- **Consent**: minimal, privacy-first banner (declines non-essential by default); no PII in URLs/analytics.

## 8. Backend performance

- **Indexes** already strong on `Question`/`UserProgress`; add the new compound indexes in doc 04. Verify with `explain()` on hot queries.
- **`.lean()`** for all read paths (you serialize already); project only needed fields for lists.
- **Aggregation caching**: company/topic counts + leaderboards cached (Upstash/`unstable_cache`), recomputed on interval, not per request.
- **Connection**: keep the cached serverless-safe Mongoose pool (`maxPoolSize:10`); consider read-preference for public reads if you add replicas.
- **Rate limiting**: Upstash (present) on writes + AI routes; per-user AI quotas.

➡ Continue to **[13-deployment.md](./13-deployment.md)**.
