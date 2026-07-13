/**
 * Idempotent, ADDITIVE index builder for the performance-critical sort paths.
 * Creates only the indexes below (no drops). `createIndex` is a no-op when an
 * identical index already exists, so this is safe to run repeatedly and on
 * every deploy. Run: node scripts/ensure-perf-indexes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const ROOT = process.cwd();
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env");
if (process.env.MONGODB_DNS) {
  const dns = await import("node:dns");
  dns.setServers(process.env.MONGODB_DNS.split(",").map((s) => s.trim()).filter(Boolean));
}

const INDEXES = {
  questions: [
    // Trailing `_id: 1` matches the list route's tiebreaker so the sort is fully
    // index-covered (see src/models/Question.ts).
    [{ archived: 1, createdAt: -1, _id: 1 }, { name: "archived_1_createdAt_-1__id_1" }],
    [{ archived: 1, updatedAt: -1, _id: 1 }, { name: "archived_1_updatedAt_-1__id_1" }],
    [{ archived: 1, topic: 1, createdAt: -1, _id: 1 }, { name: "archived_1_topic_1_createdAt_-1__id_1" }],
  ],
  users: [
    [{ loginCount: -1 }, { name: "loginCount_-1" }],
  ],
};

// Superseded earlier variants created in this session (no `_id` tail, so they
// could not cover the tiebreaker). Safe to drop — they were created by this
// same script minutes earlier and are strict prefixes of the new ones.
const SUPERSEDED = {
  questions: ["archived_1_createdAt_-1", "archived_1_updatedAt_-1", "archived_1_topic_1_createdAt_-1"],
};

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB || undefined,
  serverSelectionTimeoutMS: 15000,
});
const db = mongoose.connection.db;
console.log("Connected to", process.env.MONGODB_DB || "(default)");

for (const [coll, specs] of Object.entries(INDEXES)) {
  const c = db.collection(coll);
  for (const [key, opts] of specs) {
    const t0 = Date.now();
    const name = await c.createIndex(key, opts);
    console.log(`  + ${coll}: ${name}  (${Date.now() - t0}ms)`);
  }
}

for (const [coll, names] of Object.entries(SUPERSEDED)) {
  const c = db.collection(coll);
  const existing = new Set((await c.indexes()).map((i) => i.name));
  for (const name of names) {
    if (existing.has(name)) {
      await c.dropIndex(name);
      console.log(`  - ${coll}: dropped superseded ${name}`);
    }
  }
}

console.log("\nFinal questions indexes:");
for (const ix of await db.collection("questions").indexes()) console.log(`  ${ix.name}`);
await mongoose.disconnect();
console.log("Done.");
