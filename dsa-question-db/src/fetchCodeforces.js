// Fetch the full Codeforces problemset from the official API.
// Docs: https://codeforces.com/apiHelp/methods#problemset.problems
import path from "node:path";
import { CF_PROBLEMS, CF_CONTESTS, RAW_DIR, UA } from "./config.js";
import { fetchJson, writeJson, readJson, exists } from "./utils.js";

const RAW_FILE = path.join(RAW_DIR, "codeforces.json");

export async function fetchCodeforces({ fromCache = false } = {}) {
  if (fromCache && exists(RAW_FILE)) {
    console.log("  [cf] using cache");
    return readJson(RAW_FILE);
  }

  console.log("  [cf] GET problemset.problems ...");
  const { json } = await fetchJson(CF_PROBLEMS, { headers: { "User-Agent": UA } });
  if (json.status !== "OK") throw new Error(`Codeforces API error: ${json.comment || json.status}`);

  const { problems, problemStatistics } = json.result;

  // solvedCount ("popularity") aligns with problems by contestId+index.
  const statByKey = new Map();
  for (const s of problemStatistics || []) statByKey.set(`${s.contestId}-${s.index}`, s.solvedCount);

  // Map contestId -> contest name (best-effort; failure is non-fatal).
  let contestName = new Map();
  try {
    console.log("  [cf] GET contest.list (for contest names) ...");
    const { json: cj } = await fetchJson(`${CF_CONTESTS}?gym=false`, { headers: { "User-Agent": UA } });
    if (cj.status === "OK") for (const c of cj.result) contestName.set(c.id, c.name);
  } catch (e) {
    console.warn("  [cf] contest.list failed (names skipped):", e.message);
  }

  const rows = problems
    .filter((p) => p.contestId != null && p.index) // skip malformed entries
    .map((p) => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating ?? null,
      tags: p.tags || [],
      solvedCount: statByKey.get(`${p.contestId}-${p.index}`) ?? null,
      contestName: contestName.get(p.contestId) || "",
    }));

  writeJson(RAW_FILE, rows, false);
  console.log(`  [cf] fetched ${rows.length} problems`);
  return rows;
}
