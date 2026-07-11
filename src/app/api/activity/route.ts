import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { isValidTimezone, localParts } from "@/lib/local-time";
import { activityPrefsFor } from "@/lib/activity-cache";
import { UserActivity } from "@/models/UserActivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/activity — the study-time heartbeat.
 *
 * The client sends one small request per ~60s ONLY while the user is
 * genuinely active (tab visible + window focused + recent input), plus a
 * final `sendBeacon` on tab close. Each request adds the client-accumulated
 * active seconds to today's bucket — one indexed upsert per user per minute,
 * no per-event writes, which holds up at 100k users.
 *
 * Anti-gaming: the reported delta is capped by the elapsed server time since
 * the previous heartbeat (+ grace), so a tampered client cannot bank more
 * study time than wall-clock time that actually passed.
 */
const heartbeatSchema = z.object({
  /** Active seconds accumulated client-side since the last heartbeat. */
  seconds: z.number().int().min(0).max(600),
  /** Client timezone (used only when the user saved no reminder settings). */
  tz: z.string().max(64).optional().default(""),
  /** Is the user active right now (visible + focused + not idle)? */
  active: z.boolean(),
  /** True for the goodbye beacon on tab close / hide. */
  final: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("mutate", `hb:${user.id}`);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    // sendBeacon may deliver the JSON with a text/plain content type — parse
    // the raw body instead of relying on req.json()'s content-type check.
    const raw = await req.text();
    let parsedBody: unknown = {};
    try {
      parsedBody = JSON.parse(raw || "{}");
    } catch {
      return fail("Invalid heartbeat payload", 422);
    }
    const parsed = parseOrError(heartbeatSchema, parsedBody);
    if (!parsed.success) return fail(parsed.error, 422);
    const { seconds, active, final } = parsed.data;
    const clientTz = parsed.data.tz ?? "";

    await connectDB();

    const prefs = await activityPrefsFor(user.id);
    const tz =
      prefs.tz && isValidTimezone(prefs.tz)
        ? prefs.tz
        : isValidTimezone(clientTz)
          ? clientTz
          : "UTC";

    const now = new Date();
    const { dateKey } = localParts(tz, now);
    const uid = new Types.ObjectId(user.id);

    // Cap the delta by real elapsed time since the previous heartbeat.
    const existing = await UserActivity.findOne({ userId: uid, dateKey })
      .select("activeSeconds lastHeartbeat goalCompleted")
      .lean();
    const elapsedSec = existing?.lastHeartbeat
      ? Math.max(0, (now.getTime() - existing.lastHeartbeat.getTime()) / 1000)
      : seconds;
    const credited = Math.min(seconds, Math.ceil(elapsedSec) + 90, 600);

    const doc = await UserActivity.findOneAndUpdate(
      { userId: uid, dateKey },
      {
        $inc: { activeSeconds: credited, heartbeats: 1 },
        $set: {
          isActive: active && !final,
          lastHeartbeat: now,
          ...(active || credited > 0 ? { lastActivity: now } : {}),
          goalMinutes: prefs.goal,
        },
        $setOnInsert: { firstActiveAt: now },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    // Stamp goal completion once (idempotent; reminders stop immediately).
    const goalCompleted =
      doc!.goalCompleted || doc!.activeSeconds >= prefs.goal * 60;
    if (goalCompleted && !doc!.goalCompleted) {
      await UserActivity.updateOne(
        { userId: uid, dateKey },
        { $set: { goalCompleted: true } },
      );
    }

    return ok({
      dateKey,
      activeMinutes: Math.floor(doc!.activeSeconds / 60),
      goalMinutes: prefs.goal,
      goalCompleted,
    });
  });
}
