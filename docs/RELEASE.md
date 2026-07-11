# Release Process

Lightweight process suited to a solo-maintainer project deploying on Vercel.

## Versioning

SemVer against the **application contract** (APIs, data shapes, auth behavior):
- **major** — breaking API/auth/data changes (e.g. the 1.0 multi-user refactor requiring sign-in)
- **minor** — features (new endpoints/pages/engines)
- **patch** — fixes, docs, performance

## Cutting a release

1. Ensure `main` is green: `npm run typecheck && npm run lint && npm run build`.
2. Move `CHANGELOG.md` *Unreleased* items under a new version heading with today's date.
3. Bump `version` in `package.json` to match.
4. Commit `chore(release): vX.Y.Z`, then tag and push:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --tags
   ```
5. Create a GitHub Release from the tag; paste the changelog section.
6. Vercel deploys `main` automatically; verify the production URL, then spot-check: sign-in, dashboard, one PATCH, `/admin/reminders` (if configured).

## Pre-release checklist

- [ ] `docs/API.md` / `docs/ENVIRONMENT.md` reflect any contract or config changes
- [ ] New env vars exist in Vercel **before** the deploy that needs them
- [ ] Reminder contract untouched or workflow updated in the same release
- [ ] `npm audit` reviewed (never `--force`; bump Next for the bundled-postcss advisory)
- [ ] Database changes are additive (old code must run against new data during rollout)

## Rollback

Vercel → Deployments → *Promote* the previous build (instant), or `git revert` + push. Data rollbacks via Atlas point-in-time restore — see [DEPLOYMENT.md](DEPLOYMENT.md#10-rollback).

## Licensing reminder

Before promoting the repo publicly as open source, add a `LICENSE` file (MIT recommended) — the README and CONTRIBUTING currently document its absence honestly.
