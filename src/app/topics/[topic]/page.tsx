"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { Button } from "@/components/ui/button";
import { getTopicBySlug } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function TopicDetailPage() {
  const { topic: slug } = useParams<{ topic: string }>();
  const topic = getTopicBySlug(slug);
  const [selectedSubtopic, setSelectedSubtopic] = React.useState<string | null>(
    null,
  );

  if (!topic) {
    return (
      <EmptyState
        icon={<Icon name="FolderTree" className="h-7 w-7" />}
        title="Topic not found"
        description="This topic doesn't exist or may have been renamed."
        action={
          <Button asChild variant="outline">
            <Link href="/topics">Back to Topics</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={topic.name}
        description={topic.description}
        icon={<Icon name={topic.icon} className="h-6 w-6" />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedSubtopic(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            selectedSubtopic === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {topic.subtopics.map((sub) => (
          <button
            key={sub}
            type="button"
            onClick={() =>
              setSelectedSubtopic((cur) => (cur === sub ? null : sub))
            }
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              selectedSubtopic === sub
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {sub}
          </button>
        ))}
      </div>

      <QuestionsBrowser
        lockedFilters={{
          topic: topic.name,
          ...(selectedSubtopic ? { subtopic: selectedSubtopic } : {}),
        }}
        hide={["topic"]}
        emptyTitle={`No questions in ${topic.name} yet`}
        emptyDescription="Add questions from the Admin Panel."
      />
    </div>
  );
}
