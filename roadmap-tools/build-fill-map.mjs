/**
 * Merge roadmap-tools/fill-parts/*.json into src/data/pattern-fill-map.json.
 * Unions titles/tags/keywords per slug (case-insensitive dedupe). Validates
 * every slug against the pattern catalog and reports unknown slugs.
 *
 * Run: node roadmap-tools/build-fill-map.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CAT = JSON.parse(fs.readFileSync("src/data/pattern-catalog.json", "utf8"));
const VALID = new Set(CAT.patterns.map((p) => p.slug));

const dir = "roadmap-tools/fill-parts";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

/**
 * Default-DENY tags. A tag is kept ONLY if it is a precise parent/synonym for
 * that specific pattern (listed below). This prevents category tags
 * (geometry, Bit Manipulation, Prefix Sum, probabilities, hashing, graphs …)
 * from flooding a fine-grained pattern with hundreds of loosely-related
 * problems. Fine-grained patterns rely on their (verified) titles + keywords;
 * anything that still can't reach 5 is reported as a gap, never padded.
 */
const ALLOW = {
  "disjoint-set": ["dsu", "union-find", "union find"],
  "bellman-ford": ["shortest paths"],
  "floyd-warshall": ["shortest paths"],
  "simulation-misc": ["simulation"],
  "tree-dfs": ["depth-first search"],
  "tree-bfs": ["breadth-first search"],
  "merge-sort": ["merge sort"],
  "counting-sort": ["counting sort"],
  "increasing-stack": ["monotonic stack"],
  "decreasing-stack": ["monotonic stack"],
  "next-greater-element": ["monotonic stack"],
  "histogram": ["monotonic stack"],
  "deque": ["monotonic queue"],
  "priority-queue": ["heap (priority queue)"],
  "min-heap": ["heap (priority queue)"],
  "max-heap": ["heap (priority queue)"],
  "heapify": ["heap (priority queue)"],
  "merge-k-lists": ["heap (priority queue)"],
  "median-finding": ["data stream"],
  "prefix-tree": ["trie"],
  "string-trie": ["trie"],
  "dictionary": ["trie"],
  "auto-complete": ["trie"],
  "bit-trie": ["trie"],
};
const stripped = {};

// Over-broad keyword regexes that pull in the wrong category (XOR≠AND/OR,
// every palindrome≠Manacher, "Balanced"→balanced trees). Each is used by only
// its one noisy pattern, so dropping globally is safe. The precise titles
// already cover those patterns.
const KW_BLOCK = new Set([
  "\\bxor\\b", "\\bsingle number\\b", "\\bugly number\\b",
  "\\bpalindrom", "palindromic sub", "Balanced",
]);

const merged = {};
const dedup = (arr, ci) => {
  const seen = new Set(), out = [];
  for (const x of arr || []) {
    const k = ci ? String(x).toLowerCase().trim() : String(x);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(x);
  }
  return out;
};

const unknown = new Set();
for (const f of files) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    console.error(`SKIP ${f}: invalid JSON (${e.message})`);
    continue;
  }
  for (const [slug, def] of Object.entries(json)) {
    if (!VALID.has(slug)) { unknown.add(slug); continue; }
    const m = (merged[slug] ||= { titles: [], tags: [], keywords: [] });
    m.titles.push(...(def.titles || []));
    const allowed = new Set(ALLOW[slug] || []);
    for (const t of def.tags || []) {
      if (!allowed.has(String(t).toLowerCase().trim())) { stripped[t] = (stripped[t] || 0) + 1; continue; }
      m.tags.push(t);
    }
    for (const kw of def.keywords || []) {
      if (KW_BLOCK.has(kw)) { stripped["kw:" + kw] = (stripped["kw:" + kw] || 0) + 1; continue; }
      m.keywords.push(kw);
    }
  }
  console.log(`merged ${f} (${Object.keys(json).length} slugs)`);
}

for (const slug of Object.keys(merged)) {
  merged[slug].titles = dedup(merged[slug].titles, true);
  merged[slug].tags = dedup(merged[slug].tags, true);
  merged[slug].keywords = dedup(merged[slug].keywords, false);
}

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/pattern-fill-map.json", JSON.stringify(merged, null, 2));

const totalTitles = Object.values(merged).reduce((s, m) => s + m.titles.length, 0);
console.log(`\nwrote src/data/pattern-fill-map.json`);
console.log(`slugs: ${Object.keys(merged).length} | total titles: ${totalTitles}`);
if (unknown.size) console.log(`WARNING unknown slugs skipped: ${[...unknown].join(", ")}`);
if (Object.keys(stripped).length) console.log(`stripped broad tags: ${JSON.stringify(stripped)}`);
