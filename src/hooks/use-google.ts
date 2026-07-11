"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { GoogleRoadmap } from "@/lib/google";

/** Fetch the live Google interview-prep roadmap (aggregated in /api/google). */
export function useGoogle() {
  const { data, error, isLoading, mutate } = useSWR<GoogleRoadmap>(
    "/api/google",
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    roadmap: data,
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}
