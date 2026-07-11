// Backfill learningScore / difficultyRank / estimatedSolveTime for every question.
// DERIVED fields only — never touches status/notes/favorite/revision/etc. Idempotent.
// Run: node --env-file=.env roadmap-tools/rank-learning.mjs
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

// Canonical Blind 75 slugs (mirror of src/lib/sheets.ts BLIND_75) — "most fundamental".
const BLIND75 = new Set([
  "two-sum","contains-duplicate","valid-anagram","group-anagrams","top-k-frequent-elements",
  "product-of-array-except-self","encode-and-decode-strings","longest-consecutive-sequence",
  "valid-palindrome","3sum","container-with-most-water","best-time-to-buy-and-sell-stock",
  "longest-substring-without-repeating-characters","longest-repeating-character-replacement",
  "minimum-window-substring","valid-parentheses","find-minimum-in-rotated-sorted-array",
  "search-in-rotated-sorted-array","reverse-linked-list","merge-two-sorted-lists","reorder-list",
  "remove-nth-node-from-end-of-list","linked-list-cycle","merge-k-sorted-lists","invert-binary-tree",
  "maximum-depth-of-binary-tree","same-tree","subtree-of-another-tree",
  "lowest-common-ancestor-of-a-binary-search-tree","binary-tree-level-order-traversal",
  "validate-binary-search-tree","kth-smallest-element-in-a-bst",
  "construct-binary-tree-from-preorder-and-inorder-traversal","binary-tree-maximum-path-sum",
  "serialize-and-deserialize-binary-tree","implement-trie-prefix-tree",
  "design-add-and-search-words-data-structure","word-search-ii","find-median-from-data-stream",
  "combination-sum","word-search","number-of-islands","clone-graph","pacific-atlantic-water-flow",
  "course-schedule","number-of-connected-components-in-an-undirected-graph","graph-valid-tree",
  "alien-dictionary","climbing-stairs","house-robber","house-robber-ii","longest-palindromic-substring",
  "palindromic-substrings","decode-ways","coin-change","maximum-product-subarray","word-break",
  "longest-increasing-subsequence","unique-paths","longest-common-subsequence","maximum-subarray",
  "jump-game","insert-interval","merge-intervals","non-overlapping-intervals","meeting-rooms",
  "meeting-rooms-ii","rotate-image","spiral-matrix","set-matrix-zeroes","number-of-1-bits",
  "counting-bits","reverse-bits","missing-number","sum-of-two-integers",
]);

const TOPIC_PRIORITY = {
  "Dynamic Programming": 30, Graph: 30, Trees: 30, Arrays: 30,
  Strings: 20, "Binary Search": 20, Heap: 20, Recursion: 20, Greedy: 20,
  Stack: 10, Queue: 10, "Linked List": 10, "Bit Manipulation": 10, Mathematics: 10,
  "Number Theory": 5, Geometry: 5, Miscellaneous: 5,
};

const slugOf = (link) => (link || "").split("/problems/")[1]?.split("/")[0] || "";
const EST = [15, 15, 25, 45, 60]; // minutes by difficultyRank 0..4

function rankOf(q) {
  const tags = q.tags || [];
  const isExpert = tags.includes("Origin:Expert");
  const fundamental = q.difficulty === "Easy" && (BLIND75.has(slugOf(q.problemLink)) || tags.includes("Striver"));
  if (fundamental) return 0;          // very easy / most fundamental first
  if (q.difficulty === "Easy") return 1;
  if (q.difficulty === "Medium") return 2;
  if (isExpert) return 4;             // CF Expert
  return 3;                           // Hard
}

function scoreOf(q) {
  const tags = q.tags || [];
  return (
    (BLIND75.has(slugOf(q.problemLink)) ? 50 : 0) +
    (tags.includes("Striver") ? 40 : 0) +
    (q.platform === "LeetCode" ? 15 : 0) +
    (TOPIC_PRIORITY[q.topic] || 5)
  );
}

try {
  await connect();
  const col = mongoose.connection.db.collection("questions");
  const cursor = col.find({}, { projection: { difficulty: 1, topic: 1, platform: 1, tags: 1, problemLink: 1 } });

  let ops = [], processed = 0, modified = 0;
  const rankDist = {};
  const flush = async () => {
    if (!ops.length) return;
    const r = await col.bulkWrite(ops, { ordered: false });
    modified += r.modifiedCount;
    ops = [];
  };
  for await (const q of cursor) {
    const difficultyRank = rankOf(q);
    const learningScore = scoreOf(q);
    const estimatedSolveTime = EST[difficultyRank];
    rankDist[difficultyRank] = (rankDist[difficultyRank] || 0) + 1;
    ops.push({ updateOne: { filter: { _id: q._id }, update: { $set: { difficultyRank, learningScore, estimatedSolveTime } } } });
    processed++;
    if (ops.length >= 1000) { await flush(); process.stdout.write(`\r  ${processed} ...`); }
  }
  await flush();
  console.log(`\nprocessed ${processed} | modified ${modified}`);
  console.log("difficultyRank distribution (0=very-easy … 4=expert):", JSON.stringify(rankDist));
} catch (e) { console.error("RANK_ERROR:", e.name, "-", e.message); process.exitCode = 2; }
finally { await mongoose.disconnect().catch(() => {}); }
