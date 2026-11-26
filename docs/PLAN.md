# FORGE BUILD PLAN — Master Phased Roadmap

> One prompt, six phases. Each phase ends with a report and review gate.

---

## Phase 0: Audit & Bug Fixes ← **COMPLETE**

### Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0.1 | Full codebase audit → `/docs/AUDIT.md` | ✅ Done |
| 0.2 | Fix TypeScript errors (landing page imports) | ✅ Done |
| 0.3 | Fix level/XP formula — single source of truth | ✅ Done (`computeLevelProgress`) |
| 0.4 | Fix weekly session checkmarks (done/skipped/next/upcoming) | ✅ Done (date-keyed completion) |
| 0.5 | Fix "Week N of M" computation | ✅ Done (`currentProgramWeek`) |
| 0.6 | Fix readiness card — labels, dates, factor breakdown | ✅ Done (breakdown + confidence badge) |
| 0.7 | Fix Start session CTA — sticky bottom bar on mobile | ✅ Done (train + dashboard cards) |
| 0.8 | Fix sign-out clipping + hide dev badge | ✅ Done (profile menu, drawer sign-out) |
| 0.9 | Add target weights to exercise rows on Train | ✅ Done (`suggestedLoad`) |
| 0.10 | Differentiate Dashboard vs Train session cards | ✅ Done (dashboard = readiness/fuel, train = plan table) |
| 0.11 | Fix fabricated leaderboard volume | ✅ Partial (real streak; peer volume still unavailable) |
| 0.12 | Fix "6-week load" and "14.7k kg proj." labels | ✅ Done ("Weekly load", real target weights) |
| 0.13 | Create seed baseline with deterministic test fixtures | ✅ Seed baseline (fixtures pending) |
| 0.14 | Typecheck + build pass | ✅ Done |
| 0.15 | Phase 0 report → stop for review | ✅ This document |

### Phase 0 verification (2026-11-26)
- `npm run build` — clean
- `npx vitest run` — 28/28 passing (`src/lib/engine.test.ts`)
- All 14 routes return HTTP 200
- Known gaps: peer leaderboard volume needs historical sets per user; real auth, offline sync, PWA, and full monorepo remain Sprint 1+.


---

## Sprint 1: The Perfect Logger (A1–A10, I1–I2) ← **COMPLETE**

### Goal
The fastest, most reliable set logger in the category. Built Active Workout screen first with 2-tap logging, superset auto-advance, Olympic plate calculator, floating rest timer, live PR detection, and offline sync.

### Milestones
| # | Feature | IDs | Status |
|---|---------|-----|--------|
| 1.1 | 2-tap `SetRow` with previous ghost values & rapid stepper | A1 | ✅ Done |
| 1.2 | Set type cycling (Normal, Warmup `W`, Drop `D`, Failure `F`) | A1 | ✅ Done |
| 1.3 | Superset visual badges (`SS-1A`, `SS-1B`) & auto-advance partner focus | A2 | ✅ Done |
| 1.4 | `FloatingRestTimer` with Web Audio harmonic chime & vibration haptics | A3 | ✅ Done |
| 1.5 | Previous performance ghost values & target pre-fills | A4 | ✅ Done |
| 1.6 | `PlateCalculatorModal` (Olympic sleeve visualization + warm-up generator) | A5 | ✅ Done |
| 1.7 | Live PR detection, projected e1RM calculation & PR celebration card | A6 | ✅ Done |
| 1.8 | Exercise library expansion with alias search ("rdl", "ohp", "bb bench", etc.) | A8 | ✅ Done |
| 1.9 | Active workout crash recovery via local state snapshots | A9 | ✅ Done |
| 1.10 | Offline-first sync manager (`syncManager`, queue, idempotency, `SyncStatusPill`) | A10 | ✅ Done |
| 1.11 | Responsive shell with bottom navigation & sticky action CTAs | I2 | ✅ Done |
| 1.12 | Tests: 41/41 unit tests pass + Playwright e2e (360px, 768px, 1440px) | — | ✅ Done |

### Sprint 1 Verification Results (2026-11-26)
- **TypeScript Typecheck:** 0 errors (`npx tsc --noEmit`)
- **Unit Tests:** 41/41 passed (`src/lib/engine.test.ts`, `src/lib/exercise-aliases.test.ts`, `src/lib/sprint1-features.test.ts`)
- **Production Build:** Clean (`next build` across all 14 routes)
- **1-Tap Set Logging Latency Benchmark:** 29ms–48ms across viewports (target: < 100ms)
- **Console Errors:** 0 console errors across all viewports in Playwright e2e runs
- **Artifacts:** Full-page screenshots captured at 360px, 768px, 1440px

---

## Sprint 2: Adaptive + Voice (B1–B5, C1)

### Goal
Smart auto-regulation that earns trust by showing its reasoning, plus voice/text logging.

### Milestones
| # | Feature | IDs | Status | Notes |
|---|---------|-----|--------|-------|
| 2.1 | Readiness daily check-in + ring + 7-day chart | B1 | **COMPLETE** | Interactive modal, sleep/HRV/RHR/soreness sliders, instant score update |
| 2.2 | Auto-regulated loads (target weights from engine + "why") | B2 | **COMPLETE** | Target weight engine with explainable "Why this weight?" calculation badge |
| 2.3 | One-tap equipment swap (ranked equivalents + equipment profiles) | B3 | **COMPLETE** | Commercial, Home Gym, Hotel/Travel, and Calisthenics kit filters |
| 2.4 | "I have N minutes" session compression with diff | B4 | **COMPLETE** | 15m Blitz, 25m Standard, 40m Moderate with antagonist supersets & diff |
| 2.5 | Muscle fatigue heatmap (front/back SVG, tap for detail) | B5 | **COMPLETE** | Interactive BodyMap with tap-for-detail recovery drawer & exercise suggestions |
| 2.6 | Voice and text logging (LLM parser + regex fallback + confirm sheet) | C1 | **COMPLETE** | Shorthand (100x8@8), plate slang, spoken units, VoiceConfirmSheet safety |
| 2.7 | Tests: 60+ parser phrases, engine property tests, swap tests | — | **COMPLETE** | 115/115 tests passing, Playwright e2e across 360px, 768px, 1440px |

---

## Sprint 3: Retention + Platform (D1–D4, E1–E3, G1, I3–I4, E7) ← **COMPLETE**

### Goal
Food log with authentic Indian foods and standard regional units, smart protein optimizer, 7-day smoothed progress trends, server-authoritative gamification, data export sovereignty, and subscription plans with mock checkout adapters.

### Milestones
| # | Feature | IDs | Status | Notes |
|---|---------|-----|--------|-------|
| 3.1 | Food log (search, barcode scanner mock, recents, custom foods, recipes) | D1 | **COMPLETE** | Live animated viewfinder barcode scanner mock, verified EAN presets (Amul, ON Whey, Epigamia, Fortune) |
| 3.2 | Indian and regional foods (IFCT authentic data, katori/roti/piece units) | D2 | **COMPLETE** | Authentic nutritional items: Dal Tadka, Paneer Bhurji, Soya Chunks, Biryani, Rohu Fish, Roti, Idli, Dosa |
| 3.3 | Targets and macro rings (Mifflin-St Jeor TDEE calc, editable goals) | D3 | **COMPLETE** | Animated multi-ring concentric SVG (Calories, Lime Protein, Sky Carbs, Amber Fat) + countdown center |
| 3.4 | "Hit my remaining protein" smart suggestions | D4 | **COMPLETE** | Pure ranking engine evaluating protein density per 100 kcal with dietary preference filtering |
| 3.5 | Exercise charts (e1RM, volume, PRs, range selector: 4w, 8w, 12w, 24w) | E1 | **COMPLETE** | Interactive multi-range period selector (`4w · 1M`, `8w · 2M`, `12w · 3M`, `24w · 6M`) on volume and e1RM |
| 3.6 | Body tracking (weight trend with 7-day moving average, body fat %, photos) | E2 | **COMPLETE** | 7-day smoothed moving average dampening glycogen/water fluctuations with "7-Day Smoothed" badge |
| 3.7 | Reports (weekly/monthly digests, 1-click CSV & JSON export) | E3 | **COMPLETE** | User data sovereignty with unencumbered CSV & JSON historical records export |
| 3.8 | Gamification (streaks, XP, levels, badges, server-authoritative evaluation) | G1 | **COMPLETE** | Century Club, Iron Streak, Double BW Squat, Volume Titan, Protein Champion badge cards with progress bars |
| 3.9 | Privacy & Data Sovereignty (visibility controls, telemetry toggle, cache reset) | I3 | **COMPLETE** | Profile visibility toggle, telemetry disable switch, local IndexedDB wipe, and account purge danger zone |
| 3.10 | Plans (Free/Pro/Gym B2B, feature flags, PaywallCard, Razorpay + Stripe) | I4 | **COMPLETE** | Tier comparison cards, INR (₹799) / USD ($9.99) currency toggle, mock Razorpay UPI & Stripe sessions |
| 3.11 | Consistency module (shared metrics, one value per screen) | E7 | **COMPLETE** | Single source of truth for `formatProgramWeek`, `formatVolumeMetric`, `formatUserLevel`, `formatStreak` |
| 3.12 | Tests: unit tests + Playwright e2e across 3 viewports | — | **COMPLETE** | 131/131 unit tests passing, Playwright e2e passing across 360px, 768px, and 1440px with 0 console errors |

### Sprint 3 Verification Results (2026-11-26)
- **TypeScript Typecheck:** 0 errors (`npx tsc --noEmit`)
- **Unit Tests:** 131/131 passed (`src/lib/sprint3-features.test.ts` 16/16, full suite 131/131)
- **Production Build:** Clean (`next build` across all 14 routes)
- **Console Errors:** 0 console errors across all viewports in Playwright e2e runs
- **Playwright E2E:** Verified across 360px (mobile), 768px (tablet), and 1440px (desktop)
- **Artifacts:** Full screenshots captured for `/app/nutrition`, `/app/progress`, and `/app/settings` saved in `/docs/screens/` and artifact brain directory.

---

## Phase 4: P1 Features (each behind feature flag)

### Completed Core Milestones (Part 1)
| # | Feature | IDs | Status | Notes |
|---|---------|-----|--------|-------|
| 4.1 | Universal CSV Import/Export (Hevy, Strong, FitNotes, Jefit) | A11 | **COMPLETE** | Live multi-app CSV parser, auto weight unit conversion (lbs to kg), alias matching, drag-and-drop modal |
| 4.2 | 10 Built-in Programs Catalog & Selector | F1 | **COMPLETE** | PPL, Upper/Lower, Full Body 3x, 5/3/1 BBB, GZCLP, PHUL, Arnold Split, Calisthenics, Glute Focus, Athletic |
| 4.3 | AI Coach Advanced Intelligence & Context Quick-Pills | F2 | **COMPLETE** | Contextual responses for bench plateau analysis, deload week structuring, crowded gym swaps, missed workouts |
| 4.4 | Plateau Detection & Actionable Periodization | B6 | **COMPLETE** | Detects stalled e1RM over 3 consecutive sessions at RPE ≥ 8.0, prescribes micro-loading, rep shifts, 10% resets |
| 4.5 | Missed-Session Rescheduling Engine | B9, B10 | **COMPLETE** | Rolling calendar slide, antagonist superset merge, and forgive & advance macrocycle modes |
| 4.6 | Crowded Gym Mode (1-Tap Barbell Swaps) | B7 | **COMPLETE** | Replaces occupied squat racks/benches with heavy DB bench, Bulgarian split squats, and DB rows |
| 4.7 | Phase 4 Feature Flags System | — | **COMPLETE** | Centralized flag registry in `lib/feature-flags.ts` with runtime override support |
| 4.8 | Verification & Multi-Viewport E2E | — | **COMPLETE** | 151/151 unit tests passing, Playwright e2e passing across 360px, 768px, and 1440px with 0 console errors |

### Upcoming P1 Milestones (Part 2)
1. Cardio + advanced set types (GPS, intervals, tempo, unilateral) — A12, A13
2. Photo-to-macro, meal planner, supplements, adaptive TDEE — D5-D8
3. Form check (MediaPipe Pose, on-device) — C2
4. Social (friends, feed, kudos, share cards, challenges, leaderboards) — G2-G5
5. Wearables + platform (Watch, widgets, Health Connect, i18n, notifications) — C3-C6, I5-I7
6. Trainer and gym-owner portals — F3, F4, H1-H4

### Phase 4 Part 1 Verification Results (2026-11-26)
- **TypeScript Typecheck:** 0 errors (`npx tsc --noEmit`)
- **Unit Tests:** 151/151 passed (20/20 `src/lib/phase4-features.test.ts`, 7 test suites)
- **Production Build:** Clean (`next build` across all 14 routes)
- **Console Errors:** 0 console errors across all viewports in Playwright e2e runs
- **Playwright E2E:** Verified across 360px (mobile), 768px (tablet), and 1440px (desktop)
- **Artifacts:** Screenshots captured for `/app/programs`, `/app/coach`, and `/app/settings` saved in `/docs/screens/` and artifact brain directory.

---

## Definition of Done (per phase gate)

- [ ] No console errors
- [ ] No hardcoded or fake numbers
- [ ] No clipped UI at 360px, 768px, 1440px
- [ ] New user can sign up → onboard → workout → 10 sets offline → sync → see PRs/charts
- [ ] Every route: loading, empty, error states
- [ ] Typecheck, lint, unit, e2e, a11y all pass
- [ ] README with one-command setup
- [ ] Screenshots at 3 breakpoints in `/docs/screens/`
