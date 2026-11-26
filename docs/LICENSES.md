# LICENSES — Third-Party Code, Datasets & Attribution

## Policy

1. **No proprietary code** copied from Hevy, Strong, Jefit, Boostcamp, or any commercial app.
2. **No Gym Visual media reuse** — exercise stills (`still/*.png`) and animations (`clip/*.mp4`) in `_research/openGym/catalogue/media/` carry separate commercial restrictions from Gym Visual and are **not** included or served by FORGE. FORGE renders original dynamic kinematic SVG rigs (`exercise-motion.tsx`) paired with MIT vector anatomy diagrams.
3. **AGPL-3.0 & GPL-3.0 codebases** (`wger`, `OpenNutriTracker`, `openGym` UI/backend code) — architecture and UX patterns studied only; FORGE is an original Next.js + Drizzle/SQLite + TypeScript implementation.
4. **Permissive data & geometry** — ExerciseDB v1 metadata (`exercisedb-catalog.json`) and Melih Colpan's MuscleMap (`body-paths.ts`) are used under the MIT License; curated openGym starter routine plans (`opengym-routines.json`) carry CC-BY-4.0 attribution.

## Reviewed Repos & Benchmarks (10)

| Project / Repository | License / Type | Usage in FORGE |
|----------------------|----------------|----------------|
| openGym (`DuarteSantos8/openGym`) | AGPL-3.0 (code) · MIT (`MuscleMap`, `ExerciseDB v1`) · CC-BY-4.0 (routines) | UX architecture for Home Week Calendar, Monthly Challenges, Library + MuscleExplorer + Ladders, Plan Schedule (`Fixed Week` / `Rotation`) & Routines; MIT anatomical vector contours (`body-paths.ts`) and 1,323 MIT ExerciseDB v1 movements |
| lyftr (`Cawlumm/lyftr`) | MIT | Powerlifting RPE progression formulas, warm-up plate calculator, multi-formula 1RM suite |
| gymcoach (`gymcoach-app/gymcoach`) | MIT | Superset pairing, Web Audio rest timer synthesis, active workout focus flow |
| OpenNutriTracker (`simonoppowa/OpenNutriTracker`) | GPL-3.0 | Reference only (no code merged) — water hydration logging, TDEE energy balance, macro rings |
| GymFlow (`priyansh13-c/GymFlow`) | MIT | Active workout session player, fast keypad steppers, live PR celebrations |
| wger (`wger-project/wger`) | AGPL-3.0 | Reference only (no code merged) — multi-point anthropometric body measurement tracking |
| GYM-One (`mayerbalintdev/GYM-One`) | Custom restrictive | Reference only (no code incorporated) — routine folder organization, PR trophy wall, streak visualizer |
| laragym (`johndavedecano/laragym`) | MIT | B2B gym management, QR attendance check-in, member roster, plan renewals |
| advice.fit (`https://advice.fit/`) | Reference / Web | Adaptive coaching consultation, soreness-aware load regulation, time-crunch workouts |
| gymsmart.in (`https://www.gymsmart.in/`) | Reference / Web | Indian gym operations, first-class Indian food database (IFCT), WhatsApp shareable workout/diet summaries |

## Data Sources

| Dataset | License | Usage | Attribution |
|---------|---------|-------|-------------|
| ExerciseDB v1 (1,323 exercises) | MIT (`hasaneyldrm/exercises-dataset`) | `exercisedb-catalog.json` | ExerciseDB v1 dataset (MIT License) |
| MuscleMap body contours | MIT (`melihcolpan/MuscleMap`) | `body-paths.ts` | MuscleMap by Melih Colpan (MIT License) |
| openGym starter & curated routines | CC-BY-4.0 (`opengym.ch`) | `opengym-routines.json` | Curated routine templates adapted from openGym (CC-BY-4.0) |
| Indian food nutritional data | IFCT (public domain research) | `food-db.ts` | Indian Food Composition Tables (IFCT), NIN Hyderabad |
| Open Food Facts | ODbL 1.0 | Barcode lookup API | Food data from Open Food Facts (`openfoodfacts.org`) under ODbL |

## NPM Dependencies

All runtime dependencies use permissive licenses (MIT, ISC, BSD, Apache-2.0).
