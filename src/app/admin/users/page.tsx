"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatRelative } from "@/lib/utils";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin" | "superadmin";
  status: "active" | "blocked" | "suspended" | "deleted";
  createdAt: string | null;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  loginCount: number;
  solved: number;
  progressPct: number;
  favorites: number;
  revision: number;
  notes: number;
  lastActivity: string | null;
}

interface UsersPage {
  items: AdminUserRow[];
  total: number;
  nextCursor: string | null;
  catalogTotal: number;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  blocked: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  suspended: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  deleted: "bg-zinc-500/15 text-zinc-500",
};

const ROLE_STYLE: Record<string, string> = {
  superadmin: "border-primary/40 text-primary",
  admin: "border-border text-foreground",
  user: "border-border text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "admin" || role === "superadmin";

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [sort, setSort] = React.useState("createdAt:desc");
  const debounced = useDebounce(search, 350);

  // Accumulated pages (cursor pagination).
  const [pages, setPages] = React.useState<UsersPage[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);

  const [sortKey, sortDir] = sort.split(":");
  const qs = new URLSearchParams();
  if (debounced.trim()) qs.set("search", debounced.trim());
  if (statusFilter) qs.set("status", statusFilter);
  if (roleFilter) qs.set("role", roleFilter);
  qs.set("sort", sortKey!);
  qs.set("dir", sortDir === "asc" ? "asc" : "desc");
  if (cursor) qs.set("cursor", cursor);
  qs.set("limit", "25");

  const key = isAdmin ? `/api/admin/users?${qs.toString()}` : null;
  const { data, isLoading, error } = useSWR<UsersPage>(key, fetcher, {
    keepPreviousData: true,
  });

  // Reset accumulation whenever the filters change (cursor null = first page).
  const filterSig = `${debounced}|${statusFilter}|${roleFilter}|${sort}`;
  const prevSig = React.useRef(filterSig);
  React.useEffect(() => {
    if (prevSig.current !== filterSig) {
      prevSig.current = filterSig;
      setPages([]);
      setCursor(null);
    }
  }, [filterSig]);

  React.useEffect(() => {
    if (!data) return;
    setPages((prev) => {
      // First page replaces; subsequent cursors append.
      if (!cursor) return [data];
      if (prev.some((p) => p === data)) return prev;
      return [...prev, data];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = pages.flatMap((p) => p.items);
  const nextCursor = pages.length ? pages[pages.length - 1]!.nextCursor : null;
  const total = pages[0]?.total ?? data?.total ?? 0;

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <div>
        <AdminNav />
        <EmptyState
          title="Admin account required"
          description="User management needs a role-based admin account (set via ADMIN_EMAILS). The panel key alone doesn't grant access to user data."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${total.toLocaleString()} registered account${total === 1 ? "" : "s"}.`}
      />
      <AdminNav />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or user id…"
            className="h-8 w-full rounded-md border border-input bg-muted/50 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
          <option value="never-logged-in">Never logged in</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
          aria-label="Sort"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="lastLoginAt:desc">Recent login</option>
          <option value="loginCount:desc">Most logins</option>
          <option value="solved:desc">Most solved</option>
          <option value="name:asc">Name (A–Z)</option>
        </select>
      </div>

      {error && (
        <EmptyState title="Couldn't load users" description={String((error as Error).message)} />
      )}

      {!error && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[880px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Solved</th>
                <th className="px-3 py-2.5 text-right font-medium">Progress</th>
                <th className="px-3 py-2.5 text-right font-medium">Favs</th>
                <th className="px-3 py-2.5 text-right font-medium">Rev</th>
                <th className="px-3 py-2.5 text-right font-medium">Notes</th>
                <th className="px-3 py-2.5 text-right font-medium">Logins</th>
                <th className="px-3 py-2.5 font-medium">Last login</th>
                <th className="px-3 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((u) => (
                <tr key={u.id} className="group transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                        {(u.name || u.email)[0]?.toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:text-primary">
                          {u.name || u.email.split("@")[0]}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", ROLE_STYLE[u.role])}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={u.status} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.solved.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.progressPct}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.favorites}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.revision}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.notes}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{u.loginCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "never"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {u.createdAt ? formatRelative(u.createdAt) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length.toLocaleString()} of {total.toLocaleString()}
        </p>
        {nextCursor && (
          <Button variant="outline" size="sm" disabled={isLoading} onClick={() => setCursor(nextCursor)}>
            {isLoading ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
