import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { computeGoogleRoadmap } from "@/lib/google-roadmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google
 * Google-interview roadmap: catalog structure (cached, shared) + every progress
 * number from the CALLER's own rows. The computation lives in
 * `lib/google-roadmap.ts` and is shared with the `/google` server page.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    return ok(await computeGoogleRoadmap(user.id));
  });
}
