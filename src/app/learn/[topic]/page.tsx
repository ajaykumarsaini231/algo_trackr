"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { slugify } from "@/lib/utils";
import { useTopicLearning } from "@/hooks/use-topic-learning";
import type { StageQuestion, TopicLearning, TopicLearningAll } from "@/lib/learning";

function QRow({ q }: { q: StageQuestion }) {
  const done = q.status === "Solved";
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name={done ? "CheckCircle2" : "Circle"} className={`h-4 w-4 shrink-0 ${done ? "text-emerald-500" : "text-muted-foreground/40"}`} />
        <div className="min-w-0">
          <a href={q.problemLink || undefined} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary hover:underline">{q.title}</a>
          <p className="text-xs text-muted-foreground">{q.topic} · {q.platform} · ~{q.estimatedSolveTime}m{q.favorite ? " · ★" : ""}</p>
        </div>
      </div>
      <Badge variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "destructive"}>{q.difficulty}</Badge>
    </li>
  );
}

export default function TopicLearnPage() {
  const { topic: slug } = useParams<{ topic: string }>();
  const [reveal, setReveal] = React.useState(1);
  const [viewAll, setViewAll] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, error } = useTopicLearning(slug, { reveal, viewAll, page });

  const isAll = data && "mode" in data && data.mode === "all";
  const staged = !isAll ? (data as TopicLearning | undefined) : undefined;
  const all = isAll ? (data as TopicLearningAll) : undefined;

  // Continue Learning target: first unsolved question of the current unlocked stage.
  const continueQ = React.useMemo(() => {
    if (!staged) return null;
    for (const s of staged.stages) if (s.unlocked && !s.completed) {
      const q = s.questions.find((x) => x.status !== "Solved");
      if (q) return q;
    }
    return null;
  }, [staged]);

  return (
    <div>
      <PageHeader
        title={data?.topic || "Topic"}
        description="A guided path — finish each small stage to unlock the next."
        icon={<Icon name="Gauge" className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/learn"><Icon name="ArrowLeftRight" className="mr-1 h-4 w-4" /> Learn</Link></Button>
            <Button variant={viewAll ? "default" : "outline"} size="sm" onClick={() => { setViewAll((v) => !v); setPage(1); }}>
              {viewAll ? "Staged view" : "View Complete Topic"}
            </Button>
          </div>
        }
      />

      {isError && <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">{error?.message || "Failed to load."}</CardContent></Card>}
      {isLoading && !data && <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />}

      {/* Staged view */}
      {staged && (
        <div className="space-y-5">
          <Card glass>
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold tabular-nums">{staged.solved}/{staged.total} <span className="text-base font-normal text-muted-foreground">· {staged.completionPct}%</span></p>
              </div>
              <div><p className="text-xs text-muted-foreground">Current</p><p className="text-lg font-semibold">{staged.currentLevel}</p></div>
              <div><p className="text-xs text-muted-foreground">Questions left</p><p className="text-lg font-semibold tabular-nums">{staged.remaining.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Est. time remaining</p><p className="text-lg font-semibold tabular-nums">{Math.round(staged.estimatedTimeRemaining / 60)}h</p></div>
              <div className="min-w-[140px] flex-1"><Progress value={staged.completionPct} className="h-2" /></div>
            </CardContent>
          </Card>

          {staged.completed ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-6">
                <p className="flex items-center gap-2 text-lg font-semibold text-emerald-600 dark:text-emerald-400"><Icon name="Trophy" className="h-5 w-5" /> Topic Completed!</p>
                <p className="mt-1 text-sm text-muted-foreground">Great work. Keep the momentum going:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {staged.recommendations.nextTopic && (
                    <Button asChild size="sm"><Link href={`/learn/${slugify(staged.recommendations.nextTopic)}`}>Next: {staged.recommendations.nextTopic}</Link></Button>
                  )}
                  <Button asChild size="sm" variant="outline"><Link href={`/sheets/${staged.recommendations.relatedSheet}`}>Related sheet</Link></Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {continueQ && (
                <Button asChild><a href={continueQ.problemLink || undefined} target="_blank" rel="noreferrer"><Icon name="Zap" className="mr-1 h-4 w-4" /> Continue Learning</a></Button>
              )}
              {staged.canLoadMore ? (
                <Button variant="outline" onClick={() => setReveal((r) => r + 1)}>Load More <Icon name="ArrowRightLeft" className="ml-1 h-4 w-4" /></Button>
              ) : staged.revealedStages < staged.totalStages ? (
                <Button variant="outline" disabled>Complete this stage (≥80%) to unlock the next</Button>
              ) : null}
            </div>
          )}

          {staged.stages.map((s) => (
            <Card glass key={s.index}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {!s.unlocked && <Icon name="ShieldCheck" className="h-4 w-4 text-muted-foreground" />}
                    {s.label}
                  </CardTitle>
                  <Badge variant={s.completed ? "success" : s.unlocked ? "info" : "muted"}>
                    {s.completed ? "Completed" : s.unlocked ? `${s.solved}/${s.total} · ${s.completionPct}%` : "Locked"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {s.unlocked ? (
                  <ul className="divide-y divide-border/60">{s.questions.map((q) => <QRow key={q.id} q={q} />)}</ul>
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">🔒 Complete the previous stage (≥80%) to unlock these questions.</p>
                )}
              </CardContent>
            </Card>
          ))}

          <p className="text-center text-xs text-muted-foreground">
            Stage {staged.revealedStages} of {staged.totalStages} · {staged.total.toLocaleString()} questions in this topic
          </p>
        </div>
      )}

      {/* View All */}
      {all && (
        <Card glass>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All {all.topic} Questions</CardTitle>
            <CardDescription>{all.total.toLocaleString()} questions · advanced view</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">{all.questions.map((q) => <QRow key={q.id} q={q} />)}</ul>
            {all.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Page {all.page} of {all.totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page >= all.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
