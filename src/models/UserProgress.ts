import { Schema, model, models, Types, type InferSchemaType, type Model } from "mongoose";
import { STATUSES } from "@/types";

/**
 * Per-user state for one question — the heart of multi-user isolation.
 *
 * The shared `Question` collection is a read-mostly catalog; everything a
 * user does (solve, favorite, notes, revision scheduling, rating…) lives
 * here, keyed by the compound unique index (userId, questionId). A missing
 * document simply means "Not Started" with all defaults, so the collection
 * only grows with actual activity.
 */
const UserProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },

    status: { type: String, enum: STATUSES, default: "Not Started" },
    favorite: { type: Boolean, default: false },
    revisionNeeded: { type: Boolean, default: false },
    lastRevisedAt: { type: Date, default: null },
    revisionDate: { type: Date, default: null },
    attemptCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    notes: { type: String, default: "", maxlength: 20000 },
    revisionNotes: { type: String, default: "", maxlength: 20000 },
    solvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "user_progress" },
);

// One progress document per (user, question) — concurrent upserts collapse
// onto this index instead of duplicating rows.
UserProgressSchema.index({ userId: 1, questionId: 1 }, { unique: true });

// User-scoped access paths used by lists, stats and revision views.
UserProgressSchema.index({ userId: 1, status: 1 });
UserProgressSchema.index({ userId: 1, favorite: 1 });
UserProgressSchema.index({ userId: 1, revisionNeeded: 1 });
UserProgressSchema.index({ userId: 1, solvedAt: -1 });
UserProgressSchema.index({ userId: 1, updatedAt: -1 });

export type UserProgressDoc = InferSchemaType<typeof UserProgressSchema> & {
  _id: Types.ObjectId;
};

export const UserProgress: Model<UserProgressDoc> =
  (models.UserProgress as Model<UserProgressDoc>) ||
  model<UserProgressDoc>("UserProgress", UserProgressSchema);

export default UserProgress;
