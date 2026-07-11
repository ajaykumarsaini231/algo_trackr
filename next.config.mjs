/** @type {import('next').NextConfig} */

// Security headers applied to every response. Values chosen to harden without
// changing app behavior: the app makes only same-origin API calls (SWR) and
// uses no next/image remote loader, so these are safe.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // clickjacking
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js hydration + framer-motion need inline/eval; tighten with nonces later.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose", "bcryptjs"],
  poweredByHeader: false, // hide X-Powered-By
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
