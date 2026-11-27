/**
 * FORGE Nutrition Planner, Calculators, Insights & Educational Assistant Engine
 * Pure TypeScript, zero external AI claims — transparent local nutrition math.
 */

import { FOOD_DATABASE, type FoodItem } from "./food-db";
import { resolveFoodPhoto } from "./opennutri-core";

export type PlannerGoal = "weight_loss" | "muscle_gain" | "maintenance" | "general_fitness";
export type PlannerDiet = "omnivore" | "vegetarian" | "vegan";
export type PlannerCuisine = "all" | "south_indian" | "north_indian" | "pan_indian" | "international";
export type PlannerBudget = "budget" | "standard";
export type PlannerAllergy = "dairy" | "nuts" | "soy" | "eggs" | "gluten";

export interface PlannerConfig {
  goal: PlannerGoal;
  diet: PlannerDiet;
  cuisine: PlannerCuisine;
  budget: PlannerBudget;
  allergies: PlannerAllergy[];
  targetCalories: number;
}

export interface PlannedMealItem {
  slot: "breakfast" | "morning_snack" | "lunch" | "evening_snack" | "dinner";
  slotLabel: string;
  foodId: string;
  name: string;
  servingUnit: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  imageUrl: string;
  ingredients: string;
}

export interface PlannedDay {
  dayIndex: number;
  dayName: string;
  meals: PlannedMealItem[];
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
}

export interface ShoppingListEntry {
  name: string;
  category: string;
  count: number;
  totalGrams: number;
  sampleUnit: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isAllowed(food: FoodItem, cfg: PlannerConfig): boolean {
  if (cfg.diet === "vegan" && !food.isVegan) return false;
  if (cfg.diet === "vegetarian" && !food.isVegetarian) return false;

  const low = (food.name + " " + (food.ingredients ?? "")).toLowerCase();
  if (cfg.allergies.includes("dairy") && (food.category === "dairy" || low.includes("milk") || low.includes("paneer") || low.includes("curd") || low.includes("yogurt") || low.includes("whey") || low.includes("ghee"))) return false;
  if (cfg.allergies.includes("nuts") && (food.category === "nuts_seeds" || low.includes("almond") || low.includes("peanut") || low.includes("cashew"))) return false;
  if (cfg.allergies.includes("soy") && (low.includes("soya") || low.includes("tofu"))) return false;
  if (cfg.allergies.includes("eggs") && low.includes("egg")) return false;
  if (cfg.allergies.includes("gluten") && (low.includes("wheat") || low.includes("roti") || low.includes("bread") || low.includes("rava"))) return false;

  if (cfg.budget === "budget" && (food.category === "supplement" || low.includes("salmon") || low.includes("bar"))) return false;

  if (cfg.cuisine !== "all") {
    if (cfg.cuisine === "south_indian" && food.region !== "south_indian" && food.region !== "pan_indian") return false;
    if (cfg.cuisine === "north_indian" && food.region !== "north_indian" && food.region !== "pan_indian") return false;
    if (cfg.cuisine === "international" && food.region !== "global") return false;
  }

  return true;
}

function toPlannedItem(slot: PlannedMealItem["slot"], slotLabel: string, food: FoodItem, scale = 1): PlannedMealItem {
  const photo = resolveFoodPhoto(food.name, food.category);
  return {
    slot,
    slotLabel,
    foodId: food.id,
    name: food.name,
    servingUnit: scale === 1 ? food.servingUnit : `${Math.round(food.servingGrams * scale)}g (${scale}×)`,
    servingGrams: Math.round(food.servingGrams * scale),
    calories: Math.round(food.calories * scale),
    protein: Math.round(food.protein * scale * 10) / 10,
    carbs: Math.round(food.carbs * scale * 10) / 10,
    fat: Math.round(food.fat * scale * 10) / 10,
    fiber: Math.round((food.fiber ?? 2) * scale * 10) / 10,
    imageUrl: photo.imageUrl,
    ingredients: food.ingredients ?? food.name,
  };
}

export function generateWeeklyMealPlan(cfg: PlannerConfig): PlannedDay[] {
  const pool = FOOD_DATABASE.filter((f) => isAllowed(f, cfg));
  const fallbackPool = FOOD_DATABASE.filter((f) => (cfg.diet === "vegan" ? f.isVegan : cfg.diet === "vegetarian" ? f.isVegetarian : true));
  const active = pool.length >= 6 ? pool : fallbackPool;

  const breakfasts = active.filter((f) => f.category === "grain_bread" || f.category === "fruit" || f.id.includes("egg") || f.id.includes("idli") || f.id.includes("dosa") || f.id.includes("poha") || f.id.includes("upma") || f.id.includes("pongal"));
  const lunches = active.filter((f) => f.category === "pulse_dal" || f.category === "poultry_meat" || f.category === "dairy" || f.category === "vegan");
  const dinners = active.filter((f) => f.isHighProtein || f.category === "pulse_dal" || f.category === "grain_bread");
  const snacks = active.filter((f) => f.category === "snack" || f.category === "fruit" || f.category === "nuts_seeds" || f.category === "dairy" || f.category === "supplement");

  const pick = (arr: FoodItem[], idx: number) => (arr.length ? arr[idx % arr.length] : active[idx % active.length]);
  const scaleFactor = cfg.goal === "muscle_gain" ? 1.25 : cfg.goal === "weight_loss" ? 0.85 : 1.0;

  return WEEKDAYS.map((dayName, dIdx) => {
    const meals: PlannedMealItem[] = [
      toPlannedItem("breakfast", "Breakfast", pick(breakfasts, dIdx), scaleFactor),
      toPlannedItem("morning_snack", "Morning Snack", pick(snacks, dIdx + 1), 1),
      toPlannedItem("lunch", "Lunch", pick(lunches, dIdx + 2), scaleFactor),
      toPlannedItem("evening_snack", "Evening Snack", pick(snacks, dIdx + 3), 1),
      toPlannedItem("dinner", "Dinner", pick(dinners, dIdx + 4), scaleFactor),
    ];

    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: Math.round((acc.protein + m.protein) * 10) / 10,
        carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
        fat: Math.round((acc.fat + m.fat) * 10) / 10,
        fiber: Math.round((acc.fiber + m.fiber) * 10) / 10,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );

    return { dayIndex: dIdx, dayName, meals, totals };
  });
}

export function buildShoppingList(days: PlannedDay[]): ShoppingListEntry[] {
  const map = new Map<string, ShoppingListEntry>();
  for (const d of days) {
    for (const m of d.meals) {
      const food = FOOD_DATABASE.find((f) => f.id === m.foodId);
      const prev = map.get(m.name);
      if (prev) {
        prev.count += 1;
        prev.totalGrams += m.servingGrams;
      } else {
        map.set(m.name, {
          name: m.name,
          category: food?.category ?? "staple",
          count: 1,
          totalGrams: m.servingGrams,
          sampleUnit: m.servingUnit,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/* ─────────────────────────── NUTRITION SCORE & INSIGHTS ─────────────────────────── */

export interface NutritionInsight {
  id: string;
  title: string;
  detail: string;
  tone: "mint" | "acid" | "amber" | "sky";
}

export function computeDailyNutritionScore(input: {
  calories: number;
  targetCalories: number;
  protein: number;
  targetProtein: number;
  fiber: number;
  targetFiber: number;
  waterMl: number;
  targetWaterMl: number;
}): number {
  if (input.calories <= 0 && input.waterMl <= 0) return 0;
  const calDiffRatio = Math.abs(input.calories - input.targetCalories) / Math.max(1, input.targetCalories);
  const calScore = input.calories > 0 ? Math.max(0, 35 * (1 - calDiffRatio)) : 0;
  const proteinScore = Math.min(30, (input.protein / Math.max(1, input.targetProtein)) * 30);
  const fiberScore = Math.min(15, (input.fiber / Math.max(1, input.targetFiber)) * 15);
  const waterScore = Math.min(20, (input.waterMl / Math.max(1, input.targetWaterMl)) * 20);
  return Math.min(100, Math.round(calScore + proteinScore + fiberScore + waterScore));
}

export function buildNutritionInsights(input: {
  calories: number;
  targetCalories: number;
  protein: number;
  targetProtein: number;
  fiber: number;
  targetFiber: number;
  waterMl: number;
  targetWaterMl: number;
  mealSlotCount: number;
  loggedDaysLast7: number;
}): NutritionInsight[] {
  const insights: NutritionInsight[] = [];

  if (input.calories === 0) {
    insights.push({
      id: "empty-day",
      title: "Ready for today's first meal",
      detail: "Log breakfast or use Quick Log to unlock live calorie, protein, and micronutrient tracking.",
      tone: "sky",
    });
  } else if (input.calories < input.targetCalories * 0.75) {
    insights.push({
      id: "cal-under",
      title: "Calorie intake still building",
      detail: `You have ${Math.round(input.targetCalories - input.calories)} kcal remaining toward your daily target.`,
      tone: "acid",
    });
  } else if (input.calories > input.targetCalories * 1.15) {
    insights.push({
      id: "cal-over",
      title: "Above daily calorie target",
      detail: `Currently ${Math.round(input.calories - input.targetCalories)} kcal above target — consider lighter fiber-rich options for remaining meals.`,
      tone: "amber",
    });
  } else {
    insights.push({
      id: "cal-on-track",
      title: "Calorie balance on track",
      detail: "Your intake is aligned within ±15% of your daily energy target.",
      tone: "mint",
    });
  }

  const proteinPct = Math.round((input.protein / Math.max(1, input.targetProtein)) * 100);
  insights.push({
    id: "protein-check",
    title: proteinPct >= 90 ? "Protein target nearly cleared" : `Protein at ${proteinPct}% of goal`,
    detail:
      proteinPct >= 90
        ? `${Math.round(input.protein)}g logged today supports muscle recovery and satiety.`
        : `Add ${Math.max(0, Math.round(input.targetProtein - input.protein))}g more protein (e.g., paneer, chicken breast, boiled moong, or whey).`,
    tone: proteinPct >= 90 ? "mint" : "sky",
  });

  if (input.fiber < input.targetFiber * 0.6) {
    insights.push({
      id: "fiber-gap",
      title: "Fiber opportunity",
      detail: `At ${Math.round(input.fiber)}g vs ${input.targetFiber}g IOM AI reference — add dal, chana, oats, broccoli, or fruit.`,
      tone: "amber",
    });
  }

  const waterPct = Math.round((input.waterMl / Math.max(1, input.targetWaterMl)) * 100);
  insights.push({
    id: "hydration",
    title: waterPct >= 80 ? "Hydration looking solid" : "Hydration needs a boost",
    detail: `${(input.waterMl / 1000).toFixed(2)}L of ${(input.targetWaterMl / 1000).toFixed(1)}L logged (${waterPct}%).`,
    tone: waterPct >= 80 ? "mint" : "sky",
  });

  insights.push({
    id: "consistency",
    title: `${input.loggedDaysLast7}/7 days logged this week`,
    detail:
      input.loggedDaysLast7 >= 5
        ? `Strong tracking rhythm across ${input.mealSlotCount} meal slots today.`
        : "Consistent daily logging improves macro accuracy and weekly trend insights.",
    tone: input.loggedDaysLast7 >= 5 ? "mint" : "acid",
  });

  return insights;
}

/* ─────────────────────────── CALCULATORS (Mifflin-St Jeor + IOM) ─────────────────────────── */

export function calculateMifflinBmr(weightKg: number, heightCm: number, age: number, sex: "male" | "female"): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

/* ─────────────────────────── LOCAL EDUCATIONAL AI NUTRITION ASSISTANT ─────────────────────────── */

export function generateNutritionAssistantReply(
  prompt: string,
  ctx: {
    firstName: string;
    calories: number;
    targetCalories: number;
    protein: number;
    targetProtein: number;
    carbs: number;
    targetCarbs: number;
    fat: number;
    targetFat: number;
    waterMl: number;
    targetWaterMl: number;
    weightKg: number;
  },
): string {
  const q = prompt.toLowerCase();
  const remCal = Math.round(ctx.targetCalories - ctx.calories);
  const remProt = Math.max(0, Math.round(ctx.targetProtein - ctx.protein));

  if (q.includes("protein")) {
    return `${ctx.firstName}, you've logged ${Math.round(ctx.protein)}g of your ${ctx.targetProtein}g protein target (${remProt}g remaining).\n\nPractical ways to close a ${remProt}g gap:\n• Low-Fat Paneer (100g): +21g protein (~198 kcal)\n• Boiled Moong Dal (1 katori): +11g protein (~165 kcal)\n• Chicken Breast (150g): +46g protein (~248 kcal)\n• Whey Isolate (1 scoop): +24g protein (~120 kcal)`;
  }
  if (q.includes("south") || q.includes("indian") || q.includes("swap") || q.includes("meal")) {
    return `Balanced Indian meal ideas around your ${remCal > 0 ? remCal : ctx.targetCalories} kcal budget:\n• South Indian Breakfast: 2 Steamed Idlis + 1 katori Sambar + Greek Yogurt (+15g protein)\n• North Indian Lunch: 2 Whole Wheat Rotis + 1 katori Rajma/Chana Masala + 100g Paneer Bhurji\n• Evening Snack: Roasted Bhuna Chana (50g) or Amul High Protein Lassi (+15g protein)`;
  }
  if (q.includes("label")) {
    return `How to read a nutrition label quickly:\n1. Check serving size first — many packs list per 30g/100g rather than the full packet.\n2. Protein-to-calorie ratio: ≥10g protein per 100–150 kcal is a strong lean protein source.\n3. Fiber & added sugar: look for ≥3g fiber per serving and keep added sugars low.\n4. Sodium: compare against the 2,300 mg/day IOM upper limit.`;
  }
  if (q.includes("water") || q.includes("hydrat")) {
    return `You're at ${(ctx.waterMl / 1000).toFixed(2)}L / ${(ctx.targetWaterMl / 1000).toFixed(1)}L today. A general hydration guideline is ~35 ml per kg of body weight (~${Math.round(ctx.weightKg * 35)} ml/day) plus extra fluids around workouts.`;
  }
  return `Today's snapshot for ${ctx.firstName}:\n• Energy: ${Math.round(ctx.calories)} / ${ctx.targetCalories} kcal (${remCal >= 0 ? `${remCal} kcal left` : `${Math.abs(remCal)} kcal over`})\n• Macros: ${Math.round(ctx.protein)}g P / ${Math.round(ctx.carbs)}g C / ${Math.round(ctx.fat)}g F\n• Hydration: ${(ctx.waterMl / 1000).toFixed(2)}L / ${(ctx.targetWaterMl / 1000).toFixed(1)}L\n\nAsk me about closing your protein gap, Indian meal swaps, reading nutrition labels, or calibrating your calorie targets.`;
}
