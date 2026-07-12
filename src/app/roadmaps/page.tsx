import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, itemListSchema, courseSchema } from "@/lib/schema";
import { ROADMAPS } from "./data";
import { RoadmapsContent } from "./roadmaps-content";

export const metadata: Metadata = buildMetadata({
  title: "DSA Roadmaps — Complete Step-by-Step Learning Guides",
  description:
    "Follow complete DSA learning roadmaps from beginner to FAANG-ready. Each guide shows prerequisites, what you'll learn, topics, curated LeetCode problems, companies covered and outcomes.",
  path: "/roadmaps",
  keywords: [
    "dsa roadmap",
    "coding interview roadmap",
    "faang preparation roadmap",
    "dynamic programming roadmap",
    "how to learn dsa",
    "dsa learning path",
  ],
});

export default function RoadmapsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Roadmaps", path: "/roadmaps" },
          ]),
          itemListSchema(
            ROADMAPS.map((r) => ({ name: r.title, path: `/roadmaps#${r.slug}` })),
            "DSA Roadmaps",
          ),
          ...ROADMAPS.map((r) =>
            courseSchema({
              name: r.title,
              description: r.description,
              path: `/roadmaps#${r.slug}`,
            }),
          ),
        ]}
      />
      <RoadmapsContent />
    </>
  );
}
