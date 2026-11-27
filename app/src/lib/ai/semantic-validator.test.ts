import { describe, expect, it } from "vitest";
import { computePlanDiff, validatePlanSemantically } from "./semantic-validator";
import type { NutritionPlan, WorkoutPlan } from "./schemas";

describe("Part E — Semantic Plan Validator & Diff", () => {
  it("blocks unknown exercises, missing equipment, and injury-contraindicated lifts", () => {
    const plan: WorkoutPlan = {
      kind: "workout",
      title: "Test Push",
      focus: "Push",
      goal: "hypertrophy",
      environment: "home",
      durationMin: 45,
      intensity: "RPE 8",
      summary: "Test",
      exercises: [
        {
          exerciseId: "ex-does-not-exist",
          name: "Fake Lift",
          primaryMuscle: "chest",
          equipment: "barbell",
          sets: 3,
          repsMin: 8,
          repsMax: 12,
          suggestedWeightKg: 0,
          restSec: 90,
          tempo: "2-0-1",
          rpeTarget: 8,
          notes: "",
        },
        {
          exerciseId: "ex-overhead-press",
          name: "Overhead Press",
          primaryMuscle: "shoulders",
          equipment: "barbell",
          sets: 3,
          repsMin: 8,
          repsMax: 10,
          suggestedWeightKg: 50,
          restSec: 120,
          tempo: "2-0-1",
          rpeTarget: 8,
          notes: "",
        },
      ],
      progressiveOverloadRule: "Double progression",
      recoveryNote: "48h",
    };

    const res = validatePlanSemantically(plan, {
      sex: "male",
      experience: "intermediate",
      equipment: ["dumbbell", "bodyweight"],
      injuries: ["shoulder"],
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "EX_UNKNOWN")).toBe(true);
    expect(res.errors.some((e) => e.code === "EX_EQUIPMENT")).toBe(true);
    expect(res.errors.some((e) => e.code === "EX_INJURY")).toBe(true);
  });

  it("blocks nutrition diet/allergen violations and macro mismatches", () => {
    const plan: NutritionPlan = {
      kind: "nutrition",
      title: "Vegan Cut",
      dietStyle: "vegan",
      goal: "cut",
      disclaimer: "Fitness use only.",
      dailyTargets: {
        calories: 2000,
        protein: 150,
        carbs: 150,
        fat: 50, // 600 + 600 + 450 = 1650 kcal (17.5% mismatch)
        waterMl: 3000,
      },
      summary: "Test",
      meals: [
        {
          slot: "lunch",
          label: "Lunch",
          items: [
            {
              name: "Fresh Low-Fat Paneer",
              serving: "100g",
              calories: 198,
              protein: 21,
              carbs: 3.5,
              fat: 11,
            },
          ],
        },
      ],
      groceryList: [],
      hydrationPlan: "3L",
    };

    const res = validatePlanSemantically(plan, {
      sex: "male",
      experience: "intermediate",
      equipment: ["barbell"],
      diet: "vegan",
      allergens: ["dairy"],
    });

    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === "NUT_DIET_VIOLATION")).toBe(true);
    expect(res.errors.some((e) => e.code === "NUT_ALLERGEN_VIOLATION")).toBe(true);
    expect(res.warnings.some((w) => w.code === "NUT_MACRO_MISMATCH")).toBe(true);
  });

  it("computes readable plan diffs", () => {
    const a: NutritionPlan = {
      kind: "nutrition",
      title: "Cut v1",
      dietStyle: "balanced",
      goal: "cut",
      disclaimer: "Fitness use only.",
      dailyTargets: { calories: 2200, protein: 160, carbs: 230, fat: 70, waterMl: 3000 },
      summary: "v1",
      meals: [{ slot: "lunch", label: "Lunch", items: [{ name: "Dal", serving: "1 bowl", calories: 200, protein: 10, carbs: 30, fat: 4 }] }],
      groceryList: [],
      hydrationPlan: "3L",
    };
    const b: NutritionPlan = {
      ...a,
      title: "Cut v2",
      dailyTargets: { ...a.dailyTargets, calories: 2050, protein: 170 },
    };
    const diffs = computePlanDiff(a, b);
    expect(diffs).toContain('Title changed: "Cut v1" -> "Cut v2"');
    expect(diffs).toContain("Calories: 2200 -> 2050 kcal");
    expect(diffs).toContain("Protein: 160g -> 170g");
  });
});
