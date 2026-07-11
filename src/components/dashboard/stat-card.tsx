"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/shared/icon";

/** Retained for compatibility with existing call sites; no longer styled. */
export type Accent =
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "blue"
  | "cyan"
  | "slate";

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  accent?: Accent;
  hint?: string;
  suffix?: string;
  href?: string;
  delay?: number;
}

/** Compact, flat metric tile: uppercase label, tabular figure, muted icon. */
export function StatCard({ label, value, icon, hint, suffix, href }: StatCardProps) {
  const inner = (
    <Card className={href ? "card-hover h-full" : "h-full"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon name={icon} className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {value.toLocaleString()}
          </span>
          {suffix && (
            <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
          )}
        </div>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link
      href={href}
      className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
