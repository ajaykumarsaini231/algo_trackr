import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getProgressMap } from "@/lib/progress";
import Question from "@/models/Question";
import { SHEET_BY_KEY, sheetMatch, type SheetDetail, type SheetQuestion } from "@/lib/sheets";
import { STATUSES } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };
const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
const STATUS_SET = new Set<string>(STATUSES);

/** GET /api/sheets/[key]?page=&limit=&difficulty=&status= — sheet meta + questions. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { key } = await ctx.params;
    const def = SHEET_BY_KEY.get(key);
    if (!def) return fail(`Unknown sheet: ${key}`, 404);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const page = Math.min(10_000, Math.max(1, Number(sp.get("page")) || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 25));
    const difficulty = sp.get("difficulty")?.trim();
    const statusFilter = sp.get("status")?.trim();

    const base = { ...ACTIVE, ...sheetMatch(def) };

    // Sheet membership is bounded (≤ a topic's size), so load slim docs once,
    // overlay the caller's state, then filter/sort/paginate in JS. This keeps
    // "favorite first" ordering — favorite now lives in UserProgress.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs: any[] = await Question.find(base)
      .select("title platform difficulty topic problemLink")
      .lean();

    const progress = await getProgressMap(user.id, docs.map((d) => String(d._id)));

    const all: SheetQuestion[] = docs.map((d) => {
      const p = progress.get(String(d._id));
      return {
        id: String(d._id), title: d.title, platform: d.platform, difficulty: d.difficulty,
        topic: d.topic, problemLink: d.problemLink,
        status: p?.status ?? "Not Started", favorite: p?.favorite ?? false,
      };
    });

    const total = all.length;
    const solved = all.filter((q) => q.status === "Solved").length;
    const easy = all.filter((q) => q.difficulty === "Easy").length;
    const medium = all.filter((q) => q.difficulty === "Medium").length;
    const hard = all.filter((q) => q.difficulty === "Hard").length;

    let filtered = all;
    if (difficulty && DIFFICULTY_ORDER[difficulty] !== undefined) {
      filtered = filtered.filter((q) => q.difficulty === difficulty);
    }
    if (statusFilter && STATUS_SET.has(statusFilter)) {
      filtered = filtered.filter((q) => q.status === statusFilter);
    }

    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const d = (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1);
      if (d !== 0) return d;
      return a.title.localeCompare(b.title);
    });

    const matchTotal = filtered.length;
    const items = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

    const payload: SheetDetail = {
      key: def.key, name: def.name, description: def.description, source: def.source,
      type: def.type, icon: def.icon, accent: def.accent,
      listSize: def.type === "curated" ? def.slugs?.length ?? null : null,
      matched: total,
      total, solved, remaining: total - solved, completionPct: pct(solved, total),
      easy, medium, hard,
      questions: { items, total: matchTotal, page, limit, totalPages: Math.max(1, Math.ceil(matchTotal / limit)) },
    };
    return ok(payload);
  });
}
