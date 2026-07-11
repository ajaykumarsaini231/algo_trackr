# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

- Complete project documentation suite (`README`, `docs/*`, security policy, community templates)

## [1.0.0] — 2026-07-12

Initial public release (`a8a7ff1`). Highlights of what shipped in it, grouped by era of development:

### Added — platform
- Question catalog (15k+ problems) with topics/subtopics, tags, links, editorial fields; archive-not-delete policy
- Learning system: staged Foundation→Expert path, scored continue-learning queue, per-topic progressive unlock (stages of 5, 80% gate)
- 163-pattern engine with auto-classification; curated + dynamic sheets (Blind 75, Striver A2Z, DP/Graph/Trees/…)
- Google interview prep: readiness scores, coverage targets, tiers, weekly recommendations
- Statistics: per-user splits, monthly trends, 182-day heatmap with streaks
- Search & filtering across catalog fields and personal notes

### Added — multi-user & security (breaking: auth required everywhere)
- Auth.js v5 credentials auth, JWT sessions, register/sign-in pages
- Per-user progress isolation (`user_progress`), overlay read architecture preserving response shapes
- Roles (user/admin/superadmin) via env allowlists; account gate with live revocation (block/suspend/soft-delete/force-logout)
- Edge middleware: auth gate, global rate limiting, request-size caps, cross-origin write rejection
- Brute-force lockouts, security headers + CSP, zod validation on all writes, 90-day audit trail

### Added — admin console
- User directory (cursor pagination, search/filter/sort), read-only User Dashboard Viewer sharing the user-stats pipeline
- Moderation actions with prev/next auditing; superadmin impersonation (30-min signed cookie, banner, one-click return)
- Catalog tooling: bulk import (append/upsert), JSON/CSV export, idempotent seed; audit log browser

### Added — WhatsApp reminder system
- Active-study-time tracker (visibility/focus/idle aware) + heartbeat API with anti-gaming caps
- Reminder engine: per-user timezone windows, goal detection, never-message-active rule, slot-claim duplicate prevention, classified Meta failures with next-slot retries
- GitHub Actions scheduler (`*/15`) with retries/dry-run; approved 5-parameter `task_due_reminder` template integration
- Settings UI + admin reminder operations dashboard

### Changed
- Rebranded AlgoTrackr → **DSAspire** (logo, wordmark, favicon, teal accent); flat information-dense design system; dashboard rebuilt

### Known gaps at release
- No automated tests; no LICENSE file; company catalog data sparse; CSP allows inline/eval scripts (Next hydration); regex search pending `$text` migration
