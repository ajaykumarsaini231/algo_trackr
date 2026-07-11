import "server-only";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { FailedAttempt } from "@/models/FailedAttempt";

/** Brute-force policy. */
export const MAX_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // rolling window for counting
const BCRYPT_ROUNDS = 12;
const ADMIN_KEY = "admin";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Extract a best-effort client IP from proxy headers. Spoofable by direct
 * clients — used only for soft throttling / lockout keying, never for
 * authorization decisions.
 */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface LockState {
  locked: boolean;
  lockedUntil: Date | null;
  attemptsRemaining: number;
}

/**
 * Read the current lockout state for an arbitrary key (e.g. "admin",
 * "login:<email>", "login-ip:<ip>"), auto-expiring stale locks/windows.
 * DB-backed, so it holds across serverless instances.
 */
export async function getLockStateFor(key: string): Promise<LockState> {
  const doc = await FailedAttempt.findOne({ key });
  const now = Date.now();

  if (!doc) {
    return { locked: false, lockedUntil: null, attemptsRemaining: MAX_ATTEMPTS };
  }

  // Active lock?
  if (doc.lockedUntil && doc.lockedUntil.getTime() > now) {
    return { locked: true, lockedUntil: doc.lockedUntil, attemptsRemaining: 0 };
  }

  // Lock expired, or attempt window rolled over → treat as fresh.
  const windowExpired =
    doc.windowStart && now - doc.windowStart.getTime() > ATTEMPT_WINDOW_MS;
  const lockExpired = doc.lockedUntil && doc.lockedUntil.getTime() <= now;

  if (windowExpired || lockExpired) {
    return {
      locked: false,
      lockedUntil: null,
      attemptsRemaining: MAX_ATTEMPTS,
    };
  }

  return {
    locked: false,
    lockedUntil: null,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - doc.count),
  };
}

/** Record a failed attempt for a key; locks when the limit is exceeded. */
export async function registerFailureFor(key: string, ip: string): Promise<LockState> {
  const now = new Date();
  let doc = await FailedAttempt.findOne({ key });

  if (!doc) {
    doc = new FailedAttempt({ key, count: 0, windowStart: now });
  }

  // Reset the rolling window if it has expired or a previous lock has passed.
  const windowExpired =
    !doc.windowStart || now.getTime() - doc.windowStart.getTime() > ATTEMPT_WINDOW_MS;
  const lockExpired = doc.lockedUntil && doc.lockedUntil.getTime() <= now.getTime();
  if (windowExpired || lockExpired) {
    doc.count = 0;
    doc.windowStart = now;
    doc.lockedUntil = null;
  }

  doc.count += 1;
  doc.lastAttemptAt = now;
  doc.history.push({ at: now, ip });
  if (doc.history.length > 50) doc.history.splice(0, doc.history.length - 50);

  if (doc.count >= MAX_ATTEMPTS) {
    doc.lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
  }

  await doc.save();

  const locked = Boolean(doc.lockedUntil && doc.lockedUntil.getTime() > now.getTime());
  return {
    locked,
    lockedUntil: locked ? (doc.lockedUntil ?? null) : null,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - doc.count),
  };
}

/** Clear failed attempts for a key after a successful authentication. */
export async function resetAttemptsFor(key: string): Promise<void> {
  await FailedAttempt.findOneAndUpdate(
    { key },
    { $set: { count: 0, lockedUntil: null, windowStart: null } },
    { upsert: true },
  );
}

// ---- Legacy admin-PIN wrappers (existing admin routes call these) ----

export async function getLockState(): Promise<LockState> {
  return getLockStateFor(ADMIN_KEY);
}

export async function registerFailure(ip: string): Promise<LockState> {
  return registerFailureFor(ADMIN_KEY, ip);
}

export async function resetAttempts(): Promise<void> {
  return resetAttemptsFor(ADMIN_KEY);
}

/**
 * Lightweight in-memory rate limiter (single instance only). Kept for
 * back-compat with existing admin routes; new code should use
 * `checkRateLimit` from `@/lib/rate-limit`, which upgrades to Upstash Redis
 * when configured.
 */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60_000,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(identifier);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}
