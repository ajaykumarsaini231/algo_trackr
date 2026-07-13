import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api-response";
import { importSchema, questionCreateSchema, parseOrError } from "@/lib/validations";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { bumpCatalogVersion } from "@/lib/catalog-cache";
import Question from "@/models/Question";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pick the first defined value among candidate keys on a raw row. */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return undefined;
}

/** Normalize a value into a trimmed string array (accepts arrays or CSV). */
function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/** Map a loosely-typed import row onto the create-schema shape. */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const title = pick(row, "title", "Title");
  if (title !== undefined) out.title = title;

  const link = pick(row, "problemLink", "link", "url", "Link", "URL");
  if (link !== undefined) out.problemLink = link;

  const platform = pick(row, "platform", "Platform");
  if (platform !== undefined) out.platform = platform;

  const difficulty = pick(row, "difficulty", "Difficulty");
  if (difficulty !== undefined) out.difficulty = difficulty;

  const topic = pick(row, "topic", "Topic");
  if (topic !== undefined) out.topic = topic;

  const subtopic = pick(row, "subtopic", "Subtopic");
  if (subtopic !== undefined) out.subtopic = subtopic;

  const pattern = pick(row, "pattern", "Pattern");
  if (pattern !== undefined) out.pattern = pattern;

  const companies = pick(row, "companies", "Companies", "company");
  if (companies !== undefined) out.companies = toArray(companies);

  const tags = pick(row, "tags", "Tags", "tag");
  if (tags !== undefined) out.tags = toArray(tags);

  const status = pick(row, "status", "Status");
  if (status !== undefined) out.status = status;

  const notes = pick(row, "notes", "Notes");
  if (notes !== undefined) out.notes = notes;

  const time = pick(row, "timeComplexity", "time", "Time");
  if (time !== undefined) out.timeComplexity = time;

  const space = pick(row, "spaceComplexity", "space", "Space");
  if (space !== undefined) out.spaceComplexity = space;

  const rating = pick(row, "rating", "Rating");
  if (rating !== undefined) out.rating = rating;

  const estimatedTime = pick(row, "estimatedTime", "estimated_time");
  if (estimatedTime !== undefined) out.estimatedTime = estimatedTime;

  // Pass through any remaining known optional fields verbatim.
  const passthrough = [
    "concept",
    "approach",
    "solutionLink",
    "videoLink",
    "editorialLink",
    "revisionNotes",
    "favorite",
    "revisionNeeded",
    "interviewLevel",
    "attemptCount",
  ];
  for (const key of passthrough) {
    if (row[key] !== undefined) out[key] = row[key];
  }

  return out;
}

/**
 * POST /api/import
 * Bulk import questions. Admin only. Never deletes.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const rl = await checkRateLimit("heavy", admin.actorId);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrError(importSchema, body);
    if (!parsed.success) return fail(parsed.error, 422);

    const { mode, questions } = parsed.data;

    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validRows: any[] = [];
    let skipped = 0;

    for (const raw of questions) {
      const normalized = normalizeRow(raw as Record<string, unknown>);
      const result = questionCreateSchema.safeParse(normalized);
      if (result.success) {
        validRows.push(result.data);
      } else {
        skipped += 1;
      }
    }

    let inserted = 0;
    let updated = 0;

    if (mode === "append") {
      if (validRows.length) {
        await Question.insertMany(validRows);
      }
      inserted = validRows.length;
    } else {
      // upsert: match by problemLink when present, else title + platform.
      for (const row of validRows) {
        const linkKey = String(row.problemLink ?? "").trim();
        const filter = linkKey
          ? { problemLink: linkKey }
          : { title: row.title, platform: row.platform };

        const existing = await Question.findOne(filter);
        if (existing) {
          Object.assign(existing, row);
          await existing.save();
          updated += 1;
        } else {
          await new Question(row).save();
          inserted += 1;
        }
      }
    }

    if (inserted > 0 || updated > 0) bumpCatalogVersion();
    void logAudit({
      action: "admin.import",
      userId: admin.user?.id ?? null,
      meta: { mode, inserted, updated, skipped },
    });
    return ok({ inserted, updated, skipped });
  });
}
