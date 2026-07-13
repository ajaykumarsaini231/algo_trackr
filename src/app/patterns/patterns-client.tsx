"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { useStats } from "@/hooks/use-stats";
import { PATTERNS } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export default function PatternsClient() {
  const { stats } = useStats();

  const byPattern = new Map<string, { total: number; solved: number }>();
  for (const p of stats?.byPattern ?? []) {
    byPattern.set(p.pattern, { total: p.total, solved: p.solved });
  }

  return (
    <div>
      <PageHeader
        title="Patterns"
        description="Recognize the pattern, solve the problem."
        icon={<Icon name="Sparkles" className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PATTERNS.map((p, i) => {
          const stat = byPattern.get(p.name) ?? { total: 0, solved: 0 };
          const pct =
            stat.total > 0 ? Math.round((stat.solved / stat.total) * 100) : 0;

          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link
                href={`/patterns/${slugify(p.name)}`}
                className="block h-full"
              >
                <Card
                  glass
                  className="card-hover group flex h-full flex-col p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-500 ring-1 ring-inset ring-violet-500/20">
                      <Icon name={p.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="min-w-0 truncate font-semibold transition-colors group-hover:text-primary">
                      {p.name}
                    </h3>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-medium text-foreground">
                        {stat.solved}/{stat.total} solved
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
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
