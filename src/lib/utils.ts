import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert a display name into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Format a date string / Date into a compact human readable form. */
export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

/** Relative time such as "3 days ago" / "in 2 days". */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Pluralize a noun based on count. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

/** Format minutes as "45m" / "1h 30m". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ISO date (yyyy-mm-dd) for a given date, in local time. */
export function toISODate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Basic string sanitization: trim and strip ASCII control characters
 * (codes 0-31 and 127). Implemented via char codes to avoid embedding
 * literal control characters in source.
 */
export function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out.trim();
}
