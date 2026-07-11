import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { adminSetupSchema, parseOrError } from "@/lib/validations";
import { hashPassword } from "@/lib/security";
import {
  ADMIN_COOKIE,
  SESSION_TTL_MS,
  generateSessionSecret,
  createToken,
} from "@/lib/session";
import { Admin } from "@/models/Admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/setup
 * One-time creation of the single admin credential. Never overwrites.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(adminSetupSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);

    await connectDB();
    if ((await Admin.countDocuments()) > 0) {
      return fail("Admin is already configured.", 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const sessionSecret = generateSessionSecret();
    await Admin.create({
      key: "primary",
      passwordHash,
      sessionSecret,
      lastLoginAt: new Date(),
    });

    const token = createToken(sessionSecret);
    const res = ok({ authenticated: true }, { status: 201 });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  });
}
