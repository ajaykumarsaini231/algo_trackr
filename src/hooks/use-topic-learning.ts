"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { TopicLearning, TopicLearningAll } from "@/lib/learning";

/** Staged (or full) learning view for a single topic. */
export function useTopicLearning(
  slug: string | undefined,
  { reveal = 1, viewAll = false, page = 1 }: { reveal?: number; viewAll?: boolean; page?: number },
) {
  const q = viewAll ? `?view=all&page=${page}&limit=30` : `?reveal=${reveal}`;
  const key = slug ? `/api/learn/topic/${slug}${q}` : null;
  const { data, error, isLoading, mutate } = useSWR<TopicLearning | TopicLearningAll>(
    key, fetcher, { revalidateOnFocus: false, keepPreviousData: true },
  );
  return { data, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}
