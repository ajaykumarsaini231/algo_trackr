import crypto from "crypto";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { getSessionUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { runReminderPass } from "@/lib/reminder-engine";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * POST /api/reminders/run — the scheduler entrypoint.
 *
 * Called every 15 minutes by the GitHub Actions workflow with
 * `Authorization: Bearer $REMINDER_CRON_SECRET`. The middleware lets the
 * path through unauthenticated; THIS handler is the gate:
 *   - a valid cron secret (timing-safe compare), OR
 *   - a signed-in SUPERADMIN (manual trigger / dry runs from the admin UI).
 * Everything else → 401. `?dryRun=1` evaluates eligibility without sending
 * or claiming slots.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const secret = env().REMINDER_CRON_SECRET ?? "";
    const header = req.headers.get("authorization") ?? "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    let actor = "cron";
    const secretOk = Boolean(secret) && Boolean(bearer) && constantTimeEqual(bearer, secret);
    if (!secretOk) {
      const user = await getSessionUser();
      if (user?.role === "superadmin" && !user.impersonatedBy) {
        actor = `superadmin:${user.id}`;
      } else {
        // Identical response for wrong/missing secrets and non-admin
        // sessions — no oracle about which check failed.
        return fail("Unauthorized", 401);
      }
    }

    const rl = await checkRateLimit("heavy", "reminder-run");
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

    await connectDB();
    const stats = await runReminderPass({ dryRun });

    void logAudit({
      action: dryRun ? "reminder.run_dry" : "reminder.run",
      userId: actor.startsWith("superadmin:") ? actor.slice("superadmin:".length) : null,
      ip: getClientIp(req),
      meta: {
        actor,
        checked: stats.checked,
        sent: stats.sent,
        failed: stats.failed,
        wouldSend: stats.wouldSend,
        skipped: stats.skipped,
        haltedEarly: stats.haltedEarly,
        durationMs: stats.durationMs,
        // Per-user decision sample (≤50) so the audit trail shows exactly
        // why each user was sent, skipped, or failed on this pass.
        decisions: stats.decisions,
      },
    });

    return ok(stats);
  });
}
