import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { fail, handle } from "@/lib/api-response";
import { getSessionUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { runReminderPass, type RunStats } from "@/lib/reminder-engine";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/reminders/run — the scheduler entrypoint, scheduler-agnostic.
 *
 * Accepts BOTH:
 *   GET  /api/reminders/run            (cron-job.org, UptimeRobot, browsers)
 *   POST /api/reminders/run            (GitHub Actions, QStash, manual API)
 * Any other method → Next.js returns 405 automatically.
 *
 * Authorization (any one of, checked in order):
 *   1. `Authorization: Bearer <REMINDER_CRON_SECRET>`   (preferred)
 *   2. `?token=<REMINDER_CRON_SECRET>`  — for schedulers that cannot send
 *      headers. NOTE: query strings end up in proxy/access logs; prefer the
 *      header whenever the scheduler supports custom headers.
 *   3. A signed-in SUPERADMIN session (admin UI manual/dry runs).
 * Everything else → 401 (identical body for every failure mode — no oracle).
 *
 * `?dryRun=1` evaluates eligibility without sending or claiming slots.
 *
 * Idempotency: the engine claims a per-user, per-slot document behind a
 * unique index BEFORE sending, so any number of overlapping calls — from any
 * mix of schedulers — can never double-send within a slot.
 */

type SchedulerSource =
  | "github-actions"
  | "cron-job.org"
  | "uptimerobot"
  | "qstash"
  | "vercel-cron"
  | "manual/api";

type AuthMethod = "bearer" | "query-token" | "superadmin" | "denied";

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Best-effort scheduler identification, for logs/audit only (never auth). */
function detectSource(req: NextRequest): SchedulerSource {
  const explicit = (req.headers.get("x-scheduler") ?? "").toLowerCase();
  if (explicit.includes("github")) return "github-actions";
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  if (ua.includes("cron-job.org")) return "cron-job.org";
  if (ua.includes("uptimerobot")) return "uptimerobot";
  if (ua.includes("qstash") || req.headers.has("upstash-signature")) return "qstash";
  if (req.headers.has("x-vercel-cron")) return "vercel-cron";
  if (ua.includes("github-actions")) return "github-actions";
  return "manual/api";
}

async function authorize(req: NextRequest): Promise<{ method: AuthMethod; actor: string }> {
  const secret = env().REMINDER_CRON_SECRET ?? "";
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (secret && bearer && constantTimeEqual(bearer, secret)) {
    return { method: "bearer", actor: "cron" };
  }
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (secret && token && constantTimeEqual(token, secret)) {
    return { method: "query-token", actor: "cron" };
  }
  const user = await getSessionUser();
  if (user?.role === "superadmin" && !user.impersonatedBy) {
    return { method: "superadmin", actor: `superadmin:${user.id}` };
  }
  return { method: "denied", actor: "anonymous" };
}

/**
 * Shared implementation for GET and POST — auth, rate limit, engine pass,
 * structured logging, audit trail, JSON response.
 */
async function runReminderEngine(req: NextRequest): Promise<NextResponse> {
  return handle(async () => {
    const started = Date.now();
    const source = detectSource(req);
    const method = req.method;
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

    const auth = await authorize(req);
    if (auth.method === "denied") {
      console.log(
        JSON.stringify({
          tag: "reminder.request",
          method,
          source,
          auth: "denied",
          status: 401,
          durationMs: Date.now() - started,
        }),
      );
      return fail("Unauthorized", 401);
    }

    const rl = await checkRateLimit("heavy", "reminder-run");
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const stats: RunStats = await runReminderPass({ dryRun });

    const skippedTotal = Object.values(stats.skipped).reduce((a, b) => a + b, 0);
    const eligible = stats.sent + stats.failed + stats.wouldSend;
    const durationMs = Date.now() - started;

    console.log(
      JSON.stringify({
        tag: "reminder.request",
        method,
        source,
        auth: auth.method,
        dryRun,
        checked: stats.checked,
        eligible,
        sent: stats.sent,
        failed: stats.failed,
        skipped: skippedTotal,
        haltedEarly: stats.haltedEarly,
        engineMs: stats.durationMs,
        durationMs,
      }),
    );

    void logAudit({
      action: dryRun ? "reminder.run_dry" : "reminder.run",
      userId: auth.actor.startsWith("superadmin:") ? auth.actor.slice("superadmin:".length) : null,
      ip: getClientIp(req),
      meta: {
        actor: auth.actor,
        source,
        method,
        authMethod: auth.method,
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

    // Flat summary for schedulers (requirement shape) + the full stats under
    // `data` so the existing admin UI (`json.data.wouldSend` etc.) keeps
    // working unchanged.
    return NextResponse.json({
      success: true,
      source,
      dryRun,
      checked: stats.checked,
      eligible,
      sent: stats.sent,
      failed: stats.failed,
      skipped: skippedTotal,
      skippedBreakdown: stats.skipped,
      durationMs,
      timestamp: new Date().toISOString(),
      data: stats,
    });
  });
}

export async function GET(req: NextRequest) {
  return runReminderEngine(req);
}

export async function POST(req: NextRequest) {
  return runReminderEngine(req);
}
