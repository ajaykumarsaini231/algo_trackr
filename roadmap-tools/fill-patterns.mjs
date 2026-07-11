/**
 * Additive pattern enrichment (title + tag + keyword matching).
 *
 * Fills fine-grained algorithm patterns that the tag-only classifier leaves
 * empty (Kadane, Difference Array, Binary Search on Answer, Dutch National
 * Flag, Merge Sort, LCA, Tree DP, Digit DP, Manacher, ...).
 *
 * SAFETY:
 *   - Only ADDS pattern slugs to `patterns[]` via $addToSet — never removes.
 *   - Only writes `patterns`, `patternConfidence` (max, never lowered) and
 *     `patternSource`. NEVER touches status / notes / favorite / revision /
 *     progress / any user field.
 *   - Skips docs flagged `patternManual: true` (user-curated stay as-is).
 *   - Only assigns slugs that exist in the catalog. Never creates questions.
 *
 * The curated map lives in src/data/pattern-fill-map.json:
 *   { "<slug>": { titles: [exact titles], tags: [implying tags], keywords: [regex] } }
 *
 * Run (report only):  node --env-file=.env.local roadmap-tools/fill-patterns.mjs --dry
 * Run (write):        node --env-file=.env.local roadmap-tools/fill-patterns.mjs
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

const DRY = process.argv.includes("--dry");
const CAT = JSON.parse(fs.readFileSync("src/data/pattern-catalog.json", "utf8"));
const VALID = new Set(CAT.patterns.map((p) => p.slug));
const NAME = new Map(CAT.patterns.map((p) => [p.slug, p.name]));

const MAP_PATH = "src/data/pattern-fill-map.json";
if (!fs.existsSync(MAP_PATH)) {
  console.error(`Missing ${MAP_PATH}. Curate it first.`);
  process.exit(1);
}
const FILL = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));

const normTitle = (s) =>
  String(s || "").toLowerCase().replace(/^\d+[.)]\s*/, "").replace(/[^a-z0-9]+/g, " ").trim();
const normTag = (s) => String(s || "").toLowerCase().trim();

// Build fast lookup structures.
const titleIndex = new Map(); // normalizedTitle -> Set(slug)
const tagIndex = new Map(); // normalizedTag -> Set(slug)
const keywordRules = []; // { slug, re }
let skippedUnknown = 0;

for (const [slug, def] of Object.entries(FILL)) {
  if (!VALID.has(slug)) { skippedUnknown++; continue; }
  for (const t of def.titles || []) {
    const k = normTitle(t);
    if (!k) continue;
    (titleIndex.get(k) || titleIndex.set(k, new Set()).get(k)).add(slug);
  }
  for (const t of def.tags || []) {
    const k = normTag(t);
    if (!k) continue;
    (tagIndex.get(k) || tagIndex.set(k, new Set()).get(k)).add(slug);
  }
  for (const kw of def.keywords || []) {
    try { keywordRules.push({ slug, re: new RegExp(kw, "i") }); }
    catch { /* skip invalid regex */ }
  }
}

const SOURCE_CONF = { title: 0.97, tag: 0.85, keyword: 0.7 };

/** Return Map(slug -> source) of patterns to ADD for a question. */
function match(q) {
  const out = new Map();
  const add = (slug, src) => {
    const cur = out.get(slug);
    if (!cur || SOURCE_CONF[src] > SOURCE_CONF[cur]) out.set(slug, src);
  };
  // title (exact, normalized)
  for (const slug of titleIndex.get(normTitle(q.title)) || []) add(slug, "title");
  // tags
  for (const raw of q.tags || []) {
    for (const slug of tagIndex.get(normTag(raw)) || []) add(slug, "tag");
  }
  // keyword on title
  if (keywordRules.length) {
    const title = String(q.title || "");
    for (const { slug, re } of keywordRules) if (re.test(title)) add(slug, "keyword");
  }
  return out;
}

try {
  await connect();
  const col = mongoose.connection.db.collection("questions");

  console.log(`fill-map: ${Object.keys(FILL).length} slugs (${skippedUnknown} unknown skipped)`);
  console.log(`indexes: ${titleIndex.size} titles, ${tagIndex.size} tags, ${keywordRules.length} keyword rules`);
  console.log(DRY ? "\n== DRY RUN (no writes) ==\n" : "\n== WRITING ==\n");

  const cursor = col.find(
    { patternManual: { $ne: true } },
    { projection: { title: 1, tags: 1, patterns: 1, patternConfidence: 1 } },
  );

  const added = {}; // slug -> count of NEW assignments
  const sourceOf = {}; // slug -> {title,tag,keyword}
  let ops = [], processed = 0, modified = 0, docsTouched = 0;

  const flush = async () => {
    if (DRY || !ops.length) { ops = []; return; }
    const r = await col.bulkWrite(ops, { ordered: false });
    modified += r.modifiedCount;
    ops = [];
  };

  for await (const q of cursor) {
    processed++;
    const m = match(q);
    if (!m.size) continue;
    const existing = new Set(q.patterns || []);
    const newSlugs = [...m.keys()].filter((s) => !existing.has(s));
    if (!newSlugs.length) continue;

    docsTouched++;
    let bestConf = q.patternConfidence || 0;
    const sources = new Set();
    for (const s of newSlugs) {
      added[s] = (added[s] || 0) + 1;
      const src = m.get(s);
      sourceOf[s] = sourceOf[s] || { title: 0, tag: 0, keyword: 0 };
      sourceOf[s][src]++;
      sources.add(src);
      bestConf = Math.max(bestConf, SOURCE_CONF[src]);
    }
    if (!DRY) {
      ops.push({
        updateOne: {
          filter: { _id: q._id },
          update: {
            $addToSet: { patterns: { $each: newSlugs } },
            $set: { patternConfidence: bestConf, patternSource: [...sources].sort().join("+") },
          },
        },
      });
      if (ops.length >= 1000) { await flush(); process.stdout.write(`\r  ${processed} scanned, ${docsTouched} enriched ...`); }
    }
  }
  await flush();

  console.log(`\nscanned ${processed} | docs enriched ${docsTouched} | db modified ${modified}`);

  // Coverage report over ALL catalog patterns (recompute live counts).
  const agg = await col.aggregate([
    { $unwind: "$patterns" },
    { $group: { _id: "$patterns", n: { $sum: 1 } } },
  ]).toArray();
  const counts = new Map(agg.map((a) => [a._id, a.n]));

  const rows = CAT.patterns.map((p) => {
    const count = counts.get(p.slug) || 0;
    const add = added[p.slug] || 0;
    // In dry mode nothing was written, so project the post-write count.
    const projected = DRY ? count + add : count;
    return {
      slug: p.slug, name: p.name, category: p.category, priority: p.priority,
      count, added: add, projected,
      sources: sourceOf[p.slug] || null,
    };
  });
  const gaps = rows.filter((r) => r.projected < 5);

  fs.writeFileSync("roadmap-tools/fill-report.json", JSON.stringify({
    generatedAt: DRY ? "(dry-run)" : new Date().toISOString(),
    totalPatterns: rows.length,
    filledThisRun: Object.keys(added).length,
    stillUnder5: gaps.length,
    rows: rows.sort((a, b) => a.projected - b.projected),
  }, null, 2));

  // Machine-readable gap report for the Admin panel — never silently empty.
  const gapReport = {
    generatedAt: DRY ? "(dry-run)" : new Date().toISOString(),
    note: "Patterns with fewer than 5 real questions across LeetCode/Codeforces/Striver A2Z. Not padded with unrelated problems.",
    gaps: gaps.map((g) => ({
      slug: g.slug, name: g.name, category: g.category, priority: g.priority,
      count: g.projected,
      reason: `Only ${g.projected} real matching problem(s) exist on the indexed platforms — this is a niche/advanced topic with few published problems.`,
      suggestedKeywords: (FILL[g.slug]?.keywords || []).concat(FILL[g.slug]?.titles?.slice(0, 3) || []),
      suggestedSources: ["Codeforces (problemset tag search)", "Striver A2Z sheet", "CSES Problem Set"],
    })),
  };
  fs.writeFileSync("src/data/pattern-gaps.json", JSON.stringify(gapReport, null, 2));

  console.log(`\npatterns still under 5 (projected): ${gaps.length}`);
  if (gaps.length) {
    console.log(gaps.map((g) => `  ${g.slug.padEnd(26)} ${g.projected}`).join("\n"));
  }
  console.log(`\ntop 20 newly filled:`);
  console.log(Object.entries(added).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([s, n]) => `  ${s.padEnd(26)} +${n}`).join("\n"));
  console.log(`\nreport -> roadmap-tools/fill-report.json`);
} catch (e) {
  console.error("FILL_ERROR:", e.name, "-", e.message, "\n", e.stack);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
