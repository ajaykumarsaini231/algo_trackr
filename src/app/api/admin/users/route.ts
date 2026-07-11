import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { requireRoleAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { REVISION_STATUSES } from "@/lib/constants";
import { User } from "@/models/User";
import UserProgress from "@/models/UserProgress";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sortable columns (whitelist) and their Mongo fields. All are indexed. */
const SORTS: Record<string, string> = {
  createdAt: "createdAt",
  lastLoginAt: "lastLoginAt",
  name: "name",
  loginCount: "loginCount",
  solved: "solvedCount",
};

interface Cursor {
  /** Sort value of the last row (null for missing). */
  v: string | number | null;
  /** Tie-break id of the last row. */
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if (typeof parsed.id !== "string" || !Types.ObjectId.isValid(parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/admin/users
 * Cursor-paginated, searchable, filterable user directory. Admin only.
 *
 * ?search=  name/email substring or exact user id
 * ?status=  active|blocked|suspended|deleted|never-logged-in
 * ?role=    user|admin|superadmin
 * ?sort=    createdAt|lastLoginAt|name|loginCount|solved (default createdAt)
 * ?dir=     asc|desc (default desc)
 * ?cursor=  opaque cursor from the previous page
 * ?limit=   1..50 (default 20)
 *
 * Scales by never using skip/offset: pagination is on (sortField, _id) with
 * indexed comparisons, and per-row activity columns are enriched with ONE
 * aggregation over just the page's user ids.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("read", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const sp = req.nextUrl.searchParams;

    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));
    const sortKey = SORTS[sp.get("sort") || ""] ? (sp.get("sort") as string) : "createdAt";
    const sortField = SORTS[sortKey];
    const dir = sp.get("dir") === "asc" ? 1 : -1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    // Status / lifecycle filters. Deleted accounts are hidden by default.
    const status = sp.get("status");
    if (status === "deleted") {
      query.deletedAt = { $ne: null };
    } else {
      query.deletedAt = null;
      if (status === "active" || status === "blocked" || status === "suspended") {
        query.status = status;
      } else if (status === "never-logged-in") {
        query.lastLoginAt = null;
      }
    }

    const role = sp.get("role");
    if (role === "user" || role === "admin" || role === "superadmin") {
      query.role = role;
    }

    const search = sp.get("search")?.trim().slice(0, 200);
    if (search) {
      if (Types.ObjectId.isValid(search)) {
        query._id = new Types.ObjectId(search);
      } else {
        const rx = new RegExp(escapeRx(search), "i");
        query.$or = [{ email: rx }, { name: rx }];
      }
    }

    // Keyset pagination on (sortField, _id).
    const DATE_FIELDS = new Set(["createdAt", "lastLoginAt"]);
    const cursor = decodeCursor(sp.get("cursor"));
    if (cursor) {
      // Date sort values travel through the cursor as ISO strings — revive
      // them so the Mongo comparison is Date-vs-Date, not string-vs-Date.
      const v =
        cursor.v !== null && DATE_FIELDS.has(sortField)
          ? new Date(cursor.v as string)
          : cursor.v;
      const cmp = dir === 1 ? "$gt" : "$lt";
      const tie = { [sortField]: v, _id: { $gt: new Types.ObjectId(cursor.id) } };
      const ahead =
        v === null
          ? null // nulls sort at the extreme; only the tie-break applies
          : { [sortField]: { [cmp]: v } };
      query.$and = [...(query.$and ?? []), { $or: ahead ? [ahead, tie] : [tie] }];
    }

    const [docs, total, catalogTotal] = await Promise.all([
      User.find(query)
        .sort({ [sortField]: dir, _id: 1 })
        .limit(limit + 1)
        .select("email name role status deletedAt createdAt lastLoginAt lastActiveAt loginCount solvedCount")
        .lean(),
      User.countDocuments(query),
      Question.countDocuments({ archived: { $ne: true } }),
    ]);

    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit);

    // Per-row activity enrichment for THIS page only (one aggregation).
    const ids = page.map((d) => d._id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrich: any[] = ids.length
      ? await UserProgress.aggregate([
          { $match: { userId: { $in: ids } } },
          {
            $group: {
              _id: "$userId",
              solved: { $sum: { $cond: [{ $eq: ["$status", "Solved"] }, 1, 0] } },
              favorites: { $sum: { $cond: ["$favorite", 1, 0] } },
              revision: {
                $sum: {
                  $cond: [
                    { $or: ["$revisionNeeded", { $in: ["$status", REVISION_STATUSES] }] },
                    1,
                    0,
                  ],
                },
              },
              notes: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$notes", ""] } }, 0] }, 1, 0] } },
              lastActivity: { $max: "$updatedAt" },
            },
          },
        ])
      : [];
    const enrichMap = new Map(enrich.map((e) => [String(e._id), e]));

    const items = page.map((d) => {
      const e = enrichMap.get(String(d._id));
      const solved = e?.solved ?? 0;
      return {
        id: String(d._id),
        email: d.email,
        name: d.name || "",
        role: d.role,
        status: d.deletedAt ? "deleted" : d.status,
        createdAt: d.createdAt ?? null,
        lastLoginAt: d.lastLoginAt ?? null,
        lastActiveAt: d.lastActiveAt ?? null,
        loginCount: d.loginCount ?? 0,
        solved,
        progressPct: catalogTotal ? Math.round((solved / catalogTotal) * 1000) / 10 : 0,
        favorites: e?.favorites ?? 0,
        revision: e?.revision ?? 0,
        notes: e?.notes ?? 0,
        lastActivity: e?.lastActivity ?? null,
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && page.length) {
      const last = page[page.length - 1]!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (last as any)[sortField];
      nextCursor = encodeCursor({
        v: v instanceof Date ? v.toISOString() : (v ?? null),
        id: String(last._id),
      });
    }

    return ok({ items, total, nextCursor, catalogTotal });
  });
}
