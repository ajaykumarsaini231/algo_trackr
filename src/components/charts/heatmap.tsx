"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

export interface HeatmapDatum {
  date: string; // yyyy-mm-dd
  count: number;
}

const LEVELS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/** GitHub-style contribution heatmap. Expects daily data, oldest → newest. */
export function Heatmap({ data }: { data: HeatmapDatum[] }) {
  const cells = React.useMemo(() => {
    if (data.length === 0) return [] as (HeatmapDatum | null)[];
    const firstDay = new Date(data[0]!.date).getDay(); // 0 Sun .. 6 Sat
    const padding: (HeatmapDatum | null)[] = Array.from({ length: firstDay }, () => null);
    return [...padding, ...data];
  }, [data]);

  const totalSolved = data.reduce((s, d) => s + d.count, 0);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity yet — solve a question to light up your streak.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div
          className="grid grid-flow-col grid-rows-7 gap-1"
          style={{ gridAutoColumns: "min-content" }}
        >
          {cells.map((cell, i) =>
            cell === null ? (
              <div key={`pad-${i}`} className="h-3 w-3" />
            ) : (
              <div
                key={cell.date}
                title={`${cell.count} solved · ${formatDate(cell.date)}`}
                className={cn(
                  "h-3 w-3 rounded-sm transition-transform hover:scale-125",
                  LEVELS[level(cell.count)],
                )}
              />
            ),
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalSolved} solved in the last 6 months</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {LEVELS.map((lvl, i) => (
            <span key={i} className={cn("h-3 w-3 rounded-sm", lvl)} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
