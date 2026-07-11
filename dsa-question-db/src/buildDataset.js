// Orchestrator: fetch official data -> normalize -> attach Striver -> dedupe -> emit files.
//
// Usage:
//   node src/buildDataset.js                 # full crawl (all LeetCode + Codeforces)
//   node src/buildDataset.js --from-cache     # rebuild from cached raw data (no network)
//   node src/buildDataset.js --limit 300      # quick smoke test (limits LeetCode fetch)

import {
  DATA_DIR, OUT_JSON, OUT_NDJSON, OUT_CSV, OUT_SAMPLE, OUT_STATS,
  STRIVER_SHEET_URL, UA,
} from "./config.js";
import { classify, cfBand, lcLearningLevel } from "./normalize.js";
import { STRIVER_BY_SLUG, STRIVER_STEPS, STRIVER_SEED_COUNT } from "./striverData.js";
import { fetchLeetcode } from "./fetchLeetcode.js";
import { fetchCodeforces } from "./fetchCodeforces.js";
import { round2, writeJson, writeNdjson, toCsv, fetchJson } from "./utils.js";
import fs from "node:fs";

const args = process.argv.slice(2);
const FROM_CACHE = args.includes("--from-cache");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : Infinity;
})();

const NOW = new Date().toISOString();
const STRIVER_SHEET_HOME =
  "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/";

// Fields that are DERIVED from official tags/difficulty (documented, reproducible).
const DERIVED_FIELDS = [
  "difficulty", "topic", "subtopic", "pattern", "dataStructure",
  "primaryAlgorithm", "secondaryAlgorithm", "categories", "learningLevel",
];
// Fields the official APIs don't expose -> left blank for later enrichment (never invented).
function emptyEnrichable() {
  return {
    summary: "", notes: "", timeComplexity: "", spaceComplexity: "",
    prerequisites: [], similarQuestions: [], companies: [],
    commonMistakes: [], alternativeApproaches: [],
  };
}

function striverFields(s) {
  return {
    isStriverQuestion: !!s,
    recommendedByStriver: !!s,
    striverStep: s?.striverStep || "",
    striverStepNo: s?.striverStepNo ?? null,
    striverTopic: s?.striverTopic || "",
    striverSubtopic: s?.striverSubtopic || "",
    striverOrder: s?.striverOrder ?? null,
    striverRevisionLevel: s?.striverRevisionLevel ?? null,
  };
}

function mapLeetcode(q, striver) {
  const cls = classify(q.tags);
  const url = `https://leetcode.com/problems/${q.titleSlug}/`;
  return {
    _id: `leetcode:${q.titleSlug}`,
    title: q.title,
    platform: "leetcode",
    problemId: String(q.questionFrontendId),
    slug: q.titleSlug,
    url,
    difficulty: q.difficulty,
    platformDifficulty: q.difficulty,
    rating: null,
    contest: "",
    contestId: null,
    problemIndex: "",
    acceptanceRate: round2(q.acRate),
    popularity: null,
    premium: !!q.isPaidOnly,
    tags: q.tags,
    ...cls,
    learningLevel: lcLearningLevel(q.difficulty),
    ...emptyEnrichable(),
    ...striverFields(striver),
    source: {
      leetcode: url,
      codeforces: "",
      striver: striver ? STRIVER_SHEET_HOME : "",
    },
    metaSource: "official",
    derivedFields: DERIVED_FIELDS,
    lastUpdated: NOW,
  };
}

function mapCodeforces(p) {
  const cls = classify(p.tags);
  const band = cfBand(p.rating);
  const id = `${p.contestId}${p.index}`;
  const url = `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
  return {
    _id: `codeforces:${id}`,
    title: p.name,
    platform: "codeforces",
    problemId: id,
    slug: "",
    url,
    difficulty: band.difficulty,
    platformDifficulty: p.rating ? String(p.rating) : "Unrated",
    rating: p.rating ?? null,
    contest: p.contestName || "",
    contestId: p.contestId,
    problemIndex: p.index,
    acceptanceRate: null,
    popularity: p.solvedCount ?? null,
    premium: false,
    tags: p.tags,
    ...cls,
    learningLevel: band.level,
    ...emptyEnrichable(),
    ...striverFields(null),
    source: { leetcode: "", codeforces: url, striver: "" },
    metaSource: "official",
    derivedFields: DERIVED_FIELDS,
    lastUpdated: NOW,
  };
}

// Merge built-in seed with an optional external mirror (STRIVER_SHEET_URL).
async function loadStriverMap() {
  const map = new Map(STRIVER_BY_SLUG);
  if (!STRIVER_SHEET_URL) return { map, standalone: [] };

  console.log("  [striver] ingesting mirror:", STRIVER_SHEET_URL);
  const standalone = [];
  try {
    const { json } = await fetchJson(STRIVER_SHEET_URL, { headers: { "User-Agent": UA } });
    const items = Array.isArray(json) ? json : json.problems || json.data || [];
    let order = STRIVER_SEED_COUNT;
    for (const it of items) {
      // Derive a LeetCode slug from an explicit slug or a leetcode URL.
      let slug = it.slug || it.leetcodeSlug || null;
      const link = it.url || it.leetcode || it.link || "";
      if (!slug && /leetcode\.com\/problems\//.test(link)) {
        slug = link.split("/problems/")[1].split("/")[0];
      }
      const placement = {
        striverStep: it.step || it.striverStep || "",
        striverStepNo: it.stepNo ?? it.striverStepNo ?? null,
        striverTopic: it.topic || it.step || "",
        striverSubtopic: it.subtopic || it.striverSubtopic || "",
        striverOrder: it.order ?? ++order,
        striverRevisionLevel: 0,
      };
      if (slug) {
        if (!map.has(slug)) map.set(slug, placement); // don't override curated seed
      } else if (link) {
        standalone.push({ link, title: it.title || it.name || "", ...placement });
      }
    }
    console.log(`  [striver] mirror merged (${map.size} slugs total)`);
  } catch (e) {
    console.warn("  [striver] mirror ingest failed (using seed only):", e.message);
  }
  return { map, standalone };
}

async function main() {
  console.log(`\n== dsa-question-db build ==  ${FROM_CACHE ? "(from cache)" : "(live fetch)"}\n`);
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const [lc, cf, striver] = await Promise.all([
    fetchLeetcode({ fromCache: FROM_CACHE, limit: LIMIT }),
    fetchCodeforces({ fromCache: FROM_CACHE }),
    loadStriverMap(),
  ]);

  const byId = new Map();
  const add = (doc) => byId.set(doc._id, doc); // last-wins dedupe on stable _id

  for (const q of lc) add(mapLeetcode(q, striver.map.get(q.titleSlug)));
  for (const p of cf) add(mapCodeforces(p));

  // Striver items that are not LeetCode problems (e.g. GFG-only) from a mirror.
  for (const s of striver.standalone) {
    const host = s.link.split("/")[2] || "external";
    const platform = host.includes("geeksforgeeks") ? "gfg"
      : host.includes("codingninjas") ? "codingninjas" : "external";
    const _id = `striver:${platform}:${(s.title || s.link).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
    if (byId.has(_id)) continue;
    add({
      _id, title: s.title || s.link, platform, problemId: "", slug: "", url: s.link,
      difficulty: "Unrated", platformDifficulty: "Unrated", rating: null,
      contest: "", contestId: null, problemIndex: "", acceptanceRate: null,
      popularity: null, premium: false, tags: [],
      topic: s.striverTopic || "Miscellaneous", subtopic: s.striverSubtopic || "",
      pattern: "", dataStructure: "", primaryAlgorithm: "", secondaryAlgorithm: "",
      categories: ["Miscellaneous"], learningLevel: "Intermediate",
      ...emptyEnrichable(), ...striverFields(s),
      source: { leetcode: "", codeforces: "", striver: STRIVER_SHEET_HOME },
      metaSource: "striver-mirror", derivedFields: [], lastUpdated: NOW,
    });
  }

  const docs = [...byId.values()];

  // ---- outputs ----
  writeJson(OUT_JSON, docs);
  writeNdjson(OUT_NDJSON, docs);

  const csvCols = [
    "_id", "title", "platform", "problemId", "url", "difficulty", "rating",
    "topic", "subtopic", "pattern", "dataStructure", "learningLevel",
    "acceptanceRate", "popularity", "premium", "tags",
    "isStriverQuestion", "striverStep", "striverStepNo", "striverOrder",
  ];
  fs.writeFileSync(OUT_CSV, toCsv(docs, csvCols));

  const striverDocs = docs.filter((d) => d.isStriverQuestion);
  const sample = [
    ...striverDocs.slice(0, 25),
    ...docs.filter((d) => d.platform === "codeforces").slice(0, 20),
    ...docs.filter((d) => d.platform === "leetcode" && !d.isStriverQuestion).slice(0, 15),
  ];
  writeJson(OUT_SAMPLE, sample);

  // ---- stats ----
  const tally = (arr, key) => arr.reduce((m, d) => ((m[d[key]] = (m[d[key]] || 0) + 1), m), {});
  const stats = {
    generatedAt: NOW,
    total: docs.length,
    byPlatform: tally(docs, "platform"),
    byDifficulty: tally(docs, "difficulty"),
    byLearningLevel: tally(docs, "learningLevel"),
    topTopics: Object.entries(tally(docs, "topic")).sort((a, b) => b[1] - a[1]).slice(0, 20),
    striverMapped: striverDocs.length,
    striverBySteps: STRIVER_STEPS.map((s) => ({
      stepNo: s.stepNo, step: s.step,
      count: striverDocs.filter((d) => d.striverStepNo === s.stepNo).length,
    })),
    premiumCount: docs.filter((d) => d.premium).length,
  };
  writeJson(OUT_STATS, stats);

  console.log(`\n== done ==`);
  console.log(`  total problems : ${stats.total}`);
  console.log(`  by platform    : ${JSON.stringify(stats.byPlatform)}`);
  console.log(`  by difficulty  : ${JSON.stringify(stats.byDifficulty)}`);
  console.log(`  striver mapped : ${stats.striverMapped}`);
  console.log(`\n  files written to ${DATA_DIR}\\`);
  console.log(`   - dsa-questions.json     (array; programmatic import)`);
  console.log(`   - dsa-questions.ndjson   (the SHEET: mongoimport-ready)`);
  console.log(`   - dsa-questions.csv      (spreadsheet view)`);
  console.log(`   - dsa-questions.sample.json / stats.json`);
  console.log(`\n  push to MongoDB:  node --env-file=.env src/importToMongo.js\n`);
}

main().catch((e) => {
  console.error("\nBUILD FAILED:", e);
  process.exit(1);
});
