"use client";

import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionList } from "@/components/questions/question-list";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuestions } from "@/hooks/use-questions";
import type { Paginated, Question } from "@/types";

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function RevisionClient({
  initialData,
}: {
  initialData?: Paginated<Question>;
}) {
  const { questions, isLoading } = useQuestions({ revision: true, limit: 500 }, initialData);

  const todayStart = startOfDay(new Date());
  const tomorrowStart = todayStart + DAY;
  const dayAfterStart = todayStart + 2 * DAY;
  const weekEnd = todayStart + 7 * DAY;

  const missed: Question[] = [];
  const today: Question[] = [];
  const tomorrow: Question[] = [];
  const thisWeek: Question[] = [];

  for (const q of questions) {
    if (!q.revisionDate) continue;
    const t = new Date(q.revisionDate).getTime();
    if (Number.isNaN(t)) continue;

    if (t < todayStart) {
      missed.push(q);
    } else if (t < tomorrowStart) {
      today.push(q);
    } else if (t < dayAfterStart) {
      tomorrow.push(q);
    } else if (t <= weekEnd) {
      thisWeek.push(q);
    }
  }

  const buckets = [
    {
      value: "today",
      label: "Today",
      items: today,
      emptyTitle: "Nothing due today",
      emptyDescription: "You're all caught up. Great work!",
    },
    {
      value: "tomorrow",
      label: "Tomorrow",
      items: tomorrow,
      emptyTitle: "Nothing due tomorrow",
      emptyDescription: "No revisions scheduled for tomorrow yet.",
    },
    {
      value: "week",
      label: "This Week",
      items: thisWeek,
      emptyTitle: "Nothing later this week",
      emptyDescription: "No revisions scheduled for the coming week.",
    },
    {
      value: "missed",
      label: "Missed",
      items: missed,
      emptyTitle: "Nothing missed",
      emptyDescription: "You haven't fallen behind. Keep it up!",
    },
    {
      value: "all",
      label: "All",
      items: questions,
      emptyTitle: "No revisions yet",
      emptyDescription:
        "Flag a question for revision to start building your spaced-repetition queue.",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Revision"
        description="Spaced repetition — never forget a pattern."
        icon={<Icon name="RotateCcw" className="h-6 w-6" />}
      />

      <Tabs defaultValue="today">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {buckets.map((b) => (
            <TabsTrigger key={b.value} value={b.value}>
              {b.label}
              <Badge variant="secondary">{b.items.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {buckets.map((b) => (
          <TabsContent key={b.value} value={b.value} className="mt-4">
            <QuestionList
              questions={b.items}
              isLoading={isLoading}
              emptyTitle={b.emptyTitle}
              emptyDescription={b.emptyDescription}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
