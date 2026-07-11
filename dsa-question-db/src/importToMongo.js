// Idempotent MongoDB import ("direct push to db").
//
//   node --env-file=.env src/importToMongo.js
//
// Re-run safe: official + derived fields are refreshed via $set; user-enrichable fields
// (companies, notes, complexity, ...) are written via $setOnInsert, so manual edits made
// in the DB are preserved across re-imports. New problems are inserted; existing updated.
import fs from "node:fs";
import readline from "node:readline";
import { MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION, OUT_NDJSON } from "./config.js";

// --dry-run validates the transform (field-ownership split) without touching MongoDB.
const DRY = process.argv.includes("--dry-run");

// Written only on first insert; never overwritten on re-runs.
const ENRICHABLE = new Set([
  "summary", "notes", "timeComplexity", "spaceComplexity", "prerequisites",
  "similarQuestions", "companies", "commonMistakes", "alternativeApproaches",
]);

async function* readDocs(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (t) yield JSON.parse(t);
  }
}

function toUpdate(doc) {
  const set = {};
  const setOnInsert = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === "_id") continue;
    if (ENRICHABLE.has(k)) setOnInsert[k] = v;
    else set[k] = v;
  }
  setOnInsert.createdAt = doc.lastUpdated || new Date().toISOString();
  return {
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: set, $setOnInsert: setOnInsert },
      upsert: true,
    },
  };
}

async function main() {
  if (!fs.existsSync(OUT_NDJSON)) {
    throw new Error(`Missing ${OUT_NDJSON}. Run "npm run build" first.`);
  }

  if (DRY) {
    let n = 0, first = null, leaks = new Set();
    for await (const doc of readDocs(OUT_NDJSON)) {
      const op = toUpdate(doc);
      // A field must never appear in BOTH $set and $setOnInsert, and no enrichable
      // field may live in $set (that would overwrite manual edits on re-import).
      for (const k of Object.keys(op.updateOne.update.$setOnInsert))
        if (k in op.updateOne.update.$set) leaks.add(k);
      if (!first) first = op;
      n++;
    }
    console.log(`[dry-run] built ${n} upsert ops`);
    console.log(`[dry-run] enrichable-in-$set leaks: ${leaks.size ? [...leaks].join(",") : "none (OK)"}`);
    console.log(`[dry-run] sample op:\n` + JSON.stringify(first, null, 1).slice(0, 900));
    return;
  }

  const { MongoClient } = await import("mongodb");
  console.log(`Connecting to ${MONGODB_URI} -> ${MONGODB_DB}.${MONGODB_COLLECTION}`);
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const col = client.db(MONGODB_DB).collection(MONGODB_COLLECTION);

  let ops = [];
  let inserted = 0, modified = 0, upserts = 0, processed = 0;
  const flush = async () => {
    if (!ops.length) return;
    const r = await col.bulkWrite(ops, { ordered: false });
    upserts += r.upsertedCount;
    modified += r.modifiedCount;
    ops = [];
  };

  for await (const doc of readDocs(OUT_NDJSON)) {
    ops.push(toUpdate(doc));
    processed++;
    if (ops.length >= 1000) {
      await flush();
      process.stdout.write(`\r  processed ${processed} ...`);
    }
  }
  await flush();

  console.log(`\n  upserted(new): ${upserts}  modified(existing): ${modified}  total processed: ${processed}`);

  console.log("  ensuring indexes ...");
  await col.createIndexes([
    { key: { platform: 1 } },
    { key: { difficulty: 1 } },
    { key: { learningLevel: 1 } },
    { key: { topic: 1 } },
    { key: { tags: 1 } },
    { key: { rating: 1 } },
    { key: { companies: 1 } },
    { key: { isStriverQuestion: 1, striverStepNo: 1, striverOrder: 1 } },
    { key: { premium: 1 } },
    { key: { title: "text", topic: "text", tags: "text" }, name: "search_text" },
  ]);

  const count = await col.countDocuments();
  console.log(`  collection now holds ${count} documents. Done.`);
  await client.close();
}

main().catch((e) => {
  console.error("\nIMPORT FAILED:", e.message);
  process.exit(1);
});
