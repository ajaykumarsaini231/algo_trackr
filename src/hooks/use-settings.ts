"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";

export interface AppSettings {
  siteName: string;
  accentColor: string;
  defaultPageSize: number;
  defaultTheme: string;
  revisionIntervals: number[];
  showConfetti: boolean;
  compactMode: boolean;
}

/** Read server-side application settings (public). Writes require admin. */
export function useSettings() {
  const { data, isLoading, mutate } = useSWR<AppSettings>("/api/settings", fetcher, {
    revalidateOnFocus: false,
  });
  return { settings: data, isLoading, mutate };
}
