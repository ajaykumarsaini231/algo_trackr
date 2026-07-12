# 08 · JSON-LD Structured Data

Covers **#10 JSON-LD · #17 Breadcrumb · #18 FAQ · #19 Organization · #20 Course · #21 SearchAction · #67 rich snippets.** Structured data is *double-duty*: it wins rich results in Google **and** is the most reliable signal AI crawlers use to understand and cite your pages (doc 09).

---

## 1. The renderer — `src/components/seo/json-ld.tsx`

```tsx
import "server-only";
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c"); // XSS-safe
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
```
Rendered inside RSC pages (server-only, zero client JS). Multiple blocks per page are fine; or combine with `@graph`.

## 2. Builders — `src/lib/schema.ts`

```ts
import { SITE } from "@/lib/seo";
const abs = (p: string) => new URL(p, SITE.url).toString();

/** #19 Organization — put in root layout (sitewide) */
export const organizationSchema = () => ({
  "@context": "https://schema.org", "@type": "Organization",
  "@id": abs("/#organization"), name: SITE.name, url: SITE.url,
  logo: { "@type": "ImageObject", url: abs("/logo.png"), width: 512, height: 512 },
  description: SITE.description,
  sameAs: [ "https://twitter.com/dsaspire", "https://github.com/dsaspire",
            "https://www.linkedin.com/company/dsaspire", "https://www.youtube.com/@dsaspire" ],
});

/** #21 WebSite + SearchAction — root layout; enables sitelinks search box */
export const websiteSchema = () => ({
  "@context": "https://schema.org", "@type": "WebSite",
  "@id": abs("/#website"), url: SITE.url, name: SITE.name, description: SITE.description,
  publisher: { "@id": abs("/#organization") },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: abs("/problems?q={search_term_string}") },
    "query-input": "required name=search_term_string",
  },
});

/** #17 BreadcrumbList — every deep page */
export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path),
  })),
});

/** #18 FAQPage — problem/topic/company/blog pages that carry Q&A */
export const faqSchema = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faqs.map(f => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/** #20 Course — topics, tracks, roadmaps, sheets */
export const courseSchema = (c: {
  name: string; description: string; path: string; provider?: string;
}) => ({
  "@context": "https://schema.org", "@type": "Course",
  name: c.name, description: c.description, url: abs(c.path),
  provider: { "@type": "Organization", name: c.provider ?? SITE.name, url: SITE.url,
              "@id": abs("/#organization") },
  hasCourseInstance: {           // required by Google for Course rich results
    "@type": "CourseInstance", courseMode: "online",
    courseWorkload: "PT10H",     // ISO 8601 duration; set realistically
  },
  isAccessibleForFree: true, inLanguage: "en",
});

/** Problem/algorithm/pattern reference → TechArticle */
export const techArticleSchema = (a: {
  headline: string; description: string; path: string; author?: string;
  datePublished?: string; dateModified?: string; image?: string;
  proficiencyLevel?: "Beginner" | "Expert"; keywords?: string[];
}) => ({
  "@context": "https://schema.org", "@type": "TechArticle",
  headline: a.headline, description: a.description, url: abs(a.path),
  mainEntityOfPage: abs(a.path),
  image: a.image ? abs(a.image) : abs(SITE.defaultOg),
  author: { "@type": a.author ? "Person" : "Organization", name: a.author ?? SITE.name },
  publisher: { "@id": abs("/#organization") },
  datePublished: a.datePublished, dateModified: a.dateModified ?? a.datePublished,
  proficiencyLevel: a.proficiencyLevel, keywords: a.keywords?.join(", "),
  inLanguage: "en",
});

/** Blog posts → BlogPosting */
export const blogPostingSchema = (p: {
  title: string; description: string; path: string; image?: string;
  author: string; authorPath?: string; datePublished: string; dateModified?: string;
  wordCount?: number; keywords?: string[];
}) => ({
  "@context": "https://schema.org", "@type": "BlogPosting",
  headline: p.title, description: p.description, url: abs(p.path), mainEntityOfPage: abs(p.path),
  image: abs(p.image ?? SITE.defaultOg),
  author: { "@type": "Person", name: p.author, ...(p.authorPath && { url: abs(p.authorPath) }) },
  publisher: { "@id": abs("/#organization") },
  datePublished: p.datePublished, dateModified: p.dateModified ?? p.datePublished,
  wordCount: p.wordCount, keywords: p.keywords?.join(", "), inLanguage: "en",
});

/** Interview-questions → QAPage (GEO gold) */
export const qaPageSchema = (q: { question: string; answerHtml: string; path: string; upvotes?: number }) => ({
  "@context": "https://schema.org", "@type": "QAPage",
  mainEntity: { "@type": "Question", name: q.question, answerCount: 1,
    acceptedAnswer: { "@type": "Answer", text: q.answerHtml, url: abs(q.path),
                      upvoteCount: q.upvotes ?? 0 } },
});

/** ItemList — problem lists, sheets, "top N" pages (rich list results) */
export const itemListSchema = (items: { name: string; path: string }[], name: string) => ({
  "@context": "https://schema.org", "@type": "ItemList", name,
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1,
    name: it.name, url: abs(it.path) })),
});

/** Public profile → ProfilePage + Person (EEAT/author) */
export const profileSchema = (u: {
  username: string; name: string; bio?: string; image?: string;
  github?: string; linkedin?: string;
}) => ({
  "@context": "https://schema.org", "@type": "ProfilePage",
  mainEntity: { "@type": "Person", name: u.name, alternateName: u.username,
    description: u.bio, image: u.image, url: abs(`/u/${u.username}`),
    sameAs: [u.github, u.linkedin].filter(Boolean) },
});

/** DefinedTerm — glossary (GEO definitional queries) */
export const definedTermSchema = (t: { term: string; definition: string; path: string }) => ({
  "@context": "https://schema.org", "@type": "DefinedTerm",
  name: t.term, description: t.definition, url: abs(t.path),
  inDefinedTermSet: { "@type": "DefinedTermSet", name: "DSAspire Glossary", url: abs("/glossary") },
});
```

## 3. Which schema on which page

| Page | JSON-LD blocks |
|---|---|
| Root layout (all) | **Organization** + **WebSite+SearchAction** (via `@graph`, once) |
| `/` home | Organization, WebSite, ItemList (featured roadmaps) |
| `/problems/[slug]` | **TechArticle** + **BreadcrumbList** + **FAQPage** |
| `/topics/[topic]` | **Course** + BreadcrumbList + FAQPage + ItemList (top problems) |
| `/patterns/[slug]` | TechArticle (or **HowTo** for step templates) + Breadcrumb + FAQ |
| `/algorithms/[slug]` | TechArticle (`proficiencyLevel`) + Breadcrumb |
| `/companies/[slug]` | Course/ItemList + Breadcrumb + FAQPage |
| `/roadmaps/[slug]`, `/sheets/[slug]`, `/learn/[track]` | **Course** + Breadcrumb + ItemList |
| `/blog/[slug]` | **BlogPosting** + Breadcrumb + FAQPage (if FAQs) |
| `/interview-questions/[slug]` | **QAPage** or FAQPage + Breadcrumb |
| `/glossary/[term]` | **DefinedTerm** + Breadcrumb |
| `/u/[username]` (public) | **ProfilePage + Person** |

**Usage in a page (RSC):**
```tsx
import { JsonLd } from "@/components/seo/json-ld";
import { techArticleSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";
// …inside the component:
<JsonLd data={[
  techArticleSchema({ headline: p.title, description, path: `/problems/${p.slug}`,
                      dateModified: p.updatedAt, keywords: [p.topic, p.pattern] }),
  breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Problems", path: "/problems" },
                    { name: p.title, path: `/problems/${p.slug}` }]),
  ...(p.faqs?.length ? [faqSchema(p.faqs)] : []),
]} />
```

## 4. Rich-snippet & validation rules (#67)

- **Every claim in schema must be visible on the page** (Google penalizes hidden/mismatched FAQ/HowTo). FAQ text = the rendered `FaqAccordion` content.
- `Course` requires `provider` + `hasCourseInstance` for rich results — included above.
- Keep `dateModified` honest from `updatedAt` (freshness → both ranking and AI-recency).
- Author/Person schema only where a real byline exists (EEAT — doc 09/10).
- **Validate** each template once in Google **Rich Results Test** + Schema.org validator; add a CI smoke test that fetches a sample of each template and asserts a valid `application/ld+json` block parses.
- Avoid over-marking (no `Review`/`AggregateRating` unless you have genuine, on-page ratings — spam risk).

➡ Continue to **[09-geo.md](./09-geo.md)**.
