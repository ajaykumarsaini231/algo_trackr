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
import { bumpCatalogVersion } from "@/lib/catalog-cache";
import Question from "@/models/Question";
import type { Paginated, Question as QuestionType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catalog fields the list UI (QuestionCard) actually renders. Per-user fields
 * (status/favorite/revisionNeeded/rating/attemptCount/notes/solvedAt) are added
 * by `overlayQuestions`, and heavy text (concept/approach/notes/links/tags) is
 * NOT shown in lists — so we project it away here, cutting the payload ~9x
 * (≈9.4 kB → ≈0.8 kB per item). The detail route returns the full document.
 */
const LIST_FIELDS = [
  "title", "problemLink", "platform", "difficulty", "topic", "subtopic",
  "pattern", "companies", "estimatedTime", "archived", "createdAt", "updatedAt",
] as const;
const LIST_SELECT = LIST_FIELDS.join(" ");
const LIST_PROJECT: Record<string, 1> = Object.fromEntries(LIST_FIELDS.map((f) => [f, 1]));

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

    // The total count is independent of the page fetch → run them concurrently
    // instead of paying two sequential round-trips.
    const totalPromise = Question.countDocuments(query);

    let docs: Record<string, unknown>[];

    if (sortField === "difficulty") {
      // Easy<Medium<Hard is an order Mongo can't index directly. Rank, sort and
      // paginate ENTIRELY at the DB so only the page is returned + overlaid —
      // previously this loaded the whole active catalog (~15k docs, ~143 MB)
      // into memory on every difficulty sort.
      const pageDocs = await Question.aggregate([
        { $match: query },
        {
          $addFields: {
            __diff: {
              $switch: {
                branches: [
                  { case: { $eq: ["$difficulty", "Easy"] }, then: 0 },
                  { case: { $eq: ["$difficulty", "Medium"] }, then: 1 },
                  { case: { $eq: ["$difficulty", "Hard"] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
        { $sort: { __diff: sortDir, _id: 1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: LIST_PROJECT },
      ]);
      docs = await overlayQuestions(user.id, pageDocs as Record<string, unknown>[]);
    } else if (USER_SORT_FIELDS.has(sortField)) {
      // rating / attemptCount live in the caller's overlay, not the catalog, so
      // these still overlay-then-sort in JS — but with the slim projection the
      // read is a fraction of the former full-document transfer.
      const all = await Question.find(query).select(LIST_SELECT).lean();
      const overlaid = await overlayQuestions(user.id, all as Record<string, unknown>[]);
      overlaid.sort((a, b) => {
        const diff = Number(a[sortField] ?? 0) - Number(b[sortField] ?? 0);
        return sortDir === 1 ? diff : -diff;
      });
      docs = overlaid.slice(skip, skip + limit);
    } else {
      const pageDocs = await Question.find(query)
        .select(LIST_SELECT)
        .sort({ [sortField]: sortDir, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      docs = await overlayQuestions(user.id, pageDocs as Record<string, unknown>[]);
    }

    const total = await totalPromise;
    const totalPages = Math.max(1, Math.ceil(total / limit));

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
    bumpCatalogVersion(); // new catalog question → drop cached catalog aggregations
    void logAudit({
      action: "question.create",
      userId: admin.user?.id ?? null,
      meta: { questionId: String(doc._id), title: doc.title },
    });
    return ok(serializeQuestion(doc), { status: 201 });
  });
}
