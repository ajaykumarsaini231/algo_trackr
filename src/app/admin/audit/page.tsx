"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/shared/page-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";

interface AuditItem {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  ip: string;
  userAgent: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

interface AuditPage {
  items: AuditItem[];
  nextCursor: string | null;
}

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "auth.*", label: "Authentication" },
  { value: "admin.*", label: "Admin actions" },
  { value: "admin.impersonate_start", label: "Impersonation" },
  { value: "admin.user_block", label: "Blocks" },
  { value: "admin.user_reset_progress", label: "Progress resets" },
];

export default function AdminAuditPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin" || role === "superadmin";

  const [action, setAction] = React.useState("");
  const [pages, setPages] = React.useState<AuditPage[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);

  const qs = new URLSearchParams();
  if (action) qs.set("action", action);
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "40");

  const { data, error, isLoading } = useSWR<AuditPage>(
    isAdmin ? `/api/admin/audit-logs?${qs.toString()}` : null,
    fetcher,
    { keepPreviousData: true },
  );

  const prevAction = React.useRef(action);
  React.useEffect(() => {
    if (prevAction.current !== action) {
      prevAction.current = action;
      setPages([]);
      setCursor(null);
    }
  }, [action]);
  React.useEffect(() => {
    if (!data) return;
    setPages((prev) => {
      if (!cursor) return [data];
      if (prev.some((p) => p === data)) return prev;
      return [...prev, data];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = pages.flatMap((p) => p.items);
  const nextCursor = pages.length ? pages[pages.length - 1]!.nextCursor : null;

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <div>
        <AdminNav />
        <EmptyState title="Admin account required" description="Audit logs need a role-based admin account." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit logs" description="Every security-relevant event, retained for 90 days." />
      <AdminNav />

      <div className="mb-4">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
          aria-label="Filter by action"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {error && <EmptyState title="Couldn't load audit logs" description={(error as Error).message} />}

      {!error && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">When</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Actor</th>
                <th className="px-3 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 font-medium">IP</th>
                <th className="px-3 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatRelative(r.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-3 py-2">
                    {r.actorId ? (
                      <Link href={`/admin/users/${r.actorId}`} className="hover:text-primary hover:underline">
                        {r.actorEmail}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">anonymous</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.targetUserId ? (
                      <Link href={`/admin/users/${r.targetUserId}`} className="hover:text-primary hover:underline">
                        {r.targetEmail}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{r.ip || "—"}</td>
                  <td className="max-w-80 px-3 py-2">
                    {Object.keys(r.meta).length > 0 ? (
                      <code className="block truncate rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {JSON.stringify(r.meta)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" disabled={isLoading} onClick={() => setCursor(nextCursor)}>
            {isLoading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
