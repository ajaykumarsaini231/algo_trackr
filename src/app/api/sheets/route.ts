import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserOverlay, activeRow } from "@/lib/progress";
import Question from "@/models/Question";
import { SHEETS, sheetMatch, sheetMatchesDoc, type SheetProgress } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };

/** GET /api/sheets — every sheet's totals (catalog) + the CALLER's progress. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();

    // The caller's solved rows once — bucketed per sheet in JS.
    const solvedRows = (await getUserOverlay(user.id))
      .filter(activeRow)
      .filter((r) => r.status === "Solved");

    const rows = await Promise.all(
      SHEETS.map(async (def): Promise<SheetProgress> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agg: any[] = await Question.aggregate([
          { $match: { ...ACTIVE, ...sheetMatch(def) } },
          { $group: {
            _id: null, total: { $sum: 1 },
            easy: { $sum: { $cond: [{ $eq: ["$difficulty", "Easy"] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ["$difficulty", "Medium"] }, 1, 0] } },
            hard: { $sum: { $cond: [{ $eq: ["$difficulty", "Hard"] }, 1, 0] } },
          } },
        ]);
        const s = agg[0] || {};
        const total = s.total || 0;
        const solved = solvedRows.filter((r) => sheetMatchesDoc(def, r.q)).length;
        return {
          key: def.key, name: def.name, description: def.description, source: def.source,
          type: def.type, icon: def.icon, accent: def.accent,
          listSize: def.type === "curated" ? def.slugs?.length ?? null : null,
          total, solved, remaining: total - solved, completionPct: pct(solved, total),
          easy: s.easy || 0, medium: s.medium || 0, hard: s.hard || 0,
        };
      }),
    );

    return ok({ generatedAt: new Date().toISOString(), sheets: rows });
  });
}
