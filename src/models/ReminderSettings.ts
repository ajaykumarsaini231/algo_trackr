import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

export const REMINDER_INTERVALS = [15, 30, 45, 60] as const;

/**
 * Per-user WhatsApp reminder preferences.
 *
 * A user may keep reminders disabled with a saved phone number, but they can
 * never be ENABLED without phone + country code + timezone — enforced by the
 * settings API. The engine reads `lastReminderSlot` for slot-level duplicate
 * prevention (see ReminderHistory for the hard uniqueness guarantee).
 */
const ReminderSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    /** Dialing prefix, e.g. "+91". */
    countryCode: { type: String, trim: true, default: "", maxlength: 5 },
    /** National number, digits only. */
    phoneNumber: { type: String, trim: true, default: "", maxlength: 15 },
    /** IANA timezone, e.g. "Asia/Kolkata". */
    timezone: { type: String, trim: true, default: "", maxlength: 64 },

    reminderEnabled: { type: Boolean, default: false },
    goalMinutes: { type: Number, default: 60, min: 5, max: 960 },
    /** "HH:mm" in the user's timezone. */
    reminderStart: { type: String, default: "20:00", maxlength: 5 },
    reminderEnd: { type: String, default: "23:45", maxlength: 5 },
    /** Minutes between reminders (aligned to the 15-min scheduler grid). */
    reminderInterval: { type: Number, enum: REMINDER_INTERVALS, default: 15 },

    // ---- engine state ----
    lastReminderSentAt: { type: Date, default: null },
    /** Slot key of the last send, e.g. "2026-07-12#15m#81". */
    lastReminderSlot: { type: String, default: null },
    /** Outcome of the most recent send attempt (drives the UI status). */
    lastSendStatus: { type: String, enum: ["none", "ok", "failed"], default: "none" },
    lastSendError: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true, collection: "reminder_settings" },
);

// The engine's hot path: every enabled user, oldest-first by _id (cursor).
ReminderSettingsSchema.index({ reminderEnabled: 1, _id: 1 });

export type ReminderSettingsDoc = InferSchemaType<typeof ReminderSettingsSchema> & {
  _id: Types.ObjectId;
};

/** Full E.164 recipient ("+91XXXXXXXXXX") or null when incomplete. */
export function reminderRecipient(s: {
  countryCode?: string | null;
  phoneNumber?: string | null;
}): string | null {
  const cc = (s.countryCode ?? "").trim();
  const num = (s.phoneNumber ?? "").trim();
  if (!/^\+\d{1,4}$/.test(cc) || !/^\d{6,14}$/.test(num)) return null;
  return `${cc}${num}`;
}

export const ReminderSettings: Model<ReminderSettingsDoc> =
  (models.ReminderSettings as Model<ReminderSettingsDoc>) ||
  model<ReminderSettingsDoc>("ReminderSettings", ReminderSettingsSchema);

export default ReminderSettings;
