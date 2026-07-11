"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelative } from "@/lib/utils";
import type { Question } from "@/types";

export function RecentQuestions({
  title,
  questions,
  emptyText,
  dateField = "createdAt",
  viewAllHref,
}: {
  title: string;
  questions: Question[];
  emptyText: string;
  dateField?: "createdAt" | "solvedAt";
  viewAllHref?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        {viewAllHref && questions.length > 0 && (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {questions.map((q) => (
              <li key={q._id}>
                <Link
                  href={`/questions/${q._id}`}
                  className="group flex items-center gap-3 py-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium group-hover:text-primary">
                      {q.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.topic}
                      {q.subtopic ? ` · ${q.subtopic}` : ""}
                    </p>
                  </div>
                  <DifficultyBadge difficulty={q.difficulty} />
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatRelative(q[dateField])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
