import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { computeSheetsProgress } from "@/lib/sheets-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sheets — every sheet's totals (cached catalog) + the CALLER's progress. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    return ok(await computeSheetsProgress(user.id));
  });
}
