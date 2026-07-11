import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parseOrError } from "@/lib/validations";
import { isValidTimezone, localParts } from "@/lib/local-time";
import { invalidateActivityPrefs } from "@/lib/activity-cache";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/security";
import {
  ReminderSettings,
  reminderRecipient,
  REMINDER_INTERVALS,
} from "@/models/ReminderSettings";
import { UserActivity } from "@/models/UserActivity";
import { whatsappConfigured } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z
  .object({
    reminderEnabled: z.boolean(),
    countryCode: z
      .string()
      .trim()
      .regex(/^(\+\d{1,4})?$/, "Country code must look like +91"),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\d{0,14}$/, "Phone number must be digits only")
      .refine((v) => v === "" || v.length >= 6, "Phone number is too short"),
    timezone: z
      .string()
      .trim()
      .max(64)
      .refine((v) => v === "" || isValidTimezone(v), "Unknown timezone"),
    goalMinutes: z.coerce.number().int().min(5).max(960),
    reminderStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
    reminderEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
    reminderInterval: z.coerce
      .number()
      .refine((v): v is (typeof REMINDER_INTERVALS)[number] =>
        REMINDER_INTERVALS.includes(v as (typeof REMINDER_INTERVALS)[number]),
        "Interval must be 15, 30, 45 or 60 minutes",
      ),
  })
  .superRefine((data, ctx) => {
    // Phone + country code + timezone are MANDATORY to enable reminders.
    if (data.reminderEnabled) {
      if (!data.countryCode)
        ctx.addIssue({ code: "custom", path: ["countryCode"], message: "Country code is required to enable reminders" });
      if (!data.phoneNumber)
        ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "WhatsApp number is required to enable reminders" });
      if (!data.timezone)
        ctx.addIssue({ code: "custom", path: ["timezone"], message: "Timezone is required to enable reminders" });
    }
    if (data.reminderStart >= data.reminderEnd) {
      ctx.addIssue({ code: "custom", path: ["reminderEnd"], message: "End time must be after start time" });
    }
  });

/**
 * GET /api/reminders/settings
 * The caller's reminder preferences + today's live activity snapshot.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const uid = new Types.ObjectId(user.id);
    const doc = await ReminderSettings.findOne({ userId: uid }).lean();

    const tz =
      doc?.timezone && isValidTimezone(doc.timezone) ? doc.timezone : "UTC";
    const { dateKey } = localParts(tz);
    const activity = await UserActivity.findOne({ userId: uid, dateKey })
      .select("activeSeconds goalCompleted lastHeartbeat isActive")
      .lean();

    return ok({
      settings: {
        reminderEnabled: doc?.reminderEnabled ?? false,
        countryCode: doc?.countryCode ?? "",
        phoneNumber: doc?.phoneNumber ?? "",
        timezone: doc?.timezone ?? "",
        goalMinutes: doc?.goalMinutes ?? 60,
        reminderStart: doc?.reminderStart ?? "20:00",
        reminderEnd: doc?.reminderEnd ?? "23:45",
        reminderInterval: doc?.reminderInterval ?? 15,
      },
      status: {
        whatsappConfigured: whatsappConfigured(),
        lastReminderSentAt: doc?.lastReminderSentAt ?? null,
        lastSendStatus: doc?.lastSendStatus ?? "none",
        lastSendError: doc?.lastSendError ?? "",
        today: {
          dateKey,
          activeMinutes: Math.floor((activity?.activeSeconds ?? 0) / 60),
          goalCompleted: Boolean(activity?.goalCompleted),
          lastHeartbeat: activity?.lastHeartbeat ?? null,
        },
      },
    });
  });
}

/**
 * PUT /api/reminders/settings
 * Save preferences. Enabling requires phone + country code + timezone.
 */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("mutate", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(settingsSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const data = parsed.data;

    // Defense in depth: never allow an enabled state without a recipient.
    if (
      data.reminderEnabled &&
      !reminderRecipient({ countryCode: data.countryCode, phoneNumber: data.phoneNumber })
    ) {
      return fail("A valid WhatsApp number is required to enable reminders.", 422);
    }

    await connectDB();
    const uid = new Types.ObjectId(user.id);
    const doc = await ReminderSettings.findOneAndUpdate(
      { userId: uid },
      {
        $set: {
          reminderEnabled: data.reminderEnabled,
          countryCode: data.countryCode,
          phoneNumber: data.phoneNumber,
          timezone: data.timezone,
          goalMinutes: data.goalMinutes,
          reminderStart: data.reminderStart,
          reminderEnd: data.reminderEnd,
          reminderInterval: data.reminderInterval,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    invalidateActivityPrefs(user.id);

    void logAudit({
      action: "reminder.settings_update",
      userId: user.id,
      ip: getClientIp(req),
      meta: {
        enabled: data.reminderEnabled,
        // Log only the last 4 digits — audit trails never need full numbers.
        phoneSuffix: data.phoneNumber.slice(-4),
        timezone: data.timezone,
        goalMinutes: data.goalMinutes,
        window: `${data.reminderStart}-${data.reminderEnd}/${data.reminderInterval}m`,
      },
    });

    return ok({
      saved: true,
      reminderEnabled: doc!.reminderEnabled,
    });
  });
}
