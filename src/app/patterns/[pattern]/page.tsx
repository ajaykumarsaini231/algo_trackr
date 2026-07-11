"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { Button } from "@/components/ui/button";
import { getPatternBySlug } from "@/lib/constants";

export default function PatternDetailPage() {
  const { pattern: slug } = useParams<{ pattern: string }>();
  const pattern = getPatternBySlug(slug);

  if (!pattern) {
    return (
      <EmptyState
        icon={<Icon name="Sparkles" className="h-7 w-7" />}
        title="Pattern not found"
        description="This pattern doesn't exist or may have been renamed."
        action={
          <Button asChild variant="outline">
            <Link href="/patterns">Back to Patterns</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={pattern.name}
        description="Every question that trains this pattern."
        icon={<Icon name={pattern.icon} className="h-6 w-6" />}
      />

      <QuestionsBrowser
        lockedFilters={{ pattern: pattern.name }}
        hide={["pattern"]}
        emptyTitle={`No ${pattern.name} questions yet`}
        emptyDescription="Add questions from the Admin Panel."
      />
    </div>
  );
}
