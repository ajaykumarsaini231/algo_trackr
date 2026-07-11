import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireRoleAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { AuditLog } from "@/models/AuditLog";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Cursor {
  t: string;
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
 * GET /api/admin/audit-logs?action=&userId=&targetUserId=&cursor=&limit=
 * Cursor-paginated audit trail (newest first) with actor/target emails
 * resolved for display. Admin only, read-only.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const admin = await requireRoleAdmin();
    const rl = await checkRateLimit("read", admin.id);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    const action = sp.get("action")?.trim().slice(0, 64);
    if (action) query.action = action.endsWith("*")
      ? new RegExp(`^${action.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
      : action;
    for (const key of ["userId", "targetUserId"] as const) {
      const v = sp.get(key);
      if (v && Types.ObjectId.isValid(v)) query[key] = new Types.ObjectId(v);
    }

    const cursor = decodeCursor(sp.get("cursor"));
    if (cursor) {
      const t = new Date(cursor.t);
      query.$or = [
        { createdAt: { $lt: t } },
        { createdAt: t, _id: { $gt: new Types.ObjectId(cursor.id) } },
      ];
    }

    const rows = await AuditLog.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // Resolve actor/target emails in one query.
    const ids = [
      ...new Set(
        page
          .flatMap((r) => [r.userId, r.targetUserId])
          .filter(Boolean)
          .map(String),
      ),
    ].map((x) => new Types.ObjectId(x));
    const users = ids.length
      ? await User.find({ _id: { $in: ids } }).select("email").lean()
      : [];
    const emailMap = new Map(users.map((u) => [String(u._id), u.email]));

    const items = page.map((r) => ({
      id: String(r._id),
      action: r.action,
      actorId: r.userId ? String(r.userId) : null,
      actorEmail: r.userId ? (emailMap.get(String(r.userId)) ?? "(deleted)") : null,
      targetUserId: r.targetUserId ? String(r.targetUserId) : null,
      targetEmail: r.targetUserId ? (emailMap.get(String(r.targetUserId)) ?? "(deleted)") : null,
      ip: r.ip ?? "",
      userAgent: r.userAgent ?? "",
      meta: r.meta ?? {},
      createdAt: r.createdAt,
    }));

    let nextCursor: string | null = null;
    if (hasMore && page.length) {
      const last = page[page.length - 1]!;
      nextCursor = encodeCursor({
        t: (last.createdAt as Date).toISOString(),
        id: String(last._id),
      });
    }

    return ok({ items, nextCursor });
  });
}
