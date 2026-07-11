import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Central rate limiting with two backends:
 *
 *  - Upstash Redis (sliding window) when UPSTASH_REDIS_REST_URL/TOKEN are set —
 *    durable and shared across serverless instances/regions. Preferred in prod.
 *  - In-memory fixed window otherwise — per-instance best effort for dev /
 *    single-node deployments. The DB-backed login lockout in security.ts is
 *    the durable brute-force protection either way.
 *
 * Buckets are deliberately coarse so limits are easy to reason about.
 */
export type RateBucket =
  | "auth" // login/register attempts — tight
  | "mutate" // per-user state writes
  | "read" // list/detail/stats reads
  | "heavy" // export/import/seed and other expensive admin ops
  | "global"; // middleware backstop per IP

const LIMITS: Record<RateBucket, { points: number; windowSec: number }> = {
  auth: { points: 10, windowSec: 60 },
  mutate: { points: 60, windowSec: 60 },
  read: { points: 240, windowSec: 60 },
  heavy: { points: 5, windowSec: 300 },
  global: { points: 400, windowSec: 60 },
};

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

// ---- Upstash backend (lazy singletons; safe on edge and node) ----

let redis: Redis | null | undefined;
const upstashLimiters = new Map<RateBucket, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function getUpstashLimiter(bucket: RateBucket): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  let limiter = upstashLimiters.get(bucket);
  if (!limiter) {
    const { points, windowSec } = LIMITS[bucket];
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(points, `${windowSec} s`),
      prefix: `rl:${bucket}`,
    });
    upstashLimiters.set(bucket, limiter);
  }
  return limiter;
}

// ---- In-memory fallback (fixed window, bounded size) ----

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryLimit(bucket: RateBucket, id: string): RateResult {
  const { points, windowSec } = LIMITS[bucket];
  const key = `${bucket}:${id}`;
  const now = Date.now();
  const entry = memory.get(key);

  if (!entry || now > entry.resetAt) {
    if (memory.size > MEMORY_MAX_KEYS) memory.clear(); // crude but bounded
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, retryAfterSec: 0 };
  }

  entry.count += 1;
  if (entry.count > points) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Check (and consume) one request against a bucket for an identifier —
 * typically the user id for authenticated traffic, the IP otherwise.
 */
export async function checkRateLimit(
  bucket: RateBucket,
  id: string,
): Promise<RateResult> {
  const limiter = getUpstashLimiter(bucket);
  if (!limiter) return memoryLimit(bucket, id);
  try {
    const res = await limiter.limit(id);
    return {
      ok: res.success,
      retryAfterSec: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch {
    // Redis unavailable → degrade to per-instance limiting, never to open failure.
    return memoryLimit(bucket, id);
  }
}

/** Standard 429 with Retry-After, matching the app's error envelope. */
export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { success: false, error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSec)) } },
  );
}
