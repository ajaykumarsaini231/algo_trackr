"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookMarked,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  FileText,
  FolderTree,
  GraduationCap,
  Layers,
  LayoutGrid,
  ListChecks,
  Lock,
  Newspaper,
  PlayCircle,
  Puzzle,
  Rocket,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  Trophy,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { useStats } from "@/hooks/use-stats";
import { slugify, cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem, GradientBackground } from "@/components/motion";
import { ROADMAPS, type Roadmap, type RoadmapLevel } from "./data";

const LEVEL_STYLE: Record<RoadmapLevel, string> = {
  Beginner: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  Advanced: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  Expert: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

const RESOURCE_ICON: Record<string, LucideIcon> = {
  Notes: FileText,
  "Video Playlist": PlayCircle,
  Articles: Newspaper,
  "Practice Sheets": BookMarked,
  "Company Questions": Building2,
};

/** Roadmap header icons (data icon-name → lucide component). */
const ICONS: Record<string, LucideIcon> = {
  Sprout,
  Rocket,
  Grid3x3: LayoutGrid,
  Waypoints,
  Trophy,
};

const EASE = [0.22, 1, 0.36, 1] as const;

function StatPill({ icon: I, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium">
      <I className="h-3.5 w-3.5 text-primary" />
      {children}
    </div>
  );
}

function DetailSection({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{emoji}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BulletList({ items, check = false }: { items: string[]; check?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
          {check ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
          )}
          {it}
        </li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span key={c} className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium">
          {c}
        </span>
      ))}
    </div>
  );
}

function RoadmapCard({
  r,
  progress,
  signedIn,
}: {
  r: Roadmap;
  progress: number;
  signedIn: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const glowRef = React.useRef<HTMLDivElement>(null);
  const startHref = r.topics[0] ? `/topics/${r.topics[0].slug}` : "/topics";
  const HeaderIcon = ICONS[r.icon] ?? Sparkles;

  function onMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(600px circle at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, hsl(var(--primary) / 0.07), transparent 40%)`;
      glowRef.current.style.opacity = "1";
    }
  }
  function onLeave() {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  }

  return (
    <StaggerItem>
      <article
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
      >
        {/* gradient accent + mouse glow */}
        <div className={cn("h-1 w-full bg-gradient-to-r", r.accent)} />
        <div ref={glowRef} aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", r.accent)}>
                <HeaderIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{r.title}</h2>
                <p className="text-sm text-muted-foreground">{r.tagline}</p>
              </div>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold", LEVEL_STYLE[r.level])}>
              {r.level}
            </span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{r.description}</p>

          {/* Stat pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            <StatPill icon={FolderTree}>{r.topicCount} Topics</StatPill>
            <StatPill icon={Puzzle}>{r.problemCount} Problems</StatPill>
            <StatPill icon={Code2}>{r.leetcodeCount} LeetCode</StatPill>
            <StatPill icon={Layers}>{r.moduleCount} Modules</StatPill>
            <StatPill icon={Clock}>{r.durationWeeks} wks · {r.estimatedHours}h</StatPill>
          </div>

          {/* Completion progress */}
          <div className="mt-5">
            {signedIn ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Your progress</span>
                  <span className="font-semibold tabular-nums">{progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${progress}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: EASE }}
                    className={cn("h-full rounded-full bg-gradient-to-r", r.accent)}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <Link href={`/signin?callbackUrl=/roadmaps`} className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
                to track your completion progress.
              </div>
            )}
          </div>

          {/* Covers */}
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> COVERS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.covers.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={startHref} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md">
              Start Roadmap <ArrowRight className="h-4 w-4" />
            </Link>
            {signedIn && (
              <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
                Continue Learning
              </Link>
            )}
            <Link href="/topics" className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
              View All Topics
            </Link>
            <Link href={startHref} className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
              Practice Problems
            </Link>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {open ? "Hide learning guide" : "View full learning guide"}
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
          </button>
        </div>

        {/* Collapsible detail — kept in the DOM (crawlable) and animated open/closed */}
        <motion.div
          initial={false}
          animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
          aria-hidden={!open}
        >
              <div className="grid gap-4 border-t border-border/70 p-6 pt-6 md:grid-cols-2">
                <DetailSection emoji="✅" title="Prerequisites">
                  <BulletList items={r.prerequisites} />
                </DetailSection>
                <DetailSection emoji="🎯" title="What You'll Learn">
                  <BulletList items={r.whatYoullLearn} />
                </DetailSection>
                <DetailSection emoji="💼" title="Best For">
                  <Chips items={r.bestFor} />
                </DetailSection>
                <DetailSection emoji="📈" title="Learning Outcomes">
                  <BulletList items={r.learningOutcomes} check />
                </DetailSection>
                <DetailSection emoji="🛠" title="Recommended Resources">
                  <div className="flex flex-wrap gap-1.5">
                    {r.resources.map((res) => {
                      const RI = RESOURCE_ICON[res] ?? BookMarked;
                      return (
                        <span key={res} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium">
                          <RI className="h-3.5 w-3.5 text-primary" />
                          {res}
                        </span>
                      );
                    })}
                  </div>
                </DetailSection>
                <DetailSection emoji="🏢" title="Companies Covered">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.companies.map((name) => (
                      <Link
                        key={name}
                        href={`/companies/${slugify(name)}`}
                        title={name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-2.5 text-xs font-medium transition-colors hover:border-primary/40"
                      >
                        <CompanyAvatar name={name} size={20} />
                        {name}
                      </Link>
                    ))}
                  </div>
                </DetailSection>
                <DetailSection emoji="📊" title="Roadmap Statistics">
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    {[
                      { icon: FolderTree, label: "Topics", value: String(r.topicCount) },
                      { icon: Puzzle, label: "Problems", value: String(r.problemCount) },
                      { icon: Clock, label: "Est. hours", value: `${r.estimatedHours}h` },
                      { icon: GraduationCap, label: "Difficulty", value: r.level },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2.5 rounded-lg bg-muted/50 p-2.5">
                        <s.icon className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-sm font-semibold tabular-nums">{s.value}</div>
                          <div className="text-[11px] text-muted-foreground">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completion rate</span>
                      <span className="font-semibold tabular-nums">{r.completionRate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full bg-gradient-to-r", r.accent)} style={{ width: `${r.completionRate}%` }} />
                    </div>
                  </div>
                </DetailSection>
              </div>
        </motion.div>
      </article>
    </StaggerItem>
  );
}

export function RoadmapsContent() {
  const { stats } = useStats();
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const byTopic = React.useMemo(
    () => new Map((stats?.byTopic ?? []).map((t) => [t.topic, t])),
    [stats],
  );

  function progressFor(r: Roadmap): number {
    let total = 0;
    let solved = 0;
    for (const t of r.topics) {
      const s = byTopic.get(t.name);
      if (s) {
        total += s.total;
        solved += s.solved;
      }
    }
    return total > 0 ? Math.round((solved / total) * 100) : 0;
  }

  return (
    <div className="relative overflow-x-hidden">
      <GradientBackground />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
            Structured learning paths
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">DSA Roadmaps</h1>
          <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            Complete learning guides — not just topic lists. Each roadmap shows what you&apos;ll
            learn, what you need first, and exactly what you&apos;ll achieve, with curated problems
            and company-tagged practice.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> {ROADMAPS.length} roadmaps</span>
            <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary" /> Beginner → Expert</span>
            <span className="inline-flex items-center gap-1.5"><Puzzle className="h-4 w-4 text-primary" /> 900+ curated problems</span>
          </div>
        </Reveal>

        <Stagger className="mt-10 space-y-6">
          {ROADMAPS.map((r) => (
            <RoadmapCard key={r.slug} r={r} progress={progressFor(r)} signedIn={signedIn} />
          ))}
        </Stagger>
      </div>
    </div>
  );
}
