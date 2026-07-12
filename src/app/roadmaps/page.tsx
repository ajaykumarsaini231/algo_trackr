import Link from "next/link";
import type { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = buildMetadata({
  title: "DSA Roadmaps — Step-by-Step Paths to Interview-Ready",
  description:
    "Follow curated DSA roadmaps from beginner foundations to FAANG interview readiness. Structured, step-by-step learning paths across data structures, algorithms and patterns.",
  path: "/roadmaps",
  keywords: ["dsa roadmap", "coding interview roadmap", "faang preparation roadmap", "how to learn dsa"],
});

type Step = { label: string; href: string };
type Roadmap = { slug: string; title: string; level: string; description: string; steps: Step[] };

const ROADMAPS: Roadmap[] = [
  {
    slug: "dsa-foundations",
    title: "DSA Foundations",
    level: "Beginner",
    description:
      "Start here if you're new to DSA. Build the core data structures and problem-solving instincts before moving to advanced topics.",
    steps: [
      { label: "Arrays", href: "/topics/arrays" },
      { label: "Strings", href: "/topics/strings" },
      { label: "Recursion", href: "/topics/recursion" },
      { label: "Linked List", href: "/topics/linked-list" },
      { label: "Stack", href: "/topics/stack" },
      { label: "Queue", href: "/topics/queue" },
      { label: "Binary Search", href: "/topics/binary-search" },
    ],
  },
  {
    slug: "faang-interview-prep",
    title: "FAANG Interview Prep",
    level: "Intermediate → Advanced",
    description:
      "The high-frequency topics and patterns that dominate interviews at Google, Amazon, Microsoft, Meta and other top companies.",
    steps: [
      { label: "Arrays & Hashing", href: "/topics/arrays" },
      { label: "Two Pointers & Sliding Window", href: "/algorithm-patterns" },
      { label: "Trees", href: "/topics/trees" },
      { label: "Graphs", href: "/topics/graph" },
      { label: "Dynamic Programming", href: "/topics/dynamic-programming" },
      { label: "Heap / Priority Queue", href: "/topics/heap" },
      { label: "Greedy", href: "/topics/greedy" },
    ],
  },
  {
    slug: "dynamic-programming-mastery",
    title: "Dynamic Programming Mastery",
    level: "Advanced",
    description:
      "DP trips up more candidates than any other topic. Work through it systematically from memoization to advanced state design.",
    steps: [
      { label: "DP fundamentals", href: "/topics/dynamic-programming" },
      { label: "Patterns behind DP", href: "/algorithm-patterns" },
      { label: "Practice DP problems", href: "/topics/dynamic-programming" },
    ],
  },
  {
    slug: "graph-mastery",
    title: "Graph Mastery",
    level: "Advanced",
    description:
      "Traversals, shortest paths, connectivity and more — the graph toolkit that shows up in system-heavy interviews.",
    steps: [
      { label: "Graph fundamentals", href: "/topics/graph" },
      { label: "Trees", href: "/topics/trees" },
      { label: "Graph patterns", href: "/algorithm-patterns" },
    ],
  },
  {
    slug: "competitive-programming",
    title: "Competitive Programming",
    level: "Expert",
    description:
      "Go beyond interviews: number theory, bit tricks, geometry and the math that powers competitive contests.",
    steps: [
      { label: "Mathematics", href: "/topics/mathematics" },
      { label: "Number Theory", href: "/topics/number-theory" },
      { label: "Bit Manipulation", href: "/topics/bit-manipulation" },
      { label: "Geometry", href: "/topics/geometry" },
    ],
  },
];

export default function RoadmapsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
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
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Roadmaps</span>
      </nav>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">DSA Roadmaps</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Curated, step-by-step learning paths that take you from your first array problem to
        interview-ready. Pick the roadmap that matches your goal and follow it topic by topic.
      </p>

      <div className="mt-10 space-y-6">
        {ROADMAPS.map((r) => (
          <section
            key={r.slug}
            id={r.slug}
            className="scroll-mt-20 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary">
                  {r.level}
                </div>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight">{r.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>
              </div>
            </div>

            <ol className="mt-5 flex flex-wrap items-center gap-2">
              {r.steps.map((s, i) => (
                <li key={s.href + i} className="flex items-center gap-2">
                  <Link
                    href={s.href}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {i + 1}. {s.label}
                  </Link>
                  {i < r.steps.length - 1 && (
                    <span className="text-muted-foreground/50" aria-hidden>→</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
