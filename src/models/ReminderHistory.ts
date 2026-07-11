import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * Audit + duplicate-prevention record for every WhatsApp send attempt.
 *
 * The engine "claims" a slot by INSERTING a pending document first; the
 * unique (userId, slotKey) index makes double-sending impossible even if two
 * scheduler runs overlap — the second insert fails with E11000 and skips.
 * The document is then updated to sent/failed with Meta's response.
 */
const ReminderHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Local day the reminder belongs to (user's timezone). */
    dateKey: { type: String, required: true, maxlength: 10 },
    /** Duplicate-prevention key: `${dateKey}#${interval}m#${slotIndex}`. */
    slotKey: { type: String, required: true, maxlength: 32 },
    /** E.164 recipient. */
    to: { type: String, required: true, maxlength: 20 },

    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    /** Meta message id (wamid...) on success. */
    messageId: { type: String, default: "" },
    errorType: { type: String, default: "" }, // auth|invalid_number|template|rate_limit|network|unknown
    errorCode: { type: String, default: "" },
    errorMessage: { type: String, default: "", maxlength: 500 },
    /** Truncated raw Meta response for debugging. Never contains tokens. */
    metaResponse: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { collection: "reminder_history", versionKey: false },
);

// Hard duplicate prevention: one attempt per user per slot, ever.
ReminderHistorySchema.index({ userId: 1, slotKey: 1 }, { unique: true });
// Admin/debug access paths + retention.
ReminderHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
ReminderHistorySchema.index({ status: 1, createdAt: -1 });
ReminderHistorySchema.index({ userId: 1, createdAt: -1 });

export type ReminderHistoryDoc = InferSchemaType<typeof ReminderHistorySchema> & {
  _id: Types.ObjectId;
};

export const ReminderHistory: Model<ReminderHistoryDoc> =
  (models.ReminderHistory as Model<ReminderHistoryDoc>) ||
  model<ReminderHistoryDoc>("ReminderHistory", ReminderHistorySchema);

export default ReminderHistory;
