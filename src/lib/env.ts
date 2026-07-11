import { z } from "zod";

/**
 * Environment validation — fail fast with a readable message instead of
 * cryptic runtime errors deep inside a request.
 *
 * Validation is lazy (first access) so `next build` succeeds on machines that
 * only compile, while any actual server start / request path validates once.
 */
const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required (mongodb:// or mongodb+srv://)")
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
  /** Secret for Auth.js JWT/cookie signing. Required outside of tests. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (openssl rand -hex 32)"),
  /** Comma-separated emails that receive the admin role on register/login. */
  ADMIN_EMAILS: z.string().optional().default(""),
  /**
   * Comma-separated emails granted the SUPERADMIN role (impersonation, role
   * changes, deletes, progress resets). Wins over ADMIN_EMAILS.
   */
  SUPER_ADMIN_EMAILS: z.string().optional().default(""),
  /** Optional Upstash Redis for durable, cross-instance rate limiting. */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ---- WhatsApp reminders (Meta Cloud API) — optional feature flags ----
  // Both spellings are accepted (WHATSAPP_TOKEN/WHATSAPP_GRAPH_VERSION are
  // what this project's .env already uses; the ACCESS_TOKEN/GRAPH_API_VERSION
  // names are kept for compatibility with the documented setup).
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  GRAPH_API_VERSION: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().optional(),
  WHATSAPP_TEMPLATE_LANG: z.string().optional(),
  /** Bearer token the GitHub Actions scheduler uses for /api/reminders/run. */
  REMINDER_CRON_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated environment. Throws (once) with every problem listed. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  cached = parsed.data;
  return cached;
}

/** Emails (lowercased) that are granted the admin role. */
export function adminEmails(): Set<string> {
  return new Set(
    env()
      .ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Emails (lowercased) granted the superadmin role. */
export function superAdminEmails(): Set<string> {
  return new Set(
    env()
      .SUPER_ADMIN_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Role for an email per the allowlists (superadmin wins). */
export function roleForEmail(email: string): "user" | "admin" | "superadmin" {
  const e = email.toLowerCase();
  if (superAdminEmails().has(e)) return "superadmin";
  if (adminEmails().has(e)) return "admin";
  return "user";
}

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  templateLang: string;
}

/** Meta Cloud API credentials, or null when the feature isn't configured. */
export function whatsappConfig(): WhatsAppConfig | null {
  const e = env();
  const accessToken = e.WHATSAPP_ACCESS_TOKEN || e.WHATSAPP_TOKEN;
  if (!accessToken || !e.WHATSAPP_PHONE_NUMBER_ID) return null;
  return {
    accessToken,
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: e.GRAPH_API_VERSION || e.WHATSAPP_GRAPH_VERSION || "v20.0",
    templateLang: e.WHATSAPP_TEMPLATE_LANG || "en",
  };
}
