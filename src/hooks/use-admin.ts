"use client";

import useSWR from "swr";
import { adminApi, fetcher } from "@/lib/api-client";
import type { AdminAuthState } from "@/types";

type AdminState = AdminAuthState & { authenticated: boolean };

/** Admin authentication state + actions (login / setup / logout). */
export function useAdmin() {
  const { data, error, isLoading, mutate } = useSWR<AdminState>(
    "/api/admin/auth",
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 0 },
  );

  return {
    configured: data?.configured ?? false,
    authenticated: data?.authenticated ?? false,
    locked: data?.locked ?? false,
    lockedUntil: data?.lockedUntil ?? null,
    attemptsRemaining: data?.attemptsRemaining ?? 5,
    isLoading,
    isError: Boolean(error),
    mutate,
    async login(password: string) {
      const res = await adminApi.login(password);
      await mutate();
      return res;
    },
    async setup(password: string, confirm: string) {
      const res = await adminApi.setup(password, confirm);
      await mutate();
      return res;
    },
    async logout() {
      await adminApi.logout();
      await mutate();
    },
  };
}
