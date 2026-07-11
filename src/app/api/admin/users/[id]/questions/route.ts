import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireRoleAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { REVISION_STATUSES } from "@/lib/constants";
import UserProgress from "@/models/UserProgress";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS = new Set([
  "all",
  "solved",
  "attempted",
  "favorite",
  "revision",
  "notes",
]);

interface Cursor {
  t: string; // updatedAt ISO of last row
  id: string;
}
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    return typeof c.t === "string" && Types.ObjectId.isValid(c.id) ? c : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/users/[id]/questions?filter=&topic=&search=&cursor=&limit=
 * The target user's question history (solved/attempted/favorites/revision/
 * notes), newest activity first, cursor-paginated. Search covers question
 * title + the user's notes. Admin only, read-only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("read", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return fail("User not found", 404);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const filter = FILTERS.has(sp.get("filter") || "") ? sp.get("filter")! : "all";
    const topic = sp.get("topic")?.trim().slice(0, 120);
    const search = sp.get("search")?.trim().slice(0, 200);
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { userId: new Types.ObjectId(id) };
    if (filter === "solved") query.status = "Solved";
    if (filter === "attempted") query.status = "Attempted";
    if (filter === "favorite") query.favorite = true;
    if (filter === "revision") {
      query.$or = [{ revisionNeeded: true }, { status: { $in: REVISION_STATUSES } }];
    }
    if (filter === "notes") query.notes = { $nin: [null, ""] };

    // Search / topic constraints resolve to catalog id sets first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idConstraints: any[] = [];
    if (topic) {
      const ids = await Question.find({ topic }).select("_id").lean();
      idConstraints.push(ids.map((d) => d._id));
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const titleIds = await Question.find({ title: rx }).select("_id").limit(2000).lean();
      const orTitle = { questionId: { $in: titleIds.map((d) => d._id) } };
      const orNotes = { notes: rx };
      query.$and = [...(query.$and ?? []), { $or: [orTitle, orNotes] }];
    }
    if (idConstraints.length) {
      query.questionId = { $in: idConstraints[0] };
    }

    const cursor = decodeCursor(sp.get("cursor"));
    if (cursor) {
      const t = new Date(cursor.t);
      query.$and = [
        ...(query.$and ?? []),
        {
          $or: [
            { updatedAt: { $lt: t } },
            { updatedAt: t, _id: { $gt: new Types.ObjectId(cursor.id) } },
          ],
        },
      ];
    }

    const rows = await UserProgress.find(query)
      .sort({ updatedAt: -1, _id: 1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Join catalog fields for the page (one $in query — no N+1).
    const qids = page.map((r) => r.questionId);
    const docs = await Question.find({ _id: { $in: qids } })
      .select("title topic subtopic difficulty platform problemLink solutionLink videoLink")
      .lean();
    const qMap = new Map(docs.map((d) => [String(d._id), d]));

    const items = page.map((r) => {
      const q = qMap.get(String(r.questionId));
      return {
        questionId: String(r.questionId),
        title: q?.title ?? "(question removed)",
        topic: q?.topic ?? "",
        difficulty: q?.difficulty ?? "Medium",
        platform: q?.platform ?? "",
        problemLink: q?.problemLink ?? "",
        solutionLink: q?.solutionLink ?? "",
        videoLink: q?.videoLink ?? "",
        status: r.status,
        favorite: Boolean(r.favorite),
        revisionNeeded: Boolean(r.revisionNeeded),
        rating: r.rating ?? 0,
        attemptCount: r.attemptCount ?? 0,
        notes: r.notes ?? "",
        revisionNotes: r.revisionNotes ?? "",
        solvedAt: r.solvedAt ?? null,
        lastRevisedAt: r.lastRevisedAt ?? null,
        revisionDate: r.revisionDate ?? null,
        updatedAt: r.updatedAt ?? null,
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && page.length) {
      const last = page[page.length - 1]!;
      nextCursor = encodeCursor({
        t: (last.updatedAt as Date).toISOString(),
        id: String(last._id),
      });
    }

    return ok({ items, nextCursor });
  });
}
