import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { TOPICS, COMPANIES } from "@/lib/constants";
import { ALL_PATTERNS } from "@/lib/patterns";

export const metadata: Metadata = buildMetadata({
  title: "About DSAspire — Free DSA & Interview Prep Platform",
  description:
    "Learn what DSAspire is, how it works and the methodology behind it: 15,000+ curated DSA problems, pattern-based learning, company interview prep, roadmaps and spaced-repetition revision.",
  path: "/about",
});

export default function AboutPage() {
  const topicCount = TOPICS.length;
  const patternCount = ALL_PATTERNS.length;
  const companyCount = COMPANIES.filter((c) => c !== "Others").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">About</span>
      </nav>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">About DSAspire</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        DSAspire is a free, structured platform for mastering Data Structures &amp;
        Algorithms and preparing for coding interviews at top technology companies.
      </p>

      <div className="prose-dsa mt-8 space-y-6 leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-foreground">Our mission</h2>
          <p className="mt-2">
            Interview preparation is often scattered across dozens of sites, playlists and
            spreadsheets. DSAspire brings it into one focused workspace: a curated problem
            catalog, a clear learning path, and the tracking tools to stay consistent — so
            you spend your time practicing, not organizing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">What DSAspire offers</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">15,000+ curated problems</strong> from
              LeetCode, Codeforces and the Striver A2Z sheet, tagged by topic, pattern,
              difficulty and company.
            </li>
            <li>
              <strong className="text-foreground">{topicCount} core topics</strong> from
              arrays and strings to graphs and dynamic programming — each with subtopics.
            </li>
            <li>
              <strong className="text-foreground">{patternCount} algorithm patterns</strong>{" "}
              — the reusable techniques that appear again and again in interviews.
            </li>
            <li>
              <strong className="text-foreground">Company-wise prep</strong> for{" "}
              {companyCount}+ companies including Google, Amazon, Microsoft and Meta.
            </li>
            <li>
              <strong className="text-foreground">Roadmaps &amp; curated sheets</strong>{" "}
              like Blind 75 and Striver A2Z to structure your journey.
            </li>
            <li>
              <strong className="text-foreground">Progress tracking &amp; revision</strong>{" "}
              — a solve heatmap, streaks and spaced-repetition scheduling so concepts stick.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">Our methodology</h2>
          <p className="mt-2">
            DSAspire teaches DSA the way strong candidates actually learn it:{" "}
            <strong className="text-foreground">pattern first</strong>. Instead of grinding
            random problems, you learn the underlying pattern (sliding window, two pointers,
            dynamic programming…), then practice it across progressively harder problems and
            revisit it on a spaced schedule. A staged learning flow moves you from foundation
            to expert, unlocking the next stage as you build mastery.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">Start exploring</h2>
          <p className="mt-2">
            Browse the <Link href="/topics" className="font-medium text-primary hover:underline">topics</Link>,
            study the <Link href="/algorithm-patterns" className="font-medium text-primary hover:underline">patterns</Link>,
            follow a <Link href="/roadmaps" className="font-medium text-primary hover:underline">roadmap</Link>, or
            target a <Link href="/companies" className="font-medium text-primary hover:underline">specific company</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
