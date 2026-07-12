import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { TOPICS, PATTERNS, COMPANIES } from "@/lib/constants";
import { ALL_PATTERNS } from "@/lib/patterns";
import { slugify } from "@/lib/utils";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Sitemap sourced from the static taxonomy (topics, patterns, companies) — no
 * DB call, so it always builds. Problem-level URLs get added in Phase 1 once
 * the public problem pages ship (see docs/blueprint/07-seo.md §4).
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

  const core: Entry[] = [
    u("/", 1, "daily"),
    u("/topics", 0.9),
    u("/algorithm-patterns", 0.8),
    u("/patterns", 0.8),
    u("/companies", 0.8),
    u("/sheets", 0.8),
    u("/learn", 0.8),
  ];

  const topics = TOPICS.map((t) => u(`/topics/${t.slug}`, 0.7));
  const algoPatterns = ALL_PATTERNS.map((p) => u(`/algorithm-patterns/${p.slug}`, 0.7));
  const patterns = PATTERNS.map((p) => u(`/patterns/${slugify(p.name)}`, 0.6));
  const companies = COMPANIES.filter((c) => c !== "Others").map((c) =>
    u(`/companies/${slugify(c)}`, 0.6),
  );

  return [...core, ...topics, ...algoPatterns, ...patterns, ...companies];
}
