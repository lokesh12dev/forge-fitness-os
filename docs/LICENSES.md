# LICENSES — Third-Party Code, Datasets & Attribution

## Policy

1. **No proprietary code** copied from Hevy, Strong, Jefit, Boostcamp, or any commercial app.
2. **No Gym Visual media reuse** — exercise stills (`still/*.png` / `still/*.webp`) and animations (`clip/*.mp4`) in `_research/openGym/catalogue/media/` carry separate commercial restrictions from Gym Visual (`© Aliaksandr Makatserchyk, gymvisual.com`) and are **not** included or served by FORGE. FORGE renders an original MIT `MuscleMap` anatomical vector-silhouette kinematic player (`exercise-motion.tsx`) on a crisp atlas stage + supports device-local `"Your photo or video"` storage (`IndexedDB`).
3. **AGPL-3.0 & GPL-3.0 codebases** (`wger`, `OpenNutriTracker`, `openGym`) — openGym's AGPL-3.0 5,632-exercise JSON catalogue (`opengym-full-catalog.json`) and UX architectures are integrated with full open-source attribution; OpenNutriTracker's photography uses the Unsplash License with explicit photographer credits.
4. **Permissive data, geometry & photography** — ExerciseDB v1 metadata (`exercisedb-catalog.json`, MIT), Melih Colpan's MuscleMap (`body-paths.ts`, MIT), curated openGym starter routine plans (`opengym-routines.json`, CC-BY-4.0), and bundled meal & avatar photographs in `app/public/nutri-meals/` (Unsplash License).

## Reviewed Repos & Benchmarks (10)

| Project / Repository | License / Type | Usage in FORGE |
|----------------------|----------------|----------------|
| openGym (`DuarteSantos8/openGym`) | AGPL-3.0 (code & catalogue) · MIT (`MuscleMap`, `ExerciseDB v1`) · CC-BY-4.0 (routines) | Complete 5,632-exercise catalogue (`opengym-full-catalog.json`), Exercise Detail (`Weight unit`, `Plate loading`, `Base weight`, `Estimated 1RM`, `Aliases`, `Your photo or video`, `How to`, `Suggest a fix`), Home Week/Challenges/Check-in, Plan Schedule (`Fixed Week` / `Rotation`) & Routines, Library + MuscleExplorer + Ladders, and AI Coach (`CoachChat`) UX; MIT anatomical `MuscleMap` (`body-paths.ts`) |
| lyftr (`Cawlumm/lyftr`) | MIT | Powerlifting RPE progression formulas, warm-up plate calculator, multi-formula 1RM suite |
| gymcoach (`gymcoach-app/gymcoach`) | MIT | Superset pairing, Web Audio rest timer synthesis, active workout focus flow |
| OpenNutriTracker (`simonoppowa/OpenNutriTracker`) | GPL-3.0 (code) · Unsplash License (demo photos) · Scientific Citations | Original Next.js/TypeScript re-implementation of OpenNutriTracker's 4-tab Nutrition OS (Home, Add Food, Food Detail w/ IOM DRI, Diary Calendar, Trends, You & Recipes, Fasting Timer w/ NEDA/BEAT disclaimer, IOM 2005 EER/TDEE, WHO BMI, 2024 Compendium MET burn, kcal/kJ toggle); bundled Unsplash photography in `app/public/nutri-meals/` |
| GymFlow (`priyansh13-c/GymFlow`) | MIT | Active workout session player, fast keypad steppers, live PR celebrations |
| wger (`wger-project/wger`) | AGPL-3.0 | Reference only (no code merged) — multi-point anthropometric body measurement tracking |
| GYM-One (`mayerbalintdev/GYM-One`) | Custom restrictive | Reference only (no code incorporated) — routine folder organization, PR trophy wall, streak visualizer |
| laragym (`johndavedecano/laragym`) | MIT | B2B gym management, QR attendance check-in, member roster, plan renewals |
| advice.fit (`https://advice.fit/`) | Reference / Web | Adaptive coaching consultation, soreness-aware load regulation, time-crunch workouts |
| gymsmart.in (`https://www.gymsmart.in/`) | Reference / Web | Indian gym operations, first-class Indian food database (IFCT), WhatsApp shareable workout/diet summaries |

## Data Sources & Scientific References

| Dataset / Reference | License / Authority | Usage | Attribution |
|---------------------|---------------------|-------|-------------|
| ExerciseDB v1 (1,323 exercises) | MIT (`hasaneyldrm/exercises-dataset`) | `exercisedb-catalog.json` | ExerciseDB v1 dataset (MIT License) |
| MuscleMap body contours | MIT (`melihcolpan/MuscleMap`) | `body-paths.ts` | MuscleMap by Melih Colpan (MIT License) |
| openGym starter & curated routines | CC-BY-4.0 (`opengym.ch`) | `opengym-routines.json` | Curated routine templates adapted from openGym (CC-BY-4.0) |
| Indian food nutritional data | IFCT (public domain research) | `food-db.ts` | Indian Food Composition Tables (IFCT), NIN Hyderabad |
| Open Food Facts | ODbL 1.0 | Barcode lookup API | Food data from Open Food Facts (`openfoodfacts.org`) under ODbL |
| IOM 2005 EER & DRI Tables | Scientific Publication (National Academies Press) | `opennutri-core.ts` | Dietary Reference Intakes for Energy, Carbs, Fiber, Fat, Protein, Vitamins & Minerals (IOM 2005) |
| WHO Adult BMI & TRS 916 | World Health Organization | `opennutri-core.ts` | WHO adult BMI classifications & Technical Report Series 916 |
| 2024 Adult Compendium of Physical Activities | Herrmann et al. (2024) | `opennutri-core.ts` | 2024 Compendium MET energy expenditure equations |

## Bundled Meal & Profile Photography (`app/public/nutri-meals/`, Unsplash License)

| Local Asset | Meal / Subject | Photographer | Profile URL |
|-------------|----------------|--------------|-------------|
| `1548807371-30dc1bbe6cb5.jpg` | Oatmeal | Alexandru Acea | https://unsplash.com/@alexacea |
| `1593357849627-cbbc9fda6b05.jpg` | Brown rice | bady abbas | https://unsplash.com/@bady |
| `1552056413-b8b5eed0170b.jpg` | Wholegrain bread | Youjeen Cho | https://unsplash.com/@youjeencho |
| `1762631934518-f75e233413ca.jpg` | Chicken breast | joe boshra | https://unsplash.com/@joestudios |
| `1571212515416-fef01fc43637.jpg` | Greek yogurt | micheile henderson | https://unsplash.com/@micheile |
| `1739785938237-73b3654200d5.jpg` | Salmon fillet | Mitili Mitili | https://unsplash.com/@mitiliemitili |
| `1757801333069-f7b3cabaec4a.jpg` | Olive oil | Zoshua Colah | https://unsplash.com/@zoshuacolah |
| `1627820752174-acae1b399128.jpg` | Almonds | Towfiqu barbhuiya | https://unsplash.com/@towfiqu999999 |
| `1757332050958-b797a022c910.jpg` | Banana | Daniel Dan | https://unsplash.com/@outsideclick |
| `1567306226416-28f0efdc88ce.jpg` | Apple | Shelley Pauls | https://unsplash.com/@shelleypauls |
| `1646161762904-043f71f256f1.jpg` | Broccoli | Mick Haupt | https://unsplash.com/@rocinante_11 |
| `alex_demo_avatar.jpg` | Demo profile avatar | The Connected Narrative | https://unsplash.com/@theconnectednarrative |

## NPM Dependencies

All runtime dependencies use permissive licenses (MIT, ISC, BSD, Apache-2.0).
