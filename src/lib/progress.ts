import "server-only";
import { Types } from "mongoose";
import { UserProgress } from "@/models/UserProgress";
import { User } from "@/models/User";
import { REVISION_STATUSES } from "@/lib/constants";
import type { Difficulty, Status } from "@/types";

/**
 * User-progress data access — the single place that reads/writes per-user
 * state. Every function takes an explicit `userId` (from the session) and
 * every query filters on it, so cross-user leakage cannot happen by
 * forgetting a clause at a call site.
 *
 * Design: the Question collection stays a shared catalog. A user's touched
 * questions (progress docs) are few relative to the catalog, so per-user
 * overlays are computed from ONE small indexed query/aggregation and merged
 * in JS — no 15k-document $lookups, no N+1.
 */

/** Per-user fields a signed-in user may write through the questions API. */
export const USER_STATE_KEYS = [
  "status",
  "favorite",
  "revisionNeeded",
  "lastRevisedAt",
  "revisionDate",
  "attemptCount",
  "rating",
  "notes",
  "revisionNotes",
] as const;
export type UserStateKey = (typeof USER_STATE_KEYS)[number];

export interface ProgressLean {
  questionId: string;
  status: Status;
  favorite: boolean;
  revisionNeeded: boolean;
  lastRevisedAt: Date | null;
  revisionDate: Date | null;
  attemptCount: number;
  rating: number;
  notes: string;
  revisionNotes: string;
  solvedAt: Date | null;
}

export interface UserStatePatch {
  status?: Status;
  favorite?: boolean;
  revisionNeeded?: boolean;
  lastRevisedAt?: string | null;
  revisionDate?: string | null;
  attemptCount?: number;
  rating?: number;
  notes?: string;
  revisionNotes?: string;
}

const PROGRESS_FIELDS =
  "questionId status favorite revisionNeeded lastRevisedAt revisionDate attemptCount rating notes revisionNotes solvedAt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLean(d: any): ProgressLean {
  return {
    questionId: String(d.questionId),
    status: (d.status as Status) ?? "Not Started",
    favorite: Boolean(d.favorite),
    revisionNeeded: Boolean(d.revisionNeeded),
    lastRevisedAt: d.lastRevisedAt ?? null,
    revisionDate: d.revisionDate ?? null,
    attemptCount: Number(d.attemptCount ?? 0),
    rating: Number(d.rating ?? 0),
    notes: (d.notes as string) ?? "",
    revisionNotes: (d.revisionNotes as string) ?? "",
    solvedAt: d.solvedAt ?? null,
  };
}

/** Progress for a page of questions in one indexed query (no N+1). */
export async function getProgressMap(
  userId: string,
  questionIds: (string | Types.ObjectId)[],
): Promise<Map<string, ProgressLean>> {
  if (questionIds.length === 0) return new Map();
  const docs = await UserProgress.find({
    userId: new Types.ObjectId(userId),
    questionId: { $in: questionIds.map((id) => new Types.ObjectId(String(id))) },
  })
    .select(PROGRESS_FIELDS)
    .lean();
  return new Map(docs.map((d) => [String(d.questionId), toLean(d)]));
}

/**
 * Overlay a user's state onto a plain question document (catalog fields stay,
 * per-user fields come from progress or defaults). The result matches the
 * legacy embedded shape, so `serializeQuestion` and every client component
 * keep working unchanged.
 */
export function overlayQuestion<T extends Record<string, unknown>>(
  doc: T,
  p: ProgressLean | undefined,
): T {
  return {
    ...doc,
    status: p?.status ?? "Not Started",
    favorite: p?.favorite ?? false,
    revisionNeeded: p?.revisionNeeded ?? false,
    lastRevisedAt: p?.lastRevisedAt ?? null,
    revisionDate: p?.revisionDate ?? null,
    attemptCount: p?.attemptCount ?? 0,
    rating: p?.rating ?? 0,
    notes: p?.notes ?? "",
    revisionNotes: p?.revisionNotes ?? "",
    solvedAt: p?.solvedAt ?? null,
  };
}

/** Overlay progress onto many docs with one batched query. */
export async function overlayQuestions<T extends Record<string, unknown>>(
  userId: string,
  docs: T[],
): Promise<T[]> {
  const map = await getProgressMap(
    userId,
    docs.map((d) => String(d._id)),
  );
  return docs.map((d) => overlayQuestion(d, map.get(String(d._id))));
}

/** ObjectIds of every question the user has solved. */
export async function getSolvedIds(userId: string): Promise<Types.ObjectId[]> {
  const rows = await UserProgress.find({
    userId: new Types.ObjectId(userId),
    status: "Solved",
  })
    .select("questionId")
    .lean();
  return rows.map((r) => r.questionId as Types.ObjectId);
}

/**
 * A user's complete progress joined with the slim catalog fields needed for
 * per-dimension statistics (difficulty/topic/patterns/…): ONE aggregation
 * over the user's own rows with an indexed _id lookup per row.
 */
export interface OverlayRow extends ProgressLean {
  q: {
    difficulty: Difficulty;
    topic: string;
    pattern: string;
    patterns: string[];
    companies: string[];
    platform: string;
    tags: string[];
    problemLink: string;
    archived: boolean;
  } | null;
}

export async function getUserOverlay(userId: string): Promise<OverlayRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await UserProgress.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: "questions",
        localField: "questionId",
        foreignField: "_id",
        as: "q",
        pipeline: [
          {
            $project: {
              _id: 0,
              difficulty: 1,
              topic: 1,
              pattern: 1,
              patterns: 1,
              companies: 1,
              platform: 1,
              tags: 1,
              problemLink: 1,
              archived: 1,
            },
          },
        ],
      },
    },
    { $addFields: { q: { $first: "$q" } } },
  ]);

  return rows.map((r) => ({
    ...toLean(r),
    q: r.q
      ? {
          difficulty: r.q.difficulty as Difficulty,
          topic: (r.q.topic as string) ?? "",
          pattern: (r.q.pattern as string) ?? "",
          patterns: (r.q.patterns as string[]) ?? [],
          companies: (r.q.companies as string[]) ?? [],
          platform: (r.q.platform as string) ?? "Others",
          tags: (r.q.tags as string[]) ?? [],
          problemLink: (r.q.problemLink as string) ?? "",
          archived: Boolean(r.q.archived),
        }
      : null,
  }));
}

/** True when a joined row should count toward stats (question live). */
export function activeRow(r: OverlayRow): r is OverlayRow & { q: NonNullable<OverlayRow["q"]> } {
  return r.q !== null && !r.q.archived;
}

function dateOrNull(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Atomically create-or-update the user's progress on a question.
 *
 * A single `findOneAndUpdate` with an aggregation-pipeline update keeps the
 * write atomic under concurrency (two tabs, double clicks, parallel devices):
 * there is no read-modify-write window, and the (userId, questionId) unique
 * index collapses racing upserts. Derived rules preserved from the legacy
 * pre-save hook:
 *  - `solvedAt` is stamped the FIRST time status becomes "Solved" (kept on
 *    later edits, cleared never)
 *  - revision statuses force `revisionNeeded: true`
 */
export async function upsertProgress(
  userId: string,
  questionId: string,
  patch: UserStatePatch,
): Promise<ProgressLean> {
  const set: Record<string, unknown> = {};

  // Maintain the denormalized User.solvedCount (admin list sorting at scale).
  // The tiny read→inc race on same-user concurrent writes is self-limited and
  // corrected by the full recount that runs on any admin progress reset.
  let solvedDelta = 0;
  if (patch.status !== undefined) {
    const prev = await UserProgress.findOne({
      userId: new Types.ObjectId(userId),
      questionId: new Types.ObjectId(questionId),
    })
      .select("status")
      .lean();
    const wasSolved = prev?.status === "Solved";
    const isSolved = patch.status === "Solved";
    solvedDelta = Number(isSolved) - Number(wasSolved);
  }

  if (patch.status !== undefined) {
    set.status = patch.status;
    set.solvedAt =
      patch.status === "Solved"
        ? { $ifNull: ["$solvedAt", "$$NOW"] }
        : { $ifNull: ["$solvedAt", null] };
    if (REVISION_STATUSES.includes(patch.status)) {
      set.revisionNeeded = true;
    }
  }
  if (patch.favorite !== undefined) set.favorite = patch.favorite;
  if (patch.revisionNeeded !== undefined) set.revisionNeeded = patch.revisionNeeded;
  if (patch.attemptCount !== undefined) set.attemptCount = patch.attemptCount;
  if (patch.rating !== undefined) set.rating = patch.rating;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.revisionNotes !== undefined) set.revisionNotes = patch.revisionNotes;

  const lastRevisedAt = dateOrNull(patch.lastRevisedAt);
  if (lastRevisedAt !== undefined) set.lastRevisedAt = lastRevisedAt;
  const revisionDate = dateOrNull(patch.revisionDate);
  if (revisionDate !== undefined) set.revisionDate = revisionDate;

  // Pipeline updates bypass Mongoose defaults/timestamps — set them explicitly
  // so a fresh upsert is a complete, well-formed document.
  const doc = await UserProgress.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      questionId: new Types.ObjectId(questionId),
    },
    [
      {
        $set: {
          status: { $ifNull: ["$status", "Not Started"] },
          favorite: { $ifNull: ["$favorite", false] },
          revisionNeeded: { $ifNull: ["$revisionNeeded", false] },
          lastRevisedAt: { $ifNull: ["$lastRevisedAt", null] },
          revisionDate: { $ifNull: ["$revisionDate", null] },
          attemptCount: { $ifNull: ["$attemptCount", 0] },
          rating: { $ifNull: ["$rating", 0] },
          notes: { $ifNull: ["$notes", ""] },
          revisionNotes: { $ifNull: ["$revisionNotes", ""] },
          solvedAt: { $ifNull: ["$solvedAt", null] },
          createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
          updatedAt: "$$NOW",
        },
      },
      { $set: set },
    ],
    { new: true, upsert: true },
  ).lean();

  if (solvedDelta !== 0) {
    void User.updateOne({ _id: userId }, { $inc: { solvedCount: solvedDelta } })
      .exec()
      .catch(() => {});
  }

  return toLean(doc);
}

/** Recount a user's solvedCount from source of truth (used after resets). */
export async function recountSolved(userId: string): Promise<number> {
  const solved = await UserProgress.countDocuments({
    userId: new Types.ObjectId(userId),
    status: "Solved",
  });
  await User.updateOne({ _id: userId }, { $set: { solvedCount: solved } });
  return solved;
}

/**
 * Resolve user-state list filters (status / favorite / revision / minRating /
 * notes search) into a catalog `_id` constraint. Returns `null` when no
 * user-state filter is active.
 */
export async function userStateFilterIds(
  userId: string,
  opts: {
    status?: string;
    favorite?: boolean;
    revision?: boolean;
    minRating?: number;
  },
): Promise<{ include?: Types.ObjectId[]; exclude?: Types.ObjectId[] } | null> {
  const uid = new Types.ObjectId(userId);

  // "Not Started" is the absence of progress → exclude ids with another status.
  if (opts.status === "Not Started") {
    const rows = await UserProgress.find({ userId: uid, status: { $ne: "Not Started" } })
      .select("questionId")
      .lean();
    return { exclude: rows.map((r) => r.questionId as Types.ObjectId) };
  }

  const query: Record<string, unknown> = { userId: uid };
  let active = false;

  if (opts.status) {
    query.status = opts.status;
    active = true;
  }
  if (opts.favorite) {
    query.favorite = true;
    active = true;
  }
  if (opts.revision) {
    query.$or = [
      { revisionNeeded: true },
      { status: { $in: REVISION_STATUSES } },
    ];
    active = true;
  }
  if (opts.minRating && opts.minRating > 0) {
    query.rating = { $gte: opts.minRating };
    active = true;
  }

  if (!active) return null;

  const rows = await UserProgress.find(query).select("questionId").lean();
  return { include: rows.map((r) => r.questionId as Types.ObjectId) };
}

/** Ids of questions whose per-user notes match a search regex. */
export async function noteSearchIds(
  userId: string,
  rx: RegExp,
): Promise<Types.ObjectId[]> {
  const rows = await UserProgress.find({
    userId: new Types.ObjectId(userId),
    $or: [{ notes: rx }, { revisionNotes: rx }],
  })
    .select("questionId")
    .lean();
  return rows.map((r) => r.questionId as Types.ObjectId);
}
