import { z } from "zod";
import { DIFFICULTIES, INTERVIEW_LEVELS, PLATFORMS, STATUSES } from "@/types";

const trimmed = (max = 2000) => z.string().trim().max(max);
const url = () =>
  z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), {
      message: "Must be a valid URL starting with http(s)://",
    });

/** Full schema for creating a question. Sensible defaults for every field. */
export const questionCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  problemLink: url().default(""),
  platform: z.enum(PLATFORMS).default("LeetCode"),
  difficulty: z.enum(DIFFICULTIES).default("Medium"),
  topic: z.string().trim().min(1, "Topic is required"),
  subtopic: trimmed(120).default(""),
  pattern: trimmed(120).default(""),
  companies: z.array(z.string().trim()).default([]),
  concept: trimmed(5000).default(""),
  approach: trimmed(10000).default(""),
  timeComplexity: trimmed(120).default(""),
  spaceComplexity: trimmed(120).default(""),
  solutionLink: url().default(""),
  videoLink: url().default(""),
  editorialLink: url().default(""),
  notes: trimmed(20000).default(""),
  revisionNotes: trimmed(20000).default(""),
  status: z.enum(STATUSES).default("Not Started"),
  favorite: z.boolean().default(false),
  revisionNeeded: z.boolean().default(false),
  lastRevisedAt: z.string().datetime().nullable().default(null),
  revisionDate: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null)),
  attemptCount: z.coerce.number().int().min(0).default(0),
  rating: z.coerce.number().int().min(0).max(5).default(0),
  interviewLevel: z.enum(INTERVIEW_LEVELS).or(z.literal("")).default(""),
  estimatedTime: z.coerce.number().int().min(0).max(100000).default(0),
  tags: z.array(z.string().trim()).default([]),
  archived: z.boolean().default(false),
});

/** Partial schema for updates — only provided keys are modified. */
export const questionUpdateSchema = questionCreateSchema.partial();

export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;

/** 8-digit admin key. */
export const passwordSchema = z
  .string()
  .regex(/^\d{8}$/, "Password must be exactly 8 digits");

export const adminSetupSchema = z
  .object({
    password: passwordSchema,
    confirm: passwordSchema,
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const adminLoginSchema = z.object({
  password: passwordSchema,
});

/** Bulk import: an array of loosely-typed rows normalized on the server. */
export const importSchema = z.object({
  mode: z.enum(["append", "upsert"]).default("append"),
  questions: z.array(z.record(z.string(), z.any())).max(5000),
});

/** Safely parse and surface the first error message. */
export function parseOrError<T>(schema: z.ZodType<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const first = result.error.issues[0];
  return {
    success: false,
    error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input",
  };
}
