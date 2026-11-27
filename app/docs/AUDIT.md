# Forge Fitness (SmartGymForge) — Part C Full Engineering Audit

**Audit Date:** 2026-11-27  
**Branch:** `feat/ultimate-ai-v2`  
**Repository:** `/Users/m.lokesh/gymapp/app`

---

## 1. Baseline Verification

- `npm run typecheck` (`tsc --noEmit`): **PASS** (0 errors).
- `npm test` (`vitest run`): **PASS** (14 test files, 224 tests passed in 1.12s).
- `npm run build` (`next build`):
  - Default Turbopack mode fails in this sandbox due to OS port-binding restriction on PostCSS worker (`Operation not permitted (os error 1)`).
  - Webpack mode (`BROWSERSLIST="defaults" npx next build --webpack`): **PASS** (exit 0, 21/21 routes built).
- `lint` script: Not configured in `package.json`.

---

## 2. Architecture Map

- **Routes:** `/app`, `/app/programs` (Plan & Schedule), `/app/train` & `/app/train/[id]` (Workout), `/app/exercises` (Exercises), `/app/progress` (Stats & Body), `/app/nutrition` (Nutrition), `/app/coach` (AI Hub), `/app/form-check`, `/app/social`, `/app/gym`, `/app/trainer`, `/app/settings`, `/login`.
- **API Routes:** `/api/ai/coach`, `/api/ai/plans`, `/api/ai/briefing`, `/api/ai/goals`, `/api/demo-login`.
- **AI & Domain Libs:**
  - `src/lib/ai/schemas.ts`, `src/lib/ai/context.ts`, `src/lib/ai/engine.ts`, `src/lib/ai/providers.ts`, `src/lib/ai/briefing.ts`
  - `src/lib/engine.ts`, `src/lib/coach.ts`, `src/lib/food-db.ts`, `src/lib/opennutri-core.ts`, `src/lib/nutrition-planner.ts`, `src/lib/opengym-catalog.ts`, `src/lib/plan-store.ts`
- **AI UI Components:** `src/components/ai/module-ai-coach.tsx`, `src/components/ai/ai-plan-panel.tsx`, `src/components/ai/ai-hub-panels.tsx`, `src/components/coach-client.tsx`.

---

## 3. Prioritized Audit Findings

### CRITICAL
1. **C1 — Missing `ai_usage`, `coach_memory`, `ai_plan_versions`, and `sync_proposals` tables (`src/db/schema.ts`, `src/db/index.ts`)**
   - *Evidence:* `src/db/schema.ts` currently stores only `ai_conversations`, `ai_plans`, and `ai_goals`. Plan versions overwrite `ai_plans.planJson` on `update_plan` without immutable version rows (`ai_plan_versions`), there is no `ai_usage` token/budget table, no `coach_memory` structured coaching decisions table, and no `sync_proposals` inbox table for cross-section sync.
   - *Impact:* No immutable version diff/rollback history, no per-user daily token budget enforcement, and cross-section sync has no persistent proposal inbox.
   - *Fix:* Add `ai_usage`, `coach_memory`, `ai_plan_versions`, and `sync_proposals` tables with FKs (`ON DELETE CASCADE`) and composite indexes.

2. **C2 — `getCurrentUser()` silent fallback to `DEMO_USER_ID` (`src/lib/auth.ts:10-14`)**
   - *Evidence:* `const uid = store.get(SESSION_COOKIE)?.value ?? DEMO_USER_ID;`
   - *Impact:* Unauthenticated API requests without a cookie silently act as `"u-alex"` instead of returning `401` unless explicitly tested with another session cookie. For local demo UX this is intentional on SSR pages, *but* API routes and isolation tests must support strict multi-user isolation (`WHERE id = ? AND user_id = ?` returning `404` for other users' resources) and explicit cookie-based auth checks.
   - *Fix:* Enforce `WHERE id = ? AND user_id = ?` returning `404` on all single-resource routes (`ai/plans`, `ai/goals`, `ai/memory`, `ai/sync`), and add `401` enforcement helper for strict API testing when `STRICT_AUTH=1` or explicit invalid session cookie is presented.

3. **C3 — Missing Security Headers & CSRF/Sanitization Hardening (`next.config.ts`, `src/components/ai/module-ai-coach.tsx`)**
   - *Evidence:* `next.config.ts` has no `headers()` configuration (`X-Content-Type-Options`, `X-Frame-Options` / `CSP` `frame-ancestors`, `Referrer-Policy`).
   - *Impact:* Missing defense-in-depth HTTP headers and explicit prompt-injection `<untrusted_user_data>` delimiting in AI prompts.
   - *Fix:* Add security headers in `next.config.ts`, `<untrusted_user_data>` sanitization/wrapping in `lib/ai/context/*`, and strict React text rendering (no `dangerouslySetInnerHTML`) in Markdown UI.

### HIGH
4. **H1 — Domain Science Rules scattered instead of pure typed `lib/fitness/*` modules (`src/lib/engine.ts`, `src/lib/ai/engine.ts`)**
   - *Evidence:* `src/lib/ai/engine.ts` computes training splits, nutrition targets, and plateau checks inline inside coach generators rather than delegating to pure, table-tested `lib/fitness/*` functions.
   - *Impact:* Harder to enforce B1–B4 domain invariants (e.g., 48h muscle recovery spacing, B1 weekly set bands, Mifflin-St Jeor + activity multiplier + 3% macro check, Jain/allergen hard rejections, 7-day smoothed weight slope, 14-day/5-point plateau gate).
   - *Fix:* Implement `src/lib/fitness/training.ts`, `src/lib/fitness/nutrition.ts`, `src/lib/fitness/progress.ts`, and `src/lib/fitness/safety.ts`, unit-test every rule, and feed their calculated facts into both deterministic and LLM prompts.

5. **H2 — Semantic Validation Catalog & Idempotent Plan Apply (`src/lib/ai/schemas.ts`, `src/app/api/ai/plans/route.ts`)**
   - *Evidence:* `validateAndNormalizeAiPlan` runs Zod structural validation only; it does not check B1/B3 semantic rules (`EX_UNKNOWN`, `EX_EQUIPMENT`, `VOL_SESSION_CAP`, `FREQ_RECOVERY`, `DUR_EXCEEDS`, `NUT_MACRO_MISMATCH`, `NUT_DIET_VIOLATION`, `NUT_ALLERGEN`, `NUT_BELOW_FLOOR`, `XSEC_*`), nor does `apply_plan` accept an `applyToken` for idempotency.
   - *Impact:* Plans could violate allergen/diet constraints or duplicate mutations on double-click.
   - *Fix:* Implement `src/lib/ai/semantic-validator.ts` and idempotency key checking on `apply_plan`.

6. **H3 — Provider Layer lacks Circuit Breaker, `/api/ai/health` route, and `AIProvider` interface (`src/lib/ai/providers.ts`)**
   - *Evidence:* `providers.ts` has basic retry + timeout, but lacks a 3-failure / 60s circuit breaker, structured JSON repair pass, `ai_usage` logging, and `GET /api/ai/health`.
   - *Fix:* Upgrade `src/lib/ai/providers.ts` and add `src/app/api/ai/health/route.ts`.

7. **H4 — SSE Protocol missing `meta`, `card`, `draft`, `usage`, `ping`, `Idempotency-Key`, and `status="interrupted"` persistence (`src/app/api/ai/coach/route.ts`)**
   - *Evidence:* Current SSE emits `delta`, `plan`, `done` only; aborting mid-stream does not save partial `status="interrupted"` text or propagate `Idempotency-Key`.
   - *Fix:* Upgrade `/api/ai/coach` SSE framing and abort handling.

### MEDIUM
8. **M1 — Temp B-tree sorts on `ai_conversations`, `ai_plans`, `ai_goals` (`EXPLAIN QUERY PLAN`)**
   - *Evidence:* `EXPLAIN QUERY PLAN` output shows `USE TEMP B-TREE FOR ORDER BY` on `ai_conversations`, `ai_plans`, and `ai_goals`, and `workouts (user_id, status)` lacks a composite index.
   - *Fix:* Add composite indexes `(user_id, module, created_at)` and `(user_id, status)`.

9. **M2 — Cross-Section Sync V2 Event Bus & `sync_proposals` Inbox missing**
   - *Evidence:* `crossSync` is currently an inline checkbox on a single plan rather than an event-driven `sync_proposals` inbox with `causalChainId`, `depth <= 3`, 24h dedupe, and Accept/Edit/Dismiss/Snooze.
   - *Fix:* Implement `src/lib/ai/sync.ts` and `/api/ai/sync/route.ts` + Suggestions Inbox UI.

10. **M3 — Missing `.env.example`**
    - *Evidence:* No `.env.example` exists in `/Users/m.lokesh/gymapp/app`.
    - *Fix:* Add `.env.example` documenting `AI_PROVIDER_ORDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_RATE_LIMIT_*`.

---

## 4. Route & Action Isolation Audit Matrix

| Endpoint / Action | Auth (`requireUser`/`getCurrentUser`) | User ID from Session | SQL `user_id` Ownership | Input Validated (Zod) | Rate Limited |
|---|---|---|---|---|---|
| `GET/POST/DELETE /api/ai/coach` | Yes | Yes | Yes | Yes | POST: Yes (30/min) |
| `GET/POST /api/ai/plans` | Yes | Yes | Yes | Yes | Needs apply limit |
| `GET /api/ai/briefing` | Yes | Yes | Yes | N/A | Read-only |
| `GET/POST/PATCH/DELETE /api/ai/goals` | Yes | Yes | Yes | Yes | Needs write limit |
| `src/app/actions.ts` (`startWorkout`, `completeSet`, `logFood`, `updateTargets`, etc.) | Yes | Yes | Yes (`updateTargetSets` needs `workout.userId` check!) | Partial | No |

> **Note:** `updateTargetSets(workoutExerciseId, targetSets)` in `src/app/actions.ts:461` calls `await requireUser()` but does not verify the parent `workout.userId === user.id` — flagged for immediate fix in Milestone 2!
