"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { useGoogle } from "@/hooks/use-google";
import { QuestionLink } from "@/components/questions/question-link";
import { priorityBadge, type GoogleRecommendation } from "@/lib/google";
import { slugify } from "@/lib/utils";

const TIER_STYLE: Record<string, { bar: string; text: string; icon: string }> = {
  Foundation: { bar: "bg-emerald-500", text: "text-emerald-500", icon: "Circle" },
  Intermediate: { bar: "bg-blue-500", text: "text-blue-500", icon: "SignalMedium" },
  "Interview Ready": { bar: "bg-violet-500", text: "text-violet-500", icon: "Target" },
  "Google Hard": { bar: "bg-amber-500", text: "text-amber-500", icon: "Flame" },
  "Research Level": { bar: "bg-rose-500", text: "text-rose-500", icon: "Trophy" },
};

function RecList({ items }: { items: GoogleRecommendation[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((q, i) => (
        <li key={q.id ?? i} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <QuestionLink
              q={q}
              className="block truncate text-sm font-medium hover:text-primary hover:underline"
            >
              {q.title}
            </QuestionLink>
            <p className="text-xs text-muted-foreground">
              {q.topic} · {q.platform}
            </p>
          </div>
          <Badge
            variant={q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "destructive"}
          >
            {q.difficulty}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default function GooglePage() {
  const router = useRouter();
  const { roadmap, isLoading, isError, error } = useGoogle();

  return (
    <div>
      <PageHeader
        title="Google Interview Prep"
        description="A live roadmap generated from your question bank — priority, coverage and readiness for a Google SWE loop."
        icon={<Icon name="Target" className="h-6 w-6" />}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-rose-500/30">
          <CardContent className="p-6 text-sm text-rose-500">
            Couldn&apos;t load the roadmap: {error?.message || "unknown error"}.
            Make sure the app can reach MongoDB (MONGODB_URI).
          </CardContent>
        </Card>
      )}

      {roadmap && (
        <div className="space-y-6">
          {/* Readiness + headline stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Google Readiness" value={roadmap.readiness.overall} suffix="%" icon="Gauge" accent="violet" hint="40% coverage · 60% solved" />
            <StatCard label="Topic Coverage" value={roadmap.readiness.coverageScore} suffix="%" icon="Target" accent="emerald" hint="priority-weighted" />
            <StatCard label="Total Questions" value={roadmap.total} icon="Boxes" accent="indigo" hint={`${roadmap.byPlatform.map((p) => `${p.key} ${p.total}`).join(" · ")}`} />
            <StatCard label="Solved" value={roadmap.progress.solved} suffix={` / ${roadmap.total}`} icon="CheckCircle2" accent="amber" hint={`${roadmap.progress.solvedPct}% complete`} />
          </div>

          {/* Google difficulty tiers */}
          <Card glass>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="BarChart3" className="h-4 w-4 text-primary" /> Google Difficulty Distribution
              </CardTitle>
              <CardDescription>Questions bucketed into a Google-style progression.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {roadmap.tiers.map((t) => {
                  const s = TIER_STYLE[t.label];
                  return (
                    <div key={t.label} className="rounded-lg border bg-card/50 p-4">
                      <div className="flex items-center gap-2">
                        <Icon name={s?.icon} className={`h-4 w-4 ${s?.text}`} />
                        <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums">{t.count.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Preparation order + priority + coverage */}
          <Card glass>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="FolderTree" className="h-4 w-4 text-primary" /> Preparation Order &amp; Topic Priority
              </CardTitle>
              <CardDescription>Study top-to-bottom. Counts and coverage are live from MongoDB.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">#</th>
                      <th className="py-2 pr-3 font-medium">Topic</th>
                      <th className="py-2 pr-3 font-medium">Priority</th>
                      <th className="py-2 pr-3 text-right font-medium">Total</th>
                      <th className="py-2 pr-3 text-right font-medium">E / M / H</th>
                      <th className="py-2 pr-3 text-right font-medium">LC / CF / Striver</th>
                      <th className="py-2 pr-3 font-medium">Coverage</th>
                      <th className="py-2 pr-3 text-right font-medium">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roadmap.topics.map((t) => {
                      const href = `/topics/${slugify(t.topic)}`;
                      return (
                      <tr
                        key={t.topic}
                        onClick={() => router.push(href)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(href);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`View ${t.topic} questions`}
                        className="cursor-pointer border-b border-border/50 outline-none transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50"
                      >
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">{t.orderIndex || "—"}</td>
                        <td className="py-2 pr-3 font-medium text-primary">{t.topic}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={priorityBadge(t.priority)}>{t.priority}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{t.total.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{t.easy}/{t.medium}/{t.hard}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{t.leetcode}/{t.codeforces}/{t.striver}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <Progress value={t.coveragePct} className="h-1.5 w-24" />
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{t.coveragePct}%</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{t.completionPct}%</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Weak / strong */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card glass>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="SignalLow" className="h-4 w-4 text-rose-500" /> Weak Topics (focus here)
                </CardTitle>
                <CardDescription>Lowest completion among Critical / High priority topics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {roadmap.weakTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between">
                    <span className="text-sm">{t.topic}</span>
                    <span className="text-xs text-muted-foreground">{t.remaining.toLocaleString()} left · {t.completionPct}% done</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card glass>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="SignalHigh" className="h-4 w-4 text-emerald-500" /> Strong Topics
                </CardTitle>
                <CardDescription>Highest completion among Critical / High priority topics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {roadmap.strongTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between">
                    <span className="text-sm">{t.topic}</span>
                    <span className="text-xs text-muted-foreground">{t.solved.toLocaleString()} solved · {t.completionPct}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card glass>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Zap" className="h-4 w-4 text-amber-500" /> Today&apos;s Questions
                </CardTitle>
                <CardDescription>Highest-priority unsolved, Striver &amp; LeetCode first.</CardDescription>
              </CardHeader>
              <CardContent><RecList items={roadmap.recommendations.today} /></CardContent>
            </Card>
            <Card glass>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Flame" className="h-4 w-4 text-rose-500" /> Google Hard List
                </CardTitle>
                <CardDescription>Top-difficulty problems worth targeting late in prep.</CardDescription>
              </CardHeader>
              <CardContent><RecList items={roadmap.recommendations.googleHard} /></CardContent>
            </Card>
          </div>

          {/* Company coverage */}
          <Card glass>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Building2" className="h-4 w-4 text-primary" /> Company Coverage
              </CardTitle>
              <CardDescription>Overlap of questions tagged by company.</CardDescription>
            </CardHeader>
            <CardContent>
              {roadmap.companyOverlap.length ? (
                <div className="flex flex-wrap gap-2">
                  {roadmap.companyOverlap.map((c) => (
                    <Badge key={c.company} variant="secondary">{c.company} · {c.total}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No company tags yet — the <code className="rounded bg-muted px-1">companies</code> field is empty on every
                  question, so company overlap can&apos;t be ranked. Populate it (LeetCode company tags require premium) to
                  unlock this view.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Schema gaps */}
          {roadmap.schemaGaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon name="Sparkles" className="h-4 w-4 text-muted-foreground" /> Notes &amp; schema gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {roadmap.schemaGaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
