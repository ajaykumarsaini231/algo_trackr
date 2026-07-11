import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth-helpers";

/** Success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data }, init);
}

/** Error envelope with an HTTP status code. */
export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/** Wrap a route handler so thrown errors become clean JSON error responses. */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    // Guard helpers (requireUser/requireAdmin) and routes throw HttpError for
    // expected auth/validation failures — pass the status through verbatim.
    if (err instanceof HttpError) {
      return fail(err.message, err.status);
    }

    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    // eslint-disable-next-line no-console
    console.error("[api] error:", err);
    const isConfig = message.includes("MONGODB_URI") || message.includes("AUTH_SECRET");
    // Never leak internal error details (driver/stack messages) to clients in
    // production — they are logged server-side above. Dev keeps the detail.
    const isProd = process.env.NODE_ENV === "production";
    const clientMessage = isConfig
      ? "Server is not configured. Check required environment variables."
      : isProd
        ? "Internal server error."
        : message;
    return fail(clientMessage, isConfig ? 503 : 500);
  }
}
