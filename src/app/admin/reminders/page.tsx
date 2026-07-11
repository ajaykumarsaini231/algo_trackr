"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";

interface ReminderRow {
  userId: string;
  email: string;
  name: string;
  accountStatus: string;
  phone: string;
  timezone: string;
  goalMinutes: number;
  window: string;
  activeMinutesToday: number;
  goalCompleted: boolean;
  isActiveNow: boolean;
  lastHeartbeat: string | null;
  lastReminderSentAt: string | null;
  lastSendStatus: "none" | "ok" | "failed";
  lastSendError: string;
  sentToday: number;
  failedToday: number;
}

interface RemindersPayload {
  configured: boolean;
  summary: { enabledTotal: number; sent24: number; failed24: number };
  items: ReminderRow[];
  nextCursor: string | null;
  recentFailures: {
    id: string;
    email: string;
    to: string;
    slotKey: string;
    errorType: string;
    errorCode: string;
    errorMessage: string;
    createdAt: string;
  }[];
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "bad" | "ok" }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums tracking-tight",
          tone === "bad" && "text-rose-500",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function AdminRemindersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isSuper = role === "superadmin";

  const [cursor, setCursor] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<RemindersPayload[]>([]);
  const [dryRunning, setDryRunning] = React.useState(false);
  const [dryResult, setDryResult] = React.useState<string>("");

  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "30");
  const { data, error, isLoading, mutate } = useSWR<RemindersPayload>(
    isAdmin ? `/api/admin/reminders?${qs.toString()}` : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 },
  );

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
  const head = pages[0] ?? data;

  async function runDry() {
    setDryRunning(true);
    setDryResult("");
    try {
      const res = await fetch("/api/reminders/run?dryRun=1", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
      const s = json.data;
      setDryResult(JSON.stringify(s, null, 2));
      toast.success(`Dry run: ${s.wouldSend} would send, ${s.checked} checked`);
      await mutate();
    } catch (err) {
      toast.error("Dry run failed", { description: (err as Error).message });
    } finally {
      setDryRunning(false);
    }
  }

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <div>
        <AdminNav />
        <EmptyState title="Admin account required" description="Reminder management needs a role-based admin account." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp reminders"
        description="Who gets nudged, when, and what Meta said about it."
        actions={
          isSuper ? (
            <Button size="sm" variant="outline" onClick={runDry} disabled={dryRunning}>
              {dryRunning ? "Evaluating…" : "Dry-run now"}
            </Button>
          ) : undefined
        }
      />
      <AdminNav />

      {error && <EmptyState title="Couldn't load reminder data" description={(error as Error).message} />}

      {!error && head && (
        <div className="space-y-4">
          {!head.configured && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              WhatsApp credentials are not configured — the engine evaluates eligibility but cannot send.
            </p>
          )}

          {/* Summary */}
          <section className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
            <Stat label="Reminders enabled" value={head.summary.enabledTotal.toLocaleString()} />
            <Stat label="Sent (24h)" value={head.summary.sent24.toLocaleString()} tone="ok" />
            <Stat label="Failed (24h)" value={head.summary.failed24.toLocaleString()} tone={head.summary.failed24 > 0 ? "bad" : undefined} />
          </section>

          {/* Users */}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Phone</th>
                  <th className="px-3 py-2.5 font-medium">Window (local)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Today</th>
                  <th className="px-3 py-2.5 font-medium">Goal</th>
                  <th className="px-3 py-2.5 font-medium">Now</th>
                  <th className="px-3 py-2.5 font-medium">Last heartbeat</th>
                  <th className="px-3 py-2.5 font-medium">Last reminder</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sent</th>
                  <th className="px-3 py-2.5 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => (
                  <tr key={r.userId} className="transition-colors hover:bg-accent/40">
                    <td className="max-w-52 px-3 py-2">
                      <Link href={`/admin/users/${r.userId}`} className="block truncate font-medium hover:text-primary">
                        {r.name || r.email}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{r.timezone}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.phone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{r.window}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.activeMinutesToday}<span className="text-muted-foreground">/{r.goalMinutes}m</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium",
                        r.goalCompleted ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                        {r.goalCompleted ? "done" : "pending"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs", r.isActiveNow ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", r.isActiveNow ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                        {r.isActiveNow ? "active" : "away"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {r.lastHeartbeat ? formatRelative(r.lastHeartbeat) : "never"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="text-muted-foreground">{r.lastReminderSentAt ? formatRelative(r.lastReminderSentAt) : "never"}</span>
                      {r.lastSendStatus === "failed" && (
                        <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium text-rose-500" title={r.lastSendError}>
                          failed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.sentToday}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", r.failedToday > 0 && "text-rose-500")}>{r.failedToday}</td>
                  </tr>
                ))}
                {rows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Nobody has enabled WhatsApp reminders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" disabled={isLoading} onClick={() => setCursor(nextCursor)}>
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}

          {/* Failures / retry queue */}
          <section className="rounded-lg border bg-card">
            <div className="border-b p-3">
              <h2 className="text-sm font-semibold">Recent failed messages</h2>
              <p className="text-xs text-muted-foreground">
                Failures retry automatically on the next slot; dead numbers and token errors need action here.
              </p>
            </div>
            {head.recentFailures.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No failures recorded.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {head.recentFailures.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                    <span className="font-medium">{f.email}</span>
                    <span className="font-mono text-xs text-muted-foreground">{f.to}</span>
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-medium text-rose-500">
                      {f.errorType}{f.errorCode ? ` · ${f.errorCode}` : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={f.errorMessage}>
                      {f.errorMessage}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelative(f.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {dryResult && (
            <section className="rounded-lg border bg-card p-3">
              <h2 className="mb-2 text-sm font-semibold">Dry-run result</h2>
              <pre className="max-h-80 overflow-auto rounded bg-muted/50 p-3 text-xs">{dryResult}</pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
