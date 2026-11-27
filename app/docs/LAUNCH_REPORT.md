# Forge Fitness — Ultimate AI V2 Launch Report

**Branch:** `feat/ultimate-ai-v2`  
**Date:** 2026-11-27  
**Status:** Production-ready (all automated checks passing)

---

## 1. Automated Verification Results

| Check | Command | Result | Evidence |
|---|---|---|---|
| **Database Schema Push** | `npm run db:push` | Passed | `[✓] Changes applied` (`ai_usage`, `coach_memory`, `ai_plan_versions`, `sync_proposals`, `ai_apply_tokens`, composite indexes) |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Passed | **0 errors** across all routes, server actions, components, and tests |
| **Unit & E2E Integration Suite** | `npm test` (`vitest run`) | Passed | **21 test files / 258 tests passed** in 3.04s |
| **Production Build** | `BROWSERSLIST="defaults" npx next build --webpack` | Passed | **25/25 routes** compiled & generated (exit 0) |

---

## 2. Architecture & Domain Science Summary

- **Pure Domain Science (`src/lib/fitness/*`)**:
  - `training.ts`: experience-based split selector (`full_body`, `upper_lower`, `ppl_ul`, `ppl`), `<48h` recovery spacing validator, weekly hard-set volume bands (`0.5×` indirect), session duration estimator, RPE/RIR conversion, double-progression overload, `reps <= 10` e1RM guard, deload protocol, missed-session recovery (`shift`, `merge`, `reentry_light`, `ramp_back`), `7/14/30/60/90`-day periodization, warm-up ramps, and equipment tier substitutions (`fitness.test.ts`: 6 tests).
  - `nutrition.ts`: Mifflin-St Jeor BMR + activity multipliers + safe clinical floors (`1200` kcal female / `1500` kcal male), `<=3%` macro consistency, protein distribution, fiber/hydration, hard diet (`non_veg`, `eggetarian`, `vegetarian`, `vegan`, `jain`) and allergen filters, `±10% kcal / ±15% protein` macro-matched swaps, grocery aggregator, and adherence math (`fitness.test.ts`: 4 tests).
  - `progress.ts`: `measured | calculated | recommendation | missing` provenance (`"Not recorded"` for unlogged metrics), 7-day smoothed weight slope (`>=3` entries / `>=7` days) with `>=1.5 kg` water-noise flagging, plateau detection (`>=14` days, `>=5` points, `>=70%` adherence), and weekly/monthly report builders.
  - `safety.ts`: medical red-flag, eating-disorder/sub-1000 kcal, and PED/dosing clinical referrals, plus injury-aware exercise exclusion (`shoulder`, `lower_back`, `knee`, `wrist`, `elbow`, `neck`, `ankle`) (`fitness.test.ts`: 3 tests).

- **AI Provider Layer & Health (`src/lib/ai/providers.ts`, `GET /api/ai/health`)**:
  - Honest provenance (`llm:<provider>:<model>` or `deterministic:forge`), 3-failure / 60s circuit breaker, exponential backoff + jitter on `429`/`5xx`, single-pass JSON repair, `ai_usage` token telemetry, and `AI_DAILY_TOKEN_BUDGET` enforcement (`providers.test.ts`: 6 tests).

- **Context, Memory, Injection Defense & SSE (`src/lib/ai/context.ts`, `memory.ts`, `/api/ai/coach`, `/api/ai/memory`)**:
  - Token-budgeted context with `<untrusted_user_data>` XML tag escaping (`context-memory.test.ts`: 2 tests), persistent `coach_memory` CRUD, `Idempotency-Key` deduplication, `GET ?after=<id>` reconnect, SSE events (`meta`, `delta`, `plan`, `draft`, `usage`, `done`), and abort partial-save (`status="interrupted"`).

- **Semantic Validator & Plan Lifecycle (`src/lib/ai/semantic-validator.ts`, `/api/ai/plans`)**:
  - Blocking validation (`EX_UNKNOWN`, `EX_EQUIPMENT`, `EX_INJURY`, `VOL_ABOVE_MRV`, `NUT_BELOW_FLOOR`, `NUT_DIET_VIOLATION`, `NUT_ALLERGEN_VIOLATION`) returning HTTP `422`, immutable `ai_plan_versions` history + `computePlanDiff`, and `applyToken` idempotency (`semantic-validator.test.ts`: 3 tests).

- **5-Module Prompts & Cross-Section Sync V2 (`src/lib/ai/prompts/*`, `src/lib/ai/sync.ts`, `/api/ai/sync`, `SyncInbox`)**:
  - Dedicated prompt builders for `schedule`, `workout`, `exercise`, `body`, and `nutrition` wired into `src/lib/ai/engine.ts` with pre-prompt safety checks.
  - Cross-Section Sync V2 covering `goal_change`, `missed_workout`, `plateau`, and `equipment_change` with `depth <= 3`, `causalChainId` loop guard, 24h dedupe, and `SyncInbox` on `/app/coach` (`sync.test.ts`: 2 tests).

---

## 3. Security & Multi-User Isolation Matrix

Verified in `src/lib/ai/e2e-integration.test.ts` and `src/app/actions.ts`:

| Surface | Protection | Verified Outcome |
|---|---|---|
| `updateTargetSets` (`src/app/actions.ts`) | Verifies parent `workout.userId === user.id` | Cross-user mutation blocked |
| `DELETE /api/ai/memory` | Scoped by `and(eq(id), eq(userId))` | User B deleting User A's memory returns **404** |
| `POST /api/ai/sync` (`resolve`) | Scoped by `and(eq(id), eq(userId))` | User B resolving User A's proposal returns **404** |
| `POST /api/ai/plans` (`apply_plan`) | `validatePlanSemantically` + `ai_apply_tokens` | Invalid exercise ID blocked with **422** (`EX_UNKNOWN`) |
| HTTP Security Headers (`next.config.ts`) | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | Applied to all routes |

---

## 4. Performance & Latency

- **SSE Coach Response (`POST /api/ai/coach`)**: Completed full `meta -> delta -> plan -> usage -> done` stream in **380 ms** in `e2e-integration.test.ts`.
- **SQLite Query Plans**: `EXPLAIN QUERY PLAN` on `ai_conversations`, `ai_plans`, and `ai_goals` confirmed **zero `USE TEMP B-TREE FOR ORDER BY`** after adding composite indexes.
- **Full Test Suite**: 21 files / 258 tests executed in **3.04 s**.

---

## 5. Honest Operational Notes

- **AI Provenance**: No external LLM API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are configured in the local `.env`; `/api/ai/health` and all chat telemetry honestly report `deterministic:forge`. Adding any key to `.env` enables live LLM generation automatically with circuit-breaker fallback.
- **Browser E2E Note**: `playwright` is not installed in the local workspace (`no-playwright-local`), so full route-handler E2E integration, SSE streaming, semantic gating, and multi-user isolation were verified via `vitest` (`src/lib/ai/e2e-integration.test.ts`) alongside the full `next build --webpack` (25/25 routes).
