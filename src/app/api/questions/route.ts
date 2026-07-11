import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { serializeQuestion, serializeQuestions } from "@/lib/serialize";
import { questionCreateSchema, parseOrError } from "@/lib/validations";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  overlayQuestions,
  userStateFilterIds,
  noteSearchIds,
} from "@/lib/progress";
import { logAudit } from "@/lib/audit";
import Question from "@/models/Question";
import type { Paginated, Question as QuestionType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Difficulty ordering used when sorting by difficulty. */
const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

/** Sort fields a client may request (whitelist — never raw user input). */
const SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "title",
  "difficulty",
  "rating",
  "attemptCount",
]);

/** Sorts that live on per-user state and therefore sort in JS post-overlay. */
const USER_SORT_FIELDS = new Set(["rating", "attemptCount"]);

/**
 * GET /api/questions
 * List questions with filtering, sorting and pagination.
 *
 * Catalog filters (topic/difficulty/search/…) hit the shared collection;
 * user-state filters (status/favorite/revision/minRating) resolve to the
 * caller's OWN progress ids first — another user's activity can never
 * influence the result.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const rl = await checkRateLimit("read", user.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const sp = req.nextUrl.searchParams;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    // Archived toggle: only archived when ?archived=true, else only active.
    query.archived = sp.get("archived") === "true";

    // Independent OR-groups (search, revision) are AND-ed together via $and so
    // that adding one filter never widens the results of another.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orGroups: Record<string, any>[][] = [];

    // Case-insensitive search across catalog fields + the user's own notes.
    const search = sp.get("search")?.trim().slice(0, 200);
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const myNoteIds = await noteSearchIds(user.id, rx);
      orGroups.push([
        { title: rx },
        { concept: rx },
        { tags: rx },
        { companies: rx },
        { topic: rx },
        { subtopic: rx },
        { pattern: rx },
        { platform: rx },
        ...(myNoteIds.length ? [{ _id: { $in: myNoteIds } }] : []),
      ]);
    }

    // Exact-match catalog filters (status is user-state, handled below).
    const exact = ["topic", "subtopic", "pattern", "platform", "difficulty"] as const;
    for (const key of exact) {
      const value = sp.get(key)?.trim().slice(0, 200);
      if (value) query[key] = value;
    }

    // Company is an element of the companies array.
    const company = sp.get("company")?.trim().slice(0, 200);
    if (company) query.companies = company;

    // Pattern slug is an element of the patterns[] array.
    const patternSlug = sp.get("patterns")?.trim().slice(0, 200);
    if (patternSlug) query.patterns = patternSlug;

    // User-state filters → the caller's own progress ids.
    const minRating = Number(sp.get("minRating"));
    const stateFilter = await userStateFilterIds(user.id, {
      status: sp.get("status")?.trim() || undefined,
      favorite: sp.get("favorite") === "true",
      revision: sp.get("revision") === "true",
      minRating: Number.isFinite(minRating) ? minRating : 0,
    });
    if (stateFilter?.include) {
      // Intersect with any search group via $and semantics below.
      orGroups.push([{ _id: { $in: stateFilter.include } }]);
    }
    if (stateFilter?.exclude?.length) {
      query._id = { $nin: stateFilter.exclude };
    }

    // Attach OR-groups: a single group as $or, multiple groups as $and of $ors.
    if (orGroups.length === 1) {
      query.$or = orGroups[0];
    } else if (orGroups.length > 1) {
      query.$and = orGroups.map((group) => ({ $or: group }));
    }

    // Sorting: "field:dir" from a whitelist, default createdAt:desc.
    const sortParam = sp.get("sort") || "createdAt:desc";
    const [sortFieldRaw, sortDirRaw] = sortParam.split(":");
    const sortField = SORT_FIELDS.has(sortFieldRaw || "") ? sortFieldRaw! : "createdAt";
    const sortDir = sortDirRaw === "asc" ? 1 : -1;

    // Pagination (hard caps to prevent abuse).
    const page = Math.min(10_000, Math.max(1, Number(sp.get("page")) || 1));
    const rawLimit = Number(sp.get("limit")) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const total = await Question.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    let docs: Record<string, unknown>[];

    if (sortField === "difficulty" || USER_SORT_FIELDS.has(sortField)) {
      // Custom orders Mongo can't index directly: difficulty (Easy<Medium<Hard)
      // and per-user fields (rating/attempts live in UserProgress). Load the
      // matching ids, overlay, sort in JS, then slice the page.
      const all = await Question.find(query).lean();
      const overlaid = await overlayQuestions(user.id, all as Record<string, unknown>[]);
      overlaid.sort((a, b) => {
        let diff = 0;
        if (sortField === "difficulty") {
          diff =
            (DIFFICULTY_ORDER[(a.difficulty as string) ?? ""] ?? 0) -
            (DIFFICULTY_ORDER[(b.difficulty as string) ?? ""] ?? 0);
        } else {
          diff = Number(a[sortField] ?? 0) - Number(b[sortField] ?? 0);
        }
        return sortDir === 1 ? diff : -diff;
      });
      docs = overlaid.slice(skip, skip + limit);
    } else {
      const pageDocs = await Question.find(query)
        .sort({ [sortField]: sortDir, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      docs = await overlayQuestions(user.id, pageDocs as Record<string, unknown>[]);
    }

    const payload: Paginated<QuestionType> = {
      items: serializeQuestions(docs),
      total,
      page,
      limit,
      totalPages,
    };
    return ok(payload);
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
    void logAudit({
      action: "question.create",
      userId: admin.user?.id ?? null,
      meta: { questionId: String(doc._id), title: doc.title },
    });
    return ok(serializeQuestion(doc), { status: 201 });
  });
}
