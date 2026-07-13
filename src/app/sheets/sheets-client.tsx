"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/shared/icon";
import { useSheets } from "@/hooks/use-sheets";
import type { SheetProgress } from "@/lib/sheets";

const ACCENT: Record<string, { icon: string; bar: string }> = {
  amber: { icon: "bg-amber-500/15 text-amber-500", bar: "bg-amber-500" },
  violet: { icon: "bg-violet-500/15 text-violet-500", bar: "bg-violet-500" },
  rose: { icon: "bg-rose-500/15 text-rose-500", bar: "bg-rose-500" },
  cyan: { icon: "bg-cyan-500/15 text-cyan-500", bar: "bg-cyan-500" },
  emerald: { icon: "bg-emerald-500/15 text-emerald-500", bar: "bg-emerald-500" },
  blue: { icon: "bg-blue-500/15 text-blue-500", bar: "bg-blue-500" },
  indigo: { icon: "bg-indigo-500/15 text-indigo-500", bar: "bg-indigo-500" },
  slate: { icon: "bg-slate-500/15 text-slate-400", bar: "bg-slate-400" },
};

function SheetCard({ s }: { s: SheetProgress }) {
  const a = ACCENT[s.accent] || ACCENT.indigo;
  return (
    <Link href={`/sheets/${s.key}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card glass className="card-hover flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.icon}`}>
            <Icon name={s.icon} className="h-5 w-5" />
          </div>
          <Badge variant={s.type === "curated" ? "warning" : "secondary"}>{s.source}</Badge>
        </div>
        <h3 className="mt-3 font-semibold">{s.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{s.solved}/{s.total} solved</span>
            <span className="font-medium text-foreground">{s.completionPct}%</span>
          </div>
          <Progress value={s.completionPct} className="mt-2 h-1.5" indicatorClassName={a.bar} />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>🟢 {s.easy} · 🟡 {s.medium} · 🔴 {s.hard}</span>
            {s.listSize != null && <span>{s.total}/{s.listSize} in bank</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function SheetsClient() {
  const { sheets, isLoading, isError, error } = useSheets();

  return (
    <div>
      <PageHeader
        title="Interview Sheets"
        description="Curated and dynamic problem sets. Progress is live from MongoDB."
        icon={<Icon name="BookMarked" className="h-6 w-6" />}
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/40" />)}
        </div>
      )}
      {isError && (
        <Card className="border-rose-500/30"><CardContent className="p-6 text-sm text-rose-500">
          Couldn&apos;t load sheets: {error?.message || "unknown error"}.
        </CardContent></Card>
      )}

      {sheets && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => <SheetCard key={s.key} s={s} />)}
        </div>
      )}
    </div>
  );
}
