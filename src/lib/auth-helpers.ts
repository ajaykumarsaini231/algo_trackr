import "server-only";
import { Types } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/require-admin";
import { readImpersonationCookie } from "@/lib/impersonation";
import { User, type UserRole, type UserStatus } from "@/models/User";

/**
 * Reusable authentication / authorization for API routes and server code.
 *
 * Routes run inside `handle()` (lib/api-response), which converts a thrown
 * `HttpError` into the matching JSON error response — so guards are one line:
 *
 *   const user = await requireUser();        // 401/403 when signed out/blocked
 *   const admin = await requireAdmin();      // catalog admin (role OR legacy PIN)
 *   const admin = await requireRoleAdmin();  // user management (role, auditable)
 *   const root  = await requireSuperAdmin(); // impersonation/roles/deletes
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Set when a superadmin is viewing the app AS this user. */
  impersonatedBy?: string;
}

// ---- Account gate -----------------------------------------------------------
// JWTs are stateless, but blocks/suspensions/force-logout must apply to LIVE
// sessions. Every request re-checks the account's current state through a
// small in-process cache (30s TTL) — cheap, bounded, and a blocked user loses
// API access within seconds without a DB hit on every single request.

interface GateEntry {
  status: UserStatus;
  deleted: boolean;
  role: UserRole;
  email: string;
  name: string;
  sessionVersion: number;
  at: number;
}

const gateCache = new Map<string, GateEntry>();
const GATE_TTL_MS = 30 * 1000;
const GATE_MAX = 10_000;
const ACTIVE_TOUCH_MS = 5 * 60 * 1000;
const lastTouched = new Map<string, number>();

/** Drop the cached gate for a user so admin actions apply immediately. */
export function invalidateUserGate(userId: string): void {
  gateCache.delete(userId);
}

async function getUserGate(userId: string): Promise<GateEntry | null> {
  const cached = gateCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.at < GATE_TTL_MS) return cached;

  if (!Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const doc = await User.findById(userId)
    .select("status deletedAt role email name sessionVersion")
    .lean();
  if (!doc) {
    gateCache.delete(userId);
    return null;
  }

  const entry: GateEntry = {
    status: (doc.status as UserStatus) ?? "active",
    deleted: Boolean(doc.deletedAt),
    role: (doc.role as UserRole) ?? "user",
    email: doc.email ?? "",
    name: doc.name ?? "",
    sessionVersion: doc.sessionVersion ?? 0,
    at: now,
  };
  if (gateCache.size > GATE_MAX) gateCache.clear();
  gateCache.set(userId, entry);

  // Throttled "last active" touch — fire and forget.
  const touched = lastTouched.get(userId) ?? 0;
  if (now - touched > ACTIVE_TOUCH_MS) {
    lastTouched.set(userId, now);
    void User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } })
      .exec()
      .catch(() => {});
  }

  return entry;
}

interface RawSession {
  user: SessionUser;
  gate: GateEntry;
}

/**
 * The RAW signed-in account (never impersonated), gate-checked:
 * missing/deleted account, blocked/suspended status or a bumped
 * sessionVersion (force logout) all invalidate the session.
 */
async function getRawSession(): Promise<RawSession | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;

  const gate = await getUserGate(u.id);
  if (!gate || gate.deleted) return null;
  if (gate.status !== "active") return null;

  // Token minted before the last "force logout" → dead.
  const tokenVersion = (u as { sessionVersion?: number }).sessionVersion ?? 0;
  if (tokenVersion !== gate.sessionVersion) return null;

  return {
    user: {
      id: u.id,
      email: gate.email || u.email || "",
      name: gate.name || u.name || "",
      // Role comes from the DB gate, not the token — demotions apply live.
      role: gate.role,
    },
    gate,
  };
}

/**
 * The EFFECTIVE user for data access: the signed-in account, or — when a
 * superadmin carries a valid impersonation cookie — the target account with
 * role forced DOWN to "user". Impersonation can never raise privilege.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const raw = await getRawSession();
  if (!raw) return null;

  if (raw.user.role === "superadmin") {
    const imp = await readImpersonationCookie();
    if (imp && imp.adminId === raw.user.id) {
      const target = await getUserGate(imp.targetId);
      // Only active, non-deleted accounts can be impersonated.
      if (target && !target.deleted && target.status === "active") {
        return {
          id: imp.targetId,
          email: target.email,
          name: target.name,
          role: "user",
          impersonatedBy: raw.user.id,
        };
      }
    }
  }

  return raw.user;
}

/** The effective signed-in user — 401 otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return user;
}

export interface AdminActor {
  /** Session user when role-admin; null when authorized via the legacy PIN. */
  user: SessionUser | null;
  /** Stable identifier for audit logs. */
  actorId: string;
}

/**
 * Catalog-admin authorization (questions/import/export/seed/settings).
 * Accepts EITHER a signed-in admin/superadmin (raw session — impersonation
 * never grants this) OR the legacy hardened admin-PIN cookie, so the existing
 * Admin Panel flow keeps working unchanged.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const raw = await getRawSession();
  if (raw && (raw.user.role === "admin" || raw.user.role === "superadmin")) {
    return { user: raw.user, actorId: raw.user.id };
  }
  if (await isAdminAuthenticated()) {
    return { user: raw?.user ?? null, actorId: raw ? raw.user.id : "legacy-admin" };
  }
  throw new HttpError(raw ? 403 : 401, raw ? "Admin access required" : "Sign in required");
}

/**
 * USER-MANAGEMENT authorization: requires an identified admin account
 * (role admin or superadmin). The legacy PIN is deliberately NOT accepted —
 * every action on another user's account must be attributable to a specific
 * admin in the audit log.
 */
export async function requireRoleAdmin(): Promise<SessionUser> {
  const raw = await getRawSession();
  if (!raw) throw new HttpError(401, "Sign in required");
  if (raw.user.role !== "admin" && raw.user.role !== "superadmin") {
    throw new HttpError(403, "Admin account required");
  }
  return raw.user;
}

/** Superadmin-only operations: impersonation, role changes, deletes, resets. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const raw = await getRawSession();
  if (!raw) throw new HttpError(401, "Sign in required");
  if (raw.user.role !== "superadmin") {
    throw new HttpError(403, "Super admin access required");
  }
  return raw.user;
}
