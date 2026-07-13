import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const USER_ROLES = ["user", "admin", "superadmin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "blocked", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Application account. Every piece of user data in other collections points
 * back here via `userId`. Passwords are stored ONLY as bcrypt hashes and the
 * hash is excluded from queries by default (`select: false`).
 *
 * Moderation model:
 *  - `status`  blocked/suspended accounts cannot sign in, and live sessions
 *    are cut off at the auth gate (lib/auth-helpers) within seconds.
 *  - `deletedAt` soft delete — the account and its data are never removed,
 *    just excluded from login and user lists until restored.
 *  - `sessionVersion` bumping it invalidates every outstanding JWT for the
 *    user ("force logout all sessions") without touching credentials.
 */
const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    /** Optional https avatar URL; the UI falls back to initials. */
    image: { type: String, trim: true, maxlength: 500, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "user" },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    deletedAt: { type: Date, default: null },
    /** Incremented to invalidate all existing sessions for this user. */
    sessionVersion: { type: Number, default: 0 },
    loginCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    /** Touched (throttled) by the auth gate on API activity. */
    lastActiveAt: { type: Date, default: null },
    /**
     * Denormalized count of questions this user has Solved — maintained by
     * lib/progress.upsertProgress on status transitions so the admin user
     * list can sort/paginate by it at 100k+ users without aggregation.
     */
    solvedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "users" },
);

// Admin user-management access paths: list default (newest first), filters
// and sortable columns. `email` already has the unique index.
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLoginAt: -1 });
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ solvedCount: -1 });
UserSchema.index({ name: 1 });
// `loginCount` is a whitelisted sortable column in the admin user list; without
// this index sorting/keyset-paginating by it was an unindexed collection sort.
UserSchema.index({ loginCount: -1 });

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);

export default User;
