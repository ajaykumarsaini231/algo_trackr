import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/lib/db";
import { env, roleForEmail } from "@/lib/env";
import { User, type UserRole } from "@/models/User";
import {
  getLockStateFor,
  registerFailureFor,
  resetAttemptsFor,
} from "@/lib/security";
import { logAudit } from "@/lib/audit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

/** Sign-in rejected because of an active brute-force lockout. */
class LockedSignin extends CredentialsSignin {
  code = "locked";
}
/** Sign-in rejected because the account is blocked by an administrator. */
class BlockedSignin extends CredentialsSignin {
  code = "blocked";
}
/** Sign-in rejected because the account is suspended. */
class SuspendedSignin extends CredentialsSignin {
  code = "suspended";
}

/**
 * Full Auth.js v5 instance (Node runtime): Credentials provider backed by the
 * users collection, bcrypt verification, per-email + per-IP brute-force
 * lockout, and JWT sessions carrying `{ id, role, sessionVersion }`.
 *
 * Route handlers and server code import { auth } from here; middleware uses
 * the edge-safe `auth.config.ts` instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: env().AUTH_SECRET,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";

        await connectDB();

        // Brute-force protection on both dimensions: the targeted account
        // (distributed attack on one email) and the source IP (spraying).
        const [emailLock, ipLock] = await Promise.all([
          getLockStateFor(`login:${email}`),
          getLockStateFor(`login-ip:${ip}`),
        ]);
        if (emailLock.locked || ipLock.locked) {
          throw new LockedSignin();
        }

        const user = await User.findOne({ email }).select("+passwordHash");

        // Constant-shape failure path: always burn a bcrypt comparison even
        // for unknown emails so response timing does not reveal registration.
        const hash =
          user?.passwordHash ||
          "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZDLQIB1JVXBoJcTpEjxLySNSsyKjXG"; // "invalid"
        const valid = await bcrypt.compare(password, hash);

        if (!user || !valid || user.deletedAt) {
          await Promise.all([
            registerFailureFor(`login:${email}`, ip),
            registerFailureFor(`login-ip:${ip}`, ip),
          ]);
          void logAudit({ action: "auth.login_failed", ip, meta: { email } });
          return null;
        }

        // Moderation gates AFTER credential verification, so a blocked
        // notice is only ever shown to the account's real owner.
        if (user.status === "blocked") {
          void logAudit({ action: "auth.login_blocked", userId: String(user._id), ip });
          throw new BlockedSignin();
        }
        if (user.status === "suspended") {
          void logAudit({ action: "auth.login_suspended", userId: String(user._id), ip });
          throw new SuspendedSignin();
        }

        await Promise.all([
          resetAttemptsFor(`login:${email}`),
          resetAttemptsFor(`login-ip:${ip}`),
        ]);

        // Role is re-derived from the allowlists on every login so promoting
        // or demoting an admin is a pure env change.
        const role: UserRole =
          roleForEmail(email) === "user" ? user.role : roleForEmail(email);
        if (role !== user.role) user.role = role;
        user.lastLoginAt = new Date();
        user.loginCount = (user.loginCount ?? 0) + 1;
        await user.save();

        void logAudit({ action: "auth.login", userId: String(user._id), ip });

        return {
          id: String(user._id),
          email: user.email,
          name: user.name || user.email,
          role,
          sessionVersion: user.sessionVersion ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    // Persist id + role + session version into the JWT at sign-in…
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role ?? "user";
        token.sessionVersion =
          (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    // …and expose them on the session object used by server + client code.
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as UserRole) ?? "user";
        session.user.sessionVersion = (token.sessionVersion as number) ?? 0;
      }
      return session;
    },
  },
});
