"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Camera, Check, ChevronDown, ChevronRight, ExternalLink, Flame, Info, Loader2,
  Plus, ScanLine, Search, Sparkles, Target, Utensils, X,
} from "lucide-react";
import { Badge, Button, IconButton, ProgressBar } from "@/components/ui";
import {
  DEMO_AVATAR,
  UNSPLASH_CREDITS,
  convertEnergy,
  getIomDriTable,
  scaleNutrients,
  type NutriCatalogItem,
  type OntGender,
} from "@/lib/opennutri-core";
import { cn } from "@/lib/utils";
import {
  MEAL_SLOTS,
  buildUnifiedCatalog,
  logEntryToCatalogItem,
  type CustomRecipeRecord,
  type EnergyUnit,
  type NutritionLogEntry,
} from "./nutrition-helpers";

/* ───────────────────────────── SHEET SHELL ───────────────────────────── */

export function NutriSheet({
  open,
  onClose,
  eyebrow,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: ReactNode;
  title: ReactNode;
  children: ReactNode;
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
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-scale-in relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl sm:p-6",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="label-mono mb-1.5 flex items-center gap-2">{eyebrow}</div>
            <h2 className="font-display text-[24px] font-bold leading-none tracking-[-0.04em] text-chalk">{title}</h2>
          </div>
          <IconButton onClick={onClose} aria-label="Close modal">
            <X className="size-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────────── ADD FOOD SHEET (OpenNutriTracker Screen 2) ───────────────────────────── */

type AddTab = "all" | "recently" | "products" | "ifct" | "recipes" | "custom";

export function AddFoodSheet({
  open,
  initialMeal,
  activeDateLabel,
  energyUnit,
  allLogs,
  customRecipes,
  busy,
  onClose,
  onOpenBarcode,
  onOpenPhoto,
  onInspectItem,
  onQuickLog,
  onSubmitCustom,
}: {
  open: boolean;
  initialMeal: string;
  activeDateLabel: string;
  energyUnit: EnergyUnit;
  allLogs: NutritionLogEntry[];
  customRecipes: CustomRecipeRecord[];
  busy: boolean;
  onClose: () => void;
  onOpenBarcode: () => void;
  onOpenPhoto: () => void;
  onInspectItem: (item: NutriCatalogItem, meal: string) => void;
  onQuickLog: (item: NutriCatalogItem, grams: number, meal: string, label?: string) => Promise<void>;
  onSubmitCustom: (data: { name: string; meal: string; serving: string; calories: number; protein: number; carbs: number; fat: number }) => Promise<void>;
}) {
  const [tab, setTab] = useState<AddTab>("all");
  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState("");
  const [ifctFilter, setIfctFilter] = useState<"all" | "high-protein" | "vegetarian" | "vegan">("all");
  const [quickId, setQuickId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ name: "", serving: "1 serving", calories: "", protein: "", carbs: "", fat: "" });

  useEffect(() => {
    if (open) {
      setMeal(initialMeal);
      setQuery("");
    }
  }, [open, initialMeal]);

  const catalog = useMemo(() => buildUnifiedCatalog(customRecipes), [customRecipes]);

  const recentItems = useMemo(() => {
    const seen = new Set<string>();
    const list: NutriCatalogItem[] = [];
    for (let i = allLogs.length - 1; i >= 0; i--) {
      const log = allLogs[i];
      const key = log.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(logEntryToCatalogItem(log));
      if (list.length >= 16) break;
    }
    return list;
  }, [allLogs]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool: NutriCatalogItem[] = catalog;
    if (tab === "recently") pool = recentItems;
    else if (tab === "products") pool = catalog.filter((i) => i.source === "product" || Boolean(i.barcode));
    else if (tab === "ifct") {
      pool = catalog.filter((i) => i.source === "ifct" || i.source === "product");
      if (ifctFilter !== "all") pool = pool.filter((i) => i.tags?.includes(ifctFilter));
    } else if (tab === "recipes") pool = catalog.filter((i) => i.source === "recipe");

    if (!q) return pool.slice(0, 30);
    return pool.filter((i) =>
      i.name.toLowerCase().includes(q)
      || (i.brand?.toLowerCase().includes(q) ?? false)
      || (i.tags?.some((t) => t.toLowerCase().includes(q)) ?? false),
    ).slice(0, 35);
  }, [catalog, recentItems, tab, query, ifctFilter]);

  async function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customForm.name.trim() || busy) return;
    await onSubmitCustom({
      name: customForm.name.trim(),
      meal,
      serving: customForm.serving.trim() || "1 serving",
      calories: Math.max(0, Number(customForm.calories) || 0),
      protein: Math.max(0, Number(customForm.protein) || 0),
      carbs: Math.max(0, Number(customForm.carbs) || 0),
      fat: Math.max(0, Number(customForm.fat) || 0),
    });
  }

  return (
    <NutriSheet
      open={open}
      onClose={onClose}
      wide
      eyebrow={
        <>
          <Badge tone="acid" dot>Add Food</Badge>
          <span>{activeDateLabel}</span>
        </>
      }
      title="Search catalog, recipes & IFCT"
    >
      {/* Meal selector row */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {MEAL_SLOTS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMeal(m.key)}
            className={cn(
              "rounded-xl border px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] transition",
              meal === m.key
                ? "border-acid/60 bg-acid/12 text-acid font-semibold"
                : "border-white/[0.08] bg-white/[0.02] text-mist hover:text-chalk",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search + Inline Barcode & Photo Scan triggers */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search oatmeal, salmon, paneer, dosa, whey..."
            className="h-10 w-full rounded-xl border border-white/[0.10] bg-white/[0.03] pl-9 pr-3 text-[13px] text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
          />
        </div>
        <Button type="button" variant="secondary" size="md" onClick={onOpenBarcode}>
          <ScanLine className="size-4 text-sky" /> Barcode
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onOpenPhoto}>
          <Camera className="size-4 text-grape" /> Scan plate
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: "all", label: "All" },
            { id: "recently", label: `Recently (${recentItems.length})` },
            { id: "products", label: "Products" },
            { id: "ifct", label: "Indian (IFCT)" },
            { id: "recipes", label: "Recipes" },
            { id: "custom", label: "+ Quick custom" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition",
              tab === t.id
                ? "border-acid/50 bg-acid text-ink font-semibold"
                : "border-white/10 bg-white/[0.03] text-mist hover:text-chalk",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ifct" && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "high-protein", "vegetarian", "vegan"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setIfctFilter(f)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition",
                ifctFilter === f
                  ? "border-mint/50 bg-mint/15 text-mint font-semibold"
                  : "border-white/10 bg-white/[0.02] text-dim hover:text-mist",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {tab === "custom" ? (
        <form onSubmit={handleCustomSubmit} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-mono mb-1.5 block">Food or meal name</label>
              <input
                type="text"
                required
                value={customForm.name}
                onChange={(e) => setCustomForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Homemade paneer wrap"
                className="h-10 w-full rounded-xl border border-white/[0.1] bg-panel px-3 text-[13px] text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-mono mb-1.5 block">Serving size</label>
              <input
                type="text"
                value={customForm.serving}
                onChange={(e) => setCustomForm((p) => ({ ...p, serving: e.target.value }))}
                placeholder="1 wrap (180g)"
                className="h-10 w-full rounded-xl border border-white/[0.1] bg-panel px-3 text-[13px] text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "calories", label: "Calories (kcal)", req: true },
              { k: "protein", label: "Protein (g)", req: true },
              { k: "carbs", label: "Carbs (g)", req: false },
              { k: "fat", label: "Fat (g)", req: false },
            ].map((f) => (
              <div key={f.k}>
                <label className="label-mono mb-1.5 block">{f.label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required={f.req}
                  value={customForm[f.k as keyof typeof customForm]}
                  onChange={(e) => setCustomForm((p) => ({ ...p, [f.k]: e.target.value }))}
                  placeholder="0"
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-panel px-3 font-numeric text-[13px] text-chalk focus:border-acid/50 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" size="md" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Log custom entry
            </Button>
          </div>
        </form>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-xs text-mist">
              {tab === "recently" ? "Log your first meal to populate recent items." : `No items matched "${query}".`}
            </div>
          ) : (
            filteredItems.map((item) => {
              const scaled = scaleNutrients(item.per100g, item.defaultServingGrams);
              const eVal = convertEnergy(scaled.kcal, energyUnit);
              const isAdding = quickId === item.id;
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5 transition hover:border-acid/35 hover:bg-white/[0.04]"
                >
                  <button
                    type="button"
                    onClick={() => onInspectItem(item, meal)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-12 shrink-0 rounded-xl border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-chalk group-hover:text-acid">
                          {item.name}
                        </span>
                        {item.source === "ont_core" && (
                          <Badge tone="mint" className="px-1.5 py-0.5 text-[8px]">Curated</Badge>
                        )}
                        {item.source === "recipe" && (
                          <Badge tone="grape" className="px-1.5 py-0.5 text-[8px]">Recipe</Badge>
                        )}
                        {item.source === "ifct" && (
                          <Badge tone="amber" className="px-1.5 py-0.5 text-[8px]">IFCT</Badge>
                        )}
                        {item.barcode && (
                          <Badge tone="sky" className="px-1.5 py-0.5 text-[8px]">Barcode</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-dim">
                        {item.defaultServingLabel} · {Math.round(scaled.protein)}g P · {Math.round(scaled.carbs)}g C · {Math.round(scaled.fat)}g F
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-numeric text-[12px] font-semibold text-chalk">
                      {eVal} <span className="text-[10px] text-dim">{energyUnit}</span>
                    </span>
                    <button
                      type="button"
                      disabled={isAdding || busy}
                      onClick={async () => {
                        setQuickId(item.id);
                        try {
                          await onQuickLog(item, item.defaultServingGrams, meal, item.defaultServingLabel);
                        } finally {
                          setQuickId(null);
                        }
                      }}
                      aria-label={`Quick add ${item.name}`}
                      className="grid size-8 place-items-center rounded-xl border border-acid/30 bg-acid/10 text-acid transition hover:bg-acid hover:text-ink disabled:opacity-40"
                    >
                      {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </NutriSheet>
  );
}

/* ───────────────────────────── FOOD DETAIL SHEET (OpenNutriTracker Screen 3) ───────────────────────────── */

export function FoodDetailSheet({
  item,
  initialMeal,
  activeDateLabel,
  dayTotals,
  calTarget,
  energyUnit,
  gender,
  age,
  busy,
  onClose,
  onAddFood,
}: {
  item: NutriCatalogItem | null;
  initialMeal: string;
  activeDateLabel: string;
  dayTotals: { calories: number; protein: number; carbs: number; fat: number };
  calTarget: number;
  energyUnit: EnergyUnit;
  gender: OntGender;
  age: number;
  busy: boolean;
  onClose: () => void;
  onAddFood: (item: NutriCatalogItem, grams: number, meal: string, servingLabel: string) => Promise<void>;
}) {
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState(initialMeal);
  const [showMicros, setShowMicros] = useState(true);

  useEffect(() => {
    if (item) {
      setGrams(item.defaultServingGrams || 100);
      setMeal(initialMeal);
    }
  }, [item, initialMeal]);

  if (!item) return null;

  const scaled = scaleNutrients(item.per100g, grams);
  const driRows = getIomDriTable(gender, age);
  const nextCalories = dayTotals.calories + scaled.kcal;
  const nextPct = Math.min(100, Math.round((nextCalories / Math.max(1, calTarget)) * 100));

  return (
    <NutriSheet
      open={Boolean(item)}
      onClose={onClose}
      wide
      eyebrow={
        <>
          <Badge tone="mint" dot>Food Detail</Badge>
          <span>{activeDateLabel}</span>
        </>
      }
      title={item.name}
    >
      {/* Hero Unsplash photo + attribution caption */}
      <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10">
        <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-x-3 bottom-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {item.tags?.map((tag) => (
              <Badge key={tag} tone="acid" className="bg-black/65 backdrop-blur-sm">
                {tag}
              </Badge>
            ))}
          </div>
          <a
            href={item.photoCredit.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[9.5px] text-chalk/90 backdrop-blur-sm hover:border-acid/50 hover:text-acid"
          >
            Photo: {item.photoCredit.name} / Unsplash <ExternalLink className="size-2.5" />
          </a>
        </div>
      </div>

      {/* Day Total Preview header bar (from OpenNutriTracker Screen 3) */}
      <div className="mb-4 rounded-2xl border border-acid/25 bg-acid/[0.06] p-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-acid">Day total preview</span>
          <span className="font-numeric text-chalk">
            {convertEnergy(dayTotals.calories, energyUnit)} →{" "}
            <strong className="text-acid">{convertEnergy(nextCalories, energyUnit)}</strong>{" "}
            / {convertEnergy(calTarget, energyUnit)} {energyUnit} ({nextPct}%)
          </span>
        </div>
        <ProgressBar value={nextPct} color="#C9F73A" height={5} />
        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-mist">
          <span>P: {Math.round(dayTotals.protein)} → <strong className="text-chalk">{Math.round(dayTotals.protein + scaled.protein)}g</strong></span>
          <span>C: {Math.round(dayTotals.carbs)} → <strong className="text-chalk">{Math.round(dayTotals.carbs + scaled.carbs)}g</strong></span>
          <span>F: {Math.round(dayTotals.fat)} → <strong className="text-chalk">{Math.round(dayTotals.fat + scaled.fat)}g</strong></span>
        </div>
      </div>

      {/* Quantity & Meal controls */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label-mono mb-1.5 block">Quantity (grams / ml)</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {[
              { label: "Serving", g: item.defaultServingGrams },
              { label: "50g", g: 50 },
              { label: "100g", g: 100 },
              { label: "150g", g: 150 },
              { label: "200g", g: 200 },
              { label: "250g", g: 250 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setGrams(p.g)}
                className={cn(
                  "rounded-lg border px-2 py-1 font-mono text-[10px] transition",
                  grams === p.g
                    ? "border-acid/60 bg-acid/15 text-acid font-semibold"
                    : "border-white/10 bg-white/[0.03] text-mist hover:text-chalk",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            max="2000"
            value={grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 font-numeric text-sm text-chalk focus:border-acid/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="label-mono mb-1.5 block">Log into meal slot</label>
          <div className="grid grid-cols-2 gap-1.5">
            {MEAL_SLOTS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMeal(m.key)}
                className={cn(
                  "rounded-xl border px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition",
                  meal === m.key
                    ? "border-acid/60 bg-acid/15 text-acid font-semibold"
                    : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Macro summary tiles */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          { label: energyUnit, value: String(convertEnergy(scaled.kcal, energyUnit)), color: "text-acid" },
          { label: "Protein", value: `${scaled.protein}g`, color: "text-sky" },
          { label: "Carbs", value: `${scaled.carbs}g`, color: "text-amber" },
          { label: "Fat", value: `${scaled.fat}g`, color: "text-grape" },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
            <p className={cn("font-display text-xl font-bold leading-none", tile.color)}>{tile.value}</p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-dim">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* Expandable Micronutrients & IOM DRI comparison */}
      <div className="mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
        <button
          type="button"
          onClick={() => setShowMicros((s) => !s)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-chalk">
            Detailed nutrients &amp; IOM DRI ({grams}g)
          </span>
          {showMicros ? <ChevronDown className="size-4 text-mist" /> : <ChevronRight className="size-4 text-mist" />}
        </button>
        {showMicros && (
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-white/[0.06] pb-2.5 font-mono text-[10px] text-mist sm:grid-cols-3">
              <span>Sugars: <strong className="text-chalk">{scaled.sugars}g</strong></span>
              <span>Sat fat: <strong className="text-chalk">{scaled.saturatedFat}g</strong></span>
              <span>Mono fat: <strong className="text-chalk">{scaled.monounsaturatedFat}g</strong></span>
              <span>Poly fat: <strong className="text-chalk">{scaled.polyunsaturatedFat}g</strong></span>
              <span>Cholesterol: <strong className="text-chalk">{scaled.cholesterol}mg</strong></span>
              <span>Vitamin A: <strong className="text-chalk">{scaled.vitaminA}µg</strong></span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {driRows.map((d) => {
                const actual = Number(scaled[d.key] ?? 0);
                const pct = Math.min(100, Math.round((actual / Math.max(0.1, d.amount)) * 100));
                return (
                  <div key={d.key}>
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-mist">{d.label} <span className="text-dim">({d.basis})</span></span>
                      <span className="font-numeric text-chalk">
                        {actual}{d.unit} <span className="text-dim">/ {d.amount}{d.unit} ({pct}%)</span>
                      </span>
                    </div>
                    <ProgressBar value={pct} color={d.key === "sodium" && pct > 80 ? "#FFD166" : "#6EE7B7"} height={4} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          type="button"
          size="md"
          className="flex-1"
          disabled={busy}
          onClick={() => onAddFood(item, grams, meal, `${grams}g`)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Add to {meal}
        </Button>
      </div>
    </NutriSheet>
  );
}

/* ───────────────────────────── TARGETS SHEET ───────────────────────────── */

export function TargetsSheet({
  open,
  targetForm,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  targetForm: { calories: string; protein: string; carbs: string; fat: string; waterMl: string };
  busy: boolean;
  onChange: (next: { calories: string; protein: string; carbs: string; fat: string; waterMl: string }) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <NutriSheet
      open={open}
      onClose={onClose}
      eyebrow="Daily targets"
      title="Calibrate macro targets"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "calories", label: "Daily Calories", unit: "kcal", step: "50" },
            { key: "protein", label: "Protein", unit: "g", step: "5" },
            { key: "carbs", label: "Carbs", unit: "g", step: "10" },
            { key: "fat", label: "Fat", unit: "g", step: "5" },
            { key: "waterMl", label: "Hydration", unit: "ml", step: "250" },
          ].map((field) => (
            <div key={field.key} className={field.key === "waterMl" ? "col-span-2" : ""}>
              <label className="label-mono mb-1.5 block">{field.label} <span className="text-dim">({field.unit})</span></label>
              <input
                type="number"
                min="0"
                step={field.step}
                value={targetForm[field.key as keyof typeof targetForm]}
                onChange={(e) => onChange({ ...targetForm, [field.key]: e.target.value })}
                className="h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 font-numeric text-[13px] text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="md" className="flex-1" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />} Save targets
          </Button>
        </div>
      </form>
    </NutriSheet>
  );
}

/* ───────────────────────────── SCIENTIFIC CITATIONS & CREDITS SHEET ───────────────────────────── */

export function CitationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <NutriSheet
      open={open}
      onClose={onClose}
      wide
      eyebrow="Evidence & Attributions"
      title="Scientific Sources & Media Credits"
    >
      <div className="space-y-4 text-xs text-mist">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-acid">Peer-Reviewed Formulas &amp; Databases</p>
          <ul className="space-y-1.5 leading-relaxed">
            <li><strong className="text-chalk">IOM 2005 EER &amp; DRI:</strong> Institute of Medicine Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Protein, Vitamins &amp; Minerals (National Academies Press).</li>
            <li><strong className="text-chalk">WHO BMI &amp; TRS 916:</strong> World Health Organization adult BMI risk classifications and diet/nutrition recommendations.</li>
            <li><strong className="text-chalk">2024 Compendium of Physical Activities:</strong> Herrmann et al. (2024) adult MET values for energy expenditure (<code className="text-acid">MET × kg × hours</code>).</li>
            <li><strong className="text-chalk">IFCT &amp; Open Food Facts:</strong> NIN Hyderabad Indian Food Composition Tables + Open Food Facts (ODbL).</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-sky">Curated Unsplash Photography (Unsplash License)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(UNSPLASH_CREDITS).map(([id, credit]) => (
              <a
                key={id}
                href={credit.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-panel p-2 hover:border-acid/40"
              >
                <img src={`/nutri-meals/${id}.jpg`} alt={credit.name} className="size-9 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-chalk">{credit.name}</p>
                  <p className="truncate font-mono text-[9px] text-dim">{id}</p>
                </div>
                <ExternalLink className="size-3 text-dim" />
              </a>
            ))}
            <a
              href={DEMO_AVATAR.credit.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-panel p-2 hover:border-acid/40"
            >
              <img src={DEMO_AVATAR.imageUrl} alt={DEMO_AVATAR.credit.name} className="size-9 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-chalk">{DEMO_AVATAR.credit.name}</p>
                <p className="truncate font-mono text-[9px] text-dim">Demo profile avatar</p>
              </div>
              <ExternalLink className="size-3 text-dim" />
            </a>
          </div>
        </div>
      </div>
    </NutriSheet>
  );
}
