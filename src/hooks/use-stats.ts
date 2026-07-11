"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { Stats } from "@/types";

/** Fetch aggregated dashboard / statistics data. */
export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<Stats>("/api/stats", fetcher, {
    revalidateOnFocus: false,
  });

  return {
    stats: data,
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}
