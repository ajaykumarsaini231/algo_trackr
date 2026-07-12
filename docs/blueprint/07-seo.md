# 07 · Technical SEO (real, copy-pasteable)

Covers **#8 SEO · #11 metadata · #12 robots · #13 sitemap · #14 canonical · #15 Open Graph · #16 Twitter · #69 technical SEO.** All code in your stack (Next 15 Metadata API, TypeScript).

---

## 1. Site config + metadata factory — `src/lib/seo.ts`

```ts
import type { Metadata } from "next";

export const SITE = {
  name: "DSAspire",
  // Set to your custom domain once live; env override for previews.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://dsaspire.vercel.app",
  tagline: "Master DSA & crack coding interviews",
  description:
    "Learn Data Structures & Algorithms with 15,000+ curated problems, visual roadmaps, pattern-based guides, company interview prep, spaced-repetition revision and AI tutoring.",
  twitter: "@dsaspire",
  locale: "en_US",
  defaultOg: "/opengraph-image", // dynamic route below
} as const;

type BuildMeta = {
  title: string;
  description: string;
  path: string;                 // canonical path, e.g. "/problems/two-sum"
  images?: string[];
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  keywords?: string[];
};

export function buildMetadata(m: BuildMeta): Metadata {
  const url = new URL(m.path, SITE.url).toString();
  const images = m.images?.length ? m.images : [SITE.defaultOg];
  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    alternates: { canonical: url },          // ← canonical on every page (#14)
    openGraph: {                             // ← Open Graph (#15)
      type: m.type ?? "website",
      url, siteName: SITE.name, locale: SITE.locale,
      title: m.title, description: m.description, images,
      ...(m.publishedTime && { publishedTime: m.publishedTime }),
      ...(m.modifiedTime && { modifiedTime: m.modifiedTime }),
    },
    twitter: {                               // ← Twitter Cards (#16)
      card: "summary_large_image",
      site: SITE.twitter, creator: SITE.twitter,
      title: m.title, description: m.description, images,
    },
    robots: m.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large",
                       "max-snippet": -1, "max-video-preview": -1 } },
  };
}
```

## 2. Root layout — add `metadataBase` + defaults (#11)

Your current `layout.tsx` lacks `metadataBase` (so OG/canonical URLs don't resolve absolutely). Add it:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),                 // ← critical, currently missing
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name }],
  creator: SITE.name, publisher: SITE.name,
  formatDetection: { telephone: false },
  icons: { icon: ["/favicon.svg", "/favicon.ico"], apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",               // doc 12
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, locale: SITE.locale, url: SITE.url },
  twitter: { card: "summary_large_image", site: SITE.twitter },
};
```

## 3. Per-page metadata via `generateMetadata` (examples)

**Problem page** — `(content)/problems/[slug]/page.tsx`:
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const p = await getProblemBySlug(params.slug);
  if (!p) return { title: "Problem not found", robots: { index: false } };
  return buildMetadata({
    title: `${p.title} — ${p.difficulty} · ${p.topic}`,
    description: `Solve ${p.title} (${p.difficulty}). ${p.pattern ? p.pattern + " pattern. " : ""}Approach, ${p.timeComplexity || "optimal"} time complexity, examples, and companies that ask it.`,
    path: `/problems/${p.slug}`,
    images: [`/api/og?type=problem&slug=${p.slug}`],
    type: "article",
    keywords: [p.title, p.topic, p.pattern, ...(p.companies ?? []), "coding interview", "dsa"].filter(Boolean),
  });
}
```

**Topic hub** — dynamic, keyword-rich:
```ts
export async function generateMetadata({ params }) {
  const t = getTopicBySlug(params.topic); if (!t) return { robots: { index: false } };
  const count = await countProblems({ topic: t.name });
  return buildMetadata({
    title: `${t.name} — DSA Guide, Patterns & ${count}+ Practice Problems`,
    description: `Master ${t.name} for coding interviews: core concepts, ${t.subtopics.length} subtopics, key patterns, a learning roadmap, and ${count}+ curated problems with solutions.`,
    path: `/topics/${params.topic}`,
    images: [`/api/og?type=topic&slug=${params.topic}`],
  });
}
```

**Rules:** unique title ≤60 chars where possible (template appends `· DSAspire`); description 140–160 chars, benefit + number + intent; `noindex` for `(auth)`, `/settings`, `/admin`, thin filter combos, private profiles.

---

## 4. Sitemap — `src/app/sitemap.ts` (DB-sourced, chunked) (#13)

Next's `sitemap.ts` supports arrays; for >50k URLs use `generateSitemaps` to shard. Source URLs from the DB, not the build.

```ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { getAllProblemSlugs, getAllContentSlugs } from "@/server/seo/sitemap-sources";
import { TOPICS } from "@/lib/constants";
import { PATTERNS } from "@/lib/patterns";

// Shard problems (largest set) into 50k chunks; static sets in id 0.
export async function generateSitemaps() {
  const n = await getAllProblemSlugs().then(s => Math.ceil(s.length / 45000));
  return [{ id: 0 }, ...Array.from({ length: n }, (_, i) => ({ id: i + 1 }))];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const u = (path: string, priority = 0.6, changeFrequency: any = "weekly", lastMod?: Date) =>
    ({ url: new URL(path, SITE.url).toString(), lastModified: lastMod ?? new Date(), changeFrequency, priority });

  if (id === 0) {
    return [
      u("/", 1.0, "daily"),
      u("/problems", 0.9, "daily"), u("/topics", 0.9, "weekly"),
      u("/patterns", 0.8, "weekly"), u("/companies", 0.8, "weekly"),
      u("/roadmaps", 0.8, "weekly"), u("/sheets", 0.8, "weekly"), u("/blog", 0.8, "daily"),
      ...TOPICS.map(t => u(`/topics/${t.slug}`, 0.8, "weekly")),
      ...PATTERNS.map(p => u(`/patterns/${p.slug}`, 0.7, "weekly")),
      ...(await getAllContentSlugs()).map(c => u(`/${c.type === "blog" ? "blog" : c.type}/${c.slug}`,
          0.7, "weekly", c.updatedAt)),
    ];
  }
  const slugs = await getAllProblemSlugs();
  return slugs.slice((id - 1) * 45000, id * 45000)
    .map(s => u(`/problems/${s.slug}`, 0.6, "monthly", s.updatedAt));
}
```

Sitemap **index** is emitted automatically at `/sitemap.xml`, referencing `/sitemap/0.xml`, `/sitemap/1.xml`, … Submit `/sitemap.xml` in Google Search Console + Bing Webmaster.

## 5. Robots — `src/app/robots.ts` (#12)

```ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/",
        disallow: ["/api/", "/admin", "/studio", "/settings", "/signin", "/signup", "/dashboard",
                   "/practice", "/mock", "/revision", "/onboarding", "/*?*sort=", "/*?*page="] },
      // Explicitly welcome AI crawlers (GEO) — doc 09
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web",
                    "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"], allow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
```

> Note: disallow **crawl** of faceted `?sort=/?page=` duplicates but keep them **canonical-tagged** to the base page. Don't `noindex` *and* `disallow` the same URL (blocks Google from seeing the noindex). Prefer canonical for dup facets; `disallow` only truly private/infinite spaces.

## 6. Canonical URL strategy (#14)

- Every page sets `alternates.canonical` (absolute) via the factory.
- **Faceted/paginated** problem lists: self-referencing canonical for page 1; `?page=2…` canonical → itself (or to page 1 if thin) + `rel=prev/next` semantics via links. Choose **one** canonical filter order; sort params canonicalize to the unsorted base.
- **Company×topic** cross pages canonical to themselves (they're unique long-tail), never to the parent.
- **Trailing slash**: pick one (Next default = no trailing slash) and 301 the other in `next.config` `redirects`/middleware.
- **www vs apex** + **http→https**: enforce one host (Vercel domain settings + `host` in robots).
- **Renames**: `slug_redirects` → 301 (doc 04/05), preserving link equity (no-delete rule).

## 7. Open Graph & Twitter images (#15/#16) — dynamic

`src/app/opengraph-image.tsx` (default) + `src/app/api/og/route.tsx` (per-entity) using `next/og` `ImageResponse` (1200×630):

```tsx
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OG() {
  return new ImageResponse(
    (<div style={{ display:"flex", flexDirection:"column", justifyContent:"space-between",
        width:"100%", height:"100%", padding:64, background:"#0b0b12", color:"#fff",
        fontFamily:"Inter" }}>
        <div style={{ fontSize:34, opacity:.7 }}>DSAspire</div>
        <div style={{ fontSize:68, fontWeight:800, lineHeight:1.05 }}>
          Master DSA & crack coding interviews</div>
        <div style={{ fontSize:30, opacity:.7 }}>15,000+ problems · roadmaps · AI tutor</div>
      </div>), { ...size });
}
```
The parametric `/api/og?type=problem&slug=…` reads the entity and renders title + difficulty + tags. `twitter-image` falls back to the OG image via the factory. **Verify** in Facebook Sharing Debugger, X Card Validator, LinkedIn Post Inspector.

## 8. Technical SEO checklist (#69)

- ✅ Server-rendered HTML for all public pages (fixes the CSR-shell problem).
- ✅ `metadataBase` set; absolute canonical/OG.
- ✅ One `<h1>`; semantic outline; descriptive internal anchor text (doc 10).
- ✅ Clean, stable, lowercase-kebab URLs; no `_id` in public paths; 301 map for renames.
- ✅ `hreflang` — only `en` now; structure ready if you localize (`alternates.languages`).
- ✅ Pagination signals; canonical for facets; `noindex` thin combos.
- ✅ Image `alt`, `next/image` with width/height (no CLS), lazy below fold (doc 12).
- ✅ Fast TTFB via ISR/edge cache; CWV budget (doc 12).
- ✅ `sitemap.xml` + `robots.txt` submitted to GSC/Bing; monitor Coverage & Core Web Vitals reports.
- ✅ Structured data on every template (doc 08) → validate in Rich Results Test.
- ✅ 404 → helpful `not-found.tsx` with search + popular links (reduces bounce, keeps crawl).
- ✅ `changefreq`/`lastmod` truthful (from `updatedAt`).

➡ Continue to **[08-schema-jsonld.md](./08-schema-jsonld.md)**.
