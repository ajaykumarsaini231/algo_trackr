import { SWRConfig } from "swr";
import { computeUserStats } from "@/lib/user-stats";
import { ssrFallback } from "@/lib/ssr-fallback";
import DashboardClient from "./dashboard-client";

// Per-user data → always dynamic.
export const dynamic = "force-dynamic";

/**
 * Server shell for the dashboard. Computes the signed-in user's stats on the
 * server and seeds SWR's cache via `fallback`, so `useStats()` in the client
 * component returns data on the FIRST render — the dashboard paints real
 * content immediately instead of blank → skeleton → fetch. The client component
 * (and its UI) is unchanged; it still revalidates in the background and after
 * mutations, and degrades to client-fetch on any server-side hiccup.
 */
export default async function DashboardPage() {
  const fallback = await ssrFallback("/api/stats", computeUserStats);
  return (
    <SWRConfig value={{ fallback }}>
      <DashboardClient />
    </SWRConfig>
  );
}
