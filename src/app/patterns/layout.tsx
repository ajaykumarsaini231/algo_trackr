import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "DSA Interview Patterns — Solve Any Problem",
  description:
    "Master the core coding-interview patterns — sliding window, two pointers, binary search, DFS/BFS, dynamic programming and more — the reusable techniques behind every DSA problem.",
  path: "/patterns",
  keywords: ["dsa patterns", "coding interview patterns", "sliding window", "two pointers", "problem solving patterns"],
});

export default function PatternsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>;
}
