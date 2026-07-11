"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { LearnOverview } from "@/lib/learning";

/** Learning overview for a stage (defaults to the current unlocked stage). */
export function useLearn(stage?: string) {
  const key = `/api/learn${stage ? `?stage=${stage}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR<LearnOverview>(key, fetcher, { revalidateOnFocus: false });
  return { overview: data, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}
