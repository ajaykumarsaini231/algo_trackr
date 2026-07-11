import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireRoleAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isValidTimezone, localParts } from "@/lib/local-time";
import { whatsappConfigured } from "@/lib/whatsapp";
import { ACTIVE_WINDOW_MS } from "@/lib/reminder-engine";
import { ReminderSettings } from "@/models/ReminderSettings";
import { UserActivity } from "@/models/UserActivity";
import { ReminderHistory } from "@/models/ReminderHistory";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reminders?cursor=&limit=
 * Reminder operations overview: per-user reminder/activity state (cursor
 * paginated over enabled users), 24h send/failure totals, and the most
 * recent failed messages. Admin only, read-only.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("read", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
    const cursor = sp.get("cursor");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { reminderEnabled: true };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $gt: new Types.ObjectId(cursor) };
    }

    const [rows, enabledTotal] = await Promise.all([
      ReminderSettings.find(query).sort({ _id: 1 }).limit(limit + 1).lean(),
      ReminderSettings.countDocuments({ reminderEnabled: true }),
    ]);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    const now = new Date();
    const userIds = page.map((s) => s.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("email name status deletedAt")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // Today's activity per user (their own local day).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activityOr: any[] = [];
    const dateKeyByUser = new Map<string, string>();
    for (const s of page) {
      const tz = s.timezone && isValidTimezone(s.timezone) ? s.timezone : "UTC";
      const { dateKey } = localParts(tz, now);
      dateKeyByUser.set(String(s.userId), dateKey);
      activityOr.push({ userId: s.userId, dateKey });
    }
    const activities = activityOr.length
      ? await UserActivity.find({ $or: activityOr })
          .select("userId dateKey activeSeconds goalCompleted lastHeartbeat")
          .lean()
      : [];
    const activityMap = new Map(activities.map((a) => [`${a.userId}|${a.dateKey}`, a]));

    // Messages per user today (one aggregation for the page).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgAgg: any[] = userIds.length
      ? await ReminderHistory.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              createdAt: { $gte: new Date(now.getTime() - 36 * 3600_000) },
            },
          },
          {
            $group: {
              _id: "$userId",
              sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            },
          },
        ])
      : [];
    const msgMap = new Map(msgAgg.map((m) => [String(m._id), m]));

    const items = page.map((s) => {
      const uid = String(s.userId);
      const account = userMap.get(uid);
      const activity = activityMap.get(`${uid}|${dateKeyByUser.get(uid)}`);
      const active =
        activity?.lastHeartbeat &&
        now.getTime() - activity.lastHeartbeat.getTime() <= ACTIVE_WINDOW_MS;
      const msgs = msgMap.get(uid);
      return {
        userId: uid,
        email: account?.email ?? "(deleted)",
        name: account?.name ?? "",
        accountStatus: account ? (account.deletedAt ? "deleted" : account.status) : "missing",
        phone: `${s.countryCode}${s.phoneNumber}`,
        timezone: s.timezone,
        goalMinutes: s.goalMinutes,
        window: `${s.reminderStart}–${s.reminderEnd} / ${s.reminderInterval}m`,
        activeMinutesToday: Math.floor((activity?.activeSeconds ?? 0) / 60),
        goalCompleted: Boolean(activity?.goalCompleted),
        isActiveNow: Boolean(active),
        lastHeartbeat: activity?.lastHeartbeat ?? null,
        lastReminderSentAt: s.lastReminderSentAt ?? null,
        lastSendStatus: s.lastSendStatus ?? "none",
        lastSendError: s.lastSendError ?? "",
        sentToday: msgs?.sent ?? 0,
        failedToday: msgs?.failed ?? 0,
      };
    });

    // Global 24h totals + recent failures (retry queue).
    const since = new Date(now.getTime() - 24 * 3600_000);
    const [sent24, failed24, recentFailedRaw] = await Promise.all([
      ReminderHistory.countDocuments({ status: "sent", createdAt: { $gte: since } }),
      ReminderHistory.countDocuments({ status: "failed", createdAt: { $gte: since } }),
      ReminderHistory.find({ status: "failed" })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    const failedUserIds = [...new Set(recentFailedRaw.map((f) => String(f.userId)))]
      .filter((id) => !userMap.has(id))
      .map((id) => new Types.ObjectId(id));
    const extraUsers = failedUserIds.length
      ? await User.find({ _id: { $in: failedUserIds } }).select("email").lean()
      : [];
    for (const u of extraUsers) userMap.set(String(u._id), u as (typeof extraUsers)[number] & { name?: string; status?: string; deletedAt?: Date | null });

    const recentFailures = recentFailedRaw.map((f) => ({
      id: String(f._id),
      userId: String(f.userId),
      email: userMap.get(String(f.userId))?.email ?? "(unknown)",
      to: f.to,
      slotKey: f.slotKey,
      errorType: f.errorType,
      errorCode: f.errorCode,
      errorMessage: f.errorMessage,
      createdAt: f.createdAt,
    }));

    return ok({
      configured: whatsappConfigured(),
      summary: { enabledTotal, sent24, failed24 },
      items,
      nextCursor: hasMore && page.length ? String(page[page.length - 1]!._id) : null,
      recentFailures,
    });
  });
}
