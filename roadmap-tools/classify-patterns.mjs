// Backfill patterns[] for every question from official tags + topic + existing
// single `pattern`. Writes patterns/patternConfidence/patternMethod. Idempotent.
// NEVER overwrites docs flagged patternManual:true.
// Run: node --env-file=.env roadmap-tools/classify-patterns.mjs
import fs from "node:fs";
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

const CAT = JSON.parse(fs.readFileSync("src/data/pattern-catalog.json", "utf8"));
const TAG_MAP = CAT.tagMap, TOPIC_MAP = CAT.topicMap;
const VALID = new Set(CAT.patterns.map((p) => p.slug));
const norm = (s) => String(s).toLowerCase().trim();

// dashboard single `pattern` -> slugs
const PATTERN_FIELD_MAP = {
  "Sliding Window": ["variable-window"], "Two Pointer": ["two-pointer"], "Greedy": ["greedy-choice"],
  "DP": ["memoization", "tabulation"], "Graph": ["graph-dfs", "graph-bfs"], "DFS": ["graph-dfs"], "BFS": ["graph-bfs"],
  "Trie": ["trie"], "Binary Search": ["binary-search"], "Monotonic Stack": ["monotonic-stack"],
  "Backtracking": ["subset", "permutation", "combination"], "Heap": ["priority-queue-heap", "top-k"],
  "Hashing": ["hashmap"], "Tree": ["tree-traversal"], "Recursion": ["recursion"], "Bitmask": ["bitmask"],
  "Math": ["gcd", "modular-arithmetic"],
};

function classify(q) {
  const fromTags = new Set();
  for (const t of q.tags || []) for (const s of TAG_MAP[norm(t)] || []) if (VALID.has(s)) fromTags.add(s);
  const fromField = new Set();
  for (const s of PATTERN_FIELD_MAP[q.pattern] || []) if (VALID.has(s)) fromField.add(s);
  const fromTopic = new Set();
  for (const s of TOPIC_MAP[q.topic] || []) if (VALID.has(s)) fromTopic.add(s);

  const all = new Set([...fromTags, ...fromField]);
  let method, confidence;
  if (fromTags.size) { method = "tags"; confidence = fromTags.size >= 3 ? 0.95 : 0.9; }
  else if (fromField.size) { method = "pattern-field"; confidence = 0.75; }
  else { method = "topic"; confidence = 0.5; }

  // Always ensure at least one pattern via topic fallback.
  if (!all.size) { for (const s of fromTopic) all.add(s); method = "topic"; confidence = 0.5; }
  if (!all.size) { all.add("ad-hoc"); method = "fallback"; confidence = 0.35; }
  return { patterns: [...all].slice(0, 8), confidence, method };
}

try {
  await connect();
  const col = mongoose.connection.db.collection("questions");
  const cursor = col.find({ patternManual: { $ne: true } }, { projection: { tags: 1, topic: 1, pattern: 1 } });

  let ops = [], processed = 0, modified = 0;
  const dist = {}, methodDist = {}, sizeDist = {};
  const flush = async () => {
    if (!ops.length) return;
    const r = await col.bulkWrite(ops, { ordered: false });
    modified += r.modifiedCount;
    ops = [];
  };
  for await (const q of cursor) {
    const c = classify(q);
    for (const p of c.patterns) dist[p] = (dist[p] || 0) + 1;
    methodDist[c.method] = (methodDist[c.method] || 0) + 1;
    sizeDist[c.patterns.length] = (sizeDist[c.patterns.length] || 0) + 1;
    ops.push({ updateOne: { filter: { _id: q._id }, update: { $set: { patterns: c.patterns, patternConfidence: c.confidence, patternMethod: c.method } } } });
    processed++;
    if (ops.length >= 1000) { await flush(); process.stdout.write(`\r  ${processed} ...`); }
  }
  await flush();

  const withArr = await col.countDocuments({ "patterns.0": { $exists: true } });
  const zero = await col.countDocuments({ patterns: { $size: 0 } });
  console.log(`\nprocessed ${processed} | modified ${modified} | now with patterns[]: ${withArr} | empty: ${zero}`);
  console.log("method:", JSON.stringify(methodDist));
  console.log("patterns-per-question:", JSON.stringify(sizeDist));
  console.log("\ntop 25 patterns:");
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${k.padEnd(22)} ${v}`);
} catch (e) { console.error("CLASSIFY_ERROR:", e.name, "-", e.message); process.exitCode = 2; }
finally { await mongoose.disconnect().catch(() => {}); }
