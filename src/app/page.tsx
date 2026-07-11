"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Database, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RecentQuestions } from "@/components/dashboard/recent-questions";
import { Heatmap } from "@/components/charts/heatmap";
import { ProgressBars } from "@/components/charts/progress-bars";
import { Button } from "@/components/ui/button";
import { StatGridSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/use-stats";
import { DIFFICULTY_DOT, DIFFICULTY_CHART_COLORS } from "@/lib/constants";
import { cn, slugify } from "@/lib/utils";
import { DIFFICULTIES } from "@/types";

// Lazy-load the recharts donut so recharts stays out of the dashboard's initial JS.
const DonutChart = dynamic(
  () => import("@/components/charts/donut-chart").then((m) => m.DonutChart),
  { ssr: false, loading: () => <Skeleton className="mx-auto h-[150px] w-[150px] rounded-full" /> },
);

/** Current streak (run of active days ending today/yesterday) and longest run. */
function computeStreaks(days: { date: string; count: number }[]) {
  let max = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > max) max = run;
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i]!.count === 0) i--; // today hasn't broken the streak yet
  for (; i >= 0 && days[i]!.count > 0; i--) current++;
  return { current, max };
}

function OverviewStat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className={cn("h-full bg-card px-4 py-3.5", href && "transition-colors hover:bg-accent/50")}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {value.toLocaleString()}
        </span>
        {sub && <span className="text-xs tabular-nums text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function DashboardPage() {
  const { stats, isLoading, isError } = useStats();

  const topicProgress = stats
    ? [...stats.byTopic]
        .filter((t) => t.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((t) => ({
          label: t.topic,
          total: t.total,
          solved: t.solved,
          href: `/topics/${slugify(t.topic)}`,
        }))
    : [];

  const streaks = stats ? computeStreaks(stats.heatmap) : { current: 0, max: 0 };
  const isEmpty = !isLoading && stats && stats.total === 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your DSA progress at a glance."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/statistics">
              View statistics <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isError && (
        <EmptyState
          icon={<Database className="h-7 w-7" />}
          title="Couldn't reach the database"
          description="Make sure MongoDB is running and MONGODB_URI is set in .env.local, then refresh."
        />
      )}

      {!isError && isLoading && (
        <div className="space-y-6">
          <StatGridSkeleton count={6} />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" />}
          title="Welcome! Your tracker is empty"
          description="Set up the Admin Panel with your 8-digit key, then add questions or load the sample set to explore everything."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/admin">Open Admin Panel</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/topics">Browse topics</Link>
              </Button>
            </div>
          }
        />
      )}

      {!isError && !isLoading && stats && stats.total > 0 && (
        <div className="space-y-4">
          {/* Progress overview */}
          <section className="overflow-hidden rounded-lg border bg-border">
            <h2 className="sr-only">Progress overview</h2>
            <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6">
              <OverviewStat label="Total questions" value={stats.total} href="/search" />
              <OverviewStat
                label="Solved"
                value={stats.solved}
                sub={`${stats.completionPercentage}%`}
              />
              <OverviewStat label="Attempted" value={stats.attempted} />
              <OverviewStat label="Unsolved" value={stats.unsolved} />
              <OverviewStat label="Revision due" value={stats.revisionNeeded} href="/revision" />
              <OverviewStat label="Favorites" value={stats.favorites} href="/favorites" />
            </div>
            <div className="space-y-2.5 border-t bg-card px-4 py-4 sm:px-5">
              {DIFFICULTIES.map((d) => {
                const total = stats.byDifficulty[d];
                const solved = stats.solvedByDifficulty[d];
                const pct = total ? Math.round((solved / total) * 100) : 0;
                return (
                  <div key={d} className="flex items-center gap-3">
                    <span className="flex w-20 shrink-0 items-center gap-2 text-[13px] font-medium">
                      <span className={cn("h-2 w-2 rounded-full", DIFFICULTY_DOT[d])} />
                      {d}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", DIFFICULTY_DOT[d])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {solved.toLocaleString()} / {total.toLocaleString()} solved
                    </span>
                    <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Practice / revision / distribution */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="flex flex-col rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Continue practicing</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Pick up where you left off. Staged learning surfaces the next
                unsolved question for each topic.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <Button asChild size="sm">
                  <Link href="/learn">Start solving</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/topics">Browse topics</Link>
                </Button>
              </div>
            </section>

            <section className="flex flex-col rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Revision due today</h2>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {stats.revisionDue.toLocaleString()}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {stats.revisionDue === 0
                    ? "nothing due for review"
                    : "questions waiting for review"}
                </span>
              </div>
              <div className="mt-auto pt-4">
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href="/revision">
                    View revision <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Difficulty distribution</h2>
              <div className="mt-2">
                <DonutChart
                  height={150}
                  showLegend={false}
                  data={DIFFICULTIES.map((d) => ({
                    name: d,
                    value: stats.byDifficulty[d],
                    color: DIFFICULTY_CHART_COLORS[d],
                  }))}
                />
              </div>
              <ul className="mt-3 space-y-1.5">
                {DIFFICULTIES.map((d) => {
                  const count = stats.byDifficulty[d];
                  const share = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <li key={d} className="flex items-center gap-2 text-[13px]">
                      <span className={cn("h-2 w-2 rounded-full", DIFFICULTY_DOT[d])} />
                      <span className="font-medium">{d}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {count.toLocaleString()}
                        <span className="ml-1.5 inline-block w-9 text-right">({share}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[13px]">
                <span className="font-medium">Total</span>
                <span className="font-semibold tabular-nums">{stats.total.toLocaleString()}</span>
              </div>
            </section>
          </div>

          {/* Topics + activity */}
          <div className="grid gap-4 lg:grid-cols-5">
            <section className="rounded-lg border bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Topic progress</h2>
                <Link
                  href="/topics"
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  All topics
                </Link>
              </div>
              <ProgressBars data={topicProgress} emptyLabel="No topics tracked yet" />
            </section>

            <section className="rounded-lg border bg-card p-5 lg:col-span-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Activity</h2>
                  <p className="text-xs text-muted-foreground">
                    Questions solved over the last 6 months
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {streaks.current}
                    </span>{" "}
                    day current streak
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {streaks.max}
                    </span>{" "}
                    day max streak
                  </span>
                </div>
              </div>
              <Heatmap data={stats.heatmap} />
            </section>
          </div>

          {/* Recent activity */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RecentQuestions
              title="Recently added"
              questions={stats.recentlyAdded}
              emptyText="No questions added yet."
              dateField="createdAt"
              viewAllHref="/search"
            />
            <RecentQuestions
              title="Recently solved"
              questions={stats.recentlySolved}
              emptyText="No solved questions yet."
              dateField="solvedAt"
            />
          </div>
        </div>
      )}
    </div>
  );
}
