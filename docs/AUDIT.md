# PHASE 0 — AUDIT REPORT: FORGE v0.1.0

**Auditor:** Antigravity (Claude Opus 4.6 Thinking)
**Date:** 2026-11-25
**Verdict:** The codebase is well-structured and worth upgrading — not restarting. See `/docs/DECISIONS.md` §D-001.

---

## 1. Stack Overview

| Layer | Current | Notes |
|-------|---------|-------|
| Framework | Next.js 16.4.6 (App Router), React 19.3 | Good foundation |
| Language | TypeScript strict, ES2022 | Strict mode on ✓ |
| Styling | Tailwind v4 + custom classes | Dark-first, lime accent (#C9F73A) |
| DB | SQLite via better-sqlite3 + Drizzle ORM | Single-file `forge.db` — fine for dev |
| Auth | `forge_uid` httpOnly cookie, falls back to demo user `u-alex` | No real passwords, no OAuth |
| State | Server Components + Server Actions, no client state lib | Zustand & TanStack Query not yet wired |
| Engine | Pure TS in `src/lib/engine.ts` | readiness, e1RM, recovery, compression, plate math, protein |
| Queries | `src/lib/queries.ts` | Loads full workspace in one call (OK for SQLite, not PG) |
| Components | 30 files in `src/components/` | Well-factored, consistent design language |
| Testing | None | No Vitest, no Playwright, no e2e |
| CI | None | No GitHub Actions, no linting pipeline |
| Monorepo | No | Single `app/` directory, no packages |

## 2. Source Inventory

| Category | Files | Lines |
|----------|-------|-------|
| Pages & layouts | 16 | ~3,200 |
| Components | 15 | ~3,100 |
| Library (engine, queries, utils, auth, date, coach) | 6 | ~850 |
| Data (schema, seed, exercise-data) | 3 | ~1,480 |
| Config (package.json, tsconfig, drizzle.config) | 3 | ~90 |
| CSS | 1 | ~300 |
| **Total app source** | **44** | **~9,020** |
| Docs | 11 | ~2,000 |
| Research repos (_research/) | many | reference only |

## 3. Routes Verified (14)

```
/              — Landing page (marketing, hardcoded stats)
/login         — Email-only login form
/app           — Dashboard (Today command center)
/app/train     — Train page (program, calendar, start session)
/app/train/[id]— Active workout (live logger)
/app/train/[id]/summary — Post-workout summary
/app/exercises — Exercise library (search, filter)
/app/programs  — Program browser + enroll
/app/nutrition — Food log, macros, water
/app/progress  — Charts, PRs, body tracking
/app/social    — Feed, challenges, leaderboard
/app/coach     — AI Coach chat
/app/form-check— Form check placeholder
/app/settings  — Profile, equipment, targets
```

## 4. TypeScript Errors (8)

All in `src/app/page.tsx` (landing page):

| # | Error | Fix |
|---|-------|-----|
| 1 | `clamp` imported from engine but not exported | Remove import — `clamp` is in `utils.ts` and not needed on landing |
| 2 | Duplicate identifier `estimateSessionMinutes` | Imported from both engine and utils — remove one |
| 3 | `estimateSessionMinutes` not in `utils` | It's in `engine.ts` — fix import |
| 4-5 | `sleepHours`/`hrv` possibly null | Add nullish coalescing |
| 6-7 | `exercise` property doesn't exist on PR type | Use `recentPRs()` from queries which joins exercise |
| 8 | Same as 6-7 | Same fix |

## 5. Bug Findings — Detailed

### 🔴 P0 — Must Fix Before Sprint 1

| ID | Bug | File | Line | Root Cause |
|----|-----|------|------|------------|
| B01 | **Weekly sessions show all checkmarks** — Train page shows ✓ on all 5 days including future days | `train/page.tsx` | 133-154 | `completedDayNames` matches by workout name, not by date + slot; if a user trained "Push A" last week, it shows ✓ for this week's Push A too |
| B02 | **"Week 6" hardcoded** — Dashboard and Train both show "Week 6" with no computation | `app/page.tsx:81`, `train/page.tsx:82` | — | Literal string; should compute from enrollment date and completed sessions |
| B03 | **XP shows 12,480 but bar reads 0%** — `computeLevelProgress` has a bug: `Math.round(((xp / 100) % 1) * 100)` returns 0 for xp=12480 because `12480/100 = 124.8`, `124.8 % 1 = 0.8`, `round(0.8*100) = 80` — wait, that actually works. The real issue is in `app-shell.tsx:70`: `const xpPct = Math.min(100, Math.round(((user.xp % 520) / 520) * 100))` — 12480 % 520 = 0, so `0/520 = 0%` | `app-shell.tsx` | 70 | XP bar uses `% 520` modular which yields 0 when XP is exactly divisible by 520 (12480/520 = 24.0) |
| B04 | **Level computation inconsistent** — `seed.ts` sets level=24 for xp=12480; `actions.ts:293` computes `level = floor(newXp / 520)` = 24; `engine.ts:204` computes `level = floor(sqrt(xp/100)) + 1` = `floor(sqrt(124.8))+1` = `floor(11.17)+1` = 12. Three different formulas | Multiple files | — | No single source of truth for level computation |
| B05 | **Sign out clipped by dev badge** — Sidebar footer stacks the profile card, XP bar, and sign-out button; on short viewports, sign-out is pushed off-screen | `app-shell.tsx` | 115-140 | No overflow-y-auto on sidebar footer |
| B06 | **Start session CTA below fold** — On mobile 360px, the "Start session" button on Dashboard is inside a scroll area, not sticky | `app/page.tsx` | 166-171 | No sticky positioning; button is inline with the session card |
| B07 | **Readiness sparkline unlabeled** — The 7-day trend chart has no axis, no dates, no values, no today marker | `app/page.tsx` | 201-204 | Sparkline component takes data only, no labels |
| B08 | **Exercise rows show no target weights** — The exercise table on Train shows sets × reps but no target weight or last-time weight per exercise | `train/page.tsx` | 97-107 | Exercise list renders repsMin–repsMax but no weight column |
| B09 | **Dashboard and Train show identical session card** — Today page has the same "Push A · Chest Bias" card as the Train page, with the same layout | `app/page.tsx`, `train/page.tsx` | — | No differentiation in role (Today = command center, Train = program/calendar/library) |
| B10 | **Volume label "14.7k kg proj." is misleading** — Projected volume is computed from last-time weights × average reps × target sets, with a fallback of `65` or `40` for exercises with no history | `app/page.tsx` | 52-58 | Fallback weights are arbitrary; label doesn't explain "projected" |
| B11 | **"6-week load" label is hardcoded** — Train page says "6-week load" but `weekVolumeSeries(ws, 6)` just fetches 6 data points; could be any range | `train/page.tsx` | 164 | Literal text |

### 🟡 P1 — Fix During Sprint 1

| ID | Bug | File | Root Cause |
|----|-----|------|------------|
| B12 | **Leaderboard volume is fabricated** — `queries.ts:265`: `volume: Math.round(u.level * 260 + u.streak * 95)` for other users | `queries.ts` | No real volume data for non-demo users |
| B13 | **todayPlan scheduleMap is incomplete** — Only handles 2-6 days/week; Sunday (0) and Monday (1) mapping is implicit | `queries.ts` | Hardcoded map `{2: [1,4], 3: [1,3,5], ...}` |
| B14 | **Readiness uses hardcoded defaults without notice** — When no body metrics exist, readiness returns ~75 from defaults (sleep 7h, HRV 62, etc.) but UI doesn't indicate "using defaults" | `engine.ts` | Silent fallbacks |
| B15 | **Landing page has hardcoded marketing stats** — "2.4M sets logged", "38k athletes", "11.2M kg moved", "4.9 App Store rating" | `page.tsx` | Static objects, no data source |
| B16 | **Landing page RECOVERY object is hardcoded** — 11 muscles with static recovery %, sets, lastTrained | `page.tsx` | Not connected to `recoveryMap()` |
| B17 | **Challenge progress is stored on the challenge row**, not per-user — `joined` and `progress` are columns on `challenges` table, shared across all users | `schema.ts` | Missing junction table (user_challenges) |
| B18 | **No CSRF protection** on server actions | `actions.ts` | Next.js server actions have some built-in protection, but no explicit token validation |
| B19 | **coach.ts hardcodes plan exercises** — `actions.ts:498`: `planExercises: ["Barbell Bench Press", ...]` | `actions.ts` | Should come from actual today plan |

### 🟢 P2 — Design Gaps (Address in Sprints 1-3)

| ID | Gap | Notes |
|----|-----|-------|
| G01 | No offline-first sync | No IndexedDB, no service worker, no sync queue |
| G02 | No PWA manifest | Not installable |
| G03 | No testing at all | No Vitest, Playwright, or axe |
| G04 | No CI pipeline | No GitHub Actions |
| G05 | No real auth | Email-only, no password, no OAuth |
| G06 | No i18n | English only |
| G07 | No rate limiting | Open server actions |
| G08 | No data export/delete | No privacy controls |
| G09 | 63 exercises seeded | Need 1,500+ for Sprint 1 |
| G10 | No food database | Nutrition logging is manual-only |
| G11 | No monorepo structure | Single app, no packages split |

## 6. Positive Findings (Keep These)

1. **Clean design language** — consistent dark theme, lime accent, semantic color system, good typography
2. **Solid data model** — 20+ tables with proper indexes, foreign keys, cascade deletes
3. **Working engine** — readiness scoring, e1RM, recovery map, plate calculator, compression, alternatives ranking, protein plan — all implemented and reasonable
4. **Full workout lifecycle** — start, log sets (with optimistic updates), PR detection, swap exercise, compress, finish with summary
5. **Rich seed data** — 7 users, 4 programs, 56 days of workout history, nutrition logs, body metrics, social posts, challenges
6. **Server actions with validation** — input clamping, ownership checks, volume tracking
7. **Responsive layout** — sidebar on desktop, bottom tabs on mobile, mobile drawer
8. **Rest timer** — visual countdown with skip and +30s, haptic feedback
9. **Voice logging** — basic Web Speech API integration in live workout

## 7. Architecture Risks

1. **SQLite in production** — fine for dev; must migrate to PostgreSQL for concurrent users, but current Drizzle schema ports cleanly
2. **Full workspace load** — `getWorkspace()` loads ALL workouts, sets, posts, etc. for a user in one call; will need pagination for real usage
3. **No connection pooling** — `better-sqlite3` is synchronous; must switch to `pg` with pool for production
4. **Seed data is demo, not test fixtures** — e2e tests need stable fixtures separate from seed

## 8. Priority Fix Order for Phase 0

1. ✅ Fix TypeScript errors in landing page (B-TS)
2. Fix level/XP computation — single formula everywhere (B03, B04)
3. Fix weekly session checkmarks — proper date + slot matching (B01)
4. Fix "Week 6" — compute from enrollment and completed sessions (B02)
5. Fix readiness card — add labels, dates, factor breakdown (B07)
6. Fix "Start session" CTA — sticky bottom bar on mobile (B06)
7. Fix sign-out clipping — profile menu or overflow fix (B05)
8. Add target weights to exercise rows (B08)
9. Differentiate Dashboard vs Train (B09)
10. Fix fabricated leaderboard volume (B12)

---

**Recommendation:** Fix all P0 bugs, create seed baseline and test fixtures, then proceed to Sprint 1 (the perfect logger). The codebase is good — upgrade it, don't rewrite.
