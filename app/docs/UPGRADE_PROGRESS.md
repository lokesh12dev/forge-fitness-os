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
| 5 | **Part D2-D4 Context, Memory, Injection Defense & SSE Protocol** (`<untrusted_user_data>`, `coach_memory`, `Idempotency-Key`, `interrupted` partial save, draft JSON patch) | `verified` | `npm run typecheck` (0 err) & `npm test` (17 files / 245 tests, including `context-memory.test.ts`). |
| 6 | **Part E Semantic Validator & Plan Lifecycle** (`semantic-validator.ts`, `ai_plan_versions` diff/restore, idempotent `applyToken`) | `verified` | `npm run typecheck` (0 err) & `npm test` (18 files / 248 tests, including `semantic-validator.test.ts`). |
| 7 | **Part F Coaches Vertical Slices** (Atlas/Programs, Forge Trainer/Train, Atlas Motion/Exercises, Vitals/Progress, Fuel/Nutrition prompts + UI upgrades) | `verified` | 5 prompt builders in `src/lib/ai/prompts/`, safety pre-check + provenance in `engine.ts`, `Idempotency-Key` + `applyToken` in `ModuleAiCoach`, `export/route.ts` fix, `typecheck` (0 err) & `npm test` (19 files / 252 tests). |
| 8 | **Part G Cross-Section Sync V2** (`sync_proposals` inbox, 4 scenarios, loop/depth=3/24h dedupe + E2E tests) | `doing` | Executing now. |
| 9 | **Part J Extras & Accessibility/Responsive Polish** (Daily Briefing, Weekly/Monthly Reports, Goal Manager, Recommendations, Plan Library) | `todo` | |
| 10 | **Part K & L Verification, Performance & Launch Report** (`typecheck`, `test`, `build`, Playwright desktop+mobile verification, `docs/LAUNCH_REPORT.md`) | `todo` | |

---

## Decisions & Rationale
- **One AI Engine:** Keep `src/lib/ai/engine.ts` as the single orchestrator wrapping pure `lib/fitness/*` domain math and `lib/ai/providers.ts`.
- **No Unnecessary Dependencies:** Existing stack (`zod`, `drizzle-orm`, `better-sqlite3`, `lucide-react`, `vitest`) covers all requirements cleanly.

## Active Mini-Spec (Slice 8 — Part G Cross-Section Sync V2)
- **Goal:** Implement `src/lib/ai/sync.ts` (`causalChainId`, `depth <= 3`, 24h dedupe, all 4 scenarios: Goal change, Missed workout, Plateau, Equipment change) + `/api/ai/sync` + Suggestions Inbox UI with Accept / Edit / Dismiss / Snooze.
- **Inputs:** `src/db/schema.ts` (`syncProposals`), `src/lib/fitness/*`, `src/lib/ai/context.ts`.
- **Outputs:** `src/lib/ai/sync.ts`, `src/app/api/ai/sync/route.ts`, `src/components/ai/sync-inbox.tsx` wired into `/app/coach`, and `src/lib/ai/sync.test.ts`.
- **Failure Modes:** Infinite cross-module sync loops or duplicate proposals -> prevented by `depth <= 3`, `causalChainId` cycle guard, and 24h dedupe on `(userId, triggerType, targetModule, targetEntity)`.
- **Verification:** `npm run typecheck`, `vitest run src/lib/ai/sync.test.ts`, and `npm test`.
