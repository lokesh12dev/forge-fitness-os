# Research Repository Analysis

**Eight open-source gym/nutrition projects** were cloned into [`_research/`](../_research) and studied for feature behavior, UX patterns, and licensing. **No code was copied.** Forge is an original implementation; these repos informed feature priorities and licensing boundaries only.

---

## 1. Repository inventory

| Repo | Domain | Stack | License | Role in research |
| --- | --- | --- | --- | --- |
| **wger** | Gym/workout tracker + nutrition | Python (Django), SQLite/Postgres | AGPL-3.0 | Feature reference (exercise wiki, routines, diet) |
| **openGym** | Workout tracker | React 19 + Vite frontend, node:http API | AGPL-3.0 | Feature reference (5,600-exercise library, body map, plate math, swaps) |
| **OpenNutriTracker** | Nutrition tracker | Flutter/Dart | GPL-3.0 | Feature reference (food DB, barcode, photo, water, fasting) |
| **GYM-One** | Gym management ERP | PHP (Laravel), MySQL | Custom restrictive | Excluded (gym ERP, not consumer tracker) |
| **GymFlow** | Gym management | React + Node/Express, MongoDB | MIT | Feature reference (auth, members, check-ins) |
| **gymcoach** | Workout tracker | Next.js + Prisma/Postgres | MIT | Feature reference (RPE/RIR, rest timer, plate math, double progression) |
| **lyftr** | Workout + nutrition tracker | Go/Gin + SQLite, Expo/React Native | MIT | Feature reference (self-hosted SQLite, gym mode, macro trends) |
| **laragym** | Gym management PWA | Laravel + SvelteKit | MIT | Feature reference (member PWA, admin panel) |

Source URLs were not recorded in this document; repos live under `_research/<name>/`.

---

## 2. Licensing summary

| Repo | License | Copyleft? | Forge position |
| --- | --- | --- | --- |
| wger | AGPL-3.0 | Strong network copyleft | Studied behavior only. No code incorporated. |
| openGym | AGPL-3.0 (code) + custom media license | Strong network copyleft | Studied behavior only. No code or media incorporated. |
| OpenNutriTracker | GPL-3.0 | Strong copyleft | Studied behavior only. No code incorporated. |
| GYM-One | Custom restrictive | Restrictive (no integration/rebranding) | Reference only. No code incorporated. |
| GymFlow | MIT | Permissive | Concepts only. |
| gymcoach | MIT | Permissive | Concepts only. |
| lyftr | MIT | Permissive | Concepts only. |
| laragym | MIT | Permissive | Concepts only. |

### Key license details

**wger (AGPL-3.0):** Web application under AGPL-3.0 or later. AGPL requires network users to receive source. Studied for exercise-wiki, routine, diet, and multi-user patterns. No code copied.

**openGym (AGPL-3.0):** Code under AGPL v3; exercise media (stills/animations from Gym Visual) is separately licensed "for use in openGym only" and is **not** covered by the AGPL. Contributions require a signed CLA. Studied for the 5,600-exercise library, body map, plate math, backup-exercise swaps, and progression rules. No code or media copied.

**OpenNutriTracker (GPL-3.0):** GPL v3. Studied for food database (Open Food Facts + USDA + BLS), barcode scanning, photo confirmation, water tracker, fasting timer, micronutrient panel, and Material You theming. No code copied.

**GYM-One (custom restrictive):** Custom "GYM One License Agreement" v1.0. Permits use/modification/distribution but explicitly **prohibits integrating the software into other software products, sublicensing, or rebranding**. Contributions become licensor property. Treated strictly as a gym-management feature reference (member management, ticketing, class scheduling, payments). No code copied.

**GymFlow, gymcoach, lyftr, laragym (MIT):** Permissive. Concepts and UX patterns studied (auth flows, rest timer, plate math, double progression, self-hosted SQLite, gym mode, member PWA). No code copied.

### Compliance rule for Forge
Forge is an original implementation in Next.js + SQLite/Drizzle. The only licensed material it could conceptually resemble is the general idea of a workout log, which is not copyrightable. The AGPL/GPL repositories were used strictly for feature analysis — reading READMEs and behavior — never for code extraction. A dependency license scan will be added to CI before public release as an additional guardrail.

---

## 3. Feature learnings per repo

### wger
- Custom workout routines with automatic weight progression rules.
- Diet plans, body weight, custom measurements.
- Exercise wiki (community-contributed exercises).
- Progress gallery (photo tracking).
- Multilingual via Weblate; self-hostable with Docker.
- Powerful REST API; multi-user with basic gym management.
- **Forge takeaway:** community exercise contributions and progression rules are proven patterns; Forge seeds a curated library instead of a wiki for v1 quality control.

### openGym
- 5,600+ exercise library with animated demos (media licensed separately).
- Four starter plans (Push/Pull/Legs, Upper/Lower, Full Body, 5×5).
- Session rotation (A, B, C, A…) and weekday plans.
- Supersets, warm-up sets, drop sets, rest-pause, timed exercises.
- RIR/RPE effort column with plain-language levels.
- Plate math for barbell/EZ bar/trap bar/Smith machine based on plates you own.
- Bodyweight exercises know they carry no load; dip belt option.
- Per-side reps; swipe left to delete (undo), right to copy; pyramid sets.
- Backup exercise swap that keeps the slot's sets and reps (machine taken → one-tap swap).
- Live volume progress bar; per-routine progression rules (linear, Greyskull LP, double progression).
- Estimated 1RM curves; structural balance ratios.
- **Forge takeaway:** backup-exercise swap preserving slot data is directly mirrored in Forge's `swapExercise` action and `swapped_from` field. Plate math, RPE, and 1RM curves are in `engine.ts`.

### OpenNutriTracker
- Food database: Open Food Facts + USDA FoodData Central + German BLS, selectable sources.
- Calendar-driven diary: breakfast/lunch/dinner/snack with per-meal kcal targets and meal patterns (OMAD, Mediterranean, etc.).
- Trends vs. goal line; daily macro averages; water intake; weight vs. target with weeks-to-goal estimate.
- Micronutrient panel (fibre, sodium, sugar, calcium, iron, potassium, vitamin D, B12, magnesium) with DRI bars.
- Custom meals + recipes with photo, brand, barcode; recipe builder with barcode ingredient picker.
- Quick add (title + kcal), barcode scanner, manual barcode entry.
- Activity catalogue with custom activities and kcal entry.
- Fasting timer with content-warning gate.
- Material You + 16 theme presets.
- **Forge takeaway:** photo confirmation, barcode, regional DB sources, meal patterns, and micronutrient depth are production nutrition features documented in `06-ai-systems.md`. Forge v1 uses a curated regional food set rather than a full packaged-food SKU database.

### GymFlow
- JWT auth + refresh tokens; role-based access; bcrypt password hashing.
- Gym owner/member features; gym codes for member registration.
- MongoDB backend; React frontend with recharts, socket.io-client, Tailwind.
- **Forge takeaway:** auth patterns and realtime check-in concepts; Forge uses cookie auth (demo) and SQLite; GymFlow is gym-management scope, not consumer tracking.

### gymcoach
- Fast set logging with RIR or RPE (per-user setting); warm-ups.
- Rest timer with pause, −15/+15 s, optional screen flash.
- Plate-loading calculator drawn in the logger.
- Switch exercises freely; free session without a program.
- Weight picker that knows your gym; "last done, at a glance" per exercise.
- Live sets table shows estimated 1RM; pickable table metrics.
- Double-progression suggestions for next working load.
- Supersets (A1/A2 grouped).
- Fix a set without deleting; jump around session via exercise strip; change plan mid-session via actions menu.
- Readiness check-in (pre-session soreness/readiness); return-to-training calibration after layoff.
- Describe your actual gym stations; kg/lb per user.
- e1RM and max-load trends per exercise.
- **Forge takeaway:** readiness check-in, RPE/RIR, double progression, "last done" ghosts, plate calculator, mid-session plan changes, and per-exercise e1RM trends are all in Forge's live session and engine.

### lyftr
- Exercise library of 800+ from open-exercise-db with photos/instructions.
- Program builder; set-by-set logging with rest timer.
- Gym Mode: one exercise at a time, large controls (dialog desktop, full-screen phone).
- Progress: personal bests, weight-progression chart per exercise, muscle diagram, dashboard with volume trend, muscle balance, 12-week consistency heatmap.
- Nutrition: calories/macros vs. targets, food search, barcode scanning via Open Food Facts, macro trends.
- Weight log with trend chart; lbs/kg.
- Sidebar desktop / tab bar phone; light/dark themes; English/Spanish.
- Self-hosted: Docker amd64/arm64/armv7; one SQLite file; open/limited/closed registration.
- **Forge takeaway:** self-hosted SQLite philosophy matches Forge's demo; gym mode and consistency heatmap informed live session and dashboard; Forge is web-first rather than React Native.

### laragym
- Gym management: membership packages, billing cycles, member check-ins per branch, subscriptions, branches, activity logs, admin panel (SvelteKit), member PWA.
- **Forge takeaway:** gym-management scope (not Forge's consumer focus); member PWA pattern noted for future gym-radar integration.

---

## 4. Patterns adopted into Forge (concept only)

| Pattern | Source | Forge implementation |
| --- | --- | --- |
| Backup exercise swap preserving slot sets/reps | openGym | `swapExercise` action; `workout_exercises.swapped_from` |
| Plate math from owned plates | openGym, gymcoach | `plateBreakdown` in `engine.ts` |
| RPE/RIR effort column | openGym, gymcoach | RPE chips in live set logger; RPE autoreg nudges |
| Double progression | gymcoach | Next-set load suggestion based on rep range |
| "Last done" ghost | gymcoach | Previous-set weight/reps shown per exercise |
| Readiness pre-session check-in | gymcoach | Readiness score on dashboard; inputs exposed |
| One-exercise-at-a-time "gym mode" | lyftr | Live session focused on current exercise |
| Consistency heatmap | lyftr | Streak/XP + weekly volume (dashboard) |
| Food photo confirmation + barcode | OpenNutriTracker | Photo-to-macro confirmation flow (demo simulated) |
| Regional/home food awareness | OpenNutriTracker (BLS sources) | Curated South Asian + home foods in `PROTEIN_FOODS` |
| Self-hosted SQLite file | lyftr, wger | Demo uses `forge.db` via better-sqlite3 |
| Multi-muscle body map | openGym | `body-map.tsx` recovery heatmap |

---

## 5. Patterns deliberately NOT adopted

| Pattern | Source | Reason |
| --- | --- | --- |
| 5,600-exercise scraped library | openGym | Quality over count; Forge seeds 63 curated movements |
| Community exercise wiki | wger | Moderation and quality control out of scope for v1 |
| Gym ERP (memberships, tickets, classes) | GYM-One, laragym, GymFlow | Out of scope; consumer tracker, not gym ops |
| AGPL/GPL code reuse | wger, openGym, OpenNutriTracker | Network copyleft obligations incompatible with Forge's proprietary service model |
| GYM-One rebranding/integration | GYM-One | License explicitly prohibits integration into other software |
| General social network | Strava (commercial ref) | Forge keeps social lightweight and training-relevant |
| Hardware/wearables | Whoop/Oura (commercial ref) | Ingest wearable data later; no hardware in demo |

---

## 6. Media & content notes

- **openGym exercise media** (stills/animations from Gym Visual) is licensed for use in openGym only — **not** reusable in Forge. Forge uses SVG/CSS art and no exercise media in v1.
- **OpenNutriTracker** references external food databases (Open Food Facts, USDA, BLS) — Forge v1 does not integrate any third-party food DB; production path is documented in `06-ai-systems.md`.
- No images, icons, or brand assets were copied from any repository.

---

## 7. What each repo would teach a competitor

| Repo | Best lesson |
| --- | --- |
| wger | Self-hosted multi-user tracking with nutrition and progress gallery |
| openGym | Deep logging UX: swaps, plate math, progression rules, 1RM curves |
| OpenNutriTracker | Nutrition depth: multi-source DB, barcode, recipes, micronutrients |
| GYM-One | Gym operations (deliberately out of Forge scope) |
| GymFlow | Auth + realtime patterns for gym-member apps |
| gymcoach | Logger-first UX: readiness, double progression, RPE, ghosts |
| lyftr | Self-hosted SQLite + gym mode + consistency heatmap |
| laragym | Member PWA + admin panel for gym management |

---

## 8. Bottom line

Forge matches or exceeds the core consumer-tracking capabilities of the MIT-licensed repos (gymcoach, lyftr, GymFlow) and the feature set of the AGPL/GPL repos (wger, openGym, OpenNutriTracker) **without incorporating any of their code**. The AGPL/GPL repositories were studied strictly for behavior; Forge's implementation is original, and its license position is clean: proprietary demo code with permissive third-party dependencies only.
