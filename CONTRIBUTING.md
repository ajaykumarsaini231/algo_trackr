# Contributing to DSAspire

Thanks for helping! This project is a Next.js 15 + TypeScript (strict) + Mongoose codebase with firm conventions — reading two short docs first will save you review cycles:

- [docs/DEVELOPER.md](docs/DEVELOPER.md) — patterns you must follow (API guard skeleton, DB rules, UI system)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit

## Getting started

```bash
git clone https://github.com/ajaykumarsaini231/algo_trackr.git
cd algo_trackr && npm install
cp .env.local.example .env.local    # fill MONGODB_URI + AUTH_SECRET at minimum
npm run db:mem                      # terminal 1 (or use Atlas)
npm run dev                         # terminal 2
```

## Before you open a PR

1. **Discuss first** for anything non-trivial — open an issue with the feature template.
2. Branch from `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`.
3. Keep the gates green: `npm run typecheck && npm run lint && npm run build`.
4. **Verify behavior end-to-end**, including multi-user isolation when you touch user data (two-account scripts in [docs/TESTING.md](docs/TESTING.md)). There is no automated suite yet — your PR description must say what you ran.
5. Update docs in the same PR: `docs/API.md` for endpoints, `docs/ENVIRONMENT.md` for env vars, `docs/FEATURES.md` for features, `CHANGELOG.md` under *Unreleased*.

## Hard rules (PRs violating these will be asked to change)

- Every new API route uses the guard/rate-limit/zod/envelope skeleton; queries scoped by the session user — never trust ids from the body.
- No secrets in code, fixtures, or docs; new config goes through `lib/env.ts`.
- No hard deletes of user or catalog data; destructive admin ops are superadmin + audited.
- No new dependencies without justification in the PR description (bundle + supply-chain cost).
- UI follows the flat design system — no gradients/glassmorphism; figures use `tabular-nums`.

## Commit & PR style

- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`; `!` for breaking).
- One logical change per PR; fill the PR template (what/why/how verified/docs updated).
- CI note: only the reminder scheduler workflow exists today; run the gates locally.

## Reporting bugs / security

- Bugs: issue template with repro steps + expected/actual.
- **Security issues: never a public issue** — see [SECURITY.md](SECURITY.md#reporting-a-vulnerability).

## License note

The repository currently has **no license file** (all rights reserved). By submitting a contribution you agree it may be licensed under whatever OSI license the maintainer later adopts for the project.
