"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Award, BookOpen, Calendar as CalendarIcon, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, Download, Droplets, Flame, Plus, Scale, Sparkles, Target, Trash2, TrendingUp, Utensils,
} from "lucide-react";
import { LabeledTrendChart, MacroBar, Ring } from "@/components/charts";
import { Card, CardHeader } from "@/components/page-header";
import { Badge, Button, ProgressBar } from "@/components/ui";
import {
  DEMO_AVATAR,
  MEAL_PATTERNS,
  ONT_CORE_FOODS,
  ONT_RECIPES,
  calculateWhoBmi,
  convertEnergy,
  resolveFoodPhoto,
  scaleNutrients,
  type NutriCatalogItem,
  type OntGender,
  type PalCategory,
  type WeightGoalMode,
} from "@/lib/opennutri-core";
import { cn } from "@/lib/utils";
import {
  MEAL_SLOTS,
  buildCalendarMonth,
  computeDailyDriSummary,
  computeGoalTargets,
  formatDateKeyNice,
  parseDateKeyParts,
  recipeToCatalogItem,
  type CustomRecipeRecord,
  type EnergyUnit,
  type NutritionLogEntry,
} from "./nutrition-helpers";

/* ───────────────────────────── DIARY CALENDAR TAB (Screen 4) ───────────────────────────── */

export function DiaryTabView({
  todayKey,
  selectedDate,
  onSelectDate,
  allLogs,
  waterByDate,
  burnedByDate,
  targets,
  energyUnit,
  mealPatternId,
  onChangeMealPattern,
  gender,
  age,
  onAddWater,
  onOpenAddFood,
  renderMealSections,
}: {
  todayKey: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  allLogs: NutritionLogEntry[];
  waterByDate: Record<string, number>;
  burnedByDate: Record<string, number>;
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  energyUnit: EnergyUnit;
  mealPatternId: string;
  onChangeMealPattern: (id: string) => void;
  gender: OntGender;
  age: number;
  onAddWater: (ml: number, date?: string) => void;
  onOpenAddFood: (meal: string) => void;
  renderMealSections: (dateKey: string, dayLogs: NutritionLogEntry[]) => ReactNode;
}) {
  const initialParts = parseDateKeyParts(selectedDate);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);
  const [showDri, setShowDri] = useState(true);

  const byDateCalories = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of allLogs) {
      map.set(l.date, (map.get(l.date) ?? 0) + l.calories);
    }
    return map;
  }, [allLogs]);

  const calendarCells = useMemo(
    () => buildCalendarMonth(viewYear, viewMonth, byDateCalories, targets.calories),
    [viewYear, viewMonth, byDateCalories, targets.calories],
  );

  const monthTitle = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [viewYear, viewMonth]);

  const dayLogs = useMemo(
    () => allLogs.filter((l) => l.date === selectedDate),
    [allLogs, selectedDate],
  );

  const dayTotals = useMemo(
    () => dayLogs.reduce(
      (acc, l) => ({
        calories: acc.calories + l.calories,
        protein: acc.protein + l.protein,
        carbs: acc.carbs + l.carbs,
        fat: acc.fat + l.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
    [dayLogs],
  );

  const dayWater = waterByDate[selectedDate] ?? 0;
  const dayBurned = burnedByDate[selectedDate] ?? 0;
  const driSummary = useMemo(
    () => computeDailyDriSummary(dayLogs, gender, age),
    [dayLogs, gender, age],
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Monthly Calendar Card */}
        <Card className="p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="label-mono mb-1">Food Diary Calendar</p>
              <h3 className="font-display text-lg font-bold text-chalk">{monthTitle}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = parseDateKeyParts(todayKey);
                  setViewYear(p.year);
                  setViewMonth(p.month);
                  onSelectDate(todayKey);
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-acid hover:border-acid/40"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="mb-1.5 grid grid-cols-7 text-center font-mono text-[9.5px] uppercase tracking-wider text-dim">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const isSelected = cell.dateKey === selectedDate;
              const isToday = cell.dateKey === todayKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => onSelectDate(cell.dateKey)}
                  className={cn(
                    "relative flex h-10 flex-col items-center justify-center rounded-xl border text-xs transition",
                    isSelected
                      ? "border-acid bg-acid/15 font-bold text-acid"
                      : isToday
                        ? "border-white/25 bg-white/[0.05] text-chalk"
                        : "border-transparent hover:border-white/10 hover:bg-white/[0.03]",
                    !cell.inMonth && !isSelected && "opacity-35",
                  )}
                >
                  <span className="font-numeric leading-none">{cell.dayNum}</span>
                  <span
                    className={cn(
                      "mt-1 size-1.5 rounded-full",
                      cell.status === "on_target"
                        ? "bg-mint"
                        : cell.status === "logged"
                          ? "bg-amber"
                          : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 font-mono text-[9.5px] text-dim">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-mint" /> On target (±16%)</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber" /> Logged day</span>
          </div>
        </Card>

        {/* Selected Date Snapshot & Today's Nutrients (IOM DRI) */}
        <Card className="p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label-mono mb-1 flex items-center gap-2">
                <CalendarIcon className="size-3.5 text-acid" />
                {selectedDate === todayKey ? "Today's Diary" : formatDateKeyNice(selectedDate)}
              </p>
              <h3 className="font-display text-2xl font-bold text-chalk">
                {convertEnergy(dayTotals.calories, energyUnit)}
                <span className="ml-1.5 text-sm font-normal text-mist">
                  / {convertEnergy(targets.calories, energyUnit)} {energyUnit}
                </span>
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => onAddWater(250, selectedDate)}>
                <Droplets className="size-3.5 text-sky" /> +250ml ({(dayWater / 1000).toFixed(2)}L)
              </Button>
              <Button type="button" size="sm" onClick={() => onOpenAddFood("lunch")}>
                <Plus className="size-3.5" /> Log to day
              </Button>
            </div>
          </div>

          {/* 3 Macro Rings */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {[
              { label: "Protein", val: dayTotals.protein, target: targets.protein, color: "#6EA8FF" },
              { label: "Carbs", val: dayTotals.carbs, target: targets.carbs, color: "#FFD166" },
              { label: "Fat", val: dayTotals.fat, target: targets.fat, color: "#B49CFF" },
            ].map((m) => {
              const pct = Math.min(100, Math.round((m.val / Math.max(1, m.target)) * 100));
              return (
                <div key={m.label} className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                  <Ring value={pct} size={44} stroke={5} color={m.color}>
                    <span className="font-numeric text-[10px] font-bold text-chalk">{pct}%</span>
                  </Ring>
                  <div className="min-w-0">
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-dim">{m.label}</p>
                    <p className="truncate font-numeric text-xs font-semibold text-chalk">
                      {Math.round(m.val)}/{m.target}g
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meal Patterns Selector */}
          <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist">Meal split pattern</span>
              {dayBurned > 0 && (
                <span className="font-mono text-[9.5px] text-mint">
                  Burned +{convertEnergy(dayBurned, energyUnit)} {energyUnit}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangeMealPattern(p.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[9.5px] transition",
                    mealPatternId === p.id
                      ? "border-acid/50 bg-acid/15 text-acid font-semibold"
                      : "border-white/10 bg-white/[0.02] text-dim hover:text-chalk",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expandable Today's Nutrients (IOM DRI) */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
            <button
              type="button"
              onClick={() => setShowDri((s) => !s)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk">
                Day's micronutrients · IOM DRI targets
              </span>
              <ChevronDown className={cn("size-4 text-mist transition-transform", showDri && "rotate-180")} />
            </button>
            {showDri && (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {driSummary.map((d) => (
                  <div key={d.key}>
                    <div className="mb-1 flex items-center justify-between font-mono text-[9.5px]">
                      <span className="text-mist">{d.label} <span className="text-dim">({d.basis})</span></span>
                      <span className="font-numeric text-chalk">
                        {d.actual}{d.unit} <span className="text-dim">/ {d.amount}{d.unit}</span>
                      </span>
                    </div>
                    <ProgressBar value={Math.min(100, d.pct)} color={d.key === "sodium" && d.pct > 95 ? "#FF5B4A" : "#6EE7B7"} height={4} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Selected Day Meals */}
      {renderMealSections(selectedDate, dayLogs)}
    </div>
  );
}

/* ───────────────────────────── TRENDS & INSIGHTS TAB (Screen 5) ───────────────────────────── */

export function TrendsTabView({
  dailyHistory,
  weightHistory,
  targets,
  energyUnit,
  streak,
}: {
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
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  energyUnit: EnergyUnit;
  streak: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [windowRange, setWindowRange] = useState<"7d" | "30d" | "90d" | "all">("7d");

  const slice = useMemo(() => {
    if (windowRange === "7d") return dailyHistory.slice(-7);
    if (windowRange === "30d") return dailyHistory.slice(-30);
    return dailyHistory;
  }, [dailyHistory, windowRange]);

  const logged = slice.filter((d) => d.calories > 0);
  const avgCal = logged.length ? Math.round(logged.reduce((a, d) => a + d.calories, 0) / logged.length) : 0;
  const avgP = logged.length ? Math.round(logged.reduce((a, d) => a + d.protein, 0) / logged.length) : 0;
  const avgC = logged.length ? Math.round(logged.reduce((a, d) => a + d.carbs, 0) / logged.length) : 0;
  const avgF = logged.length ? Math.round(logged.reduce((a, d) => a + d.fat, 0) / logged.length) : 0;
  const avgWater = slice.length ? Math.round(slice.reduce((a, d) => a + d.waterMl, 0) / slice.length) : 0;
  const onTargetDays = logged.filter((d) => Math.abs(d.calories - targets.calories) <= targets.calories * 0.16).length;

  const targetEnergy = convertEnergy(targets.calories, energyUnit);
  const chartValues = slice.map((d) => convertEnergy(d.calories, energyUnit));
  const maxY = Math.max(targetEnergy * 1.15, ...chartValues, 100);
  const w = 600;
  const h = 180;
  const padX = 12;
  const padY = 14;
  const pts = slice.map((d, i) => {
    const val = convertEnergy(d.calories, energyUnit);
    const x = padX + (i / Math.max(1, slice.length - 1)) * (w - padX * 2);
    const y = h - padY - (val / maxY) * (h - padY * 2);
    return [x, y, val, d] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - padY} L${pts[0][0].toFixed(1)},${h - padY} Z` : "";
  const goalY = h - padY - (targetEnergy / maxY) * (h - padY * 2);

  return (
    <div className="space-y-5">
      {/* Window Selector & Headline KPIs */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-mono mb-1">Nutrition Analytics</p>
            <h3 className="font-display text-2xl font-bold text-chalk">Trends &amp; Consistency</h3>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {(["7d", "30d", "90d", "all"] as const).map((wOpt) => (
              <button
                key={wOpt}
                type="button"
                onClick={() => setWindowRange(wOpt)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition",
                  windowRange === wOpt
                    ? "bg-acid text-ink font-bold"
                    : "text-mist hover:text-chalk",
                )}
              >
                {wOpt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Logging Streak", val: `${streak} days`, accent: "text-acid" },
            { label: "Avg Daily Intake", val: `${convertEnergy(avgCal, energyUnit)} ${energyUnit}`, accent: "text-chalk" },
            { label: "Days On Target", val: `${onTargetDays} / ${logged.length || 0}`, accent: "text-mint" },
            { label: "Avg Hydration", val: `${(avgWater / 1000).toFixed(2)} L`, accent: "text-sky" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <p className="label-mono mb-1">{k.label}</p>
              <p className={cn("font-display text-xl font-bold leading-none", k.accent)}>{k.val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Calories Smooth Area Chart with Goal Dashed Line */}
      <Card className="p-5">
        <CardHeader
          label={`Intake (${energyUnit}) vs Target`}
          title={`${slice.length}-day energy curve`}
          action={<Badge tone="acid">Goal {targetEnergy} {energyUnit}</Badge>}
        />
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`tr-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9F73A" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#C9F73A" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <line
              x1={padX}
              y1={goalY}
              x2={w - padX}
              y2={goalY}
              stroke="#C9F73A"
              strokeOpacity="0.45"
              strokeDasharray="6 6"
              strokeWidth="1.5"
            />
            {area && <path d={area} fill={`url(#tr-${uid})`} />}
            {line && <path d={line} fill="none" stroke="#C9F73A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {pts.length <= 30 && pts.map(([x, y, , d]) => (
              <circle
                key={d.key}
                cx={x}
                cy={y}
                r={d.calories > 0 ? 4 : 2}
                fill={d.calories > 0 ? "#C9F73A" : "#444"}
                stroke="#0B0D11"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-dim">
            <span>{slice[0]?.shortDate}</span>
            <span>{slice[Math.floor(slice.length / 2)]?.shortDate}</span>
            <span className="text-acid">Today</span>
          </div>
        </div>
      </Card>

      {/* Daily Average Macro Distribution + Weight Trend */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader label="Averages across logged days" title="Macro compliance" />
          <div className="mt-4 space-y-4">
            <MacroBar label="Protein avg" value={avgP} target={targets.protein} color="#6EA8FF" />
            <MacroBar label="Carbs avg" value={avgC} target={targets.carbs} color="#FFD166" />
            <MacroBar label="Fat avg" value={avgF} target={targets.fat} color="#B49CFF" />
            <MacroBar label="Water avg" value={avgWater} target={targets.waterMl} color="#6EE7B7" unit="ml" />
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            label="Anthropometrics"
            title="Weight &amp; water log trend"
            action={<Badge tone="mint">{weightHistory.length} pts</Badge>}
          />
          <div className="mt-4 space-y-4">
            {weightHistory.length >= 2 ? (
              <LabeledTrendChart
                data={weightHistory.slice(-14).map((m) => ({
                  label: m.date.slice(5),
                  value: m.weightKg,
                }))}
                height={96}
                color="#6EE7B7"
              />
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-mist">
                Log at least 2 daily weigh-ins from Home or Profile to plot your weight curve.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────────── YOU, BMI, IOM 2005 TDEE & RECIPES TAB (Screen 6) ───────────────────────────── */

export function YouRecipesTabView({
  firstName,
  userProfile,
  allLogs,
  customRecipes,
  energyUnit,
  todayKey,
  onToggleEnergyUnit,
  onApplyTargets,
  onAddRecipe,
  onDeleteRecipe,
  onLogRecipe,
  onInspectRecipe,
  onOpenCitations,
}: {
  firstName: string;
  userProfile: { weightKg: number; heightCm: number; sex: "male" | "female"; age: number };
  allLogs: NutritionLogEntry[];
  customRecipes: CustomRecipeRecord[];
  energyUnit: EnergyUnit;
  todayKey: string;
  onToggleEnergyUnit: (unit: EnergyUnit) => void;
  onApplyTargets: (targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number }) => Promise<void>;
  onAddRecipe: (recipe: CustomRecipeRecord) => void;
  onDeleteRecipe: (id: string) => void;
  onLogRecipe: (item: NutriCatalogItem) => Promise<void>;
  onInspectRecipe: (item: NutriCatalogItem) => void;
  onOpenCitations: () => void;
}) {
  const [weightKg, setWeightKg] = useState(userProfile.weightKg);
  const [heightCm, setHeightCm] = useState(userProfile.heightCm);
  const [age, setAge] = useState(userProfile.age);
  const [gender, setGender] = useState<OntGender>(userProfile.sex);
  const [pal, setPal] = useState<PalCategory>("active");
  const [goalMode, setGoalMode] = useState<WeightGoalMode>("maintain");
  const [weeklyRateKg, setWeeklyRateKg] = useState(0.5);
  const [applying, setApplying] = useState(false);

  // Recipe creator state
  const [showCreator, setShowCreator] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDesc, setRecipeDesc] = useState("");
  const [ingredients, setIngredients] = useState<Array<{ foodId: string; grams: number }>>([
    { foodId: "ont-chicken-breast", grams: 160 },
    { foodId: "ont-brown-rice", grams: 150 },
  ]);

  const bmiResult = useMemo(() => calculateWhoBmi(weightKg, heightCm), [weightKg, heightCm]);
  const iomResult = useMemo(
    () => computeGoalTargets({ weightKg, heightCm, age, gender, palCategory: pal, goalMode, weeklyRateKg }),
    [weightKg, heightCm, age, gender, pal, goalMode, weeklyRateKg],
  );

  const bmiPct = Math.min(100, Math.max(8, Math.round(((bmiResult.bmi - 14) / 24) * 100)));
  const allRecipes = useMemo(() => [...ONT_RECIPES, ...customRecipes], [customRecipes]);

  function downloadExport(kind: "json" | "csv") {
    let content = "";
    let mime = "application/json";
    if (kind === "json") {
      content = JSON.stringify({ exportedAt: todayKey, profile: { firstName, weightKg, heightCm, age, gender }, logs: allLogs, customRecipes }, null, 2);
    } else {
      mime = "text/csv;charset=utf-8;";
      const rows = ["date,meal,name,serving,calories_kcal,protein_g,carbs_g,fat_g,source"];
      for (const l of allLogs) {
        rows.push(`${l.date},${l.meal},"${l.name.replace(/"/g, '""')}","${l.serving.replace(/"/g, '""')}",${l.calories},${l.protein},${l.carbs},${l.fat},${l.source}`);
      }
      content = rows.join("\n");
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-nutrition-${todayKey}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveRecipe() {
    if (!recipeName.trim() || ingredients.length === 0) return;
    const leadFood = ONT_CORE_FOODS.find((f) => f.id === ingredients[0].foodId) ?? ONT_CORE_FOODS[0];
    const rec: CustomRecipeRecord = {
      id: `rcp-custom-${Date.now()}`,
      name: recipeName.trim(),
      description: recipeDesc.trim() || "Custom macro bowl built from core ingredients.",
      servingsCount: 1,
      photoId: leadFood.photoId,
      imageUrl: leadFood.imageUrl,
      tags: ["custom"],
      ingredients,
      isCustom: true,
    };
    onAddRecipe(rec);
    setRecipeName("");
    setRecipeDesc("");
    setShowCreator(false);
  }

  return (
    <div className="space-y-5">
      {/* Athlete Identity + Unit Switch */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={DEMO_AVATAR.imageUrl}
              alt={`${firstName} profile avatar`}
              className="size-14 rounded-2xl border border-acid/40 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold text-chalk">{firstName}'s Fuel Profile</h3>
                <Badge tone="acid">IOM 2005 + WHO</Badge>
              </div>
              <p className="mt-1 font-mono text-[10px] text-dim">
                Photo:{" "}
                <a href={DEMO_AVATAR.credit.profileUrl} target="_blank" rel="noopener noreferrer" className="text-mist underline hover:text-acid">
                  {DEMO_AVATAR.credit.name} / Unsplash
                </a>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {(["kcal", "kJ"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onToggleEnergyUnit(u)}
                  className={cn(
                    "rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition",
                    energyUnit === u ? "bg-acid text-ink" : "text-mist hover:text-chalk",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => downloadExport("csv")}>
              <Download className="size-3.5" /> CSV
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => downloadExport("json")}>
              <Download className="size-3.5" /> JSON
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenCitations}>
              <BookOpen className="size-3.5 text-sky" /> Sources
            </Button>
          </div>
        </div>
      </Card>

      {/* WHO BMI Circle + IOM 2005 TDEE & Weight Taper */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* WHO BMI Gauge */}
        <Card className="p-5 lg:col-span-5">
          <CardHeader label="WHO Adult Index" title="Body Mass Index" action={<Badge tone={bmiResult.tone}>{bmiResult.status}</Badge>} />
          <div className="mt-5 flex items-center gap-5">
            <Ring
              value={bmiPct}
              size={110}
              stroke={10}
              color={bmiResult.tone === "mint" ? "#6EE7B7" : bmiResult.tone === "amber" ? "#FFD166" : bmiResult.tone === "sky" ? "#6EA8FF" : "#FF5B4A"}
            >
              <div className="text-center">
                <p className="font-display text-2xl font-bold leading-none text-chalk">{bmiResult.bmi}</p>
                <p className="mt-1 font-mono text-[9px] uppercase text-dim">BMI</p>
              </div>
            </Ring>
            <div className="flex-1 space-y-2 text-[11px] font-mono">
              {[
                { label: "< 18.5", name: "Underweight", c: "text-sky" },
                { label: "18.5 – 24.9", name: "Normal weight", c: "text-mint" },
                { label: "25.0 – 29.9", name: "Pre-obesity", c: "text-amber" },
                { label: "≥ 30.0", name: "Obesity I+", c: "text-flame" },
              ].map((band) => (
                <div key={band.name} className="flex items-center justify-between border-b border-white/[0.05] pb-1">
                  <span className={band.c}>{band.name}</span>
                  <span className="text-dim">{band.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* IOM 2005 EER & Weight Taper Calculator */}
        <Card className="p-5 lg:col-span-7">
          <CardHeader
            label="IOM 2005 EER Equation"
            title="Calorie &amp; taper calibrator"
            action={<Badge tone="acid">EER {convertEnergy(iomResult.tdee, energyUnit)} {energyUnit}</Badge>}
          />
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { label: "Weight (kg)", val: weightKg, set: setWeightKg, min: 35, max: 220 },
              { label: "Height (cm)", val: heightCm, set: setHeightCm, min: 130, max: 225 },
              { label: "Age (yrs)", val: age, set: setAge, min: 18, max: 95 },
            ].map((f) => (
              <div key={f.label}>
                <label className="label-mono mb-1 block">{f.label}</label>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={f.val}
                  onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || f.min))}
                  className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 font-numeric text-xs text-chalk focus:border-acid/50 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="label-mono mb-1.5">IOM Reference Sex</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "male", label: "Male" },
                    { id: "female", label: "Female" },
                    { id: "non_binary", label: "Non-Binary" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGender(g.id)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 font-mono text-[9.5px] transition",
                      gender === g.id ? "border-acid/50 bg-acid/12 text-acid font-semibold" : "border-white/10 bg-white/[0.02] text-mist",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label-mono mb-1.5">Activity Level (PAL)</p>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: "sedentary", label: "1.25" },
                    { id: "low_active", label: "1.50" },
                    { id: "active", label: "1.75" },
                    { id: "very_active", label: "2.20" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPal(p.id)}
                    className={cn(
                      "rounded-lg border px-1.5 py-1.5 font-mono text-[9.5px] transition",
                      pal === p.id ? "border-sky/50 bg-sky/12 text-sky font-semibold" : "border-white/10 bg-white/[0.02] text-mist",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "lose", label: "Lose Fat" },
                  { id: "maintain", label: "Maintain" },
                  { id: "gain", label: "Lean Gain" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGoalMode(m.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[9.5px] transition",
                    goalMode === m.id ? "border-acid/60 bg-acid text-ink font-semibold" : "border-white/10 text-mist",
                  )}
                >
                  {m.label}
                </button>
              ))}
              {goalMode !== "maintain" && (
                <div className="flex items-center gap-1 ml-1">
                  {[0.25, 0.5, 0.75].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setWeeklyRateKg(r)}
                      className={cn(
                        "rounded-full border px-2 py-1 font-mono text-[9px]",
                        weeklyRateKg === r ? "border-mint/50 bg-mint/15 text-mint" : "border-white/10 text-dim",
                      )}
                    >
                      {r}kg/wk
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right font-mono text-[10px] text-mist">
                <span className="font-bold text-acid">{convertEnergy(iomResult.calories, energyUnit)} {energyUnit}</span>
                {" · "}{iomResult.protein}P / {iomResult.carbs}C / {iomResult.fat}F
              </div>
              <Button
                type="button"
                size="sm"
                disabled={applying}
                onClick={async () => {
                  setApplying(true);
                  try {
                    await onApplyTargets({
                      calories: iomResult.calories,
                      protein: iomResult.protein,
                      carbs: iomResult.carbs,
                      fat: iomResult.fat,
                      waterMl: iomResult.waterMl,
                    });
                  } finally {
                    setApplying(false);
                  }
                }}
              >
                <Target className="size-3.5" /> {applying ? "Saving..." : "Apply targets"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Reusable Recipes Builder & Starter Bowls */}
      <Card className="p-5">
        <CardHeader
          label="OpenNutriTracker Recipes"
          title="Reusable Meal Bowls &amp; Recipe Builder"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreator((s) => !s)}>
              <ChefHat className="size-3.5 text-acid" /> {showCreator ? "Close builder" : "+ Create recipe"}
            </Button>
          }
        />

        {showCreator && (
          <div className="mt-4 rounded-2xl border border-acid/25 bg-acid/[0.04] p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Recipe name (e.g. Post-Workout Chicken Bowl)"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-panel px-3 text-xs text-chalk focus:border-acid/50 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Short note (optional)"
                value={recipeDesc}
                onChange={(e) => setRecipeDesc(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-panel px-3 text-xs text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={`${ing.foodId}-${idx}`} className="flex flex-wrap items-center gap-2">
                  <select
                    value={ing.foodId}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...next[idx], foodId: e.target.value };
                      setIngredients(next);
                    }}
                    className="h-9 flex-1 rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
                  >
                    {ONT_CORE_FOODS.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.per100g.kcal} kcal / 100g)</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={ing.grams}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...next[idx], grams: Math.max(5, Number(e.target.value) || 0) };
                      setIngredients(next);
                    }}
                    className="h-9 w-24 rounded-xl border border-white/10 bg-panel px-2.5 font-numeric text-xs text-chalk"
                  />
                  <span className="font-mono text-[10px] text-dim">g</span>
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded-lg border border-white/10 p-1.5 text-dim hover:text-flame"
                      aria-label="Remove ingredient"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIngredients((prev) => [...prev, { foodId: ONT_CORE_FOODS[2].id, grams: 80 }])}
                >
                  <Plus className="size-3.5" /> Add ingredient
                </Button>
                <Button type="button" size="sm" onClick={handleSaveRecipe}>
                  <Sparkles className="size-3.5" /> Save recipe
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {allRecipes.map((rec) => {
            const catItem = recipeToCatalogItem(rec);
            const scaled = scaleNutrients(catItem.per100g, catItem.defaultServingGrams);
            const isCustom = Boolean("isCustom" in rec && rec.isCustom);
            return (
              <div
                key={rec.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 transition hover:border-acid/30"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={catItem.imageUrl}
                    alt={rec.name}
                    className="size-16 shrink-0 rounded-xl border border-white/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate font-display text-base font-bold text-chalk">{rec.name}</h4>
                      <Badge tone={isCustom ? "grape" : "mint"}>{convertEnergy(scaled.kcal, energyUnit)} {energyUnit}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-mist">{rec.description}</p>
                    <p className="mt-1.5 font-mono text-[10px] text-dim">
                      {Math.round(scaled.protein)}g P · {Math.round(scaled.carbs)}g C · {Math.round(scaled.fat)}g F
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="secondary" size="sm" onClick={() => onInspectRecipe(catItem)}>
                      Details
                    </Button>
                    {isCustom && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onDeleteRecipe(rec.id)}>
                        <Trash2 className="size-3.5 text-flame" />
                      </Button>
                    )}
                  </div>
                  <Button type="button" size="sm" onClick={() => onLogRecipe(catItem)}>
                    <Plus className="size-3.5" /> Log bowl
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
