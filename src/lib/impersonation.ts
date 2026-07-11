import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Server-side impersonation ("Login as user") for SUPERADMINS only.
 *
 * Design:
 *  - a short-lived HMAC-signed httpOnly cookie carries { adminId, targetId,
 *    exp }; the admin's real Auth.js session stays untouched, so returning to
 *    the admin account is instant (delete the cookie) and the user's
 *    credentials/sessions are never involved.
 *  - `getSessionUser()` (lib/auth-helpers) resolves the EFFECTIVE identity:
 *    a valid cookie + a superadmin session ⇒ requests act as the target user
 *    with role forced to "user" (impersonation can only ever LOWER privilege).
 *  - admin/role checks always use the raw session, never the impersonated
 *    identity, so an impersonating admin cannot be locked out of returning.
 */
export const IMPERSONATE_COOKIE = "admin_impersonate";
export const IMPERSONATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ImpersonationPayload {
  /** Superadmin doing the impersonating. */
  adminId: string;
  /** Account being impersonated. */
  targetId: string;
  exp: number;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", env().AUTH_SECRET).update(data).digest("base64url");
}

export function createImpersonationToken(adminId: string, targetId: string): string {
  const payload: ImpersonationPayload = {
    adminId,
    targetId,
    exp: Date.now() + IMPERSONATION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyImpersonationToken(token: string): ImpersonationPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as ImpersonationPayload;
    if (!payload.adminId || !payload.targetId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** The verified impersonation state on this request, if any. */
export async function readImpersonationCookie(): Promise<ImpersonationPayload | null> {
  const store = await cookies();
  const token = store.get(IMPERSONATE_COOKIE)?.value;
  if (!token) return null;
  return verifyImpersonationToken(token);
}

export function impersonationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
  };
}
