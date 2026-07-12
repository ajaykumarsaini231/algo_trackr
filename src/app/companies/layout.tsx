import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Company-Wise DSA Interview Questions",
  description:
    "Prepare for coding interviews company by company. Practice the DSA questions and patterns most frequently asked at Google, Amazon, Microsoft, Meta and 40+ top tech companies.",
  path: "/companies",
  keywords: ["company wise interview questions", "google interview questions", "amazon dsa", "faang interview prep"],
});

export default function CompaniesLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>;
}
