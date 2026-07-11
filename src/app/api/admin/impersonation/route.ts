import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  IMPERSONATE_COOKIE,
  readImpersonationCookie,
} from "@/lib/impersonation";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/impersonation — current impersonation state (banner).
 * DELETE /api/admin/impersonation — stop impersonating (one-click return).
 * Both require the RAW session to be a superadmin.
 */
export async function GET() {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const imp = await readImpersonationCookie();
    if (!imp || imp.adminId !== admin.id) {
      return ok({ active: false });
    }
    await connectDB();
    const target = await User.findById(imp.targetId).select("email name").lean();
    return ok({
      active: Boolean(target),
      target: target
        ? { id: imp.targetId, email: target.email, name: target.name || "" }
        : null,
      expiresAt: new Date(imp.exp).toISOString(),
    });
  });
}

export async function DELETE() {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const imp = await readImpersonationCookie();

    if (imp && imp.adminId === admin.id) {
      void logAudit({
        action: "admin.impersonate_stop",
        userId: admin.id,
        targetUserId: imp.targetId,
      });
    }

    const res = ok({ active: false });
    res.cookies.set(IMPERSONATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  });
}
