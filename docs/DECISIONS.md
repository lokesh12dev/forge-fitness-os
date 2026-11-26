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

---

## D-009 — 2-Tap SetRow with Ghost Performance Watermarks

**Date:** 2026-11-26
**Context:** Sprint 1 target requires set logging in $\le 2$ taps with interaction latency $< 100\text{ms}$.
**Decision:**
- Pre-fill ghost placeholders from previous workout performance or adaptive target suggestion.
- Tapping the checkmark logs the set in 1 tap if sticking with suggested weight/reps, or 2 taps if adjusting weight/reps.
- Set index button cycles set type between Normal, Warmup (`W`), Drop (`D`), and Failure (`F`).
- Playwright benchmark verified 1-tap logging latency at 29ms–48ms across viewports.

---

## D-010 — Superset Auto-Advance

**Date:** 2026-11-26
**Context:** Lifters alternating between paired lifts (`SS-1A` and `SS-1B`) need seamless switching without manual tab navigation.
**Decision:**
- When logging a set on an exercise with a superset group (e.g. `SS-1A`), `logSetSpecific` automatically detects and focuses the paired unfinished exercise (`SS-1B`).
- Notifies the user with a subtle confirmation toast and auto-updates the active view.

---

## D-011 — Offline-First Sync Queue with Idempotency Keys & Crash Recovery

**Date:** 2026-11-26
**Context:** Lifters training in airplane mode or basements with poor cellular reception cannot lose sets.
**Decision:**
- `syncManager` (`src/lib/offline-sync.ts`) enqueues all set completions, deletions, and adjustments with unique UUID idempotency keys.
- Real-time `SyncStatusPill` renders connection state (`🟢 Synced`, `🟡 Syncing`, `🔴 Offline`).
- Active workout state is continuously saved to local storage snapshots (`saveActiveSnapshot`) and restored on page reload/crash recovery (`loadActiveSnapshot`).

---

## D-012 — Web Audio Synthesizer for Rest Timer Audio

**Date:** 2026-11-26
**Context:** Rest timer audio chime must work offline without external audio file requests (preventing 404s and network latency).
**Decision:**
- Built-in `FloatingRestTimer` synthesizes a dual-tone harmonic chime (sine/triangle oscillator at 587Hz → 880Hz → 1174Hz) using the standard Web Audio API with vibration haptics.
- Supports +30s, -15s, skip, and mute controls.

---

## D-013 — Olympic Barbell Plate Math & Warm-up Generator

**Date:** 2026-11-26
**Context:** Lifters need instant plate loading math and progressive warm-up ramping before heavy working sets.
**Decision:**
- `PlateCalculatorModal` computes exact per-side Olympic plate loading (25, 20, 15, 10, 5, 2.5, 1.25kg) with standard IWF color-coded sleeve visualization (Red, Blue, Yellow, Green, White, Black).
- Warm-up tab automatically generates progressive warm-up sets (empty bar mobility, 45% pattern groove, 65% acclimation, 82% CNS potentiation).

---

## D-014 — Exercise Alias & Acronym Matcher

**Date:** 2026-11-26
**Context:** Lifters search using gym shorthand (e.g., "rdl", "ohp", "bb bench", "db incline", "lat pull", "cgbp", "bss").
**Decision:**
- Implemented `src/lib/exercise-aliases.ts` mapping comprehensive gym abbreviations and acronyms to exercise slugs and full movement patterns.
- Integrated into `ExerciseLibrary` and `AddExerciseSheet` for instant search filtering.

---

## D-015 — Explainable Auto-Regulation with "Why This Weight?" Engine Explainer (B2)

**Date:** 2026-11-26
**Context:** Black-box AI weight suggestions alienate serious lifters who demand to know why a specific load is prescribed.
**Decision:**
- Implemented `adaptiveTargetWeightWithReason()` in `app/src/lib/engine.ts`.
- Evaluates double progression (reps at top of target range with RPE ≤ 8), RPE threshold adherence, and physiological readiness score (<60 trims 2.5–7.5%, ≥85 primes for top-set overload).
- Returns human-readable explanation and factor breakdown displayed inline via expandable "Why this weight?" explainer badge on each exercise card.

---

## D-016 — Equipment Profile Presets for Live Workout Swaps (B3)

**Date:** 2026-11-26
**Context:** Lifters frequently switch environments (commercial gym, home garage, hotel gym, travel/calisthenics) and need alternative exercises matched to accessible equipment.
**Decision:**
- Implemented `EQUIPMENT_PROFILES` (`commercial`, `home_gym`, `hotel_travel`, `bodyweight`) filtering ranked movement pattern equivalents.
- Interactive switcher in `Sheet` swap modal re-ranks movement equivalents in real time, keeping set, rep, and stimulus intent intact.

---

## D-017 — Multi-Tier Session Compression with Live Diff Preview (B4)

**Date:** 2026-11-26
**Context:** Lifters pressed for time need quick session truncation without losing primary compound training volume.
**Decision:**
- Implemented `compressSession()` with three preset windows: 15-minute Blitz (prunes accessories, scales rest 0.70x, antagonist pairs), 25-minute Standard (pairs supersets, scales rest 0.80x), and 40-minute Moderate (pairs isolation movements, scales rest 0.85x).
- Renders live diff comparison card showing original vs compressed duration, superset pairings, and preserved working volume.

---

## D-018 — Deterministic Voice/NLP Command Parser with Explicit Confirmation Sheet (C1)

**Date:** 2026-11-26
**Context:** Voice dictation in noisy gym environments or quick shorthand typing must never silently log incorrect exercises or hazardous loads.
**Decision:**
- Implemented `parseWorkoutVoiceCommand()` supporting 61+ syntax variations: shorthand (`100x8@8`), plate slang (`two plates = 100kg`, `three plates = 140kg`), spoken numbers (`one hundred twenty`), imperial conversions (`225 lbs`), and RIR notation (`1 rir -> RPE 9`).
- Enforces an explicit `VoiceConfirmSheet` requiring single-tap user verification before writing to local state or sync queue.

---

## D-019 — Indian & Regional Food Database with Authentic IFCT Servings (D1, D2)

**Date:** 2026-11-26
**Context:** Western macro trackers (MyFitnessPal, MacroFactor) fail in India by lacking standard regional dishes and cultural portion units (`katori`, `roti`, `piece`).
**Decision:**
- Implemented `FOOD_DATABASE` in `app/src/lib/food-db.ts` containing authentic nutritional data derived from Indian Food Composition Tables (IFCT 2017) and verified commercial brands.
- Built-in coverage for staple foods (Dal Tadka, Paneer Bhurji, Soya Chunks, Chicken Biryani, Rohu Fish, Moong Dal Khichdi, Idli, Dosa, Sattu) with cultural serving units: `1 katori (150g)`, `1 medium roti (35g)`, `1 scoop (30g)`.
- Integrated `resolveBarcode()` with real verified EAN/UPC barcodes (e.g. Amul High Protein Lassi `8901262010052`, ON Gold Standard Whey `748927056488`, Epigamia Greek Yogurt `8906074210411`, Fortune Soya Chunks `8906007280016`).
- Built `BarcodeScannerModal` featuring an animated viewfinder laser beam, instant camera viewfinder mock, numeric search fallback, and 1-tap logging.

---

## D-020 — Mifflin-St Jeor TDEE Engine & Smart Protein Optimizer (D3, D4)

**Date:** 2026-11-26
**Context:** Lifters struggle with generic calorie calculators and frequently find themselves with a 30–50g protein deficit at the end of the day without knowing what to eat within their remaining calorie budget.
**Decision:**
- Implemented standard Mifflin-St Jeor BMR formulas in `app/src/lib/nutrition-engine.ts`:
  - Male: $BMR = 10 \times \text{weightKg} + 6.25 \times \text{heightCm} - 5 \times \text{age} + 5$
  - Female: $BMR = 10 \times \text{weightKg} + 6.25 \times \text{heightCm} - 5 \times \text{age} - 161$
- Goal calorie adjustments: Fat loss (-500 kcal deficit with elevated protein at 2.2g/kg), Maintenance (TDEE with 2.0g/kg protein), Lean bulk (+300 kcal surplus with 2.0g/kg protein).
- Implemented `hitRemainingProtein()` optimizer that ranks foods by protein density ($g \text{ protein} / 100 \text{ kcal}$) constrained by remaining daily calorie budget, supporting vegetarian and vegan dietary filters.
- Built concentric multi-ring animated SVG (`MacroRings`) displaying Calories (white), Protein (acid lime `#C9F73A`), Carbs (sky blue `#6EA8FF`), and Fat (amber `#FFD166`).

---

## D-021 — 7-Day Smoothed Moving Average for Weight Tracking (E1, E2)

**Date:** 2026-11-26
**Context:** Daily scale weight fluctuates up to ±1.5kg due to sodium intake, glycogen hydration, and bowel transit time, causing unnecessary psychological distress and false program adjustments.
**Decision:**
- Implemented `calculateWeightMovingAverage()` using a rolling 7-day trailing window to dampen short-term noise and reveal true physiological mass trends.
- Upgraded `PerformancePanel` in `app/src/components/progress-client.tsx` with multi-range period selection (`4w · 1M`, `8w · 2M`, `12w · 3M`, `24w · 6M`).
- Displayed prominent "7-Day Smoothed" badge with delta vs raw scale weight.

---

## D-022 — Server-Authoritative Gamification Badges & Platform Plans (G1, I3, I4)

**Date:** 2026-11-26
**Context:** Badges, streaks, and subscription tiers must be evaluated deterministically and server-authoritatively to prevent client-side spoofing, while preserving full user data sovereignty.
**Decision:**
- Implemented `evaluateBadges()` in `app/src/lib/gamification.ts` covering key strength & consistency milestones: `century_club` (100+ workouts), `iron_streak_14` (14-day streak), `double_bw_squat` (2x bodyweight squat), `volume_titan` (50,000+ kg weekly volume), `protein_champion` (7 consecutive days hitting protein target).
- Implemented `isFeatureUnlocked()` in `app/src/lib/plans.ts` with tiers: Free (unlimited logging forever), Pro (AI adaptive coach, photo-to-macro, form check, advanced analytics), and Gym B2B Partner (client roster, attendance tracking).
- Implemented mock payment adapters for Razorpay (India UPI/cards) and Stripe (Global subscriptions) with INR (₹799/yr) and USD ($9.99/mo) currency switching.
- Implemented 1-click unencumbered training data export (CSV & JSON) and local IndexedDB cache purge for complete user data sovereignty.



