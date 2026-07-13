import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { listInitialData } from "@/lib/ssr-fallback";

export const dynamic = "force-dynamic";

const LOCKED = { favorite: true } as const;

export default async function FavoritesPage() {
  const initialData = await listInitialData(LOCKED);
  return (
    <div>
      <PageHeader
        title="Favorites"
        description="Your starred questions, all in one place."
        icon={<Icon name="Star" className="h-6 w-6" />}
      />

      <QuestionsBrowser
        lockedFilters={LOCKED}
        initialData={initialData}
        emptyTitle="No favorites yet"
        emptyDescription="Tap the star on any question to add it here."
      />
    </div>
  );
}
