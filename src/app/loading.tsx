import { Skeleton } from "@/components/ui/skeleton";

/**
 * Neutral, route-agnostic fallback shown during a server (RSC) transition to any
 * segment that doesn't define its own `loading.tsx`. Deliberately generic —
 * a page header outline plus a few content blocks — so it never flashes a
 * dashboard-shaped skeleton on unrelated routes (each data page also renders
 * its own content skeleton once mounted).
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
