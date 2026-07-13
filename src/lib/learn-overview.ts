import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { getUserOverlay, getProgressMap, activeRow } from "@/lib/progress";
import { cachedCatalog } from "@/lib/catalog-cache";
import Question from "@/models/Question";
import { SHEET_BY_KEY } from "@/lib/sheets";
import { PATTERN_BY_SLUG, PATTERN_CATEGORIES } from "@/lib/patterns";
import { GOOGLE_PRIORITY } from "@/lib/google";
import {
  LEARNING_STAGES, STAGE_BY_KEY, SCORE_WEIGHTS, topicsByPriority, stageMatchesDoc, PREP_ORDER,
  type LearningStageStat, type RankedQuestion, type RoadmapItem, type LearnOverview,
} from "@/lib/learning";

/**
 * Learning overview computation — shared by `/api/learn` (the SWR endpoint) and
 * the `/learn` server page (SSR fallback). Per-stage catalog totals and the
 * topic/pattern roadmap aggregations are user-independent and cached; the
 * caller's overlay + the personalized "mixed"/"continue" picks run concurrently.
 */

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };
const countActive = (m: Record<string, unknown>) => Question.countDocuments({ ...ACTIVE, ...m });

const BLIND75_LINKS = (SHEET_BY_KEY.get("blind-75")?.slugs || []).map((s) => `https://leetcode.com/problems/${s}/`);
const CRIT = topicsByPriority("Critical");
const HIGH = topicsByPriority("High");
const MED = topicsByPriority("Medium");

const SCORE_STAGE: PipelineStage = {
  $addFields: {
    _score: {
      $add: [
        { $cond: [{ $in: ["$problemLink", BLIND75_LINKS] }, SCORE_WEIGHTS.blind75, 0] },
        { $cond: [{ $in: ["Striver", "$tags"] }, SCORE_WEIGHTS.striver, 0] },
        { $cond: [{ $eq: ["$platform", "LeetCode"] }, SCORE_WEIGHTS.leetcode, 0] },
        { $switch: {
          branches: [
            { case: { $in: ["$topic", CRIT] }, then: SCORE_WEIGHTS.topicPriority.Critical },
            { case: { $in: ["$topic", HIGH] }, then: SCORE_WEIGHTS.topicPriority.High },
            { case: { $in: ["$topic", MED] }, then: SCORE_WEIGHTS.topicPriority.Medium },
          ],
          default: SCORE_WEIGHTS.topicPriority.Low,
        } },
      ],
    },
  },
};
const PROJECT_Q: PipelineStage = {
  $project: {
    _id: 1, title: 1, platform: 1, difficulty: 1, topic: 1, problemLink: 1,
    patterns: 1, score: "$_score",
  },
};

async function toRanked(userId: string, docs: Record<string, unknown>[]): Promise<RankedQuestion[]> {
  const map = await getProgressMap(userId, docs.map((d) => String(d._id)));
  return docs.map((d) => {
    const p = map.get(String(d._id));
    return {
      id: String(d._id), title: d.title as string, platform: d.platform as string,
      difficulty: d.difficulty as string, topic: d.topic as string,
      problemLink: (d.problemLink as string) ?? "",
      status: p?.status ?? "Not Started", favorite: p?.favorite ?? false,
      patterns: (d.patterns as string[]) || [], score: Number(d.score ?? 0),
    };
  });
}

interface UserLearnState {
  solvedIds: Types.ObjectId[];
  solvedByStage: Map<string, number>;
  solvedByTopic: Map<string, number>;
  solvedByPatternSlug: Map<string, number>;
  totalSolved: number;
}

async function getUserLearnState(userId: string): Promise<UserLearnState> {
  const rows = (await getUserOverlay(userId)).filter(activeRow);
  const solvedIds: Types.ObjectId[] = [];
  const solvedByStage = new Map<string, number>();
  const solvedByTopic = new Map<string, number>();
  const solvedByPatternSlug = new Map<string, number>();
  let totalSolved = 0;

  for (const r of rows) {
    if (r.status !== "Solved") continue;
    totalSolved++;
    solvedIds.push(new Types.ObjectId(r.questionId));
    solvedByTopic.set(r.q.topic, (solvedByTopic.get(r.q.topic) || 0) + 1);
    for (const st of LEARNING_STAGES) {
      if (stageMatchesDoc(st, r.q)) {
        solvedByStage.set(st.key, (solvedByStage.get(st.key) || 0) + 1);
      }
    }
    for (const slug of r.q.patterns) {
      solvedByPatternSlug.set(slug, (solvedByPatternSlug.get(slug) || 0) + 1);
    }
  }
  return { solvedIds, solvedByStage, solvedByTopic, solvedByPatternSlug, totalSolved };
}

/** Per-stage catalog totals — user-independent, cached (dropped on write). */
async function stageTotals(): Promise<Map<string, number>> {
  const entries = await cachedCatalog("learn:stageTotals", () =>
    Promise.all(
      LEARNING_STAGES.map(async (st) => [st.key, await countActive(st.match)] as const),
    ),
  );
  return new Map(entries);
}

function stageStats(
  state: UserLearnState,
  totals: Map<string, number>,
): { stages: LearningStageStat[]; currentStage: string } {
  const stages: LearningStageStat[] = [];
  let prevSolved = Infinity; // Foundation always unlocked
  for (const st of LEARNING_STAGES) {
    const total = totals.get(st.key) || 0;
    const solved = state.solvedByStage.get(st.key) || 0;
    const unlocked = prevSolved >= st.unlockThreshold;
    stages.push({
      key: st.key, name: st.name, level: st.level, icon: st.icon, accent: st.accent,
      total, solved, remaining: total - solved, completionPct: pct(solved, total),
      unlocked, unlockThreshold: st.unlockThreshold,
      prevStageSolved: prevSolved === Infinity ? 0 : prevSolved,
    });
    prevSolved = solved;
  }
  const current = stages.find((s) => s.unlocked && s.remaining > 0) || stages[0];
  return { stages, currentStage: current.key };
}

async function continueLearning(
  userId: string,
  state: UserLearnState,
  stageKey: string,
  skip: number,
  limit: number,
) {
  const st = STAGE_BY_KEY.get(stageKey) || LEARNING_STAGES[0];
  const match = { ...ACTIVE, ...st.match, _id: { $nin: state.solvedIds } };
  const [items, total] = await Promise.all([
    Question.aggregate([
      { $match: match }, SCORE_STAGE,
      { $sort: { _score: -1, _id: 1 } }, { $skip: skip }, { $limit: limit }, PROJECT_Q,
    ]),
    Question.countDocuments(match),
  ]);
  return { stage: st.key, items: await toRanked(userId, items), total, skip, limit };
}

export interface LearnOpts {
  skip?: number;
  limit?: number;
  stage?: string;
}

/** The "Load More" fast path — one stage's next page of continue-learning items. */
export async function continueLearningSection(
  userId: string,
  { stage, skip = 0, limit = 12 }: LearnOpts,
): Promise<{ continueLearning: Awaited<ReturnType<typeof continueLearning>> }> {
  const [state, totals] = await Promise.all([getUserLearnState(userId), stageTotals()]);
  const stageKey = stage || stageStats(state, totals).currentStage;
  return { continueLearning: await continueLearning(userId, state, stageKey, skip, limit) };
}

/** The full learning overview (default page load). */
export async function computeLearnOverview(
  userId: string,
  { skip = 0, limit = 12, stage }: LearnOpts,
): Promise<LearnOverview> {
  const [state, totals] = await Promise.all([getUserLearnState(userId), stageTotals()]);

  const { stages, currentStage } = stageStats(state, totals);
  const stageKey = stage || currentStage;
  const st = STAGE_BY_KEY.get(stageKey) || LEARNING_STAGES[0];

  const [mixed, continueResult, topicAgg, patAgg] = await Promise.all([
    Question.aggregate([
      { $match: { ...ACTIVE, ...st.match, _id: { $nin: state.solvedIds } } }, SCORE_STAGE,
      { $sort: { _score: -1 } },
      { $group: { _id: "$topic", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { _score: -1 } }, { $limit: 9 }, PROJECT_Q,
    ]),
    continueLearning(userId, state, stageKey, skip, limit),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cachedCatalog<any[]>("learn:topicAgg", () =>
      Question.aggregate([{ $match: ACTIVE }, { $group: { _id: "$topic", total: { $sum: 1 } } }]),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cachedCatalog<any[]>("learn:patAgg", () =>
      Question.aggregate([{ $match: ACTIVE }, { $unwind: "$patterns" }, { $group: { _id: "$patterns", total: { $sum: 1 } } }]),
    ),
  ]);

  const topicMap = new Map(topicAgg.map((t) => [t._id, t]));
  let topicCurrentUsed = false;
  const topicRoadmap: RoadmapItem[] = PREP_ORDER.map((topic) => {
    const total = topicMap.get(topic)?.total || 0;
    const solved = state.solvedByTopic.get(topic) || 0;
    const cp = pct(solved, total);
    let status: RoadmapItem["status"] = "todo";
    if (total > 0 && cp >= 100) status = "done";
    else if (!topicCurrentUsed) { status = "current"; topicCurrentUsed = true; }
    return { key: topic, name: topic, priority: GOOGLE_PRIORITY[topic], total, solved, completionPct: cp, status };
  });

  const catTotals = new Map<string, { total: number; solved: number }>();
  for (const r of patAgg) {
    const p = PATTERN_BY_SLUG.get(r._id);
    if (!p) continue;
    const c = catTotals.get(p.category) || { total: 0, solved: 0 };
    c.total += r.total;
    c.solved += state.solvedByPatternSlug.get(r._id) || 0;
    catTotals.set(p.category, c);
  }
  let patCurrentUsed = false;
  const patternRoadmap: RoadmapItem[] = PATTERN_CATEGORIES.map((c) => {
    const t = catTotals.get(c.category) || { total: 0, solved: 0 };
    const cp = pct(t.solved, t.total);
    let status: RoadmapItem["status"] = "todo";
    if (t.total > 0 && cp >= 100) status = "done";
    else if (!patCurrentUsed && t.total > 0) { status = "current"; patCurrentUsed = true; }
    return { key: c.categorySlug, name: c.category, priority: c.priority, total: t.total, solved: t.solved, completionPct: cp, status };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalSolved: state.totalSolved,
    currentStage,
    stages,
    continueLearning: continueResult,
    mixedChallenge: await toRanked(userId, mixed),
    topicRoadmap,
    patternRoadmap,
  };
}
