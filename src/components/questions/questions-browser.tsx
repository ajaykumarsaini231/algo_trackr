"use client";

import * as React from "react";
import { QuestionFiltersBar } from "@/components/questions/question-filters";
import { QuestionList } from "@/components/questions/question-list";
import { useQuestions } from "@/hooks/use-questions";
import { pluralize } from "@/lib/utils";
import type { QuestionFilters } from "@/types";

type Dimension =
  | "topic"
  | "company"
  | "pattern"
  | "platform"
  | "difficulty"
  | "status";

interface QuestionsBrowserProps {
  /** Filters that are fixed for this view (e.g. a topic page) and can't be changed. */
  lockedFilters?: Partial<QuestionFilters>;
  /** Filter controls to hide (usually the locked dimensions). */
  hide?: Dimension[];
  showFilters?: boolean;
  showSearch?: boolean;
  pageSize?: number;
  /** Seed the user-adjustable filters (e.g. from a URL ?q= query). */
  initialFilters?: Partial<QuestionFilters>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

const DEFAULT_FILTERS: QuestionFilters = { sort: "createdAt:desc" };

export function QuestionsBrowser({
  lockedFilters = {},
  hide = [],
  showFilters = true,
  showSearch = true,
  pageSize = 24,
  initialFilters,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: QuestionsBrowserProps) {
  const [userFilters, setUserFilters] = React.useState<QuestionFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [page, setPage] = React.useState(1);

  const merged: QuestionFilters = {
    ...userFilters,
    ...lockedFilters,
    page,
    limit: pageSize,
  };

  const { questions, total, totalPages, isLoading, isError } = useQuestions(merged);

  function patch(p: Partial<QuestionFilters>) {
    setUserFilters((f) => ({ ...f, ...p }));
    setPage(1);
  }

  return (
    <div>
      {showFilters && (
        <QuestionFiltersBar
          filters={userFilters}
          onChange={patch}
          onReset={() => {
            setUserFilters(DEFAULT_FILTERS);
            setPage(1);
          }}
          hide={hide}
          showSearch={showSearch}
        />
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {pluralize(total, "question")}
        </p>
      )}

      <QuestionList
        questions={questions}
        isLoading={isLoading}
        isError={isError}
        skeletonCount={6}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
