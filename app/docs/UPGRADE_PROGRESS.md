# Forge Fitness — Ultimate AI V2 Upgrade Progress

**Branch:** `feat/ultimate-ai-v2`  
**Last Updated:** 2026-11-27

## Prioritized Implementation Checklist

| # | Slice | Status | Notes / Evidence |
|---|---|---|---|
| 1 | **Part C Audit & Progress Setup** (`docs/AUDIT.md`, `docs/UPGRADE_PROGRESS.md`, git branch) | `verified` | Branch `feat/ultimate-ai-v2` created; baseline `typecheck` (0 err) & `vitest` (14 files / 224 tests) recorded. |
| 2 | **Critical Security & Isolation Fixes** (`updateTargetSets` ownership check, security headers in `next.config.ts`, `.env.example`, DB composite indexes & new tables: `ai_usage`, `coach_memory`, `ai_plan_versions`, `sync_proposals`, `ai_apply_tokens`) | `verified` | `npm run db:push` applied; `npm run typecheck` (0 err); `npm test` (14 files / 224 tests); `EXPLAIN QUERY PLAN` zero `USE TEMP B-TREE FOR ORDER BY`. |
| 3 | **Part B Domain Science (`lib/fitness/*`)** (`training.ts`, `nutrition.ts`, `progress.ts`, `safety.ts` + unit tests) | `verified` | `npm run typecheck` (0 err) & `npm test` (15 files / 237 tests, including 13 known-answer fixtures in `fitness.test.ts`). |
| 4 | **Part D1 Provider Layer & Health** (`lib/ai/providers.ts` circuit breaker, JSON repair, `ai_usage`, `GET /api/ai/health` + provider tests) | `doing` | Executing now. |
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

## Active Mini-Spec (Slice 4 — Part D1 Provider Layer & Health)
- **Goal:** Upgrade `src/lib/ai/providers.ts` with `AIProvider` interface, `AIMeta` provenance, 3-failure / 60s circuit breaker, exponential backoff + jitter, JSON repair pass, `ai_usage` logging + daily token budget check, and `GET /api/ai/health`.
- **Inputs:** `src/lib/ai/providers.ts`, `src/db/schema.ts` (`aiUsage`), environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AI_DAILY_TOKEN_BUDGET`).
- **Outputs:** Honest provider routing, `GET /api/ai/health` endpoint, and `src/lib/ai/providers.test.ts` with mocked HTTP responses (200, timeout, 429, 500, malformed JSON, mid-stream drop).
- **Failure Modes:** Provider outage or malformed JSON causing unhandled crash -> prevented by circuit breaker + JSON repair + deterministic fallback (`deterministic:forge`).
- **Verification:** `npm run typecheck`, `vitest run src/lib/ai/providers.test.ts`, and `npm test`.
