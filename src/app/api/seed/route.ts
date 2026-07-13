import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { questionCreateSchema } from "@/lib/validations";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { bumpCatalogVersion } from "@/lib/catalog-cache";
import { SAMPLE_QUESTIONS } from "@/lib/sample-data";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/seed
 * Insert the curated sample questions. Admin only. Idempotent: skips any
 * question whose title already exists so re-seeding never duplicates or
 * deletes existing data.
 */
export async function POST() {
  return handle(async () => {
    const admin = await requireAdmin();
    const rl = await checkRateLimit("heavy", admin.actorId);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
    void logAudit({ action: "admin.seed", userId: admin.user?.id ?? null });

    await connectDB();

    let inserted = 0;
    for (const raw of SAMPLE_QUESTIONS) {
      const parsed = questionCreateSchema.safeParse(raw);
      if (!parsed.success) continue;

      const exists = await Question.findOne({ title: parsed.data.title });
      if (exists) continue;

      await new Question(parsed.data).save();
      inserted += 1;
    }

    if (inserted > 0) bumpCatalogVersion();
    return ok({ inserted });
  });
}
