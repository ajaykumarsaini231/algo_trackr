import { SWRConfig } from "swr";
import { computeLearnOverview } from "@/lib/learn-overview";
import { ssrFallback } from "@/lib/ssr-fallback";
import LearnClient from "./learn-client";

export const dynamic = "force-dynamic";

/**
 * Server shell for /learn — computes the default learning overview on the
 * server and seeds SWR (key "/api/learn", which is what `useLearn(undefined)`
 * requests) so the staged roadmap paints on first render instead of a skeleton.
 */
export default async function LearnPage() {
  const fallback = await ssrFallback("/api/learn", (id) => computeLearnOverview(id, {}));
  return (
    <SWRConfig value={{ fallback }}>
      <LearnClient />
    </SWRConfig>
  );
}
