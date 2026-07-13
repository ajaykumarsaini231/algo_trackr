"use client";

import * as React from "react";
import { QuestionFiltersBar } from "@/components/questions/question-filters";
import { QuestionList } from "@/components/questions/question-list";
import { useQuestions } from "@/hooks/use-questions";
import { pluralize } from "@/lib/utils";
import type { QuestionFilters, Paginated, Question } from "@/types";

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
  /** Server-rendered first page (default view) — paints instantly, no skeleton. */
  initialData?: Paginated<Question>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

const DEFAULT_FILTERS: QuestionFilters = { sort: "createdAt:desc" };

/** Shallow equality over the user-adjustable filter values. */
function sameFilters(a: QuestionFilters, b: QuestionFilters): boolean {
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

export function QuestionsBrowser({
  lockedFilters = {},
  hide = [],
  showFilters = true,
  showSearch = true,
  pageSize = 24,
  initialFilters,
  initialData,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: QuestionsBrowserProps) {
  const initialUserFilters = React.useMemo<QuestionFilters>(
    () => ({ ...DEFAULT_FILTERS, ...initialFilters }),
    [initialFilters],
  );
  const [userFilters, setUserFilters] = React.useState<QuestionFilters>(initialUserFilters);
  const [page, setPage] = React.useState(1);
  // Capture the locked filters as they were on first render (they can change,
  // e.g. a subtopic pill on a topic page) so the SSR seed is dropped the moment
  // they diverge from what was server-rendered.
  const [initialLocked] = React.useState<Partial<QuestionFilters>>(lockedFilters);

  const merged: QuestionFilters = {
    ...userFilters,
    ...lockedFilters,
    page,
    limit: pageSize,
  };

  // Use the SSR'd first page ONLY for the initial, un-touched view (page 1, no
  // user-filter changes, same locked filters) — so switching filters, subtopics
  // or pages never shows stale seed data.
  const isInitialView =
    page === 1 &&
    sameFilters(userFilters, initialUserFilters) &&
    sameFilters(lockedFilters, initialLocked);
  const { questions, total, totalPages, isLoading, isError } = useQuestions(
    merged,
    isInitialView ? initialData : undefined,
  );

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
