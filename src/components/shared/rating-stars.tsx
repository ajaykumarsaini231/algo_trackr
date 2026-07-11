"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
  readOnly?: boolean;
}

/** 1–5 star rating. Interactive when `onChange` is provided. */
export function RatingStars({
  value,
  onChange,
  size = 16,
  className,
  readOnly,
}: RatingStarsProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const interactive = Boolean(onChange) && !readOnly;
  const display = hover ?? value;

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star === value ? 0 : star)}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(null)}
            className={cn(
              "transition-transform",
              interactive && "cursor-pointer hover:scale-110",
              !interactive && "cursor-default",
            )}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                "transition-colors",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
