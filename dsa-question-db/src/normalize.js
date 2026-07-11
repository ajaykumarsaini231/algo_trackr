// Deterministic classification. Every value produced here is a fixed function of the
// OFFICIAL platform tags + difficulty. Nothing is invented per-problem; re-running the
// same tags always yields the same result. This is how we honor "derive, don't hallucinate".

import { CF_DIFFICULTY_BANDS } from "./config.js";

export const CANONICAL_TOPICS = [
  "Arrays", "Strings", "Linked List", "Stack", "Queue", "Deque", "Heap", "Hash Table",
  "Prefix Sum", "Sliding Window", "Two Pointer", "Binary Search", "Sorting", "Matrix",
  "Recursion", "Backtracking", "Tree", "BST", "Trie", "Graph", "DFS", "BFS",
  "Topological Sort", "Shortest Path", "Minimum Spanning Tree", "Union Find",
  "Dynamic Programming", "Greedy", "Bit Manipulation", "Math", "Number Theory",
  "Geometry", "Combinatorics", "Probability", "Game Theory", "Simulation",
  "Implementation", "Constructive", "Interactive", "Design", "Segment Tree",
  "Fenwick Tree", "Divide and Conquer", "Data Structures", "Miscellaneous",
];

// lowercased platform tag (LeetCode + Codeforces vocabularies) -> canonical topic
export const TAG_CANON = {
  // arrays / strings
  "array": "Arrays", "arrays": "Arrays",
  "string": "Strings", "strings": "Strings", "string suffix structures": "Strings",
  "suffix array": "Strings", "suffix automaton": "Strings", "rolling hash": "Strings",
  "hashing": "Hash Table", "hash table": "Hash Table", "hash function": "Hash Table",
  // linear structures
  "linked list": "Linked List", "doubly-linked list": "Linked List",
  "stack": "Stack", "monotonic stack": "Stack",
  "queue": "Queue", "monotonic queue": "Queue", "deque": "Deque",
  "heap (priority queue)": "Heap", "heap": "Heap",
  // patterns
  "prefix sum": "Prefix Sum",
  "sliding window": "Sliding Window",
  "two pointers": "Two Pointer", "two pointer": "Two Pointer",
  "binary search": "Binary Search", "ternary search": "Binary Search",
  "sorting": "Sorting", "sortings": "Sorting", "merge sort": "Sorting",
  "matrix": "Matrix", "matrices": "Matrix",
  "recursion": "Recursion", "backtracking": "Backtracking",
  "divide and conquer": "Divide and Conquer",
  // trees / advanced DS
  "tree": "Tree", "trees": "Tree", "binary tree": "Tree",
  "binary search tree": "BST",
  "trie": "Trie",
  "segment tree": "Segment Tree",
  "binary indexed tree": "Fenwick Tree", "fenwick": "Fenwick Tree",
  // graphs
  "graph": "Graph", "graphs": "Graph",
  "dfs and similar": "DFS", "depth-first search": "DFS",
  "breadth-first search": "BFS",
  "topological sort": "Topological Sort",
  "shortest paths": "Shortest Path", "shortest path": "Shortest Path",
  "graph matchings": "Graph", "flows": "Graph", "2-sat": "Graph", "eulerian circuit": "Graph",
  "dsu": "Union Find", "union find": "Union Find",
  "minimum spanning tree": "Minimum Spanning Tree",
  // dp / greedy / bits
  "dp": "Dynamic Programming", "dynamic programming": "Dynamic Programming",
  "memoization": "Dynamic Programming",
  "greedy": "Greedy",
  "bitmasks": "Bit Manipulation", "bit manipulation": "Bit Manipulation", "bitmask": "Bit Manipulation",
  // math family
  "math": "Math", "number theory": "Number Theory",
  "combinatorics": "Combinatorics", "probabilities": "Probability",
  "probability and statistics": "Probability", "geometry": "Geometry",
  "games": "Game Theory", "game theory": "Game Theory",
  "fft": "Math", "chinese remainder theorem": "Number Theory",
  // misc / implementation
  "simulation": "Simulation",
  "implementation": "Implementation", "brute force": "Implementation",
  "enumeration": "Implementation", "counting": "Implementation",
  "expression parsing": "Implementation",
  "constructive algorithms": "Constructive",
  "interactive": "Interactive",
  "design": "Design",
  "data structures": "Data Structures", "ordered set": "Data Structures",
};

// When several canonical topics match, this order decides the single headline "topic".
// Algorithmic / structural topics outrank generic container topics.
export const TOPIC_PRIORITY = [
  "Dynamic Programming", "Graph", "Shortest Path", "Minimum Spanning Tree", "Topological Sort",
  "Tree", "BST", "Trie", "Segment Tree", "Fenwick Tree", "Union Find",
  "Binary Search", "Backtracking", "Recursion", "Divide and Conquer",
  "Greedy", "Sliding Window", "Two Pointer", "Bit Manipulation",
  "Heap", "Deque", "Stack", "Queue", "Linked List",
  "Game Theory", "Number Theory", "Combinatorics", "Probability", "Geometry",
  "Prefix Sum", "Sorting", "Hash Table", "Matrix", "DFS", "BFS", "Math",
  "Strings", "Arrays", "Constructive", "Simulation", "Design",
  "Data Structures", "Implementation", "Interactive", "Miscellaneous",
];

const PATTERN_TAGS = new Set([
  "Sliding Window", "Two Pointer", "Binary Search", "Backtracking", "Prefix Sum",
  "Divide and Conquer", "Greedy", "Dynamic Programming", "DFS", "BFS",
  "Bit Manipulation", "Constructive", "Simulation", "Topological Sort",
]);
const DS_PRIORITY = [
  "Trie", "Segment Tree", "Fenwick Tree", "Heap", "Union Find", "Deque",
  "Stack", "Queue", "Linked List", "Tree", "BST", "Hash Table", "Matrix",
  "Arrays", "Strings", "Data Structures",
];
const ALGO_PRIORITY = [
  "Dynamic Programming", "Shortest Path", "Binary Search", "Topological Sort",
  "Backtracking", "Greedy", "Two Pointer", "Sliding Window", "Divide and Conquer",
  "Sorting", "DFS", "BFS", "Number Theory", "Combinatorics", "Bit Manipulation", "Math",
];

export function canonTopics(tags) {
  const out = [];
  for (const t of tags || []) {
    const c = TAG_CANON[String(t).toLowerCase().trim()];
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

export function mainTopic(canon) {
  for (const t of TOPIC_PRIORITY) if (canon.includes(t)) return t;
  return canon[0] || "Miscellaneous";
}

// Full derived classification from a tag list.
export function classify(tags) {
  const canon = canonTopics(tags);
  const topic = mainTopic(canon);
  const rest = canon.filter((c) => c !== topic);
  const subtopic = rest[0] || topic;
  const pattern = canon.find((c) => PATTERN_TAGS.has(c)) || topic;
  const dataStructure = DS_PRIORITY.find((d) => canon.includes(d)) || "";
  const primaryAlgorithm =
    ALGO_PRIORITY.find((a) => canon.includes(a)) || (pattern !== topic ? pattern : "");
  const secondaryAlgorithm =
    ALGO_PRIORITY.filter((a) => canon.includes(a) && a !== primaryAlgorithm)[0] || "";
  return {
    topic,
    subtopic,
    pattern,
    dataStructure,
    primaryAlgorithm,
    secondaryAlgorithm,
    categories: canon.length ? canon : ["Miscellaneous"],
  };
}

// Codeforces numeric rating -> normalized difficulty + learning level.
export function cfBand(rating) {
  const r = rating || 0;
  if (!rating) return { difficulty: "Unrated", level: "Intermediate" };
  const band = CF_DIFFICULTY_BANDS.find((b) => r <= b.max);
  return { difficulty: band.difficulty, level: band.level };
}

export function lcLearningLevel(difficulty) {
  return difficulty === "Easy" ? "Beginner" : difficulty === "Medium" ? "Intermediate" : "Advanced";
}
