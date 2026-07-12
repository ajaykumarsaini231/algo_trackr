"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/icon";
import { usePatternDetail } from "@/hooks/use-patterns";
import { QuestionLink } from "@/components/questions/question-link";
import type { PatternPriority } from "@/lib/patterns";

const PRIORITY_VARIANT: Record<PatternPriority, "destructive" | "warning" | "info" | "muted"> = {
  Critical: "destructive", High: "warning", Medium: "info", Low: "muted",
};
const DIFFS = ["", "Easy", "Medium", "Hard"] as const;

function InfoCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <Card glass>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Icon name={icon} className="h-4 w-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export default function PatternDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = React.useState(1);
  const [difficulty, setDifficulty] = React.useState<string>("");

  const query = `?page=${page}&limit=20${difficulty ? `&difficulty=${difficulty}` : ""}`;
  const { detail, isLoading, isError, error } = usePatternDetail(slug, query);

  const total = detail?.total ?? 0;
  const bar = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

  return (
    <div>
      <PageHeader
        title={detail?.name || "Pattern"}
        description={detail ? `${detail.category} · ${detail.total.toLocaleString()} questions` : "Loading pattern…"}
        icon={<Icon name="Cpu" className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/algorithm-patterns"><Icon name="ArrowLeftRight" className="mr-1 h-4 w-4" /> All patterns</Link>
          </Button>
        }
      />

      {isError && (
        <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">
          {error?.message || "Failed to load."}
        </CardContent></Card>
      )}

      {detail && (
        <div className="space-y-6">
          {/* headline stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold tabular-nums">{detail.total.toLocaleString()}</p></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Solved / Remaining</p><p className="text-2xl font-bold tabular-nums">{detail.solved} <span className="text-base font-normal text-muted-foreground">/ {detail.remaining}</span></p></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completion</p><p className="text-2xl font-bold tabular-nums">{detail.completionPct}%</p></CardContent></Card>
            <Card glass><CardContent className="p-4"><p className="text-xs text-muted-foreground">Priority</p><div className="mt-1"><Badge variant={PRIORITY_VARIANT[detail.priority]}>{detail.priority}</Badge></div></CardContent></Card>
          </div>

          {/* difficulty graph + platform split */}
          <Card glass>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Difficulty & Platform</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500" style={{ width: bar(detail.easy) }} title={`Easy ${detail.easy}`} />
                <div className="bg-amber-500" style={{ width: bar(detail.medium) }} title={`Medium ${detail.medium}`} />
                <div className="bg-rose-500" style={{ width: bar(detail.hard) }} title={`Hard ${detail.hard}`} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>🟢 Easy {detail.easy}</span><span>🟡 Medium {detail.medium}</span><span>🔴 Hard {detail.hard}</span>
                <span className="ml-auto">LeetCode {detail.leetcode} · Codeforces {detail.codeforces} · Striver {detail.striver}</span>
              </div>
            </CardContent>
          </Card>

          {/* metadata */}
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard icon="Target" title="When to use">{detail.whenToUse || detail.description}</InfoCard>
            <InfoCard icon="Gauge" title="Complexity">
              <div className="flex gap-6"><span>Time: <b className="text-foreground">{detail.time || "—"}</b></span><span>Space: <b className="text-foreground">{detail.space || "—"}</b></span></div>
              <p className="mt-2">{detail.importance}</p>
            </InfoCard>
            <InfoCard icon="Search" title="Recognition tips">
              {detail.recognition.length ? <ul className="list-inside list-disc space-y-1">{detail.recognition.map((r, i) => <li key={i}>{r}</li>)}</ul> : "—"}
            </InfoCard>
            <InfoCard icon="Undo2" title="Common mistakes">
              {detail.mistakes.length ? <ul className="list-inside list-disc space-y-1">{detail.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul> : "—"}
            </InfoCard>
          </div>

          {/* related patterns */}
          {detail.relatedPatterns.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Related:</span>
              {detail.relatedPatterns.map((r) => (
                <Link key={r.slug} href={`/algorithm-patterns/${r.slug}`}><Badge variant="secondary">{r.name}</Badge></Link>
              ))}
            </div>
          )}

          {/* questions */}
          <Card glass>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Questions</CardTitle>
                <div className="flex gap-1">
                  {DIFFS.map((d) => (
                    <Button key={d || "all"} size="sm" variant={difficulty === d ? "default" : "outline"}
                      onClick={() => { setDifficulty(d); setPage(1); }}>
                      {d || "All"}
                    </Button>
                  ))}
                </div>
              </div>
              <CardDescription>{detail.questions.total.toLocaleString()} matching questions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-muted/40" />)}</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {detail.questions.items.map((q) => (
                    <li key={q.id}>
                      <QuestionLink
                        q={q}
                        className="group flex items-center justify-between gap-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-primary">{q.title}</p>
                          <p className="text-xs text-muted-foreground">{q.topic} · {q.platform}{q.status && q.status !== "Not Started" ? ` · ${q.status}` : ""}</p>
                        </div>
                        <Badge variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "destructive"}>{q.difficulty}</Badge>
                      </QuestionLink>
                    </li>
                  ))}
                </ul>
              )}

              {detail.questions.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Page {detail.questions.page} of {detail.questions.totalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= detail.questions.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
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
