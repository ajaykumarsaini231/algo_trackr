# 10 · Content Strategy, Programmatic SEO, Internal Linking, Blog

Covers **#22 blog architecture · #23 topic clusters · #24 programmatic SEO · #25 internal linking · #63 content strategy · #64 keyword clustering.** This is the demand-capture engine that fills the public content plane (doc 02).

---

## 1. Keyword universe & clustering (#64)

Map the DSA/interview query space to page types. Cluster by **search intent**, one canonical page per cluster (avoid cannibalization).

| Intent cluster | Example queries | Owning page type | Volume/comp |
|---|---|---|---|
| **Definitional** | "what is a hash map", "monotonic stack meaning" | `/glossary/[term]`, `/algorithms/[slug]` | High vol, low comp — GEO gold |
| **Learn-a-topic** | "dynamic programming tutorial", "learn graphs for interviews" | `/topics/[topic]` pillar | High vol, high comp |
| **Pattern how-to** | "sliding window technique", "when to use two pointers" | `/patterns/[slug]` | Med vol, med comp |
| **Algorithm reference** | "dijkstra time complexity", "kmp algorithm explained" | `/algorithms/[slug]` | High vol, med comp — citeable |
| **Problem-specific** | "two sum solution", "trapping rain water approach" | `/problems/[slug]` | Very high vol (long tail × 15k) |
| **Company prep** | "google coding interview questions", "amazon dsa round" | `/companies/[slug]`, `/companies/[slug]/[topic]` | High vol, high intent |
| **List/curated** | "blind 75", "best dsa sheet", "striver a2z" | `/sheets/[slug]` | High vol branded |
| **Roadmap** | "dsa roadmap", "how to prepare for faang" | `/roadmaps/[slug]` | High vol, shareable |
| **Comparison** | "bfs vs dfs", "array vs linked list", "leetcode vs neetcode" | `/compare/[slug]` | Med vol, featured-snippet prone |
| **Interview Q&A** | "top 50 array interview questions", "graph interview questions" | `/interview-questions/[slug]` | High vol — GEO/FAQ |
| **Editorial/guide** | "how to get better at dp", "time complexity explained" | `/blog/[slug]`, `/learn/[track]/[module]` | Broad |

Keep a `keyword-map.csv` (or a `SeoTarget` collection): `query, cluster, targetPath, primary/secondary, status`. Every content ticket references a target keyword + intent.

---

## 2. Topic-cluster (hub-and-spoke) model (#23)

The structure Google + LLMs reward: a **pillar** owns the head term and links to many **spokes**; spokes link back to the pillar and laterally to siblings.

```
PILLAR: /topics/dynamic-programming  (owns "dynamic programming")
 ├─ spoke /topics/dynamic-programming/knapsack        (subtopic)
 ├─ spoke /topics/dynamic-programming/lis
 ├─ spoke /patterns/memoization  /patterns/tabulation (patterns)
 ├─ spoke /algorithms/kadane                          (algorithm ref)
 ├─ spoke /problems/climbing-stairs … (top DP problems)
 ├─ spoke /interview-questions/dynamic-programming    (Q&A)
 ├─ spoke /blog/how-to-master-dp-in-30-days           (editorial)
 └─ spoke /companies/google/dynamic-programming       (company cross)
        ↑ every spoke links back to the pillar with descriptive anchor text
```

Build **17 pillar clusters** (one per topic in `lib/constants.ts`), each with 8–20 spokes. This is the backbone of both crawl-depth (everything ≤2 clicks) and topical authority. The pillar page's `TopicHub` component (doc 06) auto-renders the spoke links from taxonomy + `Content.topicSlugs`.

---

## 3. Programmatic SEO (#24)

You already hold the rarest asset: a **15,267-problem structured dataset** with topic/pattern/company/difficulty/complexity. That powers tens of thousands of high-intent pages *from templates* — the GfG/LeetCode scaling move, done cleanly.

**Programmatic page families:**

| Template | URL | Generated from | Est. pages |
|---|---|---|---|
| Problem | `/problems/[slug]` | `Question` | ~15,000 |
| Company hub | `/companies/[slug]` | `companies[]` distinct | ~150 |
| Company × topic | `/companies/[slug]/[topic]` | company × topic matrix (only non-empty) | ~2,000 |
| Topic × difficulty | `/topics/[topic]?difficulty=` (indexable facet) | catalog | ~50 |
| Pattern | `/patterns/[slug]` | `lib/patterns.ts` (163) | 163 |
| "Top N X problems" | `/interview-questions/[slug]` | curated aggregates | ~300 |
| Glossary term | `/glossary/[term]` | terms list | ~200 |

**Quality guards (avoid thin/doorway penalties — the #1 programmatic risk):**
- **Minimum unique value per page.** Each page must have ≥1 of: authored intro (80–150 words), unique aggregated data (counts, difficulty split, top patterns), or curated ordering. A page that's just a filtered table = `noindex` until enriched.
- **Threshold to index.** Only index company×topic pages with ≥5 problems; below → `noindex, follow` (link equity flows, no thin page indexed).
- **Templated but not duplicated.** Vary intros with real data ("Google asks 47 DP problems; the most frequent pattern is interval DP"). Never spin identical prose.
- **Human layer on top.** Editorial pillars + hand-curated sheets + author guides give the programmatic layer topical authority to borrow.
- **Staged rollout.** Ship 2k best pages first (doc 02 SSG budget); expand as they earn impressions; prune non-performers (consolidate/`noindex`).

**Generation pipeline:** the existing `dsa-question-db/` ingest → `Content`/`Question` enrichment (patterns, companies, complexity via your classifier) → `getAllProblemSlugs()` feeds sitemap + `generateStaticParams`. New problems appear in ISR + next sitemap automatically.

---

## 4. Internal linking strategy (#25)

Internal links distribute PageRank, define clusters, and give crawlers/LLMs the entity graph. Make linking **systematic, not manual**:

**Automated link modules (render on every relevant page):**
1. **Breadcrumbs** (every deep page) — hierarchical up-links + schema.
2. **`RelatedLinks`** — problem → same-pattern + same-topic + "companies that ask it"; topic → subtopics + patterns + top problems; pattern → problems + related patterns.
3. **Fat footer** — sitewide hub linking top topics/patterns/companies/sheets/roadmaps (flattens crawl depth to ≤2).
4. **Contextual in-body links** — MDX autolinks: first mention of a known term/algorithm/pattern → link its canonical page (a `remark` plugin maps entity names → slugs from `constants.ts`/`patterns.ts`).
5. **"Next in roadmap / sheet"** — sequential prev/next within ladders (keeps users + crawlers moving through the cluster).
6. **Pillar ↔ spoke reciprocity** — enforced by `TopicHub` (down) + spoke template (up).

**Rules:** descriptive anchor text (the target's primary keyword, not "click here"); 3–10 contextual internal links per page; link *to* deep pages from high-authority pages (home/pillars); avoid orphan pages — a page not linked by ≥2 others triggers a build-time warning (`scripts/check-orphans.mjs`).

**Link-graph health CI:** a script crawls the generated `sitemap` + internal links → flags orphans, dead links, and pages with <3 inbound links.

---

## 5. Blog architecture (#22)

**Purpose:** capture broad/editorial demand, feed clusters with fresh authored content (EEAT + freshness), earn backlinks, cross-post for off-site GEO (doc 09).

- **Source:** MDX in `src/content/blog/` *or* `Content` collection via `/studio` CMS (doc 11). MDX compiled with `@next/mdx` + `remark`/`rehype` (GFM, autolink headings, Shiki highlight, reading-time, entity-autolink).
- **Routes:** `/blog` (paginated, tag facets) · `/blog/[slug]` · `/blog/tag/[tag]`.
- **Post frontmatter → drives schema + meta:**
  ```yaml
  title: "How to Master Dynamic Programming in 30 Days"
  description: "..."
  slug: master-dynamic-programming-30-days
  authors: [striver]              # → Author/Person schema, byline
  reviewer: ex-faang-eng          # → "Reviewed by" (EEAT)
  publishedAt: 2026-02-01
  updatedAt: 2026-05-10
  tags: [dynamic-programming, roadmap]
  topicSlugs: [dynamic-programming]   # → cluster links
  cover: /blog/dp-30-days.png
  faqs: [{ q: "...", a: "..." }]      # → FAQPage schema
  keyTakeaways: ["...", "..."]
  ```
- **Post types (mix programmatic + editorial):**
  - Pillar guides ("Complete guide to Graphs for interviews")
  - Roadmaps/plans ("30-day FAANG prep plan")
  - Company deep-dives ("What Google's DSA rounds actually test")
  - "Top N" list posts (interview-questions cross-links)
  - Original-data posts ("We analyzed 15k problems…") — backlink magnets
  - Concept explainers ("Time complexity, actually explained")
- **On every post:** BLUF answer block, TOC, author byline + reviewed-by, key takeaways, FAQ, related links, share buttons, visible updated date. → BlogPosting + Breadcrumb + FAQ schema (doc 08).
- **Editorial calendar:** 2–4 posts/week; prioritize by keyword-map opportunity × cluster gap. Refresh top posts quarterly (bump `updatedAt` → freshness).

---

## 6. Content ops & governance

- **Content model in `/studio`** (CMS, doc 11): draft → review → publish; publish triggers `revalidateTag('content')` + sitemap refresh.
- **Style guide:** answer-first, question-shaped H2s, tables for facts, correct runnable code, no fluff, cite sources. (These are also the GEO rules — doc 09 §3.)
- **Dedup/cannibalization audit:** one canonical page per keyword cluster; merge overlaps with 301s (`slug_redirects`).
- **Performance review:** monthly GSC pull → identify striking-distance pages (positions 5–15) to improve; prune/consolidate thin programmatic pages.

➡ Continue to **[11-features.md](./11-features.md)**.
