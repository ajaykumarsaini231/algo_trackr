# Developer Guide

How to work on this codebase without fighting it.

## Ground rules

- **TypeScript strict** — `npm run typecheck` must pass; no `any` unless interfacing with Mongoose aggregation results (existing pattern: localized `eslint-disable` with a lean cast).
- **Mongoose, not Prisma.** Schemas + indexes in `src/models/` are the single DB truth.
- **Never trust the client**: every write goes through zod; every query is scoped by the session user inside the route — user ids never come from request bodies.
- **Soft deletion only** (questions `archived`, users `deletedAt`); destructive operations require superadmin + audit.
- Comments explain *constraints*, not narration; match the existing density.

## Naming & structure conventions

- Files: kebab-case (`user-stats.ts`, `activity-tracker.tsx`); Mongoose models PascalCase (`UserProgress.ts`).
- Components: PascalCase exports, colocated by domain (`components/admin/…`); primitives stay presentation-only in `components/ui/`.
- Hooks: `use-*.ts`, one per API surface, thin SWR wrappers returning `{data..., isLoading, isError, mutate}`.
- Lib modules are server-only where they touch the DB (`import "server-only"`).

## The API pattern (copy this for new routes)

```ts
// src/app/api/thing/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();                       // or requireAdmin / requireRoleAdmin / requireSuperAdmin
    const rl = await checkRateLimit("mutate", user.id);     // pick the right bucket
    if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

    const parsed = parseOrError(mySchema, await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error, 422);

    await connectDB();
    // queries filtered by user.id — never by ids from the body
    void logAudit({ action: "thing.create", userId: user.id });  // if security-relevant
    return ok(result);
  });
}
```

Checklist for any new endpoint: guard → rate limit → zod → `connectDB` → user-scoped queries → envelope → audit if admin/destructive → add it to `docs/API.md`.

## The database pattern

- New per-user data gets its own collection keyed by `userId` (+ a compound unique index if one-per-something), never new fields on `questions`.
- Add indexes in the schema next to the queries that need them; prefer compound `(userId, X)` shapes.
- Concurrency: single-document pipeline upserts + unique-index claims instead of transactions (works on standalone dev Mongo too). See `upsertProgress` and the reminder slot claim for the two canonical examples.
- If you must read many users' data (admin), batch with `$in` on the visible page — never per-row queries.

## Frontend patterns

- Data via hooks + SWR; mutations revalidate related keys (`revalidateQuestions()` pattern) and may optimistically update the detail key first.
- Client pages gate admin UI by `useSession().data.user.role`, but treat that as cosmetic — the API is the enforcement point.
- Design system: neutral surfaces, one accent, `tabular-nums` for figures, 13px dense text, flat borders (`rounded-lg border bg-card`) — reuse `OverviewStat`-style compact tiles, `ProgressBars`, `Heatmap`, badges. Don't reintroduce gradients/glassmorphism.
- Anything touching recharts is lazy-loaded via `next/dynamic`.

## Adding a feature (worked sequence)

1. Model (if needed) in `src/models/` with indexes.
2. Domain logic in `src/lib/` (pure functions where possible).
3. Route(s) using the API pattern; wire rate-limit bucket + audit.
4. Hook in `src/hooks/`; UI in `src/components/` + page under `src/app/`.
5. Docs: `docs/API.md` + `docs/FEATURES.md` (+ `docs/ENVIRONMENT.md` for new env vars).
6. Verify: `npm run typecheck && npm run build`, then exercise the flow end-to-end with two accounts (isolation!) — scripted curl examples live in `docs/TESTING.md`.

## Testing

There is **no automated suite yet** ([TESTING.md](TESTING.md) has the strategy + the manual scripts used to verify current behavior). If you add tests, prefer: Vitest for `lib/` units (reminder eligibility, local-time, progress overlays are pure-ish and high-value), route tests against `npm run db:mem`, Playwright for signin/solve/impersonation smoke.

## Local environment

`npm run db:mem` (in-memory Mongo on 27017, data resets) + `npm run dev`. Windows SRV/DNS quirks are auto-handled; `scripts/mem-mongo.mjs` and `roadmap-tools/dev-server.mjs` cover the odd network setups.

## Deployment

Push to `main` → Vercel builds. Env var changes need a redeploy. Anything touching the reminder contract must keep `/api/reminders/run` backward compatible with the committed workflow (Bearer auth, 200 + JSON stats).
