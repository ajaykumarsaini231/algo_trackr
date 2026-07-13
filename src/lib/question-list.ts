import "server-only";
import { serializeQuestions } from "@/lib/serialize";
import { overlayQuestions, userStateFilterIds, noteSearchIds } from "@/lib/progress";
import Question from "@/models/Question";
import type { Paginated, Question as QuestionType } from "@/types";

/**
 * Question-list read used by BOTH `GET /api/questions` (the SWR endpoint) and
 * the server-rendered list pages (SSR fallback), so they can never drift.
 * Caller must be connected to the DB and pass the effective user id.
 *
 * Catalog fields the list UI (QuestionCard) actually renders. Per-user fields
 * (status/favorite/rating/…) are added by `overlayQuestions`; heavy text
 * (concept/approach/notes/links/tags) is NOT shown in lists, so we project it
 * away here (~9.4 kB → ~0.8 kB per item). The detail route returns the full doc.
 */
const LIST_FIELDS = [
  "title", "problemLink", "platform", "difficulty", "topic", "subtopic",
  "pattern", "companies", "estimatedTime", "archived", "createdAt", "updatedAt",
] as const;
const LIST_SELECT = LIST_FIELDS.join(" ");
const LIST_PROJECT: Record<string, 1> = Object.fromEntries(LIST_FIELDS.map((f) => [f, 1]));

/** Sort fields a client may request (whitelist — never raw user input). */
const SORT_FIELDS = new Set(["createdAt", "updatedAt", "title", "difficulty", "rating", "attemptCount"]);
/** Sorts that live on per-user state and therefore sort in JS post-overlay. */
const USER_SORT_FIELDS = new Set(["rating", "attemptCount"]);

export async function listQuestions(
  userId: string,
  sp: URLSearchParams,
): Promise<Paginated<QuestionType>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};

  // Archived toggle: only archived when ?archived=true, else only active.
  query.archived = sp.get("archived") === "true";

  // Independent OR-groups (search, revision) AND-ed via $and so adding one
  // filter never widens another's results.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orGroups: Record<string, any>[][] = [];

  const search = sp.get("search")?.trim().slice(0, 200);
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const myNoteIds = await noteSearchIds(userId, rx);
    orGroups.push([
      { title: rx }, { concept: rx }, { tags: rx }, { companies: rx },
      { topic: rx }, { subtopic: rx }, { pattern: rx }, { platform: rx },
      ...(myNoteIds.length ? [{ _id: { $in: myNoteIds } }] : []),
    ]);
  }

  const exact = ["topic", "subtopic", "pattern", "platform", "difficulty"] as const;
  for (const key of exact) {
    const value = sp.get(key)?.trim().slice(0, 200);
    if (value) query[key] = value;
  }

  const company = sp.get("company")?.trim().slice(0, 200);
  if (company) query.companies = company;
  const patternSlug = sp.get("patterns")?.trim().slice(0, 200);
  if (patternSlug) query.patterns = patternSlug;

  const minRating = Number(sp.get("minRating"));
  const stateFilter = await userStateFilterIds(userId, {
    status: sp.get("status")?.trim() || undefined,
    favorite: sp.get("favorite") === "true",
    revision: sp.get("revision") === "true",
    minRating: Number.isFinite(minRating) ? minRating : 0,
  });
  if (stateFilter?.include) orGroups.push([{ _id: { $in: stateFilter.include } }]);
  if (stateFilter?.exclude?.length) query._id = { $nin: stateFilter.exclude };

  if (orGroups.length === 1) query.$or = orGroups[0];
  else if (orGroups.length > 1) query.$and = orGroups.map((group) => ({ $or: group }));

  const sortParam = sp.get("sort") || "createdAt:desc";
  const [sortFieldRaw, sortDirRaw] = sortParam.split(":");
  const sortField = SORT_FIELDS.has(sortFieldRaw || "") ? sortFieldRaw! : "createdAt";
  const sortDir = sortDirRaw === "asc" ? 1 : -1;

  const page = Math.min(10_000, Math.max(1, Number(sp.get("page")) || 1));
  const rawLimit = Number(sp.get("limit")) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  // The total count is independent of the page fetch → run them concurrently.
  const totalPromise = Question.countDocuments(query);

  let docs: Record<string, unknown>[];

  if (sortField === "difficulty") {
    // Easy<Medium<Hard: rank, sort and paginate ENTIRELY at the DB (only the
    // page is returned + overlaid), instead of loading the whole catalog.
    const pageDocs = await Question.aggregate([
      { $match: query },
      { $addFields: { __diff: { $switch: { branches: [
        { case: { $eq: ["$difficulty", "Easy"] }, then: 0 },
        { case: { $eq: ["$difficulty", "Medium"] }, then: 1 },
        { case: { $eq: ["$difficulty", "Hard"] }, then: 2 },
      ], default: 1 } } } },
      { $sort: { __diff: sortDir, _id: 1 } },
      { $skip: skip }, { $limit: limit }, { $project: LIST_PROJECT },
    ]);
    docs = await overlayQuestions(userId, pageDocs as Record<string, unknown>[]);
  } else if (USER_SORT_FIELDS.has(sortField)) {
    // rating / attemptCount live in the caller's overlay → overlay then sort in
    // JS, but with the slim projection the read is a fraction of the former size.
    const all = await Question.find(query).select(LIST_SELECT).lean();
    const overlaid = await overlayQuestions(userId, all as Record<string, unknown>[]);
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
    docs = await overlayQuestions(userId, pageDocs as Record<string, unknown>[]);
  }

  const total = await totalPromise;
  return {
    items: serializeQuestions(docs),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
