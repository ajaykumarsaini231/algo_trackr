# 04 · Database Schema (MongoDB + Mongoose)

Covers **#47 database schema · #46 auth models**. Written in your existing conventions: `Schema` + `InferSchemaType`, the `models.X || model<T>()` guard, `timestamps`, deliberate indexes, and the **no-delete / `archived`** rule. Keep Mongoose — this doc does **not** migrate you to Prisma.

## Collection map

| Collection | Status | Purpose |
|---|---|---|
| `questions` | ✏️ extend | Shared problem catalog (+ `slug`, `ratingNumber`, editorial refs) |
| `user_progress` | ✅ keep | Per-user state (already ideal) |
| `users` | ✏️ extend | Accounts (+ profile, streak, gamification, prefs) |
| `admins`, `failed_attempts`, `taxonomy` | ✅ keep | Existing |
| `content` | ➕ new | Blog posts, lessons, algorithm refs, glossary (CMS body) |
| `authors` | ➕ new | EEAT bylines (`Person` schema source) |
| `companies` | ➕ new | Company hub metadata + rounds + prep plans |
| `roadmaps` | ➕ new | Roadmap DAG nodes/edges |
| `sheets` | ✏️ formalize | Curated ladders (some currently code-defined) |
| `slug_redirects` | ➕ new | 301 map (honours no-delete on renames) |
| `srs_cards` | ➕ new | Spaced-repetition scheduling (revision v2) |
| `mock_interviews` | ➕ new | AI mock sessions + transcript + rubric |
| `ai_interactions` | ➕ new | Hints/explain/review/doubt log (rate-limit, abuse, analytics) |
| `achievements`, `user_achievements` | ➕ new | Badge catalog + unlock ledger |
| `activities` | ✏️ formalize | Heatmap/streak event log |
| `submissions` | ➕ new | Practice run/submit results |
| `playlists` | ➕ new | User-curated lists |
| `contests`, `contest_entries` | ➕ new | Contest archive + standings |
| `notifications` | ➕ new | In-app + reminder fan-out |
| `search_index` | ➕ optional | Denormalized doc for instant search |

---

## 1. Extend `Question` (public URLs + richer signals)

Additive fields on the existing schema in `src/models/Question.ts` (no removals):

```ts
// --- Public content plane (additive) ---
slug:          { type: String, index: true, unique: true, sparse: true }, // canonical public URL id
ratingNumber:  { type: Number, default: 0, index: true },   // CF-style numeric difficulty (800–3500)
acceptanceRate:{ type: Number, default: 0 },                // display + "commonly asked" signal
frequencyScore:{ type: Number, default: 0, index: true },   // how often company-asked (drives sort)
statementHtml: { type: String, default: "" },              // sanitized public statement (if licensed/original)
examples:      { type: [{ input: String, output: String, explanation: String }], default: [] },
constraints:   { type: [String], default: [] },
hints:         { type: [String], default: [] },            // progressive hint ladder (public + AI seed)
editorialId:   { type: Schema.Types.ObjectId, ref: "Content", default: null },
relatedSlugs:  { type: [String], default: [] },            // curated "related problems"
sheetKeys:     { type: [String], default: [], index: true },// which sheets include it
lastVerifiedAt:{ type: Date, default: null },              // EEAT freshness
```

```ts
// Public list sort (index): non-archived, by frequency then rating
QuestionSchema.index({ archived: 1, frequencyScore: -1, ratingNumber: 1 });
```

> ⚠️ **Licensing:** don't republish other platforms' full statements. For LeetCode/CF-sourced rows, the public page shows *your* metadata (tags, patterns, complexity, approach summary, links out) — original prose only where you authored it. `statementHtml` is used only for problems you own or that are open-licensed. See doc 10 §EEAT.

**Backfill:** `scripts/backfill-slugs.mjs` — generate `slug` via existing `slugify(title)`, de-dupe with `-2`, `-3`; write a `slug_redirects` entry when a slug changes. Idempotent, never deletes.

---

## 2. Extend `User` (profile · streak · gamification · prefs)

Additive to your existing Auth.js `User` model:

```ts
// --- Public profile (indexable at /u/[username]) ---
username:     { type: String, index: true, unique: true, sparse: true, lowercase: true, trim: true },
displayName:  { type: String, default: "" },
avatarUrl:    { type: String, default: "" },
bio:          { type: String, default: "", maxlength: 280 },
country:      { type: String, default: "" },
socials:      { github: String, linkedin: String, website: String, x: String },
isProfilePublic: { type: Boolean, default: false, index: true }, // opt-in indexing
// --- Streak & gamification (denormalized for cheap reads) ---
streak:       { current: { type: Number, default: 0 }, longest: { type: Number, default: 0 },
                lastActiveDate: { type: String, default: "" } },      // 'YYYY-MM-DD' in user TZ
xp:           { type: Number, default: 0, index: true },
level:        { type: Number, default: 1 },
solvedCounts: { easy: Number, medium: Number, hard: Number, total: { type: Number, default: 0, index: true } },
// --- Preferences ---
prefs:        { timezone: String, defaultLanguage: { type: String, default: "cpp" },
                editorTheme: String, emailDigest: { type: Boolean, default: true },
                aiTone: { type: String, default: "socratic" } },
plan:         { type: String, enum: ["free", "pro"], default: "free", index: true },
```

`isProfilePublic` gates whether `/u/[username]` is indexed (adds `robots:index` only when true) — privacy-safe by default.

---

## 3. `Content` — the CMS body (blog · lessons · algorithms · glossary · editorials)

```ts
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CONTENT_TYPES = ["blog", "lesson", "algorithm", "glossary", "editorial", "guide"] as const;
const CONTENT_STATUS = ["draft", "review", "published", "archived"] as const;

const ContentSchema = new Schema({
  type:        { type: String, enum: CONTENT_TYPES, required: true, index: true },
  slug:        { type: String, required: true, index: true },
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  excerpt:     { type: String, default: "", maxlength: 320 },     // = meta description default
  body:        { type: String, default: "" },                    // MDX/Markdown source
  coverImage:  { type: String, default: "" },
  authorIds:   { type: [Schema.Types.ObjectId], ref: "Author", default: [] },
  reviewerId:  { type: Schema.Types.ObjectId, ref: "Author", default: null }, // EEAT "reviewed by"
  tags:        { type: [String], default: [], index: true },
  // taxonomy links → internal linking + programmatic clusters
  topicSlugs:  { type: [String], default: [], index: true },
  patternSlugs:{ type: [String], default: [], index: true },
  companySlugs:{ type: [String], default: [], index: true },
  relatedSlugs:{ type: [String], default: [] },
  // answer-shaped Q&A for GEO/FAQ schema
  faqs:        { type: [{ q: String, a: String }], default: [] },
  keyTakeaways:{ type: [String], default: [] },
  // SEO overrides (fallback to title/excerpt)
  seo:         { title: String, description: String, canonical: String, ogImage: String, noindex: Boolean },
  status:      { type: String, enum: CONTENT_STATUS, default: "draft", index: true },
  featured:    { type: Boolean, default: false, index: true },
  readingTime: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null, index: true },
  updatedContentAt: { type: Date, default: null }, // schema dateModified (freshness)
  archived:    { type: Boolean, default: false, index: true },
}, { timestamps: true, collection: "content" });

ContentSchema.index({ type: 1, slug: 1 }, { unique: true });   // one slug per type
ContentSchema.index({ status: 1, type: 1, publishedAt: -1 });  // published feeds
ContentSchema.index({ title: "text", excerpt: "text", body: "text", tags: "text" });

export type ContentDoc = InferSchemaType<typeof ContentSchema>;
export const Content: Model<ContentDoc> =
  (models.Content as Model<ContentDoc>) || model<ContentDoc>("Content", ContentSchema);
```

`Author`:
```ts
const AuthorSchema = new Schema({
  slug: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  role: String, avatarUrl: String, bio: String,          // "SDE @ FAANG, 5y CP"
  credentials: [String], socials: { github: String, linkedin: String, x: String, website: String },
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, collection: "authors" });
```

---

## 4. `Company` — interview hubs

```ts
const CompanySchema = new Schema({
  slug:      { type: String, unique: true, index: true },
  name:      { type: String, required: true },
  logo:      String, website: String, hq: String, tier: { type: String, index: true }, // FAANG/unicorn/…
  description: String,               // authored 120–200 words (EEAT + snippet)
  aliases:   { type: [String], default: [] },   // "Meta"/"Facebook"
  rounds:    { type: [{ name: String, focus: String, tips: String }], default: [] },
  prepPlan:  { type: [{ week: Number, focus: String, problemSlugs: [String] }], default: [] },
  topTopics: { type: [String], default: [] },
  faqs:      { type: [{ q: String, a: String }], default: [] },
  stats:     { totalTagged: Number, easy: Number, medium: Number, hard: Number },
  archived:  { type: Boolean, default: false },
}, { timestamps: true, collection: "companies" });
```
Problems link to companies through `Question.companies[]` (existing multikey index). The hub aggregates via that index — no join table needed.

---

## 5. `Roadmap` — interactive DAG

```ts
const RoadmapSchema = new Schema({
  slug: { type: String, unique: true, index: true },
  title: String, description: String, level: String,   // beginner/faang/cp
  nodes: [{ id: String, label: String, kind: String,   // topic|pattern|milestone|resource
            topicSlug: String, patternSlug: String, contentSlug: String,
            x: Number, y: Number, estMinutes: Number }],
  edges: [{ from: String, to: String }],
  archived: { type: Boolean, default: false },
}, { timestamps: true, collection: "roadmaps" });
```

## 6. `SlugRedirect` — 301 map (no-delete on renames)

```ts
const SlugRedirectSchema = new Schema({
  fromPath: { type: String, unique: true, index: true },  // "/problems/old-slug"
  toPath:   { type: String, required: true },
  status:   { type: Number, default: 301 },
}, { timestamps: true, collection: "slug_redirects" });
```
Consumed by `middleware.ts` (public branch) → issues 301 before rendering.

## 7. `SrsCard` — spaced-repetition (revision v2, SM-2)

```ts
const SrsCardSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: "User", required: true },
  questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  ease:       { type: Number, default: 2.5 },      // SM-2 EF
  intervalDays:{ type: Number, default: 0 },
  repetitions:{ type: Number, default: 0 },
  dueAt:      { type: Date, required: true, index: true },
  lastGrade:  { type: Number, default: null },     // 0–5 recall quality
  lastReviewedAt: Date,
}, { timestamps: true, collection: "srs_cards" });
SrsCardSchema.index({ userId: 1, dueAt: 1 });       // "due today" query
SrsCardSchema.index({ userId: 1, questionId: 1 }, { unique: true });
```

## 8. `MockInterview` & `AiInteraction`

```ts
const MockInterviewSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  mode: String,                          // dsa | behavioral | company:google
  problemSlugs: [String],
  transcript: [{ role: String, content: String, at: Date }],
  code: String, language: String,
  rubric: { correctness: Number, complexity: Number, communication: Number, coding: Number },
  verdict: String, feedback: String, score: Number,
  durationSec: Number, status: { type: String, default: "active" },
}, { timestamps: true, collection: "mock_interviews" });

const AiInteractionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  kind: { type: String, index: true },   // hint | explain | review | doubt | roadmap
  questionId: { type: Schema.Types.ObjectId, ref: "Question", default: null },
  promptTokens: Number, completionTokens: Number, model: String,
  meta: Schema.Types.Mixed,              // hint level, language, etc.
}, { timestamps: true, collection: "ai_interactions" });
AiInteractionSchema.index({ userId: 1, kind: 1, createdAt: -1 }); // quota + analytics
```

## 9. Gamification: `Achievement`, `UserAchievement`, `Activity`

```ts
const AchievementSchema = new Schema({
  key: { type: String, unique: true },   // "streak_7", "solved_100", "dp_master"
  name: String, description: String, icon: String, tier: String, // bronze/silver/gold
  criteria: Schema.Types.Mixed, xp: Number, secret: Boolean,
}, { collection: "achievements" });

const UserAchievementSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  key: String, unlockedAt: { type: Date, default: Date.now }, progress: Number,
}, { timestamps: true, collection: "user_achievements" });
UserAchievementSchema.index({ userId: 1, key: 1 }, { unique: true });

const ActivitySchema = new Schema({           // heatmap + streak source of truth
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, index: true },        // 'YYYY-MM-DD' (user TZ)
  count: { type: Number, default: 0 },        // actions that day
  xp: { type: Number, default: 0 },
}, { timestamps: true, collection: "activities" });
ActivitySchema.index({ userId: 1, date: 1 }, { unique: true });
```

## 10. Remaining (enumerated — same conventions)

- **`Submission`** `{ userId, questionId, language, code, status: passed|failed|error, runtimeMs, testsPassed, at }` — index `{userId, questionId, createdAt:-1}`.
- **`Playlist`** `{ userId, slug, title, description, isPublic, problemSlugs[] }` — public ones indexable at `/u/[username]/lists/[slug]`.
- **`Contest`** `{ slug, title, startAt, endAt, problemSlugs[], status }` + **`ContestEntry`** `{ contestId, userId, score, penalty, rank, solves[] }` — index `{contestId, score:-1, penalty:1}`.
- **`Notification`** `{ userId, type, title, body, href, readAt }` — index `{userId, readAt, createdAt:-1}`.
- **`Sheet`** (formalize the currently code-defined sheets) `{ slug, title, description, type, sections:[{ title, problemSlugs[] }], curatedBy }`.

## 11. Entity-relationship summary

```
User ─1─┬─* UserProgress ─*─1 Question ─*─* Company (via companies[])
        ├─* SrsCard ─────*─1 Question   Question ─*─* Pattern (patterns[] → lib/patterns.ts)
        ├─* Submission ──*─1 Question   Question ─*─* Sheet (sheetKeys[])
        ├─* UserAchievement ─*─1 Achievement   Content ─*─* {Topic,Pattern,Company} (slug arrays)
        ├─* Activity        Content ─*─* Author (authorIds)   Roadmap.nodes → {Topic,Pattern,Content}
        ├─* MockInterview   SlugRedirect (standalone)          Contest ─*─ ContestEntry ─*─1 User
        └─* Notification
```

**Migration discipline:** every new field is additive with a default; every collection follows no-delete (`archived`); backfills are idempotent scripts under `scripts/`. Nothing here forces a rewrite of existing reads.

➡ Continue to **[05-api-routes.md](./05-api-routes.md)**.
