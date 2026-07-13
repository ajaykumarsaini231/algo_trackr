"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { Icon } from "@/components/shared/icon";
import { EmptyState } from "@/components/shared/empty-state";
import { QuestionsBrowser } from "@/components/questions/questions-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuestions } from "@/hooks/use-questions";
import { getCompanyBySlug } from "@/lib/constants";
import { cn, pluralize } from "@/lib/utils";
import type { Difficulty, Paginated, Question } from "@/types";

export default function CompanyDetailClient({
  initialData,
}: {
  initialData?: Paginated<Question>;
}) {
  const { company: slug } = useParams<{ company: string }>();
  const name = getCompanyBySlug(slug);

  const { questions, isLoading } = useQuestions(
    name ? { company: name, limit: 1000 } : {},
  );

  if (!name) {
    return (
      <EmptyState
        icon={<Icon name="Building2" className="h-7 w-7" />}
        title="Company not found"
        description="This company doesn't exist or may have been renamed."
        action={
          <Button asChild variant="outline">
            <Link href="/companies">Back to Companies</Link>
          </Button>
        }
      />
    );
  }

  const byDifficulty: Record<Difficulty, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  let solved = 0;
  for (const q of questions) {
    byDifficulty[q.difficulty] += 1;
    if (q.status === "Solved") solved += 1;
  }
  const total = questions.length;
  const remaining = Math.max(total - solved, 0);

  const stats: {
    label: string;
    value: number;
    className?: string;
  }[] = [
    { label: "Easy", value: byDifficulty.Easy, className: "text-emerald-500" },
    { label: "Medium", value: byDifficulty.Medium, className: "text-amber-500" },
    { label: "Hard", value: byDifficulty.Hard, className: "text-rose-500" },
    { label: "Solved", value: solved },
    { label: "Remaining", value: remaining },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <CompanyAvatar name={name} size={56} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? "Loading questions…"
              : `${pluralize(total, "question")} tagged for ${name}`}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} glass className="p-4 text-center">
            <div className={cn("text-2xl font-bold", s.className)}>
              {s.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <QuestionsBrowser lockedFilters={{ company: name }} hide={["company"]} initialData={initialData} />
    </div>
  );
}
