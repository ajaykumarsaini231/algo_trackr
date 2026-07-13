import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { listInitialData } from "@/lib/ssr-fallback";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q ?? "";
  const initialFilters = q ? { search: q } : {};
  const initialData = await listInitialData({}, initialFilters);

  return (
    <div>
      <PageHeader
        title="Search"
        description={q ? `Results for “${q}”` : "Find any question by title, notes, or tags."}
        icon={<Icon name="Search" className="h-6 w-6" />}
      />

      <QuestionsBrowser
        key={q}
        initialFilters={{ search: q }}
        initialData={initialData}
        showSearch
        emptyTitle="Nothing matches"
        emptyDescription="Try different keywords or filters."
      />
    </div>
  );
}
