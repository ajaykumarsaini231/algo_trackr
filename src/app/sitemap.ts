import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Lists only the currently PUBLIC, crawlable pages. Topic/pattern/company
 * detail URLs and the 15k problem pages are added here once their public
 * server-rendered versions ship (see docs/blueprint/07-seo.md §4). Keeping the
 * sitemap honest avoids "Page with redirect" noise in Search Console.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (
    path: string,
    priority = 0.6,
    changeFrequency: Entry["changeFrequency"] = "weekly",
  ): Entry => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    u("/", 1, "daily"),
    u("/topics", 0.9),
    u("/algorithm-patterns", 0.8),
    u("/companies", 0.8),
    u("/sheets", 0.8),
    u("/roadmaps", 0.8),
    u("/patterns", 0.7),
    u("/about", 0.6),
    u("/contact", 0.5),
  ];
}
