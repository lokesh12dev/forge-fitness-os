"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Bot, CalendarDays, Camera, Check, ChefHat, Coffee, Cookie, Copy, Database, Droplets,
  Flame, Info, Loader2, Moon, Pencil, Plus, RotateCcw, Scale, ScanLine, Share2, Sparkles,
  Sun, Target, Timer, Trash2, TrendingUp, User, Utensils, Zap,
} from "lucide-react";
import { addWater, deleteFood, logFood, quickLogWeight, updateTargets } from "@/app/actions";
import { Ring } from "@/components/charts";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import { PhotoMealScanner } from "@/components/photo-meal-scanner";
import { Badge, Button, ProgressBar } from "@/components/ui";
import { FOOD_DATABASE } from "@/lib/food-db";
import { hitRemainingProtein } from "@/lib/nutrition-engine";
import {
  buildNutritionInsights,
  computeDailyNutritionScore,
} from "@/lib/nutrition-planner";
import {
  MEAL_PATTERNS,
  ONT_COMPENDIUM_ACTIVITIES,
  ONT_CORE_FOODS,
  calculateMetBurnedKcal,
  convertEnergy,
  resolveFoodPhoto,
  scaleNutrients,
  type NutriCatalogItem,
  type OntGender,
} from "@/lib/opennutri-core";
import { cn } from "@/lib/utils";
import {
  FASTING_PROTOCOLS,
  MEAL_SLOTS,
  computeDailyDriSummary,
  formatDateKeyNice,
  ifctToCatalogItem,
  logEntryToCatalogItem,
  type CustomActivityLog,
  type CustomRecipeRecord,
  type EnergyUnit,
  type FastingSession,
  type NutritionLogEntry,
} from "./nutrition/nutrition-helpers";
import {
  AddFoodSheet,
  CitationsSheet,
  FoodDetailSheet,
  TargetsSheet,
} from "./nutrition/nutrition-sheets";
import {
  DiaryTabView,
  TrendsTabView,
  YouRecipesTabView,
} from "./nutrition/nutrition-tabs";
import {
  AssistantAndCalculatorsView,
  FoodDatabaseExplorer,
  PlannerAndRecipesView,
} from "./nutrition/nutrition-explorer";
import { ModuleAiCoach } from "@/components/ai/module-ai-coach";

export type NutritionLogView = NutritionLogEntry;

type Props = {
  firstName: string;
  dateLabel: string;
  todayKey: string;
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  totals: { calories: number; protein: number; carbs: number; fat: number };
  logs: NutritionLogEntry[];
  allLogs: NutritionLogEntry[];
  waterMl: number;
  waterByDate: Record<string, number>;
  burned: number;
  burnedByDate: Record<string, number>;
  streak: number;
  week: Array<{ key: string; label: string; calories: number; protein: number; carbs: number; fat: number }>;
  dailyHistory: Array<{
    key: string;
    label: string;
    shortDate: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    waterMl: number;
    burned: number;
  }>;
  weightHistory: Array<{ date: string; weightKg: number }>;
  userProfile?: { weightKg: number; heightCm: number; sex: "male" | "female"; age: number };
};

type MainTab = "home" | "database" | "planner" | "assistant" | "diary" | "trends" | "you";

const MEAL_ICONS: Record<(typeof MEAL_SLOTS)[number]["key"], typeof Coffee> = {
  breakfast: Coffee,
  morning_snack: Sparkles,
  lunch: Sun,
  evening_snack: Cookie,
  dinner: Moon,
  snack: Utensils,
};

const SOURCE_BADGE: Record<string, { label: string; tone: "acid" | "sky" | "mint" | "grape" | "neutral" }> = {
  photo: { label: "Photo", tone: "grape" },
  barcode: { label: "Barcode", tone: "sky" },
  voice: { label: "Voice", tone: "mint" },
  recipe: { label: "Recipe", tone: "acid" },
  manual: { label: "Logged", tone: "neutral" },
};

const STORAGE_KEYS = {
  unit: "forge_nutri_energy_unit",
  fasting: "forge_nutri_fasting",
  recipes: "forge_nutri_custom_recipes",
  activities: "forge_nutri_activities",
  pattern: "forge_nutri_meal_pattern",
  favorites: "forge_nutri_favorites",
  theme: "forge_nutri_theme",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function NutritionClient({
  firstName,
  dateLabel,
  todayKey,
  targets,
  totals,
  logs,
  allLogs,
  waterMl,
  waterByDate,
  burned,
  burnedByDate,
  streak,
  dailyHistory,
  weightHistory,
  userProfile = { weightKg: 72, heightCm: 175, sex: "male", age: 26 },
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>("kcal");
  const [mealPatternId, setMealPatternId] = useState<string>("standard");

  // Modals & sheets
  const [addFoodMeal, setAddFoodMeal] = useState<string | null>(null);
  const [addFoodDate, setAddFoodDate] = useState<string>(todayKey);
  const [inspectedItem, setInspectedItem] = useState<{ item: NutriCatalogItem; meal: string; targetDate: string } | null>(null);
  const [showTargetsSheet, setShowTargetsSheet] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showPhotoScanner, setShowPhotoScanner] = useState(false);

  // Interactive widgets state
  const [busy, setBusy] = useState(false);
  const [waterPending, startWater] = useTransition();
  const [proteinFilter, setProteinFilter] = useState<"all" | "veg" | "vegan">("all");
  const [catalogCategory, setCatalogCategory] = useState<"all" | "protein" | "indian" | "carbs" | "fats">("all");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customWaterMl, setCustomWaterMl] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ serving: "", calories: "", protein: "", carbs: "", fat: "" });
  const [weightInput, setWeightInput] = useState(String(userProfile.weightKg));
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);

  // Fasting timer (hydrated cleanly in useEffect)
  const [fasting, setFasting] = useState<FastingSession>({ protocol: "16:8", startedAt: null });
  const [nowMs, setNowMs] = useState<number>(0);
  const [showFastingNote, setShowFastingNote] = useState(false);

  // Custom recipes & 2024 Compendium MET activity logs (hydrated cleanly in useEffect)
  const [customRecipes, setCustomRecipes] = useState<CustomRecipeRecord[]>([]);
  const [activities, setActivities] = useState<CustomActivityLog[]>([]);
  const [selectedActivityCode, setSelectedActivityCode] = useState(ONT_COMPENDIUM_ACTIVITIES[0].code);
  const [activityDurationMin, setActivityDurationMin] = useState(45);

  const [targetForm, setTargetForm] = useState({
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbs: String(targets.carbs),
    fat: String(targets.fat),
    waterMl: String(targets.waterMl),
  });

  // Hydrate persisted client preferences safely post-mount
  useEffect(() => {
    try {
      const savedUnit = localStorage.getItem(STORAGE_KEYS.unit);
      if (savedUnit === "kJ" || savedUnit === "kcal") setEnergyUnit(savedUnit);
      const savedFast = localStorage.getItem(STORAGE_KEYS.fasting);
      if (savedFast) setFasting(JSON.parse(savedFast) as FastingSession);
      const savedRec = localStorage.getItem(STORAGE_KEYS.recipes);
      if (savedRec) setCustomRecipes(JSON.parse(savedRec) as CustomRecipeRecord[]);
      const savedAct = localStorage.getItem(STORAGE_KEYS.activities);
      if (savedAct) setActivities(JSON.parse(savedAct) as CustomActivityLog[]);
      const savedPat = localStorage.getItem(STORAGE_KEYS.pattern);
      if (savedPat) setMealPatternId(savedPat);
      const savedFav = localStorage.getItem(STORAGE_KEYS.favorites);
      if (savedFav) setFavorites(JSON.parse(savedFav) as string[]);
      const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
      if (savedTheme === "light" || savedTheme === "dark") setThemeMode(savedTheme);
    } catch {
      // Ignore storage read errors in constrained contexts
    }
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!fasting.startedAt) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [fasting.startedAt]);

  function saveEnergyUnit(u: EnergyUnit) {
    setEnergyUnit(u);
    try {
      localStorage.setItem(STORAGE_KEYS.unit, u);
    } catch {}
  }

  function saveMealPattern(id: string) {
    setMealPatternId(id);
    try {
      localStorage.setItem(STORAGE_KEYS.pattern, id);
    } catch {}
  }

  function toggleThemeMode() {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next);
    } catch {}
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function toggleFast() {
    const next: FastingSession = fasting.startedAt
      ? { ...fasting, startedAt: null }
      : { ...fasting, startedAt: Date.now() };
    setFasting(next);
    setNowMs(Date.now());
    try {
      localStorage.setItem(STORAGE_KEYS.fasting, JSON.stringify(next));
    } catch {}
  }

  function setFastProtocol(protocol: FastingSession["protocol"]) {
    const next = { ...fasting, protocol };
    setFasting(next);
    try {
      localStorage.setItem(STORAGE_KEYS.fasting, JSON.stringify(next));
    } catch {}
  }

  function addCustomRecipe(rec: CustomRecipeRecord) {
    setCustomRecipes((prev) => {
      const next = [rec, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function deleteCustomRecipe(id: string) {
    setCustomRecipes((prev) => {
      const next = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function handleAddMetActivity() {
    const act = ONT_COMPENDIUM_ACTIVITIES.find((a) => a.code === selectedActivityCode);
    if (!act) return;
    const kcal = calculateMetBurnedKcal(act.mets, userProfile.weightKg, activityDurationMin);
    const entry: CustomActivityLog = {
      id: `act-${Date.now()}`,
      date: todayKey,
      code: act.code,
      name: act.name,
      mets: act.mets,
      durationMin: activityDurationMin,
      calories: kcal,
    };
    setActivities((prev) => {
      const next = [entry, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.activities, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function removeMetActivity(id: string) {
    setActivities((prev) => {
      const next = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.activities, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Server action wrappers
  async function persistFoodLog(data: {
    name: string;
    meal: string;
    serving: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source: string;
    date: string;
  }) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("name", data.name);
      fd.set("meal", data.meal);
      fd.set("serving", data.serving);
      fd.set("calories", String(Math.round(data.calories)));
      fd.set("protein", String(Math.round(data.protein * 10) / 10));
      fd.set("carbs", String(Math.round(data.carbs * 10) / 10));
      fd.set("fat", String(Math.round(data.fat * 10) / 10));
      fd.set("source", data.source);
      fd.set("date", data.date);
      await logFood(fd);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logCatalogItem(item: NutriCatalogItem, grams: number, meal: string, label?: string, date = addFoodDate) {
    const scaled = scaleNutrients(item.per100g, grams);
    await persistFoodLog({
      name: item.name,
      meal,
      serving: label || `${grams}g`,
      calories: scaled.kcal,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      source: item.source === "product" ? "barcode" : item.source === "recipe" ? "recipe" : "manual",
      date,
    });
    setInspectedItem(null);
    setAddFoodMeal(null);
  }

  function handleWaterAction(ml: number, targetDate = todayKey) {
    startWater(async () => {
      await addWater(ml, targetDate);
      router.refresh();
    });
  }

  async function handleWeightSave() {
    const val = Number(weightInput);
    if (!val || val < 30 || val > 300 || weightSaving) return;
    setWeightSaving(true);
    try {
      await quickLogWeight(val);
      setEditingWeight(false);
      router.refresh();
    } finally {
      setWeightSaving(false);
    }
  }

  async function handleSaveTargetForm(vals: { calories: number; protein: number; carbs: number; fat: number; waterMl: number }) {
    const fd = new FormData();
    fd.set("calories", String(vals.calories));
    fd.set("protein", String(vals.protein));
    fd.set("carbs", String(vals.carbs));
    fd.set("fat", String(vals.fat));
    fd.set("waterMl", String(vals.waterMl));
    await updateTargets(fd);
    router.refresh();
  }

  async function submitTargetsForm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await handleSaveTargetForm({
        calories: Number(targetForm.calories) || 2800,
        protein: Number(targetForm.protein) || 180,
        carbs: Number(targetForm.carbs) || 300,
        fat: Number(targetForm.fat) || 80,
        waterMl: Number(targetForm.waterMl) || 3500,
      });
      setShowTargetsSheet(false);
    } finally {
      setBusy(false);
    }
  }

  // Computed metrics for Home
  const todayActivities = useMemo(() => activities.filter((a) => a.date === todayKey), [activities, todayKey]);
  const extraBurned = useMemo(() => todayActivities.reduce((s, a) => s + a.calories, 0), [todayActivities]);
  const totalBurnedToday = burned + extraBurned;
  const effectiveGoalKcal = targets.calories + extraBurned;
  const remainingCal = effectiveGoalKcal - totals.calories;
  const remainingProtein = Math.max(0, targets.protein - totals.protein);
  const calPct = Math.min(100, Math.round((totals.calories / Math.max(1, effectiveGoalKcal)) * 100));

  const mergedBurnedByDate = useMemo(() => {
    const map: Record<string, number> = { ...burnedByDate };
    for (const a of activities) {
      map[a.date] = (map[a.date] ?? 0) + a.calories;
    }
    return map;
  }, [burnedByDate, activities]);

  const activePattern = useMemo(
    () => MEAL_PATTERNS.find((p) => p.id === mealPatternId) ?? MEAL_PATTERNS[0],
    [mealPatternId],
  );

  const smartProteinSuggestions = useMemo(
    () =>
      hitRemainingProtein(remainingProtein, Math.max(250, remainingCal), {
        vegetarianOnly: proteinFilter === "veg",
        veganOnly: proteinFilter === "vegan",
        maxResults: 4,
      }),
    [remainingProtein, remainingCal, proteinFilter],
  );

  const catalogItems = useMemo(() => {
    const indianPicks = FOOD_DATABASE.filter((f) => f.isHighProtein).slice(0, 6).map(ifctToCatalogItem);
    const coreIds = new Set(ONT_CORE_FOODS.map((f) => f.id));
    return [...ONT_CORE_FOODS, ...indianPicks.filter((i) => !coreIds.has(i.id))];
  }, []);

  const filteredCatalogFoods = useMemo(() => {
    if (catalogCategory === "all") return catalogItems.slice(0, 10);
    return catalogItems.filter((item) => {
      const { protein, carbs, fat } = item.per100g;
      if (catalogCategory === "protein") return protein >= 10;
      if (catalogCategory === "indian") return item.source === "ifct";
      if (catalogCategory === "carbs") return carbs >= 14 && protein < 15;
      if (catalogCategory === "fats") return fat >= 10 || item.id === "ont-banana" || item.id === "ont-apple";
      return true;
    });
  }, [catalogItems, catalogCategory]);

  const macroSplit = useMemo(() => {
    const pCal = totals.protein * 4;
    const cCal = totals.carbs * 4;
    const fCal = totals.fat * 9;
    const sum = pCal + cCal + fCal;
    if (sum <= 0) return { pPct: 0, cPct: 0, fPct: 0, hasIntake: false };
    const pPct = Math.round((pCal / sum) * 100);
    const cPct = Math.round((cCal / sum) * 100);
    const fPct = Math.max(0, 100 - pPct - cPct);
    return { pPct, cPct, fPct, hasIntake: true };
  }, [totals]);

  const fullDriSummary = useMemo(
    () => computeDailyDriSummary(logs, userProfile.sex as OntGender, userProfile.age),
    [logs, userProfile.sex, userProfile.age],
  );

  const topDriMetrics = useMemo(() => {
    const keys = new Set(["fiber", "potassium", "iron", "vitaminD"]);
    return fullDriSummary.filter((d) => keys.has(d.key));
  }, [fullDriSummary]);

  const fiberMetric = useMemo(
    () => fullDriSummary.find((d) => d.key === "fiber") ?? { actual: 0, amount: 30, unit: "g" },
    [fullDriSummary],
  );

  const nutritionScore = useMemo(
    () =>
      computeDailyNutritionScore({
        calories: totals.calories,
        targetCalories: effectiveGoalKcal,
        protein: totals.protein,
        targetProtein: targets.protein,
        fiber: fiberMetric.actual,
        targetFiber: fiberMetric.amount,
        waterMl,
        targetWaterMl: targets.waterMl,
      }),
    [totals.calories, effectiveGoalKcal, totals.protein, targets.protein, fiberMetric, waterMl, targets.waterMl],
  );

  const dailyInsights = useMemo(() => {
    const loggedDaysLast7 = dailyHistory.slice(-7).filter((d) => d.calories > 0).length;
    const activeSlots = new Set(logs.map((l) => l.meal)).size;
    return buildNutritionInsights({
      calories: totals.calories,
      targetCalories: effectiveGoalKcal,
      protein: totals.protein,
      targetProtein: targets.protein,
      fiber: fiberMetric.actual,
      targetFiber: fiberMetric.amount,
      waterMl,
      targetWaterMl: targets.waterMl,
      mealSlotCount: activeSlots,
      loggedDaysLast7,
    });
  }, [dailyHistory, logs, totals.calories, effectiveGoalKcal, totals.protein, targets.protein, fiberMetric, waterMl, targets.waterMl]);

  const yesterdayKey = useMemo(() => {
    const [y, m, d] = todayKey.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(Date.UTC(y, m - 1, d - 1));
    return dt.toISOString().slice(0, 10);
  }, [todayKey]);

  const yesterdayLogs = useMemo(
    () => (yesterdayKey ? allLogs.filter((l) => l.date === yesterdayKey) : []),
    [allLogs, yesterdayKey],
  );

  async function handleCopyYesterdayMeal(mealKey: string, targetDate: string) {
    const sourceItems = yesterdayLogs.filter((l) => (l.meal || "snack") === mealKey);
    if (sourceItems.length === 0 || busy) return;
    setBusy(true);
    try {
      for (const item of sourceItems) {
        const fd = new FormData();
        fd.set("name", item.name);
        fd.set("meal", mealKey);
        fd.set("serving", item.serving);
        fd.set("calories", String(Math.round(item.calories)));
        fd.set("protein", String(Math.round(item.protein * 10) / 10));
        fd.set("carbs", String(Math.round(item.carbs * 10) / 10));
        fd.set("fat", String(Math.round(item.fat * 10) / 10));
        fd.set("source", item.source || "manual");
        fd.set("date", targetDate);
        await logFood(fd);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fastingStatus = useMemo(() => {
    const protocolObj = FASTING_PROTOCOLS.find((p) => p.id === fasting.protocol) ?? FASTING_PROTOCOLS[0];
    const targetHours = protocolObj.hours;
    if (!fasting.startedAt || nowMs <= fasting.startedAt) {
      return {
        active: false,
        headline: `Ready · ${targetHours}h window`,
        pct: 0,
      };
    }
    const elapsedMin = Math.max(0, Math.floor((nowMs - fasting.startedAt) / 60_000));
    const targetMin = targetHours * 60;
    const leftMin = Math.max(0, targetMin - elapsedMin);
    const pct = Math.min(100, Math.round((elapsedMin / Math.max(1, targetMin)) * 100));
    if (leftMin === 0) {
      const bonusH = Math.floor((elapsedMin - targetMin) / 60);
      const bonusM = (elapsedMin - targetMin) % 60;
      return {
        active: true,
        headline: `Goal hit · +${bonusH}h ${bonusM}m`,
        pct: 100,
      };
    }
    const leftH = Math.floor(leftMin / 60);
    const leftM = leftMin % 60;
    return {
      active: true,
      headline: `Fasting · ${leftH}h ${leftM}m left`,
      pct,
    };
  }, [fasting.startedAt, fasting.protocol, nowMs]);

  const activeDateDayTotals = useMemo(() => {
    if (addFoodDate === todayKey) return totals;
    return allLogs
      .filter((l) => l.date === addFoodDate)
      .reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          protein: acc.protein + l.protein,
          carbs: acc.carbs + l.carbs,
          fat: acc.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
  }, [addFoodDate, todayKey, totals, allLogs]);

  async function handleSaveEditedLog(log: NutritionLogEntry) {
    if (busy) return;
    setBusy(true);
    try {
      const delFd = new FormData();
      delFd.set("id", log.id);
      await deleteFood(delFd);
      const addFd = new FormData();
      addFd.set("name", log.name);
      addFd.set("meal", log.meal);
      addFd.set("serving", editLogForm.serving.trim() || log.serving);
      addFd.set("calories", String(Math.max(0, Math.round(Number(editLogForm.calories) || log.calories))));
      addFd.set("protein", String(Math.max(0, Number(editLogForm.protein) || log.protein)));
      addFd.set("carbs", String(Math.max(0, Number(editLogForm.carbs) || log.carbs)));
      addFd.set("fat", String(Math.max(0, Number(editLogForm.fat) || log.fat)));
      addFd.set("source", log.source || "manual");
      addFd.set("date", log.date);
      await logFood(addFd);
      setEditingLogId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // Shared Meal Sections Renderer (used by both Home and Diary Calendar!)
  function renderMealSections(forDateKey: string, dayLogs: NutritionLogEntry[]) {
    const grouped: Record<string, NutritionLogEntry[]> = {
      breakfast: [],
      morning_snack: [],
      lunch: [],
      evening_snack: [],
      dinner: [],
      snack: [],
    };
    for (const log of dayLogs) {
      const k = grouped[log.meal] ? log.meal : "snack";
      grouped[k].push(log);
    }

    return (
      <div className="space-y-3.5">
        {MEAL_SLOTS.map((slot) => {
          const items = grouped[slot.key] ?? [];
          const slotCals = items.reduce((s, i) => s + i.calories, 0);
          const slotProt = items.reduce((s, i) => s + i.protein, 0);
          const isSubSnack = slot.key === "morning_snack" || slot.key === "evening_snack";
          const share = isSubSnack ? activePattern.shares.snack * 0.5 : activePattern.shares[slot.key];
          const slotBudget = Math.round(targets.calories * share);
          const Icon = MEAL_ICONS[slot.key];
          const quickPicks =
            slot.key === "breakfast"
              ? [ONT_CORE_FOODS[0], ONT_CORE_FOODS[4], ONT_CORE_FOODS[8]]
              : slot.key === "lunch"
                ? [ONT_CORE_FOODS[3], ONT_CORE_FOODS[1], ONT_CORE_FOODS[2]]
                : slot.key === "dinner"
                  ? [ONT_CORE_FOODS[5], ONT_CORE_FOODS[10], ONT_CORE_FOODS[1]]
                  : [ONT_CORE_FOODS[7], ONT_CORE_FOODS[9], ONT_CORE_FOODS[4]];

          return (
            <Card key={slot.key} className="p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-9 place-items-center rounded-xl border border-white/10"
                    style={{ background: `${slot.color}18`, color: slot.color }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-chalk">{slot.label}</h3>
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-dim">{slot.window}</span>
                    </div>
                    <p className="font-mono text-[10px] text-mist">
                      {convertEnergy(slotCals, energyUnit)} / {convertEnergy(slotBudget, energyUnit)} {energyUnit} · {Math.round(slotProt)}g protein
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAddFoodDate(forDateKey);
                    setAddFoodMeal(slot.key);
                  }}
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>

              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((log) => {
                    const photo = resolveFoodPhoto(log.name);
                    const badge = SOURCE_BADGE[log.source] ?? SOURCE_BADGE.manual;
                    const isEditing = editingLogId === log.id;
                    return (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5 transition hover:border-white/15"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setInspectedItem({
                                item: logEntryToCatalogItem(log),
                                meal: slot.key,
                                targetDate: forDateKey,
                              })
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <img
                              src={photo.imageUrl}
                              alt={log.name}
                              className="size-12 shrink-0 rounded-xl border border-white/10 object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-[13px] font-semibold text-chalk">{log.name}</span>
                                <Badge tone={badge.tone} className="px-1.5 py-0.5 text-[8px]">{badge.label}</Badge>
                              </div>
                              <p className="mt-0.5 truncate font-mono text-[10px] text-dim">
                                {log.serving} · {Math.round(log.protein)}g P · {Math.round(log.carbs)}g C · {Math.round(log.fat)}g F
                              </p>
                            </div>
                          </button>
                          <span className="shrink-0 font-numeric text-xs font-semibold text-chalk">
                            {convertEnergy(log.calories, energyUnit)} <span className="text-[10px] text-dim">{energyUnit}</span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Edit ${log.name}`}
                            onClick={() => {
                              if (isEditing) {
                                setEditingLogId(null);
                              } else {
                                setEditingLogId(log.id);
                                setEditLogForm({
                                  serving: log.serving,
                                  calories: String(log.calories),
                                  protein: String(log.protein),
                                  carbs: String(log.carbs),
                                  fat: String(log.fat),
                                });
                              }
                            }}
                            className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.07] text-dim hover:border-acid/40 hover:text-acid"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicate ${log.name}`}
                            disabled={busy}
                            onClick={() =>
                              persistFoodLog({
                                name: log.name,
                                meal: slot.key,
                                serving: log.serving,
                                calories: log.calories,
                                protein: log.protein,
                                carbs: log.carbs,
                                fat: log.fat,
                                source: log.source || "manual",
                                date: forDateKey,
                              })
                            }
                            className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.07] text-dim hover:border-sky/40 hover:text-sky"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <form action={deleteFood} className="shrink-0">
                            <input type="hidden" name="id" value={log.id} />
                            <button
                              type="submit"
                              aria-label={`Delete ${log.name}`}
                              className="grid size-8 place-items-center rounded-xl border border-white/[0.07] text-dim hover:border-flame/40 hover:bg-flame/10 hover:text-flame"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </form>
                        </div>
                        {isEditing && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2.5 font-mono text-[10px]">
                            <input type="text" value={editLogForm.serving} onChange={(e) => setEditLogForm((p) => ({ ...p, serving: e.target.value }))} className="h-8 w-28 rounded-lg border border-white/10 bg-panel px-2 text-chalk" placeholder="Serving" />
                            <input type="number" min="0" value={editLogForm.calories} onChange={(e) => setEditLogForm((p) => ({ ...p, calories: e.target.value }))} className="h-8 w-16 rounded-lg border border-white/10 bg-panel px-2 text-chalk" placeholder="kcal" />
                            <input type="number" min="0" step="0.5" value={editLogForm.protein} onChange={(e) => setEditLogForm((p) => ({ ...p, protein: e.target.value }))} className="h-8 w-14 rounded-lg border border-white/10 bg-panel px-2 text-sky" placeholder="P" />
                            <input type="number" min="0" step="0.5" value={editLogForm.carbs} onChange={(e) => setEditLogForm((p) => ({ ...p, carbs: e.target.value }))} className="h-8 w-14 rounded-lg border border-white/10 bg-panel px-2 text-amber" placeholder="C" />
                            <input type="number" min="0" step="0.5" value={editLogForm.fat} onChange={(e) => setEditLogForm((p) => ({ ...p, fat: e.target.value }))} className="h-8 w-14 rounded-lg border border-white/10 bg-panel px-2 text-grape" placeholder="F" />
                            <Button type="button" size="sm" disabled={busy} onClick={() => handleSaveEditedLog(log)}>
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-dim mr-1">Quick add:</span>
                    {quickPicks.map((q) => {
                      const scaled = scaleNutrients(q.per100g, q.defaultServingGrams);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          disabled={busy}
                          onClick={() => logCatalogItem(q, q.defaultServingGrams, slot.key, q.defaultServingLabel, forDateKey)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] py-1 pl-1 pr-3 text-xs text-mist transition hover:border-acid/45 hover:text-chalk"
                        >
                          <img src={q.imageUrl} alt={q.name} className="size-6 rounded-full object-cover" />
                          <span>{q.name}</span>
                          <span className="font-mono text-[10px] text-acid">+{convertEnergy(scaled.kcal, energyUnit)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {forDateKey === todayKey && yesterdayLogs.some((l) => (l.meal || "snack") === slot.key) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCopyYesterdayMeal(slot.key, forDateKey)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] text-mist transition hover:border-acid/40 hover:text-acid disabled:opacity-40"
                    >
                      <RotateCcw className="size-3" /> Copy yesterday
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>OpenNutriTracker + FORGE</Badge>
            <span className="label-mono text-dim">{dateLabel}</span>
          </>
        }
        title="Nutrition."
        subtitle={`${firstName}, evidence-backed fuel tracking powered by IOM 2005 EER & DRI, WHO BMI, 2024 Compendium MET activities, IFCT Indian foods, and curated meal photography.`}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                const text = `🥗 *FORGE Daily Nutrition Card · ${firstName}*\n📅 ${dateLabel}\n\n🔥 Calories: ${Math.round(totals.calories)} / ${targets.calories} kcal\n🥩 Protein: ${Math.round(totals.protein)} / ${targets.protein} g\n🍚 Carbs: ${Math.round(totals.carbs)} / ${targets.carbs} g\n🥑 Fat: ${Math.round(totals.fat)} / ${targets.fat} g\n💧 Hydration: ${(waterMl / 1000).toFixed(1)} / ${(targets.waterMl / 1000).toFixed(1)} L\n\n⚡ ${streak}-day logging streak · Powered by FORGE`;
                if (typeof window !== "undefined") {
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                }
              }}
              title="Share diet card to WhatsApp"
            >
              <Share2 className="size-3.5 text-mint" /> WhatsApp Diet
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowBarcodeScanner(true)}>
              <ScanLine className="size-3.5 text-sky" /> Barcode
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowPhotoScanner(true)}>
              <Camera className="size-3.5 text-grape" /> Scan meal
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setTargetForm({
                  calories: String(targets.calories),
                  protein: String(targets.protein),
                  carbs: String(targets.carbs),
                  fat: String(targets.fat),
                  waterMl: String(targets.waterMl),
                });
                setShowTargetsSheet(true);
              }}
            >
              <Target className="size-3.5" /> Targets
            </Button>
            <Button
              size="md"
              onClick={() => {
                setAddFoodDate(activeTab === "diary" ? selectedDate : todayKey);
                setAddFoodMeal("lunch");
              }}
            >
              <Plus className="size-4" /> Log food
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <ModuleAiCoach module="nutrition" onPlanApplied={() => router.refresh()} />
      </div>

      {/* 7-Destination Nutrition Navigation + Theme & Energy Unit Controls */}
      <div className={cn(themeMode === "light" && "rounded-3xl bg-white/[0.96] p-4 text-neutral-900 shadow-xl transition-colors")}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-panel p-1.5 sm:w-auto">
          {(
            [
              { id: "home", label: "Overview", icon: Utensils },
              { id: "database", label: "Food Database", icon: Database },
              { id: "planner", label: "Planner & Recipes", icon: ChefHat },
              { id: "assistant", label: "AI & Calculators", icon: Bot },
              { id: "diary", label: "Diary", icon: CalendarDays },
              { id: "trends", label: "Analytics", icon: TrendingUp },
              { id: "you", label: "Profile & Targets", icon: User },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-semibold transition sm:text-xs",
                  active
                    ? "bg-acid text-ink shadow-[0_6px_22px_-8px_rgba(201,247,58,0.65)]"
                    : "text-mist hover:bg-white/[0.04] hover:text-chalk",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleThemeMode}
            aria-label="Toggle dark or light nutrition theme"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-panel px-3 py-1.5 font-mono text-[10px] font-semibold text-mist hover:text-chalk"
          >
            {themeMode === "dark" ? <Sun className="size-3.5 text-amber" /> : <Moon className="size-3.5 text-sky" />}
            <span>{themeMode === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-panel p-1">
            {(["kcal", "kJ"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => saveEnergyUnit(u)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition",
                  energyUnit === u ? "bg-acid text-ink" : "text-mist hover:text-chalk",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ──────────────── TAB 1: HOME (OpenNutriTracker Screen 1) ──────────────── */}
      {activeTab === "home" && (
        <div className="space-y-5">
          {/* Calorie Balance + Weight + Water + Fasting Hero (OpenNutriTracker Screen 1) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Card className="p-5 sm:p-6 lg:col-span-6">
              {/* Top Quick Pills: Weight + Water + Nutrition Score */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingWeight((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-numeric text-xs text-chalk transition hover:border-acid/45"
                  >
                    <Scale className="size-3.5 text-acid" />
                    <span>{userProfile.weightKg.toFixed(1)} kg</span>
                    <Pencil className="size-3 text-dim" />
                  </button>
                  <button
                    type="button"
                    disabled={waterPending}
                    onClick={() => handleWaterAction(250)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky/30 bg-sky/[0.08] px-3 py-1.5 font-numeric text-xs text-chalk transition hover:border-sky/60"
                    title="Quick add +250 ml water"
                  >
                    <Droplets className="size-3.5 text-sky" />
                    <span>{fmt(waterMl)} / {fmt(targets.waterMl)} ml</span>
                    <Plus className="size-3 text-sky" />
                  </button>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-acid/25 bg-acid/[0.08] px-3 py-1 font-mono text-[10px] text-acid">
                  <Zap className="size-3" /> Score {nutritionScore}/100
                </div>
              </div>

              {editingWeight && (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mist">Log weight (kg):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="300"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="h-8 w-24 rounded-lg border border-white/15 bg-panel px-2.5 font-numeric text-xs text-chalk"
                  />
                  <Button type="button" size="sm" disabled={weightSaving} onClick={handleWeightSave}>
                    {weightSaving ? "..." : <Check className="size-3.5" />}
                  </Button>
                </div>
              )}

              {/* Fasting Countdown Banner */}
              <div className="mb-5 rounded-2xl border border-mint/25 bg-mint/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-mint" />
                    <span className="font-numeric text-xs font-semibold text-chalk">{fastingStatus.headline}</span>
                    <button
                      type="button"
                      onClick={() => setShowFastingNote((v) => !v)}
                      aria-label="Fasting wellness information"
                      className="text-dim hover:text-chalk"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1 rounded-full border border-white/10 bg-panel/70 p-0.5">
                      {FASTING_PROTOCOLS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFastProtocol(p.id)}
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[8.5px] transition",
                            fasting.protocol === p.id ? "bg-mint text-ink font-bold" : "text-dim hover:text-mist",
                          )}
                        >
                          {p.id}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={toggleFast}
                      className={cn(
                        "rounded-full px-3 py-1 font-mono text-[9.5px] font-semibold transition",
                        fasting.startedAt ? "bg-amber/20 text-amber" : "bg-mint text-ink hover:opacity-90",
                      )}
                    >
                      {fasting.startedAt ? "End" : "Start"}
                    </button>
                  </div>
                </div>
                {fastingStatus.active && (
                  <ProgressBar value={fastingStatus.pct} color="#6EE7B7" height={4} className="mt-2" />
                )}
                {showFastingNote && (
                  <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-dim">
                    Wellness note: Intermittent fasting isn&apos;t suited to everyone. Seek support if needed via NEDA (nationaleatingdisorders.org) or Beat (beateatingdisorders.org.uk).
                  </p>
                )}
              </div>

              {/* OpenNutriTracker Screen 1 Hero: ↓ Supplied | Central Ring (Left) | 🔥 Burned */}
              <div className="grid grid-cols-3 items-center gap-2 py-1">
                <div className="text-center">
                  <div className="mx-auto mb-1.5 grid size-8 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-chalk">
                    <span className="text-sm leading-none">↓</span>
                  </div>
                  <p className="font-display text-xl font-bold leading-none text-chalk sm:text-2xl">
                    {fmt(convertEnergy(totals.calories, energyUnit))}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-dim">supplied</p>
                </div>

                <div className="flex justify-center">
                  <Ring
                    value={calPct}
                    size={134}
                    stroke={11}
                    color={remainingCal < -200 ? "#FFD166" : "#2FB872"}
                  >
                    <div className="text-center">
                      <p className="font-display text-2xl font-bold leading-none text-chalk sm:text-[26px]">
                        {fmt(convertEnergy(Math.abs(remainingCal), energyUnit))}
                      </p>
                      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-dim">
                        {energyUnit} {remainingCal < 0 ? "over" : "left"}
                      </p>
                    </div>
                  </Ring>
                </div>

                <div className="text-center">
                  <div className="mx-auto mb-1.5 grid size-8 place-items-center rounded-full border border-amber/25 bg-amber/10 text-amber">
                    <Flame className="size-4" />
                  </div>
                  <p className="font-display text-xl font-bold leading-none text-chalk sm:text-2xl">
                    {fmt(convertEnergy(totalBurnedToday, energyUnit))}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-dim">burned</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 font-mono text-[10px] text-mist">
                <span>Net target: <strong className="text-chalk">{fmt(convertEnergy(effectiveGoalKcal, energyUnit))} {energyUnit}</strong></span>
                <span>Fiber: <strong className="text-chalk">{fiberMetric.actual} / {fiberMetric.amount}g</strong></span>
              </div>

              {/* Water Hydration Bar */}
              <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Droplets className="size-4 text-sky" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-mist">
                      Water Hydration
                    </span>
                    <span className="font-numeric text-xs font-semibold text-chalk">
                      {fmt(waterMl)} / {fmt(targets.waterMl)} ml
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={waterPending || waterMl <= 0}
                      onClick={() => handleWaterAction(-250)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 font-mono text-[9.5px] text-dim hover:text-chalk disabled:opacity-30"
                      title="Undo 250 ml"
                    >
                      <RotateCcw className="size-2.5" /> Undo
                    </button>
                    {[250, 500].map((ml) => (
                      <button
                        key={ml}
                        type="button"
                        disabled={waterPending}
                        onClick={() => handleWaterAction(ml)}
                        className="rounded-full border border-sky/35 bg-sky/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-sky hover:bg-sky hover:text-ink"
                      >
                        +{ml}ml
                      </button>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = Math.round(Number(customWaterMl));
                        if (val > 0 && val <= 3000) {
                          handleWaterAction(val);
                          setCustomWaterMl("");
                        }
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      <input
                        type="number"
                        min="50"
                        max="3000"
                        step="50"
                        placeholder="ml"
                        value={customWaterMl}
                        onChange={(e) => setCustomWaterMl(e.target.value)}
                        className="h-6 w-14 rounded-full border border-white/15 bg-panel px-2 font-mono text-[10px] text-chalk"
                      />
                    </form>
                  </div>
                </div>
                <ProgressBar value={Math.min(100, Math.round((waterMl / Math.max(1, targets.waterMl)) * 100))} color="#6EA8FF" height={5} />
              </div>
            </Card>

            {/* 3 Horizontal Macro Cards + Smart Protein Gap Closer */}
            <Card className="p-5 sm:p-6 lg:col-span-6">
              <CardHeader
                label="Daily Macronutrients"
                title="Protein · Carbs · Fat"
                action={
                  <Badge tone={remainingProtein === 0 ? "mint" : "acid"}>
                    {remainingProtein === 0 ? "Protein hit" : `${Math.round(remainingProtein)}g protein left`}
                  </Badge>
                }
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Carbs", actual: totals.carbs, target: targets.carbs, color: "#FFD166" },
                  { label: "Fat", actual: totals.fat, target: targets.fat, color: "#B49CFF" },
                  { label: "Protein", actual: totals.protein, target: targets.protein, color: "#6EA8FF" },
                ].map((m) => {
                  const pct = Math.min(100, Math.round((m.actual / Math.max(1, m.target)) * 100));
                  const left = Math.max(0, Math.round(m.target - m.actual));
                  return (
                    <div key={m.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-mist">{m.label}</span>
                        <span className="font-numeric text-[10px] text-dim">{pct}%</span>
                      </div>
                      <p className="mt-1.5 font-display text-xl font-bold leading-none text-chalk">
                        {Math.round(m.actual)}<span className="text-xs font-normal text-dim">/{m.target}g</span>
                      </p>
                      <ProgressBar value={pct} color={m.color} height={4} className="mt-2.5" />
                      <p className="mt-1.5 font-mono text-[9.5px] text-dim">
                        {left === 0 ? "Target cleared" : `${left}g remaining`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Caloric Split & IOM DRI Micronutrient Highlights */}
              <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-mist">Caloric Split</span>
                    <span className="font-mono text-[10px] text-dim">
                      {macroSplit.hasIntake
                        ? `${macroSplit.pPct}% P · ${macroSplit.cPct}% C · ${macroSplit.fPct}% F`
                        : "Log a meal to see live split"}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    {macroSplit.hasIntake && (
                      <>
                        <div style={{ width: `${macroSplit.pPct}%`, backgroundColor: "#6EA8FF" }} />
                        <div style={{ width: `${macroSplit.cPct}%`, backgroundColor: "#FFD166" }} />
                        <div style={{ width: `${macroSplit.fPct}%`, backgroundColor: "#B49CFF" }} />
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {topDriMetrics.map((d) => (
                    <div key={d.key} className="rounded-xl border border-white/[0.06] bg-panel px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9.5px] text-mist">{d.label}</span>
                        <span className="font-mono text-[9.5px] font-semibold text-acid">{d.pct}%</span>
                      </div>
                      <p className="mt-0.5 font-numeric text-[11px] text-chalk">
                        {d.actual}<span className="text-[9.5px] text-dim">/{d.amount}{d.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart Remaining Protein Closer */}
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-acid">
                    <Sparkles className="size-3.5" /> Hit remaining protein
                  </span>
                  <div className="flex gap-1">
                    {(["all", "veg", "vegan"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setProteinFilter(f)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase",
                          proteinFilter === f ? "border-acid/50 bg-acid/12 text-acid" : "border-white/10 text-dim",
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {smartProteinSuggestions.length > 0 ? (
                    smartProteinSuggestions.map((s) => {
                      const photo = resolveFoodPhoto(s.title);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            persistFoodLog({
                              name: s.title,
                              meal: "snack",
                              serving: s.serving || "1 smart serving",
                              calories: s.calories,
                              protein: s.proteinGrams,
                              carbs: s.carbs,
                              fat: s.fat,
                              source: "manual",
                              date: todayKey,
                            })
                          }
                          className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-panel p-2 text-left transition hover:border-acid/40"
                        >
                          <img src={photo.imageUrl} alt={s.title} className="size-9 shrink-0 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-chalk">{s.title}</p>
                            <p className="font-mono text-[9.5px] text-mint">
                              +{Math.round(s.proteinGrams)}g P · {convertEnergy(s.calories, energyUnit)} {energyUnit}
                            </p>
                          </div>
                          <Plus className="size-3.5 shrink-0 text-acid" />
                        </button>
                      );
                    })
                  ) : (
                    [ONT_CORE_FOODS[4], ONT_CORE_FOODS[3]].map((item) => {
                      const scaled = scaleNutrients(item.per100g, item.defaultServingGrams);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setInspectedItem({ item, meal: "snack", targetDate: todayKey })}
                          className="flex items-center gap-2.5 rounded-xl border border-mint/20 bg-mint/[0.04] p-2 text-left transition hover:border-mint/45"
                        >
                          <img src={item.imageUrl} alt={item.name} className="size-9 shrink-0 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-chalk">{item.name}</p>
                            <p className="font-mono text-[9.5px] text-mint">
                              Target met · +{Math.round(scaled.protein)}g P bonus
                            </p>
                          </div>
                          <Plus className="size-3.5 shrink-0 text-mint" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Curated Foods & Indian Staples Grid */}
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-mono">Curated Foods &amp; Indian Staples</p>
                <p className="text-xs text-mist">Tap any meal photo to inspect IOM DRI micronutrients or click Quick log to add immediately.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "protein", label: "High Protein" },
                      { id: "indian", label: "Indian Staples" },
                      { id: "carbs", label: "Grains & Carbs" },
                      { id: "fats", label: "Fats & Fruit" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCatalogCategory(cat.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 font-mono text-[10px] transition",
                        catalogCategory === cat.id
                          ? "border-acid/60 bg-acid text-ink font-semibold"
                          : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddFoodMeal("lunch")}>
                  Browse full catalog →
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredCatalogFoods.map((item) => {
                const scaled = scaleNutrients(item.per100g, item.defaultServingGrams);
                return (
                  <div
                    key={item.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition hover:border-acid/45"
                  >
                    <button
                      type="button"
                      onClick={() => setInspectedItem({ item, meal: "lunch", targetDate: todayKey })}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-panel">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-acid backdrop-blur-sm">
                          {convertEnergy(scaled.kcal, energyUnit)} {energyUnit}
                        </span>
                        {item.source === "ifct" && (
                          <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mint backdrop-blur-sm">
                            IFCT
                          </span>
                        )}
                      </div>
                      <div className="p-3 pb-2">
                        <p className="truncate text-[13px] font-semibold text-chalk">{item.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-dim">{item.defaultServingLabel}</p>
                        <div className="mt-2 flex flex-wrap gap-1 font-mono text-[9.5px]">
                          <span className="rounded-md bg-sky/10 px-1.5 py-0.5 text-sky">{Math.round(scaled.protein)}g P</span>
                          <span className="rounded-md bg-amber/10 px-1.5 py-0.5 text-amber">{Math.round(scaled.carbs)}g C</span>
                          <span className="rounded-md bg-grape/10 px-1.5 py-0.5 text-grape">{Math.round(scaled.fat)}g F</span>
                        </div>
                      </div>
                    </button>
                    <div className="mt-auto px-3 pb-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 w-full text-[11px]"
                        disabled={busy}
                        onClick={() => logCatalogItem(item, item.defaultServingGrams, "lunch", item.defaultServingLabel, todayKey)}
                      >
                        <Plus className="size-3.5" /> Quick log
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Daily Nutrition Insights */}
          <Card className="p-4 sm:p-5">
            <CardHeader
              label="Automated Daily Guidance (Non-Medical)"
              title="Nutrition Insights"
              action={<Badge tone="sky">Score {nutritionScore}/100</Badge>}
            />
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {dailyInsights.map((ins) => (
                <div key={ins.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                  <Badge tone={ins.tone} className="mb-1.5">{ins.title}</Badge>
                  <p className="text-xs leading-relaxed text-mist">{ins.detail}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* 6 Meal Sections for Today */}
          {renderMealSections(todayKey, logs)}

          {/* 2024 Compendium MET Activity Logger */}
          <Card className="p-5">
            <CardHeader
              label="2024 Compendium of Physical Activities"
              title="Log activity expenditure (MET)"
              action={<Badge tone="mint">+{convertEnergy(extraBurned, energyUnit)} {energyUnit} today</Badge>}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <select
                value={selectedActivityCode}
                onChange={(e) => setSelectedActivityCode(e.target.value)}
                className="h-10 min-w-[200px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-chalk"
              >
                {ONT_COMPENDIUM_ACTIVITIES.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name} ({a.mets} MET · {a.detail})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={activityDurationMin}
                  onChange={(e) => setActivityDurationMin(Math.max(5, Number(e.target.value) || 5))}
                  className="h-10 w-20 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 font-numeric text-xs text-chalk"
                />
                <span className="font-mono text-[10px] text-dim">min</span>
              </div>
              <Button type="button" size="md" onClick={handleAddMetActivity}>
                <Activity className="size-3.5" /> Add{" "}
                {convertEnergy(
                  calculateMetBurnedKcal(
                    ONT_COMPENDIUM_ACTIVITIES.find((a) => a.code === selectedActivityCode)?.mets ?? 6,
                    userProfile.weightKg,
                    activityDurationMin,
                  ),
                  energyUnit,
                )}{" "}
                {energyUnit}
              </Button>
            </div>
            {todayActivities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {todayActivities.map((a) => (
                  <div key={a.id} className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/[0.06] px-3 py-1.5 text-xs">
                    <Flame className="size-3.5 text-mint" />
                    <span className="font-semibold text-chalk">{a.name}</span>
                    <span className="font-mono text-[10px] text-mist">{a.durationMin}m · {convertEnergy(a.calories, energyUnit)} {energyUnit}</span>
                    <button type="button" onClick={() => removeMetActivity(a.id)} aria-label={`Remove ${a.name}`} className="text-dim hover:text-flame">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ──────────────── FOOD DATABASE TAB ──────────────── */}
      {activeTab === "database" && (
        <FoodDatabaseExplorer
          energyUnit={energyUnit}
          favorites={favorites}
          allLogs={allLogs}
          onToggleFavorite={toggleFavorite}
          onInspectItem={(item) => setInspectedItem({ item, meal: "lunch", targetDate: todayKey })}
          onQuickLog={(item) => logCatalogItem(item, item.defaultServingGrams, "lunch", item.defaultServingLabel, todayKey)}
          busy={busy}
        />
      )}

      {/* ──────────────── PLANNER & RECIPES TAB ──────────────── */}
      {activeTab === "planner" && (
        <PlannerAndRecipesView
          energyUnit={energyUnit}
          targetCalories={effectiveGoalKcal}
          customRecipes={customRecipes}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onLogPlannedItem={(item) => persistFoodLog({ ...item, source: "recipe", date: todayKey })}
          onInspectRecipe={(item) => setInspectedItem({ item, meal: "lunch", targetDate: todayKey })}
          onLogRecipe={(item) => logCatalogItem(item, item.defaultServingGrams, "lunch", item.defaultServingLabel, todayKey)}
          busy={busy}
        />
      )}

      {/* ──────────────── AI ASSISTANT & CALCULATORS TAB ──────────────── */}
      {activeTab === "assistant" && (
        <AssistantAndCalculatorsView
          firstName={firstName}
          userProfile={userProfile}
          totals={totals}
          targets={targets}
          waterMl={waterMl}
          energyUnit={energyUnit}
          onApplyTargets={handleSaveTargetForm}
        />
      )}

      {/* ──────────────── TAB 2: DIARY CALENDAR ──────────────── */}
      {activeTab === "diary" && (
        <DiaryTabView
          todayKey={todayKey}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          allLogs={allLogs}
          waterByDate={waterByDate}
          burnedByDate={mergedBurnedByDate}
          targets={targets}
          energyUnit={energyUnit}
          mealPatternId={mealPatternId}
          onChangeMealPattern={saveMealPattern}
          gender={userProfile.sex as OntGender}
          age={userProfile.age}
          onAddWater={handleWaterAction}
          onOpenAddFood={(meal) => {
            setAddFoodDate(selectedDate);
            setAddFoodMeal(meal);
          }}
          renderMealSections={renderMealSections}
        />
      )}

      {/* ──────────────── TAB 3: TRENDS ──────────────── */}
      {activeTab === "trends" && (
        <TrendsTabView
          dailyHistory={dailyHistory}
          weightHistory={weightHistory}
          targets={targets}
          energyUnit={energyUnit}
          streak={streak}
        />
      )}

      {/* ──────────────── TAB 4: YOU, BMI, IOM 2005 TDEE & RECIPES ──────────────── */}
      {activeTab === "you" && (
        <YouRecipesTabView
          firstName={firstName}
          userProfile={userProfile}
          allLogs={allLogs}
          customRecipes={customRecipes}
          energyUnit={energyUnit}
          todayKey={todayKey}
          onToggleEnergyUnit={saveEnergyUnit}
          onApplyTargets={handleSaveTargetForm}
          onAddRecipe={addCustomRecipe}
          onDeleteRecipe={deleteCustomRecipe}
          onLogRecipe={(item) => logCatalogItem(item, item.defaultServingGrams, "lunch", item.defaultServingLabel, todayKey)}
          onInspectRecipe={(item) => setInspectedItem({ item, meal: "lunch", targetDate: todayKey })}
          onOpenCitations={() => setShowCitations(true)}
        />
      )}
      </div>

      {/* ──────────────── MODALS & SHEETS ──────────────── */}
      <AddFoodSheet
        open={Boolean(addFoodMeal)}
        initialMeal={addFoodMeal ?? "lunch"}
        activeDateLabel={addFoodDate === todayKey ? "Today" : formatDateKeyNice(addFoodDate)}
        energyUnit={energyUnit}
        allLogs={allLogs}
        customRecipes={customRecipes}
        busy={busy}
        onClose={() => setAddFoodMeal(null)}
        onOpenBarcode={() => {
          setAddFoodMeal(null);
          setShowBarcodeScanner(true);
        }}
        onOpenPhoto={() => {
          setAddFoodMeal(null);
          setShowPhotoScanner(true);
        }}
        onInspectItem={(item, meal) => {
          setAddFoodMeal(null);
          setInspectedItem({ item, meal, targetDate: addFoodDate });
        }}
        onQuickLog={(item, grams, meal, label) => logCatalogItem(item, grams, meal, label, addFoodDate)}
        onSubmitCustom={async (data) => {
          await persistFoodLog({ ...data, source: "manual", date: addFoodDate });
          setAddFoodMeal(null);
        }}
      />

      <FoodDetailSheet
        item={inspectedItem?.item ?? null}
        initialMeal={inspectedItem?.meal ?? "lunch"}
        activeDateLabel={
          inspectedItem?.targetDate === todayKey || !inspectedItem
            ? "Today"
            : formatDateKeyNice(inspectedItem.targetDate)
        }
        dayTotals={activeDateDayTotals}
        calTarget={effectiveGoalKcal}
        energyUnit={energyUnit}
        gender={userProfile.sex as OntGender}
        age={userProfile.age}
        busy={busy}
        onClose={() => setInspectedItem(null)}
        onAddFood={(item, grams, meal, label) =>
          logCatalogItem(item, grams, meal, label, inspectedItem?.targetDate ?? todayKey)
        }
      />

      <TargetsSheet
        open={showTargetsSheet}
        targetForm={targetForm}
        busy={busy}
        onChange={setTargetForm}
        onClose={() => setShowTargetsSheet(false)}
        onSubmit={submitTargetsForm}
      />

      <CitationsSheet open={showCitations} onClose={() => setShowCitations(false)} />

      {showBarcodeScanner && (
        <BarcodeScannerModal
          onClose={() => setShowBarcodeScanner(false)}
          onSelectFood={(food) => {
            const item = ifctToCatalogItem(food);
            setShowBarcodeScanner(false);
            setInspectedItem({ item, meal: "snack", targetDate: addFoodDate });
          }}
        />
      )}

      {showPhotoScanner && (
        <PhotoMealScanner
          open={showPhotoScanner}
          onClose={() => setShowPhotoScanner(false)}
          onLogMeal={async (m) => {
            await persistFoodLog({
              name: m.title,
              meal: "lunch",
              serving: "1 scanned plate",
              calories: m.totalCalories,
              protein: m.totalProtein,
              carbs: m.totalCarbs,
              fat: m.totalFat,
              source: "photo",
              date: addFoodDate,
            });
            setShowPhotoScanner(false);
          }}
        />
      )}

      {/* OpenNutriTracker-inspired Mobile Sticky Bottom Quick-Nav & 1-Tap Log Dock */}
      <nav
        aria-label="Nutrition quick navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-panel/95 px-2 py-2 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {[
            { id: "home" as const, label: "Home", icon: Utensils },
            { id: "diary" as const, label: "Diary", icon: CalendarDays },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 font-mono text-[10px] transition",
                  active ? "text-mint font-semibold" : "text-dim hover:text-chalk",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            aria-label="Quick log food"
            onClick={() => {
              setAddFoodDate(activeTab === "diary" ? selectedDate : todayKey);
              setAddFoodMeal("lunch");
            }}
            className="-mt-5 grid size-12 place-items-center rounded-full border-4 border-ink bg-mint text-ink shadow-[0_8px_24px_-4px_rgba(110,231,183,0.6)] transition hover:scale-105"
          >
            <Plus className="size-5" />
          </button>

          {[
            { id: "trends" as const, label: "Trends", icon: TrendingUp },
            { id: "you" as const, label: "You", icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 font-mono text-[10px] transition",
                  active ? "text-mint font-semibold" : "text-dim hover:text-chalk",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
