import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { computeLearnOverview, continueLearningSection } from "@/lib/learn-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/learn
 * The staged learning overview (or, with `?section=continue`, one stage's next
 * page of continue-learning items). The computation lives in
 * `lib/learn-overview.ts` and is shared with the `/learn` server page.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const skip = Math.min(10_000, Math.max(0, Number(sp.get("skip")) || 0));
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 12));
    const stage = sp.get("stage") || undefined;

    if (sp.get("section") === "continue") {
      return ok(await continueLearningSection(user.id, { stage, skip, limit }));
    }
    return ok(await computeLearnOverview(user.id, { skip, limit, stage }));
  });
}
