import "server-only";
import crypto from "crypto";

/**
 * Self-contained HMAC-signed session tokens (no third-party auth libraries).
 *
 * A token is `base64url(payload).base64url(hmacSHA256(payload, secret))`.
 * The signing secret is stored per-admin in MongoDB (never in env, never sent
 * to the client), so tokens cannot be forged without DB access and rotating
 * the secret invalidates every outstanding session.
 */

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface SessionPayload {
  role: "admin";
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** Generate a fresh random signing secret (hex). */
export function generateSessionSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Create a signed session token valid for `SESSION_TTL_MS`. */
export function createToken(secret: string): string {
  const now = Date.now();
  const payload: SessionPayload = {
    role: "admin",
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

/** Verify a token; returns the payload when valid & unexpired, else null. */
export function verifyToken(token: string, secret: string): SessionPayload | null {
  if (!token || !secret) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
