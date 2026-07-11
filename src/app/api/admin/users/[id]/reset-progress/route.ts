import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireSuperAdmin, invalidateUserGate } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { recountSolved } from "@/lib/progress";
import { User } from "@/models/User";
import UserProgress from "@/models/UserProgress";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetSchema = z.object({
  scope: z.enum(["all", "topic", "pattern"]).default("all"),
  /** Topic name or pattern slug when scope is not "all". */
  value: z.string().trim().max(120).optional(),
});

/**
 * POST /api/admin/users/[id]/reset-progress  { scope, value? }
 * Deletes the target user's progress rows (all, per topic, or per pattern)
 * and recounts the denormalized solvedCount. SUPERADMIN only — this is the
 * one deliberately destructive user-data operation, so it is role-gated at
 * the top tier and fully audited with counts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const rl = await checkRateLimit("heavy", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return fail("User not found", 404);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(resetSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const { scope, value } = parsed.data;
    if (scope !== "all" && !value) {
      return fail("`value` is required for topic/pattern scope.", 422);
    }

    await connectDB();
    const target = await User.findById(id).select("role").lean();
    if (!target) return fail("User not found", 404);
    if (target.role === "superadmin") {
      return fail("Superadmin progress cannot be reset by others.", 403);
    }

    const filter: Record<string, unknown> = { userId: new Types.ObjectId(id) };
    if (scope !== "all") {
      const qFilter = scope === "topic" ? { topic: value } : { patterns: value };
      const ids = await Question.find(qFilter).select("_id").lean();
      if (ids.length === 0) return fail(`No questions match that ${scope}.`, 404);
      filter.questionId = { $in: ids.map((d) => d._id) };
    }

    const res = await UserProgress.deleteMany(filter);
    const solvedCount = await recountSolved(id);
    invalidateUserGate(id);

    void logAudit({
      action: "admin.user_reset_progress",
      userId: admin.id,
      targetUserId: id,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "",
      meta: { scope, value: value ?? null, deleted: res.deletedCount, solvedCount },
    });

    return ok({ id, scope, deleted: res.deletedCount, solvedCount });
  });
}
