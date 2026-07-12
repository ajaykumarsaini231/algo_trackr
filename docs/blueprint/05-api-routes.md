# 05 · API Routes & Server Layer

Covers **#48 API routes**. Every endpoint enumerated, plus the `src/server/` data-access layer that both RSC pages and route handlers call. Conventions preserved: Zod on every write, `api-response.ts` envelope, Upstash rate-limit, `require-admin`, session via Auth.js.

---

## 1. The `src/server/` layer (single Mongoose boundary)

RSC pages and route handlers **never import models directly** — they call repositories. This centralizes caching and keeps public pages free of user-data imports.

```ts
// src/server/db/problems.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import { Question } from "@/models/Question";
import { serializeQuestion } from "@/lib/serialize";

export const getProblemBySlug = unstable_cache(
  async (slug: string) => {
    await connectDB();
    const q = await Question.findOne({ slug, archived: false }).lean();
    return q ? serializeQuestion(q) : null;
  },
  ["problem-by-slug"],
  { revalidate: 86400, tags: ["problems"] },   // on-demand bust via revalidateTag('problems')
);

export async function listProblems(params: ProblemQuery) { /* faceted find + count, lean */ }
export async function getAllProblemSlugs() { /* for sitemap + generateStaticParams (top N) */ }
```

Repositories: `problems.ts · topics.ts · patterns.ts · companies.ts · roadmaps.ts · sheets.ts · content.ts · profile.ts · leaderboard.ts`. Services (write/business logic): `srs.ts · streaks.ts · achievements.ts · recommend.ts · xp.ts`.

**Caching policy:** public reads wrapped in `unstable_cache` with tags (`problems`, `content`, `companies`); `/studio` publish and admin edits call `revalidateTag`/`revalidatePath`. Per-user reads are never cached.

---

## 2. Route-handler inventory

### Existing (keep — audit for public/private split)
`api/auth/[...nextauth]` · `api/auth/register` · `api/questions` · `api/questions/[id]` · `api/stats` · `api/activity` · `api/profile` · `api/settings` · `api/learn` · `api/learn/topic/[slug]` · `api/sheets` · `api/sheets/[key]` · `api/patterns` · `api/patterns/[slug]` · `api/export` · `api/import` · `api/seed` · `api/google` · `api/reminders/*` · `api/admin/*` (users, audit-logs, impersonation, reminders, setup, auth, logout).

> **Action:** existing `api/questions` etc. are auth-gated. Add a **public read namespace** `api/public/*` (or make GET reads public with cache headers) so the content plane can be built and, if desired, consumed by third parties/AI as JSON.

### ➕ New — public reads (cacheable, no auth; power the content plane + optional public API)
| Method · Route | Purpose | Cache |
|---|---|---|
| `GET /api/public/problems` | Faceted list (topic, pattern, company, difficulty, sort, page) | `s-maxage=3600, swr` |
| `GET /api/public/problems/[slug]` | One public problem projection | `s-maxage=86400` |
| `GET /api/public/topics` · `/[topic]` | Topic hubs | `s-maxage=86400` |
| `GET /api/public/patterns` · `/[slug]` | Pattern explainers | `s-maxage=86400` |
| `GET /api/public/companies` · `/[slug]` · `/[slug]/[topic]` | Company hubs + cross | `s-maxage=86400` |
| `GET /api/public/roadmaps/[slug]` · `/sheets/[slug]` | DAG / ladder | `s-maxage=86400` |
| `GET /api/public/content/[type]/[slug]` | Blog/lesson/algorithm/glossary | `s-maxage=3600` |
| `GET /api/public/search?q=` | Instant search (typeahead) | `s-maxage=60` |
| `GET /api/public/profile/[username]` | Public profile projection | `s-maxage=3600` |
| `GET /api/public/leaderboard` | Global/weekly/company | `s-maxage=300` |

### ➕ New — authenticated user (`api/me/*`)
| Method · Route | Purpose |
|---|---|
| `GET /api/me/progress?slugs=` | Personalization overlay for static pages (solved/favorite badges) |
| `POST /api/me/progress/[questionId]` | Upsert status/favorite/notes/rating (existing logic, re-homed) |
| `GET/POST /api/me/revision` | SRS due list + grade a card (SM-2) |
| `POST /api/me/submissions` | Record run/submit result |
| `GET/POST /api/me/playlists` · `/[id]` | CRUD lists |
| `GET /api/me/notifications` · `POST …/read` | In-app notifications |
| `GET /api/me/recommendations` | Next-best problems (recommend.ts) |

### ➕ New — AI (streaming route handlers)
All stream `text/event-stream` (or `ReadableStream`), enforce per-user quota via `ai_interactions`, and pass server-built prompts (never trust client prompt wholesale).

| Route | Purpose | Notes |
|---|---|---|
| `POST /api/ai/hint` | Progressive hint ladder (level 1→3, never full solution) | seeds from `Question.hints[]` |
| `POST /api/ai/explain` | Explain a concept/approach/complexity | topic-grounded |
| `POST /api/ai/review` | Code review: bugs, complexity, style, edge cases | structured JSON + prose |
| `POST /api/ai/doubt` | RAG doubt-solver over your own content corpus | cites internal pages |
| `POST /api/ai/roadmap` | Generate personalized roadmap from goal/level/time | writes a `Roadmap`-shaped result |
| `POST /api/ai/mock` | Mock-interview turn (asks, probes, hints, scores) | appends to `mock_interviews` |

```ts
// src/app/api/ai/hint/route.ts (shape)
export const runtime = "nodejs";           // Mongoose needs node runtime
export async function POST(req: Request) {
  const user = await requireUser();                         // 401 if not
  await aiRateLimit(user.id, "hint");                       // Upstash sliding window
  const { questionId, level } = HintSchema.parse(await req.json());
  const q = await getQuestionForAi(questionId);             // server-side context
  const stream = await llm.stream({ system: HINT_SYSTEM, messages: buildHintPrompt(q, level) });
  logAiInteraction(user.id, "hint", { questionId, level }); // fire-and-forget
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}
```

### ➕ New — gamification / social / contests
`POST /api/me/streak/ping` (heartbeat → streak+activity) · `GET /api/achievements` · `GET /api/contests` · `GET /api/contests/[slug]` · `POST /api/contests/[slug]/submit` · `GET /api/leaderboard`.

### ➕ New — SEO/GEO/system
| Route | Purpose |
|---|---|
| `GET /sitemap.ts` → `/sitemap.xml` | Sitemap index (doc 07) |
| `GET /sitemap/[id]/route.ts` | Chunked child sitemaps (50k-URL limit) |
| `GET /robots.ts` → `/robots.txt` | Crawl rules (doc 07) |
| `GET /llms.txt/route.ts` | AI-crawler manifest (doc 09) |
| `GET /api/og` (or `opengraph-image.tsx`) | Dynamic OG images (doc 07) |
| `GET /api/health` | DB ping for uptime monitors |
| `POST /api/revalidate` | On-demand ISR bust (admin/webhook, secret-guarded) |
| `POST /api/webhooks/*` | Stripe (billing), Resend (email events) |

### ➕ New — CMS (`/studio`, admin-gated)
`GET/POST/PATCH /api/studio/content` · `/api/studio/content/[id]` (draft→review→publish, triggers `revalidateTag`) · `POST /api/studio/media` (upload to blob) · `GET /api/studio/preview/[id]` (draft preview token).

---

## 3. Standard handler contract

Every handler follows the existing pattern:

```ts
export async function POST(req: Request) {
  const rl = await rateLimit(req);              // lib/rate-limit.ts
  if (!rl.ok) return tooMany(rl);
  const session = await auth();                 // Auth.js; requireUser/requireAdmin as needed
  const body = Schema.parse(await req.json());  // Zod; 422 on failure via api-response.ts
  await connectDB();
  const data = await repositoryCall(body);
  return ok(data);                              // { success, data } envelope
}
```

**Cross-cutting rules (already in your codebase, keep enforcing):**
- Reads that are public → set `Cache-Control` + no session dependency; wrap repo in `unstable_cache`.
- Writes → same-origin check, request-size cap, Zod, audit-log for admin actions, no-delete (`archived`).
- AI routes → `runtime = "nodejs"`, quota, prompt built server-side, log tokens, stream.
- Errors → typed envelope; never leak Mongo errors (existing `api-response.ts`).

## 4. Runtime & placement

| Concern | Choice |
|---|---|
| Default handler runtime | `nodejs` (Mongoose incompatible with edge) |
| `middleware.ts` | edge — only auth-gate `(app)`, 301 from `slug_redirects`, security headers |
| Long AI streams | `nodejs`, `maxDuration` raised in `next.config`/route segment config |
| Static content reads | ISR page + cached repo; the `api/public/*` JSON is a bonus surface |

➡ Continue to **[06-components-ux.md](./06-components-ux.md)**.
