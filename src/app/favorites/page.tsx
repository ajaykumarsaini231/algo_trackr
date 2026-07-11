"use client";

import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionsBrowser } from "@/components/questions/questions-browser";

export default function FavoritesPage() {
  return (
    <div>
      <PageHeader
        title="Favorites"
        description="Your starred questions, all in one place."
        icon={<Icon name="Star" className="h-6 w-6" />}
      />

      <QuestionsBrowser
        lockedFilters={{ favorite: true }}
        emptyTitle="No favorites yet"
        emptyDescription="Tap the star on any question to add it here."
      />
    </div>
  );
}
