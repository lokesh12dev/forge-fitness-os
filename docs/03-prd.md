# Product Requirements Document — Forge v1

**Version:** 1.0 · **Date:** 25 November 2026 · **Status:** implemented demo, production path defined
**Owner:** Product · **Related:** [`02-competitive-matrix.md`](02-competitive-matrix.md), [`08-roadmap.md`](08-roadmap.md)

---

## 1. Problem statement

Committed lifters make four decisions every day — **what to train, how hard, what to eat, and whether to recover** — across four or more disconnected tools. Each tool sees one input. None sees the athlete.

The cost is not just app-switching. It is **prescription drift**:

- A program assumes perfect sleep, full equipment and unlimited time.
- A calorie target assumes training happened as planned.
- A recovery score assumes the app knows what was lifted.
- A form video assumes someone will watch it later.

When reality diverges (bad sleep, crowded gym, 25 minutes, 60 g protein short), the athlete improvises. Progress stalls and guilt replaces adherence.

**Forge's job:** turn the athlete's actual state into the next right action, inside one coherent loop, with enough transparency to be trusted.

---

## 2. Goals & non-goals

### Goals (v1)

| ID | Goal | Measure |
| --- | --- | --- |
| G1 | One workspace replaces tracker + planner + food app + recovery note | ≥ 80% of beta users log training and nutrition in Forge weekly |
| G2 | Adaptation is visible and trusted | ≥ 60% of users accept at least one generated adjustment per week; “why?” is answerable for every change |
| G3 | Logging is faster than incumbents | Median set logged < 4 s; session completion without leaving live view |
| G4 | Retention through adherence, not novelty | D30 ≥ 35% at 90 days; streak-protected sessions tracked |
| G5 | Social drives acquisition without corrupting utility | ≥ 20% of new installs from shared PR cards/challenges |

### Non-goals (v1)

- Medical diagnosis, rehab prescription, or injury triage.
- Gym ERP: memberships, door access, staff scheduling, payroll.
- Hardware or wearable manufacturing.
- Full nutrition database parity with MyFitnessPal.
- Multi-tenant enterprise admin, SSO, SOC 2 (production phase).
- Replacing a human coach; Forge augments programming and adherence.

---

## 3. Personas

### P1 — Alex, the committed intermediate (primary)
- 27, lifts 4×/week, 3 years training, desk job.
- Uses Hevy to log, a Google Sheet for a program, MyFitnessPal inconsistently, Apple Watch for sleep.
- Wants to bench 100 kg, add visible muscle, stop spinning wheels.
- Frustrations: program breaks on busy weeks; food logging is tedious; doesn't know if he's recovered.
- Success: opens app, sees “today's session, adjusted for 6h sleep and 35 min”, logs in one thumb, knows protein gap at 9 pm.

### P2 — Priya, the time-poor professional (primary)
- 34, trains 3×/week at a commercial gym, 30–40 min windows, travels.
- Wants strength and energy, not a bodybuilding stage physique.
- Frustrations: crowded gym, machine unavailable, generic plans assume 90 minutes.
- Success: “I have 25 minutes and dumbbells” produces a coherent session with the same stimulus.

### P3 — Marcus, the program follower (secondary)
- 22, runs a proven 5×5 or hypertrophy block from a creator.
- Wants to follow the plan faithfully, understand progression, and not lose progress when life happens.
- Success: program intent preserved, deloads explained, PRs celebrated.

### P4 — Sofia, the body-recomposition client (secondary)
- 31, lifts 3×/week, tracks macros, goal is fat loss with muscle retention.
- Wants training and nutrition to agree; hates logging every ingredient.
- Success: photo-first meal capture, protein-gap suggestions using foods she eats, weekly trend that isn't noise.

### P5 — Dev, the coach (future B2B2C)
- Manages 20–60 clients, assigns programs, reviews adherence.
- Wants less admin, early warning on dropout, simple client summaries.
- Success: client list with adherence/readiness flags and shareable reports.

### Anti-persona
- Complete beginner with no equipment and no guidance: served by onboarding, but not the design center. Beginner content is a separate funnel with more education and lower intensity defaults.

---

## 4. Jobs to be done

| JTBD | Current workaround | Forge response |
| --- | --- | --- |
| “When I walk into the gym, tell me exactly what to do.” | Open notes/PDF, remember last weights | Today screen with prescribed loads from history + readiness |
| “When I only have 25 minutes, keep the session worth doing.” | Skip exercises, feel guilty | Time compression into supersets with trimmed rest, volume preserved |
| “When the rack is taken, keep the stimulus.” | Improvise randomly | Same-pattern, same-muscle swap ranked by equipment and popularity |
| “When my last set felt easy/hard, adjust the next one.” | Guess | RPE-driven next-set load suggestion with explanation |
| “When I'm 60 g short on protein at 9 pm, give me something I'll eat.” | Bowl of cereal or nothing | Protein-gap generator with regional/home options and calories |
| “When I train, tell me if my squat is breaking down.” | Film and review later | On-device rep count, depth, torso angle, valgus; one cue |
| “When I'm consistent, let me show it without cringe.” | Screenshot a spreadsheet | Canvas PR card with real numbers and native share |
| “When I miss a day, don't make me quit.” | Streak reset, shame | Compression, reschedule, streak protection, deload logic |
| “When I want to know if it's working, show the trend, not the noise.” | Multiple charts, scale anxiety | e1RM trend, volume, body metrics with rolling averages and context |

---

## 5. Scope — v1 demo

### 5.1 Shipped surfaces

| Surface | Route | Purpose |
| --- | --- | --- |
| Marketing site | `/` | Positioning, interactive adaptive demo, pricing, FAQ |
| Login | `/login` | Email demo sign-in, one-tap athlete |
| Dashboard | `/app` | Morning brief: readiness, session, fuel, recovery, community |
| Training | `/app/train` | Week plan, program days, start session |
| Live session | `/app/train/[id]` | Logging, rest, RPE autoreg, swaps, compression, finish |
| Summary | `/app/train/[id]/summary` | Session stats, stimulus, next plan, share |
| Nutrition | `/app/nutrition` | Macro ring, meals, water, photo scan, protein gap |
| Progress | `/app/progress` | e1RM, volume, body trends, standards, PR cards |
| Exercises | `/app/exercises` | Library, filters, cues, history |
| Programs | `/app/programs` | Program marketplace, enrollment, day preview |
| Social | `/app/social` | Feed, comments, likes, check-ins, leaderboard, challenges |
| Coach | `/app/coach` | Data-grounded chat with quick prompts |
| Form check | `/app/form-check` | Camera opt-in, pose overlay, metrics, cues |
| Settings | `/app/settings` | Profile, equipment, targets, account |

### 5.2 Explicitly out of demo scope
Native apps, real payments, real LLM calls, trained vision model, barcode database, push notifications, background sync, moderation tools, multi-device auth, admin console.

---

## 6. Functional requirements

Each requirement has an ID, priority (P0 = must, P1 = should, P2 = could), and acceptance criteria. “Demo” indicates a simulated or deterministic implementation with the production path documented.

### 6.1 Onboarding & identity

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| ONB-1 | Sign in with email (demo, no password) or demo athlete | P0 | Invalid email shows inline error; valid email creates/loads user; cookie persists 30 days |
| ONB-2 | Capture goal, experience, sex, bodyweight, height, equipment | P1 | Values persist and affect readiness/strength standards/available swaps |
| ONB-3 | Explain adaptation on first session | P1 | User sees at least one “why this changed” explanation before finishing session 1 |

### 6.2 Readiness & recovery

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| REC-1 | Compute readiness from sleep, HRV, resting HR, soreness | P0 | Score 20–99; deterministic; missing inputs use documented defaults |
| REC-2 | Map readiness to a concrete prescription | P0 | ≥85 push top set; 70–84 train as planned; 55–69 drop intensity 5–8%; <55 deload/zone-2 |
| REC-3 | Per-muscle recovery heatmap | P0 | 12 muscles; decay from volume × intensity × recency; 0–8 day window; front/back body map |
| REC-4 | “Train what's ready” recommendation | P1 | Next-session logic excludes muscles < 55% recovered unless user overrides |
| REC-5 | Show inputs, not just score | P0 | Every readiness display exposes sleep/HRV/RHR/soreness values used |

### 6.3 Programming & live session

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| TRN-1 | Start a session from a program day | P0 | Creates workout + scaffolded exercises/sets; one active session per user |
| TRN-2 | Log weight/reps/RPE per set with optimistic UI | P0 | Set persists; UI updates < 100 ms; refresh retains state |
| TRN-3 | Previous-set ghost values | P0 | Last performed weight × reps visible per exercise |
| TRN-4 | Rest timer with skip/+15s | P0 | Starts on set completion; survives navigation within session; does not block logging |
| TRN-5 | RPE-driven next-set suggestion | P0 | Last RPE ≤6 → +2.5–5 kg; 7–8 → hold; ≥9 → −5% or drop set; explanation shown |
| TRN-6 | “How much time do you have?” compression | P0 | 15/25/40/60 min options; pairs exercises into supersets; rest ×0.5; shows original vs compressed estimate |
| TRN-7 | Mid-session equipment swap | P0 | Ranked same-pattern/same-muscle alternatives filtered by available equipment; swap preserves sets and position |
| TRN-8 | Add exercise mid-session | P1 | Searchable library; appended with target sets; does not lose logged data |
| TRN-9 | Voice/natural-language logging (demo) | P1 | Parses “bench 185 for 8 at RPE 7”; requires confirmation; never silently logs wrong lift |
| TRN-10 | Plate math | P1 | Per-side breakdown for 20 kg bar; remainder shown; supports 1.25–25 kg plates |
| TRN-11 | Finish session with summary | P0 | Computes volume, sets, duration, PRs; marks workout complete; redirects to summary |
| TRN-12 | Auto-detect PRs | P0 | e1RM PR per exercise; celebration; PR row persisted; share card available |
| TRN-13 | Undo last set | P1 | Restores previous state; no orphan rows |

### 6.4 Nutrition

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| NUT-1 | Daily macro targets and ring | P0 | Calories/protein/carbs/fat vs targets; updates on log/delete |
| NUT-2 | Log meal with macros | P0 | Name, calories, protein, carbs, fat, meal type; persists by date |
| NUT-3 | Water tracking | P1 | Quick-add increments; goal; undo |
| NUT-4 | Photo-to-macro flow (demo) | P1 | Simulated recognition returns regional dish candidates; user confirms/edits portion; logs |
| NUT-5 | Protein-gap generator | P0 | Remaining protein > 0 produces ≤3 foods with serving, protein, calories, tags; totals close the gap within tolerance |
| NUT-6 | Nutrition ↔ training context | P1 | Coach and dashboard reference remaining protein alongside tomorrow's session |
| NUT-7 | Regional/home food coverage | P1 | Curated set includes South Asian home dishes (dal, paneer, soya, tikka) |

### 6.5 Form check

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| FRM-1 | Camera opt-in with clear privacy copy | P0 | No camera access until explicit click; video never uploaded; stop control |
| FRM-2 | Simulated 17-joint pose overlay | P1 | Overlay renders for squat/bench/deadlift; visibly labeled simulation in demo |
| FRM-3 | Rep counting and lift metrics | P0 | Reps, depth, torso angle, valgus/bar path, tempo; deterministic from selected lift |
| FRM-4 | Form score and prioritized cues | P0 | Score 0–100; 1 primary cue + supporting evidence; no medical claims |
| FRM-5 | Attach cue to next session | P2 | Cue appears in live session/summary as a note |

### 6.6 Progress & social

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| PRG-1 | e1RM and volume trends | P0 | 8–12 week series; correct aggregation; empty state |
| PRG-2 | Body metric trends | P1 | Weight, waist, body fat; rolling average; units labeled |
| PRG-3 | Strength standards | P1 | Ratio to bodyweight by sex; level and kg to next level |
| PRG-4 | Level/XP/streak | P1 | XP from sessions/sets/PRs; visible on dashboard and progress |
| PRG-5 | PR share card | P0 | Canvas PNG 1080×1350; real numbers; native share or download; no server image cost |
| SOC-1 | Create post with workout/PR attachment | P0 | Appears at top of feed; persists; author avatar/name |
| SOC-2 | Like/unlike, comment | P0 | Optimistic; counts correct; persists |
| SOC-3 | Follow athletes | P1 | Feed prioritizes followed users; toggle persists |
| SOC-4 | Live gym check-in | P1 | Select gym; creates check-in; occupancy radar reflects recent check-ins |
| SOC-5 | Leaderboard and challenges | P1 | Weekly volume leaderboard; join challenge; progress updates from workouts |
| SOC-6 | Moderation/reporting | P2 | Demo: none; production requirement documented |

### 6.7 Coach

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| COA-1 | Chat grounded in workspace data | P0 | Replies cite readiness, protein remaining, recovery, next session, equipment |
| COA-2 | Quick prompts | P1 | At least 4 prompts; one tap sends; history persists |
| COA-3 | Never invent a load | P0 | Load numbers come from engine/history, not free text |
| COA-4 | Safety boundaries | P0 | No diagnosis; injury/pain prompts route to “see a professional”; documented |

### 6.8 Platform

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| PLT-1 | Responsive layout 320–1440 px | P0 | No horizontal scroll; nav usable; sheets fit viewport |
| PLT-2 | Accessible controls | P0 | Keyboard focus visible; icon buttons labeled; contrast ≥ 4.5:1 for body text |
| PLT-3 | Fast reads | P1 | Dashboard TTFB < 500 ms local; no layout shift from charts |
| PLT-4 | Empty/error states | P1 | Every list has an empty state; server errors show recoverable UI |
| PLT-5 | Data export/delete | P2 | Production requirement; demo documents schema for export |

---

## 7. Non-functional requirements

| Category | Requirement |
| --- | --- |
| Performance | p95 read API < 300 ms production; live set log perceived < 150 ms; LCP < 2.5 s on mid-tier mobile |
| Reliability | 99.9% monthly availability at public beta; idempotent set writes; no lost sessions on refresh |
| Privacy | Camera frames never leave device; coordinates only if stored; explicit consent; export/delete self-serve |
| Security | OWASP ASVS L2; signed sessions; CSRF protection; rate limits; least-privilege DB roles |
| Accessibility | WCAG 2.2 AA for core flows; keyboard-only logging; reduced-motion support |
| Compatibility | Evergreen Chrome/Safari/Firefox/Edge; iOS Safari 16+; Android Chrome 110+ |
| Localization | UTC storage; user timezone rendering; kg/lb and cm/in conversion; RTL-ready layout tokens |
| Observability | Structured logs, tracing, error tracking, product analytics with consent |
| Legal | No medical claims; form feedback framed as training cues; nutrition estimates labeled |

---

## 8. Key flows (acceptance scripts)

### Flow A — Morning to first set
1. User opens `/app`; readiness 78 (“Ready”) with sleep 7.2 h, HRV 64, soreness 3.
2. Today's session card shows “Pull A · Width”, estimated 52 min, 6 exercises.
3. User taps **Start session** → `/app/train/[id]`; timer starts; first exercise shows last-time ghost.
4. User completes set with steppers → row turns complete, rest timer starts.
5. RPE 9 on top set → banner suggests −5% next set with reason.
6. **Pass:** all state persists after refresh; no modal blocks logging.

### Flow B — Crowded gym, 25 minutes
1. In live session, user taps **Only 25 min** → compression preview: 52 → 31 min, 3 supersets.
2. User confirms; pairs render A1/A2 with rest halved.
3. Cable row occupied → **Swap** → alternatives ranked: dumbbell row (same pattern), inverted row (bodyweight).
4. User swaps; logged sets preserved; position unchanged.
5. **Pass:** estimated time updates; finish produces summary with full volume.

### Flow C — Protein gap at 9 pm
1. Nutrition shows 130/190 g protein, 1640/2900 kcal.
2. User taps **Close the gap** → 3 options ≤ 60 g protein, ≤ 1260 kcal total, tagged home/veg.
3. User logs “Paneer tikka + whey” → ring updates; remaining protein ≤ 5 g.
4. **Pass:** coach subsequently references “protein target met” instead of the old gap.

### Flow D — PR and share
1. User logs 100 kg × 5 bench → e1RM 116.7, previous best 112 → PR detected.
2. Celebration appears; finish → summary shows PR card preview.
3. User taps **Share** → canvas PNG generated with lift, weight, reps, e1RM, date, handle.
4. Native share opens on mobile; download fallback on desktop.
5. **Pass:** image is legible at 1080×1350; no PII beyond handle.

### Flow E — Form check
1. User opens `/app/form-check`; chooses Squat; camera remains off until **Enable camera**.
2. Simulated analysis counts 5 reps, depth 92°, torso 38°, valgus “mild”, score 82.
3. Primary cue: “Brace and sit between your hips; knees are caving ~2 cm.”
4. User attaches cue to next session.
5. **Pass:** stopping camera removes stream; no network request carries frames.

---

## 9. Analytics & instrumentation

### North-star
**Weekly effective sessions** — completed sessions with ≥ 60% prescribed volume and at least one RPE or load adjustment accepted.

### Funnel events
`app_open` · `session_started` · `set_logged` · `adaptation_shown` · `adaptation_accepted` · `swap_used` · `compression_used` · `session_finished` · `pr_detected` · `share_opened` · `share_completed` · `meal_logged` · `scan_used` · `protein_gap_opened` · `form_check_started` · `cue_attached` · `post_created` · `challenge_joined` · `coach_message_sent`

### Properties
`user_id` (hashed), `plan_tier`, `experience`, `equipment_count`, `readiness_bucket`, `session_minutes`, `exercise_pattern`, `adaptation_type`, `accept/decline`, `latency_ms`, `surface`.

### Guardrail metrics
Crash-free sessions, p95 latency, log edit rate (proxy for errors), adaptation decline rate, notification opt-out, report rate, support contacts per 1k sessions.

### Privacy
No camera frames, no free-text meal names in third-party analytics by default; consent-gated; EU data residency option at production.

---

## 10. Release criteria (public beta)

- [ ] All P0 requirements pass acceptance scripts on iOS Safari and Android Chrome.
- [ ] Auth (OTP/OAuth), billing, privacy policy, terms, support live.
- [ ] Offline queue: log sets in airplane mode, reconcile without duplicates.
- [ ] Engine unit tests ≥ 90% branch coverage; e2e happy path in CI.
- [ ] p95 read < 300 ms; error rate < 0.5%; crash-free ≥ 99.5%.
- [ ] Accessibility: keyboard-only session completion; axe clean on core routes.
- [ ] Form/food features labeled beta with confidence and correction paths.
- [ ] Data export + account deletion self-serve.
- [ ] Security review and dependency license audit passed.
- [ ] 20 beta athletes complete 4 weeks; D30 ≥ 30%; NPS ≥ 30.

---

## 11. Open product questions

1. Free tier: adaptive engine free for 7 days, or paid from day one? (Test both.)
2. Primary acquisition: creator/coach distribution vs. ASO + short-form video.
3. Mobile: React Native with shared TS logic vs. PWA first (faster, weaker HealthKit).
4. Form-analysis data retention: coordinates only, derived metrics only, or opt-in video?
5. Regional food database partner: India/SEA/LATAM coverage per dollar.
6. Challenges: user-generated with stakes vs. curated for integrity.
7. Minimum coach surface that improves retention without commoditizing human coaching.
8. How much adaptation should be automatic vs. suggested? (Trust vs. friction.)
