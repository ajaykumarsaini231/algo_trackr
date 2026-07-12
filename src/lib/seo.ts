import type { Metadata } from "next";

/**
 * Central SEO/site config + a metadata factory used by every route's
 * `generateMetadata`. Keeps canonical URLs, Open Graph and Twitter cards
 * consistent across the app.
 *
 * Set NEXT_PUBLIC_SITE_URL to your canonical origin (custom domain in prod).
 * Set NEXT_PUBLIC_NOINDEX=1 on preview/staging deploys so they never get
 * indexed while still letting you QA them.
 */
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dsaspire.vercel.app";

export const SITE = {
  name: "DSAspire",
  url: rawUrl.replace(/\/+$/, ""),
  tagline: "Master DSA & crack coding interviews",
  description:
    "Learn Data Structures & Algorithms with 15,000+ curated problems, visual roadmaps, pattern-based guides, company interview prep, spaced-repetition revision and AI tutoring.",
  twitter: "@dsaspire",
  locale: "en_US",
  defaultOg: "/opengraph-image",
} as const;

/** True on preview/staging so metadata forces noindex. */
export const IS_NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === "1";

export type BuildMeta = {
  title: string;
  description: string;
  /** Canonical path, e.g. "/topics/arrays". */
  path: string;
  images?: string[];
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  keywords?: string[];
};

/** Build a full `Metadata` object (canonical + OG + Twitter + robots). */
export function buildMetadata(m: BuildMeta): Metadata {
  const url = new URL(m.path, SITE.url).toString();
  const images = m.images?.length ? m.images : [SITE.defaultOg];
  const noindex = m.noindex || IS_NOINDEX;

  return {
    title: m.title,
    description: m.description,
    keywords: m.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: m.type ?? "website",
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      title: m.title,
      description: m.description,
      images,
      ...(m.publishedTime && { publishedTime: m.publishedTime }),
      ...(m.modifiedTime && { modifiedTime: m.modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      site: SITE.twitter,
      creator: SITE.twitter,
      title: m.title,
      description: m.description,
      images,
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
