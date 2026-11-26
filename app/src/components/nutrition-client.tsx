"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Camera, Check, ChevronRight, Coffee, Cookie, Droplets, Flame,
  Info, Loader2, Moon, Plus, ScanLine, Sparkles, Sun, Target, Trash2, Utensils, X, Zap,
} from "lucide-react";
import { addWater, deleteFood, logFood, updateTargets } from "@/app/actions";
import { Badge, Button, IconButton, ProgressBar } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { MacroBar, Ring } from "@/components/charts";
import { cn } from "@/lib/utils";

/* ───────────────────────────── TYPES ───────────────────────────── */

export type NutritionLogView = {
  id: string;
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

type Totals = { calories: number; protein: number; carbs: number; fat: number };

type Props = {
  firstName: string;
  dateLabel: string;
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  totals: Totals;
  logs: NutritionLogView[];
  waterMl: number;
  burned: number;
  streak: number;
  week: { key: string; label: string; calories: number; protein: number; carbs: number; fat: number }[];
};

type Sheet = null | { type: "manual"; meal: string } | { type: "scan" } | { type: "targets" };

type FoodItem = { name: string; serving: string; calories: number; protein: number; carbs: number; fat: number };

/* ───────────────────────────── DATA ───────────────────────────── */

const MEALS = [
  { key: "breakfast", label: "Breakfast", window: "6–10 AM", icon: Coffee, color: "#FFD166" },
  { key: "lunch", label: "Lunch", window: "12–3 PM", icon: Sun, color: "#C9F73A" },
  { key: "snack", label: "Snacks", window: "anytime", icon: Cookie, color: "#B49CFF" },
  { key: "dinner", label: "Dinner", window: "6–9 PM", icon: Moon, color: "#6EA8FF" },
] as const;

const QUICK_FOODS: FoodItem[] = [
  { name: "Paneer bhurji + 2 roti", serving: "1 plate", calories: 520, protein: 28, carbs: 42, fat: 26 },
  { name: "Grilled chicken breast", serving: "150 g", calories: 248, protein: 35, carbs: 0, fat: 5 },
  { name: "Greek yogurt & berries", serving: "250 g", calories: 240, protein: 20, carbs: 26, fat: 5 },
  { name: "Dal + curd bowl", serving: "1 bowl", calories: 320, protein: 18, carbs: 44, fat: 8 },
  { name: "Whey isolate shake", serving: "1 scoop", calories: 160, protein: 30, carbs: 4, fat: 2 },
  { name: "2 idli + sambar", serving: "1 plate", calories: 310, protein: 12, carbs: 56, fat: 5 },
  { name: "Chicken biryani", serving: "1 plate", calories: 690, protein: 38, carbs: 84, fat: 22 },
  { name: "Banana", serving: "1 medium", calories: 105, protein: 1, carbs: 27, fat: 0 },
];

const PROTEIN_PICKS = [
  { name: "Whey isolate", serving: "1 scoop", protein: 30, calories: 160, tags: ["fast", "supplement"] },
  { name: "Grilled chicken breast", serving: "150 g", protein: 35, calories: 248, tags: ["high-protein"] },
  { name: "Paneer tikka", serving: "150 g", protein: 27, calories: 340, tags: ["vegetarian", "home"] },
  { name: "Greek yogurt", serving: "250 g", protein: 20, calories: 240, tags: ["vegetarian", "snack"] },
  { name: "Tofu bhurji", serving: "200 g", protein: 22, calories: 280, tags: ["vegan", "home"] },
  { name: "Chicken tikka", serving: "150 g", protein: 33, calories: 290, tags: ["high-protein", "home"] },
  { name: "Egg white omelette", serving: "4 whites + 1 egg", protein: 22, calories: 190, tags: ["breakfast", "home"] },
  { name: "Soya chunks curry", serving: "150 g dry", protein: 39, calories: 420, tags: ["vegan", "home"] },
  { name: "Cottage cheese", serving: "200 g", protein: 24, calories: 220, tags: ["vegetarian", "snack"] },
  { name: "Protein oats", serving: "60 g oats + whey", protein: 32, calories: 380, tags: ["breakfast"] },
  { name: "Canned tuna", serving: "1 can", protein: 25, calories: 120, tags: ["fast"] },
  { name: "Dal + curd bowl", serving: "1 bowl", protein: 18, calories: 320, tags: ["vegetarian", "home"] },
];

/**
 * Food recognition requires a vision model. No key is configured in this build,
 * so the photo flow attaches the image to a manual entry instead of inventing
 * macros. Set FOOD_VISION_API_KEY to enable automatic detection.
 */
const VISION_ENABLED = false;

const SOURCE_META: Record<string, { label: string; tone: "acid" | "sky" | "mint" | "grape" | "neutral"; icon: typeof Camera }> = {
  photo: { label: "Photo", tone: "grape", icon: Camera },
  barcode: { label: "Barcode", tone: "sky", icon: ScanLine },
  voice: { label: "Voice", tone: "mint", icon: Zap },
  manual: { label: "Manual", tone: "neutral", icon: Utensils },
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function defaultMealForHour(hour: number) {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "snack";
  return "dinner";
}

/* ───────────────────────────── SHEET ───────────────────────────── */

function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-scale-in relative z-10 max-h-[93vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl sm:p-6",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="label-mono mb-2">{eyebrow}</p>
            <h2 className="font-display text-[26px] font-bold leading-none tracking-[-0.04em]">{title}</h2>
          </div>
          <IconButton onClick={onClose} aria-label="Close sheet">
            <X className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────────── MAIN ───────────────────────────── */

export function NutritionClient({ firstName, dateLabel, targets, totals, logs, waterMl, burned, streak, week }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [manualMeal, setManualMeal] = useState(defaultMealForHour(new Date().getHours()));
  const [form, setForm] = useState({
    name: "",
    meal: defaultMealForHour(new Date().getHours()),
    serving: "1 serving",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [busy, setBusy] = useState(false);
  const [quickAdding, setQuickAdding] = useState<string | null>(null);
  const [proteinFilter, setProteinFilter] = useState("all");
  const [waterPending, startWater] = useTransition();

  // Photo state. Recognition is disabled until a vision key exists; the photo is
  // attached to a manual entry so no macro is invented.
  const [photo, setPhoto] = useState<string | null>(null);
  const [formSource, setFormSource] = useState<"manual" | "photo">("manual");
  const fileRef = useRef<HTMLInputElement>(null);

  // Targets state
  const [targetForm, setTargetForm] = useState({
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbs: String(targets.carbs),
    fat: String(targets.fat),
    waterMl: String(targets.waterMl),
  });

  const remainingCal = targets.calories - totals.calories;
  const remainingProtein = Math.max(0, targets.protein - totals.protein);
  const calPct = Math.min(100, Math.round((totals.calories / Math.max(1, targets.calories)) * 100));

  const grouped = useMemo(() => {
    const map: Record<string, NutritionLogView[]> = { breakfast: [], lunch: [], snack: [], dinner: [] };
    for (const log of logs) {
      const key = map[log.meal] ? log.meal : "snack";
      map[key].push(log);
    }
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [logs]);

  const mealProtein = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of Object.keys(grouped)) {
      out[key] = grouped[key].reduce((a, l) => a + l.protein, 0);
    }
    return out;
  }, [grouped]);

  const proteinIdeas = useMemo(() => {
    const pool = PROTEIN_PICKS.filter((f) => {
      if (proteinFilter === "all") return true;
      if (proteinFilter === "veg") return f.tags.includes("vegetarian") || f.tags.includes("vegan");
      if (proteinFilter === "vegan") return f.tags.includes("vegan");
      return f.tags.includes(proteinFilter);
    }).sort((a, b) => b.protein - a.protein);
    if (remainingProtein <= 0) return [];
    const out: typeof pool = [];
    let left = remainingProtein;
    for (const food of pool) {
      if (left <= 4 || out.length >= 3) break;
      out.push(food);
      left -= food.protein;
    }
    if (!out.length) out.push(pool[0]);
    return out;
  }, [remainingProtein, proteinFilter]);

  const avgCalories = week.filter((d) => d.calories > 0).length
    ? Math.round(week.reduce((a, d) => a + d.calories, 0) / week.filter((d) => d.calories > 0).length)
    : 0;
  const avgProtein = week.filter((d) => d.calories > 0).length
    ? Math.round(week.reduce((a, d) => a + d.protein, 0) / week.filter((d) => d.calories > 0).length)
    : 0;
  const loggedDays = week.filter((d) => d.calories > 0).length;
  const daysOnTarget = week.filter((d) => Math.abs(d.calories - targets.calories) <= targets.calories * 0.12).length;
  const paceTarget = targets.protein / 4;

  /* ── actions ── */

  function openManual(meal: string, source: "manual" | "photo" = "manual") {
    setManualMeal(meal);
    setFormSource(source);
    setForm({ name: "", meal, serving: "1 serving", calories: "", protein: "", carbs: "", fat: "" });
    setSheet({ type: "manual", meal });
  }

  function openScan() {
    setPhoto(null);
    setSheet({ type: "scan" });
  }

  function openTargets() {
    setTargetForm({
      calories: String(targets.calories),
      protein: String(targets.protein),
      carbs: String(targets.carbs),
      fat: String(targets.fat),
      waterMl: String(targets.waterMl),
    });
    setSheet({ type: "targets" });
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("meal", form.meal);
      fd.set("serving", form.serving || "1 serving");
      fd.set("calories", form.calories || "0");
      fd.set("protein", form.protein || "0");
      fd.set("carbs", form.carbs || "0");
      fd.set("fat", form.fat || "0");
      fd.set("source", formSource);
      await logFood(fd);
      setSheet(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function quickAdd(food: { name: string; serving: string; protein: number; calories: number; tags?: string[] }) {
    if (quickAdding) return;
    setQuickAdding(food.name);
    try {
      const fd = new FormData();
      fd.set("name", food.name);
      fd.set("meal", defaultMealForHour(new Date().getHours()));
      fd.set("serving", food.serving);
      fd.set("calories", String(food.calories));
      fd.set("protein", String(food.protein));
      fd.set("carbs", "0");
      fd.set("fat", "0");
      fd.set("source", "manual");
      await logFood(fd);
      router.refresh();
    } finally {
      setQuickAdding(null);
    }
  }

  function drink(ml: number) {
    startWater(async () => {
      await addWater(ml);
      router.refresh();
    });
  }

  async function submitTargets(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [key, value] of Object.entries(targetForm)) fd.set(key, value);
      await updateTargets(fd);
      setSheet(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  const coachNote = useMemo(() => {
    if (remainingProtein > 45) {
      return {
        title: `${remainingProtein}g protein to close`,
        body: `${firstName}, two focused feedings will do it. ${proteinIdeas.slice(0, 2).map((p) => p.name).join(" + ")} locks the gap without blowing your calories.`,
        tone: "acid" as const,
      };
    }
    if (remainingProtein > 0) {
      return {
        title: `${remainingProtein}g left — one bite away`,
        body: "A whey shake or 200g Greek yogurt finishes the day exactly on target. Keep fat moderate so digestion stays easy tonight.",
        tone: "mint" as const,
      };
    }
    if (remainingCal < -250) {
      return {
        title: `${Math.abs(remainingCal)} kcal over target`,
        body: "Not a failure — a data point. Keep tomorrow's first meal protein-led and let your weekly average do the work.",
        tone: "amber" as const,
      };
    }
    return {
      title: "Protein target cleared",
      body: `${firstName}, you've hit ${fmt(totals.protein)}g of protein with ${Math.max(0, remainingCal)} kcal of room. Hydrate, sleep, grow.`,
      tone: "acid" as const,
    };
  }, [remainingProtein, remainingCal, proteinIdeas, totals.protein, firstName]);

  /* ── render ── */

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Fuel engine on</Badge>
            <span className="label-mono text-dim">{dateLabel}</span>
          </>
        }
        title="Nutrition."
        subtitle={`${firstName}, food is the other half of the workout. Scan a plate, close your protein gap, and let the week average — not one meal — decide the result.`}
        actions={
          <>
            <Button variant="secondary" size="md" onClick={openScan}>
              <Camera className="size-3.5" /> Scan meal
            </Button>
            <Button variant="outline" size="md" onClick={openTargets}>
              <Target className="size-3.5" /> Targets
            </Button>
            <Button size="md" onClick={() => openManual(defaultMealForHour(new Date().getHours()))}>
              <Plus className="size-4" /> Log food
            </Button>
          </>
        }
      />

      {/* HERO */}
      <Card className="relative p-5 md:p-7">
        <div className="pointer-events-none absolute -right-24 -top-32 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.12),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-25 [mask-image:radial-gradient(circle_at_85%_0%,black,transparent_60%)]" />
        <div className="relative grid items-center gap-7 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-5 sm:gap-7">
            <Ring value={calPct} size={186} stroke={12} color={remainingCal >= 0 ? "#C9F73A" : "#FF6B35"}>
              <div className="text-center">
                <p className="label-mono mb-1.5">{remainingCal >= 0 ? "Remaining" : "Surplus"}</p>
                <p className="font-numeric text-[44px] font-bold leading-none tracking-[-0.06em] text-chalk">
                  {fmt(Math.abs(remainingCal))}
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">kcal</p>
              </div>
            </Ring>
            <div className="space-y-4">
              <div>
                <p className="label-mono mb-1">Consumed</p>
                <p className="font-numeric text-[28px] font-semibold leading-none">
                  {fmt(totals.calories)}<span className="ml-1 text-[11px] font-normal text-dim">/ {fmt(targets.calories)}</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="label-mono mb-1">Burned</p>
                  <p className="font-numeric text-lg font-medium text-flame">{fmt(burned)}</p>
                </div>
                <span className="h-8 w-px bg-white/10" />
                <div>
                  <p className="label-mono mb-1">Net</p>
                  <p className="font-numeric text-lg font-medium text-mist">{fmt(totals.calories - burned)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="size-3.5 text-flame" />
                <span className="text-[10.5px] text-mist">{streak}-day streak · {logs.length} feeds logged</span>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-acid/20 bg-acid/[0.05] p-4 sm:col-span-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="label-mono mb-1.5 text-acid/80">Protein gap</p>
                    <p className="font-numeric text-[34px] font-bold leading-none tracking-[-0.05em] text-acid">
                      {remainingProtein > 0 ? `${fmt(remainingProtein)}g` : "Closed"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-mist">{fmt(totals.protein)}g of {targets.protein}g</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">≈ {Math.round(targets.protein / 4)}g per meal pace</p>
                  </div>
                </div>
                <ProgressBar value={(totals.protein / Math.max(1, targets.protein)) * 100} color="#C9F73A" height={5} className="mt-3" />
                {remainingProtein > 0 && (
                  <button
                    onClick={() => document.getElementById("protein-gap")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-acid/25 bg-acid/10 py-2 text-[11px] font-semibold text-acid transition-colors hover:bg-acid/15"
                  >
                    Build my {remainingProtein}g fix <ArrowUpRight className="size-3.5" />
                  </button>
                )}
              </div>
              <MacroBar label="Protein" value={totals.protein} target={targets.protein} color="#C9F73A" />
              <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} color="#6EA8FF" />
              <MacroBar label="Fat" value={totals.fat} target={targets.fat} color="#FFD166" />
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="label-mono">Water</span>
                  <span className="font-numeric text-[11px] text-mist"><span className="text-chalk">{fmt(waterMl)}</span> / {fmt(targets.waterMl)} ml</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-sky" style={{ width: `${Math.min(100, Math.round((waterMl / Math.max(1, targets.waterMl)) * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* MEAL LOG */}
        <Card className="p-5 md:p-6 xl:col-span-8">
          <CardHeader
            label="Today's log"
            title="Every meal, accounted for"
            action={
              <Button variant="secondary" size="sm" onClick={() => openManual(defaultMealForHour(new Date().getHours()))}>
                <Plus className="size-3.5" /> Add
              </Button>
            }
          />
          <div className="mt-5 space-y-5">
            {MEALS.map((meal) => {
              const rows = grouped[meal.key] ?? [];
              const kcal = rows.reduce((a, r) => a + r.calories, 0);
              const pro = rows.reduce((a, r) => a + r.protein, 0);
              const Icon = meal.icon;
              return (
                <div key={meal.key}>
                  <div className="mb-2.5 flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03]" style={{ color: meal.color }}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-chalk">{meal.label}</p>
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-dim">
                        {rows.length ? `${fmt(kcal)} kcal · ${Math.round(pro)}g protein` : meal.window}
                      </p>
                    </div>
                    <button
                      onClick={() => openManual(meal.key)}
                      className="grid size-6 place-items-center rounded-full border border-white/10 text-dim transition-colors hover:border-acid/40 hover:text-acid"
                      aria-label={`Add ${meal.label}`}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]">
                    {rows.map((row) => {
                      const meta = SOURCE_META[row.source] ?? SOURCE_META.manual;
                      const SIcon = meta.icon;
                      return (
                        <div key={row.id} className="group flex items-center gap-3 border-b border-white/[0.05] px-3.5 py-2.5 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-chalk/90">{row.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                              {row.serving} · {new Date(row.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="hidden items-center gap-1 rounded-full border border-white/[0.07] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-dim sm:flex" style={{ color: undefined }}>
                            <SIcon className="size-2.5" /> {meta.label}
                          </div>
                          <div className="w-24 text-right">
                            <p className="font-numeric text-[11.5px] text-chalk">{fmt(row.calories)}<span className="ml-0.5 text-[8.5px] text-dim">kcal</span></p>
                            <p className="font-numeric text-[9px] text-mist">{Math.round(row.protein)}g P · {Math.round(row.carbs)}g C · {Math.round(row.fat)}g F</p>
                          </div>
                          <form action={deleteFood} className="shrink-0">
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="grid size-7 place-items-center rounded-full text-dim opacity-0 transition-all hover:bg-flame/10 hover:text-flame group-hover:opacity-100 focus-visible:opacity-100"
                              aria-label={`Delete ${row.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </form>
                        </div>
                      );
                    })}
                    {!rows.length && (
                      <button onClick={() => openManual(meal.key)} className="flex w-full items-center justify-center gap-2 py-4 text-[11px] text-dim transition-colors hover:text-mist">
                        <Plus className="size-3" /> Nothing logged — add {meal.label.toLowerCase()}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-[10.5px] leading-relaxed text-dim">
            <Sparkles className="size-3.5 shrink-0 text-acid" />
            Photo scanning recognizes mixed regional plates, then you confirm portions. Nothing logs without your tap.
          </div>
        </Card>

        {/* RIGHT RAIL */}
        <div className="space-y-4 xl:col-span-4">
          {/* PROTEIN GAP GENERATOR */}
          <Card id="protein-gap" className="relative scroll-mt-24 p-5">
            <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.14),transparent_70%)]" />
            <CardHeader
              label="Protein gap generator"
              title={remainingProtein > 0 ? `Close ${remainingProtein}g` : "Target cleared"}
              action={<Badge tone={remainingProtein > 0 ? "acid" : "mint"}><Zap className="size-2.5" /> {remainingProtein > 0 ? "auto" : "done"}</Badge>}
            />
            {remainingProtein > 0 ? (
              <>
                <p className="mt-2 text-[11.5px] leading-relaxed text-mist">
                  A stack that fits your remaining macros. One tap logs it to {new Date().getHours() < 11 ? "breakfast" : new Date().getHours() < 16 ? "lunch" : "today"}.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    { key: "all", label: "All" },
                    { key: "home", label: "Home food" },
                    { key: "vegetarian", label: "Veg" },
                    { key: "fast", label: "Fast" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setProteinFilter(f.key)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors",
                        proteinFilter === f.key ? "border-acid/30 bg-acid/10 text-acid" : "border-white/[0.08] text-dim hover:text-mist",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {proteinIdeas.map((food) => (
                    <div key={food.name} className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-acid/10 text-acid">
                        <Utensils className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium text-chalk/90">{food.name}</p>
                        <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">{food.serving} · {food.calories} kcal</p>
                      </div>
                      <div className="text-right">
                        <p className="font-numeric text-[12px] font-semibold text-acid">+{food.protein}g</p>
                      </div>
                      <button
                        onClick={() => quickAdd(food)}
                        disabled={Boolean(quickAdding)}
                        className="grid size-7 place-items-center rounded-full bg-acid text-ink transition-transform hover:scale-105 disabled:opacity-40"
                        aria-label={`Log ${food.name}`}
                      >
                        {quickAdding === food.name ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      </button>
                    </div>
                  ))}
                  {!proteinIdeas.length && <p className="py-4 text-center text-[11px] text-mist">No matches for this filter. Try another.</p>}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                  <span className="text-[10px] text-dim">Stack total</span>
                  <span className="font-numeric text-[11px] text-chalk">
                    {proteinIdeas.reduce((a, f) => a + f.protein, 0)}g protein · {proteinIdeas.reduce((a, f) => a + f.calories, 0)} kcal
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-mint/20 bg-mint/[0.05] p-4 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-mint/15 text-mint"><Check className="size-5" /></span>
                <p className="mt-2 font-display text-lg font-bold text-chalk">Protein: handled.</p>
                <p className="mt-1 text-[11px] leading-relaxed text-mist">You hit {fmt(totals.protein)}g today. Keep the next meal veg-and-protein led and you&apos;ll recover ahead of schedule.</p>
              </div>
            )}
          </Card>

          {/* WATER */}
          <Card className="p-5">
            <CardHeader
              label="Hydration"
              title={`${(waterMl / 1000).toFixed(2)} L`}
              action={<Badge tone="sky"><Droplets className="size-2.5" /> {Math.round((waterMl / Math.max(1, targets.waterMl)) * 100)}%</Badge>}
            />
            <div className="mt-4 flex items-center gap-5">
              <Ring value={(waterMl / Math.max(1, targets.waterMl)) * 100} size={92} stroke={7} color="#6EA8FF">
                <Droplets className="size-6 text-sky" />
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-mist">Target {(targets.waterMl / 1000).toFixed(1)} L · {Math.max(0, Math.round((targets.waterMl - waterMl) / 250))} glasses left</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => drink(250)} disabled={waterPending}>
                    {waterPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} 250 ml
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => drink(500)} disabled={waterPending}>
                    + 500 ml
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = (i + 1) / 10 <= waterMl / Math.max(1, targets.waterMl);
                return <span key={i} className={cn("h-5 rounded-sm border", filled ? "border-sky/30 bg-sky/50" : "border-white/[0.07] bg-white/[0.02]")} />;
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-dim"><Info className="size-3 shrink-0" /> Add 500–750 ml around training. Sodium + potassium if you sweat heavily.</p>
          </Card>
        </div>

        {/* WEEK */}
        <Card className="p-5 md:p-6 xl:col-span-8">
          <CardHeader
            label="7-day fuel average"
            title={loggedDays ? `${fmt(avgCalories)} kcal · ${avgProtein}g protein` : "No days logged yet"}
            action={<Badge tone={daysOnTarget >= 4 ? "acid" : "amber"}>{daysOnTarget}/{loggedDays || 7} logged days on target</Badge>}
          />
          <WeekBars week={week} target={targets.calories} />
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
            <div>
              <p className="label-mono mb-1">Avg protein</p>
              <p className="font-numeric text-lg font-semibold">{avgProtein}g <span className="text-[9px] font-normal text-dim">/ {targets.protein}g</span></p>
            </div>
            <div>
              <p className="label-mono mb-1">Best day</p>
              <p className="font-numeric text-lg font-semibold text-acid">{loggedDays ? fmt(Math.max(...week.map((d) => d.protein))) : 0}g</p>
            </div>
            <div>
              <p className="label-mono mb-1">Adherence</p>
              <p className="font-numeric text-lg font-semibold">{week.length ? Math.round((week.filter((d) => d.protein >= targets.protein * 0.85).length / week.length) * 100) : 0}%</p>
            </div>
          </div>
        </Card>

        {/* COACH NOTE + PACING */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader label="Coach's read" title={coachNote.title} action={<span className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><Sparkles className="size-4" /></span>} />
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-mist">{coachNote.body}</p>
          <div className="mt-5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="label-mono">Protein pacing</p>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">pace {Math.round(paceTarget)}g</span>
            </div>
            <div className="space-y-2">
              {MEALS.map((m) => {
                const value = mealProtein[m.key] ?? 0;
                const pct = Math.min(100, Math.round((value / Math.max(1, paceTarget)) * 100));
                return (
                  <div key={m.key}>
                    <div className="mb-1 flex justify-between text-[10px]">
                      <span className="text-mist">{m.label}</span>
                      <span className={cn("font-numeric", value >= paceTarget ? "text-acid" : "text-dim")}>{Math.round(value)}g</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: value >= paceTarget ? "#C9F73A" : "#FFD166" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={openTargets} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] py-2 text-[10.5px] text-mist transition-colors hover:border-white/15 hover:text-chalk">
            Recalculate targets <ChevronRight className="size-3" />
          </button>
        </Card>
      </div>

      {/* ───────────── MANUAL LOG SHEET ───────────── */}
      <Sheet open={sheet?.type === "manual"} onClose={() => setSheet(null)} eyebrow="Manual log" title="Add food">
        <div className="mb-4">
          <p className="label-mono mb-2">Quick picks</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_FOODS.map((f) => (
              <button
                key={f.name}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    name: f.name,
                    serving: f.serving,
                    calories: String(f.calories),
                    protein: String(f.protein),
                    carbs: String(f.carbs),
                    fat: String(f.fat),
                  }))
                }
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] text-mist transition-colors hover:border-acid/30 hover:text-acid"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitManual} className="space-y-3.5">
          <div>
            <label className="label-mono mb-1.5 block">Food name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Paneer bhurji + 2 roti"
              required
              className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 text-[13px] text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="label-mono mb-1.5 block">Meal</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEALS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setForm({ ...form, meal: m.key })}
                  className={cn(
                    "rounded-lg border py-2 font-mono text-[8.5px] uppercase tracking-[0.08em] transition-colors",
                    form.meal === m.key ? "border-acid/40 bg-acid/10 text-acid" : "border-white/[0.08] text-dim hover:text-mist",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label-mono mb-1.5 block">Serving</label>
              <input
                value={form.serving}
                onChange={(e) => setForm({ ...form, serving: e.target.value })}
                placeholder="1 plate"
                className="h-10 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 text-[12px] text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
              />
            </div>
            {[
              { key: "calories", label: "Calories", unit: "kcal" },
              { key: "protein", label: "Protein", unit: "g" },
              { key: "carbs", label: "Carbs", unit: "g" },
              { key: "fat", label: "Fat", unit: "g" },
            ].map((field) => (
              <div key={field.key}>
                <label className="label-mono mb-1.5 block">{field.label} <span className="text-dim">({field.unit})</span></label>
                <input
                  type="number"
                  min="0"
                  step={field.key === "calories" ? "1" : "0.1"}
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 font-numeric text-[12px] text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-2.5 text-[10.5px] text-dim">
            {form.meal !== manualMeal ? "Meal changed · " : ""}
            Macros are saved as entered. Photo and voice entries use the same database.
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setSheet(null)}>Cancel</Button>
            <Button type="submit" size="md" className="flex-1" disabled={busy || !form.name.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Log food
            </Button>
          </div>
        </form>
      </Sheet>

      {/* ───────────── PHOTO SHEET ───────────── */}
      <Sheet open={sheet?.type === "scan"} onClose={() => setSheet(null)} eyebrow="Meal photo" title="Attach a photo" wide>
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-10 transition-colors hover:border-acid/40"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,247,58,0.10),transparent_65%)]" />
            {photo ? (
              <img src={photo} alt="Selected meal" className="absolute inset-0 size-full object-cover opacity-70" />
            ) : (
              <span className="relative grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10 text-acid">
                <Camera className="size-6" />
              </span>
            )}
            <p className="relative mt-4 font-display text-lg font-bold">{photo ? "Photo attached" : "Take or choose a photo"}</p>
            <p className="relative mt-1 max-w-xs text-center text-[11px] leading-relaxed text-mist">
              {photo ? "Tap to replace. Continue below to enter what you ate." : "The photo is stored with the entry as a reference. Macros are entered and confirmed by you."}
            </p>
            <span className="relative mt-4 rounded-full bg-acid px-4 py-2 text-[11px] font-semibold text-ink">
              {photo ? "Replace photo" : "Open camera"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          <div className="mt-4 rounded-xl border border-amber/20 bg-amber/[0.05] p-3 text-[10.5px] leading-relaxed text-mist">
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-amber">
              {VISION_ENABLED ? "Recognition on" : "Recognition off"}
            </p>
            <p className="mt-1">
              {VISION_ENABLED
                ? "The vision model will prefill components; you confirm every item before it logs."
                : "Automatic food recognition needs a vision API key (FOOD_VISION_API_KEY). Without it Forge will not guess your macros — the photo is kept as a reference and the numbers are yours."}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button size="md" onClick={() => openManual(defaultMealForHour(new Date().getHours()), "photo")} disabled={!photo}>
              <Utensils className="size-3.5" /> Enter this meal
            </Button>
            <Button variant="ghost" size="md" onClick={() => openManual(defaultMealForHour(new Date().getHours()), "manual")}>
              Log without a photo
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ───────────── TARGETS SHEET ───────────── */}
      <Sheet open={sheet?.type === "targets"} onClose={() => setSheet(null)} eyebrow="Daily targets" title="Set the inputs">
        <form onSubmit={submitTargets} className="space-y-4">
          <div className="rounded-xl border border-sky/15 bg-sky/[0.05] p-3 text-[10.5px] leading-relaxed text-mist">
            Forge uses these targets for the protein generator, pacing, and weekly adherence. Your coach adapts calorie targets to training load.
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "calories", label: "Calories", unit: "kcal", step: "10" },
              { key: "protein", label: "Protein", unit: "g", step: "5" },
              { key: "carbs", label: "Carbs", unit: "g", step: "5" },
              { key: "fat", label: "Fat", unit: "g", step: "5" },
              { key: "waterMl", label: "Water", unit: "ml", step: "100" },
            ].map((field) => (
              <div key={field.key} className={field.key === "waterMl" ? "col-span-2" : ""}>
                <label className="label-mono mb-1.5 block">{field.label} <span className="text-dim">({field.unit})</span></label>
                <input
                  type="number"
                  min="0"
                  step={field.step}
                  value={targetForm[field.key as keyof typeof targetForm]}
                  onChange={(e) => setTargetForm({ ...targetForm, [field.key]: e.target.value })}
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 font-numeric text-[13px] text-chalk focus:border-acid/50 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setSheet(null)}>Cancel</Button>
            <Button type="submit" size="md" className="flex-1" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />} Save targets
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/* ───────────────────────────── WEEK BARS ───────────────────────────── */

function WeekBars({ week, target }: { week: Props["week"]; target: number }) {
  const max = Math.max(target, ...week.map((d) => d.calories), 1) * 1.08;
  return (
    <div className="mt-5">
      <div className="relative h-40">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-acid/30"
          style={{ bottom: `${(target / max) * 100}%` }}
        >
          <span className="absolute -top-4 right-0 font-mono text-[8px] uppercase tracking-[0.1em] text-acid/60">target {fmt(target)}</span>
        </div>
        <div className="flex h-full items-end gap-2 md:gap-3">
          {week.map((d, i) => {
            const pct = Math.max(4, (d.calories / max) * 100);
            const onTarget = Math.abs(d.calories - target) <= target * 0.12;
            const isToday = i === week.length - 1;
            return (
              <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end gap-2">
                <div
                  className="relative w-full rounded-t-md transition-all duration-500 group-hover:brightness-125"
                  style={{
                    height: `${pct}%`,
                    background: isToday ? "#C9F73A" : onTarget ? "rgba(201,247,58,0.35)" : "rgba(255,255,255,0.10)",
                    boxShadow: isToday ? "0 0 24px -6px rgba(201,247,58,0.45)" : undefined,
                  }}
                >
                  {isToday && <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-white/25" />}
                </div>
                <span className={cn("text-center font-mono text-[8.5px] uppercase tracking-[0.06em]", isToday ? "text-chalk" : "text-dim")}>{d.label}</span>
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-panel-3 px-2 py-1 font-numeric text-[9px] text-chalk opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  {fmt(d.calories)} kcal · {Math.round(d.protein)}g P
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
