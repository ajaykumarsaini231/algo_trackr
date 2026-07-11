import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import {
  requireRoleAdmin,
  requireSuperAdmin,
  invalidateUserGate,
  HttpError,
} from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { computeUserStats } from "@/lib/user-stats";
import { getUserOverlay, activeRow } from "@/lib/progress";
import { LEARNING_STAGES, stageMatchesDoc } from "@/lib/learning";
import { SHEETS, sheetMatchesDoc } from "@/lib/sheets";
import { GOOGLE_PRIORITY, PRIORITY_WEIGHT, COVERAGE_TARGET } from "@/lib/google";
import { User } from "@/models/User";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "User not found");
  return new Types.ObjectId(id);
}

/**
 * GET /api/admin/users/[id]
 * Full inspection payload for the User Dashboard Viewer: profile + the exact
 * dashboard `Stats` the user themself sees (shared computeUserStats) + the
 * derived learning/readiness/revision/timeline extras. Read-only. Admin only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("read", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    await connectDB();

    const doc = await User.findById(toId(id))
      .select("email name role status deletedAt createdAt updatedAt lastLoginAt lastActiveAt loginCount sessionVersion")
      .lean();
    if (!doc) return fail("User not found", 404);

    const [stats, rows] = await Promise.all([
      computeUserStats(id),
      getUserOverlay(id).then((r) => r.filter(activeRow)),
    ]);

    // ---- Learning stage (same rules as /api/learn) ----
    const solvedByStage = new Map<string, number>();
    for (const r of rows) {
      if (r.status !== "Solved") continue;
      for (const st of LEARNING_STAGES) {
        if (stageMatchesDoc(st, r.q)) {
          solvedByStage.set(st.key, (solvedByStage.get(st.key) || 0) + 1);
        }
      }
    }
    let prevSolved = Infinity;
    const stages = LEARNING_STAGES.map((st) => {
      const solved = solvedByStage.get(st.key) || 0;
      const unlocked = prevSolved >= st.unlockThreshold;
      const row = { key: st.key, name: st.name, level: st.level, solved, unlocked };
      prevSolved = solved;
      return row;
    });
    // The user's current stage = the furthest unlocked one.
    const activeStage = stages.filter((s) => s.unlocked).pop() ?? stages[0]!;

    // ---- Google readiness (same weighted formula as /api/google) ----
    let wSum = 0;
    let covSum = 0;
    let progSum = 0;
    for (const t of stats.byTopic) {
      const priority = GOOGLE_PRIORITY[t.topic] || "Low";
      const w = PRIORITY_WEIGHT[priority];
      const target = COVERAGE_TARGET[t.topic] || 40;
      const coverage = Math.min(1, target ? t.total / target : 0);
      const progress = t.total ? t.solved / t.total : 0;
      wSum += w;
      covSum += w * coverage;
      progSum += w * progress;
    }
    const googleReadiness = {
      coverageScore: wSum ? Math.round((covSum / wSum) * 100) : 0,
      progressScore: wSum ? Math.round((progSum / wSum) * 100) : 0,
      overall: wSum ? Math.round(((covSum * 0.4 + progSum * 0.6) / wSum) * 100) : 0,
    };

    // ---- Sheets progress (Blind 75 etc.) ----
    const solvedRows = rows.filter((r) => r.status === "Solved");
    const sheets = SHEETS.map((def) => ({
      key: def.key,
      name: def.name,
      listSize: def.type === "curated" ? def.slugs?.length ?? null : null,
      solved: solvedRows.filter((r) => sheetMatchesDoc(def, r.q)).length,
    }));

    // ---- Revision buckets ----
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const revisionRows = rows.filter(
      (r) => r.revisionNeeded || r.status === "Need Revision" || r.status === "Revisit" || r.revisionDate,
    );
    const revision = {
      dueToday: revisionRows.filter(
        (r) => r.revisionDate && r.revisionDate.getTime() >= startOfToday.getTime() && r.revisionDate.getTime() <= now,
      ).length,
      missed: revisionRows.filter(
        (r) => r.revisionDate && r.revisionDate.getTime() < startOfToday.getTime(),
      ).length,
      upcoming: revisionRows.filter((r) => r.revisionDate && r.revisionDate.getTime() > now).length,
      flagged: revisionRows.length,
      recentlyRevised: rows
        .filter((r) => r.lastRevisedAt)
        .sort((a, b) => (b.lastRevisedAt?.getTime() ?? 0) - (a.lastRevisedAt?.getTime() ?? 0))
        .slice(0, 10)
        .map((r) => ({ questionId: r.questionId, lastRevisedAt: r.lastRevisedAt })),
    };

    // ---- Timeline: chronological activity from real timestamps ----
    type TimelineEvent = { at: Date; type: string; questionId: string };
    const events: TimelineEvent[] = [];
    for (const r of rows) {
      if (r.solvedAt) events.push({ at: r.solvedAt, type: "solved", questionId: r.questionId });
      if (r.lastRevisedAt) events.push({ at: r.lastRevisedAt, type: "revised", questionId: r.questionId });
    }
    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    const recentEvents = events.slice(0, 40);

    // Resolve titles for timeline + recently-revised in one query.
    const titleIds = [
      ...new Set([
        ...recentEvents.map((e) => e.questionId),
        ...revision.recentlyRevised.map((r) => r.questionId),
      ]),
    ].map((x) => new Types.ObjectId(x));
    const titleDocs = titleIds.length
      ? await Question.find({ _id: { $in: titleIds } })
          .select("title difficulty topic")
          .lean()
      : [];
    const titleMap = new Map(
      titleDocs.map((d) => [String(d._id), { title: d.title, difficulty: d.difficulty, topic: d.topic }]),
    );
    const timeline = recentEvents.map((e) => ({
      ...e,
      question: titleMap.get(e.questionId) ?? null,
    }));
    const recentlyRevised = revision.recentlyRevised.map((r) => ({
      ...r,
      question: titleMap.get(r.questionId) ?? null,
    }));

    // Weak topics: high-priority topics with the lowest completion.
    const weakTopics = stats.byTopic
      .filter((t) => t.total > 0 && (GOOGLE_PRIORITY[t.topic] === "Critical" || GOOGLE_PRIORITY[t.topic] === "High"))
      .map((t) => ({ ...t, pct: t.total ? (t.solved / t.total) * 100 : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 6);

    return ok({
      profile: {
        id: String(doc._id),
        email: doc.email,
        name: doc.name || "",
        role: doc.role,
        status: doc.deletedAt ? "deleted" : doc.status,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt ?? null,
        lastLoginAt: doc.lastLoginAt ?? null,
        lastActiveAt: doc.lastActiveAt ?? null,
        loginCount: doc.loginCount ?? 0,
        provider: "credentials",
      },
      stats,
      learning: { stages, currentStage: activeStage.key, currentStageName: activeStage.name },
      googleReadiness,
      sheets,
      revision: { ...revision, recentlyRevised },
      timeline,
      weakTopics,
    });
  });
}

const profilePatchSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

/**
 * PATCH /api/admin/users/[id]
 * Edit profile fields. Role changes and edits to admin accounts are
 * SUPERADMIN-only; nobody can edit a superadmin's role or their own role.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("mutate", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(profilePatchSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const patch = parsed.data;

    await connectDB();
    const target = await User.findById(toId(id));
    if (!target) return fail("User not found", 404);

    // Privilege rules: only superadmins may touch admin accounts or roles;
    // superadmin accounts and one's own role are immutable via this API.
    const touchingAdmin = target.role === "admin" || target.role === "superadmin";
    if (patch.role !== undefined || touchingAdmin) {
      await requireSuperAdmin();
    }
    if (target.role === "superadmin" && patch.role !== undefined) {
      return fail("Superadmin role is managed via SUPER_ADMIN_EMAILS.", 403);
    }
    if (patch.role !== undefined && String(target._id) === admin.id) {
      return fail("You cannot change your own role.", 403);
    }

    const prev = { name: target.name, email: target.email, role: target.role };

    if (patch.email && patch.email !== target.email) {
      const dupe = await User.findOne({ email: patch.email }).select("_id").lean();
      if (dupe) return fail("That email is already in use.", 409);
      target.email = patch.email;
    }
    if (patch.name !== undefined) target.name = patch.name;
    if (patch.role !== undefined) target.role = patch.role;

    await target.save();
    invalidateUserGate(id);

    void logAudit({
      action: "admin.user_update",
      userId: admin.id,
      targetUserId: id,
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? "",
      meta: { prev, next: { name: target.name, email: target.email, role: target.role } },
    });

    return ok({
      id: String(target._id),
      name: target.name,
      email: target.email,
      role: target.role,
    });
  });
}
