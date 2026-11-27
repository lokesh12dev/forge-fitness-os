"use client";

import { useMemo, useState } from "react";
import {
  Bot, Calculator, Check, ChefHat, Clock, Heart, Plus, Search,
  ShoppingCart, Sparkles, Utensils, X,
} from "lucide-react";
import { Card, CardHeader } from "@/components/page-header";
import { Badge, Button } from "@/components/ui";
import { FOOD_DATABASE, type FoodItem } from "@/lib/food-db";
import {
  buildShoppingList,
  calculateMifflinBmr,
  generateNutritionAssistantReply,
  generateWeeklyMealPlan,
  type PlannerAllergy,
  type PlannerBudget,
  type PlannerCuisine,
  type PlannerDiet,
  type PlannerGoal,
} from "@/lib/nutrition-planner";
import {
  ONT_RECIPES,
  calculateIom2005Tdee,
  calculateWhoBmi,
  convertEnergy,
  resolveFoodPhoto,
  scaleNutrients,
  type NutriCatalogItem,
  type NutriRecipe,
  type OntGender,
  type PalCategory,
} from "@/lib/opennutri-core";
import { cn } from "@/lib/utils";
import {
  ifctToCatalogItem,
  recipeToCatalogItem,
  type CustomRecipeRecord,
  type EnergyUnit,
  type NutritionLogEntry,
} from "./nutrition-helpers";

/* ───────────────────────────── FOOD DATABASE EXPLORER ───────────────────────────── */

type DbCategory =
  | "all"
  | "favorites"
  | "recent"
  | "indian"
  | "south_indian"
  | "north_indian"
  | "international"
  | "vegetarian"
  | "non_veg"
  | "vegan"
  | "dairy"
  | "fruit"
  | "vegetable"
  | "grain_bread"
  | "nuts_seeds"
  | "high_protein"
  | "packaged";

export function FoodDatabaseExplorer({
  energyUnit,
  favorites,
  allLogs,
  onToggleFavorite,
  onInspectItem,
  onQuickLog,
  busy,
}: {
  energyUnit: EnergyUnit;
  favorites: string[];
  allLogs: NutritionLogEntry[];
  onToggleFavorite: (id: string) => void;
  onInspectItem: (item: NutriCatalogItem) => void;
  onQuickLog: (item: NutriCatalogItem) => Promise<void>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DbCategory>("all");

  const recentNames = useMemo(
    () => new Set(allLogs.slice(-20).map((l) => l.name.toLowerCase())),
    [allLogs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FOOD_DATABASE.filter((f) => {
      if (category === "favorites" && !favorites.includes(f.id)) return false;
      if (category === "recent" && !recentNames.has(f.name.toLowerCase())) return false;
      if (category === "indian" && f.region === "global") return false;
      if (category === "south_indian" && f.region !== "south_indian") return false;
      if (category === "north_indian" && f.region !== "north_indian") return false;
      if (category === "international" && f.region !== "global") return false;
      if (category === "vegetarian" && !f.isVegetarian) return false;
      if (category === "non_veg" && f.isVegetarian) return false;
      if (category === "vegan" && !f.isVegan) return false;
      if (category === "dairy" && f.category !== "dairy") return false;
      if (category === "fruit" && f.category !== "fruit") return false;
      if (category === "vegetable" && f.category !== "vegetable") return false;
      if (category === "grain_bread" && f.category !== "grain_bread") return false;
      if (category === "nuts_seeds" && f.category !== "nuts_seeds") return false;
      if (category === "high_protein" && !f.isHighProtein) return false;
      if (category === "packaged" && !f.barcode) return false;

      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q)
        || (f.brand?.toLowerCase().includes(q) ?? false)
        || (f.ingredients?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, category, favorites, recentNames]);

  const cats: Array<{ id: DbCategory; label: string }> = [
    { id: "all", label: "All Foods" },
    { id: "favorites", label: `Favorites (${favorites.length})` },
    { id: "recent", label: "Recently Logged" },
    { id: "indian", label: "Indian" },
    { id: "south_indian", label: "South Indian" },
    { id: "north_indian", label: "North Indian" },
    { id: "international", label: "International" },
    { id: "vegetarian", label: "Vegetarian" },
    { id: "non_veg", label: "Non-Veg" },
    { id: "vegan", label: "Vegan" },
    { id: "dairy", label: "Dairy" },
    { id: "fruit", label: "Fruits" },
    { id: "vegetable", label: "Vegetables" },
    { id: "grain_bread", label: "Grains & Bread" },
    { id: "nuts_seeds", label: "Nuts & Seeds" },
    { id: "high_protein", label: "High Protein" },
    { id: "packaged", label: "Packaged" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-mono mb-1">IFCT-2017 · USDA · Brand Labels</p>
            <h3 className="font-display text-2xl font-bold text-chalk">Verified Food Database</h3>
            <p className="mt-1 text-xs text-mist">
              {FOOD_DATABASE.length} Indian &amp; international entries with verified vs estimated source badges, ingredients, and DRI micronutrients.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search idli, dosa, paneer, chicken, oats..."
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-xs text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-[10px] transition",
                category === c.id
                  ? "border-acid/60 bg-acid text-ink font-semibold"
                  : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-xs text-mist">
          No foods matched your current filter or search query. Try clearing filters or searching another dish.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((food: FoodItem) => {
            const photo = resolveFoodPhoto(food.name, food.category);
            const isFav = favorites.includes(food.id);
            const sourceLabel = food.dataSource ?? (food.barcode ? "Label" : "IFCT-2017");
            const catItem = ifctToCatalogItem(food);
            return (
              <div
                key={food.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-panel transition hover:border-acid/40"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
                  <img
                    src={photo.imageUrl}
                    alt={food.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-acid">
                    {convertEnergy(food.calories, energyUnit)} {energyUnit}
                  </span>
                  <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[9px] text-mint">
                    {sourceLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(food.id)}
                    aria-label={isFav ? `Remove ${food.name} from favorites` : `Save ${food.name} to favorites`}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-chalk transition hover:scale-105"
                  >
                    <Heart className={cn("size-3.5", isFav ? "fill-rose text-rose" : "text-mist")} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-semibold leading-snug text-chalk">{food.name}</h4>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-dim">{food.servingUnit}</p>
                  {food.ingredients && (
                    <p className="mt-1.5 line-clamp-2 text-[11px] text-mist">{food.ingredients}</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-[9.5px]">
                    <span className="rounded bg-sky/10 px-1.5 py-0.5 text-sky">{food.protein}g P</span>
                    <span className="rounded bg-amber/10 px-1.5 py-0.5 text-amber">{food.carbs}g C</span>
                    <span className="rounded bg-grape/10 px-1.5 py-0.5 text-grape">{food.fat}g F</span>
                    {typeof food.fiber === "number" && (
                      <span className="rounded bg-mint/10 px-1.5 py-0.5 text-mint">{food.fiber}g Fib</span>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="flex-1 text-[11px]" onClick={() => onInspectItem(catItem)}>
                      Details
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="flex-1 text-[11px]" disabled={busy} onClick={() => onQuickLog(catItem)}>
                      <Plus className="size-3.5" /> Log
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── MEAL PLANNER & RECIPES TAB ───────────────────────────── */

export function PlannerAndRecipesView({
  energyUnit,
  targetCalories,
  customRecipes,
  favorites,
  onToggleFavorite,
  onLogPlannedItem,
  onInspectRecipe,
  onLogRecipe,
  busy,
}: {
  energyUnit: EnergyUnit;
  targetCalories: number;
  customRecipes: CustomRecipeRecord[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onLogPlannedItem: (item: { name: string; meal: string; serving: string; calories: number; protein: number; carbs: number; fat: number }) => Promise<void>;
  onInspectRecipe: (item: NutriCatalogItem) => void;
  onLogRecipe: (item: NutriCatalogItem) => Promise<void>;
  busy: boolean;
}) {
  const [goal, setGoal] = useState<PlannerGoal>("muscle_gain");
  const [diet, setDiet] = useState<PlannerDiet>("omnivore");
  const [cuisine, setCuisine] = useState<PlannerCuisine>("all");
  const [budget, setBudget] = useState<PlannerBudget>("standard");
  const [allergies, setAllergies] = useState<PlannerAllergy[]>([]);
  const [horizon, setHorizon] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [checkedShop, setCheckedShop] = useState<Record<string, boolean>>({});

  // Recipes filter + modal
  const [recipeTag, setRecipeTag] = useState<string>("all");
  const [openRecipe, setOpenRecipe] = useState<NutriRecipe | null>(null);

  const weeklyPlan = useMemo(
    () => generateWeeklyMealPlan({ goal, diet, cuisine, budget, allergies, targetCalories }),
    [goal, diet, cuisine, budget, allergies, targetCalories],
  );

  const shoppingList = useMemo(() => buildShoppingList(weeklyPlan), [weeklyPlan]);

  const allRecipes = useMemo(() => [...ONT_RECIPES, ...customRecipes], [customRecipes]);
  const filteredRecipes = useMemo(() => {
    if (recipeTag === "all") return allRecipes;
    if (recipeTag === "saved") return allRecipes.filter((r) => favorites.includes(r.id));
    return allRecipes.filter((r) => r.tags.includes(recipeTag));
  }, [allRecipes, recipeTag, favorites]);

  function toggleAllergy(a: PlannerAllergy) {
    setAllergies((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  const activeDay = weeklyPlan[activeDayIdx] ?? weeklyPlan[0];

  return (
    <div className="space-y-6">
      {/* Personalized Meal Planner */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-mono mb-1">Adaptive Meal Planning</p>
            <h3 className="font-display text-2xl font-bold text-chalk">Personalized Meal Planner</h3>
            <p className="mt-1 text-xs text-mist">
              Generate daily, weekly, or monthly meal schedules tailored to your goal, diet, regional cuisine, budget, and allergies.
            </p>
          </div>
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(["daily", "weekly", "monthly"] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] uppercase transition",
                  horizon === h ? "bg-acid text-ink font-semibold" : "text-mist hover:text-chalk",
                )}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-mono mb-1 block">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as PlannerGoal)}
              className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="weight_loss">Weight Loss</option>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="maintenance">Maintenance</option>
              <option value="general_fitness">General Fitness</option>
            </select>
          </div>
          <div>
            <label className="label-mono mb-1 block">Diet Preference</label>
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value as PlannerDiet)}
              className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="omnivore">Omnivore (All)</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>
          <div>
            <label className="label-mono mb-1 block">Cuisine Focus</label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value as PlannerCuisine)}
              className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="all">Balanced (Indian + Global)</option>
              <option value="south_indian">South Indian</option>
              <option value="north_indian">North Indian</option>
              <option value="international">International</option>
            </select>
          </div>
          <div>
            <label className="label-mono mb-1 block">Budget Mode</label>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value as PlannerBudget)}
              className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="standard">Standard</option>
              <option value="budget">Budget-Friendly Staples</option>
            </select>
          </div>
        </div>

        {/* Allergies */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-dim mr-1">Exclude allergens:</span>
          {(["dairy", "nuts", "soy", "eggs", "gluten"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergy(a)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] capitalize transition",
                allergies.includes(a)
                  ? "border-flame/50 bg-flame/15 text-flame font-semibold"
                  : "border-white/10 text-mist hover:text-chalk",
              )}
            >
              No {a}
            </button>
          ))}
        </div>

        {/* Horizon View */}
        {horizon === "monthly" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((wk) => {
              const wkCals = Math.round(weeklyPlan.reduce((s, d) => s + d.totals.calories, 0) / 7);
              const wkProt = Math.round(weeklyPlan.reduce((s, d) => s + d.totals.protein, 0) / 7);
              return (
                <div key={wk} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base font-bold text-chalk">Week {wk}</span>
                    <Badge tone="mint">{goal.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-mist">
                    Avg {convertEnergy(wkCals, energyUnit)} {energyUnit}/day · {wkProt}g protein/day
                  </p>
                  <p className="mt-1 text-[11px] text-dim">
                    7-day rotation across {shoppingList.length} ingredients.
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {horizon === "weekly" && (
              <div className="flex flex-wrap gap-1.5">
                {weeklyPlan.map((d, idx) => (
                  <button
                    key={d.dayName}
                    type="button"
                    onClick={() => setActiveDayIdx(idx)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 font-mono text-[10px] transition",
                      activeDayIdx === idx
                        ? "border-acid/60 bg-acid text-ink font-semibold"
                        : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk",
                    )}
                  >
                    {d.dayName.slice(0, 3)} · {convertEnergy(d.totals.calories, energyUnit)}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {activeDay.meals.map((m) => (
                <div key={m.slot} className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <img src={m.imageUrl} alt={m.name} loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[9px] uppercase text-chalk">
                      {m.slotLabel}
                    </span>
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-acid">
                      {convertEnergy(m.calories, energyUnit)} {energyUnit}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="text-xs font-semibold text-chalk line-clamp-2">{m.name}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-dim">{m.servingUnit}</p>
                    <p className="mt-1.5 font-mono text-[9.5px] text-mint">
                      {m.protein}g P · {m.carbs}g C · {m.fat}g F
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-auto pt-0 h-7 w-full text-[10.5px]"
                      disabled={busy}
                      onClick={() =>
                        onLogPlannedItem({
                          name: m.name,
                          meal: m.slot,
                          serving: m.servingUnit,
                          calories: m.calories,
                          protein: m.protein,
                          carbs: m.carbs,
                          fat: m.fat,
                        })
                      }
                    >
                      <Plus className="size-3" /> Log to today
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-Generated Shopping List */}
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-acid">
              <ShoppingCart className="size-3.5" /> Weekly Shopping List ({shoppingList.length} items)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const text = shoppingList.map((s) => `- [ ] ${s.name}: ~${s.totalGrams}g (${s.count} servings)`).join("\n");
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(text).catch(() => {});
                }
              }}
            >
              Copy list
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoppingList.map((item) => (
              <label
                key={item.name}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-panel px-3 py-2 text-xs transition",
                  checkedShop[item.name] && "opacity-50 line-through",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={Boolean(checkedShop[item.name])}
                    onChange={() => setCheckedShop((p) => ({ ...p, [item.name]: !p[item.name] }))}
                    className="accent-acid"
                  />
                  <span className="truncate text-chalk">{item.name}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-mist">{item.totalGrams}g ({item.count}×)</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Recipe Discovery */}
      <Card className="p-5">
        <CardHeader
          label="Curated Performance Kitchen"
          title="Recipe Discovery"
          action={<Badge tone="mint">{filteredRecipes.length} recipes</Badge>}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All Recipes" },
            { id: "saved", label: "Saved Favorites" },
            { id: "high-protein", label: "High Protein" },
            { id: "breakfast", label: "Healthy Breakfasts" },
            { id: "weight-loss", label: "Weight Loss" },
            { id: "muscle-building", label: "Muscle Building" },
            { id: "vegetarian", label: "Vegetarian" },
            { id: "vegan", label: "Vegan" },
            { id: "quick", label: "Quick (<15m)" },
            { id: "budget", label: "Budget Friendly" },
            { id: "indian", label: "Indian" },
            { id: "south-indian", label: "South Indian" },
            { id: "international", label: "International" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRecipeTag(t.id)}
              className={cn(
                "rounded-full border px-3 py-1 font-mono text-[10px] transition",
                recipeTag === t.id
                  ? "border-acid/60 bg-acid text-ink font-semibold"
                  : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((rec) => {
            const catItem = recipeToCatalogItem(rec);
            const scaled = scaleNutrients(catItem.per100g, catItem.defaultServingGrams);
            const isFav = favorites.includes(rec.id);
            const totalMin = (rec.prepTimeMin ?? 5) + (rec.cookTimeMin ?? 10);
            return (
              <div key={rec.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <img src={catItem.imageUrl} alt={rec.name} loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-acid">
                    {convertEnergy(scaled.kcal, energyUnit)} {energyUnit}
                  </span>
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[9.5px] text-chalk">
                    <Clock className="size-3" /> {totalMin} min
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(rec.id)}
                    aria-label={`Favorite ${rec.name}`}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-chalk"
                  >
                    <Heart className={cn("size-3.5", isFav ? "fill-rose text-rose" : "text-mist")} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h4 className="font-display text-base font-bold text-chalk">{rec.name}</h4>
                  <p className="mt-1 line-clamp-2 text-xs text-mist">{rec.description}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1 font-mono text-[9.5px]">
                    <span className="rounded bg-sky/10 px-1.5 py-0.5 text-sky">{Math.round(scaled.protein)}g P</span>
                    <span className="rounded bg-amber/10 px-1.5 py-0.5 text-amber">{Math.round(scaled.carbs)}g C</span>
                    <span className="rounded bg-grape/10 px-1.5 py-0.5 text-grape">{Math.round(scaled.fat)}g F</span>
                  </div>
                  <div className="mt-3 flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setOpenRecipe(rec)}>
                      <ChefHat className="size-3.5" /> Recipe
                    </Button>
                    <Button type="button" size="sm" className="flex-1" disabled={busy} onClick={() => onLogRecipe(catItem)}>
                      <Plus className="size-3.5" /> Log
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recipe Instructions Modal */}
      {openRecipe && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpenRecipe(null)} aria-label="Close recipe" />
          <div className="animate-scale-in relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="label-mono">Prep {openRecipe.prepTimeMin ?? 5}m · Cook {openRecipe.cookTimeMin ?? 10}m · {openRecipe.servingsCount} serving</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-chalk">{openRecipe.name}</h3>
              </div>
              <button onClick={() => setOpenRecipe(null)} className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk">
                <X className="size-4" />
              </button>
            </div>
            <img src={openRecipe.imageUrl} alt={openRecipe.name} className="mb-4 h-44 w-full rounded-2xl object-cover" />
            <p className="text-xs text-mist">{openRecipe.description}</p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="label-mono mb-1.5">Ingredients</p>
                <ul className="space-y-1 text-xs text-chalk">
                  {openRecipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex justify-between border-b border-white/[0.06] py-1">
                      <span>{ing.foodId.replace("ont-", "").replace(/-/g, " ")}</span>
                      <span className="font-mono text-mist">{ing.grams}g</span>
                    </li>
                  ))}
                </ul>
              </div>
              {openRecipe.instructions && (
                <div>
                  <p className="label-mono mb-1.5">Preparation Steps</p>
                  <ol className="list-decimal space-y-1.5 pl-4 text-xs text-mist">
                    {openRecipe.instructions.map((st, idx) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" size="md" className="flex-1" onClick={() => { const item = recipeToCatalogItem(openRecipe); setOpenRecipe(null); onInspectRecipe(item); }}>
                Inspect DRI
              </Button>
              <Button type="button" size="md" className="flex-1" disabled={busy} onClick={async () => { await onLogRecipe(recipeToCatalogItem(openRecipe)); setOpenRecipe(null); }}>
                <Check className="size-4" /> Log Recipe
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── AI NUTRITION ASSISTANT & CALCULATORS ───────────────────────────── */

export function AssistantAndCalculatorsView({
  firstName,
  userProfile,
  totals,
  targets,
  waterMl,
  energyUnit,
  onApplyTargets,
}: {
  firstName: string;
  userProfile: { weightKg: number; heightCm: number; sex: "male" | "female"; age: number };
  totals: { calories: number; protein: number; carbs: number; fat: number };
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  waterMl: number;
  energyUnit: EnergyUnit;
  onApplyTargets: (next: { calories: number; protein: number; carbs: number; fat: number; waterMl: number }) => Promise<void>;
}) {
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: generateNutritionAssistantReply("overview", {
        firstName,
        ...totals,
        targetCalories: targets.calories,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFat: targets.fat,
        waterMl,
        targetWaterMl: targets.waterMl,
        weightKg: userProfile.weightKg,
      }),
    },
  ]);
  const [prompt, setPrompt] = useState("");

  // Calculators state
  const [weightKg, setWeightKg] = useState(userProfile.weightKg);
  const [heightCm, setHeightCm] = useState(userProfile.heightCm);
  const [age, setAge] = useState(userProfile.age);
  const [sex, setSex] = useState<"male" | "female">(userProfile.sex);
  const [pal, setPal] = useState<PalCategory>("active");
  const [goalDelta, setGoalDelta] = useState<-500 | 0 | 300>(0);
  const [saving, setSaving] = useState(false);

  const bmr = useMemo(() => calculateMifflinBmr(weightKg, heightCm, age, sex), [weightKg, heightCm, age, sex]);
  const tdee = useMemo(() => calculateIom2005Tdee({ weightKg, heightCm, age, gender: sex as OntGender, palCategory: pal }), [weightKg, heightCm, age, sex, pal]);
  const bmi = useMemo(() => calculateWhoBmi(weightKg, heightCm), [weightKg, heightCm]);
  const recCalories = Math.max(1200, tdee + goalDelta);
  const recProtein = Math.round(weightKg * 2.0);
  const recFat = Math.round((recCalories * 0.25) / 9);
  const recCarbs = Math.max(50, Math.round((recCalories - recProtein * 4 - recFat * 9) / 4));
  const recWater = Math.round(weightKg * 35 + 400);

  function askAssistant(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const reply = generateNutritionAssistantReply(clean, {
      firstName,
      ...totals,
      targetCalories: targets.calories,
      targetProtein: targets.protein,
      targetCarbs: targets.carbs,
      targetFat: targets.fat,
      waterMl,
      targetWaterMl: targets.waterMl,
      weightKg: userProfile.weightKg,
    });
    setMessages((prev) => [...prev, { role: "user", text: clean }, { role: "assistant", text: reply }]);
    setPrompt("");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* AI Nutrition Assistant */}
      <Card className="flex flex-col p-5 lg:col-span-6">
        <CardHeader
          label="Local Rule-Based Guidance"
          title="Nutrition Assistant"
          action={<Badge tone="sky"><Bot className="mr-1 size-3" /> Educational</Badge>}
        />
        <p className="mt-2 rounded-xl border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[11px] text-mist">
          Educational nutrition guidance only — not a substitute for a qualified dietitian or medical professional. Live LLM responses require configuring an external AI API key.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "How do I hit my protein target?",
            "Suggest Indian meal swaps",
            "How to read a nutrition label?",
            "Check my hydration",
          ].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => askAssistant(q)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-mist transition hover:border-acid/45 hover:text-acid"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="mt-3 flex-1 space-y-2.5 max-h-80 overflow-y-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-line leading-relaxed",
                m.role === "assistant"
                  ? "bg-panel text-chalk border border-white/[0.06]"
                  : "ml-auto max-w-[85%] bg-acid text-ink font-medium",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAssistant(prompt);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about protein, Indian swaps, labels, hydration..."
            className="h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
          />
          <Button type="submit" size="md">
            <Sparkles className="size-3.5" /> Ask
          </Button>
        </form>
      </Card>

      {/* Complete Nutrition Calculators */}
      <Card className="p-5 lg:col-span-6">
        <CardHeader
          label="Mifflin-St Jeor · IOM 2005 · WHO"
          title="Nutrition Calculators"
          action={<Badge tone="mint"><Calculator className="mr-1 size-3" /> Estimates</Badge>}
        />
        <p className="mt-2 text-[11px] text-mist">
          All outputs are mathematical estimates for educational planning — not clinical or medical assessments.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <label className="label-mono mb-1 block">Weight (kg)</label>
            <input type="number" min="35" max="250" value={weightKg} onChange={(e) => setWeightKg(Math.max(35, Number(e.target.value) || 35))} className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-2.5 font-numeric text-xs text-chalk" />
          </div>
          <div>
            <label className="label-mono mb-1 block">Height (cm)</label>
            <input type="number" min="120" max="230" value={heightCm} onChange={(e) => setHeightCm(Math.max(120, Number(e.target.value) || 120))} className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-2.5 font-numeric text-xs text-chalk" />
          </div>
          <div>
            <label className="label-mono mb-1 block">Age</label>
            <input type="number" min="16" max="95" value={age} onChange={(e) => setAge(Math.max(16, Number(e.target.value) || 16))} className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-2.5 font-numeric text-xs text-chalk" />
          </div>
          <div>
            <label className="label-mono mb-1 block">Sex</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")} className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2 text-xs text-chalk">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="label-mono mb-1 block">Activity Level</label>
            <select value={pal} onChange={(e) => setPal(e.target.value as PalCategory)} className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk">
              <option value="sedentary">Sedentary (1.25)</option>
              <option value="low_active">Lightly Active (1.50)</option>
              <option value="active">Active (1.75)</option>
              <option value="very_active">Very Active (2.20)</option>
            </select>
          </div>
          <div>
            <label className="label-mono mb-1 block">Goal Pace</label>
            <select value={goalDelta} onChange={(e) => setGoalDelta(Number(e.target.value) as -500 | 0 | 300)} className="h-9 w-full rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk">
              <option value={-500}>Weight Loss (~0.45 kg/wk)</option>
              <option value={0}>Maintenance</option>
              <option value={300}>Lean Gain (~0.25 kg/wk)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {[
            { label: "BMR (Mifflin)", value: `${convertEnergy(bmr, energyUnit)} ${energyUnit}` },
            { label: "TDEE (IOM 2005)", value: `${convertEnergy(tdee, energyUnit)} ${energyUnit}` },
            { label: "BMI (WHO)", value: `${bmi.bmi} (${bmi.status})` },
            { label: "Daily Target", value: `${convertEnergy(recCalories, energyUnit)} ${energyUnit}` },
            { label: "Macro Split", value: `${recProtein}P / ${recCarbs}C / ${recFat}F` },
            { label: "Water Estimate", value: `${(recWater / 1000).toFixed(2)} L/day` },
          ].map((res) => (
            <div key={res.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="font-mono text-[9.5px] uppercase text-dim">{res.label}</p>
              <p className="mt-1 font-display text-sm font-bold text-chalk">{res.value}</p>
            </div>
          ))}
        </div>

        <Button
          type="button"
          size="md"
          className="mt-4 w-full"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onApplyTargets({ calories: recCalories, protein: recProtein, carbs: recCarbs, fat: recFat, waterMl: recWater });
            } finally {
              setSaving(false);
            }
          }}
        >
          <Utensils className="size-4" /> {saving ? "Saving..." : "Apply Calculated Targets to Dashboard"}
        </Button>
      </Card>
    </div>
  );
}
