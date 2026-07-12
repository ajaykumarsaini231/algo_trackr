import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "DSA Sheets — Blind 75, Striver A2Z & More",
  description:
    "Practice the most trusted curated DSA sheets — Blind 75, Striver A2Z, and topic-wise sheets for DP, graphs and trees — to structure your coding-interview preparation.",
  path: "/sheets",
  keywords: ["blind 75", "striver a2z sheet", "dsa sheet", "best dsa sheet", "sde sheet"],
});

export default function SheetsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>;
}
