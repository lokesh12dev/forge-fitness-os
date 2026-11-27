# Roadmap — 18 Months

**Horizon:** Q4 2026 → Q1 2028
**Strategy:** prove the adaptive loop in a focused web/PWA beta, then earn the right to native and scale.

---

## 1. Guiding sequence

```
Trust the numbers → Make logging effortless → Prove retention → Go native → Scale distribution
```

Do not invert this order. A beautiful native app with untrustworthy prescriptions churns faster.

---

## 2. Milestones at a glance

| Quarter | Theme | Headline outcome |
| --- | --- | --- |
| Q4 2026 | Demo → private beta | 50 athletes, engine tested, auth/billing live |
| Q1 2027 | Retention loop | D30 ≥ 35%, offline logging, iOS/Android beta |
| Q2 2027 | Intelligence v2 | LLM coach GA, pose MVP, food scan beta |
| Q3 2027 | Social & creators | Program marketplace, coach seats, share loops |
| Q4 2027 | Scale readiness | Postgres/Redis/ClickHouse, SLOs, SOC 2 readiness |
| Q1 2028 | Growth | Paid acquisition, partnerships, international |
| Q2 2028 | Platform | API, integrations, enterprise wellness pilot |

---

## Q4 2026 — Demo → private beta

### Product
- [x] Working demo across 15 routes (this build).
- [x] Deterministic readiness, recovery, compression, swap, protein plan.
- [x] Live logging, summary, PR cards, nutrition, social, coach, form check.
- [ ] Onboarding: goal, experience, equipment, units, availability.
- [ ] Real auth: email OTP + Apple/Google OAuth, sessions, device revoke.
- [ ] Entitlements + Stripe checkout; 14-day trial; paywall after trial.
- [ ] Privacy policy, terms, support, data export/delete.
- [ ] Empty/error/loading states for every route.

### Engineering
- [ ] Postgres + Drizzle migrations; seed parity.
- [ ] Redis for workspace cache and rate limits.
- [ ] Engine unit tests ≥ 90% branch coverage (readiness, recovery, compression, e1RM, protein, plates, standards).
- [ ] Playwright: login → start → log → finish → share.
- [ ] Sentry + structured logs + uptime monitor.
- [ ] CI: lint, typecheck, test, build, e2e, migration dry-run.
- [ ] Deploy: Vercel/Fly + Neon + Upstash; staging + production.

### Beta
- [ ] Recruit 50 committed lifters (3+ years, 3–5 sessions/week).
- [ ] Weekly interviews; instrument adaptation acceptance and override reasons.
- [ ] Success: 4-week completion ≥ 60%, D30 ≥ 30%, NPS ≥ 30.

### Exit criteria
- Zero data-loss incidents in 4 weeks.
- p95 read < 400 ms; crash-free ≥ 99.5%.
- 10 athletes say “I would be annoyed if this disappeared.”

---

## Q1 2027 — Retention loop

### Product
- [ ] Offline-first logging (web IndexedDB + mobile SQLite queue).
- [ ] Push notifications: rest timer, session reminder, weekly digest (opt-in).
- [ ] Streak protection: “minimum effective session”, freeze tokens, no shame copy.
- [ ] Deload automation with explanation and one-tap accept.
- [ ] Program enrollment lifecycle: current day, missed-day reschedule, graduation.
- [ ] Body metric trends with rolling average and goal projection.
- [ ] iOS + Android beta (React Native/Expo, shared domain package).
- [ ] Apple Health / Health Connect import (sleep, HRV, RHR, workouts).

### Engineering
- [ ] Sync protocol v1: mutation queue, idempotency, conflict rules.
- [ ] Mobile design system parity; native navigation and gestures.
- [ ] Background jobs: recovery recompute, PR reconciliation, weekly digest.
- [ ] Feature flags + experiment framework.
- [ ] Load test 10k concurrent users; DB index review.

### Metrics
- D7 ≥ 55%, D30 ≥ 35%, WAU/MAU ≥ 45%.
- Sessions/week ≥ 2.8; sets/session ≥ 14.
- Notification opt-out < 15%.

### Exit criteria
- Offline logging survives airplane mode + app kill + reconcile.
- Native apps rated ≥ 4.5 in TestFlight/internal track.
- Retention beats a logging-only control cohort.

---

## Q2 2027 — Intelligence v2

### Product
- [ ] LLM coach GA: read-only tools, citations, streaming, safety filters, cost caps.
- [ ] Pose MVP: squat + bench, on-device, rep count and 3 metrics; confidence UX.
- [ ] Food scan beta: top-3 dishes, portion confirmation, regional foods; correction loop.
- [ ] Protein-gap v2: preferences, allergies, budget, “already eaten today” diversity.
- [ ] Plateau detection + suggested intervention (volume, intensity, exercise rotation).
- [ ] Warm-up generator from working weight.
- [ ] Rest timer Live Activity (iOS) / foreground service (Android).

### Engineering
- [ ] AI gateway: provider routing, fallback, cost/latency budgets, prompt versioning.
- [ ] Eval harness: 200-prompt coach set; form clip set; food photo set.
- [ ] On-device inference pipeline + model update mechanism.
- [ ] Media service: signed uploads, transcode, retention, deletion.
- [ ] Human review queue for low-confidence outputs.

### Metrics
- Adaptation acceptance ≥ 55%; override reason capture ≥ 80%.
- Coach factuality ≥ 98% on golden set; first token < 1.5 s p95.
- Form rep F1 ≥ 0.95; food top-3 ≥ 80%.
- AI cost < $0.02 per coach message; < $0.01 per food scan.

### Exit criteria
- No safety incidents in 8 weeks of AI GA.
- Form feature does not increase support contacts per 1k sessions.
- Food scan improves 7-day nutrition logging frequency vs. control.

---

## Q3 2027 — Social & creators

### Product
- [ ] Creator program marketplace: publish, version, sell; revenue share.
- [ ] Coach seats: client roster, adherence/readiness flags, shareable reports, messaging.
- [ ] Challenge v2: user-generated with anti-cheat, teams, stakes-free by default.
- [ ] Share loops: PR cards, weekly recap, form overlay clips (opt-in), referral.
- [ ] Gym radar v2: partner gyms, occupancy from check-ins, class schedules (read-only).
- [ ] Community moderation: report/block, queue, appeals, transparency report.
- [ ] Localization: Spanish, Portuguese, Hindi; units and food regionalization.

### Engineering
- [ ] Feed fan-out (push/pull hybrid), Redis cache, cursor pagination at scale.
- [ ] Realtime: WebSocket/SSE for check-ins, comments, challenge progress.
- [ ] Payments for creators: Stripe Connect, tax forms, payouts.
- [ ] Anti-abuse: rate limits, spam classifier, device signals, manual review.
- [ ] Search: Postgres FTS → OpenSearch if needed.

### Metrics
- ≥ 30% of new users arrive via share/referral.
- Creator programs: 20 creators, 2k enrolled athletes.
- Coach seats: 50 coaches, 1k clients; coach retention ≥ 80%.
- Report response < 24 h; action rate tracked.

---

## Q4 2027 — Scale readiness

### Product
- [ ] Multi-device session handoff (start on phone, finish on watch).
- [ ] Apple Watch app: log set, rest timer, HR.
- [ ] Advanced analytics: volume by muscle, strength balance, weekly readiness vs. performance.
- [ ] Data export v2: CSV/JSON + scheduled backup.
- [ ] Accessibility audit fixes; WCAG 2.2 AA verified.
- [ ] Family/duo plan; student pricing; regional pricing.

### Engineering
- [ ] Postgres read replicas + PgBouncer; partitioning for sets/events.
- [ ] ClickHouse event pipeline; product analytics dashboards.
- [ ] OpenTelemetry traces; SLO dashboards; burn-rate alerts; on-call rotation.
- [ ] Chaos drills: DB failover, Redis loss, LLM outage, queue backlog.
- [ ] Security: pen test, dependency audit, SBOM, secrets rotation.
- [ ] SOC 2 Type I readiness; DPA/sub-processor list.
- [ ] Cost review: per-user infra + AI margin.

### Metrics
- 99.9% availability; p95 read < 300 ms.
- Infra cost < 12% of revenue; AI cost < 8% of revenue.
- Zero P1 security findings open > 7 days.

---

## Q1 2028 — Growth

### Product
- [ ] Referral v2: give a month, get a month; team challenges.
- [ ] Seasonal programs (New Year, summer, HYROX) with creator partners.
- [ ] Integration hub: Strava share-out, Apple Health, Garmin, Whoop, Oura.
- [ ] “Forge for Coaches” self-serve onboarding.
- [ ] Web onboarding without install; progressive PWA install prompt.

### Go-to-market
- [ ] Creator affiliate program (30% first year).
- [ ] Short-form video engine: PR cards, form overlays, “25-minute session” demos.
- [ ] ASO sprint: screenshots, keywords, ratings prompts.
- [ ] Paid tests: Meta/TikTok/Google with CAC payback < 6 months.
- [ ] Partnerships: supplement brands, gym chains, physio clinics (non-medical).
- [ ] Press: “the adaptive training OS” narrative with real retention data.

### Metrics
- 100k registered, 25k MAU, 8k paying.
- CAC < $25 blended; LTV/CAC ≥ 3.
- Organic ≥ 45% of installs.
- D30 ≥ 40%; NPS ≥ 50.

---

## Q2 2028 — Platform

### Product
- [ ] Public API (read-only first): workouts, recovery, nutrition summaries.
- [ ] Webhooks for coaches and partners.
- [ ] Enterprise wellness pilot: aggregate dashboards, SSO, DPA, admin roles.
- [ ] Research mode: opt-in data donation for published studies.
- [ ] Marketplace v2: equipment, gyms, recovery services.

### Engineering
- [ ] API gateway, OAuth apps, rate limits, usage tiers.
- [ ] Multi-region reads; EU data residency.
- [ ] Warehouse/lakehouse for research and BI.
- [ ] SOC 2 Type II; annual pen test; bug bounty.

### Metrics
- 3 enterprise pilots; 10 API partners.
- Platform revenue ≥ 10% of total.
- Research collaboration ≥ 1 published paper.

---

## 3. Quarterly operating rhythm

| Week | Focus |
| --- | --- |
| 1 | Planning: metrics review, scope, risks |
| 2–5 | Build: two-week cycles, demo every Friday |
| 6 | Mid-quarter user research + retention cohort review |
| 7–10 | Build + hardening |
| 11 | Freeze, QA, accessibility, load test |
| 12 | Release, retro, next-quarter draft |
| 13 | Buffer / debt / experiments |

### Release cadence
- Web: daily to staging, 2–3×/week production.
- Mobile: biweekly beta, monthly store release.
- Models: shadow → 5% → 25% → 100%, with rollback.

---

## 4. Hiring plan

| Phase | Roles |
| --- | --- |
| Beta (Q4 2026) | Founder/eng, part-time designer, S&C advisor |
| Q1 2027 | +1 full-stack, +1 mobile |
| Q2 2027 | +1 ML/vision, +1 RD/nutrition, +1 support |
| Q3 2027 | +1 growth, +1 creator partnerships, +1 community/moderation |
| Q4 2027 | +1 platform/SRE, +1 security (contract) |
| 2028 | +GM/ops, +enterprise sales, +data science |

**Advisors:** certified S&C coach, registered dietitian, privacy counsel, experienced fitness operator.

---

## 5. Risks to the roadmap

| Risk | Trigger | Response |
| --- | --- | --- |
| Adaptation isn't trusted | Override rate > 50% | Simplify, show more evidence, let users lock preferences |
| Native slips | RN performance/complexity | PWA first; keep domain logic shared; hire mobile lead early |
| AI costs exceed margin | > 10% revenue | Route simple intents to templates; cache; cap; smaller models |
| Food accuracy disappoints | Correction rate > 40% | Confirmation-first, narrower cuisine focus, human review |
| Creator supply is slow | < 10 creators by Q3 | Seed with 3 anchor coaches; rev-share incentives; done-with-you onboarding |
| Churn after novelty | D30 < 25% | Adherence mechanics, coach touchpoints, social accountability, deloads |
| Regulatory scrutiny | Medical claims or injury | Conservative language, expert review, disclaimers, no diagnosis |
| Platform fees/policy | App Store changes | Web billing where allowed; own email/SMS; PWA |
| Solo bus factor | Founder unavailable | Docs, tests, runbooks, IaC, contractor bench |

---

## 6. What we will not build (18 months)

- Gym ERP (memberships, door access, staff scheduling) — integrate, don't own.
- Hardware or wearables.
- Clinical rehab or medical nutrition therapy.
- A general-purpose social network.
- A 10,000-exercise scraped library; quality over count.
- Full micronutrient + recipe database parity with MFP.
- Crypto, NFTs, or tokenized rewards.

---

## 7. Decision gates

| Gate | Date | Question | If no |
| --- | --- | --- | --- |
| G1 | Jan 2027 | Do 50 beta athletes retain ≥ 30% at D30? | Narrow to one persona; fix activation |
| G2 | Apr 2027 | Does offline + native improve sessions/week? | Re-scope mobile; focus web |
| G3 | Jul 2027 | Is the LLM coach trusted and affordable? | Keep deterministic coach; reduce scope |
| G4 | Oct 2027 | Do creators/coaches acquire profitably? | Double down on ASO/short-form |
| G5 | Jan 2028 | Is unit economics venture-scale? | Optimize pricing/cost; consider bootstrap |
| G6 | Apr 2028 | Is platform/enterprise demand real? | Stay consumer; license API only |

---

## 8. Definition of success at 18 months

- 100k registered, 25k MAU, 8k paying, $1.5–2.5M ARR run-rate.
- D30 ≥ 40%, NPS ≥ 50, organic ≥ 45% of installs.
- Adaptive loop validated: users who accept ≥ 1 adaptation/week retain 1.5× better than those who don't.
- Trust: zero material safety incidents; explainability on every prescription.
- Team of 10–12, documented systems, sustainable pace.
- A product athletes describe as “the app that actually knows what I should do next.”
