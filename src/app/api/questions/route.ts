import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { serializeQuestion } from "@/lib/serialize";
import { questionCreateSchema, parseOrError } from "@/lib/validations";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { listQuestions } from "@/lib/question-list";
import { logAudit } from "@/lib/audit";
import { bumpCatalogVersion } from "@/lib/catalog-cache";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/questions
 * List questions with filtering, sorting and pagination. The read itself lives
 * in `lib/question-list.ts` (shared with the server-rendered list pages);
 * catalog filters hit the shared collection while user-state filters resolve to
 * the caller's OWN progress ids first, so another user's activity can never
 * influence the result.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    return ok(await listQuestions(user.id, req.nextUrl.searchParams));
  });
}

/**
 * POST /api/questions
 * Create a new catalog question. Admin only.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const rl = await checkRateLimit("mutate", admin.actorId);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(questionCreateSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);

    await connectDB();
    const doc = new Question(parsed.data);
    await doc.save();
    bumpCatalogVersion(); // new catalog question → drop cached catalog aggregations
    void logAudit({
      action: "question.create",
      userId: admin.user?.id ?? null,
      meta: { questionId: String(doc._id), title: doc.title },
    });
    return ok(serializeQuestion(doc), { status: 201 });
  });
}
