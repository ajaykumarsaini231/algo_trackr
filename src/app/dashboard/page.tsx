import { SWRConfig } from "swr";
import { getSessionUser } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { computeUserStats } from "@/lib/user-stats";
import DashboardClient from "./dashboard-client";

// Per-user data → always dynamic.
export const dynamic = "force-dynamic";

/**
 * Server shell for the dashboard. It computes the signed-in user's stats on the
 * server and seeds SWR's cache via `fallback`, so `useStats()` in the client
 * component returns data on the FIRST render — the dashboard paints real
 * content immediately instead of blank → skeleton → fetch. The client component
 * (and its UI) is unchanged; it still revalidates in the background and after
 * mutations. On any auth/DB hiccup we render the client with no fallback, which
 * degrades to the previous client-fetch behavior (skeleton then data/error).
 */
export default async function DashboardPage() {
  let fallback: Record<string, unknown> = {};
  try {
    const user = await getSessionUser();
    if (user) {
      await connectDB();
      const stats = await computeUserStats(user.id);
      // Key MUST match the SWR key in useStats() ("/api/stats"); value is the
      // unwrapped data the fetcher would return.
      fallback = { "/api/stats": stats };
    }
  } catch {
    // Leave fallback empty → client fetches as before.
  }

  return (
    <SWRConfig value={{ fallback }}>
      <DashboardClient />
    </SWRConfig>
  );
}
