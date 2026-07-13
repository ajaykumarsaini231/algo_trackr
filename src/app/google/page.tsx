import { SWRConfig } from "swr";
import { computeGoogleRoadmap } from "@/lib/google-roadmap";
import { ssrFallback } from "@/lib/ssr-fallback";
import GoogleClient from "./google-client";

export const dynamic = "force-dynamic";

/**
 * Server shell for /google — computes the roadmap on the server and seeds SWR
 * (key "/api/google") so the page paints real data on first render instead of
 * the loading skeleton.
 */
export default async function GooglePage() {
  const fallback = await ssrFallback("/api/google", computeGoogleRoadmap);
  return (
    <SWRConfig value={{ fallback }}>
      <GoogleClient />
    </SWRConfig>
  );
}
