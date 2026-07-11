"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  height = 240,
  showLegend = true,
}: {
  data: DonutDatum[];
  height?: number;
  /** Hide the built-in legend when the caller renders its own breakdown. */
  showLegend?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
