import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { parseOrError } from "@/lib/validations";
import { hashPassword, getClientIp } from "@/lib/security";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { roleForEmail } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

/**
 * POST /api/auth/register
 * Create an account. The client signs in via Auth.js afterwards.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = getClientIp(req);
    const rl = await checkRateLimit("auth", `register:${ip}`);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(registerSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);
    const { name, email, password } = parsed.data;

    await connectDB();

    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) {
      return fail("An account with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(password);
    const role = roleForEmail(email);

    try {
      const user = await User.create({ email, name, passwordHash, role });
      void logAudit({
        action: "auth.register",
        userId: String(user._id),
        ip,
        meta: { role },
      });
      return ok({ registered: true }, { status: 201 });
    } catch (err) {
      // Unique-index race: two concurrent registrations for the same email.
      if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
        return fail("An account with this email already exists.", 409);
      }
      throw err;
    }
  });
}
