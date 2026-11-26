# Market Research — Fitness Software 2026

**Scope:** consumer training, nutrition and recovery software; adjacent social fitness and gym-management tools.
**Method:** public product documentation, pricing pages, app-store listings, open-source repositories, and category reports (2024–2026). Figures are triangulated estimates for strategy, not audited market data. Re-verify before any fundraise or board deck.

---

## 1. Executive summary

1. **The market is large and still growing double digits**, but it is consolidating around a few habit loops: logging, planning, nutrition, and social proof. No consumer leader owns more than one loop well.
2. **The strongest wedge is adaptation, not content.** Exercise libraries and programs are commoditized (open datasets exceed 5,000 movements). The scarce asset is a decision engine with the athlete's longitudinal context.
3. **Willingness to pay is clustering.** Pure logging has been driven to free or ~$30–40/year. Consumers pay $80–150/year for outcomes: personalization, coaching, form feedback, nutrition intelligence.
4. **AI raised the ceiling and the skepticism.** Generic chatbots generate plans but do not remember, measure or adapt. Products that ground AI in logged data and show evidence will win trust.
5. **Retention is the real moat.** The category suffers from novelty churn (January spikes, February uninstalls). Products that protect adherence — compression, deloads, streaks with forgiveness, social accountability — retain.
6. **Open source is a credible substitute at the low end**, especially for privacy-sensitive and self-hosting users. AGPL projects like wger/openGym and MIT projects like lyftr/gymcoach prove demand and inform feature expectations, but rarely match consumer polish or mobile distribution.
7. **Regional nutrition is underserved.** MyFitnessPal's database is deep in US packaged foods and shallow in home-cooked regional cuisine. Photo-first, region-aware logging is a real opening.
8. **The whitespace is coherent integration:** training + fuel + recovery + form + community in one loop, with adaptation visible at the point of decision.

**Strategic conclusion:** Forge should not compete as “another tracker with more features.” It should compete as the **adaptive layer** that makes the athlete's existing effort more productive — and use logging, nutrition and social as inputs and retention surfaces, not the headline.

---

## 2. Market definition

### In scope
- Strength/hypertrophy workout tracking and programming.
- Adaptive/generative workout planning.
- Calorie/macro tracking and food logging.
- Recovery/readiness and wearable-derived guidance.
- Form/pose feedback.
- Social training communities, challenges and check-ins.
- Consumer-facing gym member apps (not full gym ERP).

### Adjacent / out of scope for v1
- Gym management (memberships, billing, staff, access control) — GYM-One, GymFlow, laragym territory.
- Clinical rehab, medical nutrition therapy, eating-disorder treatment.
- Hardware, connected gym equipment, wearable manufacturing.
- Enterprise wellness platforms and insurer programs (later B2B2C).

### Market size (triangulated)
| Layer | 2024–25 estimate | 2030 projection | CAGR | Confidence |
| --- | --- | --- | --- | --- |
| Global fitness app market | ~$10–14B | ~$25–35B | 14–18% | Medium |
| Health & fitness app consumer spend | ~$3–5B | ~$8–12B | 15–20% | Medium |
| Digital fitness & well-being (broader) | ~$30–50B | ~$80–120B | 10–15% | Low–medium |
| Nutrition tracking sub-segment | ~$2–4B | ~$6–9B | 12–16% | Low–medium |

**Interpretation:** a venture-scale category, but not winner-take-all. A focused product can reach $10–50M ARR through retention and pricing without owning the mass market.

### Structural dynamics
- **Low switching costs for logs, high switching costs for context.** Exporting a CSV is easy; recreating years of PRs, cues, recovery baselines and program history is not.
- **Free tier expectations are high.** Hevy and Strong offer capable free logging. Charging for basic logging is increasingly untenable.
- **Content is abundant.** 800–5,600 exercise libraries, free programs, YouTube coaching. Differentiation must be decision quality and experience.
- **Wearables normalize readiness data.** Apple Watch, Whoop, Oura, Garmin created user literacy in HRV/sleep; apps that ignore it feel dumb.
- **Creators are distribution.** Coaches and fitness creators drive installs; tools that let them publish programs and see client adherence have a B2B2C wedge.
- **AI commoditizes plan generation.** The defensible layer is measurement, feedback and adaptation over time.

---

## 3. Customer segments & jobs-to-be-done

| Segment | Size signal | Core job | Current stack | Willingness to pay | Forge fit |
| --- | --- | --- | --- | --- | --- |
| **Committed lifter** (1–5 yrs) | Large, high intent | “Tell me what to lift next and prove I'm progressing.” | Hevy/Strong + spreadsheet + Boostcamp | $40–120/yr | **Primary** |
| **Program follower** | Large | “Keep me on a proven plan when life interferes.” | Boostcamp/PDF + notes app | $30–100/yr | **Primary** |
| **Body recomposition** | Large | “Make training and eating agree.” | MFP + tracker + scale | $80–200/yr | **Primary** |
| **Time-poor professional** | Growing | “Give me the best 25 minutes.” | Fitbod/class apps | $100–200/yr | **Primary** |
| **Home / minimalist lifter** | Growing | “Use what I own.” | YouTube + tracker | $30–80/yr | Strong |
| **Beginner** | Very large, high churn | “Don't let me embarrass myself or get hurt.” | TikTok + gym induction | $0–60/yr | Secondary (onboarding-heavy) |
| **Powerlifter / strength athlete** | Niche, high identity | “Peak me for meet day.” | Spreadsheets + coach | $150–400/yr | Secondary (Black tier) |
| **Hybrid / HYROX athlete** | Fast-growing | “Balance lifting and conditioning.” | Strava + tracker + Whoop | $120–250/yr | Secondary |
| **Coach / trainer** | B2B2C multiplier | “Retain clients with less admin.” | Spreadsheets + Trainerize | $50–200/client/yr | Phase 4 |
| **Privacy/self-host user** | Niche, vocal | “Own my data.” | wger/openGym/lyftr | $0–50 one-off | Brand ally, not ICP |

### Jobs ranked by unmet need
1. “Adapt my session to the time, equipment and energy I actually have today.” — **highest unmet need**
2. “Tell me if my form is breaking down before it becomes an injury.” — high need, low trust today
3. “Close my protein gap with food I'll actually eat.” — high frequency, high friction
4. “Show me I'm progressing when the scale is noisy.” — emotional retention
5. “Keep me accountable without making me feel like a failure.” — churn driver
6. “Make my effort postable without cringe.” — acquisition loop

---

## 4. Competitor teardown

Pricing is approximate, monthly-equivalent, and varies by region/promo. Verify before using in sales material.

### 4.1 Hevy — the social logger
- **Strengths:** fast logging, huge exercise library, routines, supersets, warm-ups, rest timer, workout history, social feed, widgets, Apple Watch, strong free tier.
- **Pricing:** free; Pro roughly $3–5/mo or $30–40/yr.
- **Weaknesses:** program intelligence is shallow; no nutrition; form feedback absent; social can feel performative; adaptation is manual.
- **Lesson:** speed and reliability beat feature depth in the logging moment. Social distribution is real but secondary to utility.
- **Forge response:** match logging speed; add adaptation, nutrition, recovery and form as the reason to switch.

### 4.2 Strong — the minimalist logger
- **Strengths:** clean, fast, reliable; strong Apple Watch app; simple routines and history; loyal base.
- **Pricing:** free tier; Pro around $4–5/mo or $30–40/yr.
- **Weaknesses:** minimal coaching, no nutrition, limited analytics, little social.
- **Lesson:** a narrow tool can win a large niche through execution and trust. Simplicity is a feature.
- **Forge response:** preserve a one-thumb logging mode; make advanced intelligence opt-in, not in the way.

### 4.3 Jefit — the veteran community
- **Strengths:** large exercise database, routines, progress tracking, community, long history, wearables.
- **Pricing:** free; Elite roughly $10–13/mo.
- **Weaknesses:** dated UX, ad-heavy free tier, fragmented features, weak adaptive logic.
- **Lesson:** content and community without a coherent decision loop age poorly. Incumbents are vulnerable on experience.
- **Forge response:** modern design and a single loop; migrate users with import and a visible “why this session” story.

### 4.4 Fitbod — the generator
- **Strengths:** automatic workout generation, equipment-aware, muscle recovery model, exercise substitution, strong brand.
- **Pricing:** roughly $13/mo or $80–100/yr; limited free workouts.
- **Weaknesses:** black-box prescriptions, weak program continuity for advanced lifters, no nutrition, limited social, logging less beloved than Hevy/Strong.
- **Lesson:** “AI picks your workout” sells, but serious lifters want agency and explanation. Recovery-aware volume is a powerful concept.
- **Forge response:** adaptive but transparent; preserve the athlete's program identity; show inputs and allow overrides.

### 4.5 Boostcamp — the program marketplace
- **Strengths:** credible programs from known coaches, structured progression, community, good for program followers.
- **Pricing:** free programs; Pro roughly $8–10/mo or $60/yr.
- **Weaknesses:** programs are largely static; logging is secondary; little nutrition/recovery integration; adaptation when life happens is limited.
- **Lesson:** trusted programming is a distribution asset. Coaches bring audiences.
- **Forge response:** support proven programs as templates; make them adaptive without losing intent; later, coach marketplace.

### 4.6 Gym Log / generic trackers
- **Strengths:** simple, cheap, offline, sometimes ad-free.
- **Weaknesses:** shallow analytics, no adaptation, poor design, weak retention.
- **Lesson:** the long tail validates demand but cannot defend. Execution and trust are the moat.

### 4.7 advice.fit / gymsmart.in (regional)
- **Strengths:** localized content, diet plans, trainer access, India-specific pricing and payment.
- **Weaknesses:** service-heavy, inconsistent product depth, limited adaptive software, fragmented UX.
- **Lesson:** regional food and cultural context matter; consumers will pay for guidance delivered in their context.
- **Forge response:** region-aware food database and home-cooked meal flows; local pricing and payment rails.

### 4.8 MyFitnessPal — the nutrition incumbent
- **Strengths:** massive food database, barcode scanning, brand recognition, habit, integrations.
- **Pricing:** free; Premium roughly $20/mo or $80/yr; Premium+ higher.
- **Weaknesses:** logging friction, paywalled barcode (varies), weak training intelligence, dated experience, database quality issues.
- **Lesson:** nutrition is a daily habit with high retention; database breadth is a moat but also a quality liability.
- **Forge response:** photo-first confirmation, regional/home food, protein-gap outcome, not a spreadsheet of everything.

### 4.9 Strava — the social layer
- **Strengths:** identity, segments, kudos, club challenges, strong network effects, wearable integrations.
- **Pricing:** roughly $12/mo or $80/yr.
- **Weaknesses:** strength training is a second-class citizen; no programming, nutrition or form.
- **Lesson:** social proof and identity drive retention and acquisition. Strength needs its own Strava, but utility must come first.
- **Forge response:** PR cards, check-ins, challenges and gym radar — social as a retention layer around real training, not a separate feed.

### 4.10 Whoop / Oura — recovery
- **Strengths:** trusted recovery scores, sleep coaching, hardware lock-in, premium brand.
- **Weaknesses:** no lifting program or logging; recommendations are generic; subscription fatigue.
- **Lesson:** readiness is a powerful input and users understand it. Apps that ingest it without hardware can capture value.
- **Forge response:** readiness model that consumes wearable data when available and still works with subjective inputs; always tie the score to a concrete training decision.

### 4.11 Trainerize / TrueCoach — coaching platforms
- **Strengths:** coach workflows, client messaging, program assignment, habit tracking, payments.
- **Weaknesses:** client experience is admin-heavy; consumer-grade logging and intelligence are weak; sold to coaches, not athletes.
- **Lesson:** coaches are a scalable acquisition channel, but the athlete experience must be excellent to retain.
- **Forge response:** Black tier coach seats and shareable reports later; keep the athlete product primary.

---

## 5. Competitive whitespace

| Gap | Evidence | Forge play |
| --- | --- | --- |
| Plans break when life changes | Users juggle PDFs, notes, and missed-session guilt; Fitbod generates but doesn't preserve program intent | Compression, swaps, deload logic, “minimum effective session” |
| Logging and nutrition don't talk | MFP doesn't know you squat tomorrow; trackers don't know you're 60g short | Shared workspace; protein gap informs training readiness and vice versa |
| Recovery is a score without a decision | Wearables say “62%” and stop | Readiness → load/set/rest prescription with explanation |
| Form feedback is a report, not a coach | Video review apps are asynchronous and verbose | One cue mid-set; attach cues to next session |
| Social is disconnected from training | Strava ignores lifting; Hevy feed is separate from programming | PR cards, check-ins, challenges tied to logged work |
| Regional food is underserved | MFP database skews US packaged food | Photo-first, home-cooked regional meals, portion confirmation |
| Serious lifters distrust black boxes | Fitbod “why this workout?” opacity | Show inputs, allow overrides, explain every change |
| Self-hosters lack polish | wger/openGym capable but utilitarian | Local-first demo proves privacy and design can coexist |

---

## 6. Positioning

**Category:** Adaptive Training OS.
**Frame:** “Your program has been guessing.”
**Promise:** The right session for the body, kit and time you have today — and the fuel and recovery to support it.
**Proof:** Visible inputs, real logs, one-tap adaptation, a clearly scoped on-device squat-count pilot, protein gap closed.
**Personality:** Serious training tool with editorial confidence. Not a cheerleader, not a clinician.
**Anti-positioning:** Not another social network, not a generic AI chatbot, not a gym ERP.

### Positioning statement
> For committed lifters who are tired of stitching together a tracker, a program, a food app and a wearable, Forge is the adaptive training OS that turns those inputs into the next right action. Unlike static trackers and black-box generators, Forge preserves your program's intent, shows its reasoning, and adapts set by set.

---

## 7. Demand signals & trends to ride

- **Hybrid training** (lifting + HYROX/conditioning) is growing; single-mode apps underserve it.
- **GLP-1 era** increases focus on muscle preservation, protein adequacy and resistance training — Forge's protein + strength loop fits.
- **Wearable literacy** makes readiness inputs mainstream; users expect personalization.
- **Creator coaching** creates distribution and demand for program marketplaces.
- **AI trust** is shifting from “wow, it generated a plan” to “show me it knows my data.”
- **Privacy/local-first** is a durable niche and a trust signal, especially in Europe and among developers.
- **Short-form video** rewards visual artifacts: PR cards, body maps, form overlays, before/after trends.

---

## 8. Research risks & how to de-risk

| Risk | Signal to watch | Response |
| --- | --- | --- |
| Market estimates are inflated by overlapping definitions | Paid downloads flat while revenue grows | Track bottoms-up TAM by segment and price |
| Incumbents copy adaptation | Hevy/Fitbod ship “smart” features | Move faster on data graph and form/nutrition integration; build brand |
| AI feature commoditization | LLM costs fall, everyone ships chat | Own measurement and feedback loops, not the model |
| Nutrition database moat | Licensing costs rise | Start with curated regional sets + user contributions + Open Food Facts |
| Regulatory/liability | Form/injury claims scrutinized | Conservative language, disclaimers, expert review, no diagnosis |
| Churn after novelty | D30 < 25% | Invest in adherence mechanics, coach touchpoints, social accountability |
| Platform dependency | App Store policy/fees change | Web/PWA + direct billing where allowed; own email/SMS channel |

---

## 9. Sources & verification notes

- Company pricing and feature pages (Hevy, Strong, Jefit, Fitbod, Boostcamp, MyFitnessPal, Strava, Trainerize) reviewed during research; pricing changes frequently.
- App-store listings and review themes used for qualitative friction analysis.
- Category sizing triangulated from public market research summaries (Grand View Research, The Business Research Company, Statista, Sensor Tower category data). Figures rounded and directional.
- Open-source repositories cloned locally and inspected for feature behavior and licensing; see `docs/10-research-repos.md`.
- No confidential competitor data, scraped user data, or copied proprietary code was used.

**Rule for future docs:** label estimates, date them, and separate observation from inference.
