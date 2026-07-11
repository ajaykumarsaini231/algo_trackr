import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    sessionVersion?: number;
  }
}
