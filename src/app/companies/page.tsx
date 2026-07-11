"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { useStats } from "@/hooks/use-stats";
import { COMPANIES } from "@/lib/constants";
import { slugify } from "@/lib/utils";

export default function CompaniesPage() {
  const { stats } = useStats();

  const byCompany = new Map<string, { total: number; solved: number }>();
  for (const c of stats?.byCompany ?? []) {
    byCompany.set(c.company, { total: c.total, solved: c.solved });
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Target your prep. Track progress company by company."
        icon={<Icon name="Building2" className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPANIES.map((name, i) => {
          const stat = byCompany.get(name) ?? { total: 0, solved: 0 };
          const remaining = Math.max(stat.total - stat.solved, 0);

          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link href={`/companies/${slugify(name)}`} className="block h-full">
                <Card
                  glass
                  className="card-hover group flex h-full flex-col p-5"
                >
                  <div className="flex items-center gap-3">
                    <CompanyAvatar name={name} size={44} />
                    <h3 className="min-w-0 truncate font-semibold transition-colors group-hover:text-primary">
                      {name}
                    </h3>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 py-2">
                      <div className="text-lg font-bold text-emerald-500">
                        {stat.solved}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Solved
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <div className="text-lg font-bold">{stat.total}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Total
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-2">
                      <div className="text-lg font-bold text-muted-foreground">
                        {remaining}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Remaining
                      </div>
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
