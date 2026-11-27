# FORGE — Build & Launch Plan

**Status:** v1.0 demo complete · production path defined
**Last updated:** 2026-11-25
**Owner:** Product & Engineering (solo-build demo)

---

## 1. Objective

Build the world's most coherent training product: one system that senses the athlete's state, decides the next best action, and adapts the plan in real time — without the fragmentation of five apps.

**Definition of “top 1” for this build:** not market share on day one, but a product that (a) unifies every meaningful competitor capability, (b) adds a genuinely new adaptive loop, and (c) executes at consumer-app polish. Market leadership then follows retention.

### Success criteria (v1 demo)

| # | Criterion | Status |
| --- | --- | --- |
| 1 | All core pillars work end-to-end on real persisted data | ✅ |
| 2 | Adaptive logic is deterministic and explainable, not a mockup | ✅ |
| 3 | Dribbble-grade responsive UI across 15 routes | ✅ |
| 4 | Production build passes with zero type errors | ✅ |
| 5 | Seeded demo tells a credible story in under 60 seconds | ✅ |
| 6 | Deep research, PRD, architecture, data model and GTM documented | ✅ |
| 7 | Every named competitor capability is matched or deliberately superseded | ✅ (matrix in docs/02) |
| 8 | Honest licensing position for all studied repositories | ✅ |

### Launch success metrics (production)

| Metric | Target @ 90 days | Target @ 12 months |
| --- | --- | --- |
| D30 retention | ≥ 35% | ≥ 45% |
| Sessions / active week | ≥ 2.8 | ≥ 3.5 |
| Sets logged / session | ≥ 14 | ≥ 18 |
| Free → paid conversion | ≥ 4% | ≥ 6.5% |
| Trial → paid | ≥ 35% | ≥ 45% |
| Crash-free sessions | ≥ 99.5% | ≥ 99.9% |
| p95 API latency | < 300 ms | < 200 ms |
| NPS | ≥ 40 | ≥ 55 |

---

## 2. Strategy

### The wedge
**Adaptive session integrity.** Every competitor either records (Hevy, Strong, Jefit), plans statically (Boostcamp, most PDF programs), or generates generic workouts (Fitbod). None keeps a plan coherent when reality changes — missed days, missing equipment, poor sleep, 20 spare minutes.

### The moat
1. **Longitudinal data graph** across training + fuel + recovery + form, per athlete.
2. **Decision engine** whose outputs improve with that graph (collaborative + causal signals).
3. **Switching cost of coherence** — leaving means reassembling five tools and losing the adaptive loop.
4. **Community artifacts** (PR cards, challenges, check-ins) that create identity and distribution.

### Non-goals for v1
- Full gym-management SaaS (memberships/billing/staff) — studied, deliberately excluded.
- Medical diagnosis or injury rehab prescriptions.
- Hardware, wearables, or a custom camera model in the demo.
- Multi-tenant enterprise admin, SSO, SOC 2 (production phase).

---

## 3. Phases & status

### Phase 0 — Research (complete)
- [x] Clone and analyze 8 open-source repositories (`_research/`).
- [x] Teardown Hevy, Strong, Fitbod, Jefit, Boostcamp, MyFitnessPal, Strava, Gym Log, advice.fit, gymsmart.in.
- [x] Map feature parity and whitespace.
- [x] Establish licensing constraints (AGPL/GPL/custom).
- [x] Define positioning and product principles.
- [x] Choose stack and local-first demo architecture.

### Phase 1 — Foundation (complete)
- [x] Next.js 16 + React 19 + TypeScript + Tailwind v4 setup.
- [x] Drizzle schema: users, exercises, routines, workouts, sets, PRs, metrics, nutrition, water, social, challenges, coach, comments.
- [x] SQLite client + `drizzle-kit push` + idempotent seed.
- [x] Design tokens, fonts, root layout, UI primitives, charts, body map.
- [x] Auth cookie + demo fallback; app shell with responsive nav.
- [x] Query layer (`getWorkspace`) and pure engine library.

### Phase 2 — Core product (complete)
- [x] Dashboard: readiness, today's plan, fuel, recovery, weekly volume, PRs, community.
- [x] Training overview + program enrollment.
- [x] Live workout: optimistic logging, steppers, rest timer, RPE autoreg, plate math, voice/natural-language logging, swap/add exercise, compression, finish flow, PR celebration.
- [x] Session summary with stimulus map, set log, next-session recommendation, XP/streak.
- [x] Exercise library with filters, technique, cues, history and strength standards.
- [x] Programs marketplace with 4 seeded routines and day previews.
- [x] Nutrition: macro ring, water, meal log, scanner flow, protein-gap generator.
- [x] Progress: e1RM/volume trends, body metrics, strength standards, level, shareable PR cards (canvas PNG + Web Share).
- [x] Social: feed, composer, likes, comments, follows, check-ins, gym radar, leaderboard, challenges.
- [x] Coach: persisted chat grounded in real readiness, nutrition, recovery and plan.
- [x] Form check: simulated 17-joint analysis, metrics, cues, camera opt-in, scoring rubric.
- [x] Settings: profile, equipment checklist, targets, account/sign-out.
- [x] Marketing landing page with interactive adaptive demo.
- [x] Login page with demo athlete shortcut.

### Phase 3 — Hardening (in progress)
- [x] `npm run build` clean; all 15 routes return 200 in smoke test.
- [x] Fix server→client function prop on dashboard.
- [x] Fix coach aggregate types and routine rep range rendering.
- [x] Fix per-workout exercise history selection (e1RM-based, not weight × reps typo).
- [ ] Unit tests for engine functions (readiness, recovery decay, compression, e1RM, protein plan).
- [ ] Playwright happy-path: login → start session → log set → finish → share.
- [ ] Lighthouse pass ≥ 95 performance / 100 accessibility on dashboard.
- [ ] Empty/error/loading states for every route.
- [ ] Seed determinism (fixed timestamps relative to today, not drift).
- [ ] Mobile QA at 320/390/430 px; safe-area insets.
- [ ] Error monitoring + structured logging.
- [ ] Accessibility audit: keyboard-only logging, screen-reader labels, focus trap in sheets.

### Phase 4 — Production platform (next)
- [ ] Postgres + Redis + object storage + background jobs.
- [ ] Real auth (email OTP + OAuth), sessions, device management, rate limits.
- [ ] Offline-first sync (IndexedDB queue + idempotent set mutations).
- [ ] Real LLM coach with tool calling, citations, safety filters and cost caps.
- [ ] Pose inference (MediaPipe/MoveNet on-device; server fallback for premium).
- [ ] Food recognition + barcode + regional nutrition database + human review.
- [ ] Push notifications, rest-timer live activity, watch companion.
- [ ] Payments (Stripe/RevenueCat), entitlement service, trials, win-back.
- [ ] Moderation, reporting, privacy controls, export/delete.
- [ ] Observability: OpenTelemetry, Sentry, product analytics, experiment flags.

### Phase 5 — Growth (18 months)
See [`docs/08-roadmap.md`](docs/08-roadmap.md) for quarter-by-quarter scope.

---

## 4. Work breakdown (next 10 working days)

| Day | Deliverable | Acceptance |
| --- | --- | --- |
| 1 | Engine unit tests | ≥ 90% branch coverage on `engine.ts`; golden cases for recovery and compression |
| 2 | Playwright happy path | CI runs login → live session → summary → PR share headlessly |
| 3 | Offline set queue prototype | Airplane-mode logging survives reload; duplicates impossible |
| 4 | Auth hardening | OTP + OAuth, signed sessions, CSRF review, rate limits |
| 5 | Postgres migration | Drizzle schema parity; seed runs against Postgres; query benchmarks |
| 6 | Realtime social | WebSocket/SSE check-ins and feed updates; presence TTL |
| 7 | LLM coach v1 | Tool-calling over workspace; guardrails; latency < 3s p95; cost < $0.02/msg |
| 8 | Food scan v1 | 20-class regional classifier; confirmation UX; confidence thresholds |
| 9 | Accessibility + mobile polish | Keyboard-only session; 320px layout; reduced-motion pass |
| 10 | Launch candidate | Build, e2e, load test, privacy review, store assets |

---

## 5. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Feature sprawl dilutes the adaptive story | High | High | Every surface must answer “what should I do next?”; kill vanity features |
| Form analysis perceived as medical advice | Medium | High | Frame as training feedback; disclaimers; no diagnosis; human escalation |
| Food recognition accuracy disappoints | High | Medium | Confirmation-first UX; portion editing; confidence display; regional dataset |
| LLM cost/latency/hallucination | Medium | High | Deterministic engine owns numbers; LLM only narrates with tool outputs; caps |
| Wearable integration complexity | High | Medium | Start with Apple Health/Health Connect imports; no custom hardware |
| Churn after novelty | High | High | Streak protection, weekly digest, adaptive deloads, social accountability |
| AGPL contamination | Low | High | Clean-room implementation; dependency license scan in CI |
| Injury liability | Low | High | Evidence-based templates, RPE caps, form cues reviewed by S&C advisor |
| Data breach | Low | Critical | Encryption at rest/in transit, least privilege, audit logs, pen test |
| Solo-build bus factor | Medium | High | Documented architecture, tests, infra-as-code, runbooks |

---

## 6. Key product decisions (and why)

| Decision | Rationale |
| --- | --- |
| SQLite for the demo | Zero setup, one file, fast iteration; schema is Postgres-compatible via Drizzle |
| Deterministic engine first, AI second | Trust requires explainable numbers; LLM narrates, never invents load |
| On-device pose, coordinates only | Privacy is a product feature; bandwidth and latency improve |
| One-cue form feedback | Reports are ignored mid-set; a single actionable cue changes behavior |
| Compression instead of “missed workout” | Preserves adherence and identity; reduces guilt-driven churn |
| Same-pattern swaps | Stimulus continuity beats exercise purity when equipment fails |
| Protein-gap generator, not another food diary | Solves the 9pm decision; leverages existing macro data |
| Canvas PR cards | Distribution loop with no server image cost; native share on mobile |
| Dark, acid-lime identity | Differentiates from blue/white trackers; reads as serious training tool |
| No chart library | Bundle and design control; SVG charts are small and themeable |

---

## 7. Open questions

1. Should the free tier include the adaptive engine for 7 days, or keep adaptation paid from day one?
2. Is the primary acquisition channel creators/coaches (B2B2C) or ASO + short-form video?
3. Do we launch mobile as React Native (shared logic) or PWA first (fastest, weaker HealthKit)?
4. How much form-analysis context can we store without creating privacy or liability exposure?
5. Which regional food database partnership gives best coverage per dollar (India, SEA, LATAM first)?
6. Should challenges be user-generated with stakes, or curated to protect integrity?
7. What is the minimum coach surface that improves retention without commoditizing human coaching?

---

## 8. Definition of done — public beta

- [ ] Auth, billing, privacy policy, terms, support channel live.
- [ ] 99.9% uptime SLO; error budget and on-call runbook.
- [ ] p95 < 300 ms for read APIs; set logging < 150 ms perceived.
- [ ] Offline logging with conflict-free reconciliation.
- [ ] Form check + food scan labeled beta with confidence and correction paths.
- [ ] 30-day retention cohort ≥ 30% in beta.
- [ ] Accessibility WCAG 2.2 AA for core flows.
- [ ] Data export and account deletion self-serve.
- [ ] Security review and dependency license audit passed.
- [ ] App Store / Play Store assets, screenshots, privacy nutrition labels.
