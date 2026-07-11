import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { adminLoginSchema, parseOrError } from "@/lib/validations";
import { isAdminAuthenticated } from "@/lib/require-admin";
import { getSessionUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  getClientIp,
  getLockState,
  registerFailure,
  resetAttempts,
  verifyPassword,
} from "@/lib/security";
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  generateSessionSecret,
  createToken,
} from "@/lib/session";
import { Admin } from "@/models/Admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
});

/**
 * GET /api/admin/auth
 * Report admin configuration + authentication + lockout state.
 */
export async function GET() {
  return handle(async () => {
    await connectDB();
    const configured = (await Admin.countDocuments()) > 0;
    // Role-based admins (ADMIN_EMAILS allowlist) skip the PIN entirely; the
    // legacy PIN cookie is still honored so the existing flow keeps working.
    const sessionUser = await getSessionUser();
    const authenticated =
      sessionUser?.role === "admin" || (await isAdminAuthenticated());
    const lock = await getLockState();
    return ok({
      configured,
      authenticated,
      locked: lock.locked,
      lockedUntil: lock.lockedUntil ? lock.lockedUntil.toISOString() : null,
      attemptsRemaining: lock.attemptsRemaining,
    });
  });
}

/**
 * POST /api/admin/auth
 * Admin login with brute-force protection.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = getClientIp(req);
    const rl = await checkRateLimit("auth", `admin-login:${ip}`);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(adminLoginSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const { password } = parsed.data;

    await connectDB();
    const admin = await Admin.findOne({ key: "primary" });
    if (!admin) return fail("Admin is not set up yet.", 400);

    const lock = await getLockState();
    if (lock.locked) {
      return fail("Too many failed attempts. Admin is locked.", 423);
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      const state = await registerFailure(ip);
      void logAudit({ action: "admin.login_failed", ip });
      if (state.locked) {
        return fail("Too many failed attempts. Locked for 15 minutes.", 423);
      }
      return fail(`Incorrect key. ${state.attemptsRemaining} attempt(s) remaining.`, 401);
    }

    await resetAttempts();
    void logAudit({ action: "admin.login", ip });
    if (!admin.sessionSecret) admin.sessionSecret = generateSessionSecret();
    admin.lastLoginAt = new Date();
    await admin.save();

    const token = createToken(admin.sessionSecret);
    const res = ok({ authenticated: true });
    res.cookies.set(ADMIN_COOKIE, token, cookieOptions());
    return res;
  });
}
