// Generates src/data/pattern-catalog.json — the SINGLE source of truth shared by
// the app (src/lib/patterns.ts) and the batch classifier (classify-patterns.mjs).
// Run: node roadmap-tools/build-catalog.mjs
import fs from "node:fs";
import path from "node:path";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- Full taxonomy (exactly the categories/patterns requested) ----
const CATS = {
  "Array": ["Basic Array", "Simulation", "Brute Force", "Prefix Sum", "Suffix Sum", "Difference Array", "Kadane Algorithm", "Circular Array", "Matrix", "Coordinate Compression"],
  "Two Pointer": ["Two Pointer", "Same Direction", "Opposite Direction", "Fast Slow Pointer", "Partition", "Dutch National Flag"],
  "Sliding Window": ["Fixed Window", "Variable Window", "Frequency Window", "Character Window", "Substring Window"],
  "Binary Search": ["Binary Search", "Binary Search on Answer", "Lower Bound", "Upper Bound", "Peak Element", "Rotated Array", "Search Space Reduction"],
  "Sorting": ["Merge Sort", "Quick Sort", "Heap Sort", "Counting Sort", "Bucket Sort", "Radix Sort", "Custom Comparator", "Partial Sorting"],
  "Hashing": ["HashMap", "HashSet", "Frequency Count", "Prefix Hash", "Rolling Hash", "Polynomial Hash"],
  "Stack": ["Monotonic Stack", "Increasing Stack", "Decreasing Stack", "Expression Evaluation", "Parentheses", "Next Greater Element", "Histogram"],
  "Queue": ["Queue", "Deque", "Monotonic Queue", "Circular Queue", "Priority Queue"],
  "Linked List": ["Reverse List", "Merge List", "Fast Slow List", "Cycle Detection", "Intersection", "Dummy Node"],
  "Tree": ["Tree DFS", "Tree BFS", "Tree Traversal", "Binary Tree", "BST", "LCA", "Diameter", "Serialization", "Tree DP"],
  "Trie": ["Trie", "Prefix Tree", "Dictionary", "Auto Complete", "Bit Trie"],
  "Heap": ["Top K", "Median Finding", "Merge K Lists", "Priority Queue Heap", "Min Heap", "Max Heap", "Heapify"],
  "Graph": ["Graph DFS", "Graph BFS", "Topological Sort", "Union Find", "Disjoint Set", "Dijkstra", "Bellman Ford", "Floyd Warshall", "Prim", "Kruskal", "Shortest Path", "MST", "Bridge", "Articulation Point", "SCC", "Euler Tour", "Graph Coloring"],
  "Dynamic Programming": ["1D DP", "2D DP", "Grid DP", "LIS", "LCS", "Knapsack", "Tree DP Advanced", "Digit DP", "Bitmask DP", "Game DP", "Interval DP", "Memoization", "Tabulation", "Optimization DP"],
  "Greedy": ["Interval Scheduling", "Activity Selection", "Sorting Greedy", "Exchange Argument", "Fractional Knapsack", "Greedy Choice"],
  "Backtracking": ["Combination", "Permutation", "Subset", "N Queens", "Sudoku", "Branch and Bound"],
  "Recursion": ["Recursion", "Divide and Conquer", "Tail Recursion", "Master Theorem"],
  "Math": ["Prime", "GCD", "LCM", "Modular Arithmetic", "Power", "Combinatorics", "Probability", "Expected Value", "Matrix Exponentiation"],
  "Bit Manipulation": ["XOR", "AND OR", "Bitmask", "Subset Enumeration", "Gray Code"],
  "Geometry": ["Convex Hull", "Line Sweep", "Cross Product", "Orientation", "Polygon", "Distance"],
  "String": ["KMP", "Z Algorithm", "String Trie", "String Rolling Hash", "Manacher", "Rabin Karp", "Suffix Array", "Suffix Automaton"],
  "Miscellaneous": ["Simulation Misc", "Implementation", "Design", "Randomization", "Interactive", "Constructive", "Ad Hoc"],
};

const CATEGORY_PRIORITY = {
  "Array": "High", "Two Pointer": "High", "Sliding Window": "High", "Binary Search": "High",
  "Sorting": "Medium", "Hashing": "High", "Stack": "Medium", "Queue": "Medium", "Linked List": "Medium",
  "Tree": "Critical", "Trie": "Medium", "Heap": "High", "Graph": "Critical", "Dynamic Programming": "Critical",
  "Greedy": "High", "Backtracking": "High", "Recursion": "Medium", "Math": "Medium",
  "Bit Manipulation": "Medium", "Geometry": "Low", "String": "High", "Miscellaneous": "Low",
};
const PRIORITY_OVERRIDE = {
  "two-pointer": "Critical", "variable-window": "Critical", "binary-search": "Critical",
  "binary-search-on-answer": "Critical", "prefix-sum": "Critical", "kadane-algorithm": "High",
  "monotonic-stack": "High", "next-greater-element": "High", "hashmap": "Critical", "frequency-count": "High",
  "top-k": "High", "tree-traversal": "Critical", "bst": "High", "graph-bfs": "Critical", "graph-dfs": "Critical",
  "topological-sort": "High", "union-find": "High", "dijkstra": "High", "1d-dp": "Critical", "2d-dp": "Critical",
  "grid-dp": "High", "knapsack": "High", "lis": "High", "lcs": "High",
  "subset": "High", "permutation": "High", "combination": "High",
  "kmp": "Medium", "trie": "High",
};

// Concise, honest metadata for the flagship patterns; the long tail falls back to
// description + category + priority (no fabricated depth).
const RICH = {
  "two-pointer": { whenToUse: "Sorted arrays/strings or pairing problems where two indices move to shrink the search.", recognition: ["sorted input", "find a pair/triplet", "in-place O(1) space"], mistakes: ["moving both pointers when only one should", "off-by-one on the crossing condition"], time: "O(n)", space: "O(1)", importance: "Extremely common in phone screens." },
  "fast-slow-pointer": { whenToUse: "Cycle detection and finding middle of a sequence/linked list.", recognition: ["linked list cycle", "find middle", "detect loop"], mistakes: ["null-deref on fast.next.next", "wrong start offset for cycle entry"], time: "O(n)", space: "O(1)", importance: "Classic linked-list interview staple." },
  "prefix-sum": { whenToUse: "Many range-sum / subarray-sum queries or count-of-subarrays problems.", recognition: ["range sum", "subarray sum equals k", "immutable array queries"], mistakes: ["forgetting the empty-prefix (0) seed", "mixing inclusive/exclusive bounds"], time: "O(n) build, O(1) query", space: "O(n)", importance: "Foundational; unlocks hashing+prefix combos." },
  "kadane-algorithm": { whenToUse: "Maximum/minimum contiguous subarray value.", recognition: ["max subarray", "contiguous", "best window sum"], mistakes: ["resetting to 0 instead of current element", "not tracking a global max"], time: "O(n)", space: "O(1)", importance: "Interview classic (Maximum Subarray)." },
  "variable-window": { whenToUse: "Longest/shortest window satisfying a constraint.", recognition: ["longest substring with...", "at most K", "minimum window"], mistakes: ["shrinking with `if` instead of `while`", "stale window-state after moves"], time: "O(n)", space: "O(k)", importance: "One of the highest-yield patterns." },
  "fixed-window": { whenToUse: "Aggregate over every window of a fixed size k.", recognition: ["window size k", "max/avg of each window"], mistakes: ["recomputing the whole window", "not evicting the leaving element"], time: "O(n)", space: "O(k)", importance: "Common warm-up." },
  "binary-search": { whenToUse: "Sorted data or any monotonic predicate.", recognition: ["sorted array", "find boundary", "O(log n) expected"], mistakes: ["mid overflow", "wrong loop invariant lo<=hi vs lo<hi"], time: "O(log n)", space: "O(1)", importance: "Must-know; appears everywhere." },
  "binary-search-on-answer": { whenToUse: "Minimize/maximize a value where feasibility is monotonic.", recognition: ["min largest ...", "max min ...", "smallest k such that feasible(k)"], mistakes: ["non-monotonic predicate", "boundary returns wrong side"], time: "O(n log(range))", space: "O(1)", importance: "Frequent in mediums/hards." },
  "monotonic-stack": { whenToUse: "Next/previous greater or smaller element; histogram-style spans.", recognition: ["next greater", "largest rectangle", "span/temperature"], mistakes: ["wrong pop comparator", "leaving unresolved elements unhandled"], time: "O(n)", space: "O(n)", importance: "High-value, appears in hards." },
  "next-greater-element": { whenToUse: "For each element, the next element bigger than it.", recognition: ["next greater/warmer", "circular next greater"], mistakes: ["forgetting circular wrap", "storing values vs indices"], time: "O(n)", space: "O(n)", importance: "Canonical monotonic-stack use." },
  "hashmap": { whenToUse: "O(1) lookups: complements, seen-sets, grouping, counting.", recognition: ["two-sum style", "group by key", "seen before?"], mistakes: ["mutating map while iterating", "hash of mutable key"], time: "O(n)", space: "O(n)", importance: "The most-used tool in interviews." },
  "frequency-count": { whenToUse: "Anagrams, top-k, majority — anything counting occurrences.", recognition: ["anagram", "count of each", "k most frequent"], mistakes: ["comparing counts by reference", "not resetting between windows"], time: "O(n)", space: "O(n)", importance: "Pairs with sliding window & heaps." },
  "top-k": { whenToUse: "K largest/smallest/most-frequent from a stream or array.", recognition: ["k closest", "k largest", "top k frequent"], mistakes: ["min-heap vs max-heap mixup", "heap of wrong size"], time: "O(n log k)", space: "O(k)", importance: "Very common heap use." },
  "merge-k-lists": { whenToUse: "Merge multiple sorted sequences.", recognition: ["merge k sorted", "smallest range across lists"], mistakes: ["not using a heap", "comparator on the wrong field"], time: "O(n log k)", space: "O(k)", importance: "Classic hard-medium." },
  "tree-traversal": { whenToUse: "Any binary-tree problem — inorder/preorder/postorder/level.", recognition: ["traverse a tree", "level order", "path problems"], mistakes: ["recursion depth on skewed trees", "forgetting null children"], time: "O(n)", space: "O(h)", importance: "Gateway to all tree problems." },
  "bst": { whenToUse: "Ordered operations: search/insert/kth/validate on a BST.", recognition: ["binary search tree", "kth smallest", "validate BST"], mistakes: ["using value bounds incorrectly", "assuming balanced"], time: "O(h)", space: "O(h)", importance: "Common and testable." },
  "lca": { whenToUse: "Lowest common ancestor of two tree/graph nodes.", recognition: ["lowest common ancestor", "distance between nodes"], mistakes: ["not handling node==ancestor", "BST vs general-tree method mix"], time: "O(n)", space: "O(h)", importance: "Frequent tree medium." },
  "graph-bfs": { whenToUse: "Shortest path in unweighted graphs / level expansion.", recognition: ["shortest steps", "min moves", "spread/flood"], mistakes: ["marking visited on pop not push", "revisiting nodes"], time: "O(V+E)", space: "O(V)", importance: "Core graph tool." },
  "graph-dfs": { whenToUse: "Connectivity, components, cycles, path enumeration.", recognition: ["number of islands", "connected components", "detect cycle"], mistakes: ["recursion stack overflow", "not restoring visited in backtracking"], time: "O(V+E)", space: "O(V)", importance: "Core graph tool." },
  "topological-sort": { whenToUse: "Ordering with dependencies in a DAG.", recognition: ["course schedule", "build order", "prerequisites"], mistakes: ["not detecting cycles", "wrong in-degree bookkeeping"], time: "O(V+E)", space: "O(V)", importance: "High-value graph pattern." },
  "union-find": { whenToUse: "Dynamic connectivity, grouping, cycle detection in undirected graphs.", recognition: ["connected components", "redundant connection", "accounts merge"], mistakes: ["no path compression/union by rank", "off-by-one parent init"], time: "O(α(n))", space: "O(n)", importance: "Frequent and elegant." },
  "dijkstra": { whenToUse: "Shortest path with non-negative weights.", recognition: ["min cost path", "weighted shortest path"], mistakes: ["using it with negative edges", "not skipping stale heap entries"], time: "O(E log V)", space: "O(V)", importance: "Common weighted-graph hard." },
  "1d-dp": { whenToUse: "Optimal value over a linear sequence with a recurrence.", recognition: ["climbing stairs", "house robber", "decode ways"], mistakes: ["wrong base cases", "iteration order"], time: "O(n)", space: "O(1..n)", importance: "DP foundation." },
  "2d-dp": { whenToUse: "Recurrence over two dimensions (two sequences / index+state).", recognition: ["edit distance", "two strings", "index + capacity"], mistakes: ["dimension order", "uninitialized first row/col"], time: "O(nm)", space: "O(nm)", importance: "Very common in hards." },
  "grid-dp": { whenToUse: "Paths/cost over a matrix.", recognition: ["unique paths", "min path sum", "maximal square"], mistakes: ["blocked-cell handling", "in-place overwrite order"], time: "O(nm)", space: "O(nm)", importance: "Frequent medium." },
  "knapsack": { whenToUse: "Choose items under a capacity/target constraint.", recognition: ["subset sum", "partition equal", "coin change"], mistakes: ["0/1 vs unbounded loop direction", "target off-by-one"], time: "O(n·W)", space: "O(W)", importance: "DP staple." },
  "lis": { whenToUse: "Longest increasing subsequence and variants.", recognition: ["longest increasing", "russian dolls", "chain"], mistakes: ["O(n^2) when O(n log n) needed", "strict vs non-strict"], time: "O(n log n)", space: "O(n)", importance: "Common medium/hard." },
  "lcs": { whenToUse: "Alignment/edit between two sequences.", recognition: ["longest common subsequence", "edit distance", "delete ops"], mistakes: ["subsequence vs substring", "base row init"], time: "O(nm)", space: "O(nm)", importance: "Classic 2D DP." },
  "subset": { whenToUse: "Enumerate subsets / combinations via backtracking.", recognition: ["all subsets", "combination sum", "power set"], mistakes: ["duplicate subsets", "not sorting to skip dups"], time: "O(2^n)", space: "O(n)", importance: "Backtracking core." },
  "backtracking": { whenToUse: "Search a decision tree with pruning.", recognition: ["generate all", "n-queens", "sudoku", "word search"], mistakes: ["not undoing choices", "weak pruning → TLE"], time: "exp.", space: "O(depth)", importance: "High-value search skill." },
  "trie": { whenToUse: "Prefix queries over a dictionary of strings.", recognition: ["prefix search", "word dictionary", "autocomplete"], mistakes: ["not marking word ends", "memory blow-up"], time: "O(L)", space: "O(Σ·nodes)", importance: "Common medium/hard." },
  "kmp": { whenToUse: "Substring search / prefix-function problems.", recognition: ["find pattern in text", "shortest palindrome", "longest prefix=suffix"], mistakes: ["failure-function off-by-one", "reusing across tests wrongly"], time: "O(n+m)", space: "O(m)", importance: "Advanced strings." },
};

const norm = (s) => String(s).toLowerCase().trim();

// official tag (normalized) -> pattern slugs
const TAG_MAP = {
  "array": ["basic-array"], "arrays": ["basic-array"],
  "prefix sum": ["prefix-sum"],
  "two pointers": ["two-pointer"], "two pointer": ["two-pointer"],
  "sliding window": ["variable-window", "fixed-window"],
  "binary search": ["binary-search"], "ternary search": ["binary-search"],
  "sortings": ["custom-comparator"], "sorting": ["custom-comparator"],
  "hashing": ["hashmap"], "hash table": ["hashmap"], "hashset": ["hashset"],
  "stack": ["monotonic-stack"], "monotonic stack": ["monotonic-stack"],
  "queue": ["queue"], "monotonic queue": ["monotonic-queue"],
  "heap (priority queue)": ["top-k", "priority-queue-heap"], "heap": ["priority-queue-heap"],
  "linked list": ["reverse-list", "fast-slow-list"], "doubly-linked list": ["reverse-list"],
  "tree": ["tree-traversal"], "trees": ["tree-traversal"], "binary tree": ["binary-tree"],
  "binary search tree": ["bst"],
  "trie": ["trie"], "string suffix structures": ["suffix-array"], "suffix array": ["suffix-array"],
  "segment tree": ["design"], "binary indexed tree": ["design"],
  "graph": ["graph-dfs", "graph-bfs"], "graphs": ["graph-dfs", "graph-bfs"],
  "dfs and similar": ["graph-dfs"], "depth-first search": ["graph-dfs"], "breadth-first search": ["graph-bfs"],
  "topological sort": ["topological-sort"], "shortest paths": ["shortest-path", "dijkstra"], "shortest path": ["shortest-path"],
  "dsu": ["union-find"], "union find": ["union-find"], "2-sat": ["graph-coloring"], "flows": ["graph-dfs"],
  "dp": ["memoization", "tabulation"], "dynamic programming": ["memoization", "tabulation"], "memoization": ["memoization"],
  "greedy": ["greedy-choice"],
  "backtracking": ["subset", "permutation", "combination"], "brute force": ["brute-force"],
  "constructive algorithms": ["constructive"], "implementation": ["implementation"], "simulation": ["simulation"],
  "recursion": ["recursion"], "divide and conquer": ["divide-and-conquer"],
  "math": ["gcd", "modular-arithmetic"], "number theory": ["prime", "modular-arithmetic"],
  "combinatorics": ["combinatorics"], "probabilities": ["probability"], "probability and statistics": ["probability"],
  "bitmasks": ["bitmask", "bitmask-dp"], "bit manipulation": ["xor", "bitmask"],
  "geometry": ["cross-product", "convex-hull"],
  "strings": ["kmp"], "string": ["kmp"], "rolling hash": ["string-rolling-hash"], "hashing string": ["string-rolling-hash"],
  "games": ["game-dp"], "interactive": ["interactive"], "matrix": ["matrix"], "matrices": ["matrix"],
  "data structures": ["design"], "ordered set": ["design"], "enumeration": ["brute-force"], "counting": ["frequency-count"],
};

// dashboard topic -> baseline patterns (fallback so every question gets >=1)
const TOPIC_MAP = {
  "Arrays": ["basic-array"], "Strings": ["kmp"], "Linked List": ["reverse-list"],
  "Stack": ["monotonic-stack"], "Queue": ["queue"], "Trees": ["tree-traversal", "tree-dfs"],
  "Graph": ["graph-dfs", "graph-bfs"], "Dynamic Programming": ["memoization", "tabulation"],
  "Greedy": ["greedy-choice"], "Binary Search": ["binary-search"], "Recursion": ["recursion"],
  "Heap": ["priority-queue-heap"], "Bit Manipulation": ["bitmask"], "Mathematics": ["gcd"],
  "Number Theory": ["prime"], "Geometry": ["cross-product"], "Miscellaneous": ["ad-hoc"],
};

// ---- build ----
const usedSlugs = new Set();
const patterns = [];
const categories = [];
for (const [category, names] of Object.entries(CATS)) {
  const catSlug = slug(category);
  const items = [];
  for (const name of names) {
    let s = slug(name);
    if (usedSlugs.has(s)) s = `${catSlug}-${s}`;
    usedSlugs.add(s);
    const priority = PRIORITY_OVERRIDE[s] || CATEGORY_PRIORITY[category] || "Medium";
    const rich = RICH[s] || {};
    patterns.push({
      name, slug: s, category, categorySlug: catSlug, priority,
      description: rich.whenToUse || `${name} — a ${category} pattern.`,
      whenToUse: rich.whenToUse || "",
      recognition: rich.recognition || [],
      mistakes: rich.mistakes || [],
      time: rich.time || "", space: rich.space || "",
      importance: rich.importance || `${priority} priority for interviews.`,
    });
    items.push(s);
  }
  categories.push({ category, categorySlug: catSlug, priority: CATEGORY_PRIORITY[category], patternSlugs: items });
}

// Validate that every TAG_MAP / TOPIC_MAP target slug actually exists.
const slugSet = new Set(patterns.map((p) => p.slug));
const missing = new Set();
for (const arr of [...Object.values(TAG_MAP), ...Object.values(TOPIC_MAP)])
  for (const s of arr) if (!slugSet.has(s)) missing.add(s);
if (missing.size) { console.error("MISSING SLUGS referenced by maps:", [...missing]); process.exit(1); }

const out = { generatedFrom: "roadmap-tools/build-catalog.mjs", counts: { patterns: patterns.length, categories: categories.length }, categories, patterns, tagMap: TAG_MAP, topicMap: TOPIC_MAP };
const dir = path.resolve("src/data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "pattern-catalog.json"), JSON.stringify(out, null, 2));
console.log(`wrote src/data/pattern-catalog.json — ${patterns.length} patterns in ${categories.length} categories`);
console.log("flagship with rich metadata:", Object.keys(RICH).length);
