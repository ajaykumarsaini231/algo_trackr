"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { QuestionListSkeleton } from "@/components/shared/skeletons";

function SearchInner() {
  const q = useSearchParams().get("q") ?? "";

  return (
    <div>
      <PageHeader
        title="Search"
        description={
          q ? `Results for “${q}”` : "Find any question by title, notes, or tags."
        }
        icon={<Icon name="Search" className="h-6 w-6" />}
      />

      <QuestionsBrowser
        key={q}
        initialFilters={{ search: q }}
        showSearch
        emptyTitle="Nothing matches"
        emptyDescription="Try different keywords or filters."
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeader
            title="Search"
            description="Find any question by title, notes, or tags."
            icon={<Icon name="Search" className="h-6 w-6" />}
          />
          <QuestionListSkeleton count={6} />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
