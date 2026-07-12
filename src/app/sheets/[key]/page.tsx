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
import { QuestionLink } from "@/components/questions/question-link";
import { useSheetDetail } from "@/hooks/use-sheets";

const DIFFS = ["", "Easy", "Medium", "Hard"] as const;

export default function SheetDetailPage() {
  const { key } = useParams<{ key: string }>();
  const [page, setPage] = React.useState(1);
  const [difficulty, setDifficulty] = React.useState<string>("");

  const query = `?page=${page}&limit=25${difficulty ? `&difficulty=${difficulty}` : ""}`;
  const { sheet, isLoading, isError, error } = useSheetDetail(key, query);

  const total = sheet?.total ?? 0;
  const bar = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

  return (
    <div>
      <PageHeader
        title={sheet?.name || "Sheet"}
        description={sheet ? sheet.description : "Loading…"}
        icon={<Icon name={sheet?.icon || "BookMarked"} className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/sheets"><Icon name="ArrowLeftRight" className="mr-1 h-4 w-4" /> All sheets</Link>
          </Button>
        }
      />

      {isError && (
        <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">
          {error?.message || "Failed to load."}
        </CardContent></Card>
      )}

      {sheet && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Questions</p><p className="text-2xl font-bold tabular-nums">{sheet.total.toLocaleString()}</p></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Solved / Remaining</p><p className="text-2xl font-bold tabular-nums">{sheet.solved} <span className="text-base font-normal text-muted-foreground">/ {sheet.remaining}</span></p></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completion</p><p className="text-2xl font-bold tabular-nums">{sheet.completionPct}%</p><Progress value={sheet.completionPct} className="mt-2 h-1.5" /></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Source</p><div className="mt-1"><Badge variant={sheet.type === "curated" ? "warning" : "secondary"}>{sheet.source}</Badge></div>{sheet.listSize != null && <p className="mt-2 text-xs text-muted-foreground">{sheet.matched} of {sheet.listSize} list problems in your bank</p>}</CardContent></Card>
          </div>

          <Card glass>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Difficulty</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: bar(sheet.easy) }} title={`Easy ${sheet.easy}`} />
                <div className="bg-amber-500" style={{ width: bar(sheet.medium) }} title={`Medium ${sheet.medium}`} />
                <div className="bg-rose-500" style={{ width: bar(sheet.hard) }} title={`Hard ${sheet.hard}`} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>🟢 Easy {sheet.easy}</span><span>🟡 Medium {sheet.medium}</span><span>🔴 Hard {sheet.hard}</span>
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Questions</CardTitle>
                <div className="flex gap-1">
                  {DIFFS.map((d) => (
                    <Button key={d || "all"} size="sm" variant={difficulty === d ? "default" : "outline"}
                      onClick={() => { setDifficulty(d); setPage(1); }}>{d || "All"}</Button>
                  ))}
                </div>
              </div>
              <CardDescription>{sheet.questions.total.toLocaleString()} matching questions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-muted/40" />)}</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {sheet.questions.items.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <QuestionLink q={q} className="block truncate text-sm font-medium hover:text-primary hover:underline">{q.title}</QuestionLink>
                        <p className="text-xs text-muted-foreground">{q.topic} · {q.platform}{q.status && q.status !== "Not Started" ? ` · ${q.status}` : ""}</p>
                      </div>
                      <Badge variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "destructive"}>{q.difficulty}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              {sheet.questions.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Page {sheet.questions.page} of {sheet.questions.totalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= sheet.questions.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
