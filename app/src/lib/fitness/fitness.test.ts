import { describe, expect, it } from "vitest";
import { FOOD_DATABASE } from "../food-db";
import {
  aggregateGroceryList,
  buildPeriodizedPhasePlan,
  calculateEnergyTargets,
  calculateMacroTargets,
  calculateMifflinStJeorBMR,
  calculateNutritionAdherence,
  computeWeeklyMuscleVolume,
  computeWeightTrend,
  detectPlateau,
  evaluateDoubleProgression,
  evaluateSafetyPrompt,
  filterExercisesForInjuries,
  filterFoodsByDietAndAllergens,
  findMacroMatchedSwaps,
  formatMetricWithProvenance,
  generateWarmupRamp,
  planMissedSessionRecovery,
  recommendSplit,
  rpeToRir,
  rirToRpe,
  safeE1RM,
  substituteByEquipmentTier,
  validateMuscleRecoverySpacing,
} from "./index";

describe("Part B1 — Training Science (lib/fitness/training.ts)", () => {
  it("selects appropriate splits for 3, 4, 5, and 6 days", () => {
    expect(recommendSplit(3, "beginner", "hypertrophy").splitId).toBe("full_body");
    expect(recommendSplit(4, "intermediate", "strength").splitId).toBe("upper_lower");
    expect(recommendSplit(5, "intermediate", "hypertrophy").splitId).toBe("ppl_ul");
    expect(recommendSplit(6, "advanced", "hypertrophy").splitId).toBe("ppl");
  });

  it("detects consecutive-day muscle recovery violations (<48h)", () => {
    const bad = validateMuscleRecoverySpacing([
      { dayIndex: 0, label: "Push A", primaryMuscles: ["chest", "shoulders"] },
      { dayIndex: 1, label: "Push B", primaryMuscles: ["chest", "triceps"] },
    ]);
    expect(bad.valid).toBe(false);
    expect(bad.violations.some((v) => v.muscle === "chest" && v.hoursBetween === 24)).toBe(true);

    const good = validateMuscleRecoverySpacing([
      { dayIndex: 0, label: "Push A", primaryMuscles: ["chest"] },
      { dayIndex: 2, label: "Push B", primaryMuscles: ["chest"] },
    ]);
    expect(good.valid).toBe(true);
  });

  it("counts direct sets (1.0x) and indirect sets (0.5x) against experience volume bands", () => {
    const report = computeWeeklyMuscleVolume(
      [
        {
          exercises: [
            { primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], sets: 10 },
            { primaryMuscle: "triceps", secondaryMuscles: [], sets: 6 },
          ],
        },
      ],
      "intermediate",
    );
    const chest = report.muscles.find((m) => m.muscle === "chest");
    const triceps = report.muscles.find((m) => m.muscle === "triceps");
    expect(chest?.effectiveSets).toBe(10);
    expect(triceps?.directSets).toBe(6);
    expect(triceps?.indirectSets).toBe(5);
    expect(triceps?.effectiveSets).toBe(11);
  });

  it("converts RPE <-> RIR and guards e1RM above 10 reps", () => {
    expect(rpeToRir(8.5)).toBe(1.5);
    expect(rirToRpe(2)).toBe(8);
    const valid = safeE1RM(100, 5, "epley");
    expect(valid.reliable).toBe(true);
    expect(valid.e1rmKg).toBe(116.7);

    const highRep = safeE1RM(60, 15, "epley");
    expect(highRep.reliable).toBe(false);
    expect(highRep.e1rmKg).toBeNull();
  });

  it("evaluates double progression and missed-session recovery rules", () => {
    const up = evaluateDoubleProgression({
      lastWeightKg: 80,
      lastReps: [10, 10, 10],
      targetRepsMin: 8,
      targetRepsMax: 10,
      targetRpe: 8,
      actualRpeAvg: 8,
      equipment: "barbell",
    });
    expect(up.action).toBe("increase_load");
    expect(up.nextWeightKg).toBe(82.5);

    expect(planMissedSessionRecovery({ daysMissed: 1, missedDayName: "Push", nextScheduledDayName: "Pull" }).strategy).toBe("shift");
    expect(planMissedSessionRecovery({ daysMissed: 4, missedDayName: "Legs", nextScheduledDayName: "Upper" }).strategy).toBe("merge");
    expect(planMissedSessionRecovery({ daysMissed: 9, missedDayName: "Push", nextScheduledDayName: "Pull" }).strategy).toBe("reentry_light");
    expect(planMissedSessionRecovery({ daysMissed: 16, missedDayName: "Push", nextScheduledDayName: "Pull" }).strategy).toBe("ramp_back");
  });

  it("builds periodized phase plans (7..90d), warm-up ramps, and equipment substitutions", () => {
    expect(buildPeriodizedPhasePlan(90, "hypertrophy", "intermediate").blocks).toHaveLength(3);
    const ramp = generateWarmupRamp(100, true);
    expect(ramp.length).toBe(3);
    expect(ramp[0].weightKg).toBeLessThan(ramp[2].weightKg);

    const subs = substituteByEquipmentTier("ex-bench-press", ["dumbbell", "bodyweight"]);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every((s) => ["dumbbell", "bodyweight"].includes(s.equipment))).toBe(true);
  });
});

describe("Part B2 — Nutrition Science (lib/fitness/nutrition.ts)", () => {
  it("computes Mifflin-St Jeor BMR and enforces safe calorie floors (1200F / 1500M)", () => {
    // 30yo male, 180cm, 80kg: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateMifflinStJeorBMR({ sex: "male", age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);

    const lowFemale = calculateEnergyTargets({
      sex: "female",
      age: 35,
      heightCm: 155,
      weightKg: 50,
      activity: "sedentary",
      goal: "cut",
    });
    expect(lowFemale.floorApplied).toBe(true);
    expect(lowFemale.targetCalories).toBe(1200);
  });

  it("calculates macros within 3% of target calories", () => {
    const macros = calculateMacroTargets({
      targetCalories: 2400,
      weightKg: 75,
      goal: "recomp",
      mealsPerDay: 4,
    });
    expect(macros.within3Pct).toBe(true);
    expect(macros.proteinDistribution.mealsPerDay).toBe(4);
    expect(macros.fiberG).toBeGreaterThanOrEqual(25);
  });

  it("enforces hard diet and allergen constraints including Jain and Vegan", () => {
    const veganFoods = filterFoodsByDietAndAllergens(FOOD_DATABASE, "vegan");
    expect(veganFoods.every((f) => f.isVegan)).toBe(true);
    expect(veganFoods.some((f) => f.id === "paneer_raw")).toBe(false);

    const jainFoods = filterFoodsByDietAndAllergens(FOOD_DATABASE, "jain");
    expect(jainFoods.some((f) => f.id === "masala_dosa")).toBe(false); // contains potato/onion/garlic-adjacent bhaji

    const dairyFree = filterFoodsByDietAndAllergens(FOOD_DATABASE, "vegetarian", ["dairy"]);
    expect(dairyFree.some((f) => f.id === "paneer_raw")).toBe(false);
  });

  it("finds +/-10% kcal & +/-15% protein swaps and aggregates grocery list", () => {
    const paneer = FOOD_DATABASE.find((f) => f.id === "paneer_raw")!;
    const swaps = findMacroMatchedSwaps(paneer, "vegan");
    for (const s of swaps) {
      expect(s.calories).toBeGreaterThanOrEqual(paneer.calories * 0.9);
      expect(s.calories).toBeLessThanOrEqual(paneer.calories * 1.1);
      expect(s.protein).toBeGreaterThanOrEqual(paneer.protein * 0.85);
      expect(s.protein).toBeLessThanOrEqual(paneer.protein * 1.15);
    }

    const grocery = aggregateGroceryList([
      { foodId: "paneer_raw", servings: 2 },
      { foodId: "paneer_raw", servings: 1 },
    ]);
    expect(grocery[0].totalServings).toBe(3);
    expect(grocery[0].totalGrams).toBe(300);

    const adh = calculateNutritionAdherence(
      [
        { calories: 2200, protein: 160 },
        { calories: 2900, protein: 120 },
      ],
      2200,
      160,
    );
    expect(adh.adherencePct).toBe(50);
  });
});

describe("Part B3 & B4 — Progress, Provenance & Safety (lib/fitness/progress.ts, safety.ts)", () => {
  it("labels missing metrics as 'Not recorded' and flags >=1.5kg water-noise jumps", () => {
    expect(formatMetricWithProvenance(null, "measured", "%").display).toBe("Not recorded");
    const trend = computeWeightTrend([
      { date: "2026-11-01", weightKg: 80.0 },
      { date: "2026-11-05", weightKg: 79.8 },
      { date: "2026-11-06", weightKg: 81.6 }, // +1.8kg in 1 day -> water noise
      { date: "2026-11-10", weightKg: 79.6 },
    ]);
    expect(trend.hasEnoughData).toBe(true);
    expect(trend.waterNoiseFlag).toBe(true);
  });

  it("detects true plateau only when >=14d, >=5 points, and >=70% adherence", () => {
    const entries = [
      { date: "2026-11-01", weightKg: 80.0 },
      { date: "2026-11-04", weightKg: 80.1 },
      { date: "2026-11-08", weightKg: 80.0 },
      { date: "2026-11-12", weightKg: 80.1 },
      { date: "2026-11-16", weightKg: 80.0 },
    ];
    expect(detectPlateau({ weightEntries: entries, adherencePct: 55, goal: "cut" }).isPlateau).toBe(false);
    expect(detectPlateau({ weightEntries: entries, adherencePct: 85, goal: "cut" }).isPlateau).toBe(true);
  });

  it("flags medical red flags, eating disorders, PEDs, and filters shoulder-unsafe lifts", () => {
    expect(evaluateSafetyPrompt("I feel chest pain when squatting").category).toBe("medical_red_flag");
    expect(evaluateSafetyPrompt("Give me a 600 calorie diet").category).toBe("eating_disorder");
    expect(evaluateSafetyPrompt("How much anavar cycle should I run?").category).toBe("ped_dosing");

    const filtered = filterExercisesForInjuries(
      [
        { id: "ex-overhead-press", name: "Overhead Press", pattern: "vertical_push" },
        { id: "ex-face-pull", name: "Face Pull", pattern: "horizontal_pull" },
      ],
      ["shoulder"],
    );
    expect(filtered.safe.map((e) => e.id)).toEqual(["ex-face-pull"]);
    expect(filtered.excluded).toHaveLength(1);
  });
});
