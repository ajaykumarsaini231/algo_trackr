import "server-only";
import { getUserOverlay, activeRow } from "@/lib/progress";
import { cachedCatalog } from "@/lib/catalog-cache";
import Question from "@/models/Question";
import { SHEETS, sheetMatch, sheetMatchesDoc, type SheetProgress } from "@/lib/sheets";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const ACTIVE = { archived: { $ne: true } };

/**
 * Every sheet's totals (catalog, cached) + the caller's solved count per sheet.
 * Shared by `/api/sheets` and the `/sheets` server page (SSR fallback).
 */
export async function computeSheetsProgress(
  userId: string,
): Promise<{ generatedAt: string; sheets: SheetProgress[] }> {
  const [solvedRows, sheetTotals] = await Promise.all([
    getUserOverlay(userId).then((r) => r.filter(activeRow).filter((x) => x.status === "Solved")),
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

  const sheets: SheetProgress[] = SHEETS.map((def) => {
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

  return { generatedAt: new Date().toISOString(), sheets };
}
