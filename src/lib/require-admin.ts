import "server-only";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { ADMIN_COOKIE, verifyToken } from "@/lib/session";

/**
 * True when the incoming request carries a valid admin session cookie.
 * Mutation routes call this and return 401 when it is false.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  await connectDB();
  const admin = await Admin.findOne({ key: "primary" }).lean();
  if (!admin?.sessionSecret) return false;

  return Boolean(verifyToken(token, admin.sessionSecret));
}
