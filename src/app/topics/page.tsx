import { SWRConfig } from "swr";
import { computeUserStats } from "@/lib/user-stats";
import { ssrFallback } from "@/lib/ssr-fallback";
import TopicsClient from "./topics-client";

export const dynamic = "force-dynamic";

/**
 * Server shell — the /topics overview reads /api/stats for per-topic progress.
 * Seed it so a signed-in user's progress paints on first render; signed-out
 * visitors get an empty fallback and the public catalog view (unchanged).
 */
export default async function TopicsPage() {
  const fallback = await ssrFallback("/api/stats", computeUserStats);
  return (
    <SWRConfig value={{ fallback }}>
      <TopicsClient />
    </SWRConfig>
  );
}
