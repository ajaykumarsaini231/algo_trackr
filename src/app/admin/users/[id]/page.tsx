"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { useSession } from "next-auth/react";
import { ArrowLeft, ExternalLink, Eye, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminNav } from "@/components/admin/admin-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { DifficultyBadge } from "@/components/shared/badges";
import { Heatmap } from "@/components/charts/heatmap";
import { ProgressBars } from "@/components/charts/progress-bars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatRelative } from "@/lib/utils";
import { DIFFICULTY_DOT } from "@/lib/constants";
import { DIFFICULTIES } from "@/types";
import type { Stats } from "@/types";

// ---------- types mirrored from the admin APIs ----------

interface Profile {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin" | "superadmin";
  status: "active" | "blocked" | "suspended" | "deleted";
  createdAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  loginCount: number;
  provider: string;
}

interface Detail {
  profile: Profile;
  stats: Stats;
  learning: {
    stages: { key: string; name: string; level: string; solved: number; unlocked: boolean }[];
    currentStage: string;
    currentStageName: string;
  };
  googleReadiness: { coverageScore: number; progressScore: number; overall: number };
  sheets: { key: string; name: string; listSize: number | null; solved: number }[];
  revision: {
    dueToday: number;
    missed: number;
    upcoming: number;
    flagged: number;
    recentlyRevised: { questionId: string; lastRevisedAt: string; question: { title: string } | null }[];
  };
  timeline: { at: string; type: string; questionId: string; question: { title: string; difficulty: string; topic: string } | null }[];
  weakTopics: { topic: string; total: number; solved: number; pct: number }[];
}

interface HistoryItem {
  questionId: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  platform: string;
  problemLink: string;
  solutionLink: string;
  videoLink: string;
  status: string;
  favorite: boolean;
  rating: number;
  attemptCount: number;
  notes: string;
  solvedAt: string | null;
  updatedAt: string | null;
}

// ---------- small helpers ----------

async function adminPost(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: unknown } | null;
  if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`);
  return json.data;
}

function computeStreaks(days: { date: string; count: number }[]) {
  let max = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > max) max = run;
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i]!.count === 0) i--;
  for (; i >= 0 && days[i]!.count > 0; i--) current++;
  return { current, max };
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  blocked: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  suspended: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  deleted: "bg-zinc-500/15 text-zinc-500",
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

function OverviewStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums tracking-tight">{value.toLocaleString()}</span>
        {sub && <span className="text-xs tabular-nums text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const HISTORY_TABS = [
  { key: "all", label: "All" },
  { key: "solved", label: "Solved" },
  { key: "attempted", label: "Attempted" },
  { key: "favorite", label: "Favorites" },
  { key: "revision", label: "Revision" },
  { key: "notes", label: "Notes" },
] as const;

// ---------- page ----------

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const myRole = session?.user?.role;
  const isAdmin = myRole === "admin" || myRole === "superadmin";
  const isSuper = myRole === "superadmin";

  const detailKey = isAdmin && id ? `/api/admin/users/${id}` : null;
  const { data, error, isLoading } = useSWR<Detail>(detailKey, fetcher);

  const [busy, setBusy] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");

  // Question history state
  const [tab, setTab] = React.useState<(typeof HISTORY_TABS)[number]["key"]>("all");
  const [topicFilter, setTopicFilter] = React.useState("");
  const [historySearch, setHistorySearch] = React.useState("");
  const debouncedSearch = useDebounce(historySearch, 350);
  const [historyPages, setHistoryPages] = React.useState<{ items: HistoryItem[]; nextCursor: string | null }[]>([]);
  const [historyCursor, setHistoryCursor] = React.useState<string | null>(null);

  const hq = new URLSearchParams();
  hq.set("filter", tab);
  if (topicFilter) hq.set("topic", topicFilter);
  if (debouncedSearch.trim()) hq.set("search", debouncedSearch.trim());
  if (historyCursor) hq.set("cursor", historyCursor);
  hq.set("limit", "20");
  const historyKey = isAdmin && id ? `/api/admin/users/${id}/questions?${hq.toString()}` : null;
  const { data: historyData, isLoading: historyLoading } = useSWR<{ items: HistoryItem[]; nextCursor: string | null }>(
    historyKey,
    fetcher,
    { keepPreviousData: true },
  );

  const historySig = `${tab}|${topicFilter}|${debouncedSearch}`;
  const prevHistorySig = React.useRef(historySig);
  React.useEffect(() => {
    if (prevHistorySig.current !== historySig) {
      prevHistorySig.current = historySig;
      setHistoryPages([]);
      setHistoryCursor(null);
    }
  }, [historySig]);
  React.useEffect(() => {
    if (!historyData) return;
    setHistoryPages((prev) => {
      if (!historyCursor) return [historyData];
      if (prev.some((p) => p === historyData)) return prev;
      return [...prev, historyData];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData]);
  const historyItems = historyPages.flatMap((p) => p.items);
  const historyNext = historyPages.length ? historyPages[historyPages.length - 1]!.nextCursor : null;

  const refresh = React.useCallback(
    () => globalMutate((k) => typeof k === "string" && k.startsWith(`/api/admin/users/${id}`)),
    [id],
  );

  async function act(label: string, fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(label);
    try {
      await fn();
      await refresh();
      toast.success(label);
    } catch (err) {
      toast.error(label + " failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <div>
        <AdminNav />
        <EmptyState
          title="Admin account required"
          description="User management needs a role-based admin account (ADMIN_EMAILS)."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AdminNav />
        <EmptyState title="Couldn't load this user" description={(error as Error).message} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { profile: p, stats, learning, googleReadiness, sheets, revision, timeline, weakTopics } = data;
  const streaks = computeStreaks(stats.heatmap);
  const isTargetAdmin = p.role !== "user";
  const canModerate = isSuper || !isTargetAdmin;
  const companiesWithData = stats.byCompany.filter((c) => c.total > 0);

  return (
    <div>
      <AdminNav />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/users"
            className="mt-1 rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to users"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {(p.name || p.email)[0]?.toUpperCase()}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {editingName ? (
                <span className="flex items-center gap-1.5">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="h-7 w-48 text-sm"
                    maxLength={80}
                  />
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={busy !== null}
                    onClick={() =>
                      act("Name updated", async () => {
                        await adminPost(`/api/admin/users/${p.id}`, { name: nameDraft }, "PATCH");
                        setEditingName(false);
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingName(false)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <h1 className="text-lg font-semibold tracking-tight">{p.name || p.email.split("@")[0]}</h1>
              )}
              <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", p.role === "user" ? "text-muted-foreground" : "text-primary border-primary/40")}>
                {p.role}
              </span>
              <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[p.status])}>{p.status}</span>
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Eye className="h-3 w-3" /> Viewing as admin · read-only
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{p.email}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {!editingName && canModerate && p.status !== "deleted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNameDraft(p.name);
                setEditingName(true);
              }}
            >
              Edit name
            </Button>
          )}
          {isSuper && p.role === "user" && p.status === "active" && (
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                act("Impersonation started", async () => {
                  await adminPost(`/api/admin/users/${p.id}/impersonate`);
                  router.push("/");
                  router.refresh();
                })
              }
            >
              Login as user
            </Button>
          )}
          {canModerate && p.status !== "deleted" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => act("Sessions revoked", () => adminPost(`/api/admin/users/${p.id}/logout`))}
              >
                Force logout
              </Button>
              {p.status === "blocked" ? (
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => act("User unblocked", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "unblock" }))}>
                  Unblock
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => act("User blocked", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "block" }),
                    "Block this user? They will be signed out everywhere and cannot log in.")}>
                  Block
                </Button>
              )}
              {p.status === "suspended" ? (
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => act("User reactivated", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "reactivate" }))}>
                  Reactivate
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => act("User suspended", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "suspend" }),
                    "Suspend this user? They will be signed out everywhere until reactivated.")}>
                  Suspend
                </Button>
              )}
            </>
          )}
          {isSuper && p.role !== "superadmin" && p.status !== "deleted" && (
            <>
              <select
                value={p.role}
                disabled={busy !== null}
                onChange={(e) =>
                  act(`Role changed to ${e.target.value}`, () =>
                    adminPost(`/api/admin/users/${p.id}`, { role: e.target.value }, "PATCH"),
                  )
                }
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                aria-label="Change role"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => act("Progress reset", () => adminPost(`/api/admin/users/${p.id}/reset-progress`, { scope: "all" }),
                  "Reset ALL progress for this user? Solved status, notes, favorites and revision data will be permanently removed.")}>
                Reset progress
              </Button>
              <Button size="sm" variant="destructive" disabled={busy !== null}
                onClick={() => act("User deleted (soft)", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "delete" }),
                  "Soft-delete this account? The user can no longer sign in; data is kept and the account can be restored.")}>
                Delete
              </Button>
            </>
          )}
          {isSuper && p.status === "deleted" && (
            <Button size="sm" disabled={busy !== null}
              onClick={() => act("User restored", () => adminPost(`/api/admin/users/${p.id}/status`, { action: "restore" }))}>
              Restore account
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Profile facts */}
        <section className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="User ID" value={<span className="font-mono text-xs">{p.id}</span>} />
          <Fact label="Registered" value={p.createdAt ? formatRelative(p.createdAt) : "—"} />
          <Fact label="Last login" value={p.lastLoginAt ? formatRelative(p.lastLoginAt) : "never"} />
          <Fact label="Last active" value={p.lastActiveAt ? formatRelative(p.lastActiveAt) : "—"} />
          <Fact label="Login count" value={p.loginCount} />
          <Fact label="Provider" value={p.provider} />
        </section>

        {/* Overview strip */}
        <section className="overflow-hidden rounded-lg border bg-border">
          <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6">
            <OverviewStat label="Total" value={stats.total} />
            <OverviewStat label="Solved" value={stats.solved} sub={`${stats.completionPercentage}%`} />
            <OverviewStat label="Attempted" value={stats.attempted} />
            <OverviewStat label="Unsolved" value={stats.unsolved} />
            <OverviewStat label="Revision due" value={stats.revisionDue} />
            <OverviewStat label="Favorites" value={stats.favorites} />
          </div>
          <div className="space-y-2 border-t bg-card px-4 py-3">
            {DIFFICULTIES.map((d) => {
              const total = stats.byDifficulty[d];
              const solved = stats.solvedByDifficulty[d];
              const pct = total ? Math.round((solved / total) * 100) : 0;
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="flex w-20 shrink-0 items-center gap-2 text-[13px] font-medium">
                    <span className={cn("h-2 w-2 rounded-full", DIFFICULTY_DOT[d])} />
                    {d}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", DIFFICULTY_DOT[d])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {solved.toLocaleString()} / {total.toLocaleString()} solved
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Readiness / stage / revision */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Google readiness
            </h2>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">{googleReadiness.overall}%</span>
              <span className="text-xs text-muted-foreground">overall</span>
            </div>
            <div className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              <div className="flex justify-between"><span>Coverage</span><span className="tabular-nums">{googleReadiness.coverageScore}%</span></div>
              <div className="flex justify-between"><span>Progress</span><span className="tabular-nums">{googleReadiness.progressScore}%</span></div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Learning stage</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Currently in <span className="font-medium text-foreground">{learning.currentStageName}</span>
            </p>
            <ul className="mt-3 space-y-1.5">
              {learning.stages.map((s) => (
                <li key={s.key} className="flex items-center justify-between text-[13px]">
                  <span className={cn("font-medium", !s.unlocked && "text-muted-foreground")}>
                    {s.name} <span className="text-xs text-muted-foreground">({s.level})</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.unlocked ? `${s.solved.toLocaleString()} solved` : "locked"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Revision</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Fact label="Due today" value={revision.dueToday} />
              <Fact label="Missed" value={revision.missed} />
              <Fact label="Upcoming" value={revision.upcoming} />
              <Fact label="Flagged" value={revision.flagged} />
            </div>
            {revision.recentlyRevised.length > 0 && (
              <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                {revision.recentlyRevised.slice(0, 4).map((r) => (
                  <li key={r.questionId} className="flex justify-between gap-2">
                    <span className="truncate">{r.question?.title ?? r.questionId}</span>
                    <span className="shrink-0">{formatRelative(r.lastRevisedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Activity + monthly */}
        <div className="grid gap-4 lg:grid-cols-5">
          <section className="rounded-lg border bg-card p-4 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Activity</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span><span className="font-semibold tabular-nums text-foreground">{streaks.current}</span> day streak</span>
                <span aria-hidden>·</span>
                <span><span className="font-semibold tabular-nums text-foreground">{streaks.max}</span> max</span>
              </div>
            </div>
            <Heatmap data={stats.heatmap} />
          </section>

          <section className="rounded-lg border bg-card p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold">Monthly progress</h2>
            <ul className="mt-3 space-y-1.5">
              {stats.monthlyProgress.map((m) => (
                <li key={m.month} className="flex items-center justify-between text-[13px]">
                  <span className="w-10 font-medium">{m.month}</span>
                  <span className="tabular-nums text-muted-foreground">{m.added.toLocaleString()} added</span>
                  <span className="tabular-nums">{m.solved.toLocaleString()} solved</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Topics / patterns / weak */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Topic progress</h2>
            <div className="max-h-96 overflow-y-auto pr-1">
              <ProgressBars
                data={stats.byTopic
                  .filter((t) => t.total > 0)
                  .sort((a, b) => b.total - a.total)
                  .map((t) => ({ label: t.topic, total: t.total, solved: t.solved }))}
                emptyLabel="No topics"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Click a history row's topic to filter the question list below.</p>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Pattern progress</h2>
            <div className="max-h-96 overflow-y-auto pr-1">
              <ProgressBars
                data={stats.byPattern
                  .filter((t) => t.total > 0)
                  .sort((a, b) => b.total - a.total)
                  .map((t) => ({ label: t.pattern, total: t.total, solved: t.solved }))}
                emptyLabel="No pattern data"
              />
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Sheets</h2>
              <ul className="space-y-1.5">
                {sheets.map((s) => (
                  <li key={s.key} className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.solved.toLocaleString()}{s.listSize ? ` / ${s.listSize}` : ""} solved
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Weak topics</h2>
              {weakTopics.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No high-priority gaps yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {weakTopics.map((t) => (
                    <li key={t.topic} className="flex items-center justify-between text-[13px]">
                      <span className="font-medium">{t.topic}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t.solved}/{t.total} · {Math.round(t.pct)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* Companies */}
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Company progress</h2>
          {companiesWithData.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No company data — the catalog's <code className="rounded bg-muted px-1">companies</code> field is not populated yet, so
              company progress and readiness cannot be computed honestly.
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {companiesWithData.map((c) => (
                <div key={c.company} className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{c.company}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.solved}/{c.total} · {c.total ? Math.round((c.solved / c.total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Learning timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-2">
              {timeline.map((e, i) => {
                const label = dayLabel(e.at);
                const prev = i > 0 ? dayLabel(timeline[i - 1]!.at) : null;
                return (
                  <li key={`${e.questionId}-${e.type}-${e.at}`}>
                    {label !== prev && (
                      <div className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0">
                        {label}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[13px]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          e.type === "solved" ? "bg-emerald-500" : "bg-amber-500",
                        )}
                      />
                      <span className="text-muted-foreground">{e.type === "solved" ? "Solved" : "Revised"}</span>
                      <span className="truncate font-medium">{e.question?.title ?? e.questionId}</span>
                      {e.question && <span className="text-xs text-muted-foreground">· {e.question.topic}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Question history */}
        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <h2 className="mr-2 text-sm font-semibold">Question history</h2>
            <div className="flex items-center gap-0.5 rounded-md border p-0.5">
              {HISTORY_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    tab === t.key ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {topicFilter && (
              <button
                onClick={() => setTopicFilter("")}
                className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                title="Clear topic filter"
              >
                {topicFilter} ×
              </button>
            )}
            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search titles and notes…"
              className="ml-auto h-8 w-56 rounded-md border border-input bg-muted/50 px-2.5 text-[13px] outline-none focus:border-primary/50 focus:bg-background"
            />
          </div>

          {historyItems.length === 0 && !historyLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing here for this filter.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {historyItems.map((q) => (
                <li key={q.questionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{q.title}</span>
                      {q.problemLink && (
                        <a href={q.problemLink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open problem">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <button className="hover:text-foreground hover:underline" onClick={() => setTopicFilter(q.topic)}>
                        {q.topic}
                      </button>
                      <span>· {q.platform}</span>
                      {q.rating > 0 && <span>· ★ {q.rating}</span>}
                      {q.attemptCount > 0 && <span>· {q.attemptCount} attempt{q.attemptCount === 1 ? "" : "s"}</span>}
                      {q.favorite && <span>· favorite</span>}
                      {q.solutionLink && (
                        <a href={q.solutionLink} target="_blank" rel="noreferrer" className="underline hover:text-foreground">solution</a>
                      )}
                      {q.videoLink && (
                        <a href={q.videoLink} target="_blank" rel="noreferrer" className="underline hover:text-foreground">video</a>
                      )}
                    </div>
                    {q.notes && (
                      <p className="mt-1 line-clamp-2 rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{q.notes}</p>
                    )}
                  </div>
                  <DifficultyBadge difficulty={q.difficulty} />
                  <span className="w-24 text-right text-xs text-muted-foreground">{q.status}</span>
                  <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {q.updatedAt ? formatRelative(q.updatedAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t p-3">
            <p className="text-xs text-muted-foreground">{historyItems.length} shown</p>
            {historyNext && (
              <Button variant="outline" size="sm" disabled={historyLoading} onClick={() => setHistoryCursor(historyNext)}>
                {historyLoading ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
