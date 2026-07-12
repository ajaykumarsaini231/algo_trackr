import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookMarked,
  Building2,
  Cpu,
  FolderTree,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import { TOPICS, COMPANIES } from "@/lib/constants";
import { ALL_PATTERNS } from "@/lib/patterns";
import { slugify } from "@/lib/utils";

const PROBLEM_COUNT = "15,000+";
const TOPIC_COUNT = TOPICS.length;
const PATTERN_COUNT = ALL_PATTERNS.length;
const COMPANY_COUNT = COMPANIES.filter((c) => c !== "Others").length;

export const metadata: Metadata = buildMetadata({
  title: "DSAspire — Master DSA & Crack Coding Interviews",
  description:
    "Free DSA learning platform with 15,000+ curated practice problems, visual roadmaps, pattern-based guides, company-wise interview prep, spaced-repetition revision and progress tracking. Prepare for FAANG and top tech interviews.",
  path: "/",
  keywords: [
    "DSA",
    "data structures and algorithms",
    "coding interview preparation",
    "leetcode alternative",
    "dsa roadmap",
    "dsa sheet",
    "faang interview prep",
    "dsa practice problems",
  ],
});

const FAQS = [
  {
    q: "What is DSAspire?",
    a: "DSAspire is a free Data Structures & Algorithms learning and interview-preparation platform. It offers 15,000+ curated coding problems, visual learning roadmaps, pattern-based guides, company-wise interview prep, spaced-repetition revision and personal progress tracking to help you crack coding interviews at FAANG and other top tech companies.",
  },
  {
    q: "Is DSAspire free to use?",
    a: "Yes. DSAspire's core learning features — problem catalog, topics, patterns, company prep, roadmaps and sheets — are free to use.",
  },
  {
    q: "How many DSA problems and topics does DSAspire cover?",
    a: `DSAspire covers ${PROBLEM_COUNT} problems organized into ${TOPIC_COUNT} core topics, ${PATTERN_COUNT} algorithmic patterns and interview questions mapped to ${COMPANY_COUNT}+ companies including Google, Amazon, Microsoft and Meta.`,
  },
  {
    q: "How should I prepare for coding interviews with DSAspire?",
    a: "Follow a roadmap from foundation to expert, learn each topic and its patterns, practice curated sheets like Blind 75 and Striver A2Z, target specific companies, and use spaced-repetition revision to retain what you learn.",
  },
  {
    q: "Which companies does DSAspire help you prepare for?",
    a: "DSAspire maps problems to interview questions asked at Google, Amazon, Microsoft, Meta, Apple, Bloomberg, Uber and 40+ other top technology companies.",
  },
];

const EXPLORE = [
  { href: "/topics", icon: FolderTree, title: "Topics", desc: `All ${TOPIC_COUNT} DSA topics from arrays to dynamic programming, organized with subtopics.` },
  { href: "/algorithm-patterns", icon: Cpu, title: "Patterns", desc: `${PATTERN_COUNT} algorithmic patterns — the reusable techniques behind every interview problem.` },
  { href: "/companies", icon: Building2, title: "Companies", desc: `Company-wise interview prep for ${COMPANY_COUNT}+ top tech companies.` },
  { href: "/sheets", icon: BookMarked, title: "Sheets", desc: "Curated ladders like Blind 75 and Striver A2Z to structure your prep." },
  { href: "/roadmaps", icon: MapIcon, title: "Roadmaps", desc: "Step-by-step visual paths from beginner to interview-ready." },
  { href: "/about", icon: Sparkles, title: "About", desc: "How DSAspire works and the methodology behind the platform." },
];

const FEATURES = [
  { icon: TrendingUp, title: "Progress tracking", desc: "Track every problem you solve with a GitHub-style activity heatmap and streaks." },
  { icon: RotateCcw, title: "Spaced-repetition revision", desc: "Schedule reviews so hard-won concepts actually stick before your interview." },
  { icon: Target, title: "Company-targeted prep", desc: "Focus on the exact patterns and problems your target company asks." },
  { icon: MapIcon, title: "Progressive roadmaps", desc: "Move from foundation to expert with staged, unlockable learning paths." },
];

export default function HomePage() {
  const topTopics = TOPICS.slice(0, 12);
  const topCompanies = COMPANIES.filter((c) => c !== "Others").slice(0, 12);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([{ name: "Home", path: "/" }]),
          faqSchema(FAQS),
        ]}
      />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {PROBLEM_COUNT} problems · {TOPIC_COUNT} topics · {PATTERN_COUNT} patterns
        </div>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
          Master DSA &amp; crack coding interviews
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
          DSAspire is a free Data Structures &amp; Algorithms learning platform with{" "}
          {PROBLEM_COUNT} curated problems, visual roadmaps, pattern-based guides,
          company-wise interview prep and spaced-repetition revision — everything you
          need to prepare for FAANG and top tech interviews.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/topics"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start learning <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/roadmaps"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View roadmaps
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Platform stats" className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-4 py-10 sm:grid-cols-4">
          {[
            [PROBLEM_COUNT, "Practice problems"],
            [`${TOPIC_COUNT}`, "Core topics"],
            [`${PATTERN_COUNT}`, "Algorithm patterns"],
            [`${COMPANY_COUNT}+`, "Companies covered"],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What is DSAspire */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What is DSAspire?</h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          DSAspire is a structured, information-dense workspace for mastering Data
          Structures &amp; Algorithms and preparing for technical interviews. It brings
          together a large catalog of {PROBLEM_COUNT} problems (from LeetCode, Codeforces
          and the Striver A2Z sheet), organizes them by {TOPIC_COUNT} topics and{" "}
          {PATTERN_COUNT} patterns, and layers on learning roadmaps, curated sheets,
          company-wise interview prep, progress tracking and spaced-repetition revision.
          Whether you are a beginner starting arrays or an experienced engineer targeting
          FAANG, DSAspire gives you a clear path from foundation to interview-ready.
        </p>
      </section>

      {/* Explore */}
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Explore DSAspire</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE.map(({ href, icon: Icon, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 flex items-center gap-1.5 font-semibold group-hover:text-primary">
                {title}
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why learn with DSAspire</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular topics + companies (internal linking) */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Popular DSA topics</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {topTopics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/topics/${t.slug}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {t.name}
                </Link>
              ))}
              <Link href="/topics" className="rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:underline">
                All topics →
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Prepare by company</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {topCompanies.map((name) => (
                <Link
                  key={name}
                  href={`/companies/${slugify(name)}`}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {name}
                </Link>
              ))}
              <Link href="/companies" className="rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:underline">
                All companies →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
        <dl className="mt-6 divide-y divide-border">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-2 text-pretty leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to start?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Pick a topic, follow a roadmap, and track every problem you solve on the way to
            your next offer.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/topics"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Browse topics <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sheets"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-6 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Explore sheets
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
