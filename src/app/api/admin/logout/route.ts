import { ok, handle } from "@/lib/api-response";
import { ADMIN_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/logout
 * Clear the admin session cookie.
 */
export async function POST() {
  return handle(async () => {
    const res = ok({ ok: true });
    res.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return res;
  });
}
