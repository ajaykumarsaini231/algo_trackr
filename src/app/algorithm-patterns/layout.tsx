import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Algorithm Patterns — Master 160+ Coding Patterns",
  description:
    "A complete catalog of 160+ algorithm patterns for coding interviews and competitive programming — when to use each, recognition cues, complexity and common mistakes.",
  path: "/algorithm-patterns",
  keywords: ["algorithm patterns", "coding patterns", "dsa patterns list", "interview patterns", "competitive programming"],
});

export default function AlgorithmPatternsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>;
}
