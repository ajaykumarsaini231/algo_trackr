/**
 * Google interview-prep domain model.
 *
 * Pure constants + types shared by the /api/google aggregation route and the
 * /google dashboard page. The priority, learning order and coverage targets are
 * curated Google-interview knowledge; every COUNT that uses them is still
 * computed live from MongoDB — nothing here hardcodes a quantity.
 */

export type GooglePriority = "Critical" | "High" | "Medium" | "Low";

/** How much each dashboard topic matters for a Google SWE loop. */
export const GOOGLE_PRIORITY: Record<string, GooglePriority> = {
  "Dynamic Programming": "Critical",
  Graph: "Critical",
  Trees: "Critical",
  Arrays: "Critical",
  Strings: "High",
  "Binary Search": "High",
  Heap: "High",
  Recursion: "High",
  Greedy: "High",
  Stack: "Medium",
  Queue: "Medium",
  "Linked List": "Medium",
  "Bit Manipulation": "Medium",
  Mathematics: "Medium",
  "Number Theory": "Low",
  Geometry: "Low",
  Miscellaneous: "Low",
};

export const PRIORITY_WEIGHT: Record<GooglePriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export const PRIORITY_RANK: Record<GooglePriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

/** Beginner -> Advanced study order over the dashboard's 17 topics. */
export const PREP_ORDER: string[] = [
  "Arrays", "Strings", "Linked List", "Stack", "Queue", "Binary Search",
  "Recursion", "Trees", "Heap", "Graph", "Dynamic Programming", "Greedy",
  "Bit Manipulation", "Mathematics", "Number Theory", "Geometry", "Miscellaneous",
];

/** Problems we'd want available per topic to call the bank's coverage "complete". */
export const COVERAGE_TARGET: Record<string, number> = {
  "Dynamic Programming": 120, Graph: 100, Trees: 90, Arrays: 120, Strings: 70,
  "Binary Search": 50, Heap: 40, Recursion: 50, Greedy: 60, Stack: 30, Queue: 20,
  "Linked List": 30, "Bit Manipulation": 25, Mathematics: 40, "Number Theory": 20,
  Geometry: 15, Miscellaneous: 40,
};

export const GOOGLE_TIERS = [
  "Foundation", "Intermediate", "Interview Ready", "Google Hard", "Research Level",
] as const;
export type GoogleTier = (typeof GOOGLE_TIERS)[number];

export function priorityBadge(p: GooglePriority): "destructive" | "warning" | "info" | "muted" {
  return p === "Critical" ? "destructive" : p === "High" ? "warning" : p === "Medium" ? "info" : "muted";
}

// ---- API payload shapes ----
export interface GoogleTopicRow {
  topic: string;
  priority: GooglePriority;
  orderIndex: number;
  total: number;
  easy: number;
  medium: number;
  hard: number;
  leetcode: number;
  codeforces: number;
  striver: number;
  expertOrigin: number;
  solved: number;
  remaining: number;
  completionPct: number;
  coverageTarget: number;
  coveragePct: number;
}

export interface GoogleRecommendation {
  title: string;
  topic: string;
  difficulty: string;
  platform: string;
  problemLink: string;
}

export interface GoogleRoadmap {
  generatedAt: string;
  total: number;
  progress: {
    solved: number;
    attempted: number;
    favorite: number;
    revision: number;
    solvedPct: number;
    favoritePct: number;
    revisionPct: number;
  };
  byDifficulty: { key: string; total: number; solved: number }[];
  byPlatform: { key: string; total: number; solved: number }[];
  topics: GoogleTopicRow[];
  tiers: { label: GoogleTier; count: number }[];
  companyOverlap: { company: string; total: number }[];
  weakTopics: { topic: string; priority: GooglePriority; completionPct: number; remaining: number }[];
  strongTopics: { topic: string; priority: GooglePriority; completionPct: number; solved: number }[];
  recommendations: {
    today: GoogleRecommendation[];
    weekly: GoogleRecommendation[];
    googleHard: GoogleRecommendation[];
  };
  readiness: { coverageScore: number; progressScore: number; overall: number };
  schemaGaps: string[];
}
