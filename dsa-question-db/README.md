# DSA Question Database — LeetCode + Codeforces + Striver A2Z

A reproducible pipeline that builds a **structured, deduplicated DSA question database** from
**official sources**, normalizes it across platforms, maps the **Striver A2Z** sheet, and pushes
it into **MongoDB** — ready to power search, filtering, progress tracking, and incremental updates.

> Current build: **15,267 problems** — 3,985 LeetCode + 11,282 Codeforces, with 224 mapped to the
> Striver A2Z sheet. (Counts grow as the platforms add problems; just re-run the build.)

---

## The one thing to understand first: real vs. derived vs. blank

This project **does not hallucinate**. At the scale of ~15k problems, the only honest way to satisfy
"official metadata only" is to **fetch live from official APIs**, not hand-author JSON. So every field
falls into exactly one of three buckets:

| Bucket | Fields | Where it comes from |
|---|---|---|
| **Real / official** | `title`, `url`, `problemId`, `platform`, `tags`, LeetCode `difficulty` + `acceptanceRate` + `premium`, Codeforces `rating` + `contest` + `problemIndex` + `popularity` (solved count) | Pulled directly from the official [LeetCode GraphQL](https://leetcode.com/graphql) and [Codeforces API](https://codeforces.com/apiHelp) at run time. |
| **Derived (deterministic)** | `topic`, `subtopic`, `pattern`, `dataStructure`, `primaryAlgorithm`, `categories`, `learningLevel`, normalized `difficulty` (Codeforces), Striver placement | A **fixed function of the official tags/difficulty** (see `src/normalize.js`). Reproducible, documented, never invented per-problem. Listed per-record in `derivedFields`. |
| **Blank (for later enrichment)** | `summary`, `notes`, `timeComplexity`, `spaceComplexity`, `prerequisites`, `similarQuestions`, `companies`, `commonMistakes`, `alternativeApproaches` | The official public APIs **do not expose these** (company tags are LeetCode-premium; per-problem complexity/notes are editorial). Left empty rather than faked. The importer preserves anything you fill in later — see [Enrichment-safe updates](#enrichment-safe-updates). |

No problem statements are copied — metadata only (respects platform copyright).

---

## Quick start

```bash
cd dsa-question-db
npm install                      # installs the mongodb driver (build itself needs no deps)

npm run build                    # live crawl -> writes data/*.  (~1 min)
# or, no network, rebuild from cached raw responses:
npm run build:cache
# or a quick 300-problem smoke test:
npm run build:sample

cp .env.example .env             # set MONGODB_URI (defaults to localhost)
npm run import                   # idempotent push into MongoDB
```

Requires **Node ≥ 20.6** (uses built-in `fetch` and `--env-file`).

---

## Outputs (the "sheet")

All written to `data/`:

| File | Use |
|---|---|
| **`dsa-questions.ndjson`** | **The push-ready sheet.** One JSON doc per line — feed to the importer or `mongoimport`. |
| `dsa-questions.json` | Same data as a single array (programmatic use / inspection). |
| `dsa-questions.csv` | Flat spreadsheet view (open in Excel/Sheets). |
| `dsa-questions.sample.json` | ~60 representative records to eyeball the schema. |
| `stats.json` | Totals by platform / difficulty / topic + Striver per-step counts. |
| `raw/` | Cached raw API responses (so `--from-cache` needs no network). |

---

## Pushing to MongoDB

**Option A — the importer (recommended):**

```bash
npm run import
```

Idempotent bulk upsert keyed on a stable `_id` (`leetcode:<slug>` / `codeforces:<contestId><index>`),
creates indexes for search/filtering, and is **safe to re-run**.

**Option B — mongoimport:**

```bash
mongoimport --uri "$MONGODB_URI" --db dsa --collection questions \
  --file data/dsa-questions.ndjson --mode upsert --upsertFields _id
```

### Enrichment-safe updates

The importer splits every document into two update operators:

- **`$set`** — official + derived fields → **refreshed on every run** (ratings, acceptance, tags, classification).
- **`$setOnInsert`** — the enrichable fields → **written once, never overwritten**.

So you can hand-add `companies`, `notes`, `timeComplexity`, etc. directly in Mongo (or via your admin UI),
re-run the build weekly to pick up new problems and updated stats, and **your manual work survives**.
New problems are inserted; existing ones are updated in place. Verify the transform without a DB:

```bash
node src/importToMongo.js --dry-run
```

### Indexes created

`platform`, `difficulty`, `learningLevel`, `topic`, `tags` (multikey), `rating`, `companies` (multikey),
`premium`, a compound `{isStriverQuestion, striverStepNo, striverOrder}` (Striver-ordered study), and a
text index over `title`/`topic`/`tags`.

---

## Striver A2Z coverage

- The **18-step structure** (`src/striverData.js` → `STRIVER_STEPS`) is authoritative.
- **224 A2Z problems that are LeetCode problems** are mapped by verified slug. Their difficulty/tags are
  **inherited from the official LeetCode record** (not re-typed), and they carry
  `striverStep`, `striverStepNo`, `striverSubtopic`, `striverOrder`, `recommendedByStriver`.
- A2Z items that are **not** on LeetCode (GfG/CodingNinjas basics, sorting internals, a few LL/graph items)
  are intentionally **omitted** rather than guessed.

**To ingest the complete ~455-item sheet** (including non-LeetCode items), set `STRIVER_SHEET_URL` in `.env`
to a JSON mirror. Expected item shape (flexible keys accepted):

```json
{ "slug": "two-sum", "url": "https://leetcode.com/problems/two-sum/",
  "step": "Solve Problems on Arrays", "stepNo": 3, "subtopic": "Arrays [Easy]", "order": 1 }
```

The builder merges it over the built-in seed (curated seed wins on conflicts) and creates standalone
records for non-LeetCode links.

---

## Schema (per document)

```jsonc
{
  "_id": "leetcode:koko-eating-bananas",   // stable dedupe key
  "title": "Koko Eating Bananas",
  "platform": "leetcode",                   // leetcode | codeforces | gfg | ...
  "problemId": "875",
  "slug": "koko-eating-bananas",
  "url": "https://leetcode.com/problems/koko-eating-bananas/",
  "difficulty": "Medium",                   // normalized: Easy|Medium|Hard|Expert|Unrated
  "platformDifficulty": "Medium",           // raw (LC label or CF rating)
  "rating": null,                           // Codeforces numeric rating
  "contest": "", "contestId": null, "problemIndex": "",
  "acceptanceRate": 50.22,                  // LeetCode %
  "popularity": null,                       // Codeforces solved count
  "premium": false,
  "tags": ["Array","Binary Search"],        // official platform tags, verbatim
  "topic": "Binary Search", "subtopic": "Arrays", "pattern": "Binary Search",
  "dataStructure": "Arrays", "primaryAlgorithm": "Binary Search", "secondaryAlgorithm": "",
  "categories": ["Arrays","Binary Search"],
  "learningLevel": "Intermediate",          // Beginner|Intermediate|Advanced|Expert
  "summary": "", "notes": "",               // enrichable (blank; preserved on re-import)
  "timeComplexity": "", "spaceComplexity": "",
  "prerequisites": [], "similarQuestions": [], "companies": [],
  "commonMistakes": [], "alternativeApproaches": [],
  "isStriverQuestion": true, "recommendedByStriver": true,
  "striverStep": "Binary Search", "striverStepNo": 4,
  "striverTopic": "Binary Search", "striverSubtopic": "BS on Answers",
  "striverOrder": 35, "striverRevisionLevel": 0,
  "source": { "leetcode": "...", "codeforces": "", "striver": "..." },
  "metaSource": "official",
  "derivedFields": ["difficulty","topic","subtopic", "..." ],
  "lastUpdated": "2026-07-10T...Z"
}
```

---

## Normalization conventions (documented, not official)

- **Codeforces rating → difficulty/level** (`src/config.js` → `CF_DIFFICULTY_BANDS`):
  `≤1200 Easy/Beginner`, `1201–1600 Medium/Intermediate`, `1601–2100 Hard/Advanced`, `≥2101 Expert`.
  Codeforces has no official Easy/Medium/Hard — this is our normalization so both platforms share one scale.
- **`topic`** is the single highest-priority match from `TOPIC_PRIORITY`; **`categories`** keeps *all* matched
  topics. When a problem's headline topic looks debatable (e.g. a Linked List problem also tagged Recursion),
  trust `categories` — `topic` is a best-effort deterministic pick.
- Tune any of this by editing `src/normalize.js`; re-run `npm run build:cache` (no re-crawl needed).

---

## Project layout

```
dsa-question-db/
├─ src/
│  ├─ config.js         # endpoints, thresholds, paths, env
│  ├─ utils.js          # fetch-with-retry, file IO, CSV
│  ├─ normalize.js      # tag→topic maps, difficulty bands, classify()
│  ├─ striverData.js    # authoritative 18 steps + 224-slug seed
│  ├─ fetchLeetcode.js  # official GraphQL, paginated + cached
│  ├─ fetchCodeforces.js# official API + contest names + solved counts
│  ├─ buildDataset.js   # orchestrate → normalize → dedupe → emit files
│  └─ importToMongo.js  # idempotent, enrichment-safe upsert + indexes
├─ data/                # generated outputs
├─ .env.example
└─ package.json
```

## Updating

Re-run `npm run build` (new problems + refreshed stats) then `npm run import`. Existing docs update in
place; new ones insert; your enrichments are preserved. Wire it to a weekly cron for a self-maintaining set.
