import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Edge middleware — the outer security layer in front of every page and API:
 *
 *  1. Global per-IP rate limiting (Upstash when configured) — blunts scraping,
 *     mass automated fetching and simple DoS floods before any work happens.
 *  2. Request body size caps (413) so oversized payloads die at the edge.
 *  3. Cross-origin write rejection (CSRF hardening on top of SameSite=Lax
 *     cookies): browser-issued mutations must be same-origin.
 *  4. Authentication gate: pages redirect to /signin, APIs get a JSON 401.
 *
 * Auth checks use the edge-safe config (JWT verification only — no DB).
 */
const { auth } = NextAuth(authConfig);

/** Auth pages: reachable without a session; signed-in users get bounced to the app. */
const AUTH_PAGES = new Set(["/signin", "/signup"]);

/**
 * Public content pages (crawlable, no session required). PRIVATE-BY-DEFAULT:
 * anything NOT listed here still requires auth, so app/detail pages never leak.
 * Exact-match only — e.g. "/topics" is public but "/topics/[slug]" stays gated
 * until its public server-rendered version ships.
 */
const PUBLIC_PAGES = new Set([
  ...AUTH_PAGES,
  "/",
  "/about",
  "/contact",
  "/roadmaps",
  "/topics",
  "/patterns",
  "/companies",
  // NOTE: /sheets and /algorithm-patterns render entirely from auth-gated data,
  // so they are intentionally NOT public — logged-out visitors are redirected to
  // /signin (with a callbackUrl back) instead of seeing a data-load error.
]);
// /api/reminders/run authenticates itself with the cron Bearer secret
// (GitHub Actions has no session cookie); the handler rejects everything else.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/reminders/run"];

/** Request body caps by path (bytes). */
const DEFAULT_MAX_BODY = 1 * 1024 * 1024; // 1 MB
const IMPORT_MAX_BODY = 8 * 1024 * 1024; // 8 MB for admin bulk import

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default auth(async (req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // Static asset files in /public (resume, images, fonts…) are always public —
  // never gate a file download behind the auth redirect.
  if (
    /\.(pdf|png|jpe?g|gif|webp|avif|svg|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|mp4|webm|css|js|map)$/i.test(
      path,
    )
  ) {
    return NextResponse.next();
  }

  // Public static + SEO/crawler files (sitemap, robots, manifest, OG image,
  // site-verification) must bypass auth AND rate limiting so search engines and
  // social scrapers — which carry no session — can fetch them.
  if (
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/sitemap/") ||
    path === "/manifest.webmanifest" ||
    path.startsWith("/opengraph-image") ||
    path.startsWith("/twitter-image") ||
    path === "/favicon.ico" ||
    path === "/google4cfb0a6190ab2db2.html"
  ) {
    return NextResponse.next();
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // 1. Global backstop rate limit per IP.
  const rl = await checkRateLimit("global", ip);
  if (!rl.ok) {
    return isApi
      ? NextResponse.json(
          { success: false, error: "Too many requests. Please slow down." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
        )
      : new NextResponse("Too many requests", {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        });
  }

  // 2. Request size limits (Content-Length is set by browsers/fetch; chunked
  // bodies without it are further capped inside the heavy routes).
  if (MUTATING.has(req.method)) {
    const len = Number(req.headers.get("content-length") || 0);
    const cap = path === "/api/import" ? IMPORT_MAX_BODY : DEFAULT_MAX_BODY;
    if (len > cap) {
      return NextResponse.json(
        { success: false, error: "Request body too large." },
        { status: 413 },
      );
    }

    // 3. Same-origin enforcement for browser-issued writes (defense in depth
    // on top of SameSite=Lax httpOnly cookies). Non-browser clients without
    // Origin/Sec-Fetch-Site are allowed — they cannot ride a victim's cookie.
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return NextResponse.json(
        { success: false, error: "Cross-origin request rejected." },
        { status: 403 },
      );
    }
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== nextUrl.host) {
          return NextResponse.json(
            { success: false, error: "Cross-origin request rejected." },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: "Cross-origin request rejected." },
          { status: 403 },
        );
      }
    }
  }

  // 4. Authentication gate.
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => path.startsWith(p));
  const isPublicPage = PUBLIC_PAGES.has(path);
  const isAuthPage = AUTH_PAGES.has(path);
  const signedIn = Boolean(req.auth?.user);

  if (isApi && !isPublicApi && !signedIn) {
    return NextResponse.json(
      { success: false, error: "Sign in required" },
      { status: 401 },
    );
  }

  if (!isApi && !isPublicPage && !signedIn) {
    const url = new URL("/signin", nextUrl);
    const callback = path + nextUrl.search;
    if (callback && callback !== "/") url.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(url);
  }

  // Signed-in users landing on the auth pages go to their dashboard.
  if (!isApi && isAuthPage && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg|favicon\\.ico|logo\\.svg|robots\\.txt).*)"],
};
