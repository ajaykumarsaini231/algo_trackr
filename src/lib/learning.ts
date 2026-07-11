/**
 * Core Learning System (Phase 1).
 *
 * A progressive path Foundation → Intermediate → Advanced → Expert with an
 * unlock gate, plus a learning-priority score used to rank the "next best"
 * questions. Stage membership and every count come from MongoDB; the weights
 * here are the only tunables and never encode a quantity.
 */
import { GOOGLE_PRIORITY, PREP_ORDER, type GooglePriority } from "@/lib/google";

export interface StageDef {
  key: string;
  name: string;
  level: string;
  /** Mongo match fragment identifying the stage's questions. */
  match: Record<string, unknown>;
  /** Solved count required in the PREVIOUS stage to unlock this one. */
  unlockThreshold: number;
  icon: string;
  accent: string;
}

// Foundation=Easy, Intermediate=Medium, Advanced=Hard(non-CF-Expert), Expert=CF Expert.
export const LEARNING_STAGES: StageDef[] = [
  { key: "foundation", name: "Foundation", level: "Easy", match: { difficulty: "Easy" }, unlockThreshold: 0, icon: "Circle", accent: "emerald" },
  { key: "intermediate", name: "Intermediate", level: "Medium", match: { difficulty: "Medium" }, unlockThreshold: 15, icon: "SignalMedium", accent: "blue" },
  { key: "advanced", name: "Advanced", level: "Hard", match: { difficulty: "Hard", tags: { $ne: "Origin:Expert" } }, unlockThreshold: 25, icon: "Flame", accent: "amber" },
  { key: "expert", name: "Expert", level: "Expert", match: { tags: "Origin:Expert" }, unlockThreshold: 15, icon: "Trophy", accent: "rose" },
];
export const STAGE_BY_KEY = new Map(LEARNING_STAGES.map((s) => [s.key, s]));

// Learning-priority score weights (higher = surface sooner).
export const SCORE_WEIGHTS = {
  blind75: 50,
  striver: 40,
  leetcode: 15,
  topicPriority: { Critical: 30, High: 20, Medium: 10, Low: 5 } as Record<GooglePriority, number>,
};

/** Topics grouped by Google priority — used to build the $switch scoring branch. */
export function topicsByPriority(p: GooglePriority): string[] {
  return Object.keys(GOOGLE_PRIORITY).filter((t) => GOOGLE_PRIORITY[t] === p);
}

/**
 * JS twin of each stage's Mongo `match` fragment — used to bucket a user's
 * solved questions (joined in memory) into stages without a per-stage query.
 * Must stay in sync with LEARNING_STAGES above.
 */
export function stageMatchesDoc(
  stage: StageDef,
  doc: { difficulty: string; tags: string[] },
): boolean {
  switch (stage.key) {
    case "foundation":
      return doc.difficulty === "Easy";
    case "intermediate":
      return doc.difficulty === "Medium";
    case "advanced":
      return doc.difficulty === "Hard" && !doc.tags.includes("Origin:Expert");
    case "expert":
      return doc.tags.includes("Origin:Expert");
    default:
      return false;
  }
}

export { PREP_ORDER };

// ---- API payload shapes ----
export interface LearningStageStat {
  key: string;
  name: string;
  level: string;
  icon: string;
  accent: string;
  total: number;
  solved: number;
  remaining: number;
  completionPct: number;
  unlocked: boolean;
  unlockThreshold: number;
  prevStageSolved: number;
}

export interface RankedQuestion {
  id: string;
  title: string;
  platform: string;
  difficulty: string;
  topic: string;
  problemLink: string;
  status: string;
  favorite: boolean;
  patterns: string[];
  score: number;
}

export interface RoadmapItem {
  key: string;
  name: string;
  priority?: GooglePriority;
  total: number;
  solved: number;
  completionPct: number;
  status: "done" | "current" | "todo";
}

// ---- Progressive-unlock staging (per topic / pattern / company) ----
export const STAGE_SIZE = 5;
export const UNLOCK_THRESHOLD = 0.8; // a stage unlocks when the previous is >= 80% solved
export const RANK_LABEL = ["Very Easy", "Easy", "Medium", "Hard", "Expert"];

export interface StageQuestion {
  id: string;
  title: string;
  platform: string;
  difficulty: string;
  difficultyRank: number;
  topic: string;
  problemLink: string;
  status: string;
  favorite: boolean;
  patterns: string[];
  estimatedSolveTime: number;
}

export interface TopicStage {
  index: number;
  label: string;
  band: string;
  total: number;
  solved: number;
  completionPct: number;
  unlocked: boolean;
  completed: boolean;
  questions: StageQuestion[]; // populated only for unlocked, revealed stages
}

export interface TopicLearning {
  topic: string;
  slug: string;
  total: number;
  solved: number;
  remaining: number;
  completionPct: number;
  completed: boolean;
  estimatedTimeRemaining: number;
  totalStages: number;
  revealedStages: number;
  currentStage: number;
  currentLevel: string;
  canLoadMore: boolean;
  continueQuestionId: string | null;
  stages: TopicStage[];
  recommendations: { nextTopic: string | null; relatedSheet: string };
}

export interface TopicLearningAll {
  mode: "all";
  topic: string;
  slug: string;
  total: number;
  solved: number;
  questions: StageQuestion[];
  page: number;
  limit: number;
  totalPages: number;
}

export interface LearnOverview {
  generatedAt: string;
  totalSolved: number;
  currentStage: string;
  stages: LearningStageStat[];
  continueLearning: { stage: string; items: RankedQuestion[]; total: number; skip: number; limit: number };
  mixedChallenge: RankedQuestion[];
  topicRoadmap: RoadmapItem[];
  patternRoadmap: RoadmapItem[];
}
