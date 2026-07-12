/**
 * THE single source of question-navigation logic. Every list, card and row
 * that renders a question must build its destination through `questionHref`
 * so the whole app behaves identically:
 *
 *   1. Question exists in the DB (has an id)  → internal details page
 *      `/questions/<id>`, carrying the original problem URL as `?ext=` so
 *      the details page can fall back to the judge if the record is gone.
 *   2. No id but an external problem link     → the judge URL directly.
 *   3. Neither                                → `/search` (a click must
 *      NEVER do nothing).
 */

export interface QuestionNavInput {
  /** Mongo id under either name (lists use `id`, full docs use `_id`). */
  id?: string | null;
  _id?: string | null;
  problemLink?: string | null;
}

/** Hosts we are willing to auto-redirect to when a record is missing. */
const JUDGE_HOSTS = [
  "leetcode.com",
  "codeforces.com",
  "geeksforgeeks.org",
  "cses.fi",
  "atcoder.jp",
  "spoj.com",
  "hackerrank.com",
  "hackerearth.com",
  "interviewbit.com",
  "codechef.com",
  "codingninjas.com",
  "naukri.com", // Coding Ninjas problems moved under naukri.com/code360
];

/** Validated external judge URL, or null. Blocks open-redirect abuse. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase();
    const ok = JUDGE_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Destination for a question (internal when possible, never dead). */
export function questionHref(q: QuestionNavInput): string {
  const id = q.id || q._id;
  const ext = safeExternalUrl(q.problemLink);
  if (id) {
    return ext ? `/questions/${id}?ext=${encodeURIComponent(ext)}` : `/questions/${id}`;
  }
  return ext ?? "/search";
}

/** True when a href produced by `questionHref` leaves the app. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
