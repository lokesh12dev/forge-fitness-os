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
| # | Feature | IDs |
|---|---------|-----|
| 2.1 | Readiness daily check-in + ring + 7-day chart | B1 |
| 2.2 | Auto-regulated loads (target weights from engine + "why") | B2 |
| 2.3 | One-tap equipment swap (ranked equivalents + equipment profiles) | B3 |
| 2.4 | "I have N minutes" session compression with diff | B4 |
| 2.5 | Muscle fatigue heatmap (front/back SVG, tap for detail) | B5 |
| 2.6 | Voice and text logging (LLM parser + regex fallback + confirm sheet) | C1 |
| 2.7 | Tests: 60+ parser phrases, engine property tests, swap tests | — |

---

## Sprint 3: Retention + Platform (D1–D4, E1–E3, G1, I3–I4, E7)

### Goal
Food log with Indian foods, progress charts, gamification, privacy, and plans.

### Milestones
| # | Feature | IDs |
|---|---------|-----|
| 3.1 | Food log (search, barcode, recents, favorites, custom, recipes) | D1 |
| 3.2 | Indian and regional foods (2,000+ foods, IFCT, katori/piece units) | D2 |
| 3.3 | Targets and macro rings (TDEE calc, editable goals) | D3 |
| 3.4 | "Hit my remaining protein" suggestions | D4 |
| 3.5 | Exercise charts (e1RM, volume, PRs, range selector) | E1 |
| 3.6 | Body tracking (weight trend, measurements, photos) | E2 |
| 3.7 | Reports (weekly/monthly, export CSV/JSON) | E3 |
| 3.8 | Gamification (streaks, XP, levels, badges, server-side computed) | G1 |
| 3.9 | Privacy (data export, account deletion, sharing controls) | I3 |
| 3.10 | Plans (Free/Pro/B2B, feature flags, PaywallCard, Razorpay+Stripe) | I4 |
| 3.11 | Consistency module (shared metrics, one value per screen) | E7 |
| 3.12 | Tests: nutrition math, barcode mock, streak edge cases, e2e meal flow | — |

---

## Phase 4: P1 Features (each behind feature flag)

Built in this order:
1. Import/Export (Hevy, Strong, Jefit, FitNotes CSV) — A11
2. Programs (10 built-in) + AI Coach chat — F1, F2
3. Deload/plateau detection, missed-session rescheduling, crowded-gym mode — B6, B9, B10, B8, B7
4. Cardio + advanced set types (GPS, intervals, tempo, unilateral) — A12, A13
5. Photo-to-macro, meal planner, supplements, adaptive TDEE — D5-D8
6. Form check (MediaPipe Pose, on-device) — C2
7. Social (friends, feed, kudos, share cards, challenges, leaderboards) — G2-G5
8. Wearables + platform (Watch, widgets, Health Connect, i18n, notifications) — C3-C6, I5-I7
9. Trainer and gym-owner portals — F3, F4, H1-H4

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
