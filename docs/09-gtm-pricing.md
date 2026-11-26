# GTM & Pricing

**Product:** FORGE — The Adaptive Training OS
**Owner:** Product & Growth
**Date:** 25 November 2026
**Status:** strategy, not yet executed

---

## 1. GTM philosophy

Forge is not a social network, not a generic AI chatbot, and not a gym ERP. It's an **adaptive layer** that unifies logging, planning, nutrition, recovery, and form into one loop.

The GTM must prove that loop works — retention comes from trust in the prescriptions, not from feature count. Distribution follows utility: users share PR cards and session results because they're genuinely proud of what the session achieved.

**Phase ordering:** trust → retention → native → scale. Do not invert. A beautiful native app with untrustworthy prescriptions churns faster than an ugly one that works.

---

## 2. Segments & ICP

### Primary ICP — The committed intermediate lifter
- **Who:** 2–6 years training, lifts 3–5×/week, follows or has followed a program, tracks progress loosely.
- **Pain:** Programs break on busy weeks; gym equipment is taken; food logging drifts; recovery is guesswork; five apps for one body.
- **Value:** "One app that knows my sleep, my equipment, my time, and my last lift — and tells me what to do today."
- **Willingness to pay:** $40–120/yr.

### Secondary ICPs
| Segment | Value hook | Willingness to pay |
| --- | --- | --- |
| Time-poor professional | 25-minute coherent sessions when life interferes | $100–200/yr |
| Body recomposition | Training + nutrition agree; protein-gap closes | $80–200/yr |
| Program follower | Program-preserving adaptation, deloads explained | $30–100/yr |
| Strength athlete (powerlifting) | RPE autoregulation, e1RM, periodization | $150–400/yr |
| Hybrid / HYROX | Lifting + conditioning in one loop | $120–250/yr |
| Coach / trainer (B2B2C) | Client roster, adherence flags, reports | $50–200/client/yr |

### Anti-ICP (v1)
- Complete beginner with no equipment: needs education more than adaptation; served by onboarding but not the design center.
- Gym owners wanting memberships/billing: that's GYM-One/GymFlow territory, deliberately excluded.
- Medical/rehab users: out of scope.

---

## 3. Pricing model

### Tier structure

| Tier | Price (annual) | Monthly eq. | Includes |
| --- | --- | --- | --- |
| **Free** | $0 | — | Logging, exercise library, basic program, macro ring, social feed, 3 posts/mo |
| **Pro** | $79/yr | ~$6.50 | Adaptive engine, readiness, recovery map, compression, swaps, RPE autoreg, unlimited posts, PR cards, squat rep-count pilot, coach chat, nutrition scan (limited) |
| **Black** | $179/yr | ~$15 | Everything in Pro + food scan unlimited, AI coach (LLM), voice logging, early access to pose pilots, wearable sync, coach seats (1 client), priority support |
| **Coach** | $149/yr per coach seat | ~$12 | Client management, adherence dashboard, program publishing, client reports |

### Rationale
- **Logging stays free.** Charging for basic set logging is increasingly untenable (Hevy/Strong set the expectation). Free tier is a funnel, not a crippleware wall.
- **Adaptation is paid.** Readiness → load, recovery map, compression, swaps — these are the defensible, high-value outputs. Pro is the main revenue tier.
- **AI is a premium feature.** LLM coach and on-device pose/food recognition carry inference costs; Black tier absorbs them. Form scoring and coaching from pose remain roadmap items until they pass evaluation.
- **Coach is B2B2C.** Sold per seat to trainers; higher LTV, lower churn, distribution through clients.

### Entry pricing anchors
Logging competitors (Hevy/Strong): ~$30–40/yr. Generators (Fitbod): ~$80–100/yr. MFP Premium: ~$80/yr. Strava: ~$80/yr.

Forge's Pro at $79/yr sits between "just a logger" and "black-box generator" — priced for the adaptive loop it delivers. Black at $179/yr is premium but below the cost of a monthly personal trainer session.

### Trials & intro
- 14-day Pro trial after onboarding (requires card; cancel anytime).
- First-month discount: $4.99/mo for first 3 months (conversion test).
- Annual discount: two months free vs. monthly (encourage commitment).
- Student pricing: $39/yr (verified .edu).
- Family/duo plan: +$30/yr per additional member (Q1 2028).

### Payment
- Web: Stripe (cards, Apple Pay, Google Pay).
- Mobile: RevenueCat (App Store / Google Play IAP) — accepts 15–30% platform tax as cost of distribution.
- No ads ever (positioning + trust).

---

## 4. Positioning & messaging

### Category
**Adaptive Training OS.**

### Frame
"Your program has been guessing."

### Promise
The right session for the body, kit, and time you have today — and the fuel and recovery to support it.

### Proof
Visible inputs, real logs, one-tap adaptation, a clearly scoped on-device squat-count pilot, protein gap closed.

### Personality
Serious training tool with editorial confidence. Not a cheerleader, not a clinician.

### Anti-positioning
Not another social network. Not a generic AI chatbot. Not a gym ERP.

### Positioning statement
> For committed lifters who are tired of stitching together a tracker, a program, a food app, and a wearable, Forge is the adaptive training OS that turns those inputs into the next right action. Unlike static trackers and black-box generators, Forge preserves your program's intent, shows its reasoning, and adapts set by set.

### Key messages by tier
- **Free:** Log fast. Program ready. Community waiting.
- **Pro:** Your session adapts to sleep, time, and equipment. Not static. Not blind.
- **Black:** AI coach, early access to pose pilots, unlimited food scan. Full form assessment remains roadmap work.
- **Coach:** Manage clients, not spreadsheets.

### Proof points (to be validated in beta)
- "Median set logged in under 4 seconds."
- "Adaptation accepted by 55%+ of users who see it."
- "D30 retention ≥ 35% at 90 days."
- "Protein gap closed in 3 taps."

---

## 5. Acquisition strategy

### Phase 1 (Q4 2026–Q1 2027): Creator & community seeding
- **Recruit 20–40 micro/mid fitness creators** (10k–500k followers) who program for intermediates. Give them Black free + revenue share on referred Pro subs.
- **Creator program marketplace:** let creators publish programs; Forge handles versioning, payments, and client adherence reporting.
- **Share loops:** PR cards (Instagram Stories/TikTok), weekly recap, "25-minute session" demo reels, form overlay clips (opt-in).
- **ASO:** App Store/Play Store screenshots featuring live session + PR card; keywords: workout logger, adaptive training, hypertrophy, strength training.
- **Rating prompts:** after 3 completed sessions and 1 PR; target 4.6+ store rating.

### Phase 2 (Q2–Q3 2027): Paid acquisition
- **Paid social:** Meta/TikTok/Google; creative = before/after trend + PR card + "what 25 min looks like."
- **CAC target:** < $25 blended; payback < 6 months.
- **Organic target:** ≥ 45% of installs (referral + ASO + shares).

### Phase 3 (Q4 2027+): Partnerships & B2B2C
- **Gym chains:** read-only occupancy via check-ins; class schedule display (not ERP).
- **Supplement brands:** protein-gap co-marketing (no medical claims).
- **Physio/chiro clinics:** form check referral path (non-diagnostic).
- **Enterprise wellness:** aggregate dashboards, SSO, DPA.

### What we will not do for acquisition
- Buy exercise-library breadth (quality > count).
- Build a general social network.
- Run ads inside the app.
- Compete with Strava on cardio social identity — share *out* to Strava/Instagram instead.

---

## 6. Conversion & retention mechanics

### Conversion funnel
```
Install → Onboard (goal/equipment/units) → Start session 1 → Log first set → Finish → PR detected → Pro trial → Pay
```

### Activation targets
- ≥ 70% of onboarded users start a session within 24 h.
- ≥ 50% complete a session in week 1.
- ≥ 40% accept at least one adaptation in week 1.

### Retention mechanics
- **Streak protection:** minimum effective session, freeze tokens, forgiving copy ("week off is data, not failure").
- **Deload automation:** explained, one-tap accept.
- **Weekly digest:** volume, readiness trend, protein consistency, upcoming sessions.
- **Adaptive deloads:** readiness < 55 for 4/7 days → deload suggestion.
- **Coach touchpoints:** Black tier gets monthly coach message (automated + human optional).
- **Social accountability:** followed friends' check-ins, challenges, PR notifications.

### Churn drivers to watch
- Novelty wear-off (D30 < 25% is a red flag).
- Adaptation perceived as bossy (override rate > 50% → simplify).
- Food recognition inaccuracies.
- Platform fees / app-store policy changes.

---

## 7. Revenue model & unit economics

### Revenue streams (18-month)
| Stream | Share @ 18 mo | Notes |
| --- | --- | --- |
| Pro subs (B2C) | ~60% | Main engine |
| Black subs (B2C) | ~20% | AI + pose + food |
| Coach seats (B2B2C) | ~15% | Higher LTV, lower churn |
| Creator rev-share (net) | ~5% | Incentive-aligned distribution |

### Unit economics targets (@ 12 months)
| Metric | Target |
| --- | --- |
| CAC (blended) | < $25 |
| LTV (Pro, 24 mo) | ≥ $100 |
| LTV/CAC | ≥ 4 |
| Payback period | < 6 months |
| Gross margin | ≥ 80% (web), ≥ 65% (mobile after IAP tax) |
| AI cost per user/mo | < $0.50 |

### Pricing sensitivity tests (post-beta)
1. Pro: $59 vs $79 vs $99/yr — measure conversion vs. revenue.
2. Trial: 7 vs 14 vs 30 days — measure pay rate.
3. Black: bundled vs. à la carte add-ons (pose, food, AI).

---

## 8. Go-to-market timeline

| Quarter | Focus | Key activities | Exit metric |
| --- | --- | --- | --- |
| Q4 2026 | Beta | 50 athletes, auth/billing, privacy, engine tests | D30 ≥ 30%, NPS ≥ 30 |
| Q1 2027 | Retention | Offline logging, native beta, push, streaks | D30 ≥ 35%, sessions/wk ≥ 2.8 |
| Q2 2027 | Intelligence | LLM coach GA, pose MVP, food scan beta | Adaptation acceptance ≥ 55% |
| Q3 2027 | Social | Creator marketplace, coach seats, challenges | ≥ 30% installs via share/referral |
| Q4 2027 | Scale | Read replicas, ClickHouse, SLOs, SOC 2 prep | 99.9% uptime, p95 < 300 ms |
| Q1 2028 | Growth | Paid social, ASO, partnerships, referral v2 | CAC < $25, LTV/CAC ≥ 4 |
| Q2 2028 | Platform | Public API, webhooks, enterprise pilot | 3 enterprise pilots |

---

## 9. Risks & mitigations (GTM-specific)

| Risk | Signal | Mitigation |
| --- | --- | --- |
| Users don't pay for adaptation | Free-to-paid < 3% | Narrow to one persona; improve onboarding activation |
| High CAC on paid social | CAC > $40 | Double down on organic/creator/referral |
| App store policy / fees change | IAP tax > 30% or sideloading mandated | Web billing where allowed; PWA-first option |
| Creator supply is slow | < 10 creators by Q3 2027 | Anchor coaches + done-with-you onboarding |
| Churn after novelty | D30 < 25% | Adherence mechanics, coach touchpoints, social |
| Food recognition underwhelms | Correction rate > 40% | Narrow cuisine focus, confirmation-first |
| Competitors copy adaptation | Hevy/Fitbod ship "smart" features | Move on data graph + form/nutrition; brand |

---

## 10. Success definition (18 months)

- 100k registered, 25k MAU, 8k paying, $1.5–2.5M ARR run-rate.
- D30 ≥ 40%, NPS ≥ 50, organic ≥ 45% of installs.
- Adaptive loop validated: users accepting ≥ 1 adaptation/week retain 1.5× better.
- Zero material safety incidents; explainability on every prescription.
- Team of 10–12, documented systems, sustainable pace.
- Athletes describe Forge as "the app that actually knows what I should do next."
