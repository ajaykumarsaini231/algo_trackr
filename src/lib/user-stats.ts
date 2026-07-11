import "server-only";
import { Types } from "mongoose";
import { serializeQuestions } from "@/lib/serialize";
import { TOPICS, COMPANIES, PATTERNS, REVISION_STATUSES } from "@/lib/constants";
import {
  getUserOverlay,
  activeRow,
  overlayQuestions,
  type OverlayRow,
} from "@/lib/progress";
import { DIFFICULTIES, STATUSES } from "@/types";
import type { Stats, Difficulty } from "@/types";
import Question from "@/models/Question";
import UserProgress from "@/models/UserProgress";

/**
 * Complete dashboard statistics for ONE user — the single implementation
 * behind both `/api/stats` (self) and the admin User Dashboard Viewer
 * (inspecting any user), so an admin sees exactly the numbers the user sees.
 *
 * Catalog totals come from one shared `$facet`; every user-specific number
 * comes from the target user's own UserProgress rows. Caller must be
 * connected to the DB and have authorized access to `userId`.
 */
export async function computeUserStats(userId: string): Promise<Stats> {
  const now = new Date();
  const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const heatStart = new Date();
  heatStart.setUTCHours(0, 0, 0, 0);
  heatStart.setUTCDate(heatStart.getUTCDate() - 181);

  const ACTIVE = { archived: { $ne: true } };

  // ---- Catalog facet: totals only (no user data involved) ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facet]: any[] = await Question.aggregate([
    {
      $facet: {
        counts: [
          {
            $group: {
              _id: null,
              activeTotal: { $sum: { $cond: [{ $ne: ["$archived", true] }, 1, 0] } },
              archived: { $sum: { $cond: [{ $eq: ["$archived", true] }, 1, 0] } },
            },
          },
        ],
        byDifficulty: [{ $match: ACTIVE }, { $group: { _id: "$difficulty", total: { $sum: 1 } } }],
        byTopic: [{ $match: ACTIVE }, { $group: { _id: "$topic", total: { $sum: 1 } } }],
        byPattern: [{ $match: ACTIVE }, { $group: { _id: "$pattern", total: { $sum: 1 } } }],
        byPlatform: [{ $match: ACTIVE }, { $group: { _id: "$platform", total: { $sum: 1 } } }],
        byCompany: [
          { $match: ACTIVE },
          { $unwind: "$companies" },
          { $group: { _id: "$companies", total: { $sum: 1 } } },
        ],
        monthlyAdded: [
          { $match: { ...ACTIVE, createdAt: { $gte: sixStart } } },
          { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, n: { $sum: 1 } } },
        ],
      },
    },
  ]);

  // ---- User overlay: ONE query over the target user's own progress ----
  const rows = (await getUserOverlay(userId)).filter(activeRow);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = (x: any): any[] => (Array.isArray(x) ? x : []);
  const c = facet.counts[0] || {};
  const total: number = c.activeTotal || 0;

  const isRevision = (r: OverlayRow) =>
    r.revisionNeeded || REVISION_STATUSES.includes(r.status);

  let solved = 0;
  let attempted = 0;
  let favorites = 0;
  let revisionNeeded = 0;
  let revisionDue = 0;
  const solvedByDifficulty = { Easy: 0, Medium: 0, Hard: 0 } as Record<Difficulty, number>;
  const solvedByTopic = new Map<string, number>();
  const solvedByPattern = new Map<string, number>();
  const solvedByCompany = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  const monthlySolvedMap = new Map<string, number>();
  const heatMap = new Map<string, number>();

  for (const r of rows) {
    if (r.status !== "Not Started") {
      statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1);
    }
    if (r.favorite) favorites++;
    if (isRevision(r)) revisionNeeded++;
    if (isRevision(r) || (r.revisionDate && r.revisionDate.getTime() <= now.getTime())) {
      revisionDue++;
    }
    if (r.status === "Attempted") attempted++;
    if (r.status === "Solved") {
      solved++;
      solvedByDifficulty[r.q.difficulty] = (solvedByDifficulty[r.q.difficulty] || 0) + 1;
      solvedByTopic.set(r.q.topic, (solvedByTopic.get(r.q.topic) || 0) + 1);
      if (r.q.pattern) {
        solvedByPattern.set(r.q.pattern, (solvedByPattern.get(r.q.pattern) || 0) + 1);
      }
      for (const company of r.q.companies) {
        solvedByCompany.set(company, (solvedByCompany.get(company) || 0) + 1);
      }
      if (r.solvedAt) {
        if (r.solvedAt >= sixStart) {
          const key = `${r.solvedAt.getFullYear()}-${r.solvedAt.getMonth() + 1}`;
          monthlySolvedMap.set(key, (monthlySolvedMap.get(key) || 0) + 1);
        }
        if (r.solvedAt >= heatStart) {
          const key = r.solvedAt.toISOString().slice(0, 10);
          heatMap.set(key, (heatMap.get(key) || 0) + 1);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idMap = (rowsIn: any[]) => new Map(rowsIn.map((r) => [r._id, r]));

  const diffMap = idMap(arr(facet.byDifficulty));
  const byDifficulty = {} as Record<Difficulty, number>;
  for (const d of DIFFICULTIES) byDifficulty[d] = diffMap.get(d)?.total || 0;

  const byStatus: Record<string, number> = {};
  for (const s of STATUSES) byStatus[s] = statusCounts.get(s) || 0;
  const touched = rows.filter((r) => r.status !== "Not Started").length;
  byStatus["Not Started"] = Math.max(0, total - touched);

  const topicMap = idMap(arr(facet.byTopic));
  const byTopic = TOPICS.map((t) => ({
    topic: t.name,
    total: topicMap.get(t.name)?.total || 0,
    solved: solvedByTopic.get(t.name) || 0,
  }));

  const companyMap = idMap(arr(facet.byCompany));
  const byCompany = COMPANIES.map((company) => ({
    company,
    total: companyMap.get(company)?.total || 0,
    solved: solvedByCompany.get(company) || 0,
  }));

  const patternMap = idMap(arr(facet.byPattern));
  const byPattern = PATTERNS.map((p) => ({
    pattern: p.name,
    total: patternMap.get(p.name)?.total || 0,
    solved: solvedByPattern.get(p.name) || 0,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byPlatform = arr(facet.byPlatform).map((r: any) => ({
    platform: (r._id as string) || "Others",
    total: r.total,
  }));

  // Monthly progress: last 6 calendar months (oldest -> newest).
  const addedMap = new Map(arr(facet.monthlyAdded).map((r) => [`${r._id.y}-${r._id.m}`, r.n]));
  const monthlyProgress: { month: string; added: number; solved: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthlyProgress.push({
      month: d.toLocaleString("en-US", { month: "short" }),
      added: addedMap.get(key) || 0,
      solved: monthlySolvedMap.get(key) || 0,
    });
  }

  // Heatmap: last 182 days (oldest -> newest), one bucket per UTC day.
  const heatmap: { date: string; count: number }[] = [];
  const day = new Date(heatStart);
  for (let i = 0; i < 182; i++) {
    const key = day.toISOString().slice(0, 10);
    heatmap.push({ date: key, count: heatMap.get(key) || 0 });
    day.setUTCDate(day.getUTCDate() + 1);
  }

  // Recently added: catalog list overlaid with the target user's progress.
  const recentlyAddedDocs = await Question.find(ACTIVE)
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();
  const recentlyAdded = serializeQuestions(
    await overlayQuestions(userId, recentlyAddedDocs as Record<string, unknown>[]),
  );

  // Recently solved: the target user's own latest solves.
  const recentProgress = await UserProgress.find({
    userId: new Types.ObjectId(userId),
    solvedAt: { $ne: null },
  })
    .sort({ solvedAt: -1 })
    .limit(6)
    .select("questionId")
    .lean();
  const recentIds = recentProgress.map((p) => p.questionId);
  const recentDocs = await Question.find({ _id: { $in: recentIds } }).lean();
  const docOrder = new Map(recentDocs.map((d) => [String(d._id), d]));
  const recentlySolved = serializeQuestions(
    await overlayQuestions(
      userId,
      recentIds
        .map((id) => docOrder.get(String(id)))
        .filter(Boolean) as Record<string, unknown>[],
    ),
  );

  return {
    total,
    solved,
    unsolved: total - solved,
    attempted,
    revisionNeeded,
    favorites,
    archived: c.archived || 0,
    completionPercentage: total ? Math.round((solved / total) * 100) : 0,
    byDifficulty,
    solvedByDifficulty,
    byStatus,
    byTopic,
    byCompany,
    byPattern,
    byPlatform,
    monthlyProgress,
    heatmap,
    recentlyAdded,
    recentlySolved,
    revisionDue,
  };
}
