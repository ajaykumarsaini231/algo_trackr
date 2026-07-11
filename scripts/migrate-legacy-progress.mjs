/**
 * One-time migration: copy legacy SINGLE-USER progress embedded on Question
 * documents (status/favorite/notes/rating/…) into the per-user
 * `user_progress` collection for ONE designated account.
 *
 * Usage:
 *   node scripts/migrate-legacy-progress.mjs you@example.com
 *
 * Reads MONGODB_URI from .env.local / .env. Idempotent: existing
 * (userId, questionId) rows are left untouched. Nothing is deleted — the
 * legacy fields stay on Question docs (ignored by the app) as a backup.
 */
import { readFileSync, existsSync } from "node:fs";
import mongoose from "mongoose";

// Minimal .env loader (no dependency on next's env pipeline).
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    // Strip surrounding quotes the way Next's env pipeline does.
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/migrate-legacy-progress.mjs <account-email>");
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

// Networks that block SRV DNS (querySrv ECONNREFUSED) fall back to the
// project's DNS-over-HTTPS seed-list resolver, mirroring src/lib/db.ts.
try {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
} catch (err) {
  if (uri.startsWith("mongodb+srv://") && /querySrv|ENOTFOUND|ECONNREFUSED/.test(String(err))) {
    const { resolveDirectUri } = await import("../roadmap-tools/connect.mjs");
    await mongoose.connect(await resolveDirectUri(uri), {
      dbName: process.env.MONGODB_DB || undefined,
    });
  } else {
    throw err;
  }
}
const db = mongoose.connection.db;

const user = await db.collection("users").findOne({ email });
if (!user) {
  console.error(`No user with email ${email} — register the account first.`);
  process.exit(1);
}

// Only questions that actually carry non-default legacy state.
const cursor = db.collection("questions").find(
  {
    $or: [
      { status: { $nin: [null, "Not Started"] } },
      { favorite: true },
      { revisionNeeded: true },
      { attemptCount: { $gt: 0 } },
      { rating: { $gt: 0 } },
      { notes: { $nin: [null, ""] } },
      { revisionNotes: { $nin: [null, ""] } },
      { solvedAt: { $ne: null } },
      { lastRevisedAt: { $ne: null } },
      { revisionDate: { $ne: null } },
    ],
  },
  { projection: { status: 1, favorite: 1, revisionNeeded: 1, lastRevisedAt: 1, revisionDate: 1, attemptCount: 1, rating: 1, notes: 1, revisionNotes: 1, solvedAt: 1 } },
);

let migrated = 0;
let skipped = 0;
const now = new Date();

for await (const q of cursor) {
  const res = await db.collection("user_progress").updateOne(
    { userId: user._id, questionId: q._id },
    {
      $setOnInsert: {
        userId: user._id,
        questionId: q._id,
        status: q.status ?? "Not Started",
        favorite: Boolean(q.favorite),
        revisionNeeded: Boolean(q.revisionNeeded),
        lastRevisedAt: q.lastRevisedAt ?? null,
        revisionDate: q.revisionDate ?? null,
        attemptCount: q.attemptCount ?? 0,
        rating: q.rating ?? 0,
        notes: q.notes ?? "",
        revisionNotes: q.revisionNotes ?? "",
        solvedAt: q.solvedAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  if (res.upsertedCount > 0) migrated++;
  else skipped++;
}

console.log(`Done. Migrated ${migrated} question(s) to ${email}; ${skipped} already had progress rows.`);
await mongoose.disconnect();
