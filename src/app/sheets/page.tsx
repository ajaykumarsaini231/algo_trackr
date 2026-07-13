import { SWRConfig } from "swr";
import { computeSheetsProgress } from "@/lib/sheets-progress";
import { ssrFallback } from "@/lib/ssr-fallback";
import SheetsClient from "./sheets-client";

export const dynamic = "force-dynamic";

/** Server shell — seeds SWR (key "/api/sheets") so sheet cards paint on first render. */
export default async function SheetsPage() {
  const fallback = await ssrFallback("/api/sheets", computeSheetsProgress);
  return (
    <SWRConfig value={{ fallback }}>
      <SheetsClient />
    </SWRConfig>
  );
}
