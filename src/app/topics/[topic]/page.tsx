import { getTopicBySlug } from "@/lib/constants";
import { listInitialData } from "@/lib/ssr-fallback";
import TopicDetailClient from "./topic-detail-client";

export const dynamic = "force-dynamic";

/**
 * Server shell — resolves the topic slug and server-renders the first page of
 * its questions (default "All" subtopic view) so it paints instantly. Subtopic
 * switching and pagination stay client-side in TopicDetailClient.
 */
export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: slug } = await params;
  const topic = getTopicBySlug(slug);
  const initialData = topic ? await listInitialData({ topic: topic.name }) : undefined;
  return <TopicDetailClient initialData={initialData} />;
}
