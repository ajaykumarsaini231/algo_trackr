import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { computeUserStats } from "@/lib/user-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 * Dashboard statistics for the SIGNED-IN user. The computation lives in
 * `lib/user-stats.ts` and is shared with the admin User Dashboard Viewer,
 * so both always agree. Only the caller's own userId is ever passed here.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    return ok(await computeUserStats(user.id));
  });
}
