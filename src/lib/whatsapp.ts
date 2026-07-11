import "server-only";
import { whatsappConfig } from "@/lib/env";

/**
 * Meta WhatsApp Cloud API client — template sends only.
 *
 * Credentials come exclusively from the environment (never hardcoded, never
 * logged, never returned to callers). The approved template (verified via
 * GET /{waba}/message_templates — parameter_format POSITIONAL, 5 params):
 *
 *   task_due_reminder (en)
 *   ┌────────────────────────────────────────────┐
 *   │ Hello {{1}},                               │
 *   │ Reminder: Your task is {{2}}.              │
 *   │ Task: {{3}}                                │
 *   │ Due Date: {{4}}                            │
 *   │ Priority: {{5}}                            │
 *   │ Please complete it as soon as possible.    │
 *   │ Reply "done" once completed.               │
 *   └────────────────────────────────────────────┘
 *
 * Meta rejects sends whose parameter count differs from the approved body
 * (error 132000), so the study-goal data maps onto exactly those slots:
 *   {{1}} user name                {{2}} "due today"-style status
 *   {{3}} goal summary w/ minutes  {{4}} today's date (user tz)
 *   {{5}} remaining time
 */
export const REMINDER_TEMPLATE_NAME = "task_due_reminder";

const SEND_TIMEOUT_MS = 15_000;

export type WhatsAppErrorType =
  | "auth" // expired/invalid access token
  | "invalid_number" // unreachable / malformed / not-opted-in recipient
  | "template" // template name/params/quality problems
  | "rate_limit" // throughput or spam limits
  | "network" // timeout / connection failure
  | "unknown";

export interface SendResult {
  ok: boolean;
  messageId?: string;
  errorType?: WhatsAppErrorType;
  errorCode?: string;
  errorMessage?: string;
  /** Truncated raw response body for the history log (no secrets). */
  raw?: unknown;
}

export interface ReminderParams {
  name: string;
  statusText: string; // {{2}} e.g. "due today"
  goalText: string; // {{3}} e.g. "Daily study goal 60 min (35 min done)"
  dateText: string; // {{4}} e.g. "12 Jul 2026"
  remainingText: string; // {{5}} e.g. "25 min remaining"
}

export function whatsappConfigured(): boolean {
  return whatsappConfig() !== null;
}

/** Map a Graph API error payload to a coarse, actionable class. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function classify(status: number, err: any): { type: WhatsAppErrorType; code: string; message: string } {
  const code = Number(err?.code ?? 0);
  const sub = Number(err?.error_subcode ?? 0);
  const message: string = err?.message || `HTTP ${status}`;
  const codeStr = sub ? `${code}/${sub}` : String(code || status);

  if (status === 401 || code === 190) return { type: "auth", code: codeStr, message };
  if (code === 131026 || code === 131030 || code === 131021 || code === 131052) {
    // undeliverable / recipient not in allowed list (sandbox) / invalid recipient
    return { type: "invalid_number", code: codeStr, message };
  }
  if (code >= 132000 && code <= 132999) return { type: "template", code: codeStr, message };
  if (code === 80007 || code === 130429 || code === 131048 || code === 131056 || status === 429) {
    return { type: "rate_limit", code: codeStr, message };
  }
  if (code === 100 && /parameter|phone|recipient/i.test(message)) {
    return { type: "invalid_number", code: codeStr, message };
  }
  return { type: "unknown", code: codeStr, message };
}

/** Trim a raw API response so history documents stay small. */
function truncate(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    return s.length > 2000 ? JSON.parse(s.slice(0, 2000) + '"') : value;
  } catch {
    return null;
  }
}

/**
 * Send the approved `task_due_reminder` template to an E.164 recipient.
 * Never throws — every failure comes back as a classified SendResult.
 */
export async function sendReminderTemplate(
  toE164: string,
  params: ReminderParams,
): Promise<SendResult> {
  const config = whatsappConfig();
  if (!config) {
    return {
      ok: false,
      errorType: "unknown",
      errorCode: "not_configured",
      errorMessage: "WhatsApp credentials are not configured.",
    };
  }

  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const text = (v: string) => ({ type: "text" as const, text: v.slice(0, 120) });
  const body = {
    messaging_product: "whatsapp",
    to: toE164,
    type: "template",
    template: {
      name: REMINDER_TEMPLATE_NAME,
      language: { code: config.templateLang },
      components: [
        {
          type: "body",
          parameters: [
            text(params.name || "there"),
            text(params.statusText),
            text(params.goalText),
            text(params.dateText),
            text(params.remainingText),
          ],
        },
      ],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json().catch(() => null);

    if (res.ok && json?.messages?.[0]?.id) {
      return { ok: true, messageId: json.messages[0].id as string, raw: truncate(json) };
    }

    const cls = classify(res.status, json?.error ?? {});
    return {
      ok: false,
      errorType: cls.type,
      errorCode: cls.code,
      errorMessage: cls.message.slice(0, 500),
      raw: truncate(json),
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      errorType: "network",
      errorCode: aborted ? "timeout" : "fetch_failed",
      errorMessage: aborted
        ? `No response within ${SEND_TIMEOUT_MS / 1000}s`
        : (err as Error).message.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}
