import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { DIFFICULTIES, PLATFORMS, STATUSES } from "@/types";

/**
 * The primary collection. Every DSA problem is one document here.
 *
 * Design rules (per product spec):
 *  - Records are NEVER deleted. `archived` hides them instead.
 *  - Updates modify only the targeted document; creation appends.
 *  - `timestamps` provides immutable `createdAt` + auto `updatedAt`.
 */
const QuestionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    problemLink: { type: String, default: "", trim: true },
    platform: { type: String, enum: PLATFORMS, default: "LeetCode" },
    difficulty: { type: String, enum: DIFFICULTIES, default: "Medium", index: true },
    topic: { type: String, required: true, trim: true, index: true },
    subtopic: { type: String, default: "", trim: true },
    pattern: { type: String, default: "", trim: true, index: true },
    companies: { type: [String], default: [], index: true },
    concept: { type: String, default: "" },
    approach: { type: String, default: "" },
    timeComplexity: { type: String, default: "", trim: true },
    spaceComplexity: { type: String, default: "", trim: true },
    solutionLink: { type: String, default: "", trim: true },
    videoLink: { type: String, default: "", trim: true },
    editorialLink: { type: String, default: "", trim: true },
    notes: { type: String, default: "" },
    revisionNotes: { type: String, default: "" },
    status: { type: String, enum: STATUSES, default: "Not Started", index: true },
    favorite: { type: Boolean, default: false, index: true },
    revisionNeeded: { type: Boolean, default: false, index: true },
    lastRevisedAt: { type: Date, default: null },
    revisionDate: { type: Date, default: null },
    attemptCount: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    interviewLevel: { type: String, default: "" },
    estimatedTime: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    archived: { type: Boolean, default: false, index: true },
    solvedAt: { type: Date, default: null },

    // --- Pattern ecosystem (additive extension) ---
    // A question may belong to MANY algorithmic patterns. `patterns` holds slugs
    // from src/lib/patterns.ts. `patternManual` protects hand-curated patterns
    // from the auto-classifier.
    patterns: { type: [String], default: [], index: true },
    patternConfidence: { type: Number, default: 0, min: 0, max: 1 },
    patternMethod: { type: String, default: "" },
    patternManual: { type: Boolean, default: false, index: true },

    // --- Learning ranking (additive; DERIVED, safe to recompute; never user data) ---
    // Ordering signals for the progressive-unlock learning flow. Populated by
    // roadmap-tools/rank-learning.mjs; recomputed idempotently, never overwrites
    // status/notes/favorite/etc.
    learningScore: { type: Number, default: 0, index: true },
    difficultyRank: { type: Number, default: 2, index: true },
    estimatedSolveTime: { type: Number, default: 30 },
  },
  { timestamps: true, collection: "questions" },
);

// Full-text index powering the global search.
QuestionSchema.index({
  title: "text",
  concept: "text",
  approach: "text",
  notes: "text",
  tags: "text",
});

// Compound index for the most common list query (topic + subtopic, not archived).
QuestionSchema.index({ archived: 1, topic: 1, subtopic: 1 });

// Pattern-based queries (multikey over patterns[]).
QuestionSchema.index({ archived: 1, patterns: 1 });

// Staged learning: ordered questions per topic (progressive-unlock flow).
QuestionSchema.index({ archived: 1, topic: 1, difficultyRank: 1, learningScore: -1 });

// Default list ordering. The questions list defaults to createdAt:desc and
// also offers updatedAt:desc; without these the sort was a full in-memory sort
// of the whole active catalog (all 15k docs examined to return one page of 20).
// The trailing `_id: 1` matches the route's tiebreaker (`sort({ field, _id: 1 })`)
// so the sort is fully index-covered — a page examines ~limit keys, not 15k.
QuestionSchema.index({ archived: 1, createdAt: -1, _id: 1 });
QuestionSchema.index({ archived: 1, updatedAt: -1, _id: 1 });
// Topic-scoped list ordered by recency (topic pages default to createdAt:desc).
QuestionSchema.index({ archived: 1, topic: 1, createdAt: -1, _id: 1 });

/**
 * Keep derived fields consistent without ever destroying data:
 *  - stamp `solvedAt` the first time a question becomes Solved
 *  - keep `revisionNeeded` in sync with revision statuses
 */
QuestionSchema.pre("save", function (next) {
  if (this.status === "Solved" && !this.solvedAt) {
    this.solvedAt = new Date();
  }
  if (this.status === "Need Revision" || this.status === "Revisit") {
    this.revisionNeeded = true;
  }
  next();
});

export type QuestionDoc = InferSchemaType<typeof QuestionSchema>;

export const Question: Model<QuestionDoc> =
  (models.Question as Model<QuestionDoc>) || model<QuestionDoc>("Question", QuestionSchema);

export default Question;
