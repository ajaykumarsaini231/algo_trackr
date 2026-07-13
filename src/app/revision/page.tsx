import { listPageData } from "@/lib/ssr-fallback";
import RevisionClient from "./revision-client";

export const dynamic = "force-dynamic";

/**
 * Server shell — server-renders the revision queue (fixed
 * `{ revision: true, limit: 500 }` query) so the spaced-repetition buckets
 * paint on first byte. Bucketing into Today/Tomorrow/… stays client-side.
 */
export default async function RevisionPage() {
  const initialData = await listPageData({ revision: true, limit: 500 });
  return <RevisionClient initialData={initialData} />;
}
