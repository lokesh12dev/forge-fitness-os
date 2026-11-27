/**
 * FORGE Nutrition Engine (D3, D4, E2)
 * Pure, tested functions for:
 * 1. Mifflin-St Jeor TDEE & macro targets calculator
 * 2. "Hit my remaining protein" smart food pairing optimizer
 * 3. 7-day moving average weight smoothing
 */

import { FOOD_DATABASE, type FoodItem } from "./food-db";

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active" | "athlete";
export type NutritionGoal = "fat_loss" | "maintenance" | "lean_bulk" | "aggressive_bulk";

export interface TDEEInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
}

export interface MacroTargetsResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetWaterMl: number;
  proteinRatio: number; // % of total kcal
  carbsRatio: number;   // % of total kcal
  fatRatio: number;     // % of total kcal
  deficitOrSurplusKcal: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // Desk job, little to no exercise
  light: 1.375,         // 1-3 training sessions/week
  moderate: 1.55,       // 3-5 training sessions/week
  very_active: 1.725,   // 6-7 intense training sessions/week
  athlete: 1.9,         // Daily 2-a-day or physical labor
};

const GOAL_CALORIE_DELTAS: Record<NutritionGoal, number> = {
  fat_loss: -500,
  maintenance: 0,
  lean_bulk: 300,
  aggressive_bulk: 500,
};

/**
 * 1. Mifflin-St Jeor TDEE & Macro Calculator (D3)
 */
export function calculateTDEE(input: TDEEInput): MacroTargetsResult {
  const { weightKg, heightCm, age, sex, activityLevel, goal } = input;

  // Mifflin-St Jeor BMR
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = Math.round(sex === "male" ? baseBMR + 5 : baseBMR - 161);

  // TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  const tdee = Math.round(bmr * multiplier);

  // Calorie Target based on Goal
  const delta = GOAL_CALORIE_DELTAS[goal] ?? 0;
  const targetCalories = Math.max(1200, Math.round(tdee + delta));

  // Protein prescription:
  // Fat loss requires higher protein (2.2g/kg) to preserve lean mass in deficit.
  // Bulking / maintenance: 2.0g/kg.
  const proteinPerKg = goal === "fat_loss" ? 2.2 : 2.0;
  const targetProtein = Math.round(weightKg * proteinPerKg);
  const proteinKcal = targetProtein * 4;

  // Fat prescription:
  // 0.8g per kg bodyweight, minimum 20% of total daily calories for hormone health.
  const minFatKcal = targetCalories * 0.20;
  const targetFat = Math.max(Math.round(minFatKcal / 9), Math.round(weightKg * 0.8));
  const fatKcal = targetFat * 9;

  // Carbs fill the remaining calories
  const remainingKcal = Math.max(0, targetCalories - (proteinKcal + fatKcal));
  const targetCarbs = Math.round(remainingKcal / 4);

  // Daily water target: 35ml per kg + 500ml baseline for exercise hydration
  const targetWaterMl = Math.round(weightKg * 35 + 500);

  const totalCalculatedKcal = targetProtein * 4 + targetCarbs * 4 + targetFat * 9;
  const proteinRatio = Math.round((proteinKcal / totalCalculatedKcal) * 100);
  const fatRatio = Math.round((fatKcal / totalCalculatedKcal) * 100);
  const carbsRatio = Math.max(0, 100 - (proteinRatio + fatRatio));

  return {
    bmr,
    tdee,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    targetWaterMl,
    proteinRatio,
    carbsRatio,
    fatRatio,
    deficitOrSurplusKcal: delta,
  };
}

export interface ProteinSuggestion {
  id: string;
  title: string;
  foodName: string;
  serving: string;
  multiplier: number;
  proteinGrams: number;
  calories: number;
  carbs: number;
  fat: number;
  efficiency: number; // protein g per 100 kcal
  reason: string;
  isVegetarian: boolean;
  isVegan: boolean;
}

/**
 * 2. "Hit My Remaining Protein" Smart Optimizer (D4)
 * Evaluates Indian and global staples, finds single-serving and double-serving options
 * that hit remainingProtein within remainingCalories without exceeding calorie allowance.
 */
export function hitRemainingProtein(
  remainingProteinGrams: number,
  remainingCalories: number,
  options?: {
    vegetarianOnly?: boolean;
    veganOnly?: boolean;
    maxResults?: number;
  },
): ProteinSuggestion[] {
  if (remainingProteinGrams <= 0) return [];

  const vegetarianOnly = options?.vegetarianOnly ?? false;
  const veganOnly = options?.veganOnly ?? false;
  const maxResults = options?.maxResults ?? 5;

  const eligibleFoods = FOOD_DATABASE.filter((f) => {
    if (vegetarianOnly && !f.isVegetarian) return false;
    if (veganOnly && !f.isVegan) return false;
    return f.protein > 0;
  });

  const suggestions: ProteinSuggestion[] = [];

  for (const food of eligibleFoods) {
    // Multipliers from 0.5x to 3.0x in 0.5 steps
    for (const mult of [0.5, 1, 1.5, 2, 2.5, 3]) {
      const p = Math.round(food.protein * mult * 10) / 10;
      const cal = Math.round(food.calories * mult);
      const c = Math.round(food.carbs * mult * 10) / 10;
      const f = Math.round(food.fat * mult * 10) / 10;

      // Must cover at least 65% of remaining protein and not exceed 135%
      const coversProtein = p >= remainingProteinGrams * 0.65 && p <= remainingProteinGrams * 1.35;
      // Must fit in remaining calories (or within 100 kcal grace if tight)
      const fitsCalories = remainingCalories <= 0 ? cal <= 350 : cal <= remainingCalories + 60;

      if (coversProtein && fitsCalories) {
        const efficiency = Math.round((p / Math.max(1, cal)) * 100 * 10) / 10;
        const proteinDelta = Math.abs(p - remainingProteinGrams);

        let servingLabel = food.servingUnit;
        if (mult !== 1) {
          if (food.servingUnit.includes("katori")) {
            servingLabel = `${mult} katori (${Math.round(food.servingGrams * mult)}g)`;
          } else if (food.servingUnit.includes("scoop")) {
            servingLabel = `${mult} scoop (${Math.round(food.servingGrams * mult)}g)`;
          } else if (food.servingUnit.includes("g")) {
            servingLabel = `${Math.round(food.servingGrams * mult)}g`;
          } else {
            servingLabel = `${mult}x ${food.servingUnit}`;
          }
        }

        const reason =
          p >= remainingProteinGrams
            ? `Hits ${Math.round(p)}g of your ${Math.round(remainingProteinGrams)}g target in ${cal} kcal`
            : `Covers ${Math.round(p)}g (${Math.round((p / remainingProteinGrams) * 100)}%) with high protein density`;

        suggestions.push({
          id: `${food.id}_${mult}x`,
          title: food.name,
          foodName: food.name,
          serving: servingLabel,
          multiplier: mult,
          proteinGrams: p,
          calories: cal,
          carbs: c,
          fat: f,
          efficiency,
          reason,
          isVegetarian: food.isVegetarian,
          isVegan: food.isVegan,
        });
      }
    }
  }

  // Sort by highest protein density (efficiency) and closest match to remaining protein
  suggestions.sort((a, b) => {
    const diffA = Math.abs(a.proteinGrams - remainingProteinGrams);
    const diffB = Math.abs(b.proteinGrams - remainingProteinGrams);
    if (diffA !== diffB) return diffA - diffB;
    return b.efficiency - a.efficiency;
  });

  // Deduplicate by food name (keeping best multiplier)
  const seen = new Set<string>();
  const deduplicated: ProteinSuggestion[] = [];
  for (const s of suggestions) {
    if (!seen.has(s.foodName)) {
      seen.add(s.foodName);
      deduplicated.push(s);
      if (deduplicated.length >= maxResults) break;
    }
  }

  return deduplicated;
}

/**
 * 3. 7-Day Moving Average Weight Smoothing (E2)
 * Eliminates daily water weight, hydration, and salt noise to reveal true physiological trend.
 */
export function calculateWeightMovingAverage(
  entries: { date: string; weightKg: number }[],
  windowDays = 7,
): Array<{ date: string; weightKg: number; movingAvgKg: number }> {
  if (entries.length === 0) return [];

  // Sort chronological
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((entry, idx) => {
    const startIdx = Math.max(0, idx - windowDays + 1);
    const windowSlice = sorted.slice(startIdx, idx + 1);
    const sum = windowSlice.reduce((acc, curr) => acc + curr.weightKg, 0);
    const movingAvg = Math.round((sum / windowSlice.length) * 10) / 10;

    return {
      date: entry.date,
      weightKg: entry.weightKg,
      movingAvgKg: movingAvg,
    };
  });
}
