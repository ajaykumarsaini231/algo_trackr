import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getProgressMap } from "@/lib/progress";
import Question from "@/models/Question";
import {
  PATTERN_BY_SLUG, PATTERN_CATEGORIES,
  type PatternDetail, type PatternQuestion,
} from "@/lib/patterns";
import { STATUSES } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };
const STATUS_SET = new Set<string>(STATUSES);

/**
 * GET /api/patterns/[slug]?page=&limit=&difficulty=&status=
 * Pattern metadata + catalog stats + the CALLER's progress on its questions.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { slug } = await ctx.params;
    const p = PATTERN_BY_SLUG.get(slug);
    if (!p) return fail(`Unknown pattern: ${slug}`, 404);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const page = Math.min(10_000, Math.max(1, Number(sp.get("page")) || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    const difficulty = sp.get("difficulty")?.trim();
    const statusFilter = sp.get("status")?.trim();

    // Catalog stats for this pattern (everything except "solved").
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agg: any[] = await Question.aggregate([
      { $match: { ...ACTIVE, patterns: slug } },
      { $group: {
        _id: null, total: { $sum: 1 },
        easy: { $sum: { $cond: [{ $eq: ["$difficulty", "Easy"] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ["$difficulty", "Medium"] }, 1, 0] } },
        hard: { $sum: { $cond: [{ $eq: ["$difficulty", "Hard"] }, 1, 0] } },
        leetcode: { $sum: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 1, 0] } },
        codeforces: { $sum: { $cond: [{ $eq: ["$platform", "Codeforces"] }, 1, 0] } },
        striver: { $sum: { $cond: [{ $in: ["Striver", "$tags"] }, 1, 0] } },
      } },
    ]);
    const s = agg[0] || {};
    const total = s.total || 0;

    // A pattern's question set is bounded — load slim docs, overlay the
    // caller's state, filter/sort/paginate in JS (favorite lives per-user now).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs: any[] = await Question.find({ ...ACTIVE, patterns: slug })
      .select("title platform difficulty topic problemLink patterns")
      .lean();
    const progress = await getProgressMap(user.id, docs.map((d) => String(d._id)));

    const all: PatternQuestion[] = docs.map((d) => {
      const pr = progress.get(String(d._id));
      return {
        id: String(d._id), title: d.title, platform: d.platform, difficulty: d.difficulty,
        topic: d.topic, problemLink: d.problemLink,
        status: pr?.status ?? "Not Started", favorite: pr?.favorite ?? false,
        patterns: d.patterns || [],
      };
    });

    const solved = all.filter((q) => q.status === "Solved").length;

    let filtered = all;
    if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
    if (statusFilter && STATUS_SET.has(statusFilter)) {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    const matchTotal = filtered.length;
    const items = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

    const cat = PATTERN_CATEGORIES.find((c) => c.categorySlug === p.categorySlug);
    const relatedPatterns = (cat?.patternSlugs || [])
      .filter((x) => x !== slug)
      .slice(0, 8)
      .map((x) => ({ slug: x, name: PATTERN_BY_SLUG.get(x)!.name }));

    const payload: PatternDetail = {
      slug: p.slug, name: p.name, category: p.category, categorySlug: p.categorySlug, priority: p.priority,
      total, solved, remaining: total - solved, completionPct: pct(solved, total),
      easy: s.easy || 0, medium: s.medium || 0, hard: s.hard || 0,
      leetcode: s.leetcode || 0, codeforces: s.codeforces || 0, striver: s.striver || 0,
      description: p.description, whenToUse: p.whenToUse, recognition: p.recognition,
      mistakes: p.mistakes, time: p.time, space: p.space, importance: p.importance,
      relatedPatterns,
      questions: { items, total: matchTotal, page, limit, totalPages: Math.max(1, Math.ceil(matchTotal / limit)) },
    };
    return ok(payload);
  });
}
