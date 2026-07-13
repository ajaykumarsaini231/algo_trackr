import { getCompanyBySlug } from "@/lib/constants";
import { listInitialData } from "@/lib/ssr-fallback";
import CompanyDetailClient from "./company-detail-client";

export const dynamic = "force-dynamic";

/**
 * Server shell — resolves the company slug and server-renders the first page of
 * its questions so the list paints instantly. The summary stat cards fill in
 * from the (now indexed + slim) client fetch a moment later.
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const name = getCompanyBySlug(slug);
  const initialData = name ? await listInitialData({ company: name }) : undefined;
  return <CompanyDetailClient initialData={initialData} />;
}
