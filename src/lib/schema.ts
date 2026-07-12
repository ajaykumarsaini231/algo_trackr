import { SITE } from "@/lib/seo";

/**
 * JSON-LD structured-data builders. Rendered via <JsonLd /> in server
 * components. Doubles as the primary signal AI answer engines use to
 * understand and cite pages.
 */
const abs = (p: string) => new URL(p, SITE.url).toString();

/** Organization — sitewide (root layout). */
export const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": abs("/#organization"),
  name: SITE.name,
  url: SITE.url,
  logo: { "@type": "ImageObject", url: abs("/logo.svg") },
  description: SITE.description,
  sameAs: [
    "https://twitter.com/dsaspire",
    "https://github.com/dsaspire",
    "https://www.linkedin.com/company/dsaspire",
  ],
});

/** WebSite + SearchAction — sitewide (enables the sitelinks search box). */
export const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": abs("/#website"),
  url: SITE.url,
  name: SITE.name,
  description: SITE.description,
  publisher: { "@id": abs("/#organization") },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: abs("/search?q={search_term_string}"),
    },
    "query-input": "required name=search_term_string",
  },
});

/** BreadcrumbList — deep pages. */
export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: abs(it.path),
  })),
});

/** FAQPage — pages carrying a visible Q&A block. */
export const faqSchema = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/** Course — topics, tracks, roadmaps, sheets. */
export const courseSchema = (c: {
  name: string;
  description: string;
  path: string;
  provider?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Course",
  name: c.name,
  description: c.description,
  url: abs(c.path),
  provider: {
    "@type": "Organization",
    name: c.provider ?? SITE.name,
    url: SITE.url,
    "@id": abs("/#organization"),
  },
  hasCourseInstance: {
    "@type": "CourseInstance",
    courseMode: "online",
    courseWorkload: "PT10H",
  },
  isAccessibleForFree: true,
  inLanguage: "en",
});

/** TechArticle — problem / algorithm / pattern reference pages. */
export const techArticleSchema = (a: {
  headline: string;
  description: string;
  path: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  proficiencyLevel?: "Beginner" | "Expert";
  keywords?: string[];
}) => ({
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: a.headline,
  description: a.description,
  url: abs(a.path),
  mainEntityOfPage: abs(a.path),
  image: a.image ? abs(a.image) : abs(SITE.defaultOg),
  author: { "@type": a.author ? "Person" : "Organization", name: a.author ?? SITE.name },
  publisher: { "@id": abs("/#organization") },
  ...(a.datePublished && { datePublished: a.datePublished }),
  ...(a.dateModified && { dateModified: a.dateModified }),
  ...(a.proficiencyLevel && { proficiencyLevel: a.proficiencyLevel }),
  ...(a.keywords?.length && { keywords: a.keywords.join(", ") }),
  inLanguage: "en",
});

/** ItemList — problem lists, sheets, "top N" pages. */
export const itemListSchema = (items: { name: string; path: string }[], name: string) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  numberOfItems: items.length,
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    url: abs(it.path),
  })),
});
