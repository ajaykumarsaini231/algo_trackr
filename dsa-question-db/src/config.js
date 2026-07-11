// Central configuration. All tunables in one place.
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");

// A descriptive, honest User-Agent. We only read public problem *metadata*.
export const UA =
  "dsa-question-db/1.0 (+educational metadata collector; contact via repo) Node";

// --- Official endpoints ---
export const LC_ENDPOINT = "https://leetcode.com/graphql";
export const CF_PROBLEMS = "https://codeforces.com/api/problemset.problems";
export const CF_CONTESTS = "https://codeforces.com/api/contest.list";

export const LC_PAGE = 100; // LeetCode GraphQL page size
export const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 250);

// --- Codeforces rating -> normalized difficulty (a documented CONVENTION, not official) ---
// Codeforces problems have a numeric "rating"; there is no official Easy/Medium/Hard.
// These thresholds are our normalization choice so both platforms share one scale.
export const CF_DIFFICULTY_BANDS = [
  { max: 1200, difficulty: "Easy", level: "Beginner" },
  { max: 1600, difficulty: "Medium", level: "Intermediate" },
  { max: 2100, difficulty: "Hard", level: "Advanced" },
  { max: Infinity, difficulty: "Expert", level: "Expert" },
];

// --- MongoDB (import step) ---
export const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
export const MONGODB_DB = process.env.MONGODB_DB || "dsa";
export const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "questions";

// --- Optional Striver full-sheet mirror ---
export const STRIVER_SHEET_URL = process.env.STRIVER_SHEET_URL || "";

// Output files
export const OUT_JSON = path.join(DATA_DIR, "dsa-questions.json");
export const OUT_NDJSON = path.join(DATA_DIR, "dsa-questions.ndjson");
export const OUT_CSV = path.join(DATA_DIR, "dsa-questions.csv");
export const OUT_SAMPLE = path.join(DATA_DIR, "dsa-questions.sample.json");
export const OUT_STATS = path.join(DATA_DIR, "stats.json");
