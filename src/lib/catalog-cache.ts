import "server-only";

/**
 * In-process TTL cache for USER-INDEPENDENT catalog aggregations.
 *
 * Dashboard stats, the pattern/sheet/company/learn rollups, etc. all recompute
 * the SAME catalog-wide numbers for every user on every request (byDifficulty,
 * byTopic, per-sheet totals, …). The catalog is read-mostly — it only changes
 * when an admin creates/edits/imports/seeds questions — so we memoize these
 * results behind a short TTL and drop the whole cache on any catalog write.
 *
 * Serverless note: the cache lives per warm function instance (no shared store
 * needed). A cold instance recomputes once; every warm hit is free. The TTL
 * bounds staleness even if a write on another instance doesn't reach this one,
 * and `bumpCatalogVersion()` invalidates proactively on the instance that wrote.
 */

interface Entry {
  at: number;
  value: unknown;
}

const store = new Map<string, Entry>();
let version = 0;

/** Default TTL — catalog edits are admin-only and infrequent. */
export const CATALOG_TTL_MS = 60_000;

/** Invalidate every cached catalog aggregation (call on any question write). */
export function bumpCatalogVersion(): void {
  version += 1;
  store.clear();
}

/**
 * Return a cached catalog value or compute+store it. `key` must fully describe
 * the query (include any parameters). The compute fn runs only on a miss.
 */
export async function cachedCatalog<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs: number = CATALOG_TTL_MS,
): Promise<T> {
  const k = `${version}:${key}`;
  const hit = store.get(k);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.value as T;

  const value = await compute();
  // Bound memory: a handful of distinct catalog keys is expected; clear if it
  // ever grows unexpectedly (e.g. a key accidentally includes user input).
  if (store.size > 256) store.clear();
  store.set(k, { at: now, value });
  return value;
}
