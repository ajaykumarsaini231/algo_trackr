/**
 * debug-reminder.mjs — trace the full reminder pipeline for ONE user.
 *
 *   node scripts/debug-reminder.mjs <email>            evaluate only (no send)
 *   node scripts/debug-reminder.mjs <email> --send     claim slot + real send
 *   node scripts/debug-reminder.mjs <email> --send --force
 *                                                      send even if this slot
 *                                                      was already claimed
 *                                                      (uses a debug slot key)
 *
 * Mirrors src/lib/reminder-engine.ts rule-for-rule and prints a PASS/SKIP
 * verdict per rule, so a skipped user shows the exact reason. --send goes
 * through the same claim → Meta Cloud API → history/settings updates as
 * production, scoped to this user only. Requires .env/.env.local (MONGODB_URI,
 * WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 */
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env");
if (process.env.MONGODB_DNS) {
  const servers = process.env.MONGODB_DNS.split(",").map((s) => s.trim()).filter(Boolean);
  if (servers.length) { try { dns.setServers(servers); } catch { /* system resolver */ } }
}

const email = process.argv[2];
const SEND = process.argv.includes("--send");
const FORCE = process.argv.includes("--force");
if (!email || email.startsWith("--")) {
  console.error("usage: node scripts/debug-reminder.mjs <email> [--send] [--force]");
  process.exit(2);
}

const ACTIVE_WINDOW_MS = 2 * 60_000;
let failed = false;
const rule = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "SKIP"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failed = true;
  return pass;
};

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);

try {
  const now = new Date();
  const user = await db.collection("users").findOne({ email: email.toLowerCase() });
  if (!rule("user exists", Boolean(user), user ? String(user._id) : `no account for ${email}`)) process.exit(1);
  rule("account active", !user.deletedAt && user.status === "active", `status=${user.status} deletedAt=${user.deletedAt ?? "null"}`);

  const s = await db.collection("reminder_settings").findOne({ userId: user._id });
  if (!rule("reminder settings exist", Boolean(s))) process.exit(1);
  rule("reminders enabled", s.reminderEnabled === true, `reminderEnabled=${s.reminderEnabled}`);

  const cc = (s.countryCode ?? "").trim();
  const num = (s.phoneNumber ?? "").trim();
  const to = /^\+\d{1,4}$/.test(cc) && /^\d{6,14}$/.test(num) ? `${cc}${num}` : null;
  rule("valid E.164 recipient", Boolean(to), to ? `${to.slice(0, 4)}…${to.slice(-2)}` : `countryCode=${JSON.stringify(cc)} phoneNumber len=${num.length}`);

  let tzOk = true;
  try { new Intl.DateTimeFormat("en-US", { timeZone: s.timezone }); } catch { tzOk = false; }
  rule("valid timezone", tzOk, s.timezone);

  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: s.timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const minutesOfDay = Number(p.hour) * 60 + Number(p.minute);
  const dateKey = `${p.year}-${p.month}-${p.day}`;
  const hhmm = (v, dflt) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : dflt; };
  const startMin = hhmm(s.reminderStart, 20 * 60);
  const endMin = hhmm(s.reminderEnd, 23 * 60 + 45);
  rule("inside reminder window", minutesOfDay >= startMin && minutesOfDay <= endMin, `local ${p.hour}:${p.minute}, window ${s.reminderStart}–${s.reminderEnd} (${s.timezone})`);

  const act = await db.collection("user_activity").findOne({ userId: user._id, dateKey });
  const goalMinutes = s.goalMinutes ?? 60;
  const activeSeconds = act?.activeSeconds ?? 0;
  rule("daily goal NOT completed", !(act?.goalCompleted || activeSeconds >= goalMinutes * 60), `${Math.floor(activeSeconds / 60)}/${goalMinutes} min, goalCompleted=${act?.goalCompleted ?? false}`);

  const hbAge = act?.lastHeartbeat ? now - act.lastHeartbeat : null;
  rule("NOT currently studying", !(hbAge !== null && hbAge <= ACTIVE_WINDOW_MS), hbAge === null ? "no heartbeat today" : `last heartbeat ${Math.round(hbAge / 1000)}s ago`);

  const interval = s.reminderInterval ?? 15;
  let slotKey = `${dateKey}#${interval}m#${Math.floor(minutesOfDay / interval)}`;
  rule("slot not already sent", s.lastReminderSlot !== slotKey, `current=${slotKey} last=${s.lastReminderSlot ?? "none"}`);

  console.log(`\nverdict: ${failed ? "user would be SKIPPED (see SKIP lines above)" : "user is ELIGIBLE right now"}`);

  if (!SEND) {
    console.log("(evaluation only — rerun with --send for a real end-to-end test send)");
    process.exit(failed ? 1 : 0);
  }
  if (failed && !FORCE) {
    console.log("refusing to send while a rule fails — add --force to override");
    process.exit(1);
  }
  if (FORCE) slotKey = `${slotKey}#debug-${now.getTime()}`;

  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  const pnid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !pnid) { console.error("WhatsApp credentials missing in env"); process.exit(1); }

  // Claim the slot exactly like production — the unique index makes this
  // idempotent against a concurrent scheduler run.
  let claimId;
  try {
    const ins = await db.collection("reminder_history").insertOne({
      userId: user._id, dateKey, slotKey, to, status: "pending", createdAt: now, updatedAt: now,
    });
    claimId = ins.insertedId;
  } catch (err) {
    if (err?.code === 11000) { console.log(`slot ${slotKey} already claimed — use --force to send anyway`); process.exit(1); }
    throw err;
  }

  const version = process.env.GRAPH_API_VERSION || process.env.WHATSAPP_GRAPH_VERSION || "v20.0";
  const remaining = Math.max(0, goalMinutes - Math.floor(activeSeconds / 60));
  const text = (v) => ({ type: "text", text: String(v).slice(0, 120) });
  const res = await fetch(`https://graph.facebook.com/${version}/${pnid}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: "task_due_reminder",
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [{ type: "body", parameters: [
          text(user.name || email.split("@")[0]),
          text("due today (debug test)"),
          text(`Daily study goal ${goalMinutes} min (${Math.floor(activeSeconds / 60)} min done)`),
          text(new Intl.DateTimeFormat("en-GB", { timeZone: s.timezone, day: "2-digit", month: "short", year: "numeric" }).format(now)),
          text(`${remaining} min remaining`),
        ] }],
      },
    }),
  });
  const json = await res.json().catch(() => null);
  console.log(`\nMeta Cloud API response (HTTP ${res.status}):`);
  console.log(JSON.stringify(json, null, 2));

  const okSend = res.ok && json?.messages?.[0]?.id;
  await db.collection("reminder_history").updateOne(
    { _id: claimId },
    { $set: okSend
      ? { status: "sent", messageId: json.messages[0].id, metaResponse: json, completedAt: new Date() }
      : { status: "failed", errorType: "debug", errorCode: String(json?.error?.code ?? res.status), errorMessage: String(json?.error?.message ?? "").slice(0, 500), metaResponse: json, completedAt: new Date() } },
  );
  if (okSend) {
    await db.collection("reminder_settings").updateOne(
      { _id: s._id },
      { $set: { lastReminderSentAt: new Date(), lastReminderSlot: slotKey, lastSendStatus: "ok", lastSendError: "" } },
    );
  }
  console.log(okSend ? `\nSENT — message id ${json.messages[0].id}` : "\nSEND FAILED — full Meta response above");
  process.exit(okSend ? 0 : 1);
} finally {
  await client.close();
}
