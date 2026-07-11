// READ-ONLY Google-roadmap analysis. Every number comes from MongoDB aggregation.
// Writes roadmap-tools/google-report.json and prints a summary.
// Run: node --env-file=.env roadmap-tools/analyze.mjs
import fs from "node:fs";
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

// ---- Google domain knowledge (priority + learning order over the 17 dashboard topics) ----
const PRIORITY = {
  "Dynamic Programming": "Critical", Graph: "Critical", Trees: "Critical", Arrays: "Critical",
  Strings: "High", "Binary Search": "High", Heap: "High", Recursion: "High", Greedy: "High",
  Stack: "Medium", Queue: "Medium", "Linked List": "Medium", "Bit Manipulation": "Medium", Mathematics: "Medium",
  "Number Theory": "Low", Geometry: "Low", Miscellaneous: "Low",
};
const PRIORITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const PREP_ORDER = ["Arrays","Strings","Linked List","Stack","Queue","Binary Search","Recursion",
  "Trees","Heap","Graph","Dynamic Programming","Greedy","Bit Manipulation","Mathematics",
  "Number Theory","Geometry","Miscellaneous"];
// Minimum problems we'd want available per topic to call coverage "complete" (Google prep target).
const COVERAGE_TARGET = {
  "Dynamic Programming": 120, Graph: 100, Trees: 90, Arrays: 120, Strings: 70,
  "Binary Search": 50, Heap: 40, Recursion: 50, Greedy: 60, Stack: 30, Queue: 20,
  "Linked List": 30, "Bit Manipulation": 25, Mathematics: 40, "Number Theory": 20,
  Geometry: 15, Miscellaneous: 40,
};

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

try {
  await connect();
  const col = mongoose.connection.db.collection("questions");
  const R = { generatedAt: new Date().toISOString(), db: mongoose.connection.db.databaseName };

  R.total = await col.countDocuments({ archived: { $ne: true } });

  // Global progress
  const solved = await col.countDocuments({ status: "Solved" });
  const attempted = await col.countDocuments({ status: "Attempted" });
  const favorite = await col.countDocuments({ favorite: true });
  const revision = await col.countDocuments({ revisionNeeded: true });
  R.progress = {
    solved, attempted, favorite, revision,
    solvedPct: pct(solved, R.total), favoritePct: pct(favorite, R.total), revisionPct: pct(revision, R.total),
  };

  // Distributions
  const grp = async (f, extra = {}) =>
    (await col.aggregate([{ $match: { archived: { $ne: true }, ...extra } },
      { $group: { _id: `$${f}`, n: { $sum: 1 }, solved: { $sum: { $cond: [{ $eq: ["$status", "Solved"] }, 1, 0] } } } },
      { $sort: { n: -1 } }]).toArray()).map((r) => ({ key: r._id, total: r.n, solved: r.solved }));

  R.byDifficulty = await grp("difficulty");
  R.byPlatform = await grp("platform");
  R.byPattern = (await grp("pattern")).filter((r) => r.key);

  // Per-topic rich breakdown (Steps 4 & 8)
  R.byTopic = await col.aggregate([
    { $match: { archived: { $ne: true } } },
    { $group: {
      _id: "$topic", total: { $sum: 1 },
      solved: { $sum: { $cond: [{ $eq: ["$status", "Solved"] }, 1, 0] } },
      easy: { $sum: { $cond: [{ $eq: ["$difficulty", "Easy"] }, 1, 0] } },
      medium: { $sum: { $cond: [{ $eq: ["$difficulty", "Medium"] }, 1, 0] } },
      hard: { $sum: { $cond: [{ $eq: ["$difficulty", "Hard"] }, 1, 0] } },
      leetcode: { $sum: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 1, 0] } },
      codeforces: { $sum: { $cond: [{ $eq: ["$platform", "Codeforces"] }, 1, 0] } },
      striver: { $sum: { $cond: [{ $in: ["Striver", "$tags"] }, 1, 0] } },
      expertOrigin: { $sum: { $cond: [{ $in: ["Origin:Expert", "$tags"] }, 1, 0] } },
    } },
    { $sort: { total: -1 } },
  ]).toArray();

  R.byTopic = R.byTopic.map((t) => {
    const priority = PRIORITY[t._id] || "Low";
    const target = COVERAGE_TARGET[t._id] || 40;
    return {
      topic: t._id, priority, orderIndex: PREP_ORDER.indexOf(t._id) + 1,
      total: t.total, easy: t.easy, medium: t.medium, hard: t.hard,
      leetcode: t.leetcode, codeforces: t.codeforces, striver: t.striver, expertOrigin: t.expertOrigin,
      solved: t.solved, remaining: t.total - t.solved, completionPct: pct(t.solved, t.total),
      coverageTarget: target, coveragePct: Math.min(100, pct(t.total, target)),
    };
  });

  // Subtopic breakdown (Step 5)
  R.subtopics = await col.aggregate([
    { $match: { archived: { $ne: true } } },
    { $group: { _id: { topic: "$topic", subtopic: "$subtopic" }, total: { $sum: 1 },
      solved: { $sum: { $cond: [{ $eq: ["$status", "Solved"] }, 1, 0] } } } },
    { $sort: { "_id.topic": 1, total: -1 } },
  ]).toArray().then((rows) => rows.map((r) => ({
    topic: r._id.topic, subtopic: r._id.subtopic || "(unset)",
    total: r.total, solved: r.solved, remaining: r.total - r.solved, completionPct: pct(r.solved, r.total),
  })));

  // Google difficulty tiers (Step 10)
  const cnt = (q) => col.countDocuments({ archived: { $ne: true }, ...q });
  R.googleTiers = {
    Foundation: await cnt({ difficulty: "Easy" }),
    Intermediate: await cnt({ difficulty: "Medium", platform: "LeetCode" }),
    "Interview Ready": await cnt({ tags: "Striver" }),
    "Google Hard": await cnt({ difficulty: "Hard", platform: "LeetCode" }),
    "Research Level": await cnt({ tags: "Origin:Expert" }),
  };

  // Company overlap (Step 11) — depends on q.companies being populated.
  R.companyOverlap = await col.aggregate([
    { $unwind: "$companies" },
    { $group: { _id: "$companies", n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]).toArray();

  // Google Hard list (Step 13) — true-hard problems worth targeting.
  R.googleHardList = await col.find(
    { $or: [{ tags: "Origin:Expert" }, { difficulty: "Hard", platform: "LeetCode", tags: "Striver" }] },
    { projection: { _id: 0, title: 1, platform: 1, topic: 1, difficulty: 1, problemLink: 1 } },
  ).limit(25).toArray();

  // Smart recommendations (Step 13): highest-priority UNSOLVED, Striver + LeetCode first.
  R.recommendations = {};
  const prioRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const rec = await col.aggregate([
    { $match: { archived: { $ne: true }, status: { $ne: "Solved" } } },
    { $addFields: { isStriver: { $cond: [{ $in: ["Striver", "$tags"] }, 0, 1] },
                    isLC: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 0, 1] } } },
    { $project: { _id: 0, title: 1, topic: 1, difficulty: 1, platform: 1, problemLink: 1, isStriver: 1, isLC: 1 } },
  ]).toArray();
  rec.sort((a, b) => (prioRank[PRIORITY[a.topic] || "Low"] - prioRank[PRIORITY[b.topic] || "Low"])
    || (a.isStriver - b.isStriver) || (a.isLC - b.isLC));
  R.recommendations.today = rec.slice(0, 5);
  R.recommendations.weekly = rec.slice(0, 25);

  // Readiness score
  let wSum = 0, covSum = 0, progSum = 0;
  for (const t of R.byTopic) {
    const w = PRIORITY_WEIGHT[t.priority];
    wSum += w; covSum += w * (t.coveragePct / 100); progSum += w * (t.completionPct / 100);
  }
  R.readiness = {
    coverageScore: Math.round((covSum / wSum) * 100),
    progressScore: Math.round((progSum / wSum) * 100),
    overall: Math.round(((covSum * 0.4 + progSum * 0.6) / wSum) * 100),
    note: "overall = 40% topic-coverage + 60% solved-progress, weighted by Google priority",
  };

  // Weak / strong topics (by completion among Critical/High priority)
  const focus = R.byTopic.filter((t) => ["Critical", "High"].includes(t.priority));
  R.weakTopics = [...focus].sort((a, b) => a.completionPct - b.completionPct).slice(0, 6)
    .map((t) => ({ topic: t.topic, priority: t.priority, completionPct: t.completionPct, remaining: t.remaining }));
  R.strongTopics = [...focus].sort((a, b) => b.completionPct - a.completionPct).slice(0, 6)
    .map((t) => ({ topic: t.topic, priority: t.priority, completionPct: t.completionPct, solved: t.solved }));

  fs.writeFileSync("roadmap-tools/google-report.json", JSON.stringify(R, null, 2));

  // ---- console summary ----
  console.log(`\n=== GOOGLE ROADMAP ANALYSIS (db: ${R.db}) ===`);
  console.log(`total active: ${R.total} | solved: ${solved} (${R.progress.solvedPct}%) | favorites: ${favorite} | revision: ${revision}`);
  console.log(`\nBy difficulty:`, R.byDifficulty.map((d) => `${d.key}:${d.total}`).join("  "));
  console.log(`By platform :`, R.byPlatform.map((d) => `${d.key}:${d.total}`).join("  "));
  console.log(`\nTopic (priority) ......... total  [E/M/H]  LC/CF/Striver  cov%`);
  for (const t of [...R.byTopic].sort((a, b) => a.orderIndex - b.orderIndex)) {
    console.log(`  ${(t.topic + " (" + t.priority + ")").padEnd(34)} ${String(t.total).padStart(5)}  [${t.easy}/${t.medium}/${t.hard}]  ${t.leetcode}/${t.codeforces}/${t.striver}  ${t.coveragePct}%`);
  }
  console.log(`\nGoogle tiers:`, JSON.stringify(R.googleTiers));
  console.log(`Company overlap entries: ${R.companyOverlap.length} ${R.companyOverlap.length ? "" : "(companies field empty in data)"}`);
  console.log(`Readiness: coverage ${R.readiness.coverageScore}%  progress ${R.readiness.progressScore}%  overall ${R.readiness.overall}%`);
  console.log(`\nreport -> roadmap-tools/google-report.json`);
} catch (e) {
  console.error("ANALYZE_ERROR:", e.name, "-", e.message);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
