import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";

/**
 * One document per user per LOCAL day (dateKey = "YYYY-MM-DD" in the user's
 * timezone) accumulating ACTIVE study time only. Written by the heartbeat
 * endpoint at most ~once per minute per user; read by the reminder engine.
 *
 * "Currently active" is always DERIVED as `lastHeartbeat` within the last
 * 2 minutes — a crashed tab that never sent its goodbye beacon therefore
 * flips to inactive automatically, with no sweeper job needed.
 */
const UserActivitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Local calendar day in the user's timezone. */
    dateKey: { type: String, required: true, maxlength: 10 },

    /** Accumulated ACTIVE seconds (tab visible + focused + not idle). */
    activeSeconds: { type: Number, default: 0, min: 0 },
    /** Goal snapshot (minutes) used when goalCompleted was evaluated. */
    goalMinutes: { type: Number, default: 60 },
    goalCompleted: { type: Boolean, default: false },

    /** Client-reported state from the most recent heartbeat. */
    isActive: { type: Boolean, default: false },
    lastHeartbeat: { type: Date, default: null },
    /** Last raw user interaction (mouse/key/scroll) reported by the client. */
    lastActivity: { type: Date, default: null },
    firstActiveAt: { type: Date, default: null },
    heartbeats: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "user_activity" },
);

// Heartbeat upsert path + engine lookups.
UserActivitySchema.index({ userId: 1, dateKey: 1 }, { unique: true });
// Admin overview: everyone active today.
UserActivitySchema.index({ dateKey: 1, lastHeartbeat: -1 });

export type UserActivityDoc = InferSchemaType<typeof UserActivitySchema> & {
  _id: Types.ObjectId;
};

export const UserActivity: Model<UserActivityDoc> =
  (models.UserActivity as Model<UserActivityDoc>) ||
  model<UserActivityDoc>("UserActivity", UserActivitySchema);

export default UserActivity;
