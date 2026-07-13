import "server-only";
import { getSessionUser } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { buildQuestionQuery } from "@/lib/api-client";
import { listQuestions } from "@/lib/question-list";
import type { Paginated, Question, QuestionFilters } from "@/types";

/**
 * Build an SWR `fallback` map for a server page: compute the signed-in user's
 * data on the server so the client component paints it on the first render
 * (no blank → skeleton → fetch). `key` must match the SWR key the page's hook
 * uses; `compute` is the shared server function behind that endpoint.
 *
 * Any auth/DB hiccup yields an empty fallback → the client fetches as before,
 * so a server-side failure can never break the page.
 */
export async function ssrFallback<T>(
  key: string,
  compute: (userId: string) => Promise<T>,
): Promise<Record<string, unknown>> {
  try {
    const user = await getSessionUser();
    if (!user) return {};
    await connectDB();
    return { [key]: await compute(user.id) };
  } catch {
    return {};
  }
}

/**
 * Server-render the FIRST page of a question list (default view) for the
 * `QuestionsBrowser`'s `initialData` prop, so a list page paints real cards on
 * first byte. Mirrors the browser's initial `merged` filters exactly so the
 * data matches what the client would fetch. Returns `undefined` (→ client
 * fetches as before) for signed-out visitors or on any error.
 */
export async function listInitialData(
  lockedFilters: Partial<QuestionFilters> = {},
  initialFilters: Partial<QuestionFilters> = {},
  pageSize = 24,
): Promise<Paginated<Question> | undefined> {
  try {
    const user = await getSessionUser();
    if (!user) return undefined;
    await connectDB();
    const merged: QuestionFilters = {
      sort: "createdAt:desc",
      ...initialFilters,
      ...lockedFilters,
      page: 1,
      limit: pageSize,
    };
    const qs = buildQuestionQuery(merged);
    const sp = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
    return await listQuestions(user.id, sp);
  } catch {
    return undefined;
  }
}

/**
 * Server-render a question list for an ARBITRARY fixed filter set (e.g. the
 * revision queue's `{ revision: true, limit: 500 }`). Passed to `useQuestions`
 * as `fallbackData` (key-agnostic) so a fixed-filter view paints on first byte.
 */
export async function listPageData(
  filters: QuestionFilters,
): Promise<Paginated<Question> | undefined> {
  try {
    const user = await getSessionUser();
    if (!user) return undefined;
    await connectDB();
    const qs = buildQuestionQuery(filters);
    const sp = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
    return await listQuestions(user.id, sp);
  } catch {
    return undefined;
  }
}
