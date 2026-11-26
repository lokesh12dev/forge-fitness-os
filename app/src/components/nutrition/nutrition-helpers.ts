import {
  ONT_CORE_FOODS,
  ONT_RECIPES,
  getIomDriTable,
  resolveFoodPhoto,
  scaleNutrients,
  type DriTarget,
  type NutriCatalogItem,
  type NutriRecipe,
  type NutrientBreakdownPer100g,
  type OntGender,
  type PalCategory,
  type WeightGoalMode,
  calculateIom2005Tdee,
} from "@/lib/opennutri-core";
import { FOOD_DATABASE, type FoodItem as IndianFoodItem } from "@/lib/food-db";

export type EnergyUnit = "kcal" | "kJ";

export type NutritionLogEntry = {
  id: string;
  date: string;
  meal: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  createdAt: number;
};

export interface CustomActivityLog {
  id: string;
  date: string;
  code: string;
  name: string;
  mets: number;
  durationMin: number;
  calories: number;
}

export interface CustomRecipeRecord extends NutriRecipe {
  isCustom?: boolean;
}

export interface FastingSession {
  protocol: "16:8" | "18:6" | "20:4" | "OMAD";
  startedAt: number | null;
}

export const FASTING_PROTOCOLS: Array<{ id: FastingSession["protocol"]; hours: number; label: string }> = [
  { id: "16:8", hours: 16, label: "16h fast · 8h feed" },
  { id: "18:6", hours: 18, label: "18h fast · 6h feed" },
  { id: "20:4", hours: 20, label: "20h fast · 4h feed" },
  { id: "OMAD", hours: 23, label: "23h fast · 1 meal" },
];

export const MEAL_SLOTS = [
  { key: "breakfast", label: "Breakfast", window: "6–10 AM", color: "#FFD166" },
  { key: "lunch", label: "Lunch", window: "12–3 PM", color: "#C9F73A" },
  { key: "snack", label: "Snacks", window: "Anytime", color: "#B49CFF" },
  { key: "dinner", label: "Dinner", window: "6–9 PM", color: "#6EA8FF" },
] as const;

export function inferPer100gFromServing(item: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingGrams?: number;
}): NutrientBreakdownPer100g {
  const grams = Math.max(10, item.servingGrams || 100);
  const f = 100 / grams;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  const cal100 = Math.round(item.calories * f);
  const p100 = r(item.protein);
  const c100 = r(item.carbs);
  const fat100 = r(item.fat);
  return {
    kcal: cal100,
    carbs: c100,
    fat: fat100,
    protein: p100,
    sugars: Math.round(c100 * 0.18 * 10) / 10,
    saturatedFat: Math.round(fat100 * 0.32 * 10) / 10,
    fiber: r(item.fiber ?? Math.max(0.5, c100 * 0.08)),
    monounsaturatedFat: Math.round(fat100 * 0.34 * 10) / 10,
    polyunsaturatedFat: Math.round(fat100 * 0.18 * 10) / 10,
    transFat: 0,
    cholesterol: p100 > 12 ? 32 : 0,
    sodium: 165,
    potassium: Math.round(140 + c100 * 3 + p100 * 4),
    magnesium: Math.round(18 + (item.fiber ?? 2) * 5),
    calcium: Math.round(28 + p100 * 2.5),
    iron: Math.round((0.6 + p100 * 0.06) * 10) / 10,
    zinc: Math.round((0.5 + p100 * 0.05) * 10) / 10,
    phosphorus: Math.round(70 + p100 * 6),
    vitaminA: 12,
    vitaminC: Math.round(c100 * 0.25),
    vitaminD: p100 > 15 ? 0.6 : 0,
    vitaminB6: Math.round((0.08 + p100 * 0.015) * 100) / 100,
    vitaminB12: p100 > 12 ? 0.45 : 0,
    niacin: Math.round((1.0 + p100 * 0.2) * 10) / 10,
  };
}

export function ifctToCatalogItem(food: IndianFoodItem): NutriCatalogItem {
  const photo = resolveFoodPhoto(food.name, food.category);
  const photoId = photo.imageUrl.replace("/nutri-meals/", "").replace(".jpg", "");
  const tags: string[] = [];
  if (food.isHighProtein) tags.push("high-protein");
  if (food.isVegetarian) tags.push("vegetarian");
  if (food.isVegan) tags.push("vegan");
  if (food.barcode) tags.push("barcode");

  return {
    id: `ifct-${food.id}`,
    name: food.name,
    brand: food.brand,
    source: food.barcode ? "product" : "ifct",
    defaultServingGrams: food.servingGrams || 100,
    defaultServingLabel: food.servingUnit,
    photoId,
    imageUrl: photo.imageUrl,
    photoCredit: photo.credit,
    per100g: inferPer100gFromServing(food),
    tags,
    barcode: food.barcode,
  };
}

export function recipeToCatalogItem(recipe: NutriRecipe): NutriCatalogItem {
  const foodById = new Map(ONT_CORE_FOODS.map((f) => [f.id, f]));
  const totalGrams = Math.max(
    50,
    recipe.ingredients.reduce((acc, ing) => acc + ing.grams, 0) / Math.max(1, recipe.servingsCount),
  );

  const zero: NutrientBreakdownPer100g = {
    kcal: 0, carbs: 0, fat: 0, protein: 0, sugars: 0, saturatedFat: 0, fiber: 0,
    monounsaturatedFat: 0, polyunsaturatedFat: 0, transFat: 0, cholesterol: 0,
    sodium: 0, potassium: 0, magnesium: 0, calcium: 0, iron: 0, zinc: 0,
    phosphorus: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB6: 0,
    vitaminB12: 0, niacin: 0,
  };

  for (const ing of recipe.ingredients) {
    const src = foodById.get(ing.foodId);
    if (!src) continue;
    const scaled = scaleNutrients(src.per100g, ing.grams / Math.max(1, recipe.servingsCount));
    (Object.keys(zero) as Array<keyof NutrientBreakdownPer100g>).forEach((k) => {
      zero[k] += scaled[k];
    });
  }

  const to100 = 100 / totalGrams;
  const per100g = {} as NutrientBreakdownPer100g;
  (Object.keys(zero) as Array<keyof NutrientBreakdownPer100g>).forEach((k) => {
    per100g[k] = k === "kcal" ? Math.round(zero[k] * to100) : Math.round(zero[k] * to100 * 10) / 10;
  });

  const resolved = resolveFoodPhoto(recipe.name);
  return {
    id: recipe.id,
    name: recipe.name,
    brand: "Saved Recipe",
    source: "recipe",
    defaultServingGrams: Math.round(totalGrams),
    defaultServingLabel: `1 bowl (${Math.round(totalGrams)}g)`,
    photoId: recipe.photoId,
    imageUrl: recipe.imageUrl || resolved.imageUrl,
    photoCredit: resolved.credit,
    per100g,
    tags: recipe.tags,
  };
}

export function logEntryToCatalogItem(log: NutritionLogEntry): NutriCatalogItem {
  const coreMatch = ONT_CORE_FOODS.find((c) => c.name.toLowerCase() === log.name.toLowerCase());
  if (coreMatch) return coreMatch;
  const ifctMatch = FOOD_DATABASE.find((f) => f.name.toLowerCase() === log.name.toLowerCase());
  if (ifctMatch) return ifctToCatalogItem(ifctMatch);

  const photo = resolveFoodPhoto(log.name);
  const photoId = photo.imageUrl.replace("/nutri-meals/", "").replace(".jpg", "");
  const gramMatch = log.serving.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)/i);
  const servingGrams = gramMatch ? Math.max(20, Math.round(Number(gramMatch[1]))) : 150;

  return {
    id: `log-${log.id}`,
    name: log.name,
    source: log.source === "barcode" ? "product" : "ont_core",
    defaultServingGrams: servingGrams,
    defaultServingLabel: log.serving,
    photoId,
    imageUrl: photo.imageUrl,
    photoCredit: photo.credit,
    per100g: inferPer100gFromServing({
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
      servingGrams,
    }),
  };
}

export function buildUnifiedCatalog(customRecipes: CustomRecipeRecord[]): NutriCatalogItem[] {
  const ifctItems = FOOD_DATABASE.map(ifctToCatalogItem);
  const recipeItems = [...ONT_RECIPES, ...customRecipes].map(recipeToCatalogItem);
  return [...ONT_CORE_FOODS, ...recipeItems, ...ifctItems];
}

export function computeDailyDriSummary(
  dayLogs: NutritionLogEntry[],
  gender: OntGender,
  age: number,
): Array<DriTarget & { actual: number; pct: number }> {
  const targets = getIomDriTable(gender, age);
  const totals: Record<keyof NutrientBreakdownPer100g, number> = {
    kcal: 0, carbs: 0, fat: 0, protein: 0, sugars: 0, saturatedFat: 0, fiber: 0,
    monounsaturatedFat: 0, polyunsaturatedFat: 0, transFat: 0, cholesterol: 0,
    sodium: 0, potassium: 0, magnesium: 0, calcium: 0, iron: 0, zinc: 0,
    phosphorus: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminB6: 0,
    vitaminB12: 0, niacin: 0,
  };

  for (const log of dayLogs) {
    const item = logEntryToCatalogItem(log);
    const scaleFactor = log.calories > 0 && item.per100g.kcal > 0
      ? log.calories / item.per100g.kcal
      : item.defaultServingGrams / 100;
    const scaled = scaleNutrients(item.per100g, scaleFactor * 100);
    (Object.keys(totals) as Array<keyof NutrientBreakdownPer100g>).forEach((k) => {
      totals[k] += scaled[k];
    });
  }

  return targets.map((t) => {
    const actual = Math.round((totals[t.key] ?? 0) * 10) / 10;
    const pct = Math.min(180, Math.round((actual / Math.max(0.1, t.amount)) * 100));
    return { ...t, actual, pct };
  });
}

export function computeGoalTargets(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: OntGender;
  palCategory: PalCategory;
  goalMode: WeightGoalMode;
  weeklyRateKg: number;
}) {
  const tdee = calculateIom2005Tdee(input);
  const dailyDelta = Math.round((input.weeklyRateKg * 7700) / 7);
  const calories = Math.max(
    1200,
    input.goalMode === "lose"
      ? tdee - dailyDelta
      : input.goalMode === "gain"
        ? tdee + dailyDelta
        : tdee,
  );
  const proteinPerKg = input.goalMode === "lose" ? 2.2 : 2.0;
  const protein = Math.round(input.weightKg * proteinPerKg);
  const fat = Math.max(Math.round((calories * 0.22) / 9), Math.round(input.weightKg * 0.8));
  const carbs = Math.max(40, Math.round((calories - protein * 4 - fat * 9) / 4));
  const waterMl = Math.round(input.weightKg * 35 + 500);
  return { tdee, calories, protein, carbs, fat, waterMl };
}

export interface CalendarCell {
  dateKey: string;
  dayNum: number;
  inMonth: boolean;
  calories: number;
  status: "on_target" | "logged" | "empty";
}

export function buildCalendarMonth(
  year: number,
  monthZeroBased: number,
  byDateCalories: Map<string, number>,
  targetCalories: number,
): CalendarCell[] {
  const firstDay = new Date(year, monthZeroBased, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const start = new Date(year, monthZeroBased, 1 - mondayOffset);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cals = byDateCalories.get(key) ?? 0;
    let status: CalendarCell["status"] = "empty";
    if (cals > 0) {
      status = Math.abs(cals - targetCalories) <= targetCalories * 0.16 ? "on_target" : "logged";
    }
    cells.push({
      dateKey: key,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === monthZeroBased,
      calories: cals,
      status,
    });
  }
  return cells;
}

export function parseDateKeyParts(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  return { year: y || 2026, month: (m || 1) - 1, day: d || 1 };
}

export function formatDateKeyNice(dateKey: string): string {
  const { year, month, day } = parseDateKeyParts(dateKey);
  const d = new Date(year, month, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
