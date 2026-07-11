/**
 * Timezone-aware "local day" helpers shared by the heartbeat endpoint, the
 * reminder engine and the settings API. All reminder decisions happen in the
 * USER's timezone: activity buckets use the user's local calendar day and
 * the reminder window compares against their local wall clock.
 */

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface LocalParts {
  /** Local calendar day, "YYYY-MM-DD". */
  dateKey: string;
  /** Minutes since local midnight (0..1439). */
  minutesOfDay: number;
}

/** The instant `date` expressed in `tz` as calendar day + wall-clock minutes. */
export function localParts(tz: string, date: Date = new Date()): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Human date for template text, e.g. "12 Jul 2026" (user's timezone). */
export function formatLocalDate(tz: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Parse "HH:mm" to minutes since midnight; null when malformed. */
export function parseHHMM(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
