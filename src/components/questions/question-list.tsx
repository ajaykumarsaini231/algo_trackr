"use client";

import { AlertTriangle, Inbox } from "lucide-react";
import { QuestionCard } from "@/components/questions/question-card";
import { QuestionListSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

interface QuestionListProps {
  questions: Question[];
  isLoading?: boolean;
  isError?: boolean;
  skeletonCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  // Pagination (optional)
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function QuestionList({
  questions,
  isLoading,
  isError,
  skeletonCount = 6,
  emptyTitle = "No questions found",
  emptyDescription = "Try adjusting your filters, or add a new question from the Admin Panel.",
  emptyAction,
  className,
  page,
  totalPages,
  onPageChange,
}: QuestionListProps) {
  if (isLoading) return <QuestionListSkeleton count={skeletonCount} />;

  if (isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Couldn't load questions"
        description="There was a problem reaching the server. Check your database connection and try again."
      />
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-7 w-7" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
        {questions.map((q, i) => (
          <QuestionCard key={q._id} question={q} index={i} />
        ))}
      </div>

      {typeof page === "number" &&
        typeof totalPages === "number" &&
        totalPages > 1 &&
        onPageChange && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
    </div>
  );
}
