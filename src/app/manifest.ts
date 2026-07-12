import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/**
 * Served at /manifest.webmanifest. Minimal installable PWA manifest.
 * TODO (Phase 4): add 192/512 PNG + maskable icons under /icons for full
 * install-prompt support on all platforms.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — Master DSA & Coding Interviews`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b12",
    theme_color: "#0b0b12",
    categories: ["education", "productivity"],
    icons: [
      { src: "/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
