import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "DSA Topics — Learn Data Structures & Algorithms",
  description:
    "Explore all core DSA topics — arrays, strings, linked lists, trees, graphs, dynamic programming and more — each with subtopics and curated practice problems for coding interviews.",
  path: "/topics",
  keywords: ["dsa topics", "data structures", "algorithms", "dsa syllabus", "learn dsa"],
});

export default function TopicsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>;
}
