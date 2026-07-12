# 14 · Implementation Roadmap

Sequenced execution plan. Ordered by **dependency + ROI**: SEO foundation ships first (compounds while you build), then the public content plane (the discovery engine), then engagement/AI (retention + differentiation), then content/GEO scale, then performance polish + launch.

Effort key: **S** ≤2d · **M** 3–5d · **L** 1–2wk · **XL** 2wk+. Assumes 1–2 engineers.

---

## Phase 0 — SEO Foundation & guardrails (Weeks 1–2)
*Ship even before new pages exist. Pure upside, no dependencies.*

| Task | Effort | Doc |
|---|---|---|
| `lib/seo.ts` metadata factory + `SITE` config; add `metadataBase` to root layout | S | 07 |
| `lib/schema.ts` builders + `<JsonLd>`; Organization + WebSite/SearchAction in root layout | S | 08 |
| `sitemap.ts` (+ `generateSitemaps` chunking) sourced from DB; `robots.ts`; `manifest.ts` | M | 07/12 |
| `opengraph-image.tsx` + `/api/og` dynamic images | M | 07 |
| `slug` field + `backfill-slugs.mjs` + `slug_redirects` + middleware 301 | M | 04 |
| Custom domain + `NEXT_PUBLIC_SITE_URL` + preview-noindex flag | S | 13 |
| Invert `middleware.ts` → gate only `(app)`; create route groups `(marketing)/(content)/(app)` | M | 02/03 |

**Exit criteria:** valid sitemap/robots/manifest live; every existing page emits canonical + OG + Organization schema; GSC property verified + sitemap submitted; route groups in place with the public/private split working.

---

## Phase 1 — Public Content Plane (Weeks 3–6)
*The discovery engine. Convert the hidden catalog into indexable pages.*

| Task | Effort | Doc |
|---|---|---|
| `src/server/db` repositories (problems/topics/patterns/companies) + `unstable_cache` tags | M | 05 |
| Refactor topic/pattern/company/sheet pages **CSR → RSC** with `generateMetadata` + `generateStaticParams` (top ~2k) | L | 02/06 |
| `/problems` faceted index + `/problems/[slug]` public problem pages (TechArticle+Breadcrumb+FAQ) | L | 02/11 |
| Company hubs `/companies/[slug]` + `/companies/[slug]/[topic]` long-tail | L | 10/11 |
| `Company` model + authored overviews/rounds/prep for top ~30 companies | M | 04 |
| Breadcrumbs component + BreadcrumbList everywhere; `RelatedLinks` + fat footer (internal-link graph) | M | 06/10 |
| Public read personalization overlay (`SolvedOverlay` → `/api/me/progress`) | S | 02 |
| `PublicHeader` mega-menu + `PublicFooter` + ⌘K search (SearchAction) | M | 06 |
| Programmatic quality guards (min-value, index thresholds, orphan check CI) | M | 10 |

**Exit criteria:** ~2,000+ pages server-rendered + indexable; Rich Results valid on problem/topic/company templates; internal-link graph flat (≤2 clicks); GSC starts reporting impressions.

---

## Phase 2 — Engagement & AI (Weeks 7–10)
*Retention loop + the four differentiators.*

| Task | Effort | Doc |
|---|---|---|
| Practice workspace `/practice/[slug]` (editor + run + notes + timer) | L | 11 |
| AI suite: `/api/ai/{hint,explain,review,doubt}` streaming + client panels + quotas | L | 11/05 |
| AI roadmap generator + onboarding flow | M | 11 |
| Mock interviews `/mock/[id]` (streaming interviewer + rubric + transcript) | XL | 11 |
| Revision v2 — SM-2 SRS (`SrsCard`, `/revision`, grade flow, reminder integration) | M | 11 |
| Gamification: streaks v2, XP/levels, achievements, `Activity` source-of-truth | M | 11 |
| Public profiles `/u/[username]` (indexable, proof-of-work) + ProfilePage schema | M | 11/08 |
| Leaderboards (global/weekly/company) + recommendation engine v1 (rules) | M | 11 |
| OAuth (GitHub/Google) + email verify/reset | M | 11/13 |

**Exit criteria:** logged-in user can solve → get AI help → revise on schedule → see streak/XP/badges → run a mock; public profile shareable; D7 retention measurable and improving.

---

## Phase 3 — Content & GEO scale (Weeks 11–14)
*Fill clusters, become AI-citeable.*

| Task | Effort | Doc |
|---|---|---|
| `Content` + `Author` models; `/studio` CMS (MDX editor, workflow, on-publish revalidate) | L | 04/11 |
| Blog `/blog/*` (MDX pipeline, BlogPosting schema, authors, reviewed-by) | M | 10 |
| CP-grade `/algorithms/[slug]` reference layer (the GEO moat) — top ~40 algorithms | L | 02/09 |
| `/interview-questions/[slug]` Q&A (QAPage/FAQ) + `/compare/[slug]` + `/glossary` | M | 10 |
| 17 topic pillars fully authored (BLUF, tables, FAQ, key-takeaways, links) | L | 10 |
| Roadmaps `/roadmaps/[slug]` interactive DAG (curated set) | M | 11 |
| `llms.txt` + `llms-full.txt`; AI-referral tracking; answer-first template audit | S | 09/12 |
| EEAT: author pages, credentials, "reviewed by", original-data blog posts | M | 09/10 |

**Exit criteria:** every content template ships the GEO checklist (doc 09 §3); ≥40 algorithm refs + 17 pillars + Q&A hubs live; first AI citations appear; branded search rising.

---

## Phase 4 — Performance, PWA & launch (Weeks 15–16)

| Task | Effort | Doc |
|---|---|---|
| PWA (manifest + Serwist SW, offline revision/saved problems, install CTA) | M | 12 |
| CWV budget + Lighthouse-CI + bundle budgets in CI; lazy/dynamic audit; image pipeline | M | 12 |
| Analytics + RUM + Sentry + Speed Insights wired; growth dashboard | M | 12 |
| Contests `/contests/*` (archive + weekly cadence) | M | 11 |
| A11y audit (axe + manual) to AA; SEO regression sweep; go-live checklist | M | 06/13 |

**Exit criteria:** Lighthouse ≥95 mobile on key templates; CWV green in field; installable PWA; all doc-13 go-live boxes checked.

---

## Dependency graph (what blocks what)

```
P0 route-groups + repositories  ─▶ P1 RSC content pages ─▶ P3 CMS/blog/algorithms
P0 slug/redirects               ─▶ P1 problem pages
P1 public problem page          ─▶ P2 practice workspace (shares ProblemView)
P2 auth/OAuth + Activity        ─▶ P2 profiles/leaderboards/achievements
P1 content plane                ─▶ P3 GEO (needs pages to optimize)
everything                      ─▶ P4 perf/PWA/launch
```

## KPIs & targets (review monthly)

| Metric | Baseline (now) | 3-month | 6-month |
|---|---|---|---|
| Indexable URLs | ~0 public | 5,000 | 30,000 |
| Organic clicks/mo (GSC) | ~0 | 5k | 50k |
| AI-referral sessions/mo | 0 | 500 | 5k |
| CWV pass rate (mobile) | unknown | 90% | 95% |
| Lighthouse (key pages) | ~ | ≥90 | ≥95 |
| Signup→first-solve rate | — | 35% | 50% |
| D7 retention | — | 20% | 30% |
| AI citations (head queries) | 0 | 5 | 20 |

## Team & sequencing notes

- **Two tracks in parallel where possible:** (A) platform/RSC/SEO infra, (B) content authoring + CMS. P0/P1 are mostly track A; P3 needs track B ramping from Week 6.
- **Ship continuously.** Each phase is independently valuable — P0 improves current pages, P1 opens organic, P2 lifts retention, P3 compounds. Don't wait for a big-bang launch.
- **Measure before scaling programmatic.** Prove 2k pages earn impressions before generating 15k (doc 10 quality guards).
- **Keep the codebase's discipline:** additive migrations, no-delete, Zod on writes, one Mongoose boundary, RSC-by-default.

---

## Blueprint complete

You now have: strategy + gap analysis (README), competitive playbook (01), architecture/IA (02), folder structure (03), full data model (04), API surface (05), components/UX/a11y (06), technical SEO with code (07), JSON-LD (08), GEO (09), content strategy (10), every feature (11), performance/PWA (12), deployment (13), and this roadmap (14).

**Start at Phase 0.** The single highest-leverage first commit: add `metadataBase` + the metadata factory + `sitemap.ts`/`robots.ts`, and invert the middleware to open the public plane. Everything else compounds on top.
