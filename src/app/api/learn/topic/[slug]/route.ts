import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getProgressMap, type ProgressLean } from "@/lib/progress";
import Question from "@/models/Question";
import { getTopicBySlug } from "@/lib/constants";
import {
  STAGE_SIZE, UNLOCK_THRESHOLD, RANK_LABEL, PREP_ORDER,
  type StageQuestion, type TopicStage, type TopicLearning, type TopicLearningAll,
} from "@/lib/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };
const FIELDS = "title platform difficulty difficultyRank topic problemLink patterns estimatedSolveTime";

const SHEET_FOR_TOPIC: Record<string, string> = {
  "Dynamic Programming": "dp-sheet", Graph: "graph-sheet", Trees: "tree-sheet",
  Greedy: "greedy-sheet", "Binary Search": "binary-search-sheet",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toQ = (d: any, p: ProgressLean | undefined): StageQuestion => ({
  id: String(d._id), title: d.title, platform: d.platform, difficulty: d.difficulty,
  difficultyRank: d.difficultyRank ?? 2, topic: d.topic, problemLink: d.problemLink,
  status: p?.status ?? "Not Started", favorite: p?.favorite ?? false,
  patterns: d.patterns || [],
  estimatedSolveTime: d.estimatedSolveTime ?? 30,
});

/**
 * GET /api/learn/topic/[slug]?reveal=&view=all&page=&limit=
 * Progressive-unlock staged view of a topic, personal to the caller: stage
 * completion, unlocks and "continue" all come from the caller's own progress.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { slug } = await ctx.params;
    const topic = getTopicBySlug(slug);
    if (!topic) return fail(`Unknown topic: ${slug}`, 404);
    const name = topic.name;

    await connectDB();
    const base = { ...ACTIVE, topic: name };
    const sp = req.nextUrl.searchParams;

    // Caller's solve/favorite state across this topic (one indexed query on
    // the topic's ids — bounded by topic size, merged in JS).
    const topicIds = await Question.find(base).select("_id").lean();
    const progress = await getProgressMap(user.id, topicIds.map((d) => String(d._id)));

    const total = topicIds.length;
    let solved = 0;
    for (const p of progress.values()) if (p.status === "Solved") solved++;
    const totalStages = Math.max(1, Math.ceil(total / STAGE_SIZE));

    // "View All" — advanced users, plain paginated list.
    if (sp.get("view") === "all") {
      const page = Math.min(10_000, Math.max(1, Number(sp.get("page")) || 1));
      const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs: any[] = await Question.find(base).select(FIELDS)
        .sort({ difficultyRank: 1, learningScore: -1, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean();
      const payload: TopicLearningAll = {
        mode: "all", topic: name, slug, total, solved,
        questions: docs.map((d) => toQ(d, progress.get(String(d._id)))),
        page, limit, totalPages: Math.max(1, Math.ceil(total / limit)),
      };
      return ok(payload);
    }

    // Staged view.
    const reveal = Math.min(totalStages, Math.max(1, Number(sp.get("reveal")) || 1));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prefix: any[] = await Question.find(base).select(FIELDS)
      .sort({ difficultyRank: 1, learningScore: -1, _id: 1 })
      .limit(reveal * STAGE_SIZE).lean();

    const isSolved = (d: { _id: unknown }) =>
      progress.get(String(d._id))?.status === "Solved";

    const stages: TopicStage[] = [];
    let prevCompletedEnough: boolean = true; // gate for the next stage's unlock (stage 0 always unlocked)
    for (let i = 0; i < reveal; i++) {
      const chunk = prefix.slice(i * STAGE_SIZE, (i + 1) * STAGE_SIZE);
      if (!chunk.length) break;
      const st = chunk.filter(isSolved).length;
      const cp = pct(st, chunk.length);
      const unlocked: boolean = i === 0 ? true : prevCompletedEnough;
      const completed: boolean = st === chunk.length;
      const avgRank = Math.round(chunk.reduce((s, d) => s + (d.difficultyRank ?? 2), 0) / chunk.length);
      const band = RANK_LABEL[Math.max(0, Math.min(4, avgRank))];
      stages.push({
        index: i, label: `Stage ${i + 1} · ${band}`, band,
        total: chunk.length, solved: st, completionPct: cp, unlocked, completed,
        questions: unlocked ? chunk.map((d) => toQ(d, progress.get(String(d._id)))) : [],
      });
      prevCompletedEnough = unlocked && cp >= UNLOCK_THRESHOLD * 100;
    }

    const currentStage = stages.find((s) => s.unlocked && !s.completed) || stages[stages.length - 1];
    const continueQ = currentStage?.questions.find((q) => q.status !== "Solved") || null;
    const canLoadMore = reveal < totalStages && prevCompletedEnough;

    const i = PREP_ORDER.indexOf(name);
    const nextTopic = i >= 0 && i + 1 < PREP_ORDER.length ? PREP_ORDER[i + 1] : null;

    // Estimated remaining time: unsolved questions' estimates for THIS user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const estDocs: any[] = await Question.find(base).select("estimatedSolveTime").lean();
    let estRemaining = 0;
    for (const d of estDocs) {
      if (progress.get(String(d._id))?.status !== "Solved") {
        estRemaining += d.estimatedSolveTime ?? 30;
      }
    }

    const payload: TopicLearning = {
      topic: name, slug,
      total, solved, remaining: total - solved, completionPct: pct(solved, total),
      completed: total > 0 && solved >= total,
      estimatedTimeRemaining: estRemaining,
      totalStages, revealedStages: stages.length,
      currentStage: currentStage?.index ?? 0,
      currentLevel: `Stage ${(currentStage?.index ?? 0) + 1}`,
      canLoadMore, continueQuestionId: continueQ?.id ?? null,
      stages,
      recommendations: { nextTopic, relatedSheet: SHEET_FOR_TOPIC[name] || "blind-75" },
    };
    return ok(payload);
  });
}
