import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { getUserOverlay, activeRow } from "@/lib/progress";
import { cachedCatalog } from "@/lib/catalog-cache";
import Question from "@/models/Question";
import {
  GOOGLE_PRIORITY, PRIORITY_WEIGHT, PREP_ORDER, COVERAGE_TARGET,
  type GooglePriority, type GoogleRoadmap, type GoogleTopicRow, type GoogleRecommendation,
} from "@/lib/google";

/**
 * Google interview-prep roadmap for one user — shared by `/api/google` (the SWR
 * endpoint) and the `/google` server page (SSR fallback), so both agree.
 *
 * The catalog half (totals, per-topic/platform/difficulty rollups, tiers,
 * company overlap, the Google-Hard list) is identical for every user and is
 * computed as ONE cached batch (was ~10 sequential queries per request). Only
 * the caller's progress rollups and the personalized recommendations are
 * per-user, and they run concurrently with the cached catalog read.
 */

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };

const topicsByPriority = (p: GooglePriority) =>
  Object.keys(GOOGLE_PRIORITY).filter((t) => GOOGLE_PRIORITY[t] === p);

interface GoogleCatalog {
  total: number;
  byDifficultyRaw: { key: string; total: number }[];
  byPlatformRaw: { key: string; total: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawTopics: any[];
  companyOverlap: { company: string; total: number }[];
  tiers: { label: GoogleRoadmap["tiers"][number]["label"]; count: number }[];
  googleHardList: GoogleRecommendation[];
}

/** User-independent catalog structure (cached, dropped on any question write). */
async function googleCatalog(): Promise<GoogleCatalog> {
  return cachedCatalog<GoogleCatalog>("google:catalog", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grp = async (field: string): Promise<{ key: string; total: number }[]> =>
      (await Question.aggregate([
        { $match: ACTIVE },
        { $group: { _id: `$${field}`, total: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ])).map((r) => ({ key: r._id, total: r.total }));
    const tierCount = (q: Record<string, unknown>) => Question.countDocuments({ ...ACTIVE, ...q });

    // All catalog reads fire concurrently (was strictly sequential).
    const [
      total, byDifficultyRaw, byPlatformRaw, rawTopics, companyOverlapRaw,
      foundation, intermediate, interviewReady, googleHard, research, googleHardList,
    ] = await Promise.all([
      Question.countDocuments(ACTIVE),
      grp("difficulty"),
      grp("platform"),
      Question.aggregate([
        { $match: ACTIVE },
        { $group: {
          _id: "$topic", total: { $sum: 1 },
          easy: { $sum: { $cond: [{ $eq: ["$difficulty", "Easy"] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ["$difficulty", "Medium"] }, 1, 0] } },
          hard: { $sum: { $cond: [{ $eq: ["$difficulty", "Hard"] }, 1, 0] } },
          leetcode: { $sum: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 1, 0] } },
          codeforces: { $sum: { $cond: [{ $eq: ["$platform", "Codeforces"] }, 1, 0] } },
          striver: { $sum: { $cond: [{ $in: ["Striver", "$tags"] }, 1, 0] } },
          expertOrigin: { $sum: { $cond: [{ $in: ["Origin:Expert", "$tags"] }, 1, 0] } },
        } },
      ]),
      Question.aggregate([
        { $match: ACTIVE }, { $unwind: "$companies" },
        { $group: { _id: "$companies", total: { $sum: 1 } } },
        { $sort: { total: -1 } }, { $limit: 30 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]).then((rs) => rs.map((r: any) => ({ company: r._id, total: r.total }))),
      tierCount({ difficulty: "Easy" }),
      tierCount({ difficulty: "Medium", platform: "LeetCode" }),
      tierCount({ tags: "Striver" }),
      tierCount({ difficulty: "Hard", platform: "LeetCode" }),
      tierCount({ tags: "Origin:Expert" }),
      Question.aggregate([
        { $match: { ...ACTIVE, $or: [
          { tags: "Origin:Expert" },
          { difficulty: "Hard", platform: "LeetCode", tags: "Striver" },
        ] } },
        { $sort: { striver: -1 } }, { $limit: 25 },
        { $project: { _id: 0, id: { $toString: "$_id" }, title: 1, topic: 1, difficulty: 1, platform: 1, problemLink: 1 } },
      ]) as Promise<GoogleRecommendation[]>,
    ]);

    return {
      total, byDifficultyRaw, byPlatformRaw, rawTopics, companyOverlap: companyOverlapRaw,
      tiers: [
        { label: "Foundation", count: foundation },
        { label: "Intermediate", count: intermediate },
        { label: "Interview Ready", count: interviewReady },
        { label: "Google Hard", count: googleHard },
        { label: "Research Level", count: research },
      ],
      googleHardList,
    };
  });
}

export async function computeGoogleRoadmap(userId: string): Promise<GoogleRoadmap> {
  // Cached catalog structure ‖ the caller's overlay, concurrently.
  const [catalog, rows] = await Promise.all([
    googleCatalog(),
    getUserOverlay(userId).then((r) => r.filter(activeRow)),
  ]);

  const REV = new Set(["Need Revision", "Revisit"]);
  let solved = 0, attempted = 0, favorite = 0, revision = 0;
  const solvedIds: Types.ObjectId[] = [];
  const solvedByDifficulty = new Map<string, number>();
  const solvedByPlatform = new Map<string, number>();
  const solvedByTopic = new Map<string, number>();
  for (const r of rows) {
    if (r.favorite) favorite++;
    if (r.revisionNeeded || REV.has(r.status)) revision++;
    if (r.status === "Attempted") attempted++;
    if (r.status === "Solved") {
      solved++;
      solvedIds.push(new Types.ObjectId(r.questionId));
      solvedByDifficulty.set(r.q.difficulty, (solvedByDifficulty.get(r.q.difficulty) || 0) + 1);
      solvedByPlatform.set(r.q.platform, (solvedByPlatform.get(r.q.platform) || 0) + 1);
      solvedByTopic.set(r.q.topic, (solvedByTopic.get(r.q.topic) || 0) + 1);
    }
  }

  const byDifficulty = catalog.byDifficultyRaw.map((r) => ({ ...r, solved: solvedByDifficulty.get(r.key) || 0 }));
  const byPlatform = catalog.byPlatformRaw.map((r) => ({ ...r, solved: solvedByPlatform.get(r.key) || 0 }));

  const topics: GoogleTopicRow[] = catalog.rawTopics
    .map((t): GoogleTopicRow => {
      const priority = GOOGLE_PRIORITY[t._id] || "Low";
      const target = COVERAGE_TARGET[t._id] || 40;
      const orderIndex = PREP_ORDER.indexOf(t._id) + 1;
      const tSolved = solvedByTopic.get(t._id) || 0;
      return {
        topic: t._id, priority, orderIndex,
        total: t.total, easy: t.easy, medium: t.medium, hard: t.hard,
        leetcode: t.leetcode, codeforces: t.codeforces, striver: t.striver, expertOrigin: t.expertOrigin,
        solved: tSolved, remaining: t.total - tSolved, completionPct: pct(tSolved, t.total),
        coverageTarget: target, coveragePct: Math.min(100, pct(t.total, target)),
      };
    })
    .sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));

  // Personalized recommendations: highest-priority unsolved (per-user via $nin).
  const recPipeline = (limit: number): PipelineStage[] => [
    { $match: { ...ACTIVE, _id: { $nin: solvedIds } } },
    { $addFields: {
      _prio: { $switch: { branches: [
        { case: { $in: ["$topic", topicsByPriority("Critical")] }, then: 0 },
        { case: { $in: ["$topic", topicsByPriority("High")] }, then: 1 },
        { case: { $in: ["$topic", topicsByPriority("Medium")] }, then: 2 },
      ], default: 3 } },
      _striver: { $cond: [{ $in: ["Striver", "$tags"] }, 0, 1] },
      _lc: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 0, 1] },
    } },
    { $sort: { _prio: 1, _striver: 1, _lc: 1, difficulty: 1 } },
    { $limit: limit },
    { $project: { _id: 0, id: { $toString: "$_id" }, title: 1, topic: 1, difficulty: 1, platform: 1, problemLink: 1 } },
  ];
  const weekly = (await Question.aggregate(recPipeline(25))) as GoogleRecommendation[];

  let wSum = 0, covSum = 0, progSum = 0;
  for (const t of topics) {
    const w = PRIORITY_WEIGHT[t.priority];
    wSum += w; covSum += w * (t.coveragePct / 100); progSum += w * (t.completionPct / 100);
  }
  const readiness = {
    coverageScore: wSum ? Math.round((covSum / wSum) * 100) : 0,
    progressScore: wSum ? Math.round((progSum / wSum) * 100) : 0,
    overall: wSum ? Math.round(((covSum * 0.4 + progSum * 0.6) / wSum) * 100) : 0,
  };

  const focus = topics.filter((t) => t.priority === "Critical" || t.priority === "High");
  const weakTopics = [...focus].sort((a, b) => a.completionPct - b.completionPct).slice(0, 6)
    .map((t) => ({ topic: t.topic, priority: t.priority, completionPct: t.completionPct, remaining: t.remaining }));
  const strongTopics = [...focus].sort((a, b) => b.completionPct - a.completionPct).slice(0, 6)
    .map((t) => ({ topic: t.topic, priority: t.priority, completionPct: t.completionPct, solved: t.solved }));

  const schemaGaps: string[] = [];
  if (!catalog.companyOverlap.length) schemaGaps.push("`companies` is empty on every document — company-based views (Step 11) need company tags populated.");
  if (!byDifficulty.some((d) => d.key === "Expert")) schemaGaps.push("No `Expert` difficulty tier — Codeforces top problems are collapsed into `Hard` (preserved as an `Origin:Expert` tag).");
  schemaGaps.push("Striver placement is stored in `tags` (`Striver`, `Striver:<step>`); dedicated `striverStep`/`striverOrder` fields would enable ordered Striver views.");

  return {
    generatedAt: new Date().toISOString(),
    total: catalog.total,
    progress: {
      solved, attempted, favorite, revision,
      solvedPct: pct(solved, catalog.total), favoritePct: pct(favorite, catalog.total), revisionPct: pct(revision, catalog.total),
    },
    byDifficulty, byPlatform, topics, tiers: catalog.tiers, companyOverlap: catalog.companyOverlap,
    weakTopics, strongTopics,
    recommendations: { today: weekly.slice(0, 5), weekly, googleHard: catalog.googleHardList },
    readiness, schemaGaps,
  };
}
