# 02 · Architecture & Information Architecture

Covers: **#1 website architecture · #3 App Router structure · #26 dynamic routes · #27–31 page types · rendering strategy · IA.**

---

## 1. System architecture

```
                         ┌──────────────────────────────────────────┐
   Search / AI crawlers  │   Vercel Edge (middleware.ts)             │
   Logged-out users  ───▶│   • public routes bypass auth gate        │
                         │   • auth gate ONLY for (app) group        │
   Logged-in users   ───▶│   • rate-limit, CSP, security headers     │
                         └───────────────┬──────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                 ▼
┌───────────────┐              ┌───────────────────┐            ┌────────────────────┐
│ Content Plane │              │    App Plane      │            │     API Layer      │
│ RSC · SSG/ISR │              │ RSC + Client · SSR│            │ Route Handlers     │
│ public reads  │              │ auth-gated        │            │ REST + AI stream   │
└──────┬────────┘              └─────────┬─────────┘            └─────────┬──────────┘
       │  read-only projection           │  read+write                    │
       └─────────────────┬───────────────┴────────────────┬──────────────┘
                         ▼                                ▼
              ┌────────────────────┐          ┌────────────────────────┐
              │  MongoDB (Mongoose)│          │  External services      │
              │  questions (shared)│          │  • Upstash (rate/cache) │
              │  user_progress     │          │  • Auth.js providers    │
              │  content, users …  │          │  • LLM API (AI tools)   │
              └────────────────────┘          │  • Meta WhatsApp Cloud   │
                                              │  • Resend (email)        │
                                              └────────────────────────┘
```

**Key architectural decisions**

1. **Route groups split the two planes** so `middleware.ts` can gate `(app)` while leaving `(content)`/`(marketing)` fully public and cacheable. Today the middleware gates everything — the rebuild inverts the default to *public-unless-in-`(app)`*.
2. **Public reads never touch `UserProgress`.** Content pages render from the shared `Question` catalog + a new `Content` collection only → fully static/ISR, no per-user data, no auth.
3. **Personalization is layered on the client** for public pages: the server renders the canonical, cacheable HTML; a small client component hydrates "solved/favorite" badges from `/api/me/progress` *after* load. Crawlers get complete content; users get personalization. (Pattern: **static shell + client overlay**.)
4. **One Mongoose connection** (`connectDB()`, already cached with DoH fallback) shared by RSC data-access and route handlers via a thin `src/server/` data-access layer (doc 05).

---

## 2. Route groups (App Router)

```
src/app/
├── (marketing)/         # public, SSG — home, pricing, about, legal
├── (content)/           # public, SSG/ISR — the SEO/GEO engine
├── (app)/               # auth-gated — the product (dashboard, practice, …)
├── (auth)/              # signin/signup/reset (public, noindex)
├── api/                 # route handlers (REST + AI streaming + webhooks)
├── studio/              # CMS (admin-gated) for MDX content
├── sitemap.ts           # ⬅ NEW (doc 07)  · may split into sitemap/[id]
├── robots.ts            # ⬅ NEW (doc 07)
├── manifest.ts          # ⬅ NEW (doc 12)
├── opengraph-image.tsx  # ⬅ NEW default OG (doc 07)
├── layout.tsx           # root: fonts, providers, <html lang>, JSON-LD org/website
├── error.tsx  not-found.tsx  loading.tsx   # already present
```

Each group owns a `layout.tsx`:
- `(marketing)`/`(content)` → **PublicHeader** (mega-menu, search, "Sign in") + **PublicFooter** (fat footer = sitewide internal-link hub) + breadcrumb slot. No auth calls → stays static.
- `(app)` → the existing **AppShell** (sidebar nav from `src/lib/nav.ts`) + auth session provider.
- `(auth)` → minimal centered card, `robots: noindex`.

---

## 3. Complete route table

**Legend — Render:** `SSG` static at build · `ISR n` incremental revalidate every _n_ s · `SSR` dynamic per request · `CSR` client-rendered island · `Stream` streamed (AI). **Auth:** 🌐 public · 🔒 user · 🛡 admin.

### `(marketing)` — public, SSG
| Route | Render | Auth | Purpose | Schema |
|---|---|---|---|---|
| `/` | SSG | 🌐 | Marketing home, hero, funnel entry | Organization, WebSite+SearchAction |
| `/about` | SSG | 🌐 | EEAT: team, mission, methodology | AboutPage, Organization |
| `/authors/[slug]` | SSG | 🌐 | Author bios (EEAT byline target) | ProfilePage, Person |
| `/pricing` | SSG | 🌐 | Free vs Pro | Product/Offer |
| `/changelog` | ISR 3600 | 🌐 | Release notes (freshness signal) | — |
| `/legal/[doc]` | SSG | 🌐 | privacy, terms, cookies | — |

### `(content)` — public SEO/GEO engine (the new core)
| Route | Render | Auth | Count | Purpose | Primary schema |
|---|---|---|---|---|---|
| `/problems` | ISR 3600 | 🌐 | 1 | Filterable problem index (paginated, faceted) | CollectionPage, BreadcrumbList |
| `/problems/[slug]` | ISR 86400 | 🌐 | ~15k | Public problem page: statement, constraints, examples, patterns, companies, complexity, editorial link, related | **TechArticle** + Breadcrumb + FAQ |
| `/topics` | SSG | 🌐 | 1 | All 17 topic pillars | CollectionPage |
| `/topics/[topic]` | ISR 86400 | 🌐 | 17 | **Pillar hub**: definition, subtopics, patterns, roadmap, top problems, FAQ | **Course** + Breadcrumb + FAQ |
| `/topics/[topic]/[subtopic]` | ISR 86400 | 🌐 | ~120 | Cluster spoke pages | Article + Breadcrumb |
| `/patterns` | SSG | 🌐 | 1 | All 163 patterns, grouped | CollectionPage |
| `/patterns/[slug]` | ISR 86400 | 🌐 | 163 | Pattern explainer: when-to-use, template code, complexity, problems, decision flowchart | **TechArticle/HowTo** + FAQ |
| `/algorithms` | SSG | 🌐 | 1 | CP-grade reference index | CollectionPage |
| `/algorithms/[slug]` | ISR 86400 | 🌐 | ~120 | **GEO moat**: definition→intuition→proof→complexity→reference impl (multi-language) | **TechArticle** + Breadcrumb |
| `/companies` | SSG | 🌐 | 1 | Company directory | CollectionPage |
| `/companies/[slug]` | ISR 86400 | 🌐 | ~150 | Company interview hub: tagged problems, patterns, rounds, prep plan, experiences | **Course/ItemList** + FAQ + Breadcrumb |
| `/companies/[slug]/[topic]` | ISR 86400 | 🌐 | ~2k | "Google Dynamic Programming questions" long-tail | ItemList + FAQ |
| `/roadmaps` | SSG | 🌐 | 1 | Roadmap gallery | CollectionPage |
| `/roadmaps/[slug]` | ISR 86400 | 🌐 | ~12 | Interactive DAG (DSA, SDE, FAANG, CP, DP-mastery…) | **Course** + Breadcrumb |
| `/sheets` | SSG | 🌐 | 1 | Curated ladder gallery | CollectionPage |
| `/sheets/[slug]` | ISR 86400 | 🌐 | ~10 | Blind 75, Striver A2Z, NeetCode-style, DP/Graph/Tree | **Course/ItemList** + Breadcrumb |
| `/learn` | SSG | 🌐 | 1 | Course catalog | CollectionPage |
| `/learn/[track]` | ISR 86400 | 🌐 | ~8 | Track overview (modules) | **Course** |
| `/learn/[track]/[module]` | ISR 86400 | 🌐 | ~120 | Long-form MDX lesson w/ runnable snippets | **LearningResource**/Article |
| `/interview-questions` | SSG | 🌐 | 1 | Q&A hub | CollectionPage |
| `/interview-questions/[slug]` | ISR 86400 | 🌐 | ~300 | Answer-shaped Q&A ("Top 50 Array interview questions") | **QAPage/FAQPage** |
| `/blog` | ISR 600 | 🌐 | 1 | Blog index (paginated, tag facets) | Blog |
| `/blog/[slug]` | ISR 3600 | 🌐 | ∞ | Editorial + programmatic articles (MDX) | **BlogPosting/Article** + Breadcrumb + FAQ |
| `/blog/tag/[tag]` | ISR 3600 | 🌐 | ~40 | Tag clusters | CollectionPage |
| `/compare/[slug]` | ISR 86400 | 🌐 | ~50 | "BFS vs DFS", "Array vs Linked List" comparison | Article + FAQ |
| `/glossary` `/glossary/[term]` | ISR | 🌐 | ~200 | Definitions (GEO + internal-link hub) | DefinedTermSet/DefinedTerm |

### `(app)` — auth-gated product
| Route | Render | Auth | Purpose |
|---|---|---|---|
| `/dashboard` | SSR | 🔒 | Progress, streak, recommendations, continue-learning queue |
| `/practice` | SSR | 🔒 | Solve workspace list / entry |
| `/practice/[slug]` | SSR | 🔒 | Solve UI: editor, run, AI tools, notes, timer (private twin of `/problems/[slug]`) |
| `/revision` | SSR | 🔒 | Spaced-repetition scheduler (due today, forecast) |
| `/mock` `/mock/[id]` | SSR/Stream | 🔒 | AI mock-interview lobby + live session |
| `/playlists` `/playlists/[id]` | SSR | 🔒 | User-built problem lists |
| `/notes` | SSR | 🔒 | All personal notes, searchable |
| `/leaderboard` | ISR 300 | 🌐/🔒 | Global/weekly/company (public read, personalized rank) |
| `/u/[username]` | ISR 3600 | 🌐 | **Public profile** (proof-of-work; indexable) → ProfilePage/Person |
| `/settings/*` | SSR | 🔒 | Account, preferences, reminders, integrations, billing |
| `/onboarding` | SSR | 🔒 | Goal → generated roadmap |
| `/admin/*` | SSR | 🛡 | Existing admin console (users, audit, reminders) |
| `/studio/*` | SSR | 🛡 | CMS for MDX/editorial content |

### `(auth)` — public, noindex
`/signin` · `/signup` · `/forgot-password` · `/reset-password/[token]` · `/verify-email/[token]`

---

## 4. Rendering strategy (decision rules)

| Data shape | Strategy | Why |
|---|---|---|
| Pure catalog, changes rarely (problems, algorithms, patterns, topics) | **SSG / ISR 86400** + `generateStaticParams` (top N) with on-demand fallback (`dynamicParams: true`) | Crawlable, instant, cheap. Pre-render the ~2k highest-value slugs; generate the long tail on first hit then cache. |
| Catalog that updates (blog, changelog, leaderboard) | **ISR** with short revalidate + **on-demand `revalidatePath`** from `/studio` on publish | Fresh without rebuilds |
| Per-user (dashboard, revision, practice state) | **SSR** (`export const dynamic = 'force-dynamic'`) reading session | Correct per request |
| Personalization overlay on static pages | **Client island** hits `/api/me/*` post-load | Keep shell static & indexable |
| AI tools (hints, review, mock, doubt) | **Streaming route handlers** (`ReadableStream`) | Token-by-token UX |

**generateStaticParams budget:** don't build 15k pages at deploy time (slow builds, Vercel limits). Pre-build the **top ~2,000** by traffic/importance (`learningScore`, curated sheets, company-tagged); serve the rest via ISR fallback. Track which slugs exist for `sitemap.ts` from the DB, not from the build.

---

## 5. Information architecture & navigation

**Global public nav (mega-menu):**
- **Learn** → Roadmaps · Topics · Patterns · Algorithms · Courses
- **Practice** → Problems · Sheets · Companies · Contests
- **Interview** → Company hubs · Interview questions · Mock interviews · System design (future)
- **Blog** · **Pricing** · **Sign in / Dashboard**
- Persistent **⌘K search** (SearchAction-backed) in header.

**Breadcrumb spine (drives BreadcrumbList schema everywhere):**
`Home › Topics › Dynamic Programming › Subsequences › Longest Common Subsequence`
`Home › Companies › Google › Dynamic Programming`
`Home › Patterns › Sliding Window`

**Fat footer (sitewide internal-link equity distributor):** columns for Top Topics, Popular Patterns, Top Companies, Sheets, Roadmaps, Algorithms, Blog categories, Company/Legal. Every public page inherits it → every entity is ≤2 clicks from home (flat crawl depth = strong SEO).

**URL conventions (stable, canonical, lowercase-kebab):**
- Problems: `/problems/two-sum` (slug from title via existing `slugify`)
- Topics: `/topics/dynamic-programming`; subtopic `/topics/dynamic-programming/knapsack`
- Patterns: `/patterns/sliding-window`
- Companies: `/companies/google`; cross `/companies/google/dynamic-programming`
- Never expose Mongo `_id` in public URLs; keep a unique `slug` field (doc 04) with a redirect map for renames (no-delete discipline → old slugs 301 to new).

---

## 6. Cross-plane data flow (public ↔ private twins)

Many entities have a **public twin** (`/problems/[slug]`, indexable) and a **private twin** (`/practice/[slug]`, the workspace). They share one server data-access function `getProblemBySlug(slug)`; the public page omits user fields, the private page joins `UserProgress`. CTA on the public page: "Solve this →" deep-links to `/practice/[slug]` (auth-gated). This is exactly LeetCode's public-problem → sign-in-to-submit funnel, and it means **your best SEO pages are also your best conversion pages**.

➡ Continue to **[03-folder-structure.md](./03-folder-structure.md)**.
