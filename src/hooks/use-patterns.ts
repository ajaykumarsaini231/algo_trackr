"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { PatternDashboard, PatternDetail } from "@/lib/patterns";

/** Pattern dashboard (all patterns grouped by category, live counts). */
export function usePatterns() {
  const { data, error, isLoading, mutate } = useSWR<PatternDashboard>(
    "/api/patterns", fetcher, { revalidateOnFocus: false },
  );
  return { dashboard: data, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}

/** Single pattern detail + its questions. `query` is an optional "?page=..&difficulty=.." string. */
export function usePatternDetail(slug: string | undefined, query = "") {
  const key = slug ? `/api/patterns/${slug}${query}` : null;
  const { data, error, isLoading, mutate } = useSWR<PatternDetail>(
    key, fetcher, { revalidateOnFocus: false },
  );
  return { detail: data, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}
