# DSAspire — World-Class DSA Platform Blueprint

> Production-ready specification to rebuild **[dsaspire.vercel.app](https://dsaspire.vercel.app)** into a top-tier DSA learning + interview-prep platform that ranks on Google **and** gets cited by ChatGPT, Claude, Gemini & Perplexity.
>
> Stack (unchanged, respected throughout): **Next.js 15 App Router · React 19 · TypeScript (strict) · MongoDB + Mongoose 8 · Auth.js v5 · Tailwind 3 · Radix UI · SWR · Zod · Upstash · Vercel.**

---

## 0. The one insight that changes everything

Today DSAspire is a **single-plane, fully auth-gated private tracker**. `middleware.ts` gates every route, every page is a `"use client"` component that fetches JSON after hydration, and there is **no `sitemap.ts`, no `robots.ts`, no `manifest.ts`, and near-zero metadata**. Result: Googlebot and AI crawlers see a login wall and an empty HTML shell. **The product cannot be discovered or cited.**

Every competitor you listed that wins organic + AI traffic — LeetCode, NeetCode, GeeksforGeeks, takeuforward, InterviewBit, CP-Algorithms, CSES — does so because they run a **large public, server-rendered content plane** that is crawlable, schema-marked, and answer-shaped.

**The rebuild's central move: split DSAspire into two planes.**

| Plane | Audience | Rendering | Auth | Purpose |
|---|---|---|---|---|
| **Public Content Plane** (`(marketing)` + `(content)`) | Search engines, AI crawlers, logged-out learners | **Server Components + SSG/ISR** | None (public) | Discovery, ranking, AI citation, top-of-funnel |
| **Private App Plane** (`(app)`) | Logged-in users | Client + Server, dynamic | Auth.js gate | Tracking, dashboards, AI tools, the existing product |

The existing 15,267-problem catalog, 17 topics, 163 patterns, and curated sheets are a **content goldmine** currently hidden behind auth. Exposing a *public, indexable projection* of that data (problem pages, topic guides, pattern explainers, company pages, roadmaps) is the single highest-ROI change in this entire blueprint.

---

## 1. How to read this blueprint

Fifteen focused documents. Each is implementation-ready — real code in your conventions, every page/route/model/component enumerated. Read in order for a rebuild; jump by topic for a feature.

| # | Document | Covers (from your 70-point list) |
|---|---|---|
| — | **[README.md](./README.md)** (this file) | Strategy, gap analysis, coverage matrix, roadmap summary |
| 01 | **[01-competitive-analysis.md](./01-competitive-analysis.md)** | Distilled playbook from all 22 reference sites |
| 02 | **[02-architecture-ia.md](./02-architecture-ia.md)** | 1 Architecture · 3 App Router · 26 Dynamic routes · IA · rendering strategy |
| 03 | **[03-folder-structure.md](./03-folder-structure.md)** | 2 Folder structure |
| 04 | **[04-data-model.md](./04-data-model.md)** | 47 Database schema · every Mongoose model |
| 05 | **[05-api-routes.md](./05-api-routes.md)** | 48 API routes · every endpoint |
| 06 | **[06-components-ux.md](./06-components-ux.md)** | 4 Component hierarchy · 5 UI/UX · 6 Responsive · 7 A11y · 58 Dark mode · 66 Semantic HTML |
| 07 | **[07-seo.md](./07-seo.md)** | 8 SEO · 11 Metadata · 12 Robots · 13 Sitemap · 14 Canonical · 15 OG · 16 Twitter · 69 Technical SEO |
| 08 | **[08-schema-jsonld.md](./08-schema-jsonld.md)** | 10 JSON-LD · 17 Breadcrumb · 18 FAQ · 19 Organization · 20 Course · 21 SearchAction · 67 Rich snippets |
| 09 | **[09-geo.md](./09-geo.md)** | 9 GEO (ChatGPT/Gemini/Claude/Perplexity) · 68 AI-search content · 65 EEAT |
| 10 | **[10-content-strategy.md](./10-content-strategy.md)** | 22 Blog · 23 Topic clusters · 24 Programmatic SEO · 25 Internal linking · 63 Content strategy · 64 Keyword clustering |
| 11 | **[11-features.md](./11-features.md)** | 27–46, 49, 50, 59–61 — every product feature & AI tool |
| 12 | **[12-performance-pwa.md](./12-performance-pwa.md)** | 51–55 Performance/CWV/Lighthouse · 52 Lazy · 53 Images · 57 PWA · 62 Analytics |
| 13 | **[13-deployment.md](./13-deployment.md)** | 70 Deployment · env · CI/CD · monitoring |
| 14 | **[14-roadmap.md](./14-roadmap.md)** | Phased execution plan, effort, sequencing, KPIs |

### 70-point coverage matrix

<details><summary>Click to expand — every requested item mapped to its doc</summary>

1 Architecture → 02 · 2 Folder structure → 03 · 3 App Router → 02/03 · 4 Component hierarchy → 06 · 5 UI/UX → 06 · 6 Responsive → 06 · 7 Accessibility → 06 · 8 SEO → 07 · 9 GEO → 09 · 10 JSON-LD → 08 · 11 Metadata → 07 · 12 Robots.txt → 07 · 13 Sitemap.xml → 07 · 14 Canonical → 07 · 15 Open Graph → 07 · 16 Twitter Cards → 07 · 17 Breadcrumb schema → 08 · 18 FAQ schema → 08 · 19 Organization schema → 08 · 20 Course schema → 08 · 21 SearchAction schema → 08 · 22 Blog architecture → 10 · 23 Topic clusters → 10 · 24 Programmatic SEO → 10 · 25 Internal linking → 10 · 26 Dynamic routes → 02 · 27 Company interview pages → 02/10/11 · 28 DSA roadmap pages → 02/11 · 29 Problem pages → 02/11 · 30 Contest pages → 11 · 31 Learning paths → 11 · 32 Dashboard → 11 · 33 Progress tracking → 11 · 34 Notes system → 11 · 35 Revision scheduler → 11 · 36 Mock interviews → 11 · 37 AI doubt solving → 11 · 38 AI roadmap generator → 11 · 39 AI code review → 11 · 40 AI hints → 11 · 41 AI explanation → 11 · 42 User profiles → 11 · 43 Leaderboards → 11 · 44 Achievements → 11 · 45 Streak system → 11 · 46 Authentication → 11/04 · 47 Database schema → 04 · 48 API routes → 05 · 49 Admin panel → 11 · 50 CMS → 11/10 · 51 Performance → 12 · 52 Lazy loading → 12 · 53 Image optimization → 12 · 54 Core Web Vitals → 12 · 55 Lighthouse >95 → 12 · 56 Mobile-first → 06/12 · 57 PWA → 12 · 58 Dark mode → 06 · 59 Search → 11 · 60 Advanced filtering → 11 · 61 Recommendation engine → 11 · 62 Analytics → 12 · 63 Content strategy → 10 · 64 Keyword clustering → 10 · 65 EEAT → 09/10 · 66 Semantic HTML → 06 · 67 Rich snippets → 08 · 68 AI-search content → 09 · 69 Technical SEO → 07 · 70 Deployment → 13

</details>

---

## 2. Current-state audit (what you have vs. what's missing)

### ✅ Strong foundations to keep
- **Data model**: `Question` (rich: topic/subtopic/pattern[]/companies[]/difficulty/complexity/links/learning-rank) + `UserProgress` (per-user isolation via `{userId, questionId}` unique index). No-delete/`archived` discipline. Excellent full-text + compound indexes.
- **Catalog**: 15,267 problems, 17 topics, 163 patterns, curated sheets (Blind 75, Striver A2Z…), live-fetch pipeline in `dsa-question-db/`.
- **Security**: middleware auth gate, Upstash rate-limit, CSP + security headers, Zod on every write, roles (`user`/`admin`/`superadmin`), impersonation, 90-day audit trail.
- **Learning engine**: Foundation→Expert progressive unlock, priority-scored queue, `learningScore`/`difficultyRank`.
- **Serverless-safe DB**: cached Mongoose connection with DoH SRV fallback.

### ❌ Gaps blocking "world-class"
| Gap | Impact | Fixed in |
|---|---|---|
| **No public content plane** — everything auth-gated | Zero organic/AI discovery | 02, 07, 10 |
| No `sitemap.ts` / `robots.ts` / `manifest.ts` | Not crawlable, not installable | 07, 12 |
| Metadata is 2 lines; no OG/Twitter/canonical/`metadataBase` | No rich previews, weak ranking | 07 |
| Zero structured data (JSON-LD) | No rich snippets, poor AI parsing | 08 |
| Detail pages are `"use client"` + `useParams` (CSR) | Empty HTML for crawlers | 02, 06 |
| No editorial/solution content, no blog | Nothing to rank or cite | 10 |
| No AI tooling (doubt-solve, hints, review, roadmap) | Behind NeetCode/AlgoMonster | 11 |
| No mock interviews, contests, leaderboards, achievements | Weak engagement/retention loop | 11 |
| No PWA, no analytics/RUM, no CWV budget | Misses install + measurability | 12 |
| No public user profiles | No shareable proof-of-work (a GEO/EEAT signal) | 11, 09 |

---

## 3. Target architecture at a glance

```
dsaspire.com
├── PUBLIC CONTENT PLANE  (SSG/ISR, indexable, schema-rich, AI-citeable)
│   ├── /                              marketing home
│   ├── /problems  /problems/[slug]    15k programmatic problem pages
│   ├── /topics    /topics/[topic]     17 pillar hubs + subtopic clusters
│   ├── /patterns  /patterns/[slug]    163 pattern explainers
│   ├── /companies /companies/[slug]   company interview hubs
│   ├── /roadmaps  /roadmaps/[slug]    visual learning roadmaps
│   ├── /sheets    /sheets/[slug]      Blind 75, Striver A2Z, DP…
│   ├── /learn/[track]/[module]        long-form course/guide content
│   ├── /blog      /blog/[slug]        editorial + programmatic articles
│   ├── /interview-questions/[topic]   answer-shaped Q&A (GEO)
│   └── /compare/[a]-vs-[b]            comparison pages
│
└── PRIVATE APP PLANE  (Auth.js gate, dynamic, the product)
    ├── /dashboard      progress, streaks, recommendations
    ├── /practice       solve workspace (editor + AI tools)
    ├── /revision       spaced-repetition scheduler
    ├── /mock           AI mock interviews
    ├── /profile/[user] public profile (indexable projection)
    ├── /leaderboard    global + company + weekly
    ├── /settings  /admin  /studio (CMS)
    └── /api/*      REST + AI streaming endpoints
```

Full route table, rendering strategy per route, and route-group layout tree → **[02-architecture-ia.md](./02-architecture-ia.md)**.

---

## 4. Roadmap summary (detail in [14-roadmap.md](./14-roadmap.md))

| Phase | Weeks | Theme | Headline outcomes |
|---|---|---|---|
| **P0** | 1–2 | SEO foundation | `metadataBase`, metadata factory, `sitemap.ts`, `robots.ts`, `manifest.ts`, Organization/Website JSON-LD, canonical. *Ship even before new pages.* |
| **P1** | 3–6 | Public content plane | Server-render problem/topic/pattern/company pages via public read API; programmatic SEO; breadcrumb + course + FAQ schema; internal linking graph. |
| **P2** | 7–10 | Engagement & AI | AI doubt-solve/hints/explain/review (streaming), mock interviews, revision v2, leaderboards, achievements, streaks, public profiles. |
| **P3** | 11–14 | Content & GEO | Blog + MDX CMS/studio, topic clusters, `llms.txt`, answer-shaped Q&A, comparison pages, EEAT author system. |
| **P4** | 15–16 | Performance & polish | PWA, CWV budget, Lighthouse ≥95, RUM analytics, image pipeline, A/B, launch. |

**North-star KPIs:** indexable URLs (target 30k+), organic clicks, AI-referral sessions (utm from chatgpt.com/perplexity.ai/gemini), Core Web Vitals pass rate ≥90%, D7 retention, problems-solved/user.

---

## 5. Non-negotiable principles carried into every doc

1. **Respect the codebase** — Mongoose (not Prisma), Auth.js v5, SWR, Radix, the no-delete/`archived` rule, `models.X || model(...)` pattern, cached `connectDB()`.
2. **Server-first for anything public** — RSC + `generateStaticParams` + `generateMetadata` + ISR. `"use client"` only at interaction leaves.
3. **One source of truth for taxonomy** — `src/lib/constants.ts` topics + `src/lib/patterns.ts` already drive the app; the public plane derives from the same.
4. **Every public page ships**: unique title/description, canonical, OG/Twitter, ≥1 JSON-LD block, breadcrumbs, and ≥3 contextual internal links.
5. **Accessibility & performance are acceptance criteria, not phases** — every component spec states its a11y contract and its render cost.

➡ Continue to **[01-competitive-analysis.md](./01-competitive-analysis.md)**.
