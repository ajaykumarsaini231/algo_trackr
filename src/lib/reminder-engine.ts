import "server-only";
import { Types } from "mongoose";
import { localParts, parseHHMM, formatLocalDate } from "@/lib/local-time";
import { isValidTimezone } from "@/lib/local-time";
import { sendReminderTemplate, whatsappConfigured } from "@/lib/whatsapp";
import {
  ReminderSettings,
  reminderRecipient,
  type ReminderSettingsDoc,
} from "@/models/ReminderSettings";
import { UserActivity } from "@/models/UserActivity";
import { ReminderHistory } from "@/models/ReminderHistory";
import { User } from "@/models/User";

/**
 * The reminder pass — executed every 15 minutes by GitHub Actions via
 * POST /api/reminders/run.
 *
 * Eligibility rules per user (any hit → skip, counted in stats):
 *   1. reminders disabled                       (excluded by the query)
 *   2. account missing / deleted / blocked
 *   3. no valid WhatsApp recipient
 *   4. local time outside [reminderStart, reminderEnd]
 *   5. today's goal completed
 *   6. currently active (heartbeat within the last 2 minutes) — a user who
 *      is studying is NEVER messaged; "active" is derived from heartbeat
 *      recency, so crashed tabs auto-expire with no cleanup job
 *   7. this slot already attempted (slot = floor(minutesOfDay / interval);
 *      claims are enforced by a unique index, so overlapping scheduler runs
 *      can never double-send)
 *
 * Failures are retried automatically on the NEXT slot (the claim belongs to
 * the slot that failed), except durable failure classes (dead token, invalid
 * number, broken template) which also surface on the settings/admin UI.
 */

export const ACTIVE_WINDOW_MS = 2 * 60_000;
const BATCH_SIZE = 200;
const SEND_CONCURRENCY = 8;
const MAX_SENDS_PER_RUN = 500;
/** Stop the run early after this many consecutive auth failures (dead token). */
const AUTH_FAILURE_FUSE = 3;

export type SkipReason =
  | "user_missing"
  | "user_not_active_account"
  | "no_phone"
  | "bad_timezone"
  | "before_window"
  | "after_window"
  | "goal_completed"
  | "currently_active"
  | "slot_already_sent"
  | "send_capacity_reached";

export interface RunStats {
  configured: boolean;
  dryRun: boolean;
  checked: number;
  sent: number;
  failed: number;
  wouldSend: number;
  skipped: Record<string, number>;
  haltedEarly: string | null;
  durationMs: number;
  /** Small sample of per-user decisions for observability / dry runs. */
  decisions: { userId: string; action: string; detail?: string }[];
}

interface Candidate {
  settings: ReminderSettingsDoc;
  to: string;
  name: string;
  dateKey: string;
  slotKey: string;
  goalMinutes: number;
  activeMinutes: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runReminderPass(opts: {
  dryRun?: boolean;
  now?: Date;
}): Promise<RunStats> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const dryRun = Boolean(opts.dryRun);
  const configured = whatsappConfigured();

  const stats: RunStats = {
    configured,
    dryRun,
    checked: 0,
    sent: 0,
    failed: 0,
    wouldSend: 0,
    skipped: {},
    haltedEarly: null,
    durationMs: 0,
    decisions: [],
  };
  // Structured per-decision log lines (visible in the platform's function
  // logs). Capped so a large user base cannot flood the log stream.
  let logBudget = 200;
  const logDecision = (userId: string, action: string, detail?: string) => {
    if (logBudget-- > 0) {
      console.log(
        JSON.stringify({ tag: "reminder.decision", userId, action, ...(detail ? { detail } : {}) }),
      );
    }
  };
  const skip = (reason: SkipReason | string, userId?: string, detail?: string) => {
    stats.skipped[reason] = (stats.skipped[reason] || 0) + 1;
    if (userId) logDecision(userId, `skip:${reason}`, detail);
    if (stats.decisions.length < 50 && userId) {
      stats.decisions.push({ userId, action: `skip:${reason}`, detail });
    }
  };

  let authFailures = 0;
  let sendBudget = MAX_SENDS_PER_RUN;
  let cursorId: Types.ObjectId | null = null;

  // Batched keyset scan over enabled users — never loads the whole
  // collection, never uses skip/offset; supports 100k+ settings docs.
  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { reminderEnabled: true };
    if (cursorId) query._id = { $gt: cursorId };
    const batch = await ReminderSettings.find(query)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();
    if (batch.length === 0) break;
    cursorId = batch[batch.length - 1]!._id;

    stats.checked += batch.length;

    // One query per batch for accounts; per-user dateKeys for activity.
    const userIds = batch.map((s) => s.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email status deletedAt")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    // Pre-compute local parts + collect activity lookups.
    const prelim: {
      s: (typeof batch)[number];
      dateKey: string;
      minutesOfDay: number;
    }[] = [];
    for (const s of batch) {
      const tz = s.timezone;
      if (!tz || !isValidTimezone(tz)) {
        skip("bad_timezone", String(s.userId));
        continue;
      }
      const parts = localParts(tz, now);
      prelim.push({ s, dateKey: parts.dateKey, minutesOfDay: parts.minutesOfDay });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activityOr: any[] = prelim.map((p) => ({
      userId: p.s.userId,
      dateKey: p.dateKey,
    }));
    const activities = activityOr.length
      ? await UserActivity.find({ $or: activityOr })
          .select("userId dateKey activeSeconds goalCompleted lastHeartbeat goalMinutes")
          .lean()
      : [];
    const activityMap = new Map(
      activities.map((a) => [`${a.userId}|${a.dateKey}`, a]),
    );

    // Apply the rule chain.
    const candidates: Candidate[] = [];
    for (const { s, dateKey, minutesOfDay } of prelim) {
      const uid = String(s.userId);
      const account = userMap.get(uid);
      if (!account) {
        skip("user_missing", uid);
        continue;
      }
      if (account.deletedAt || account.status !== "active") {
        skip("user_not_active_account", uid);
        continue;
      }

      const to = reminderRecipient(s);
      if (!to) {
        skip("no_phone", uid);
        continue;
      }

      const startMin = parseHHMM(s.reminderStart) ?? 20 * 60;
      const endMin = parseHHMM(s.reminderEnd) ?? 23 * 60 + 45;
      if (minutesOfDay < startMin) {
        skip("before_window", uid);
        continue;
      }
      if (minutesOfDay > endMin) {
        skip("after_window", uid);
        continue;
      }

      const activity = activityMap.get(`${uid}|${dateKey}`);
      const goalMinutes = s.goalMinutes ?? 60;
      const activeSeconds = activity?.activeSeconds ?? 0;
      if (activity?.goalCompleted || activeSeconds >= goalMinutes * 60) {
        skip("goal_completed", uid);
        continue;
      }

      // THE rule: an active user is never messaged. Active = heartbeat in
      // the last 2 minutes (covers both isActive=true and stale flags).
      if (
        activity?.lastHeartbeat &&
        now.getTime() - activity.lastHeartbeat.getTime() <= ACTIVE_WINDOW_MS
      ) {
        skip("currently_active", uid);
        continue;
      }

      const interval = s.reminderInterval ?? 15;
      const slotIndex = Math.floor(minutesOfDay / interval);
      const slotKey = `${dateKey}#${interval}m#${slotIndex}`;
      if (s.lastReminderSlot === slotKey) {
        skip("slot_already_sent", uid);
        continue;
      }

      candidates.push({
        settings: s as ReminderSettingsDoc,
        to,
        name: account.name || account.email.split("@")[0] || "there",
        dateKey,
        slotKey,
        goalMinutes,
        activeMinutes: Math.floor(activeSeconds / 60),
      });
    }

    // Send phase (or dry-run accounting).
    for (const group of chunk(candidates, SEND_CONCURRENCY)) {
      if (stats.haltedEarly) break;
      await Promise.all(
        group.map(async (c) => {
          const uid = String(c.settings.userId);
          if (dryRun) {
            stats.wouldSend++;
            logDecision(uid, "would_send", c.slotKey);
            if (stats.decisions.length < 50) {
              stats.decisions.push({
                userId: uid,
                action: "would_send",
                detail: `${c.slotKey} → ${c.to.slice(0, 4)}…${c.to.slice(-2)} (${c.activeMinutes}/${c.goalMinutes} min)`,
              });
            }
            return;
          }
          if (!configured) {
            skip("whatsapp_not_configured", uid);
            return;
          }
          if (sendBudget <= 0) {
            skip("send_capacity_reached", uid);
            return;
          }

          // Claim the slot FIRST — the unique index turns concurrent runs
          // into exactly one attempt per user per slot.
          let claimId: Types.ObjectId;
          try {
            const claim = await ReminderHistory.create({
              userId: c.settings.userId,
              dateKey: c.dateKey,
              slotKey: c.slotKey,
              to: c.to,
              status: "pending",
            });
            claimId = claim._id;
          } catch (err) {
            if ((err as { code?: number }).code === 11000) {
              skip("slot_already_sent", uid);
              return;
            }
            throw err;
          }

          sendBudget--;
          const remaining = Math.max(0, c.goalMinutes - c.activeMinutes);
          const result = await sendReminderTemplate(c.to, {
            name: c.name,
            statusText: "due today",
            goalText: `Daily study goal ${c.goalMinutes} min (${c.activeMinutes} min done)`,
            dateText: formatLocalDate(c.settings.timezone, now),
            remainingText: `${remaining} min remaining`,
          });

          if (result.ok) {
            stats.sent++;
            await Promise.all([
              ReminderHistory.updateOne(
                { _id: claimId },
                {
                  $set: {
                    status: "sent",
                    messageId: result.messageId ?? "",
                    metaResponse: result.raw ?? null,
                    completedAt: new Date(),
                  },
                },
              ),
              ReminderSettings.updateOne(
                { _id: c.settings._id },
                {
                  $set: {
                    lastReminderSentAt: new Date(),
                    lastReminderSlot: c.slotKey,
                    lastSendStatus: "ok",
                    lastSendError: "",
                  },
                },
              ),
            ]);
            logDecision(uid, "sent", `${c.slotKey} id=${result.messageId ?? ""}`);
            if (stats.decisions.length < 50) {
              stats.decisions.push({ userId: uid, action: "sent", detail: c.slotKey });
            }
          } else {
            stats.failed++;
            authFailures = result.errorType === "auth" ? authFailures + 1 : 0;
            await Promise.all([
              ReminderHistory.updateOne(
                { _id: claimId },
                {
                  $set: {
                    status: "failed",
                    errorType: result.errorType ?? "unknown",
                    errorCode: result.errorCode ?? "",
                    errorMessage: result.errorMessage ?? "",
                    metaResponse: result.raw ?? null,
                    completedAt: new Date(),
                  },
                },
              ),
              ReminderSettings.updateOne(
                { _id: c.settings._id },
                {
                  $set: {
                    lastSendStatus: "failed",
                    lastSendError: `${result.errorType}: ${result.errorMessage ?? ""}`.slice(0, 300),
                  },
                },
              ),
            ]);
            logDecision(
              uid,
              "failed",
              `${result.errorType}/${result.errorCode}: ${result.errorMessage ?? ""}`,
            );
            if (stats.decisions.length < 50) {
              stats.decisions.push({
                userId: uid,
                action: "failed",
                detail: `${result.errorType}/${result.errorCode}`,
              });
            }
            if (authFailures >= AUTH_FAILURE_FUSE) {
              stats.haltedEarly = "access_token_rejected";
            }
          }
        }),
      );
    }

    if (stats.haltedEarly || batch.length < BATCH_SIZE) break;
  }

  stats.durationMs = Date.now() - started;
  console.log(
    JSON.stringify({
      tag: "reminder.run_summary",
      configured: stats.configured,
      dryRun: stats.dryRun,
      checked: stats.checked,
      sent: stats.sent,
      failed: stats.failed,
      wouldSend: stats.wouldSend,
      skipped: stats.skipped,
      haltedEarly: stats.haltedEarly,
      durationMs: stats.durationMs,
    }),
  );
  return stats;
}
