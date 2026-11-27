/**
 * Pure Sports Nutrition Domain Module
 * Mifflin-St Jeor BMR, TDEE, safe calorie floors, 3% macro consistency,
 * hard diet/allergen filters (veg/vegan/eggetarian/non_veg/jain),
 * regional Indian/global presets, +/-10% kcal & +/-15% protein swaps, grocery aggregator.
 */

import { FOOD_DATABASE, type FoodItem } from "../food-db";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "athlete";
export type NutritionGoal = "cut" | "lean_bulk" | "bulk" | "maintain" | "recomp";
export type DietType = "non_veg" | "eggetarian" | "vegetarian" | "vegan" | "jain";
export type CuisineRegion = "north_indian" | "south_indian" | "pan_indian" | "global";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export interface EnergyTargetResult {
  bmr: number;
  tdee: number;
  rawTargetCalories: number;
  targetCalories: number;
  deficitOrSurplus: number;
  safeFloorKcal: number;
  floorApplied: boolean;
  floorWarning: string | null;
}

export function calculateMifflinStJeorBMR(input: {
  sex: "male" | "female" | "other";
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  if (input.sex === "female") return Math.round(base - 161);
  if (input.sex === "male") return Math.round(base + 5);
  return Math.round(base - 78);
}

export function calculateEnergyTargets(input: {
  sex: "male" | "female" | "other";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: NutritionGoal;
}): EnergyTargetResult {
  const bmr = calculateMifflinStJeorBMR(input);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activity]);
  const safeFloorKcal = input.sex === "female" ? 1200 : 1500;

  let delta = 0;
  if (input.goal === "cut") delta = -450;
  else if (input.goal === "recomp") delta = -150;
  else if (input.goal === "lean_bulk") delta = 250;
  else if (input.goal === "bulk") delta = 450;

  const rawTargetCalories = tdee + delta;
  const floorApplied = rawTargetCalories < safeFloorKcal;
  const targetCalories = floorApplied ? safeFloorKcal : rawTargetCalories;
  const floorWarning = floorApplied
    ? `Calculated target (${rawTargetCalories} kcal) was raised to the safe clinical floor of ${safeFloorKcal} kcal/day.`
    : null;

  return {
    bmr,
    tdee,
    rawTargetCalories,
    targetCalories,
    deficitOrSurplus: targetCalories - tdee,
    safeFloorKcal,
    floorApplied,
    floorWarning,
  };
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  macroCalories: number;
  within3Pct: boolean;
  proteinDistribution: { mealsPerDay: number; gramsPerMeal: number };
  fiberG: number;
  hydrationMl: number;
}

export function calculateMacroTargets(input: {
  targetCalories: number;
  weightKg: number;
  goal: NutritionGoal;
  mealsPerDay?: number;
  trainingMinutes?: number;
  carbPreference?: "balanced" | "low_carb" | "high_carb";
}): MacroTargets {
  const weight = Math.max(40, input.weightKg);
  const proteinPerKg =
    input.goal === "cut" || input.goal === "recomp"
      ? 2.1
      : input.goal === "lean_bulk" || input.goal === "bulk"
        ? 1.85
        : 1.8;

  const proteinG = Math.round(weight * proteinPerKg);
  const proteinKcal = proteinG * 4;

  const fatShare =
    input.carbPreference === "low_carb"
      ? 0.35
      : input.carbPreference === "high_carb"
        ? 0.22
        : 0.27;
  const minFatG = Math.round(weight * 0.7);
  const rawFatG = Math.round((input.targetCalories * fatShare) / 9);
  const fatG = Math.max(minFatG, rawFatG);
  const fatKcal = fatG * 9;

  const remainingKcal = Math.max(200, input.targetCalories - proteinKcal - fatKcal);
  const carbsG = Math.round(remainingKcal / 4);
  const macroCalories = proteinG * 4 + carbsG * 4 + fatG * 9;
  const within3Pct =
    Math.abs(macroCalories - input.targetCalories) / Math.max(1, input.targetCalories) <= 0.03;

  const mealsPerDay = Math.max(3, Math.min(6, input.mealsPerDay ?? 4));
  const gramsPerMeal = Math.round((proteinG / mealsPerDay) * 10) / 10;
  const fiberG = Math.max(25, Math.round((input.targetCalories / 1000) * 14));
  const hydrationMl = Math.round(weight * 35 + (input.trainingMinutes ?? 45) * 10);

  return {
    calories: input.targetCalories,
    proteinG,
    carbsG,
    fatG,
    macroCalories,
    within3Pct,
    proteinDistribution: { mealsPerDay, gramsPerMeal },
    fiberG,
    hydrationMl,
  };
}

export function workoutNutritionGuidance(
  goal: NutritionGoal,
  targetCalories: number,
  proteinG: number,
): { preWorkout: string; postWorkout: string } {
  const preCarbs = goal === "cut" ? "25–35 g" : "40–60 g";
  const postProtein = `${Math.min(45, Math.max(25, Math.round(proteinG * 0.25)))} g`;
  return {
    preWorkout: `60–90 min before training: ${preCarbs} easily digestible carbs + 20–30 g lean protein (e.g. oats + whey or banana + Greek yogurt).`,
    postWorkout: `Within 2 hours post-training (out of ${targetCalories} kcal budget): ${postProtein} fast/complete protein + carbs to replenish glycogen.`,
  };
}

const NON_JAIN_REGEX = /\b(onion|garlic|potato|bhaji|aloo|ginger|carrot|radish|beet|egg|chicken|fish|mutton|prawn|tuna|meat)\b/i;
const EGG_REGEX = /\b(egg|omelette|bhurji)\b/i;

export function matchesDietHardConstraint(food: FoodItem, diet: DietType): boolean {
  if (diet === "non_veg") return true;
  if (diet === "eggetarian") {
    if (food.isVegetarian) return true;
    return EGG_REGEX.test(food.name) && !/\b(chicken|fish|mutton|tuna|meat)\b/i.test(food.name);
  }
  if (diet === "vegetarian") return food.isVegetarian;
  if (diet === "vegan") return food.isVegan;
  if (diet === "jain") {
    return food.isVegetarian && !NON_JAIN_REGEX.test(`${food.name} ${food.ingredients ?? ""}`);
  }
  return true;
}

export function matchesAllergenConstraint(food: FoodItem, allergens: string[]): boolean {
  if (!allergens.length) return true;
  const hay = `${food.name} ${food.brand ?? ""} ${food.category} ${food.ingredients ?? ""}`.toLowerCase();
  for (const raw of allergens) {
    const a = raw.trim().toLowerCase();
    if (!a) continue;
    if (a === "dairy" || a === "lactose") {
      if (food.category === "dairy" || /\b(milk|paneer|curd|dahi|yogurt|lassi|whey|ghee|cheese)\b/i.test(hay)) {
        return false;
      }
    } else if (a === "soy" || a === "soya") {
      if (/\b(soy|soya|tofu|edamame)\b/i.test(hay)) return false;
    } else if (a === "gluten" || a === "wheat") {
      if (/\b(roti|phulka|wheat|bread|upma|rava|seitan)\b/i.test(hay)) return false;
    } else if (a === "nuts" || a === "peanuts") {
      if (food.category === "nuts_seeds" || /\b(almond|peanut|cashew|walnut|nut)\b/i.test(hay)) return false;
    } else if (hay.includes(a)) {
      return false;
    }
  }
  return true;
}

export function filterFoodsByDietAndAllergens(
  foods: FoodItem[],
  diet: DietType,
  allergens: string[] = [],
  region?: CuisineRegion,
): FoodItem[] {
  return foods.filter((f) => {
    if (!matchesDietHardConstraint(f, diet)) return false;
    if (!matchesAllergenConstraint(f, allergens)) return false;
    if (region && region !== "pan_indian" && f.region !== region && f.region !== "pan_indian" && f.region !== "global") {
      return false;
    }
    return true;
  });
}

export function findMacroMatchedSwaps(
  targetFood: FoodItem,
  diet: DietType,
  allergens: string[] = [],
  limit = 4,
): FoodItem[] {
  const minKcal = targetFood.calories * 0.9;
  const maxKcal = targetFood.calories * 1.1;
  const minProt = targetFood.protein * 0.85;
  const maxProt = targetFood.protein * 1.15;

  const pool = filterFoodsByDietAndAllergens(FOOD_DATABASE, diet, allergens).filter(
    (f) => f.id !== targetFood.id,
  );

  return pool
    .filter(
      (f) =>
        f.calories >= minKcal &&
        f.calories <= maxKcal &&
        f.protein >= minProt &&
        f.protein <= maxProt,
    )
    .sort((a, b) => {
      const diffA = Math.abs(a.calories - targetFood.calories) + Math.abs(a.protein - targetFood.protein) * 4;
      const diffB = Math.abs(b.calories - targetFood.calories) + Math.abs(b.protein - targetFood.protein) * 4;
      return diffA - diffB;
    })
    .slice(0, limit);
}

export interface GroceryItem {
  foodId: string;
  name: string;
  category: string;
  totalServings: number;
  totalGrams: number;
  unitLabel: string;
}

export function aggregateGroceryList(
  items: Array<{ foodId: string; servings: number }>,
): GroceryItem[] {
  const byId = new Map<string, number>();
  for (const item of items) {
    byId.set(item.foodId, (byId.get(item.foodId) ?? 0) + Math.max(0, item.servings));
  }
  const out: GroceryItem[] = [];
  for (const [foodId, totalServings] of byId.entries()) {
    const food = FOOD_DATABASE.find((f) => f.id === foodId);
    if (!food || totalServings <= 0) continue;
    out.push({
      foodId,
      name: food.name,
      category: food.category,
      totalServings: Math.round(totalServings * 10) / 10,
      totalGrams: Math.round(food.servingGrams * totalServings),
      unitLabel: food.servingUnit,
    });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export function calculateNutritionAdherence(
  days: Array<{ calories: number; protein: number }>,
  targetCalories: number,
  targetProtein: number,
): { adherencePct: number; compliantDays: number; totalDays: number } {
  if (!days.length) return { adherencePct: 0, compliantDays: 0, totalDays: 0 };
  const compliantDays = days.filter((d) => {
    const kcalOk =
      d.calories >= targetCalories * 0.9 && d.calories <= targetCalories * 1.1;
    const protOk = d.protein >= targetProtein * 0.9;
    return kcalOk && protOk;
  }).length;
  return {
    adherencePct: Math.round((compliantDays / days.length) * 100),
    compliantDays,
    totalDays: days.length,
  };
}
