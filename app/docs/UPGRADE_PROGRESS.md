# Forge Fitness — Ultimate AI V2 Upgrade Progress

**Branch:** `feat/ultimate-ai-v2`  
**Last Updated:** 2026-11-27

## Prioritized Implementation Checklist

| # | Slice | Status | Notes / Evidence |
|---|---|---|---|
| 1 | **Part C Audit & Progress Setup** (`docs/AUDIT.md`, `docs/UPGRADE_PROGRESS.md`, git branch) | `verified` | Branch `feat/ultimate-ai-v2` created; baseline `typecheck` (0 err) & `vitest` (14 files / 224 tests) recorded. |
| 2 | **Critical Security & Isolation Fixes** (`updateTargetSets` ownership check, security headers in `next.config.ts`, `.env.example`, DB composite indexes & new tables: `ai_usage`, `coach_memory`, `ai_plan_versions`, `sync_proposals`, `ai_apply_tokens`) | `verified` | `npm run db:push` applied; `npm run typecheck` (0 err); `npm test` (14 files / 224 tests); `EXPLAIN QUERY PLAN` zero `USE TEMP B-TREE FOR ORDER BY`. |
| 3 | **Part B Domain Science (`lib/fitness/*`)** (`training.ts`, `nutrition.ts`, `progress.ts`, `safety.ts` + unit tests) | `verified` | `npm run typecheck` (0 err) & `npm test` (15 files / 237 tests, including 13 known-answer fixtures in `fitness.test.ts`). |
| 4 | **Part D1 Provider Layer & Health** (`lib/ai/providers.ts` circuit breaker, JSON repair, `ai_usage`, `GET /api/ai/health` + provider tests) | `verified` | `npm run typecheck` (0 err) & `npm test` (16 files / 243 tests, including 6 provider/circuit/JSON tests in `providers.test.ts`). |
| 5 | **Part D2-D4 Context, Memory, Injection Defense & SSE Protocol** (`<untrusted_user_data>`, `coach_memory`, `Idempotency-Key`, `interrupted` partial save, draft JSON patch) | `doing` | Executing now. |
| 6 | **Part E Semantic Validator & Plan Lifecycle** (`semantic-validator.ts`, `ai_plan_versions` diff/restore, idempotent `applyToken`) | `todo` | |
| 7 | **Part F Coaches Vertical Slices** (Atlas/Programs, Forge Trainer/Train, Atlas Motion/Exercises, Vitals/Progress, Fuel/Nutrition prompts + UI upgrades) | `todo` | |
| 8 | **Part G Cross-Section Sync V2** (`sync_proposals` inbox, 4 scenarios, loop/depth=3/24h dedupe + E2E tests) | `todo` | |
| 9 | **Part J Extras & Accessibility/Responsive Polish** (Daily Briefing, Weekly/Monthly Reports, Goal Manager, Recommendations, Plan Library) | `todo` | |
| 10 | **Part K & L Verification, Performance & Launch Report** (`typecheck`, `test`, `build`, Playwright desktop+mobile verification, `docs/LAUNCH_REPORT.md`) | `todo` | |

---

## Decisions & Rationale
- **One AI Engine:** Keep `src/lib/ai/engine.ts` as the single orchestrator wrapping pure `lib/fitness/*` domain math and `lib/ai/providers.ts`.
- **No Unnecessary Dependencies:** Existing stack (`zod`, `drizzle-orm`, `better-sqlite3`, `lucide-react`, `vitest`) covers all requirements cleanly.

## Active Mini-Spec (Slice 5 — Part D2–D4 Context, Memory, Injection Defense & SSE Protocol)
- **Goal:** Add token-budgeted context + `<untrusted_user_data>` prompt-injection delimiting, `coach_memory` CRUD (`/api/ai/memory`), SSE events (`meta`, `delta`, `card`, `draft`, `usage`, `done|error`, `ping`), `Idempotency-Key` dedupe, upstream abort propagation saving `status="interrupted"`, and `GET ?after=<id>` reconnect.
- **Inputs:** `src/lib/ai/context.ts`, `src/app/api/ai/coach/route.ts`, `src/db/schema.ts` (`coachMemory`, `aiConversations`).
- **Outputs:** `src/lib/ai/memory.ts`, `src/app/api/ai/memory/route.ts`, hardened `context.ts` & `/api/ai/coach/route.ts`, plus unit tests.
- **Failure Modes:** Prompt injection in user notes/names or duplicate stream submissions -> prevented by `<untrusted_user_data>` XML escaping + `Idempotency-Key` in-flight cache + partial save on abort.
- **Verification:** `npm run typecheck`, `npm test`, and SSE / memory unit tests.
