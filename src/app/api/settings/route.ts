import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, handle } from "@/lib/api-response";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { Settings } from "@/models/Settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Settings fields an admin is allowed to write. */
const ALLOWED_FIELDS = [
  "siteName",
  "accentColor",
  "defaultPageSize",
  "defaultTheme",
  "revisionIntervals",
  "showConfetti",
  "compactMode",
  "preferences",
] as const;

/**
 * GET /api/settings
 * Return the settings singleton, creating it on first access.
 */
export async function GET() {
  return handle(async () => {
    await requireUser();
    await connectDB();
    let s = await Settings.findOne({ key: "app" });
    if (!s) s = await Settings.create({ key: "app" });
    return ok(s.toObject());
  });
}

/**
 * PATCH /api/settings
 * Update known settings fields. Admin only.
 */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const rl = await checkRateLimit("mutate", admin.actorId);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));

    // Whitelist known fields only; ignore anything else (never touch `key`).
    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body && Object.prototype.hasOwnProperty.call(body, field)) {
        update[field] = body[field];
      }
    }

    await connectDB();
    const updated = await Settings.findOneAndUpdate(
      { key: "app" },
      { $set: update },
      { new: true, upsert: true },
    );

    void logAudit({
      action: "admin.settings_update",
      userId: admin.user?.id ?? null,
      meta: { keys: Object.keys(update) },
    });
    return ok(updated!.toObject());
  });
}
