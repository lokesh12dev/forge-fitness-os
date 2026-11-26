# DECISIONS LOG — FORGE

Each entry records a decision made during development, including context, options considered, and rationale.

---

## D-001 — Keep the existing codebase, do not restart

**Date:** 2026-11-25
**Context:** The build prompt says "do not restart from scratch unless the audit proves the codebase is unsalvageable."
**Decision:** Keep the codebase and upgrade incrementally.
**Rationale:**
- 44 source files, ~9,000 lines of well-structured TypeScript
- Working data model (20+ tables), engine (readiness, e1RM, recovery, plate math), and full workout lifecycle
- 14 routes all rendering, seed data generating realistic history
- Design language is polished and consistent
- No architectural dead-ends — SQLite → PostgreSQL, single app → monorepo, demo auth → real auth are all incremental migrations
- Bugs are data/display inconsistencies, not structural failures

---

## D-002 — Single level/XP formula

**Date:** 2026-11-25
**Context:** Three different level formulas found: `floor(sqrt(xp/100))+1` (engine.ts), `floor(xp/520)` (actions.ts:293), `xp=12480, level=24` (seed.ts). The XP bar in app-shell.tsx uses `xp % 520` which yields 0 when XP is exactly divisible.
**Decision:** Use `floor(sqrt(xp/100))+1` from engine.ts as the canonical formula. This gives a smooth curve where each level requires progressively more XP. At 12,480 XP → level 12 (not 24). Update seed data to match.
**XP per level:** Level N requires `(N-1)² × 100` total XP. Level 1 = 0 XP, Level 2 = 100 XP, Level 5 = 1,600 XP, Level 10 = 8,100 XP, Level 15 = 19,600 XP.
**Progress:** `(xp - levelFloorXp) / (nextLevelXp - levelFloorXp) × 100%`

---

## D-003 — Week computation

**Date:** 2026-11-25
**Context:** "Week 6" and "Week 6 of 8" are hardcoded.
**Decision:** Compute current week as `floor((completedSessionsInProgram) / daysPerWeek) + 1`, capped at routine.weeks. This counts actual training weeks, not calendar weeks.
**Display format:** "Week {current} of {total}" everywhere. Shared function in a metrics module.

---

## D-004 — Session status states

**Date:** 2026-11-25
**Context:** Weekly sessions list shows all checkmarks. Need clear states.
**Decision:** Four states per program day in a week:
- `done` — a completed workout matching this day's name exists in the current calendar week
- `skipped` — the day's scheduled weekday has passed without a completed workout
- `next` — the first unfinished day that matches today or the next scheduled weekday
- `upcoming` — future scheduled days
**Calendar week:** Monday 00:00 to Sunday 23:59, local timezone.

---

## D-005 — SQLite for development, PostgreSQL for production

**Date:** 2026-11-25
**Context:** Current stack uses better-sqlite3. The spec calls for PostgreSQL + Redis + Meilisearch.
**Decision:** Keep SQLite for local development (zero-config, single command). Add Docker Compose with PostgreSQL, Redis, and Meilisearch for production-like local env. Schema stays in Drizzle (portable). Migration to PostgreSQL happens when we add the monorepo structure in Sprint 1.

---

## D-006 — Readiness defaults must be visible

**Date:** 2026-11-25
**Context:** readinessScore() silently falls back to defaults (sleep 7h, HRV 62, etc.) when no metrics exist.
**Decision:** Keep the defaults (they're reasonable). Add a `confidence` field to the return value: 1.0 if all inputs present, reduced by 0.2 for each missing input. UI shows "estimated" badge when confidence < 0.8.

---

## D-007 — Exercise data sourcing

**Date:** 2026-11-25
**Context:** Need 1,500+ exercises. Spec says check licenses for open-source repos. The existing 63 exercises are original content.
**Decision:** Expand to 1,500+ by writing original exercise descriptions. Use free-exercise-db (CC0) for name/muscle/equipment references only. Do not copy instructions from wger (AGPL-3.0) or any commercial app. Record all sources in `/docs/LICENSES.md`.

---

## D-008 — Monorepo migration timing

**Date:** 2026-11-25
**Context:** Spec calls for Turborepo + pnpm monorepo. Current app is a single Next.js project.
**Decision:** Complete Phase 0 bug fixes in the current structure. Begin monorepo migration at Sprint 1 start, as the first milestone before building the logger. Packages: apps/web, packages/ui, packages/engine, packages/db, packages/types. Mobile (apps/mobile) and API (apps/api) added later.
