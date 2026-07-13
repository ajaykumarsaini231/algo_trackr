import { SWRConfig } from "swr";
import { computeUserStats } from "@/lib/user-stats";
import { ssrFallback } from "@/lib/ssr-fallback";
import PatternsClient from "./patterns-client";

export const dynamic = "force-dynamic";

/** Server shell — the /patterns overview reads /api/stats; seed it for first paint. */
export default async function PatternsPage() {
  const fallback = await ssrFallback("/api/stats", computeUserStats);
  return (
    <SWRConfig value={{ fallback }}>
      <PatternsClient />
    </SWRConfig>
  );
}
