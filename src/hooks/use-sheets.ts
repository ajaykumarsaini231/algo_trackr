"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { SheetProgress, SheetDetail } from "@/lib/sheets";

/** All sheets with live progress. */
export function useSheets() {
  const { data, error, isLoading, mutate } = useSWR<{ generatedAt: string; sheets: SheetProgress[] }>(
    "/api/sheets", fetcher, { revalidateOnFocus: false },
  );
  return { sheets: data?.sheets, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}

/** One sheet's detail + questions. `query` is an optional "?page=..&difficulty=.." string. */
export function useSheetDetail(key: string | undefined, query = "") {
  const k = key ? `/api/sheets/${key}${query}` : null;
  const { data, error, isLoading, mutate } = useSWR<SheetDetail>(k, fetcher, { revalidateOnFocus: false });
  return { sheet: data, isLoading, isError: Boolean(error), error: error as Error | undefined, mutate };
}
