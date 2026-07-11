"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { usePatterns } from "@/hooks/use-patterns";
import type { PatternPriority, PatternStat } from "@/lib/patterns";

const PRIORITY_VARIANT: Record<PatternPriority, "destructive" | "warning" | "info" | "muted"> = {
  Critical: "destructive", High: "warning", Medium: "info", Low: "muted",
};
const PRIORITY_DOT: Record<PatternPriority, string> = {
  Critical: "bg-rose-500", High: "bg-amber-500", Medium: "bg-blue-500", Low: "bg-slate-400",
};

function PatternCard({ p }: { p: PatternStat }) {
  return (
    <Link
      href={`/algorithm-patterns/${p.slug}`}
      className="group rounded-lg border bg-card/50 p-3 transition-colors hover:border-primary/40 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[p.priority]}`} />
          <span className="truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{p.total.toLocaleString()}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={p.completionPct} className="h-1.5" />
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{p.completionPct}%</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>E {p.easy} · M {p.medium} · H {p.hard}</span>
        <span>LC {p.leetcode} · CF {p.codeforces}</span>
      </div>
    </Link>
  );
}

export default function AlgorithmPatternsPage() {
  const { dashboard, isLoading, isError, error } = usePatterns();

  return (
    <div>
      <PageHeader
        title="Algorithm Patterns"
        description="Every question is classified into one or more patterns. Counts are live from MongoDB."
        icon={<Icon name="Cpu" className="h-6 w-6" />}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}
        </div>
      )}
      {isError && (
        <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">
          Couldn&apos;t load patterns: {error?.message || "unknown error"}.
        </CardContent></Card>
      )}

      {dashboard && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Patterns" value={dashboard.totalPatterns} icon="Cpu" accent="violet" hint={`${dashboard.categories.length} categories`} />
            <StatCard label="Classified Questions" value={dashboard.summary.classified} icon="CheckCircle2" accent="emerald" hint={`of ${dashboard.summary.totalQuestions.toLocaleString()}`} />
            <StatCard label="Pattern Assignments" value={dashboard.totalAssignments} icon="Boxes" accent="indigo" hint={`${dashboard.summary.avgPatternsPerQuestion} per question`} />
            <StatCard label="Most Used" value={dashboard.mostUsed[0]?.total || 0} icon="Flame" accent="amber" hint={dashboard.mostUsed[0]?.name} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card glass>
              <CardHeader><CardTitle className="flex items-center gap-2"><Icon name="Flame" className="h-4 w-4 text-amber-500" /> Most Used Patterns</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {dashboard.mostUsed.map((p) => (
                  <Link key={p.slug} href={`/algorithm-patterns/${p.slug}`} className="flex items-center justify-between text-sm hover:text-primary">
                    <span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.total.toLocaleString()}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card glass>
              <CardHeader><CardTitle className="flex items-center gap-2"><Icon name="SignalLow" className="h-4 w-4 text-slate-400" /> Least Used Patterns</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {dashboard.leastUsed.map((p) => (
                  <Link key={p.slug} href={`/algorithm-patterns/${p.slug}`} className="flex items-center justify-between text-sm hover:text-primary">
                    <span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.total.toLocaleString()}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {dashboard.categories.map((c) => (
            <Card glass key={c.categorySlug}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    {c.category}
                    <Badge variant={PRIORITY_VARIANT[c.priority]}>{c.priority}</Badge>
                  </span>
                  <span className="text-sm font-normal tabular-nums text-muted-foreground">{c.total.toLocaleString()} questions</span>
                </CardTitle>
                <CardDescription>{c.patterns.length} patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {c.patterns.map((p) => <PatternCard key={p.slug} p={p} />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
