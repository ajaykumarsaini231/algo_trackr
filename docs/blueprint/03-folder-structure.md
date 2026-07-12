# 03 · Folder Structure

Covers **#2 folder structure · #3 App Router**. Extends your *current* tree (kept intact) with the two-plane layout. `➕` = new · `✏️` = refactor existing · everything else already exists.

```
dsaspire/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── layout.tsx                 ➕ PublicHeader + PublicFooter
│   │   │   ├── page.tsx                   ➕ home (was /app/page.tsx dashboard → moves to (app))
│   │   │   ├── about/page.tsx             ➕
│   │   │   ├── authors/[slug]/page.tsx    ➕ EEAT author pages
│   │   │   ├── pricing/page.tsx           ➕
│   │   │   ├── changelog/page.tsx         ➕
│   │   │   └── legal/[doc]/page.tsx       ➕
│   │   │
│   │   ├── (content)/
│   │   │   ├── layout.tsx                 ➕ shared content chrome + breadcrumbs
│   │   │   ├── problems/
│   │   │   │   ├── page.tsx               ➕ faceted index
│   │   │   │   └── [slug]/page.tsx        ➕ public problem (RSC, generateMetadata)
│   │   │   ├── topics/
│   │   │   │   ├── page.tsx               ✏️ make RSC + metadata (was client)
│   │   │   │   ├── [topic]/page.tsx       ✏️ RSC pillar hub (was "use client")
│   │   │   │   └── [topic]/[subtopic]/page.tsx  ➕
│   │   │   ├── patterns/
│   │   │   │   ├── page.tsx               ✏️ RSC
│   │   │   │   └── [slug]/page.tsx        ✏️ RSC explainer  (from /algorithm-patterns)
│   │   │   ├── algorithms/[slug]/page.tsx ➕ CP-grade reference (GEO moat)
│   │   │   ├── companies/
│   │   │   │   ├── page.tsx               ✏️ RSC
│   │   │   │   ├── [slug]/page.tsx        ✏️ RSC hub
│   │   │   │   └── [slug]/[topic]/page.tsx➕ company×topic long-tail
│   │   │   ├── roadmaps/
│   │   │   │   ├── page.tsx               ➕
│   │   │   │   └── [slug]/page.tsx        ➕ interactive DAG
│   │   │   ├── sheets/
│   │   │   │   ├── page.tsx               ✏️ RSC public
│   │   │   │   └── [slug]/page.tsx        ✏️ RSC public (was [key], client)
│   │   │   ├── learn/
│   │   │   │   ├── page.tsx               ✏️ catalog
│   │   │   │   ├── [track]/page.tsx       ➕
│   │   │   │   └── [track]/[module]/page.tsx ➕ MDX lesson
│   │   │   ├── interview-questions/[slug]/page.tsx ➕ Q&A (GEO)
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx               ➕
│   │   │   │   ├── [slug]/page.tsx        ➕ MDX
│   │   │   │   └── tag/[tag]/page.tsx     ➕
│   │   │   ├── compare/[slug]/page.tsx    ➕
│   │   │   └── glossary/[term]/page.tsx   ➕
│   │   │
│   │   ├── (app)/
│   │   │   ├── layout.tsx                 ✏️ AppShell + session (from current root)
│   │   │   ├── dashboard/page.tsx         ✏️ (from current /page.tsx)
│   │   │   ├── practice/[slug]/page.tsx   ➕ solve workspace
│   │   │   ├── revision/page.tsx          ✏️ upgrade to SRS
│   │   │   ├── mock/[id]/page.tsx         ➕ AI mock interview
│   │   │   ├── playlists/[id]/page.tsx    ➕
│   │   │   ├── notes/page.tsx             ➕
│   │   │   ├── leaderboard/page.tsx       ➕
│   │   │   ├── onboarding/page.tsx        ➕
│   │   │   ├── favorites/page.tsx         ✏️ (existing)
│   │   │   ├── statistics/page.tsx        ✏️ (existing)
│   │   │   ├── settings/…                 ✏️ (existing, expanded)
│   │   │   └── admin/…                    ✏️ (existing console)
│   │   │
│   │   ├── u/[username]/page.tsx          ➕ public profile (indexable)
│   │   ├── (auth)/{signin,signup,forgot-password,reset-password/[token]}/page.tsx ✏️
│   │   ├── studio/…                       ➕ CMS (admin) — see doc 11 §CMS
│   │   │
│   │   ├── api/                           ✏️ see doc 05 (public reads + AI + existing)
│   │   ├── sitemap.ts                     ➕ doc 07
│   │   ├── sitemap/[id]/route.ts          ➕ split sitemaps (>50k urls)
│   │   ├── robots.ts                      ➕ doc 07
│   │   ├── manifest.ts                    ➕ doc 12
│   │   ├── opengraph-image.tsx            ➕ default OG (doc 07)
│   │   ├── llms.txt/route.ts              ➕ GEO (doc 09)
│   │   ├── layout.tsx  ✏️ error.tsx  not-found.tsx  loading.tsx  globals.css
│   │
│   ├── components/
│   │   ├── ui/                            (existing Radix primitives — keep)
│   │   ├── layout/
│   │   │   ├── app-shell.tsx              (existing)
│   │   │   ├── public-header.tsx          ➕ mega-menu + ⌘K
│   │   │   ├── public-footer.tsx          ➕ fat footer
│   │   │   ├── mega-menu.tsx  breadcrumbs.tsx  command-palette.tsx ➕
│   │   │   └── theme-toggle.tsx           (existing)
│   │   ├── seo/                           ➕ doc 07/08
│   │   │   ├── json-ld.tsx  breadcrumb-jsonld.tsx  faq-jsonld.tsx
│   │   │   └── article-jsonld.tsx  course-jsonld.tsx
│   │   ├── content/                       ➕ public-plane blocks
│   │   │   ├── problem-view.tsx  pattern-explainer.tsx  algorithm-reference.tsx
│   │   │   ├── topic-hub.tsx  company-hub.tsx  roadmap-graph.tsx
│   │   │   ├── faq-accordion.tsx  related-links.tsx  toc.tsx  code-block.tsx
│   │   │   └── complexity-table.tsx  answer-block.tsx  key-takeaways.tsx
│   │   ├── mdx/                           ➕ MDX component map
│   │   ├── practice/                      ➕ editor, run-panel, ai-tools, timer
│   │   ├── ai/                            ➕ chat, hint-ladder, review-panel, stream-hooks
│   │   ├── mock/  profile/  leaderboard/  gamification/  ➕
│   │   ├── questions/  charts/  dashboard/  companies/  admin/  shared/  providers/ (existing)
│   │
│   ├── server/                           ➕ server-only data-access layer (doc 05)
│   │   ├── db/  (repositories: problems.ts, topics.ts, patterns.ts, companies.ts, content.ts)
│   │   ├── ai/  (llm client, prompts/, guards)
│   │   ├── seo/ (sitemap-sources.ts, slug-registry.ts)
│   │   └── services/ (srs.ts, streaks.ts, achievements.ts, recommend.ts, leaderboard.ts)
│   │
│   ├── content/                          ➕ MDX source (or CMS-backed) 
│   │   ├── blog/*.mdx  learn/**/*.mdx  algorithms/*.mdx  glossary/*.mdx
│   │   └── authors/*.json
│   │
│   ├── lib/                              (existing: constants, patterns, learning, db, utils,
│   │   │                                  validations, security, rate-limit, seo…)
│   │   ├── seo.ts                        ➕ metadata factory + site config (doc 07)
│   │   ├── schema.ts                     ➕ JSON-LD builders (doc 08)
│   │   └── og.ts                         ➕ OG image helpers
│   ├── models/                           ✏️ existing + new (doc 04)
│   ├── hooks/  types/  auth.config.ts  middleware.ts ✏️ (public-aware gate)
│
├── public/                              ✏️ icons, og assets, /.well-known/
├── dsa-question-db/                     (existing ingest pipeline — feeds Content + slugs)
├── scripts/                             ✏️ + backfill-slugs.mjs, build-search-index.mjs
├── docs/blueprint/                      ➕ this spec
├── next.config.mjs  ✏️ (MDX, images, headers, redirects)
├── tailwind.config.ts  tsconfig.json  middleware.ts
└── .env.example                         ✏️ (doc 13)
```

**Two structural rules that make this scale**

1. **`src/server/` is the only place that imports Mongoose models.** RSC pages and route handlers call repository functions (`getProblemBySlug`, `listProblems`, `getTopicHub`), never models directly. This keeps `"server-only"` boundaries clean, makes caching/`unstable_cache` central, and lets public pages stay free of any user-data import.
2. **Content is data, not routes.** Blog/lessons/algorithms live as MDX in `src/content/` (or a `Content` collection via `/studio`). Routes are thin; adding an article never adds a file under `app/`. Taxonomy stays single-sourced in `lib/constants.ts` + `lib/patterns.ts`.

➡ Continue to **[04-data-model.md](./04-data-model.md)**.
