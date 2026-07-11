"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ProgressBarDatum {
  label: string;
  total: number;
  solved: number;
  href?: string;
}

/** A ranked list of labeled progress bars (topic / company / pattern wise). */
export function ProgressBars({
  data,
  emptyLabel = "No data yet",
  max,
  colorClass = "bg-primary",
}: {
  data: ProgressBarDatum[];
  emptyLabel?: string;
  max?: number;
  colorClass?: string;
}) {
  const items = data.filter((d) => d.total > 0);
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  const shown = typeof max === "number" ? items.slice(0, max) : items;

  return (
    <div className="space-y-3">
      {shown.map((d) => {
        const pct = d.total ? Math.round((d.solved / d.total) * 100) : 0;
        const Row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium">{d.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {d.solved.toLocaleString()} / {d.total.toLocaleString()}
                <span className="ml-1.5 inline-block w-8 text-right text-muted-foreground/70">
                  {pct}%
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", colorClass)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        );
        return d.href ? (
          <Link
            key={d.label}
            href={d.href}
            className="block rounded-md transition-opacity hover:opacity-80"
          >
            {Row}
          </Link>
        ) : (
          <div key={d.label}>{Row}</div>
        );
      })}
    </div>
  );
}
