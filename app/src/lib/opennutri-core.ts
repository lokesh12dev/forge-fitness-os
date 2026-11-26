/**
 * OpenNutriTracker Scientific Nutrition Engine, Meal Photography Catalog & DRI Tables
 *
 * Implements cited formulas & nutrition tables:
 * - IOM 2005 EER / TDEE equations (male, female, non-binary averaged)
 * - WHO adult BMI classification
 * - IOM 2005 / 2011 / 2019 DRI micronutrient panel (10+ key micronutrients)
 * - 2024 Adult Compendium of Physical Activities (MET burn calculation)
 * - Curated Unsplash meal photography bundled locally in /public/nutri-meals/
 */

export interface NutrientBreakdownPer100g {
  kcal: number;
  carbs: number;
  fat: number;
  protein: number;
  sugars: number;
  saturatedFat: number;
  fiber: number;
  monounsaturatedFat: number;
  polyunsaturatedFat: number;
  transFat: number;
  cholesterol: number; // mg
  sodium: number; // mg
  potassium: number; // mg
  magnesium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  zinc: number; // mg
  phosphorus: number; // mg
  vitaminA: number; // µg
  vitaminC: number; // mg
  vitaminD: number; // µg
  vitaminB6: number; // mg
  vitaminB12: number; // µg
  niacin: number; // mg
}

export interface NutriCatalogItem {
  id: string;
  name: string;
  brand?: string;
  source: "ont_core" | "ifct" | "product" | "recipe";
  defaultServingGrams: number;
  defaultServingLabel: string;
  photoId: string;
  imageUrl: string;
  photoCredit: { name: string; profileUrl: string };
  per100g: NutrientBreakdownPer100g;
  tags?: string[];
  barcode?: string;
}

export interface NutriRecipe {
  id: string;
  name: string;
  description: string;
  servingsCount: number;
  photoId: string;
  imageUrl: string;
  tags: string[];
  ingredients: Array<{ foodId: string; grams: number }>;
}

export interface CompendiumActivity {
  code: string;
  name: string;
  detail: string;
  mets: number;
  category: "conditioning" | "running" | "bicycling" | "sports" | "walking";
}

export interface DriTarget {
  key: keyof NutrientBreakdownPer100g;
  label: string;
  amount: number;
  unit: string;
  basis: "RDA" | "AI" | "UL";
}

export const DEMO_AVATAR = {
  photoId: "1651684215020-f7a5b6610f23",
  imageUrl: "/nutri-meals/alex_demo_avatar.jpg",
  credit: { name: "The Connected Narrative", profileUrl: "https://unsplash.com/@theconnectednarrative" },
} as const;

export const UNSPLASH_CREDITS: Record<string, { name: string; profileUrl: string }> = {
  "1548807371-30dc1bbe6cb5": { name: "Alexandru Acea", profileUrl: "https://unsplash.com/@alexacea" },
  "1593357849627-cbbc9fda6b05": { name: "bady abbas", profileUrl: "https://unsplash.com/@bady" },
  "1552056413-b8b5eed0170b": { name: "Youjeen Cho", profileUrl: "https://unsplash.com/@youjeencho" },
  "1762631934518-f75e233413ca": { name: "joe boshra", profileUrl: "https://unsplash.com/@joestudios" },
  "1571212515416-fef01fc43637": { name: "micheile henderson", profileUrl: "https://unsplash.com/@micheile" },
  "1739785938237-73b3654200d5": { name: "Mitili Mitili", profileUrl: "https://unsplash.com/@mitiliemitili" },
  "1757801333069-f7b3cabaec4a": { name: "Zoshua Colah", profileUrl: "https://unsplash.com/@zoshuacolah" },
  "1627820752174-acae1b399128": { name: "Towfiqu barbhuiya", profileUrl: "https://unsplash.com/@towfiqu999999" },
  "1757332050958-b797a022c910": { name: "Daniel Dan", profileUrl: "https://unsplash.com/@outsideclick" },
  "1567306226416-28f0efdc88ce": { name: "Shelley Pauls", profileUrl: "https://unsplash.com/@shelleypauls" },
  "1646161762904-043f71f256f1": { name: "Mick Haupt", profileUrl: "https://unsplash.com/@rocinante_11" },
};

const mkFood = (
  id: string,
  name: string,
  photoId: string,
  defaultServingGrams: number,
  defaultServingLabel: string,
  n: Partial<NutrientBreakdownPer100g> & { kcal: number; carbs: number; fat: number; protein: number },
  extra?: Partial<NutriCatalogItem>,
): NutriCatalogItem => ({
  id,
  name,
  source: "ont_core",
  defaultServingGrams,
  defaultServingLabel,
  photoId,
  imageUrl: `/nutri-meals/${photoId}.jpg`,
  photoCredit: UNSPLASH_CREDITS[photoId] ?? { name: "Unsplash Contributor", profileUrl: "https://unsplash.com" },
  per100g: {
    kcal: n.kcal,
    carbs: n.carbs,
    fat: n.fat,
    protein: n.protein,
    sugars: n.sugars ?? Math.round(n.carbs * 0.25 * 10) / 10,
    saturatedFat: n.saturatedFat ?? Math.round(n.fat * 0.3 * 10) / 10,
    fiber: n.fiber ?? 2.0,
    monounsaturatedFat: n.monounsaturatedFat ?? Math.round(n.fat * 0.35 * 10) / 10,
    polyunsaturatedFat: n.polyunsaturatedFat ?? Math.round(n.fat * 0.2 * 10) / 10,
    transFat: n.transFat ?? 0,
    cholesterol: n.cholesterol ?? 0,
    sodium: n.sodium ?? 20,
    potassium: n.potassium ?? 180,
    magnesium: n.magnesium ?? 25,
    calcium: n.calcium ?? 20,
    iron: n.iron ?? 0.8,
    zinc: n.zinc ?? 0.6,
    phosphorus: n.phosphorus ?? 110,
    vitaminA: n.vitaminA ?? 0,
    vitaminC: n.vitaminC ?? 0,
    vitaminD: n.vitaminD ?? 0,
    vitaminB6: n.vitaminB6 ?? 0.1,
    vitaminB12: n.vitaminB12 ?? 0,
    niacin: n.niacin ?? 1.2,
  },
  ...extra,
});

export const ONT_CORE_FOODS: NutriCatalogItem[] = [
  mkFood("ont-oatmeal", "Oatmeal", "1548807371-30dc1bbe6cb5", 100, "100 g cooked", {
    kcal: 150, carbs: 27, fat: 3, protein: 5, fiber: 4, sugars: 1,
    monounsaturatedFat: 1.0, polyunsaturatedFat: 1.1, saturatedFat: 0.5,
    sodium: 6, potassium: 143, magnesium: 63, calcium: 21, iron: 1.7, zinc: 1.3,
    phosphorus: 180, vitaminB6: 0.05, niacin: 0.4,
  }),
  mkFood("ont-brown-rice", "Brown rice", "1593357849627-cbbc9fda6b05", 150, "150 g cooked", {
    kcal: 123, carbs: 26, fat: 1, protein: 3, fiber: 1.8, sugars: 0.4,
    monounsaturatedFat: 0.3, polyunsaturatedFat: 0.3, saturatedFat: 0.2,
    sodium: 5, potassium: 86, magnesium: 43, calcium: 10, iron: 0.5, zinc: 0.6,
    phosphorus: 83, vitaminB6: 0.15, niacin: 1.5,
  }),
  mkFood("ont-wholegrain-bread", "Wholegrain bread", "1552056413-b8b5eed0170b", 80, "2 slices (80 g)", {
    kcal: 265, carbs: 49, fat: 3.5, protein: 9, fiber: 7, sugars: 4.5,
    monounsaturatedFat: 0.4, polyunsaturatedFat: 1.2, saturatedFat: 0.7,
    sodium: 400, potassium: 230, magnesium: 65, calcium: 100, iron: 2.5, zinc: 1.5,
    phosphorus: 200, vitaminB6: 0.1, niacin: 4.0,
  }),
  mkFood("ont-chicken-breast", "Chicken breast", "1762631934518-f75e233413ca", 150, "150 g grilled", {
    kcal: 165, carbs: 0, fat: 3.6, protein: 31, fiber: 0, sugars: 0,
    saturatedFat: 1.0, monounsaturatedFat: 1.24, polyunsaturatedFat: 0.8, cholesterol: 85,
    sodium: 74, potassium: 256, magnesium: 29, calcium: 15, iron: 1.0, zinc: 1.0,
    phosphorus: 220, vitaminB6: 0.6, vitaminB12: 0.3, niacin: 13.7,
  }),
  mkFood("ont-greek-yogurt", "Greek yogurt", "1571212515416-fef01fc43637", 200, "200 g bowl", {
    kcal: 59, carbs: 3.6, fat: 0.4, protein: 10, fiber: 0, sugars: 3.6,
    cholesterol: 5, monounsaturatedFat: 0.1, sodium: 36, potassium: 141, magnesium: 11,
    calcium: 110, iron: 0.05, zinc: 0.5, phosphorus: 135, vitaminB6: 0.05, vitaminB12: 0.5,
  }),
  mkFood("ont-salmon", "Salmon fillet", "1739785938237-73b3654200d5", 160, "1 fillet (160 g)", {
    kcal: 208, carbs: 0, fat: 13, protein: 20, fiber: 0, sugars: 0,
    saturatedFat: 3.1, monounsaturatedFat: 3.8, polyunsaturatedFat: 3.9, cholesterol: 55,
    sodium: 59, potassium: 363, magnesium: 27, calcium: 9, iron: 0.3, zinc: 0.4,
    phosphorus: 240, vitaminD: 11, vitaminB12: 3.2, niacin: 8.0,
  }),
  mkFood("ont-olive-oil", "Olive oil", "1757801333069-f7b3cabaec4a", 15, "1 tbsp (15 g)", {
    kcal: 884, carbs: 0, fat: 100, protein: 0, fiber: 0, sugars: 0,
    saturatedFat: 14, monounsaturatedFat: 73, polyunsaturatedFat: 11,
    sodium: 2, potassium: 1, magnesium: 0, calcium: 1, iron: 0.56,
  }),
  mkFood("ont-almonds", "Almonds", "1627820752174-acae1b399128", 100, "100 g", {
    kcal: 579, carbs: 22, fat: 50, protein: 21, fiber: 12.5, sugars: 6.6,
    saturatedFat: 3.8, monounsaturatedFat: 31, polyunsaturatedFat: 12,
    sodium: 1, potassium: 733, magnesium: 270, calcium: 269, iron: 3.7, zinc: 3.1,
    phosphorus: 481, vitaminB6: 0.14, niacin: 3.6,
  }),
  mkFood("ont-banana", "Banana", "1757332050958-b797a022c910", 120, "1 medium (120 g)", {
    kcal: 89, carbs: 23, fat: 0.3, protein: 1.1, sugars: 12, fiber: 2.6,
    sodium: 1, potassium: 358, magnesium: 27, calcium: 5, iron: 0.26, zinc: 0.15,
    phosphorus: 22, vitaminB6: 0.37, vitaminC: 8.7, niacin: 0.7,
  }),
  mkFood("ont-apple", "Apple", "1567306226416-28f0efdc88ce", 150, "1 medium (150 g)", {
    kcal: 52, carbs: 14, fat: 0.2, protein: 0.3, sugars: 10, fiber: 2.4,
    sodium: 1, potassium: 107, magnesium: 5, calcium: 6, iron: 0.12, vitaminC: 4.6, niacin: 0.09,
  }),
  mkFood("ont-broccoli", "Broccoli", "1646161762904-043f71f256f1", 120, "120 g steamed", {
    kcal: 35, carbs: 7, fat: 0.4, protein: 2.4, fiber: 3.3, sugars: 1.7,
    sodium: 33, potassium: 316, magnesium: 21, calcium: 47, iron: 0.7, zinc: 0.4,
    phosphorus: 66, vitaminA: 31, vitaminC: 89, vitaminB6: 0.18, niacin: 0.6,
  }),
];

export const ONT_RECIPES: NutriRecipe[] = [
  {
    id: "rcp-power-bowl",
    name: "Protein Power Bowl",
    description: "Grilled chicken breast over fluffy brown rice, meal-prep ready.",
    servingsCount: 1,
    photoId: "1762631934518-f75e233413ca",
    imageUrl: "/nutri-meals/1762631934518-f75e233413ca.jpg",
    tags: ["high-protein"],
    ingredients: [
      { foodId: "ont-chicken-breast", grams: 180 },
      { foodId: "ont-brown-rice", grams: 160 },
    ],
  },
  {
    id: "rcp-salmon-greens",
    name: "Salmon & Greens Bowl",
    description: "Pan-seared salmon with steamed broccoli and brown rice — omega-3 rich.",
    servingsCount: 1,
    photoId: "1739785938237-73b3654200d5",
    imageUrl: "/nutri-meals/1739785938237-73b3654200d5.jpg",
    tags: ["omega-3", "high-protein"],
    ingredients: [
      { foodId: "ont-salmon", grams: 160 },
      { foodId: "ont-brown-rice", grams: 140 },
      { foodId: "ont-broccoli", grams: 100 },
    ],
  },
  {
    id: "rcp-oat-bowl",
    name: "Morning Oat Bowl",
    description: "Oatmeal topped with fresh sliced banana and raw almonds.",
    servingsCount: 1,
    photoId: "1548807371-30dc1bbe6cb5",
    imageUrl: "/nutri-meals/1548807371-30dc1bbe6cb5.jpg",
    tags: ["breakfast", "vegetarian"],
    ingredients: [
      { foodId: "ont-oatmeal", grams: 180 },
      { foodId: "ont-banana", grams: 100 },
      { foodId: "ont-almonds", grams: 20 },
    ],
  },
  {
    id: "rcp-yogurt-parfait",
    name: "Greek Yogurt Parfait",
    description: "Creamy Greek yogurt layered with crisp banana and crushed almonds.",
    servingsCount: 1,
    photoId: "1571212515416-fef01fc43637",
    imageUrl: "/nutri-meals/1571212515416-fef01fc43637.jpg",
    tags: ["breakfast", "high-protein"],
    ingredients: [
      { foodId: "ont-greek-yogurt", grams: 200 },
      { foodId: "ont-banana", grams: 80 },
      { foodId: "ont-almonds", grams: 15 },
    ],
  },
];

export const ONT_COMPENDIUM_ACTIVITIES: CompendiumActivity[] = [
  { code: "02055", name: "Resistance training", detail: "Vigorous effort, powerlifting or bodybuilding", mets: 6.0, category: "conditioning" },
  { code: "03015", name: "Aerobic conditioning", detail: "General studio cardio", mets: 7.3, category: "conditioning" },
  { code: "12150", name: "Running, general", detail: "2024 Compendium outdoor pace", mets: 8.3, category: "running" },
  { code: "12180", name: "Treadmill running", detail: "General pace / incline", mets: 8.0, category: "running" },
  { code: "01015", name: "Bicycling, moderate", detail: "Flat terrain or road ride", mets: 7.5, category: "bicycling" },
  { code: "02068", name: "Rope skipping", detail: "Vigorous jump rope intervals", mets: 12.3, category: "conditioning" },
  { code: "02080", name: "Rowing machine", detail: "Moderate continuous effort", mets: 7.0, category: "conditioning" },
  { code: "02214", name: "HIIT / Tabata", detail: "Burpees, circuits, vigorous intervals", mets: 11.0, category: "conditioning" },
  { code: "02095", name: "Stair-treadmill climb", detail: "Steady climb", mets: 9.0, category: "conditioning" },
  { code: "02160", name: "Yoga / Mobility flow", detail: "Hatha / general flow", mets: 3.0, category: "conditioning" },
  { code: "15030", name: "Badminton", detail: "Social singles & doubles", mets: 5.5, category: "sports" },
  { code: "15055", name: "Basketball", detail: "Full court / half court", mets: 6.0, category: "sports" },
  { code: "15110", name: "Boxing (heavy bag)", detail: "Punching bag rounds", mets: 5.5, category: "sports" },
  { code: "15150", name: "Cricket", detail: "Batting, bowling, fielding", mets: 4.8, category: "sports" },
  { code: "17190", name: "Brisk walking", detail: "5.5 km/h outdoor walk", mets: 4.3, category: "walking" },
];

export const MEAL_PATTERNS = [
  { id: "standard", label: "Standard", shares: { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 } },
  { id: "mediterranean", label: "Mediterranean", shares: { breakfast: 0.2, lunch: 0.4, dinner: 0.3, snack: 0.1 } },
  { id: "five-small", label: "Five-small", shares: { breakfast: 0.2, lunch: 0.25, dinner: 0.25, snack: 0.3 } },
  { id: "two-meal", label: "Two-meal", shares: { breakfast: 0.0, lunch: 0.5, dinner: 0.5, snack: 0.0 } },
  { id: "omad", label: "OMAD", shares: { breakfast: 0.0, lunch: 0.0, dinner: 1.0, snack: 0.0 } },
] as const;

export type PalCategory = "sedentary" | "low_active" | "active" | "very_active";
export type OntGender = "male" | "female" | "non_binary";
export type WeightGoalMode = "lose" | "maintain" | "gain";

export function getPalFactor(category: PalCategory): number {
  switch (category) {
    case "sedentary": return 1.25;
    case "low_active": return 1.5;
    case "active": return 1.75;
    case "very_active": return 2.2;
  }
}

function getIomPa(pal: number, isMale: boolean): number {
  if (pal < 1.4) return 1.0;
  if (pal < 1.6) return isMale ? 1.12 : 1.14;
  if (pal < 1.9) return 1.27;
  return isMale ? 1.54 : 1.45;
}

/**
 * IOM 2005 EER / TDEE Equations (Institute of Medicine, p. 204).
 */
export function calculateIom2005Tdee(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: OntGender;
  palCategory: PalCategory;
}): number {
  const pal = getPalFactor(input.palCategory);
  const heightM = input.heightCm / 100;
  const male = 864 - 9.72 * input.age + getIomPa(pal, true) * (14.2 * input.weightKg + 503 * heightM);
  const female = 387 - 7.31 * input.age + getIomPa(pal, false) * (10.9 * input.weightKg + 660.7 * heightM);
  if (input.gender === "male") return Math.round(male);
  if (input.gender === "female") return Math.round(female);
  return Math.round((male + female) / 2);
}

/**
 * WHO Adult BMI & Risk Classification.
 */
export function calculateWhoBmi(weightKg: number, heightCm: number): {
  bmi: number;
  status: string;
  tone: "mint" | "amber" | "flame" | "sky";
} {
  const hM = Math.max(0.8, heightCm / 100);
  const bmi = Math.round((weightKg / (hM * hM)) * 10) / 10;
  if (bmi < 18.5) return { bmi, status: "Underweight", tone: "sky" };
  if (bmi < 25.0) return { bmi, status: "Normal weight", tone: "mint" };
  if (bmi < 30.0) return { bmi, status: "Pre-obesity", tone: "amber" };
  if (bmi < 35.0) return { bmi, status: "Obesity class I", tone: "flame" };
  return { bmi, status: "Obesity class II+", tone: "flame" };
}

/**
 * 2024 Compendium formula: kcal = MET × weightKg × (durationMin / 60).
 */
export function calculateMetBurnedKcal(mets: number, weightKg: number, durationMin: number): number {
  return Math.round(mets * weightKg * (durationMin / 60));
}

export function convertEnergy(kcal: number, unit: "kcal" | "kJ"): number {
  return unit === "kJ" ? Math.round(kcal * 4.184) : Math.round(kcal);
}

/**
 * IOM 2005 / 2011 / 2019 DRI Reference Intakes for Adults.
 */
export function getIomDriTable(gender: OntGender, age: number): DriTarget[] {
  const over50 = age >= 51;
  const over70 = age >= 71;
  const pick = (m: number, f: number) => (gender === "male" ? m : gender === "female" ? f : (m + f) / 2);

  return [
    { key: "fiber", label: "Fiber", amount: pick(over50 ? 30 : 38, over50 ? 21 : 25), unit: "g", basis: "AI" },
    { key: "sodium", label: "Sodium", amount: 2300, unit: "mg", basis: "UL" },
    { key: "potassium", label: "Potassium", amount: pick(3400, 2600), unit: "mg", basis: "AI" },
    { key: "calcium", label: "Calcium", amount: over70 ? 1200 : pick(1000, over50 ? 1200 : 1000), unit: "mg", basis: "RDA" },
    { key: "iron", label: "Iron", amount: pick(8, over50 ? 8 : 18), unit: "mg", basis: "RDA" },
    { key: "magnesium", label: "Magnesium", amount: pick(age >= 31 ? 420 : 400, age >= 31 ? 320 : 310), unit: "mg", basis: "RDA" },
    { key: "vitaminD", label: "Vitamin D", amount: over70 ? 20 : 15, unit: "µg", basis: "RDA" },
    { key: "vitaminB12", label: "Vitamin B12", amount: 2.4, unit: "µg", basis: "RDA" },
    { key: "vitaminC", label: "Vitamin C", amount: pick(90, 75), unit: "mg", basis: "RDA" },
    { key: "zinc", label: "Zinc", amount: pick(11, 8), unit: "mg", basis: "RDA" },
  ];
}

export function resolveFoodPhoto(foodName: string, category?: string): {
  imageUrl: string;
  credit: { name: string; profileUrl: string };
} {
  const low = foodName.toLowerCase();
  let photoId = "1593357849627-cbbc9fda6b05";
  if (low.includes("oat") || low.includes("poha") || low.includes("daliya") || low.includes("cereal")) photoId = "1548807371-30dc1bbe6cb5";
  else if (low.includes("bread") || low.includes("roti") || low.includes("chapati") || low.includes("paratha") || low.includes("toast")) photoId = "1552056413-b8b5eed0170b";
  else if (low.includes("chicken") || low.includes("egg") || low.includes("biryani") || low.includes("meat") || low.includes("tuna")) photoId = "1762631934518-f75e233413ca";
  else if (low.includes("yogurt") || low.includes("curd") || low.includes("paneer") || low.includes("lassi") || low.includes("milk") || low.includes("whey") || low.includes("cheese") || low.includes("tofu") || category === "dairy" || category === "supplement") photoId = "1571212515416-fef01fc43637";
  else if (low.includes("salmon") || low.includes("fish")) photoId = "1739785938237-73b3654200d5";
  else if (low.includes("oil") || low.includes("ghee") || low.includes("butter")) photoId = "1757801333069-f7b3cabaec4a";
  else if (low.includes("almond") || low.includes("peanut") || low.includes("walnut") || low.includes("chia") || low.includes("nut")) photoId = "1627820752174-acae1b399128";
  else if (low.includes("banana")) photoId = "1757332050958-b797a022c910";
  else if (low.includes("apple") || low.includes("berry") || low.includes("fruit")) photoId = "1567306226416-28f0efdc88ce";
  else if (low.includes("broccoli") || low.includes("palak") || low.includes("sabzi") || low.includes("greens") || low.includes("salad") || low.includes("veg")) photoId = "1646161762904-043f71f256f1";
  else if (low.includes("rice") || low.includes("dal") || low.includes("rajma") || low.includes("chana") || low.includes("sambar") || low.includes("idli")) photoId = "1593357849627-cbbc9fda6b05";

  return {
    imageUrl: `/nutri-meals/${photoId}.jpg`,
    credit: UNSPLASH_CREDITS[photoId] ?? { name: "Unsplash Contributor", profileUrl: "https://unsplash.com" },
  };
}

export function scaleNutrients(per100g: NutrientBreakdownPer100g, grams: number): NutrientBreakdownPer100g {
  const f = Math.max(0, grams) / 100;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return {
    kcal: Math.round(per100g.kcal * f),
    carbs: r(per100g.carbs),
    fat: r(per100g.fat),
    protein: r(per100g.protein),
    sugars: r(per100g.sugars),
    saturatedFat: r(per100g.saturatedFat),
    fiber: r(per100g.fiber),
    monounsaturatedFat: r(per100g.monounsaturatedFat),
    polyunsaturatedFat: r(per100g.polyunsaturatedFat),
    transFat: r(per100g.transFat),
    cholesterol: r(per100g.cholesterol),
    sodium: r(per100g.sodium),
    potassium: r(per100g.potassium),
    magnesium: r(per100g.magnesium),
    calcium: r(per100g.calcium),
    iron: r(per100g.iron),
    zinc: r(per100g.zinc),
    phosphorus: r(per100g.phosphorus),
    vitaminA: r(per100g.vitaminA),
    vitaminC: r(per100g.vitaminC),
    vitaminD: r(per100g.vitaminD),
    vitaminB6: r(per100g.vitaminB6),
    vitaminB12: r(per100g.vitaminB12),
    niacin: r(per100g.niacin),
  };
}
