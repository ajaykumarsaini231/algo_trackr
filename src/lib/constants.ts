import { slugify } from "@/lib/utils";
import {
  DIFFICULTIES,
  INTERVIEW_LEVELS,
  PLATFORMS,
  STATUSES,
  type Difficulty,
  type Status,
  type TopicNode,
} from "@/types";

export { DIFFICULTIES, INTERVIEW_LEVELS, PLATFORMS, STATUSES };

/**
 * The complete DSA topic taxonomy. Each topic has an icon key (resolved to a
 * Lucide icon in `components/shared/topic-icon.tsx`) and a list of subtopics.
 * Extending this array is the ONLY change required to add a new topic — pages,
 * filters and the sidebar all derive from it.
 */
const RAW_TOPICS: Omit<TopicNode, "slug">[] = [
  {
    name: "Arrays",
    icon: "Brackets",
    description: "Contiguous memory, indexing, and the workhorse of DSA.",
    subtopics: [
      "Basic Arrays",
      "Prefix Sum",
      "Suffix Sum",
      "Kadane",
      "Sliding Window",
      "Two Pointers",
      "Binary Search on Arrays",
      "Sorting",
      "Searching",
      "Merge Intervals",
      "Matrix",
      "Simulation",
    ],
  },
  {
    name: "Strings",
    icon: "Type",
    description: "Pattern matching, hashing, and string algorithms.",
    subtopics: [
      "Pattern Matching",
      "KMP",
      "Z Algorithm",
      "Rolling Hash",
      "Palindrome",
      "Trie",
      "String Manipulation",
    ],
  },
  {
    name: "Linked List",
    icon: "Link2",
    description: "Pointer manipulation and node-based structures.",
    subtopics: [
      "Singly",
      "Doubly",
      "Circular",
      "Fast Slow Pointer",
      "Merge Lists",
      "Reverse",
      "Cycle Detection",
    ],
  },
  {
    name: "Stack",
    icon: "Layers",
    description: "LIFO structures and monotonic techniques.",
    subtopics: [
      "Basic Stack",
      "Monotonic Stack",
      "Expression Evaluation",
      "Min Stack",
      "Next Greater Element",
    ],
  },
  {
    name: "Queue",
    icon: "ArrowRightLeft",
    description: "FIFO structures, deques, and priority queues.",
    subtopics: ["Normal Queue", "Deque", "Priority Queue", "Circular Queue"],
  },
  {
    name: "Trees",
    icon: "ListTree",
    description: "Hierarchical structures and traversals.",
    subtopics: [
      "Binary Tree",
      "BST",
      "AVL",
      "Segment Tree",
      "Fenwick Tree",
      "Tree Traversal",
      "LCA",
      "Diameter",
      "DFS",
      "BFS",
    ],
  },
  {
    name: "Graph",
    icon: "Waypoints",
    description: "Nodes, edges, traversals, and shortest paths.",
    subtopics: [
      "DFS",
      "BFS",
      "Topological Sort",
      "Dijkstra",
      "Bellman Ford",
      "Floyd Warshall",
      "Prim",
      "Kruskal",
      "DSU",
      "Bridges",
      "Articulation Point",
      "Strongly Connected Components",
      "Shortest Path",
    ],
  },
  {
    name: "Dynamic Programming",
    icon: "Grid3x3",
    description: "Overlapping subproblems and optimal substructure.",
    subtopics: [
      "0/1 Knapsack",
      "LCS",
      "LIS",
      "Matrix DP",
      "Digit DP",
      "Bitmask DP",
      "Tree DP",
      "Interval DP",
      "Game DP",
      "Memoization",
      "Tabulation",
    ],
  },
  {
    name: "Greedy",
    icon: "Coins",
    description: "Locally optimal choices that build global solutions.",
    subtopics: ["Scheduling", "Intervals", "Huffman", "Greedy Choice"],
  },
  {
    name: "Binary Search",
    icon: "Binary",
    description: "Logarithmic search over sorted spaces and answers.",
    subtopics: [
      "Normal",
      "Answer Search",
      "Peak Element",
      "Rotated Arrays",
      "Binary Search on Answer",
    ],
  },
  {
    name: "Recursion",
    icon: "Repeat",
    description: "Self-referential problem solving and backtracking.",
    subtopics: [
      "Backtracking",
      "N Queens",
      "Sudoku",
      "Subset",
      "Permutation",
      "Combination",
    ],
  },
  {
    name: "Heap",
    icon: "Pyramid",
    description: "Priority-based structures for top-K and streaming.",
    subtopics: ["Min Heap", "Max Heap", "Top K", "Median", "Priority Queue"],
  },
  {
    name: "Bit Manipulation",
    icon: "Cpu",
    description: "Bitwise operations and masks.",
    subtopics: ["XOR", "Bitmask", "Power of Two", "Subset Generation"],
  },
  {
    name: "Mathematics",
    icon: "Calculator",
    description: "Number sense, primes, and combinatorics.",
    subtopics: ["Prime", "GCD", "LCM", "Modular Arithmetic", "Sieve", "Combinatorics"],
  },
  {
    name: "Number Theory",
    icon: "Sigma",
    description: "Advanced number theory results.",
    subtopics: ["Euler Totient", "Chinese Remainder", "Extended Euclid"],
  },
  {
    name: "Geometry",
    icon: "Shapes",
    description: "Computational geometry primitives.",
    subtopics: ["Convex Hull", "Orientation", "Line Sweep"],
  },
  {
    name: "Miscellaneous",
    icon: "Boxes",
    description: "Randomized, design, and implementation-heavy problems.",
    subtopics: ["Randomized", "Hashing", "Design Problems", "Implementation"],
  },
];

export const TOPICS: TopicNode[] = RAW_TOPICS.map((t) => ({
  ...t,
  slug: slugify(t.name),
}));

export const TOPIC_NAMES = TOPICS.map((t) => t.name);

export function getTopicBySlug(slug: string): TopicNode | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

export function getSubtopics(topicName: string): string[] {
  return TOPICS.find((t) => t.name === topicName)?.subtopics ?? [];
}

/**
 * Companies shown on the dashboard. Ordered roughly by the number of real
 * interview questions mapped from the public datasets (see
 * roadmap-tools/fetch-company-map.mjs), most-covered first. "Others" is the
 * catch-all and stays last.
 */
export const COMPANIES = [
  "Google",
  "Amazon",
  "Bloomberg",
  "Meta",
  "Microsoft",
  "Uber",
  "Apple",
  "Oracle",
  "TikTok",
  "Adobe",
  "Goldman Sachs",
  "Salesforce",
  "Visa",
  "LinkedIn",
  "ByteDance",
  "Walmart",
  "Nvidia",
  "PayPal",
  "Snap",
  "Cisco",
  "Flipkart",
  "VMware",
  "DE Shaw",
  "Atlassian",
  "Expedia",
  "DoorDash",
  "ServiceNow",
  "Intuit",
  "Pinterest",
  "Airbnb",
  "Samsung",
  "Qualcomm",
  "Tesla",
  "Databricks",
  "Media.net",
  "Sprinklr",
  "Netflix",
  "Intel",
  "Spotify",
  "Twilio",
  "OpenAI",
  "Booking",
  "Stripe",
  "Cloudflare",
  "Directi",
  "Palantir",
  "Others",
] as const;
export type Company = (typeof COMPANIES)[number];

/** Interview patterns, used for grouping and filtering. */
export const PATTERNS = [
  { name: "Sliding Window", icon: "MoveHorizontal" },
  { name: "Two Pointer", icon: "ArrowLeftRight" },
  { name: "Greedy", icon: "Coins" },
  { name: "DP", icon: "Grid3x3" },
  { name: "Graph", icon: "Waypoints" },
  { name: "DFS", icon: "GitBranch" },
  { name: "BFS", icon: "Network" },
  { name: "Trie", icon: "Type" },
  { name: "Binary Search", icon: "Binary" },
  { name: "Monotonic Stack", icon: "Layers" },
  { name: "Backtracking", icon: "Undo2" },
  { name: "Heap", icon: "Pyramid" },
  { name: "Hashing", icon: "Hash" },
  { name: "Tree", icon: "ListTree" },
  { name: "Recursion", icon: "Repeat" },
  { name: "Bitmask", icon: "Cpu" },
  { name: "Math", icon: "Calculator" },
] as const;
export const PATTERN_NAMES = PATTERNS.map((p) => p.name);

export function getPatternBySlug(slug: string) {
  return PATTERNS.find((p) => slugify(p.name) === slug);
}
export function getCompanyBySlug(slug: string): Company | undefined {
  return COMPANIES.find((c) => slugify(c) === slug);
}

/** Badge style classes per difficulty. */
export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  Hard: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25",
};

export const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Easy: "bg-emerald-500",
  Medium: "bg-amber-500",
  Hard: "bg-rose-500",
};

/** Badge style classes per status. */
export const STATUS_STYLES: Record<Status, string> = {
  "Not Started": "bg-muted text-muted-foreground border-border",
  Attempted: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  Solved:
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  "Need Revision":
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  Revisit: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25",
  Skipped: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/25",
};

/** Chart-friendly colors keyed to difficulty. */
export const DIFFICULTY_CHART_COLORS: Record<Difficulty, string> = {
  Easy: "#10b981",
  Medium: "#f59e0b",
  Hard: "#f43f5e",
};

/** A palette for topic / category charts. */
export const CHART_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
  "#eab308",
];

/** Which statuses count a question as "solved". */
export const SOLVED_STATUSES: Status[] = ["Solved"];

/** Which statuses/flags mark a question as needing revision. */
export const REVISION_STATUSES: Status[] = ["Need Revision", "Revisit"];

export const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "title:asc", label: "Title (A–Z)" },
  { value: "title:desc", label: "Title (Z–A)" },
  { value: "difficulty:asc", label: "Difficulty (Easy→Hard)" },
  { value: "difficulty:desc", label: "Difficulty (Hard→Easy)" },
  { value: "rating:desc", label: "Highest rated" },
  { value: "attemptCount:desc", label: "Most attempted" },
];

export const APP_NAME = "DSAspire";
export const APP_TAGLINE = "Master DSA, one pattern at a time.";
