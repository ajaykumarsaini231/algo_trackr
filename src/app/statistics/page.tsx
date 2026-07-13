import { SWRConfig } from "swr";
import { computeUserStats } from "@/lib/user-stats";
import { ssrFallback } from "@/lib/ssr-fallback";
import StatisticsClient from "./statistics-client";

export const dynamic = "force-dynamic";

/** Server shell — seeds SWR (key "/api/stats") so charts paint on first render. */
export default async function StatisticsPage() {
  const fallback = await ssrFallback("/api/stats", computeUserStats);
  return (
    <SWRConfig value={{ fallback }}>
      <StatisticsClient />
    </SWRConfig>
  );
}
