# FORGE ENGINE — formulas, contracts, and tests

All adaptive math lives in `app/src/lib/engine.ts` as pure functions with no database or UI imports. Every formula below has unit tests in `app/src/lib/engine.test.ts`. Run `npm test` inside `app/`.

**Design rule:** when the engine has no history for an input, it returns `null`/`0` so the UI can show an em dash. It never invents a baseline weight.

---

## 1. Estimated 1RM (Epley)

```
e1RM = weight × (1 + reps / 30)
```

- Rounded to 0.1 kg.
- Returns 0 when weight or reps is 0.
- Used for PR detection, strength standards, charts, and load suggestions.

| Input | Output |
|---|---|
| 100 kg × 5 | 116.7 kg |
| 60 kg × 10 | 80.0 kg |

---

## 2. Level and XP

**Canonical formula** — `computeLevelProgress(xp)`:

```
level    = floor(sqrt(xp / 100)) + 1
floorXp  = (level - 1)² × 100
ceilXp   = level² × 100
progress = (xp - floorXp) / (ceilXp - floorXp) × 100   (rounded)
xpToNext = ceilXp - xp
```

| XP | Level | Progress |
|---|---|---|
| 0 | 1 | 0% |
| 100 | 2 | 0% |
| 1,600 | 5 | 0% |
| 8,100 | 10 | 0% |
| 12,480 | 12 | 17% |
| 14,400 | 13 | 0% |

> The old `xp % 520` bar rendered 0% at 12,480 XP because 12,480 is exactly divisible by 520. `computeLevelProgress` replaced it everywhere (shell, dashboard, summary).

---

## 3. Readiness score

```
sleepPts = clamp((sleep - 5.5) / 3, 0, 1) × 34
hrvPts   = clamp((hrv - 40) / 45, 0, 1) × 30
rhrPts   = clamp((70 - rhr) / 20, 0, 1) × 16
sorePts  = clamp(1 - soreness / 10, 0, 1) × 20

score = round(clamp(12 + sleepPts + hrvPts + rhrPts + sorePts, 20, 99))
```

Missing inputs fall back to population defaults (`sleep 7 h`, `HRV 62 ms`, `RHR 56 bpm`, `soreness 3/10`). The fallback is **not silent**: `readinessConfidence(input)` returns the fraction of real inputs (0–1), and the dashboard shows an `Est.` badge plus the percentage when confidence < 0.8.

Verdict bands:

| Score | Verdict | Coaching action |
|---|---|---|
| ≥ 85 | Primed | Push the top set / PR attempt |
| 70–84 | Ready | Train as planned, auto-regulate the last set |
| 55–69 | Moderate | Keep volume, drop intensity 5–8% |
| < 55 | Depleted | Deload or zone-2 |

---

## 4. Muscle recovery

For each set in the last 8 days:

```
stress   = (1 + min(1.4, weight × reps / 1400)) × exp(-ageDays / 2.6)
recovery = 100 - Σ stress × 5.2     (clamped 8–100)
```

- `lastTrained` records the freshest set in days (one decimal).
- Sets older than 8 days are ignored.
- Every known muscle starts at 100%.

---

## 5. Suggested load (exercise library + landing)

```
targetLoad = e1RM(lastSet) / (1 + targetReps / 30)
           = lastWeight × (1 + lastReps / 30) / (1 + targetReps / 30)
```

Rounded to the equipment step and floored at one step (2.5 kg barbell default). Returns `null` without history.

Example: last set 100 kg × 5 → target for 8 reps = 92.5 kg.

---

## 6. Adaptive target weight (next session)

```
next = previousWeight × (1 + (rpeTarget - 8) × 0.005)

if readiness ≥ 85   → next × 1.025   (small progression)
if readiness < 60   → next × 0.95    (fatigue back-off)

target = roundTo(next, step)
step   = 2 kg dumbbell · 5 kg machine · 2.5 kg otherwise
```

Returns 0 when there is no previous weight. UI shows `—` in that case.

---

## 7. Plate calculator

```
perSide = (total - bar) / 2
greedy over [25, 20, 15, 10, 5, 2.5, 1.25]
```

Returns the plate list per side plus any remainder that cannot be loaded with available plates. Default bar is 20 kg.

---

## 8. Session time estimate and multi-tier compression (B4)

```
minutes = 6 (warm-up)
        + Σ targetSets × (40 s set + restSec)
```

`compressSession(exercises, targetMinutes)` implements adaptive compression based on the time window:

1. **15-Minute Blitz (`targetMinutes <= 20`):**
   - Keeps core compound lifts (top 2), drops low-priority isolation accessories.
   - Rest scaled by `0.70x`.
   - Antagonist exercises paired into alternating supersets.
2. **25-Minute Standard (`20 < targetMinutes <= 32`):**
   - Pairs antagonist exercises (e.g. Press + Row) into supersets.
   - Rest scaled by `0.80x`.
3. **40-Minute Moderate (`targetMinutes > 32`):**
   - Pairs non-competing isolation accessories into supersets.
   - Rest scaled by `0.85x`.

Returns:
```ts
{
  exercises: T[];
  originalMin: number;
  compressedMin: number;
  groups: Array<{ a: string; b: string }>;
  diffSummary: string[];
}
```

---

## 9. Explainable Auto-Regulation (`adaptiveTargetWeightWithReason`) (B2)

Computes the recommended working weight and human-readable explanation based on 4 priority factors:

1. **Readiness Depleted (`readiness < 60`):**
   Trims load by 5% to prevent overtraining and injury risk.
2. **Readiness Primed (`readiness >= 85`):**
   Adds 2.5% load for top-set potentiation and PR opportunities.
3. **Double Progression:**
   If the lifter achieved the top of the target rep range with RPE ≤ 8, increases load by the minimum plate increment (2.5kg for barbells, 2kg for dumbbells).
4. **RPE Auto-Regulation:**
   If last session RPE exceeded target by ≥ 1, holds load or reduces by 2.5%. If under target by ≥ 2, adds 2.5%.

```ts
interface AutoRegulationReason {
  targetWeightKg: number;
  baseWeightKg: number;
  deltaKg: number;
  factor: "high_readiness" | "low_readiness" | "double_progression" | "rpe_adjustment" | "no_history";
  explanation: string;
}
```

---

## 10. Deload Recommendation Auto-Detection (B6)

`checkDeloadRecommendation(input)` automatically detects when a deload week is warranted based on:
- 5+ consecutive weeks of high training volume.
- Chronic low readiness (average score < 60 over the past 7 days).
- Trend of high exertion (average RPE ≥ 9.0 over the past 3 workouts).

Returns `{ needsDeload: boolean; reason?: string; suggestedIntensityMod: number; suggestedVolumeMod: number }`.

---

## 11. Equipment Profiles (B3)

Ranked equivalent exercise mapping filtered by 4 kit profiles:
- `commercial`: Full barbell, dumbbell, cable, machine, and bodyweight kit.
- `home_gym`: Barbell, dumbbell, bench, rack, pull-up bar, resistance bands.
- `hotel_travel`: Dumbbells (up to 25kg), cables, treadmill, bodyweight.
- `bodyweight`: Calisthenics, pull-up bar, floor, gymnastics rings.

---

## 12. Protein plan

`proteinPlan(remainingGrams)` filters the curated food list to servings that fit the remaining gap, sorted by protein density, and returns a short list. It returns `[]` when the gap is ≤ 0.

---

## 13. Strength standards

Ratios of e1RM to bodyweight by lift and sex, with five tiers:

```
Beginner → Novice → Intermediate → Advanced → Elite
```

`strengthStanding(slug, e1rmKg, bodyweight, sex)` returns the current tier, next tier ratio, kg to the next tier, and a clamped percentage. Returns `null` for unknown lifts or a missing bodyweight.

---

## 14. Mifflin-St Jeor TDEE & Macro Targets (D3)

Standard Mifflin-St Jeor equations calculate Basal Metabolic Rate (BMR):

```
Male BMR   = 10 × weightKg + 6.25 × heightCm - 5 × age + 5
Female BMR = 10 × weightKg + 6.25 × heightCm - 5 × age - 161
```

**Activity Multipliers:**
- `sedentary`: 1.20
- `light`: 1.375 (1–3 training days/wk)
- `moderate`: 1.55 (3–5 training days/wk)
- `heavy`: 1.725 (6–7 hard training days/wk)
- `athlete`: 1.90 (2x daily / physical job)

**Goal Caloric Adjustments & Macro Splits:**
- **Fat Loss (`cut`):** `TDEE - 500 kcal`
  - Protein: `2.2 g/kg` bodyweight (spares lean mass in deficit)
  - Fat: `25%` of total daily calories
  - Carbs: Remainder of daily calories (`(calories - (protein × 4 + fat × 9)) / 4`)
- **Maintenance (`maintain`):** `TDEE`
  - Protein: `2.0 g/kg` bodyweight
  - Fat: `25%` of total daily calories
  - Carbs: Remainder of calories
- **Lean Bulk (`bulk`):** `TDEE + 300 kcal`
  - Protein: `2.0 g/kg` bodyweight
  - Fat: `25%` of total daily calories
  - Carbs: Remainder of calories

---

## 15. Smart Protein Optimizer: `hitRemainingProtein()` (D4)

When a lifter has an evening protein deficit, `hitRemainingProtein(remainingGrams, remainingCalories, options)` generates actionable food items:

```
proteinDensity = (serving.protein / serving.calories) × 100
```

1. Filters available foods by dietary restriction (`vegetarian`, `vegan`, or `all`).
2. Scales servings to deliver between 15g and the exact deficit remaining.
3. Drops items that would exceed remaining calorie budget (unless calories remaining is severely restricted, in which case lowest calorie-per-gram options are prioritized).
4. Sorts descending by protein density per 100 kcal.
5. Returns top recommendations with exact grams, calories, and formatted serving label (e.g. `1 scoop (30g)`, `1.5 katori (225g)`).

---

## 16. 7-Day Moving Average Weight Smoothing (E2)

Daily bodyweight is subject to acute fluctuations from sodium, carbohydrates, hydration, and digestion. `calculateWeightMovingAverage(dataPoints, windowSize = 7)` calculates:

```
smoothedWeight_t = (1 / k) × Σ weight_i    for i ∈ [t - k + 1, t]
```

- Operates across non-null scale weigh-ins.
- Returns a 7-day trailing average curve.
- Outputs the delta between the instantaneous scale weight and the 7-day trend, insulating lifters from emotional scale spikes.

---

## 17. Consistency Module Formatters (E7)

Single source of truth in `app/src/lib/consistency.ts`:
- `formatProgramWeek(current, total)`: Guarantees uniform `"Week X of Y"` across dashboard, train, and settings.
- `formatVolumeMetric(val, type)`: Distinguishes projected load (`"14.7k kg proj."`) from historical volume (`"11.5k kg load"`).
- `formatUserLevel(xp)`: Uses canonical square-root formula without hardcoded modulos.
- `formatStreak(days)`: Formats streak count and consistency state across all widgets.

---

## Contract for UI code

1. Never compute level, e1RM, readiness, or target weights inline in a component.
2. Never display a fabricated number when a function returns `null`/`0` — use `—`.
3. If you change a formula, change its test first and update this document.
