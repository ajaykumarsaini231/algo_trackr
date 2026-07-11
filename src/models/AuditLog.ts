import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Append-only security audit trail: authentication events, admin actions and
 * destructive operations. Entries expire after 90 days via a TTL index so the
 * collection cannot grow without bound.
 */
const AuditLogSchema = new Schema(
  {
    /** Actor — null for anonymous events (failed logins, registrations). */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Subject of the action when it targets another account. */
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Machine-readable action, e.g. "auth.login", "admin.user_block". */
    action: { type: String, required: true, maxlength: 64 },
    /** Best-effort client IP (proxy header derived — informational only). */
    ip: { type: String, default: "", maxlength: 64 },
    /** Requesting browser/client, truncated. */
    userAgent: { type: String, default: "", maxlength: 256 },
    /** Small structured context: previous/new values, counts… Never secrets. */
    meta: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "audit_logs", versionKey: false },
);

// Auto-expire after 90 days; query paths: per-actor, per-target, per-action.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ targetUserId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ||
  model<AuditLogDoc>("AuditLog", AuditLogSchema);

export default AuditLog;
