import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { serializeQuestion } from "@/lib/serialize";
import { questionUpdateSchema, parseOrError } from "@/lib/validations";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  USER_STATE_KEYS,
  getProgressMap,
  overlayQuestion,
  upsertProgress,
  type UserStatePatch,
} from "@/lib/progress";
import { logAudit } from "@/lib/audit";
import { bumpCatalogVersion } from "@/lib/catalog-cache";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_KEYS = new Set<string>(USER_STATE_KEYS);

/**
 * GET /api/questions/[id]
 * One catalog question overlaid with the CALLER's own progress.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return fail("Question not found", 404);
    }

    await connectDB();
    // The catalog doc and the caller's progress row are independent reads.
    const [doc, progress] = await Promise.all([
      Question.findById(id).lean(),
      getProgressMap(user.id, [id]),
    ]);
    if (!doc) return fail("Question not found", 404);

    return ok(serializeQuestion(overlayQuestion(doc as Record<string, unknown>, progress.get(id))));
  });
}

/**
 * PATCH /api/questions/[id]
 *
 * One endpoint, two authorization scopes — split by payload:
 *  - user-state keys (status/favorite/notes/rating/revision…) update the
 *    CALLER's own UserProgress row. Any signed-in user; cannot touch others.
 *  - catalog keys (title/topic/links/archived/…) mutate the shared question.
 *    Admin only.
 * The response is the merged question, so existing clients see the exact
 * shape they always did.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("mutate", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return fail("Question not found", 404);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Support the "now" sentinel for lastRevisedAt: resolve it to an ISO
    // string on the raw body so it passes the datetime-validated schema.
    if (body && body.lastRevisedAt === "now") {
      body.lastRevisedAt = new Date().toISOString();
    }

    const parsed = parseOrError(questionUpdateSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const data = parsed.data as Record<string, unknown>;

    const providedKeys = Object.keys(body ?? {}).filter((k) =>
      Object.prototype.hasOwnProperty.call(data, k),
    );
    const userKeys = providedKeys.filter((k) => USER_KEYS.has(k));
    const catalogKeys = providedKeys.filter((k) => !USER_KEYS.has(k));

    await connectDB();
    const doc = await Question.findById(id);
    if (!doc) return fail("Question not found", 404);

    // Catalog changes require admin — checked BEFORE any write happens.
    if (catalogKeys.length > 0) {
      const admin = await requireAdmin();
      for (const key of catalogKeys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any)[key] = data[key];
      }
      await doc.save();
      bumpCatalogVersion(); // catalog changed → drop cached catalog aggregations
      void logAudit({
        action: "question.update",
        userId: admin.user?.id ?? null,
        meta: { questionId: id, keys: catalogKeys },
      });
    }

    // Per-user state goes to the caller's own progress row (atomic upsert).
    let progress;
    if (userKeys.length > 0) {
      const patch: UserStatePatch = {};
      for (const key of userKeys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (patch as any)[key] = data[key];
      }
      progress = await upsertProgress(user.id, id, patch);
    } else {
      progress = (await getProgressMap(user.id, [id])).get(id);
    }

    return ok(
      serializeQuestion(
        overlayQuestion(doc.toObject() as Record<string, unknown>, progress),
      ),
    );
  });
}
