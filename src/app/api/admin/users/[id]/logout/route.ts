import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import {
  requireRoleAdmin,
  requireSuperAdmin,
  invalidateUserGate,
} from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/logout
 * Force-invalidate every session of the target user by bumping their
 * sessionVersion — existing JWTs fail the auth gate on their next request.
 * Credentials are untouched; the user simply signs in again.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("mutate", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return fail("User not found", 404);

    await connectDB();
    const target = await User.findById(id).select("role sessionVersion");
    if (!target) return fail("User not found", 404);
    if (target.role === "superadmin" && id !== admin.id) {
      return fail("Superadmin sessions cannot be revoked by others.", 403);
    }
    if (target.role === "admin" && id !== admin.id) {
      await requireSuperAdmin();
    }

    target.sessionVersion = (target.sessionVersion ?? 0) + 1;
    await target.save();
    invalidateUserGate(id);

    void logAudit({
      action: "admin.user_force_logout",
      userId: admin.id,
      targetUserId: id,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "",
    });

    return ok({ id, loggedOut: true });
  });
}
