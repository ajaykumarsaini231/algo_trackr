"use client";

import useSWR from "swr";
import { buildQuestionQuery, fetcher } from "@/lib/api-client";
import type { Paginated, Question, QuestionFilters } from "@/types";

/**
 * Fetch a filtered, paginated list of questions.
 * `fallbackData` seeds SWR for THIS key so a server-rendered first page paints
 * instantly (the caller passes it only for the initial, un-touched view).
 */
export function useQuestions(
  filters: QuestionFilters = {},
  fallbackData?: Paginated<Question>,
) {
  const key = `/api/questions${buildQuestionQuery(filters)}`;
  const { data, error, isLoading, mutate } = useSWR<Paginated<Question>>(
    key,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, fallbackData },
  );

  return {
    questions: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}

/** Fetch a single question by id. */
export function useQuestion(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Question>(
    id ? `/api/questions/${id}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    question: data,
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}
