import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserOverlay, activeRow } from "@/lib/progress";
import Question from "@/models/Question";
import {
  ALL_PATTERNS, PATTERN_CATEGORIES, PATTERN_BY_SLUG,
  type PatternDashboard, type PatternStat,
} from "@/lib/patterns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };

/**
 * GET /api/patterns
 * Per-pattern catalog counts + the CALLER's solved counts per pattern.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();

    // Catalog dimensions (no user data).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await Question.aggregate([
      { $match: ACTIVE },
      { $unwind: "$patterns" },
      { $group: {
        _id: "$patterns", total: { $sum: 1 },
        easy: { $sum: { $cond: [{ $eq: ["$difficulty", "Easy"] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ["$difficulty", "Medium"] }, 1, 0] } },
        hard: { $sum: { $cond: [{ $eq: ["$difficulty", "Hard"] }, 1, 0] } },
        leetcode: { $sum: { $cond: [{ $eq: ["$platform", "LeetCode"] }, 1, 0] } },
        codeforces: { $sum: { $cond: [{ $eq: ["$platform", "Codeforces"] }, 1, 0] } },
        striver: { $sum: { $cond: [{ $in: ["Striver", "$tags"] }, 1, 0] } },
      } },
    ]);
    const bySlug = new Map(rows.map((r) => [r._id, r]));

    // Caller's solved-per-pattern from their own rows.
    const solvedBySlug = new Map<string, number>();
    for (const r of (await getUserOverlay(user.id)).filter(activeRow)) {
      if (r.status !== "Solved") continue;
      for (const slug of r.q.patterns) {
        solvedBySlug.set(slug, (solvedBySlug.get(slug) || 0) + 1);
      }
    }

    const stat = (slug: string): PatternStat => {
      const p = PATTERN_BY_SLUG.get(slug)!;
      const r = bySlug.get(slug) || {};
      const total = r.total || 0;
      const solved = solvedBySlug.get(slug) || 0;
      return {
        slug, name: p.name, category: p.category, categorySlug: p.categorySlug, priority: p.priority,
        total, solved, remaining: total - solved, completionPct: pct(solved, total),
        easy: r.easy || 0, medium: r.medium || 0, hard: r.hard || 0,
        leetcode: r.leetcode || 0, codeforces: r.codeforces || 0, striver: r.striver || 0,
      };
    };

    const allStats = ALL_PATTERNS.map((p) => stat(p.slug));
    const statBySlug = new Map(allStats.map((s) => [s.slug, s]));

    const categories = PATTERN_CATEGORIES.map((c) => {
      const patterns = c.patternSlugs
        .map((s) => statBySlug.get(s)!)
        .sort((a, b) => b.total - a.total);
      return {
        category: c.category, categorySlug: c.categorySlug, priority: c.priority,
        total: patterns.reduce((s, p) => s + p.total, 0), patterns,
      };
    });

    const used = allStats.filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
    const totalAssignments = allStats.reduce((s, p) => s + p.total, 0);
    const [totalQuestions, classified] = await Promise.all([
      Question.countDocuments(ACTIVE),
      Question.countDocuments({ ...ACTIVE, "patterns.0": { $exists: true } }),
    ]);

    const payload: PatternDashboard = {
      generatedAt: new Date().toISOString(),
      totalPatterns: ALL_PATTERNS.length,
      totalAssignments,
      summary: {
        totalQuestions, classified,
        avgPatternsPerQuestion: classified ? Math.round((totalAssignments / classified) * 10) / 10 : 0,
      },
      categories,
      mostUsed: used.slice(0, 10),
      leastUsed: [...used].reverse().slice(0, 10),
    };
    return ok(payload);
  });
}
