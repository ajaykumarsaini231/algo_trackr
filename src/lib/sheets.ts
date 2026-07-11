/**
 * Curated & dynamic interview "sheets" (Phase 8).
 *
 * - Curated sheets (e.g. Blind 75) are fixed public lists of LeetCode problems,
 *   matched against the DB by exact problemLink — any slug that doesn't match a
 *   real question simply doesn't count (errors surface as gaps, never fake data).
 * - Dynamic sheets are defined by a live query over tags / topic / patterns[].
 *
 * Everything downstream (counts, progress) is aggregated from MongoDB.
 */

export interface SheetDef {
  key: string;
  name: string;
  description: string;
  source: string;
  type: "curated" | "dynamic";
  icon: string;
  accent: string;
  slugs?: string[]; // curated only
  match?: { tag?: string; topics?: string[]; patterns?: string[] }; // dynamic only
}

const LC = (slug: string) => `https://leetcode.com/problems/${slug}/`;

/** Blind 75 — the canonical NeetCode list (public). */
const BLIND_75 = [
  // Arrays & Hashing
  "two-sum", "contains-duplicate", "valid-anagram", "group-anagrams", "top-k-frequent-elements",
  "product-of-array-except-self", "encode-and-decode-strings", "longest-consecutive-sequence",
  // Two Pointers
  "valid-palindrome", "3sum", "container-with-most-water",
  // Sliding Window
  "best-time-to-buy-and-sell-stock", "longest-substring-without-repeating-characters",
  "longest-repeating-character-replacement", "minimum-window-substring",
  // Stack
  "valid-parentheses",
  // Binary Search
  "find-minimum-in-rotated-sorted-array", "search-in-rotated-sorted-array",
  // Linked List
  "reverse-linked-list", "merge-two-sorted-lists", "reorder-list",
  "remove-nth-node-from-end-of-list", "linked-list-cycle", "merge-k-sorted-lists",
  // Trees
  "invert-binary-tree", "maximum-depth-of-binary-tree", "same-tree", "subtree-of-another-tree",
  "lowest-common-ancestor-of-a-binary-search-tree", "binary-tree-level-order-traversal",
  "validate-binary-search-tree", "kth-smallest-element-in-a-bst",
  "construct-binary-tree-from-preorder-and-inorder-traversal", "binary-tree-maximum-path-sum",
  "serialize-and-deserialize-binary-tree",
  // Tries
  "implement-trie-prefix-tree", "design-add-and-search-words-data-structure", "word-search-ii",
  // Heap / Priority Queue
  "find-median-from-data-stream",
  // Backtracking
  "combination-sum", "word-search",
  // Graphs
  "number-of-islands", "clone-graph", "pacific-atlantic-water-flow", "course-schedule",
  "number-of-connected-components-in-an-undirected-graph", "graph-valid-tree",
  // Advanced Graphs
  "alien-dictionary",
  // 1-D DP
  "climbing-stairs", "house-robber", "house-robber-ii", "longest-palindromic-substring",
  "palindromic-substrings", "decode-ways", "coin-change", "maximum-product-subarray",
  "word-break", "longest-increasing-subsequence",
  // 2-D DP
  "unique-paths", "longest-common-subsequence",
  // Greedy
  "maximum-subarray", "jump-game",
  // Intervals
  "insert-interval", "merge-intervals", "non-overlapping-intervals", "meeting-rooms", "meeting-rooms-ii",
  // Math & Geometry
  "rotate-image", "spiral-matrix", "set-matrix-zeroes",
  // Bit Manipulation
  "number-of-1-bits", "counting-bits", "reverse-bits", "missing-number", "sum-of-two-integers",
];

export const SHEETS: SheetDef[] = [
  { key: "blind-75", name: "Blind 75", description: "The classic 75-problem list that covers every core pattern.", source: "Curated (public)", type: "curated", icon: "Trophy", accent: "amber", slugs: BLIND_75 },
  { key: "striver-a2z", name: "Striver A2Z", description: "Problems from the Striver A2Z sheet already mapped in your bank.", source: "Striver", type: "dynamic", icon: "BookMarked", accent: "violet", match: { tag: "Striver" } },
  { key: "dp-sheet", name: "DP Sheet", description: "Every Dynamic Programming problem, ordered by difficulty.", source: "Dynamic", type: "dynamic", icon: "Grid3x3", accent: "rose", match: { topics: ["Dynamic Programming"] } },
  { key: "graph-sheet", name: "Graph Sheet", description: "Traversals, shortest paths, union-find and more.", source: "Dynamic", type: "dynamic", icon: "Waypoints", accent: "cyan", match: { topics: ["Graph"] } },
  { key: "tree-sheet", name: "Tree Sheet", description: "Binary trees, BST and tree DP.", source: "Dynamic", type: "dynamic", icon: "ListTree", accent: "emerald", match: { topics: ["Trees"] } },
  { key: "greedy-sheet", name: "Greedy Sheet", description: "Greedy choice, intervals and exchange arguments.", source: "Dynamic", type: "dynamic", icon: "Coins", accent: "amber", match: { topics: ["Greedy"] } },
  { key: "binary-search-sheet", name: "Binary Search Sheet", description: "Search over sorted data and over the answer space.", source: "Dynamic", type: "dynamic", icon: "Binary", accent: "blue", match: { topics: ["Binary Search"] } },
  { key: "sliding-window-sheet", name: "Sliding Window Sheet", description: "Fixed and variable window problems.", source: "Dynamic", type: "dynamic", icon: "MoveHorizontal", accent: "indigo", match: { patterns: ["variable-window", "fixed-window"] } },
  { key: "two-pointer-sheet", name: "Two Pointer Sheet", description: "Opposite / same-direction pointer problems.", source: "Dynamic", type: "dynamic", icon: "ArrowLeftRight", accent: "slate", match: { patterns: ["two-pointer"] } },
];

export const SHEET_BY_KEY = new Map(SHEETS.map((s) => [s.key, s]));

/** Mongo match fragment for a sheet (caller ANDs in `archived != true`). */
export function sheetMatch(def: SheetDef): Record<string, unknown> {
  if (def.type === "curated" && def.slugs) return { problemLink: { $in: def.slugs.map(LC) } };
  const m = def.match || {};
  if (m.tag) return { tags: m.tag };
  if (m.topics) return { topic: { $in: m.topics } };
  if (m.patterns) return { patterns: { $in: m.patterns } };
  return {};
}

const curatedLinkSets = new Map<string, Set<string>>();

/**
 * JS twin of `sheetMatch` — evaluates sheet membership on an in-memory doc
 * (used to bucket a user's own solved rows per sheet without extra queries).
 * Must stay in sync with `sheetMatch` above.
 */
export function sheetMatchesDoc(
  def: SheetDef,
  doc: { problemLink: string; tags: string[]; topic: string; patterns: string[] },
): boolean {
  if (def.type === "curated" && def.slugs) {
    let set = curatedLinkSets.get(def.key);
    if (!set) {
      set = new Set(def.slugs.map(LC));
      curatedLinkSets.set(def.key, set);
    }
    return set.has(doc.problemLink);
  }
  const m = def.match || {};
  if (m.tag) return doc.tags.includes(m.tag);
  if (m.topics) return m.topics.includes(doc.topic);
  if (m.patterns) return m.patterns.some((p) => doc.patterns.includes(p));
  return false;
}

// ---- API payload shapes ----
export interface SheetProgress {
  key: string;
  name: string;
  description: string;
  source: string;
  type: "curated" | "dynamic";
  icon: string;
  accent: string;
  listSize: number | null;
  total: number;
  solved: number;
  remaining: number;
  completionPct: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface SheetQuestion {
  id: string;
  title: string;
  platform: string;
  difficulty: string;
  topic: string;
  problemLink: string;
  status: string;
  favorite: boolean;
}

export interface SheetDetail extends SheetProgress {
  matched: number;
  questions: { items: SheetQuestion[]; total: number; page: number; limit: number; totalPages: number };
}
