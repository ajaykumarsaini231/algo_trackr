import "server-only";
import { AuditLog } from "@/models/AuditLog";

export interface AuditEvent {
  action: string;
  /** Acting user (admin or self). Null for anonymous events. */
  userId?: string | null;
  /** Target account for admin → user actions. */
  targetUserId?: string | null;
  ip?: string;
  userAgent?: string;
  /** Structured context — include { prev, next } for mutations. Never secrets. */
  meta?: Record<string, unknown>;
}

/**
 * Fire-and-forget security audit logging. Failures are swallowed (logged to
 * stderr) so an audit hiccup can never take down the request path; callers
 * invoke it as `void logAudit({...})`.
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    await AuditLog.create({
      action: event.action,
      userId: event.userId ?? null,
      targetUserId: event.targetUserId ?? null,
      ip: event.ip ?? "",
      userAgent: (event.userAgent ?? "").slice(0, 256),
      meta: event.meta ?? {},
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to write:", err);
  }
}
