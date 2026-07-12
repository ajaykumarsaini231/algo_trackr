# 11 · Product Features (every feature spec)

Covers **#27–46, 49, 50, 59, 60, 61.** Each block: what it is · key UI · data (doc 04) · API (doc 05) · notes. ✅ = exists, upgrade · ➕ = new.

---

## A. Public content features

### #29 Problem pages ➕ (public twin of the private workspace)
- **`/problems/[slug]`** RSC. Renders `ProblemView`: title, `DifficultyBadge`, `RatingBadge` (numeric), company/pattern chips, statement/examples/constraints (owned or licensed content — doc 04 note), approach summary, complexity table, hint ladder (gated CTA), editorial link, related problems, "asked at" companies, FAQ. `SolvedOverlay` client island personalizes if logged in. Schema: TechArticle + Breadcrumb + FAQ.
- CTA **"Solve this →"** → `/practice/[slug]` (funnel).

### #27 Company interview pages ➕
- **`/companies/[slug]`** — overview (authored 150 words), rounds timeline, week-by-week prep plan, faceted tagged-problem table (from `Question.companies[]`), top patterns for that company, interview experiences (UGC), FAQ. **`/companies/[slug]/[topic]`** for long-tail. Data: `Company` + catalog aggregation. Schema: Course/ItemList + FAQ.

### #28 DSA roadmap pages ➕
- **`/roadmaps/[slug]`** — interactive dependency **DAG** (`RoadmapGraph`, SVG/react-flow-lite), nodes = topic/pattern/milestone → drawer with links + progress overlay (logged in). Curated roadmaps: *DSA Beginner, FAANG Prep, CP, DP Mastery, SDE Sheet*. Data: `Roadmap`. Schema: Course. Shareable (backlink/GEO magnet, roadmap.sh-style).

### #31 Learning paths ✅➕ (public + private)
- Public course catalog `/learn` → `/learn/[track]/[module]` MDX lessons with runnable snippets, "answer boxes", prev/next. Private: your existing **Foundation→Expert progressive-unlock** engine (`learning.ts`, `learningScore`, batches of 5, 80% to unlock) drives the *personalized* path on `/dashboard`. Keep the engine; expose a public, non-personalized projection for SEO.

### #30 Contest pages ➕
- **`/contests`** archive (public, ISR) + **`/contests/[slug]`** (problems, timer, standings). Live participation gated. Weekly cadence → recurring return visits (CF/AtCoder model). Data: `Contest`, `ContestEntry`. Rated later (optional ELO). Leaderboard integration.

---

## B. The practice workspace (private core)

### Practice / solve UI ➕ — `/practice/[slug]`
- `SplitPane`: left = `ProblemPanel` (reuses `ProblemView` + personal notes), right = `EditorPanel` (Monaco/CodeMirror, multi-language, theme-synced) + `RunPanel` (sample tests) + `AiToolsDock`. Timer, autosave (`Submission`/draft), keyboard-first. Mobile = tabbed.
- **#33 Progress tracking** ✅: status (Not Started→Solved/Need Revision), favorite, attempt count, rating — via existing `UserProgress` upsert (`/api/me/progress`). Solving triggers streak ping + XP + achievement checks + SRS card creation.
- **#34 Notes system** ✅➕: per-problem notes + revision notes (exist in `UserProgress`, 20k cap). Add: markdown, code snippets, a global `/notes` searchable view, and a lightweight whiteboard (excalidraw-lite) for approach sketches.

### #35 Revision scheduler ➕ (upgrade to spaced repetition)
- Replace ad-hoc `revisionNeeded`/`revisionDate` with **SM-2 SRS** (`SrsCard`, doc 04). On solve → card created (`dueAt` now+1d). `/revision` shows **Due today**, a 30-day forecast, and grade buttons (Again/Hard/Good/Easy → 0/3/4/5) recomputing `ease`/`interval`. Spacing 1→3→7→16→… days. This is a **differentiator** (no competitor does structured SRS). Feeds WhatsApp reminders (existing) with "N cards due".

---

## C. AI tutor suite ➕ (streaming — doc 05)

All server-prompted, quota'd (`ai_interactions`), model-agnostic LLM client in `src/server/ai/`. Guardrails: never leak full solutions on "hint", ground answers in your content, log tokens, rate-limit.

### #40 AI hints — progressive ladder
- 3 levels: nudge → approach → pseudo-code. Seeds from `Question.hints[]`, escalates on request. Never the full solution. UI: `HintLadder` reveal. `POST /api/ai/hint`.

### #41 AI explanation
- Explain a concept, an approach, or *why this complexity*. Context = current problem/topic. Socratic tone option (`prefs.aiTone`). `POST /api/ai/explain`.

### #39 AI code review
- Paste/solve → structured review: correctness, bugs, edge cases missed, time/space complexity of *their* code, style, and a suggested optimization — as JSON (rendered panel) + prose. `POST /api/ai/review`. Great for the workspace + shareable.

### #37 AI doubt solving (RAG)
- Chat that answers DSA doubts **grounded in your own corpus** (problems, algorithm refs, patterns) → cites internal pages (drives internal links + trust). Retrieval over a `search_index`/embeddings of `Content`. `POST /api/ai/doubt`.

### #38 AI roadmap generator
- Input: goal (FAANG/CP/placement), level, weeks, hrs/week → outputs a personalized `Roadmap`-shaped plan mapped to *your* topics/patterns/problems, saved to the user, rendered in `RoadmapGraph`, and drives the dashboard queue. `POST /api/ai/roadmap`. Onboarding uses this.

### #36 Mock interviews ➕ (flagship differentiator)
- **`/mock`** lobby (pick mode: DSA / company:Google / behavioral, duration) → **`/mock/[id]`** live room: AI interviewer streams the prompt, asks clarifying questions, gives graded hints, watches your `CodePad`, then produces a **rubric** (correctness, complexity, communication, coding) + written feedback + score. Whiteboard for design. Transcript saved (`MockInterview`). Optional peer-mock (collaborative room, binarysearch-style) later. `POST /api/ai/mock`.

---

## D. Engagement & social

### #32 Dashboard ✅➕ — `/dashboard`
- StreakCard, ContinueLearning (from learning engine), **DueRevisionCard** (SRS), StatGrid (solved by difficulty/topic), **ActivityHeatmap** (exists), Recommendations (§below), RecentActivity, weekly goal ring. SSR from session.

### #42 User profiles ➕ — `/u/[username]` (public, indexable)
- Proof-of-work page (GitHub-profile energy): avatar, bio, socials, solved counts, difficulty split, **contribution heatmap**, streak, badges, favorite patterns, public playlists, rank. `isProfilePublic` gates indexing (default off). Schema: ProfilePage+Person. Doubles as EEAT/GEO surface + shareable growth loop.

### #43 Leaderboards ➕ — `/leaderboard`
- Global / weekly / by-company / friends. Ranked by XP or solves; virtualized table; your rank pinned. ISR 300s public read + personalized overlay. Data: `User.xp`/`solvedCounts` + `ContestEntry`. Weekly reset loop → recurring visits.

### #44 Achievements ➕
- Badge catalog (`Achievement`) + unlock ledger (`UserAchievement`): streak milestones, topic mastery ("DP Master: 50 DP solved"), speed, first-blood, comeback, sheet-completion. `AchievementGrid` on profile; unlock toast + XP. Checked server-side in `services/achievements.ts` after solve/streak events.

### #45 Streak system ✅➕
- `services/streaks.ts`: heartbeat `POST /api/me/streak/ping` (already have active-time tracking) → updates `User.streak` + `Activity` (TZ-aware, anti-gaming cap you already enforce). Freeze/repair (1 free/week). Fuels reminders, heatmap, achievements. Flame UI with reduced-motion respect.

---

## E. Discovery

### #59 Search functionality ✅➕
- **⌘K command palette** (global) + `/problems?q=` full page. Backed by MongoDB text index (you have it) → upgrade to a denormalized `search_index` or Atlas Search for typeahead + fuzODY + facets. Also the `SearchAction` schema target (doc 08). `GET /api/public/search`.

### #60 Advanced filtering ✅➕
- Faceted browser: topic, subtopic, pattern, company, difficulty, status, favorite, rating, platform, sheet. **URL-synced** (`?topic=&difficulty=`) → shareable + selectively indexable (doc 07 canonical rules). Sticky sidebar (desktop) / bottom-sheet (mobile). Reuses your existing filter grid, extended.

### #61 Recommendation engine ➕
- `services/recommend.ts`: next-best problems from (a) learning-engine priority score, (b) SRS due, (c) weak topics (low solve-rate), (d) goal roadmap, (e) "users like you". Surfaced on dashboard + end-of-problem "solve next". `GET /api/me/recommendations`. Start rules-based; add collaborative filtering later.

---

## F. Accounts, admin, CMS

### #46 Authentication ✅➕
- Keep **Auth.js v5** (credentials, JWT, roles user/admin/superadmin, brute-force lockout, moderation, impersonation, audit — all exist). Add: **OAuth** (GitHub/Google) for friction-free signup (GitHub especially fits the audience + enriches profile), email verification + password reset (`/verify-email`, `/reset-password/[token]`), optional 2FA. Middleware now gates **only `(app)`** (doc 02) — public plane is open.

### #49 Admin panel ✅
- Existing console stays: user directory (cursor-paginated), read-only User Dashboard Viewer, superadmin impersonation, bulk import/export, audit logs, reminder ops. Add: content moderation queue (UGC experiences/solutions), SEO dashboard (index coverage, orphans), AI usage/quotas.

### #50 CMS ➕ — `/studio` (admin-gated)
- Manage `Content` (blog/lesson/algorithm/glossary/editorial): MDX editor with live preview, frontmatter form (authors, reviewer, tags, topicSlugs, faqs, takeaways, SEO overrides), draft→review→publish workflow, media upload (Vercel Blob), scheduled publish, and **on-publish `revalidateTag`** (instant ISR refresh) + sitemap ping. Author management (`Author`). Role: admin/editor. Alternatively integrate a headless CMS (Sanity/Contentlayer) — but the in-house `Content` model keeps one DB and matches your Mongoose stack.

---

## G. Feature → data/API cross-reference

| Feature | Models | Key endpoints |
|---|---|---|
| Problem/practice | Question, UserProgress, Submission | `/api/public/problems/*`, `/api/me/progress`, `/api/me/submissions` |
| Revision SRS | SrsCard | `/api/me/revision` |
| AI suite | AiInteraction, MockInterview | `/api/ai/*` |
| Gamification | User, Achievement, UserAchievement, Activity | `/api/me/streak/ping`, `/api/achievements`, `/api/leaderboard` |
| Profiles | User, Playlist | `/api/public/profile/[username]` |
| Content/CMS | Content, Author | `/api/public/content/*`, `/api/studio/*` |
| Companies/roadmaps/sheets | Company, Roadmap, Sheet | `/api/public/{companies,roadmaps,sheets}/*` |
| Contests | Contest, ContestEntry | `/api/contests/*` |

➡ Continue to **[12-performance-pwa.md](./12-performance-pwa.md)**.
