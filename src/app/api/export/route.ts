import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle } from "@/lib/api-response";
import { serializeQuestions } from "@/lib/serialize";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import Question from "@/models/Question";
import type { Question as QuestionType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV columns, in order. */
const CSV_COLUMNS: (keyof QuestionType)[] = [
  "title",
  "problemLink",
  "platform",
  "difficulty",
  "topic",
  "subtopic",
  "pattern",
  "companies",
  "status",
  "favorite",
  "rating",
  "timeComplexity",
  "spaceComplexity",
  "estimatedTime",
  "tags",
  "notes",
];

/** Escape a single CSV cell. */
function csvCell(value: unknown): string {
  let str: string;
  if (Array.isArray(value)) str = value.join(";");
  else if (value === null || value === undefined) str = "";
  else str = String(value);

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/export
 * Download questions as a raw JSON or CSV file (NOT the API envelope). Admin only.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const rl = await checkRateLimit("heavy", admin.actorId);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
    void logAudit({ action: "admin.export", userId: admin.user?.id ?? null });

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const format = (sp.get("format") || "json").toLowerCase();
    const includeArchived = sp.get("all") === "true";

    const query = includeArchived ? {} : { archived: false };
    const docs = await Question.find(query).sort({ createdAt: -1 }).lean();
    const items = serializeQuestions(docs);

    if (format === "csv") {
      const header = CSV_COLUMNS.join(",");
      const rows = items.map((item) =>
        CSV_COLUMNS.map((col) => csvCell(item[col])).join(","),
      );
      const csv = [header, ...rows].join("\r\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="dsa-questions.csv"',
        },
      });
    }

    return new NextResponse(JSON.stringify(items, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="dsa-questions.json"',
      },
    });
  });
}
