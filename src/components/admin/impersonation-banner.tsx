"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { useSession } from "next-auth/react";
import { Eye } from "lucide-react";
import { fetcher } from "@/lib/api-client";

interface ImpersonationState {
  active: boolean;
  target?: { id: string; email: string; name: string } | null;
}

/**
 * Fixed banner shown while a superadmin is impersonating a user, with a
 * one-click return to the admin account. Only superadmin sessions even ask
 * the server about impersonation state.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const isSuper = session?.user?.role === "superadmin";

  const { data } = useSWR<ImpersonationState>(
    isSuper ? "/api/admin/impersonation" : null,
    fetcher,
    { refreshInterval: 60_000 },
  );

  if (!isSuper || !data?.active || !data.target) return null;

  async function stop() {
    await fetch("/api/admin/impersonation", { method: "DELETE" });
    // Every cached view currently holds the TARGET user's data — drop it all.
    await globalMutate(() => true, undefined, { revalidate: false });
    router.push(`/admin/users/${data!.target!.id}`);
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[13px]">
      <Eye className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      <span>
        Viewing as{" "}
        <span className="font-semibold">{data.target.name || data.target.email}</span>{" "}
        <span className="text-muted-foreground">({data.target.email})</span>
      </span>
      <button
        onClick={stop}
        className="rounded border border-amber-500/40 bg-background px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent"
      >
        Return to admin
      </button>
    </div>
  );
}
