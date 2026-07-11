/**
 * Core domain types for the DSA Question Tracker.
 *
 * These types are the single source of truth shared between the frontend,
 * the API layer, and the Mongoose models. The literal-union constants live in
 * `src/lib/constants.ts`, and the corresponding value arrays are re-exported
 * there so UI code can iterate over them.
 */

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const STATUSES = [
  "Not Started",
  "Attempted",
  "Solved",
  "Need Revision",
  "Revisit",
  "Skipped",
] as const;
export type Status = (typeof STATUSES)[number];

export const PLATFORMS = [
  "LeetCode",
  "Codeforces",
  "CodeChef",
  "AtCoder",
  "GeeksforGeeks",
  "CSES",
  "InterviewBit",
  "HackerRank",
  "HackerEarth",
  "Coding Ninjas",
  "SPOJ",
  "Others",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const INTERVIEW_LEVELS = [
  "Warmup",
  "Screening",
  "Phone Screen",
  "Onsite",
  "Hard Onsite",
  "FAANG",
] as const;
export type InterviewLevel = (typeof INTERVIEW_LEVELS)[number];

/**
 * A single DSA question / problem record.
 * `_id`, `createdAt`, `updatedAt` are managed by MongoDB/Mongoose.
 */
export interface Question {
  _id: string;
  title: string;
  problemLink: string;
  platform: Platform;
  difficulty: Difficulty;
  topic: string;
  subtopic: string;
  pattern: string;
  companies: string[];
  concept: string;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  solutionLink: string;
  videoLink: string;
  editorialLink: string;
  notes: string;
  revisionNotes: string;
  status: Status;
  favorite: boolean;
  revisionNeeded: boolean;
  lastRevisedAt: string | null;
  revisionDate: string | null;
  attemptCount: number;
  rating: number; // 0 (unrated) .. 5
  interviewLevel: InterviewLevel | "";
  estimatedTime: number; // minutes
  tags: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  solvedAt: string | null;
}

/** Shape used when creating / editing a question through forms and the API. */
export type QuestionInput = Omit<
  Question,
  "_id" | "createdAt" | "updatedAt" | "solvedAt"
> & {
  solvedAt?: string | null;
};

/** Aggregated dashboard / statistics payload. */
export interface Stats {
  total: number;
  solved: number;
  unsolved: number;
  attempted: number;
  revisionNeeded: number;
  favorites: number;
  archived: number;
  completionPercentage: number;
  byDifficulty: Record<Difficulty, number>;
  solvedByDifficulty: Record<Difficulty, number>;
  byStatus: Record<string, number>;
  byTopic: { topic: string; total: number; solved: number }[];
  byCompany: { company: string; total: number; solved: number }[];
  byPattern: { pattern: string; total: number; solved: number }[];
  byPlatform: { platform: string; total: number }[];
  monthlyProgress: { month: string; added: number; solved: number }[];
  heatmap: { date: string; count: number }[];
  recentlyAdded: Question[];
  recentlySolved: Question[];
  revisionDue: number;
}

/** Filters applied to the questions list. All optional. */
export interface QuestionFilters {
  search?: string;
  topic?: string;
  subtopic?: string;
  company?: string;
  platform?: string;
  pattern?: string;
  difficulty?: Difficulty | "";
  status?: Status | "";
  favorite?: boolean;
  revision?: boolean;
  archived?: boolean;
  minRating?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Standard API response envelope. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Admin authentication state returned by the auth endpoint. */
export interface AdminAuthState {
  configured: boolean;
  locked: boolean;
  lockedUntil: string | null;
  attemptsRemaining: number;
}

export interface TopicNode {
  name: string;
  slug: string;
  subtopics: string[];
  icon?: string;
  description?: string;
}
