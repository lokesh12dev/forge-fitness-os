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

## 8. Session time estimate and compression

```
minutes = 8 (warm-up)
        + Σ targetSets × (42 s set + restSec)
```

Superset rests are multiplied by 0.35 for the estimate.

`compressSession(exercises, targetMinutes)` pairs exercises into supersets, halves rest, and returns:

```
{ exercises, originalMin, compressedMin, groups: [{a, b}] }
```

`compressedMin` is floored at the requested `targetMinutes`.

---

## 9. Protein plan

`proteinPlan(remainingGrams)` filters the curated food list to servings that fit the remaining gap, sorted by protein density, and returns a short list. It returns `[]` when the gap is ≤ 0.

---

## 10. Strength standards

Ratios of e1RM to bodyweight by lift and sex, with five tiers:

```
Beginner → Novice → Intermediate → Advanced → Elite
```

`strengthStanding(slug, e1rmKg, bodyweight, sex)` returns the current tier, next tier ratio, kg to the next tier, and a clamped percentage. Returns `null` for unknown lifts or a missing bodyweight.

---

## Contract for UI code

1. Never compute level, e1RM, readiness, or target weights inline in a component.
2. Never display a fabricated number when a function returns `null`/`0` — use `—`.
3. If you change a formula, change its test first and update this document.
