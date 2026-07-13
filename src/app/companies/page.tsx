import { SWRConfig } from "swr";
import { computeUserStats } from "@/lib/user-stats";
import { ssrFallback } from "@/lib/ssr-fallback";
import CompaniesClient from "./companies-client";

export const dynamic = "force-dynamic";

/**
 * Server shell — the /companies overview reads /api/stats for per-company
 * progress. Seed it for a signed-in user; signed-out visitors get the public
 * catalog view (unchanged).
 */
export default async function CompaniesPage() {
  const fallback = await ssrFallback("/api/stats", computeUserStats);
  return (
    <SWRConfig value={{ fallback }}>
      <CompaniesClient />
    </SWRConfig>
  );
}
