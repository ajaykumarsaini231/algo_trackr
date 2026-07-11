import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import {
  IMPERSONATE_COOKIE,
  createImpersonationToken,
  impersonationCookieOptions,
} from "@/lib/impersonation";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/impersonate
 * Begin impersonation ("Login as user") — SUPERADMIN only.
 *
 * Sets a signed, httpOnly, 30-minute cookie; the admin's own session is
 * untouched and the target's credentials are never read or changed. Admin
 * and superadmin accounts cannot be impersonated. Fully audited.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const rl = await checkRateLimit("mutate", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return fail("User not found", 404);
    if (id === admin.id) return fail("You are already yourself.", 400);

    await connectDB();
    const target = await User.findById(id)
      .select("email name role status deletedAt")
      .lean();
    if (!target || target.deletedAt) return fail("User not found", 404);
    if (target.role !== "user") {
      return fail("Admin accounts cannot be impersonated.", 403);
    }
    if (target.status !== "active") {
      return fail("Only active accounts can be impersonated.", 409);
    }

    void logAudit({
      action: "admin.impersonate_start",
      userId: admin.id,
      targetUserId: id,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "",
      meta: { targetEmail: target.email },
    });

    const res = ok({
      impersonating: true,
      target: { id, email: target.email, name: target.name || "" },
    });
    res.cookies.set(
      IMPERSONATE_COOKIE,
      createImpersonationToken(admin.id, id),
      impersonationCookieOptions(),
    );
    return res;
  });
}
