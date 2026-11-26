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

## Sprint 1: The Perfect Logger (A1–A10, I1–I2)

### Goal
The fastest, most reliable set logger in the category. Build Active Workout screen first; everything depends on it.

### Milestones
| # | Feature | IDs |
|---|---------|-----|
| 1.1 | Monorepo migration (Turborepo + pnpm) | — |
| 1.2 | Design system in packages/ui (Storybook, components from §3) | — |
| 1.3 | Set logger with custom keypad, 2-tap logging | A1 |
| 1.4 | Supersets, circuits, giant sets | A2 |
| 1.5 | Rest timer (auto-start, mini-timer, notifications, haptics) | A3 |
| 1.6 | Previous performance ghost values | A4 |
| 1.7 | Plate calculator + warm-up generator | A5 |
| 1.8 | Live PR detection + celebration | A6 |
| 1.9 | Routines (create, edit, duplicate, folders, drag-reorder) | A7 |
| 1.10 | Exercise library (1,500+ exercises, search, filters) | A8 |
| 1.11 | Workout lifecycle (start, pause, crash recovery, finish summary) | A9 |
| 1.12 | Offline-first sync (IndexedDB, sync queue, conflict resolution) | A10 |
| 1.13 | Auth (email+password, Google, Apple, phone OTP) + onboarding | I1 |
| 1.14 | Responsive shell with bottom tabs (Today, Train, Nutrition, Progress, Profile) | I2 |
| 1.15 | Today screen rebuilt (single session card + sticky Start) | — |
| 1.16 | Tests: unit (e1RM, PR, plate math, sync) + e2e (10-set offline workout) | — |

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
