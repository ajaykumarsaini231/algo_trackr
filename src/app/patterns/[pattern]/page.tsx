import Link from "next/link";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { Button } from "@/components/ui/button";
import { getPatternBySlug } from "@/lib/constants";
import { listInitialData } from "@/lib/ssr-fallback";

export const dynamic = "force-dynamic";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ pattern: string }>;
}) {
  const { pattern: slug } = await params;
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

  const initialData = await listInitialData({ pattern: pattern.name });

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
        initialData={initialData}
        emptyTitle={`No ${pattern.name} questions yet`}
        emptyDescription="Add questions from the Admin Panel."
      />
    </div>
  );
}
