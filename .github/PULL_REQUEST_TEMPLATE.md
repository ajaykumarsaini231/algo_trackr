## What & why

<!-- What does this PR change, and what problem does it solve? Link the issue: Closes #123 -->

## How it works

<!-- Brief notes on the approach; call out anything reviewers should focus on. -->

## Verification (required — no automated suite yet)

<!-- Exactly what you ran. Include the two-account isolation check if user data is touched. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Exercised the changed flow end-to-end locally
- [ ] Multi-user isolation verified (if user data paths changed)

## Checklist

- [ ] New/changed endpoints follow the guard → rate-limit → zod → envelope pattern
- [ ] Queries are session-scoped (no ids trusted from request bodies)
- [ ] Docs updated (`docs/API.md`, `docs/ENVIRONMENT.md`, `docs/FEATURES.md`, `CHANGELOG.md` *Unreleased*)
- [ ] No secrets, no hard deletes, no unjustified dependencies
