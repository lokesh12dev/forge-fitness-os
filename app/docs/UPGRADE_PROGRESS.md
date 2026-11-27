# Forge Fitness — Ultimate AI V2 Upgrade Progress

**Branch:** `feat/ultimate-ai-v2`  
**Last Updated:** 2026-11-27

## Prioritized Implementation Checklist

| # | Slice | Status | Notes / Evidence |
|---|---|---|---|
| 1 | **Part C Audit & Progress Setup** (`docs/AUDIT.md`, `docs/UPGRADE_PROGRESS.md`, git branch) | `verified` | Branch `feat/ultimate-ai-v2` created; baseline `typecheck` (0 err) & `vitest` (14 files / 224 tests) recorded. |
| 2 | **Critical Security & Isolation Fixes** (`updateTargetSets` ownership check, security headers in `next.config.ts`, `.env.example`, DB composite indexes & new tables: `ai_usage`, `coach_memory`, `ai_plan_versions`, `sync_proposals`) | `doing` | Executing now. |
| 3 | **Part B Domain Science (`lib/fitness/*`)** (`training.ts`, `nutrition.ts`, `progress.ts`, `safety.ts` + unit tests) | `todo` | Pure functions with known-answer fixtures. |
| 4 | **Part D1 Provider Layer & Health** (`lib/ai/providers.ts` circuit breaker, JSON repair, `ai_usage`, `GET /api/ai/health` + provider tests) | `todo` | |
| 5 | **Part D2-D4 Context, Memory, Injection Defense & SSE Protocol** (`<untrusted_user_data>`, `coach_memory`, `Idempotency-Key`, `interrupted` partial save, draft JSON patch) | `todo` | |
| 6 | **Part E Semantic Validator & Plan Lifecycle** (`semantic-validator.ts`, `ai_plan_versions` diff/restore, idempotent `applyToken`) | `todo` | |
| 7 | **Part F Coaches Vertical Slices** (Atlas/Programs, Forge Trainer/Train, Atlas Motion/Exercises, Vitals/Progress, Fuel/Nutrition prompts + UI upgrades) | `todo` | |
| 8 | **Part G Cross-Section Sync V2** (`sync_proposals` inbox, 4 scenarios, loop/depth=3/24h dedupe + E2E tests) | `todo` | |
| 9 | **Part J Extras & Accessibility/Responsive Polish** (Daily Briefing, Weekly/Monthly Reports, Goal Manager, Recommendations, Plan Library) | `todo` | |
| 10 | **Part K & L Verification, Performance & Launch Report** (`typecheck`, `test`, `build`, Playwright desktop+mobile verification, `docs/LAUNCH_REPORT.md`) | `todo` | |

---

## Decisions & Rationale
- **One AI Engine:** Keep `src/lib/ai/engine.ts` as the single orchestrator wrapping pure `lib/fitness/*` domain math and `lib/ai/providers.ts`.
- **No Unnecessary Dependencies:** Existing stack (`zod`, `drizzle-orm`, `better-sqlite3`, `lucide-react`, `vitest`) covers all requirements cleanly.

## Active Mini-Spec (Slice 2 — Critical Security, Schema & Indexes)
- **Goal:** Fix `updateTargetSets` ownership check, add security headers + `.env.example`, and add `ai_usage`, `coach_memory`, `ai_plan_versions`, `sync_proposals` tables + composite indexes.
- **Inputs:** `src/app/actions.ts`, `next.config.ts`, `src/db/schema.ts`, `src/db/index.ts`.
- **Outputs:** Enforced SQL ownership, HTTP security headers, `.env.example`, and indexed V2 tables.
- **Failure Modes:** Existing `forge.db` rows lost if destructive migration runs -> prevented by additive `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.
- **Verification:** `npm run db:push`, `EXPLAIN QUERY PLAN` showing no temp B-tree sorts, `npm run typecheck`, `npm test`.
