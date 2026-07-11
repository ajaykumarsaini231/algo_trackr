"use client";

import * as React from "react";
import Link from "next/link";
import { preload } from "swr";
import { motion } from "framer-motion";
import { Clock, ExternalLink, RotateCw, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DifficultyBadge, StatusBadge } from "@/components/shared/badges";
import { RatingStars } from "@/components/shared/rating-stars";
import { useQuestionMutations } from "@/hooks/use-question-mutations";
import { fetcher } from "@/lib/api-client";
import { cn, formatMinutes, slugify } from "@/lib/utils";
import type { Question } from "@/types";

interface QuestionCardProps {
  question: Question;
  index?: number;
}

export const QuestionCard = React.memo(function QuestionCard({ question: q, index = 0 }: QuestionCardProps) {
  const { update } = useQuestionMutations();
  const [favorite, setFavorite] = React.useState(q.favorite);

  React.useEffect(() => setFavorite(q.favorite), [q.favorite]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorite;
    setFavorite(next); // optimistic
    const res = await update(q._id, { favorite: next }, { silent: true });
    if (!res) setFavorite(!next); // revert on failure
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card glass className="card-hover group relative h-full overflow-hidden">
        <Link
          href={`/questions/${q._id}`}
          onMouseEnter={() => preload(`/api/questions/${q._id}`, fetcher)}
          onFocus={() => preload(`/api/questions/${q._id}`, fetcher)}
          className="block p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 pr-1 font-semibold leading-snug transition-colors group-hover:text-primary">
              {q.title}
            </h3>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-amber-400"
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-all",
                  favorite && "fill-amber-400 text-amber-400",
                )}
              />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <DifficultyBadge difficulty={q.difficulty} />
            <StatusBadge status={q.status} />
            {q.revisionNeeded && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                <RotateCw className="h-3 w-3" /> Revision
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <Link
              href={`/topics/${slugify(q.topic)}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-muted/60 px-2 py-0.5 font-medium hover:text-foreground"
            >
              {q.topic}
            </Link>
            {q.subtopic && (
              <span className="rounded-md bg-muted/40 px-2 py-0.5">{q.subtopic}</span>
            )}
            {q.pattern && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {q.pattern}
              </span>
            )}
          </div>

          {q.companies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {q.companies.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {c}
                </span>
              ))}
              {q.companies.length > 3 && (
                <span className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{q.companies.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                {q.platform}
              </span>
              {q.rating > 0 && <RatingStars value={q.rating} size={12} readOnly />}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {q.estimatedTime > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatMinutes(q.estimatedTime)}
                </span>
              )}
              {q.problemLink && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(q.problemLink, "_blank", "noopener,noreferrer");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </Link>
      </Card>
    </motion.div>
  );
});
