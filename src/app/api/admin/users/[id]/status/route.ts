import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import {
  requireRoleAdmin,
  requireSuperAdmin,
  invalidateUserGate,
} from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["block", "unblock", "suspend", "reactivate", "delete", "restore"]),
});

/**
 * POST /api/admin/users/[id]/status  { action }
 *
 * Account moderation. block/suspend also bump sessionVersion so every live
 * session dies at the auth gate within seconds. Soft delete only — data is
 * never removed and `restore` brings the account back fully intact.
 *
 * Privilege rules:
 *  - block/unblock/suspend/reactivate: any admin, but NOT against admins.
 *  - delete/restore: superadmin only; superadmins cannot be deleted.
 *  - nobody can moderate their own account.
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
    if (id === admin.id) return fail("You cannot moderate your own account.", 403);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(actionSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const { action } = parsed.data;

    await connectDB();
    const target = await User.findById(id);
    if (!target) return fail("User not found", 404);

    // Escalation guards.
    if (target.role === "superadmin") {
      return fail("Superadmin accounts cannot be moderated.", 403);
    }
    if (target.role === "admin") {
      await requireSuperAdmin(); // normal admins cannot touch other admins
    }
    if (action === "delete" || action === "restore") {
      await requireSuperAdmin();
    }

    const prev = { status: target.status, deletedAt: target.deletedAt };

    switch (action) {
      case "block":
        target.status = "blocked";
        target.sessionVersion = (target.sessionVersion ?? 0) + 1;
        break;
      case "suspend":
        target.status = "suspended";
        target.sessionVersion = (target.sessionVersion ?? 0) + 1;
        break;
      case "unblock":
      case "reactivate":
        target.status = "active";
        break;
      case "delete":
        target.deletedAt = new Date();
        target.sessionVersion = (target.sessionVersion ?? 0) + 1;
        break;
      case "restore":
        target.deletedAt = null;
        break;
    }

    await target.save();
    invalidateUserGate(id);

    void logAudit({
      action: `admin.user_${action}`,
      userId: admin.id,
      targetUserId: id,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "",
      meta: { prev, next: { status: target.status, deletedAt: target.deletedAt } },
    });

    return ok({
      id,
      status: target.deletedAt ? "deleted" : target.status,
    });
  });
}
