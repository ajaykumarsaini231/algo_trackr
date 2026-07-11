# Testing Guide

**Current status: there is no automated test suite in this repository.** That is the single largest gap in production readiness (tracked in [AUDIT.md](../AUDIT.md)). What exists instead — and what has actually been executed against the running app — is a set of scripted end-to-end verifications documented below, plus this strategy for building the real suite.

## What has been verified (scripted, against a live instance)

These flows were exercised with real HTTP calls (curl + cookie jars) and, where noted, the live Meta API:

- **Isolation**: two accounts; A's solves/notes invisible to B across stats/lists/detail.
- **Auth**: register validation, lockout after failed logins, blocked/suspended login messages, force-logout killing live sessions ≤30s, deleted-account JWT rejection.
- **Privilege**: normal user → 403 on every admin endpoint (list, impersonate, block, reset, audit); admin-vs-superadmin split; self-moderation blocks.
- **Impersonation**: superadmin start → app serves target's data → stop → own data; non-superadmin denied; audit entries written.
- **Reminders**: run-endpoint 401s (no/wrong bearer), every skip rule (window, goal, `currently_active`, slot), slot duplicate prevention across consecutive runs, heartbeat anti-gaming caps (600s claim → ~91s credited), hidden-tab ⇒ zero writes, real template send accepted by Meta (and the 132000 param-mismatch failure classified before the 5-param fix).
- **Build gates**: `npm run typecheck` and `npm run build` clean at every milestone.

## Recommended stack (when adding the suite)

| Layer | Tool | First targets (highest value) |
| --- | --- | --- |
| Unit | Vitest | `lib/local-time` (tz math), `lib/reminder-engine` skip rules (inject `now`), `lib/progress.upsertProgress` semantics, `lib/whatsapp.classify`, cursor encode/decode |
| API/integration | Vitest + `npm run db:mem` (mongodb-memory-server already a devDependency) | auth guards per route, isolation (two users), zod rejections, rate-limit 429s |
| E2E | Playwright | signup → solve → dashboard reflects; admin block → friendly message; impersonation round-trip |

## How to test each subsystem by hand (works today)

Sign-in helper used throughout (bash):

```bash
BASE=http://localhost:3000
signin() { local csrf=$(curl -s -c "$3" "$BASE/api/auth/csrf" | jq -r .csrfToken); \
  curl -s -b "$3" -c "$3" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$csrf" --data-urlencode "email=$1" --data-urlencode "password=$2" -o /dev/null; }
```

**Authentication & isolation (two accounts):**
```bash
curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"A","email":"a@test.local","password":"passw0rd1"}'
curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"B","email":"b@test.local","password":"passw0rd1"}'
signin a@test.local passw0rd1 a.jar; signin b@test.local passw0rd1 b.jar
QID=$(curl -s -b a.jar "$BASE/api/questions?limit=1" | jq -r .data.items[0]._id)
curl -s -b a.jar -X PATCH $BASE/api/questions/$QID -H 'Content-Type: application/json' \
  -d '{"status":"Solved","notes":"secret-A"}' > /dev/null
curl -s -b a.jar $BASE/api/stats | jq .data.solved     # 1
curl -s -b b.jar $BASE/api/stats | jq .data.solved     # 0  ← isolation
curl -s -b b.jar $BASE/api/questions/$QID | jq .data.notes  # "" ← isolation
```

**Reminder eligibility without sending:** enable reminders for A (wide window, unassigned `+999` country code so no human is reachable), then
```bash
curl -s -X POST "$BASE/api/reminders/run?dryRun=1" -H "Authorization: Bearer $REMINDER_CRON_SECRET" | jq .data
# expect wouldSend:1; send a heartbeat as A and re-run → skipped.currently_active:1
```

**WhatsApp (real send)**: use your own allowlisted number in settings, wait 2+ min without heartbeats inside your window, run without `dryRun` — check `/admin/reminders` for the wamid or classified failure. Never test against numbers you don't own.

**Admin/authorization matrix:** for each admin endpoint, assert 401 signed-out, 403 as normal user, 200 as admin, and superadmin-only actions 403 as plain admin.

## Reminder-specific checklist

- [ ] `401` without / with wrong Bearer; `200` with secret
- [ ] `422` enabling without phone/timezone; bad tz rejected
- [ ] Inactive user in window → `wouldSend`
- [ ] Heartbeat ≤2 min → `currently_active`
- [ ] Goal reached → `goal_completed`
- [ ] Same slot twice → second run `slot_already_sent`
- [ ] Interval change ⇒ new slot namespace (fresh claim)
- [ ] Failure classes visible in `/admin/reminders`

## CI recommendation

GitHub Actions on PR: `npm ci && npm run typecheck && npm run build` (+ the suite once it exists). Not yet configured — only the reminder scheduler workflow exists today.
