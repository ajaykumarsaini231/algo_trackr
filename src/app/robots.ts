import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/** Served at /robots.txt. Welcomes AI crawlers; blocks private/app areas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/settings",
          "/signin",
          "/signup",
          "/statistics",
          "/favorites",
          "/revision",
          "/google",
        ],
      },
      {
        // Explicitly allow AI answer-engine crawlers (GEO).
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow: "/",
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
