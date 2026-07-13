"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { useStats } from "@/hooks/use-stats";
import { TOPICS } from "@/lib/constants";
import { pluralize } from "@/lib/utils";

export default function TopicsClient() {
  const { stats } = useStats();

  const progress = new Map<string, { total: number; solved: number }>();
  for (const t of stats?.byTopic ?? []) {
    progress.set(t.topic, { total: t.total, solved: t.solved });
  }

  return (
    <div>
      <PageHeader
        title="Topics"
        description="Every DSA topic, organized. Expand to explore subtopics and track progress."
        icon={<Icon name="FolderTree" className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t, i) => {
          const stat = progress.get(t.name) ?? { total: 0, solved: 0 };
          const pct =
            stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;

          return (
            <motion.div
              key={t.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link href={`/topics/${t.slug}`} className="block h-full">
                <Card
                  glass
                  className="card-hover group flex h-full flex-col p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-inset ring-primary/20">
                      <Icon name={t.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug transition-colors group-hover:text-primary">
                        {t.name}
                      </h3>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pluralize(t.subtopics.length, "subtopic")}</span>
                      <span className="font-medium text-foreground">
                        {stat.solved}/{stat.total} solved
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
