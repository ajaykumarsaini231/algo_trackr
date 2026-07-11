import type { Question } from "@/types";

/** Convert a possibly-hydrated Mongoose document into a plain object. */
function toPlain(doc: unknown): Record<string, unknown> {
  if (doc && typeof doc === "object" && "toObject" in doc && typeof (doc as { toObject: unknown }).toObject === "function") {
    return (doc as { toObject: () => Record<string, unknown> }).toObject();
  }
  return doc as Record<string, unknown>;
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Normalize a question document to the JSON-safe `Question` shape used by the
 * client: ObjectIds become strings and Dates become ISO strings.
 */
export function serializeQuestion(input: unknown): Question {
  const doc = toPlain(input);
  return {
    _id: String(doc._id),
    title: (doc.title as string) ?? "",
    problemLink: (doc.problemLink as string) ?? "",
    platform: (doc.platform as Question["platform"]) ?? "LeetCode",
    difficulty: (doc.difficulty as Question["difficulty"]) ?? "Medium",
    topic: (doc.topic as string) ?? "",
    subtopic: (doc.subtopic as string) ?? "",
    pattern: (doc.pattern as string) ?? "",
    companies: (doc.companies as string[]) ?? [],
    concept: (doc.concept as string) ?? "",
    approach: (doc.approach as string) ?? "",
    timeComplexity: (doc.timeComplexity as string) ?? "",
    spaceComplexity: (doc.spaceComplexity as string) ?? "",
    solutionLink: (doc.solutionLink as string) ?? "",
    videoLink: (doc.videoLink as string) ?? "",
    editorialLink: (doc.editorialLink as string) ?? "",
    notes: (doc.notes as string) ?? "",
    revisionNotes: (doc.revisionNotes as string) ?? "",
    status: (doc.status as Question["status"]) ?? "Not Started",
    favorite: Boolean(doc.favorite),
    revisionNeeded: Boolean(doc.revisionNeeded),
    lastRevisedAt: isoOrNull(doc.lastRevisedAt),
    revisionDate: isoOrNull(doc.revisionDate),
    attemptCount: Number(doc.attemptCount ?? 0),
    rating: Number(doc.rating ?? 0),
    interviewLevel: (doc.interviewLevel as Question["interviewLevel"]) ?? "",
    estimatedTime: Number(doc.estimatedTime ?? 0),
    tags: (doc.tags as string[]) ?? [],
    archived: Boolean(doc.archived),
    createdAt: isoOrNull(doc.createdAt) ?? new Date(0).toISOString(),
    updatedAt: isoOrNull(doc.updatedAt) ?? new Date(0).toISOString(),
    solvedAt: isoOrNull(doc.solvedAt),
  };
}

export function serializeQuestions(docs: unknown[]): Question[] {
  return docs.map(serializeQuestion);
}
