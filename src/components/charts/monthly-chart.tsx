"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface MonthlyDatum {
  month: string;
  added: number;
  solved: number;
}

export function MonthlyChart({
  data,
  height = 280,
}: {
  data: MonthlyDatum[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="added" name="Added" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="solved" name="Solved" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
