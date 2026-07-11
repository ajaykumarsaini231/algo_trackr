"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[12px]",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

/**
 * User avatar: renders the https image when set and falls back to the
 * initial letter (also on image load errors). Used by the header menu and
 * the profile page.
 */
export function UserAvatar({
  name,
  image,
  size = "sm",
  className,
}: {
  name: string;
  image?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [broken, setBroken] = React.useState(false);
  const initial = (name.trim()[0] || "?").toUpperCase();
  const src = image && /^https:\/\//i.test(image) && !broken ? image : null;

  React.useEffect(() => setBroken(false), [image]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground font-semibold text-background",
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
