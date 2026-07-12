/**
 * Roadmap catalog — rich, learning-guide data for the /roadmaps page.
 * Plain module (no "use client") so both the server page (JSON-LD) and the
 * client cards can import it. Counts are curated targets, not live DB reads.
 */

export type RoadmapLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface RoadmapTopicRef {
  name: string; // must match a topic name in lib/constants TOPICS for progress mapping
  slug: string;
}

export interface Roadmap {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  level: RoadmapLevel;
  icon: string; // lucide icon name
  accent: string; // tailwind gradient stops, e.g. "from-sky-500 to-indigo-500"
  durationWeeks: number;
  estimatedHours: number;
  topicCount: number;
  problemCount: number;
  leetcodeCount: number;
  moduleCount: number;
  completionRate: number; // curated "% of learners who finish"
  covers: string[];
  prerequisites: string[];
  whatYoullLearn: string[];
  bestFor: string[];
  learningOutcomes: string[];
  resources: string[];
  companies: string[];
  topics: RoadmapTopicRef[];
}

export const ROADMAPS: Roadmap[] = [
  {
    slug: "dsa-foundations",
    title: "DSA Foundations",
    tagline: "Build unshakeable fundamentals from zero",
    description:
      "Start here if you're new to Data Structures & Algorithms. Master the core structures and the problem-solving instincts you'll rely on for everything that follows.",
    level: "Beginner",
    icon: "Sprout",
    accent: "from-emerald-500 to-teal-500",
    durationWeeks: 8,
    estimatedHours: 45,
    topicCount: 9,
    problemCount: 140,
    leetcodeCount: 70,
    moduleCount: 11,
    completionRate: 82,
    covers: ["Arrays", "Strings", "Recursion", "Linked List", "Stack", "Queue", "Sorting", "Binary Search", "Hashing"],
    prerequisites: [
      "Basic programming in C++, Java or Python",
      "Variables, loops & conditionals",
      "Functions & basic recursion",
      "Basic mathematics",
    ],
    whatYoullLearn: [
      "Read and reason about time & space complexity",
      "Solve easy–medium problems confidently",
      "Recognise the core data-structure toolkit",
      "Build a daily problem-solving habit",
    ],
    bestFor: ["Absolute beginners", "College students", "Self-taught developers", "Placement prep (early)"],
    learningOutcomes: ["140+ practice problems", "70+ LeetCode problems", "9 core topics", "A solid base for interviews"],
    resources: ["Notes", "Video Playlist", "Articles", "Practice Sheets"],
    companies: ["Amazon", "Microsoft", "Adobe", "Flipkart"],
    topics: [
      { name: "Arrays", slug: "arrays" },
      { name: "Strings", slug: "strings" },
      { name: "Recursion", slug: "recursion" },
      { name: "Linked List", slug: "linked-list" },
      { name: "Stack", slug: "stack" },
      { name: "Queue", slug: "queue" },
      { name: "Binary Search", slug: "binary-search" },
    ],
  },
  {
    slug: "faang-interview-prep",
    title: "FAANG Interview Prep",
    tagline: "The complete path to a top-tier offer",
    description:
      "The high-frequency topics and patterns that dominate interviews at Google, Amazon, Microsoft, Meta and other top companies — end to end, with company-tagged practice.",
    level: "Advanced",
    icon: "Rocket",
    accent: "from-indigo-500 to-violet-500",
    durationWeeks: 12,
    estimatedHours: 95,
    topicCount: 14,
    problemCount: 320,
    leetcodeCount: 160,
    moduleCount: 18,
    completionRate: 64,
    covers: ["Arrays", "Strings", "Hashing", "Two Pointers", "Sliding Window", "Trees", "BST", "Graph", "DP", "Greedy", "Heap", "Trie", "Binary Search", "Backtracking"],
    prerequisites: ["Comfortable with DSA Foundations", "Solid time-complexity analysis", "One language mastered", "Basic recursion & OOP"],
    whatYoullLearn: [
      "Solve medium & hard problems under time pressure",
      "Master the 15 highest-yield interview patterns",
      "Communicate approach & complexity clearly",
      "Optimise brute-force into optimal solutions",
    ],
    bestFor: ["Placement preparation", "FAANG / MAANG interviews", "Working engineers switching jobs", "Serious 3–4 month prep"],
    learningOutcomes: ["320+ interview questions", "160+ LeetCode problems", "14 core topics", "An interview-ready pattern toolkit"],
    resources: ["Notes", "Video Playlist", "Articles", "Practice Sheets", "Company Questions"],
    companies: ["Google", "Amazon", "Microsoft", "Meta", "Apple", "Uber", "Adobe", "Atlassian"],
    topics: [
      { name: "Arrays", slug: "arrays" },
      { name: "Strings", slug: "strings" },
      { name: "Trees", slug: "trees" },
      { name: "Graph", slug: "graph" },
      { name: "Dynamic Programming", slug: "dynamic-programming" },
      { name: "Heap", slug: "heap" },
      { name: "Greedy", slug: "greedy" },
      { name: "Binary Search", slug: "binary-search" },
    ],
  },
  {
    slug: "dynamic-programming-mastery",
    title: "Dynamic Programming Mastery",
    tagline: "Turn DP from your weakness into your edge",
    description:
      "DP trips up more candidates than any other topic. Work through it systematically — from memoization and tabulation to advanced state design — until it clicks.",
    level: "Advanced",
    icon: "Grid3x3",
    accent: "from-amber-500 to-orange-500",
    durationWeeks: 5,
    estimatedHours: 45,
    topicCount: 6,
    problemCount: 110,
    leetcodeCount: 75,
    moduleCount: 12,
    completionRate: 58,
    covers: ["Memoization", "Tabulation", "0/1 Knapsack", "LCS", "LIS", "Matrix DP", "Interval DP", "Tree DP", "Bitmask DP", "Digit DP"],
    prerequisites: ["Strong recursion", "Arrays & strings", "Basic graph/tree traversal", "Time-complexity analysis"],
    whatYoullLearn: [
      "Identify DP problems from their signals",
      "Design state & transitions systematically",
      "Convert top-down to bottom-up and optimise space",
      "Handle interval, tree and bitmask DP",
    ],
    bestFor: ["Interview finishers", "Competitive programmers", "Anyone stuck on DP", "FAANG interviews"],
    learningOutcomes: ["110+ DP problems", "75+ LeetCode problems", "10+ DP patterns", "Deep DP intuition"],
    resources: ["Notes", "Video Playlist", "Articles", "Practice Sheets"],
    companies: ["Google", "Amazon", "Uber", "Goldman Sachs", "Oracle"],
    topics: [
      { name: "Dynamic Programming", slug: "dynamic-programming" },
      { name: "Recursion", slug: "recursion" },
    ],
  },
  {
    slug: "graph-mastery",
    title: "Graph Mastery",
    tagline: "Traversals, shortest paths & everything between",
    description:
      "The graph toolkit that shows up in system-heavy interviews and contests — from BFS/DFS to Dijkstra, union-find and topological sort.",
    level: "Advanced",
    icon: "Waypoints",
    accent: "from-cyan-500 to-blue-500",
    durationWeeks: 4,
    estimatedHours: 38,
    topicCount: 5,
    problemCount: 90,
    leetcodeCount: 60,
    moduleCount: 10,
    completionRate: 61,
    covers: ["BFS", "DFS", "Topological Sort", "Dijkstra", "Bellman-Ford", "Union-Find (DSU)", "MST", "Bridges", "SCC", "Shortest Path"],
    prerequisites: ["Recursion & stacks/queues", "Basic trees", "Time-complexity analysis", "Comfort with adjacency lists"],
    whatYoullLearn: [
      "Model problems as graphs",
      "Apply the right traversal & shortest-path algorithm",
      "Use union-find for connectivity",
      "Handle DAGs, MSTs and advanced connectivity",
    ],
    bestFor: ["Interview prep", "Competitive programming", "System-design-adjacent rounds", "FAANG interviews"],
    learningOutcomes: ["90+ graph problems", "60+ LeetCode problems", "12+ graph algorithms", "Confident graph modelling"],
    resources: ["Notes", "Video Playlist", "Articles", "Practice Sheets", "Company Questions"],
    companies: ["Google", "Amazon", "Meta", "Microsoft", "Databricks"],
    topics: [
      { name: "Graph", slug: "graph" },
      { name: "Trees", slug: "trees" },
    ],
  },
  {
    slug: "competitive-programming",
    title: "Competitive Programming",
    tagline: "Go beyond interviews into contest territory",
    description:
      "Number theory, bit tricks, geometry and the math that powers competitive contests — for those aiming at Codeforces, ICPC and beyond.",
    level: "Expert",
    icon: "Trophy",
    accent: "from-rose-500 to-pink-500",
    durationWeeks: 10,
    estimatedHours: 120,
    topicCount: 8,
    problemCount: 250,
    leetcodeCount: 40,
    moduleCount: 16,
    completionRate: 41,
    covers: ["Number Theory", "Modular Arithmetic", "Sieve", "Bit Manipulation", "Combinatorics", "Geometry", "Segment Tree", "Fenwick Tree", "Game Theory"],
    prerequisites: ["Strong DSA foundations", "Fluent recursion & DP", "Solid mathematics", "Fast implementation skills"],
    whatYoullLearn: [
      "Apply number theory & combinatorics",
      "Use advanced structures (segment/Fenwick trees)",
      "Solve geometry & game-theory problems",
      "Write fast, contest-ready code",
    ],
    bestFor: ["Competitive programmers", "ICPC / Codeforces aspirants", "Advanced learners", "Olympiad-style problem solvers"],
    learningOutcomes: ["250+ contest problems", "40+ curated LeetCode hard", "8 advanced topics", "Contest-ready speed"],
    resources: ["Notes", "Video Playlist", "Articles", "Practice Sheets"],
    companies: ["Google", "DE Shaw", "Databricks", "Directi", "Palantir"],
    topics: [
      { name: "Mathematics", slug: "mathematics" },
      { name: "Number Theory", slug: "number-theory" },
      { name: "Bit Manipulation", slug: "bit-manipulation" },
      { name: "Geometry", slug: "geometry" },
    ],
  },
];
