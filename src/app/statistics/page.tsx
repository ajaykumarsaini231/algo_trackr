"use client";

import { BarChart3, CalendarClock, Flame } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ProgressRing } from "@/components/charts/progress-ring";
import dynamic from "next/dynamic";
import { ProgressBars } from "@/components/charts/progress-bars";
import { Heatmap } from "@/components/charts/heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { useStats } from "@/hooks/use-stats";
import { DIFFICULTY_CHART_COLORS, STATUS_STYLES } from "@/lib/constants";
import { cn, slugify } from "@/lib/utils";
import type { Status } from "@/types";

// recharts is heavy; load these chart chunks only when they mount (kept out of
// the route's initial JS). ssr:false is safe — this is a client page on SWR.
const DonutChart = dynamic(() => import("@/components/charts/donut-chart").then((m) => m.DonutChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const MonthlyChart = dynamic(() => import("@/components/charts/monthly-chart").then((m) => m.MonthlyChart), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export default function StatisticsPage() {
  const { stats, isLoading, isError } = useStats();

  if (isError) {
    return (
      <div>
        <PageHeader title="Statistics" icon={<BarChart3 className="h-5 w-5" />} />
        <EmptyState title="Couldn't load statistics" description="Check your database connection and refresh." />
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div>
        <PageHeader title="Statistics" icon={<BarChart3 className="h-5 w-5" />} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const donutData = [
    { name: "Easy", value: stats.byDifficulty.Easy, color: DIFFICULTY_CHART_COLORS.Easy },
    { name: "Medium", value: stats.byDifficulty.Medium, color: DIFFICULTY_CHART_COLORS.Medium },
    { name: "Hard", value: stats.byDifficulty.Hard, color: DIFFICULTY_CHART_COLORS.Hard },
  ];

  const topicBars = [...stats.byTopic]
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((t) => ({ label: t.topic, total: t.total, solved: t.solved, href: `/topics/${slugify(t.topic)}` }));

  const companyBars = [...stats.byCompany]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ label: c.company, total: c.total, solved: c.solved, href: `/companies/${slugify(c.company)}` }));

  const patternBars = [...stats.byPattern]
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((p) => ({ label: p.pattern, total: p.total, solved: p.solved, href: `/patterns/${slugify(p.pattern)}` }));

  const statusEntries = Object.entries(stats.byStatus) as [Status, number][];

  return (
    <div>
      <PageHeader
        title="Statistics"
        description="Deep insight into your progress, coverage, and consistency."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {/* Overview */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card glass className="flex flex-col items-center justify-center p-6">
          <CardTitle className="mb-4 text-base">Overall completion</CardTitle>
          <ProgressRing value={stats.completionPercentage} label={`${stats.solved}/${stats.total}`} sublabel="solved" />
        </Card>

        <Card glass className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Status distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {statusEntries.map(([status, count]) => (
              <div
                key={status}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  STATUS_STYLES[status],
                )}
              >
                <span className="font-semibold tabular-nums">{count}</span>
                <span className="text-xs opacity-90">{status}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-amber-500">
              <CalendarClock className="h-4 w-4" />
              <span className="text-sm font-semibold">{stats.revisionDue}</span>
              <span className="text-xs">revision due</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly + Difficulty */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card glass className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly progress</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={stats.monthlyProgress} />
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Difficulty distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={donutData} />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card glass className="mb-4">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Flame className="h-4 w-4 text-orange-500" />
          <CardTitle className="text-base">Activity heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap data={stats.heatmap} />
        </CardContent>
      </Card>

      {/* Coverage grids */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Topic-wise progress</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto">
            <ProgressBars data={topicBars} emptyLabel="No topics tracked yet" />
          </CardContent>
        </Card>

        <Card glass>
          <CardHeader>
            <CardTitle className="text-base">Pattern coverage</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto">
            <ProgressBars
              data={patternBars}
              emptyLabel="No patterns tracked yet"
              colorClass="bg-gradient-to-r from-cyan-500 to-blue-500"
            />
          </CardContent>
        </Card>

        <Card glass className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Company coverage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
            <ProgressBars
              data={companyBars}
              emptyLabel="No company tags yet"
              colorClass="bg-gradient-to-r from-orange-500 to-amber-500"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
