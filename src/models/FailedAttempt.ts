import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Brute-force protection state. One document per identifier (default the
 * shared "admin" key; can be extended to per-IP). Tracks the rolling failed
 * attempt count and any active lockout window.
 */
const FailedAttemptSchema = new Schema(
  {
    key: { type: String, default: "admin", unique: true },
    count: { type: Number, default: 0 },
    windowStart: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    history: {
      type: [
        {
          at: { type: Date, default: Date.now },
          ip: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "failed_attempts" },
);

export type FailedAttemptDoc = InferSchemaType<typeof FailedAttemptSchema>;

export const FailedAttempt: Model<FailedAttemptDoc> =
  (models.FailedAttempt as Model<FailedAttemptDoc>) ||
  model<FailedAttemptDoc>("FailedAttempt", FailedAttemptSchema);

export default FailedAttempt;
