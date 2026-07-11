import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration — imported by `src/middleware.ts`, so it
 * must NOT import mongoose, bcrypt or anything Node-only. The Credentials
 * provider (which needs the database) lives in `src/auth.ts`; middleware only
 * verifies the signed session JWT.
 */
export const authConfig = {
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
    // Absolute session lifetime; the JWT is re-issued on activity at most
    // once per updateAge, so idle sessions expire.
    maxAge: 14 * 24 * 60 * 60, // 14 days
    updateAge: 24 * 60 * 60, // 1 day
  },
  // Cookie hardening. Auth.js already defaults to httpOnly + SameSite=Lax and
  // adds the __Secure- prefix on HTTPS; we pin the values explicitly so they
  // are part of the reviewed configuration rather than implicit defaults.
  useSecureCookies: process.env.NODE_ENV === "production",
  trustHost: true,
  providers: [], // populated in src/auth.ts (Node runtime only)
} satisfies NextAuthConfig;
