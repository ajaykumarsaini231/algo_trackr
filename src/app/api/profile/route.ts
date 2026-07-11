import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser, invalidateUserGate } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { isValidTimezone, localParts } from "@/lib/local-time";
import { getClientIp } from "@/lib/security";
import { logAudit } from "@/lib/audit";
import { whatsappConfigured } from "@/lib/whatsapp";
import { User } from "@/models/User";
import { ReminderSettings } from "@/models/ReminderSettings";
import { UserActivity } from "@/models/UserActivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The authenticated user's UNIFIED profile.
 *
 * Storage note: account fields live on `users`; phone/timezone/goal/reminder
 * preferences live in `reminder_settings` (one doc per user) because the
 * reminder engine is their single source of truth. This API merges both into
 * one profile object so clients never care about the split — duplicating the
 * fields onto the User model would have created drift and broken reminders.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const uid = new Types.ObjectId(user.id);
    const [account, prefs] = await Promise.all([
      User.findById(uid)
        .select("email name image role status createdAt lastLoginAt lastActiveAt loginCount solvedCount")
        .lean(),
      ReminderSettings.findOne({ userId: uid }).lean(),
    ]);
    if (!account) return fail("Account not found", 404);

    // Today's study snapshot (same local-day logic the reminder engine uses).
    const tz = prefs?.timezone && isValidTimezone(prefs.timezone) ? prefs.timezone : "UTC";
    const { dateKey } = localParts(tz);
    const activity = await UserActivity.findOne({ userId: uid, dateKey })
      .select("activeSeconds goalCompleted")
      .lean();

    return ok({
      account: {
        id: String(account._id),
        email: account.email,
        name: account.name || "",
        image: account.image || "",
        role: account.role,
        status: account.status,
        createdAt: account.createdAt ?? null,
        lastLoginAt: account.lastLoginAt ?? null,
        lastActiveAt: account.lastActiveAt ?? null,
        loginCount: account.loginCount ?? 0,
        solvedCount: account.solvedCount ?? 0,
      },
      preferences: {
        countryCode: prefs?.countryCode ?? "",
        phoneNumber: prefs?.phoneNumber ?? "",
        timezone: prefs?.timezone ?? "",
        dailyStudyGoal: prefs?.goalMinutes ?? 60,
        reminderEnabled: prefs?.reminderEnabled ?? false,
        reminderStartTime: prefs?.reminderStart ?? "20:00",
        reminderEndTime: prefs?.reminderEnd ?? "23:45",
        reminderInterval: prefs?.reminderInterval ?? 15,
      },
      today: {
        activeMinutes: Math.floor((activity?.activeSeconds ?? 0) / 60),
        goalCompleted: Boolean(activity?.goalCompleted),
      },
      whatsappConfigured: whatsappConfigured(),
    });
  });
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(80),
  image: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/.+/i.test(v), {
      message: "Avatar must be an https:// URL",
    })
    .optional(),
});

/**
 * PUT /api/profile — update account display fields (name, avatar URL).
 * Reminder/contact preferences are updated via PUT /api/reminders/settings
 * (single write path shared with the Settings page), which the profile page
 * uses for those fields.
 */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("mutate", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(profileSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);

    await connectDB();
    const target = await User.findById(user.id).select("name image");
    if (!target) return fail("Account not found", 404);

    const prev = { name: target.name, image: target.image };
    target.name = parsed.data.name;
    if (parsed.data.image !== undefined) target.image = parsed.data.image;
    await target.save();

    // The account gate caches display fields for up to 30s — refresh now so
    // server-rendered identity (and admin views) update immediately.
    invalidateUserGate(user.id);

    void logAudit({
      action: "profile.update",
      userId: user.id,
      ip: getClientIp(req),
      meta: { prev, next: { name: target.name, image: target.image } },
    });

    return ok({ name: target.name, image: target.image });
  });
}
