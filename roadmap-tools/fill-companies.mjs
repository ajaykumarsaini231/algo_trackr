/**
 * Idempotent company enrichment. Matches DB questions to companies by LeetCode
 * slug using src/data/company-map.json (built from public datasets) and:
 *   - $addToSet real company names onto `companies` (string[] the UI reads) —
 *     never removes, so manually-added companies are preserved.
 *   - merges rich `companyMeta` [{name, confidence, sources, frequency,
 *     importVersion, lastUpdated, importedBy, manual}] keeping the HIGHEST
 *     confidence and unioning sources; entries flagged `manual:true` are never
 *     overwritten.
 *   - NEVER touches notes / favorite / status / revision / progress / tags.
 *
 * Run (report):  node --env-file=.env.local roadmap-tools/fill-companies.mjs --dry
 * Run (write):   node --env-file=.env.local roadmap-tools/fill-companies.mjs
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connect } from "./connect.mjs";

const DRY = process.argv.includes("--dry");
const IMPORT_VERSION = "2026.07.1";
const IMPORTED_BY = "public-datasets:krishnadey30+liquidslr";
const NOW = new Date().toISOString();

const MAP = JSON.parse(fs.readFileSync("src/data/company-map.json", "utf8"));
const slugOf = (link) => {
  const m = String(link || "").trim().match(/problems\/([^/\s?]+)/);
  return m ? m[1].toLowerCase() : "";
};

/** Merge existing companyMeta (preserve manual) with imported entries. */
function mergeMeta(existing, imported) {
  const byName = new Map();
  // keep manual entries first (protected)
  for (const e of existing || []) if (e && e.manual) byName.set(e.name, e);
  // keep prior non-manual entries so nothing is lost across partial re-runs
  for (const e of existing || []) if (e && !e.manual && !byName.has(e.name)) byName.set(e.name, e);
  // apply imports: raise confidence, union sources, never touch manual
  for (const imp of imported) {
    const prev = byName.get(imp.name);
    if (prev && prev.manual) continue;
    if (prev) {
      byName.set(imp.name, {
        ...prev,
        confidence: Math.max(prev.confidence || 0, imp.confidence),
        sources: [...new Set([...(prev.sources || []), ...imp.sources])],
        frequency: Math.max(prev.frequency || 0, imp.frequency),
        importVersion: IMPORT_VERSION,
        lastUpdated: NOW,
        importedBy: IMPORTED_BY,
      });
    } else {
      byName.set(imp.name, {
        name: imp.name, confidence: imp.confidence, sources: imp.sources,
        frequency: imp.frequency, importVersion: IMPORT_VERSION,
        lastUpdated: NOW, importedBy: IMPORTED_BY, manual: false,
      });
    }
  }
  return [...byName.values()];
}

try {
  await connect();
  const col = mongoose.connection.db.collection("questions");

  console.log(`company-map: ${Object.keys(MAP).length} problems`);
  console.log(DRY ? "\n== DRY RUN (no writes) ==\n" : "\n== WRITING ==\n");

  const cursor = col.find(
    { problemLink: /leetcode\.com\/problems\// },
    { projection: { problemLink: 1, difficulty: 1, companies: 1, companyMeta: 1 } },
  );

  const perCompany = {}; // name -> {total, Easy, Medium, Hard, confSum}
  let ops = [], scanned = 0, matched = 0, docsTouched = 0, newTags = 0;
  const flush = async () => {
    if (DRY || !ops.length) { ops = []; return; }
    const r = await col.bulkWrite(ops, { ordered: false });
    ops = [];
    return r;
  };

  for await (const q of cursor) {
    scanned++;
    const slug = slugOf(q.problemLink);
    const entry = slug && MAP[slug];
    if (!entry) continue;
    matched++;

    const existingNames = new Set(q.companies || []);
    const addNames = entry.companies.map((c) => c.name).filter((n) => !existingNames.has(n));
    const meta = mergeMeta(q.companyMeta, entry.companies);

    // tally (per matched doc, count each company once)
    for (const c of entry.companies) {
      const t = (perCompany[c.name] ||= { total: 0, Easy: 0, Medium: 0, Hard: 0, confSum: 0 });
      t.total++;
      if (q.difficulty === "Easy" || q.difficulty === "Medium" || q.difficulty === "Hard") t[q.difficulty]++;
      t.confSum += c.confidence;
    }
    if (addNames.length) newTags += addNames.length;
    if (addNames.length || !DRY) docsTouched++;

    if (!DRY) {
      const update = { $set: { companyMeta: meta } };
      if (addNames.length) update.$addToSet = { companies: { $each: addNames } };
      ops.push({ updateOne: { filter: { _id: q._id }, update } });
      if (ops.length >= 1000) { await flush(); process.stdout.write(`\r  ${scanned} scanned, ${matched} matched ...`); }
    }
  }
  await flush();

  console.log(`\nscanned ${scanned} LeetCode docs | matched ${matched} | new company tags added ${newTags}`);

  // Coverage report
  const rows = Object.entries(perCompany).map(([name, t]) => ({
    company: name, total: t.total, easy: t.Easy, medium: t.Medium, hard: t.Hard,
    avgConfidence: t.total ? Math.round(t.confSum / t.total) : 0,
  })).sort((a, b) => b.total - a.total);

  const under5 = rows.filter((r) => r.total < 5).map((r) => `${r.company}:${r.total}`);
  const lowConf = rows.filter((r) => r.avgConfidence < 70).map((r) => `${r.company}:${r.avgConfidence}`);

  fs.writeFileSync("roadmap-tools/company-report.json", JSON.stringify({
    generatedAt: DRY ? "(dry-run)" : NOW,
    importVersion: IMPORT_VERSION,
    matchedQuestions: matched,
    companies: rows.length,
    under5, lowConfidence: lowConf,
    rows,
  }, null, 2));

  console.log(`\ncompanies covered in DB: ${rows.length}`);
  console.log("top 15 (company | total | E/M/H | avgConf):");
  for (const r of rows.slice(0, 15))
    console.log(`  ${r.company.padEnd(16)} ${String(r.total).padStart(4)}  ${r.easy}/${r.medium}/${r.hard}  conf ${r.avgConfidence}`);
  if (under5.length) console.log(`\ncompanies under 5 matched: ${under5.join(", ")}`);
  console.log(`\nreport -> roadmap-tools/company-report.json`);
} catch (e) {
  console.error("FILL_COMPANIES_ERROR:", e.name, "-", e.message, "\n", e.stack);
  process.exitCode = 2;
} finally {
  await mongoose.disconnect().catch(() => {});
}
