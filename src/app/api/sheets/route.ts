import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserOverlay, activeRow } from "@/lib/progress";
import { cachedCatalog } from "@/lib/catalog-cache";
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

    // Per-sheet catalog totals are identical for every user (cached, dropped on
    // any question write); only `solved` is per-user. Run the cached catalog
    // rollup and the caller's overlay CONCURRENTLY.
    const [solvedRows, sheetTotals] = await Promise.all([
      getUserOverlay(user.id).then((r) =>
        r.filter(activeRow).filter((x) => x.status === "Solved"),
      ),
      cachedCatalog("sheets:totals", () =>
        Promise.all(
          SHEETS.map(async (def) => {
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
            return { key: def.key, total: s.total || 0, easy: s.easy || 0, medium: s.medium || 0, hard: s.hard || 0 };
          }),
        ),
      ),
    ]);
    const totalByKey = new Map(sheetTotals.map((s) => [s.key, s]));

    const rows: SheetProgress[] = SHEETS.map((def) => {
      const c = totalByKey.get(def.key) ?? { total: 0, easy: 0, medium: 0, hard: 0 };
      const solved = solvedRows.filter((r) => sheetMatchesDoc(def, r.q)).length;
      return {
        key: def.key, name: def.name, description: def.description, source: def.source,
        type: def.type, icon: def.icon, accent: def.accent,
        listSize: def.type === "curated" ? def.slugs?.length ?? null : null,
        total: c.total, solved, remaining: c.total - solved, completionPct: pct(solved, c.total),
        easy: c.easy, medium: c.medium, hard: c.hard,
      };
    });

    return ok({ generatedAt: new Date().toISOString(), sheets: rows });
  });
}
