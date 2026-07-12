"use client";

import * as React from "react";
import Link from "next/link";
import { questionHref, isExternalHref, type QuestionNavInput } from "@/lib/question-nav";

/**
 * The one true way to make a question clickable. Renders a Next.js Link to
 * the internal details page when the question has an id (so users can track
 * status/notes/attempts), or a new-tab anchor to the judge URL when it only
 * exists externally. Guarantees a working destination in every case.
 */
export function QuestionLink({
  q,
  className,
  children,
  ...rest
}: {
  q: QuestionNavInput;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const href = questionHref(q);

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
