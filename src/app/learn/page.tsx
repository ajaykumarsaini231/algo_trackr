"use client";

import * as React from "react";
import Link from "next/link";
import { slugify } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { fetcher } from "@/lib/api-client";
import { useLearn } from "@/hooks/use-learn";
import type { LearningStageStat, RankedQuestion, RoadmapItem } from "@/lib/learning";

const ACCENT: Record<string, string> = {
  emerald: "text-emerald-500 bg-emerald-500/15", blue: "text-blue-500 bg-blue-500/15",
  amber: "text-amber-500 bg-amber-500/15", rose: "text-rose-500 bg-rose-500/15",
};

function QuestionRow({ q }: { q: RankedQuestion }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <a href={q.problemLink || undefined} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary hover:underline">{q.title}</a>
        <p className="text-xs text-muted-foreground">{q.topic} · {q.platform}{q.favorite ? " · ★" : ""}</p>
      </div>
      <Badge variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "destructive"}>{q.difficulty}</Badge>
    </li>
  );
}

function RoadmapList({ items, hrefFor }: { items: RoadmapItem[]; hrefFor?: (r: RoadmapItem) => string }) {
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === "done" ? "bg-emerald-500" : r.status === "current" ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/30"}`} />
          {hrefFor ? (
            <Link href={hrefFor(r)} className="w-40 shrink-0 truncate text-sm hover:text-primary hover:underline">{r.name}</Link>
          ) : (
            <span className="w-40 shrink-0 truncate text-sm">{r.name}</span>
          )}
          <Progress value={r.completionPct} className="h-1.5" />
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.solved}/{r.total}</span>
        </div>
      ))}
    </div>
  );
}

export default function LearnPage() {
  const [stage, setStage] = React.useState<string | undefined>(undefined);
  const { overview, isLoading, isError, error } = useLearn(stage);

  const [extra, setExtra] = React.useState<RankedQuestion[]>([]);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const cl = overview?.continueLearning;
  // Reset appended items when the active stage changes.
  React.useEffect(() => { setExtra([]); }, [cl?.stage]);

  const items = [...(cl?.items || []), ...extra];
  const hasMore = cl ? items.length < cl.total : false;

  async function loadMore() {
    if (!cl) return;
    setLoadingMore(true);
    try {
      const data = await fetcher<{ continueLearning: { items: RankedQuestion[] } }>(
        `/api/learn?section=continue&stage=${cl.stage}&skip=${items.length}&limit=12`,
      );
      setExtra((e) => [...e, ...data.continueLearning.items]);
    } finally {
      setLoadingMore(false);
    }
  }

  const activeStage = stage || overview?.currentStage;

  return (
    <div>
      <PageHeader
        title="Learn"
        description="A progressive, adaptive path — solve the highest-priority questions at your level and unlock the next stage."
        icon={<Icon name="Gauge" className="h-6 w-6" />}
      />

      {isError && (
        <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">{error?.message || "Failed to load."}</CardContent></Card>
      )}
      {isLoading && !overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}</div>
      )}

      {overview && (
        <div className="space-y-6">
          {/* Stages */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.stages.map((s: LearningStageStat) => {
              const selected = s.key === activeStage;
              return (
                <button
                  key={s.key}
                  disabled={!s.unlocked}
                  onClick={() => setStage(s.key)}
                  className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"} ${s.unlocked ? "bg-card/50 hover:bg-card" : "cursor-not-allowed bg-muted/30 opacity-70"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ACCENT[s.accent] || ""}`}><Icon name={s.icon} className="h-4 w-4" /></div>
                    {!s.unlocked && <Icon name="ShieldCheck" className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.solved}/{s.total} · {s.completionPct}%</p>
                  <Progress value={s.completionPct} className="mt-2 h-1.5" />
                  {!s.unlocked && <p className="mt-1.5 text-[11px] text-muted-foreground">Solve {s.unlockThreshold} in the previous stage to unlock ({s.prevStageSolved}/{s.unlockThreshold}).</p>}
                </button>
              );
            })}
          </div>

          {/* Continue learning */}
          <Card glass>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Icon name="Zap" className="h-4 w-4 text-amber-500" /> Continue Learning</CardTitle>
              <CardDescription>Highest learning-priority unsolved questions in the {activeStage} stage.</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing left here — great work! Pick another stage above.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">{items.map((q) => <QuestionRow key={q.id} q={q} />)}</ul>
                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? "Loading…" : "Load More"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Mixed challenge */}
          <Card glass>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Icon name="Boxes" className="h-4 w-4 text-violet-500" /> Mixed Challenge</CardTitle>
              <CardDescription>One top question from each topic at your level — build breadth.</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.mixedChallenge.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mixed set available for this stage.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.mixedChallenge.map((q) => (
                    <a key={q.id} href={q.problemLink || undefined} target="_blank" rel="noreferrer" className="rounded-lg border bg-card/50 p-3 hover:border-primary/40 hover:bg-card">
                      <p className="truncate text-sm font-medium">{q.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{q.topic} · {q.difficulty}</p>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roadmaps */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card glass>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Icon name="FolderTree" className="h-4 w-4 text-primary" /> Topic Roadmap</CardTitle><CardDescription>Click a topic to start its guided path.</CardDescription></CardHeader>
              <CardContent><RoadmapList items={overview.topicRoadmap} hrefFor={(r) => `/learn/${slugify(r.name)}`} /></CardContent>
            </Card>
            <Card glass>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Icon name="Cpu" className="h-4 w-4 text-primary" /> Pattern Roadmap</CardTitle><CardDescription>Pattern categories by progress.</CardDescription></CardHeader>
              <CardContent><RoadmapList items={overview.patternRoadmap} /></CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
