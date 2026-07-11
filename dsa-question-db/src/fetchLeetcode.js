// Fetch the full public LeetCode problem list via the official GraphQL endpoint.
// Only public list metadata is read (title, difficulty, acceptance, premium flag, tags).
import path from "node:path";
import { LC_ENDPOINT, LC_PAGE, RAW_DIR, UA, REQUEST_DELAY_MS } from "./config.js";
import { fetchJson, writeJson, readJson, exists, sleep } from "./utils.js";

const RAW_FILE = path.join(RAW_DIR, "leetcode.json");

const QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      questionFrontendId
      title
      titleSlug
      isPaidOnly
      topicTags { name slug }
    }
  }
}`;

async function fetchPage(skip, limit) {
  const body = JSON.stringify({
    query: QUERY,
    variables: { categorySlug: "all-code-essentials", skip, limit, filters: {} },
  });
  const { json } = await fetchJson(LC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com/problemset/all/",
      "User-Agent": UA,
    },
    body,
  });
  if (json.errors) throw new Error("LeetCode GraphQL: " + JSON.stringify(json.errors).slice(0, 200));
  return json.data.problemsetQuestionList;
}

export async function fetchLeetcode({ fromCache = false, limit = Infinity } = {}) {
  if (fromCache && exists(RAW_FILE)) {
    console.log("  [lc] using cache");
    return readJson(RAW_FILE);
  }

  const first = await fetchPage(0, LC_PAGE);
  const total = Math.min(first.total, limit);
  const all = [...first.questions];
  console.log(`  [lc] total=${first.total}, fetching up to ${total} ...`);

  for (let skip = LC_PAGE; skip < total; skip += LC_PAGE) {
    await sleep(REQUEST_DELAY_MS);
    const page = await fetchPage(skip, LC_PAGE);
    all.push(...page.questions);
    if (skip % 1000 === 0) console.log(`  [lc] ${all.length}/${total}`);
  }

  const rows = all.slice(0, total).map((q) => ({
    questionFrontendId: q.questionFrontendId,
    title: q.title,
    titleSlug: q.titleSlug,
    difficulty: q.difficulty, // Easy | Medium | Hard
    acRate: q.acRate,
    isPaidOnly: q.isPaidOnly,
    tags: (q.topicTags || []).map((t) => t.name),
  }));

  writeJson(RAW_FILE, rows, false);
  console.log(`  [lc] fetched ${rows.length} problems`);
  return rows;
}
