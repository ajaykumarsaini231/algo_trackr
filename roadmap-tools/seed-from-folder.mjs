// Seed the dashboard DB from last session's dataset file, mapped to the EXACT
// dashboard Question schema. Idempotent (unique index on problemLink + ordered:false
// insert). Progress fields are set to defaults ONLY on insert; re-runs never touch
// existing docs. READ of file -> WRITE of new question docs only. No existing data
// is modified (the collection starts empty).
//
// Run: node --env-file=.env roadmap-tools/seed-from-folder.mjs
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

const SRC = path.resolve("dsa-question-db/data/dsa-questions.ndjson");

// ---- mapping tables (data vocab -> dashboard vocab) ----
const PLATFORM = {
  leetcode: "LeetCode", codeforces: "Codeforces",
  gfg: "GeeksforGeeks", codingninjas: "Coding Ninjas",
};
// User chose: keep 3 tiers, Expert -> Hard. Unrated -> Medium (neutral; documented).
const DIFF = { Easy: "Easy", Medium: "Medium", Hard: "Hard", Expert: "Hard", Unrated: "Medium" };

// ~40 pipeline topics -> the dashboard's 17 curated topics.
const TOPIC = {
  Arrays: "Arrays", "Hash Table": "Arrays", "Prefix Sum": "Arrays", "Sliding Window": "Arrays",
  "Two Pointer": "Arrays", Sorting: "Arrays", Matrix: "Arrays",
  Strings: "Strings", Trie: "Strings",
  "Linked List": "Linked List",
  Stack: "Stack", Queue: "Queue", Deque: "Queue",
  Heap: "Heap",
  Tree: "Trees", BST: "Trees", "Segment Tree": "Trees", "Fenwick Tree": "Trees",
  Graph: "Graph", DFS: "Graph", BFS: "Graph", "Topological Sort": "Graph",
  "Shortest Path": "Graph", "Minimum Spanning Tree": "Graph", "Union Find": "Graph",
  "Dynamic Programming": "Dynamic Programming", "Game Theory": "Dynamic Programming",
  Greedy: "Greedy",
  "Binary Search": "Binary Search",
  Recursion: "Recursion", Backtracking: "Recursion",
  "Bit Manipulation": "Bit Manipulation",
  Math: "Mathematics", Combinatorics: "Mathematics", Probability: "Mathematics",
  "Number Theory": "Number Theory",
  Geometry: "Geometry",
  Simulation: "Miscellaneous", Implementation: "Miscellaneous", Constructive: "Miscellaneous",
  Interactive: "Miscellaneous", Design: "Miscellaneous", "Divide and Conquer": "Miscellaneous",
  "Data Structures": "Miscellaneous", Miscellaneous: "Miscellaneous",
};
// pipeline pattern -> dashboard PATTERN_NAMES (unmapped -> "")
const PATTERN = {
  "Sliding Window": "Sliding Window", "Two Pointer": "Two Pointer", Greedy: "Greedy",
  "Dynamic Programming": "DP", Graph: "Graph", DFS: "DFS", BFS: "BFS", Trie: "Trie",
  "Binary Search": "Binary Search", Backtracking: "Backtracking", Heap: "Heap",
  "Hash Table": "Hashing", Tree: "Tree", Recursion: "Recursion", "Bit Manipulation": "Bitmask",
  Math: "Math", "Number Theory": "Math",
};

function mapDoc(d, now) {
  const dashTopic = TOPIC[d.topic] || "Miscellaneous";
  const subtopic = d.isStriverQuestion && d.striverSubtopic
    ? d.striverSubtopic
    : d.topic && d.topic !== dashTopic ? d.topic : d.subtopic || "";
  const tags = [...new Set([
    ...(Array.isArray(d.tags) ? d.tags : []),
    ...(d.isStriverQuestion ? ["Striver", `Striver:${d.striverStep}`] : []),
    ...(["Expert", "Unrated"].includes(d.difficulty) ? [`Origin:${d.difficulty}`] : []),
    ...(d.platform === "codeforces" && d.rating ? [`CF${d.rating}`] : []),
  ].filter(Boolean))];

  return {
    title: d.title,
    problemLink: d.url || "",
    platform: PLATFORM[d.platform] || "Others",
    difficulty: DIFF[d.difficulty] || "Medium",
    topic: dashTopic,
    subtopic,
    pattern: PATTERN[d.pattern] || "",
    companies: [],
    concept: "",
    approach: "",
    timeComplexity: d.timeComplexity || "",
    spaceComplexity: d.spaceComplexity || "",
    solutionLink: "",
    videoLink: "",
    editorialLink: "",
    notes: "",
    revisionNotes: "",
    status: "Not Started",
    favorite: false,
    revisionNeeded: false,
    lastRevisedAt: null,
    revisionDate: null,
    attemptCount: 0,
    rating: 0,
    interviewLevel: "",
    estimatedTime: 0,
    tags,
    archived: false,
    solvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

try {
  if (!fs.existsSync(SRC)) throw new Error(`Source not found: ${SRC}`);
  await connect();
  const col = mongoose.connection.db.collection("questions");

  const existing = await col.countDocuments({});
  console.log(`connected to "${mongoose.connection.db.databaseName}", existing questions: ${existing}`);

  await col.createIndex({ problemLink: 1 }, { unique: true, name: "uniq_problemLink" });

  const now = new Date();
  const rl = readline.createInterface({ input: fs.createReadStream(SRC), crlfDelay: Infinity });
  let batch = [], inserted = 0, dup = 0, read = 0;
  const mapCounts = {};

  const flush = async () => {
    if (!batch.length) return;
    try {
      const r = await col.insertMany(batch, { ordered: false });
      inserted += r.insertedCount;
    } catch (e) {
      // duplicate-key errors are expected on re-run; count real inserts.
      inserted += e.result?.insertedCount ?? e.result?.nInserted ?? 0;
      dup += (e.writeErrors || []).length;
    }
    batch = [];
  };

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    read++;
    const doc = mapDoc(JSON.parse(t), now);
    mapCounts[doc.topic] = (mapCounts[doc.topic] || 0) + 1;
    batch.push(doc);
    if (batch.length >= 1000) { await flush(); process.stdout.write(`\r  read ${read} ...`); }
  }
  await flush();

  const total = await col.countDocuments({});
  console.log(`\nread ${read} | inserted ${inserted} | duplicates skipped ${dup} | collection total now ${total}`);
  console.log("topic distribution (mapped):");
  for (const [k, v] of Object.entries(mapCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);
} catch (e) {
  console.error("SEED_ERROR:", e.name, "-", e.message);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
