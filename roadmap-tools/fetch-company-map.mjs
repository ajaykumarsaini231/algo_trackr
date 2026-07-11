/**
 * Build src/data/company-map.json from trusted PUBLIC community datasets:
 *   1. krishnadey30/LeetCode-Questions-CompanyWise  (per-company *_alltime.csv)
 *   2. liquidslr/leetcode-company-wise-problems      (per-company "5. All.csv")
 *
 * Matches problems by LeetCode slug, merges the two sources, and derives a
 * confidence per (problem, company) from within-company frequency rank + how
 * many sources agree. NEVER invents mappings — only what the datasets contain.
 *
 * Output keyed by slug:
 *   { "<slug>": { title, difficulty, companies: [{name, confidence, sources, frequency}] } }
 *
 * Run: node roadmap-tools/fetch-company-map.mjs
 */
import fs from "node:fs";

const KRISH = (key) =>
  `https://raw.githubusercontent.com/krishnadey30/LeetCode-Questions-CompanyWise/master/${key}_alltime.csv`;
const LIQUID_ROOT =
  "https://api.github.com/repos/liquidslr/leetcode-company-wise-problems/contents";
const LIQUID_CSV = (folder) =>
  `https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main/${encodeURIComponent(folder)}/5.%20All.csv`;

// display name -> krishnadey30 file key (null = not in that dataset, use liquidslr)
const TARGETS = {
  Google: "google", Amazon: "amazon", Microsoft: "microsoft", Meta: "facebook",
  Adobe: "adobe", Apple: "apple", Atlassian: "atlassian", Uber: "uber",
  Oracle: "oracle", Bloomberg: "bloomberg", "Goldman Sachs": "goldman-sachs",
  Nvidia: "nvidia", Visa: "visa", Qualcomm: "qualcomm", Salesforce: "salesforce",
  Netflix: "netflix", LinkedIn: "linkedin", Flipkart: "flipkart", Walmart: "walmart",
  Samsung: "samsung", Cisco: "cisco", Intel: "intel", PayPal: "paypal",
  Twilio: "twilio", Airbnb: "airbnb", DoorDash: "doordash", Spotify: "spotify",
  TikTok: null, ByteDance: "bytedance", Snap: "snapchat", Pinterest: "pinterest",
  ServiceNow: "servicenow", VMware: "vmware", Expedia: "expedia", Booking: "booking",
  Palantir: "palantir", Databricks: "databricks", Cloudflare: null, Stripe: null,
  OpenAI: null, Tesla: "tesla",
  // companies already in the app's COMPANIES constant:
  "Media.net": "medianet", "DE Shaw": "de-shaw", Intuit: "intuit",
  Sprinklr: null, Directi: null,
};

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugFromLink = (link) => {
  const m = String(link || "").trim().match(/problems\/([^/\s?]+)/);
  return m ? m[1].toLowerCase() : "";
};

async function fetchText(url) {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "dsa-tracker-import", accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** CSV parser: quoted fields, escaped quotes, embedded commas/newlines. */
function parseCSV(text) {
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); f = ""; row = [];
    } else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim() !== ""));
  if (!clean.length) return [];
  const headers = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

const minmax = (vals) => {
  const nums = vals.filter((v) => Number.isFinite(v));
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return (v) => (hi > lo ? (v - lo) / (hi - lo) : 0.6);
};

async function pool(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// ---- discover liquidslr folders ----
console.log("discovering liquidslr companies…");
let liquidFolders = [];
const rootJson = await fetchText(LIQUID_ROOT);
if (rootJson) {
  try {
    liquidFolders = JSON.parse(rootJson).filter((e) => e.type === "dir").map((e) => e.name);
  } catch { /* ignore */ }
}
const liquidByNorm = new Map(liquidFolders.map((f) => [norm(f), f]));
function liquidFolderFor(name) {
  const n = norm(name);
  if (liquidByNorm.has(n)) return liquidByNorm.get(n);
  for (const [fn, folder] of liquidByNorm) if (fn.startsWith(n) && n.length >= 4) return folder;
  return null;
}
console.log(`  liquidslr folders: ${liquidFolders.length}`);

// slug -> { title, difficulty, companies: Map(name -> {sources:Set, freqNorm}) }
const slugMap = new Map();
const perCompany = {}; // name -> count
const missing = [];

const names = Object.keys(TARGETS);
await pool(names, 6, async (name) => {
  const krishKey = TARGETS[name];
  const problems = new Map(); // slug -> { title, difficulty, freqK, freqL }

  if (krishKey) {
    const csv = await fetchText(KRISH(krishKey));
    if (csv) for (const r of parseCSV(csv)) {
      const slug = slugFromLink(r["Leetcode Question Link"] || r["Link"]);
      if (!slug) continue;
      const p = problems.get(slug) || { title: r.Title, difficulty: (r.Difficulty || "").trim() };
      p.freqK = parseFloat(r.Frequency);
      problems.set(slug, p);
    }
  }

  const folder = liquidFolderFor(name);
  if (folder) {
    const csv = await fetchText(LIQUID_CSV(folder));
    if (csv) for (const r of parseCSV(csv)) {
      const slug = slugFromLink(r["Link"]);
      if (!slug) continue;
      const p = problems.get(slug) || { title: r.Title, difficulty: (r.Difficulty || "").trim() };
      p.freqL = parseFloat(r.Frequency);
      if (!p.title) p.title = r.Title;
      if (!p.difficulty) p.difficulty = (r.Difficulty || "").trim();
      problems.set(slug, p);
    }
  }

  if (!problems.size) { missing.push(name); return; }

  const normK = minmax([...problems.values()].map((p) => p.freqK));
  const normL = minmax([...problems.values()].map((p) => p.freqL));

  for (const [slug, p] of problems) {
    const sources = [];
    let freq = 0;
    if (Number.isFinite(p.freqK)) { sources.push("krishnadey30"); freq = Math.max(freq, normK(p.freqK)); }
    if (Number.isFinite(p.freqL)) { sources.push("liquidslr"); freq = Math.max(freq, normL(p.freqL)); }
    const base = sources.length >= 2 ? 88 : 80;
    const confidence = Math.max(55, Math.min(99, Math.round(base + freq * 11)));

    const entry = slugMap.get(slug) || { title: p.title, difficulty: p.difficulty, companies: [] };
    if (!entry.title && p.title) entry.title = p.title;
    if (!entry.difficulty && p.difficulty) entry.difficulty = p.difficulty;
    entry.companies.push({ name, confidence, sources, frequency: Math.round(freq * 100) / 100 });
    slugMap.set(slug, entry);
  }
  perCompany[name] = problems.size;
});

const out = {};
for (const [slug, v] of slugMap) out[slug] = v;
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/company-map.json", JSON.stringify(out, null, 2));

const totalMappings = [...slugMap.values()].reduce((s, v) => s + v.companies.length, 0);
console.log(`\nwrote src/data/company-map.json`);
console.log(`unique problems: ${slugMap.size} | company-mappings: ${totalMappings}`);
console.log(`companies with data: ${Object.keys(perCompany).length}`);
console.log(`companies with NO data: ${missing.length ? missing.join(", ") : "none"}`);
console.log("\nper-company problem counts:");
for (const [n, c] of Object.entries(perCompany).sort((a, b) => b[1] - a[1]))
  console.log(`  ${n.padEnd(16)} ${c}`);
