"use client";

import { useState } from "react";
import {
  Camera, Check, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DetectedFoodItem {
  name: string;
  serving: string;
  confidence: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  box: { top: string; left: string; width: string; height: string };
}

interface PhotoMealScannerProps {
  open: boolean;
  onClose: () => void;
  onLogMeal?: (meal: {
    title: string;
    items: DetectedFoodItem[];
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  }) => void;
}

const PRESET_MEALS = [
  {
    name: "Chicken, Rice & Greens",
    items: [
      { name: "Grilled Chicken Breast", serving: "200g", confidence: 98, calories: 330, protein: 62, carbs: 0, fat: 7, box: { top: "25%", left: "20%", width: "35%", height: "30%" } },
      { name: "Steamed White Rice", serving: "150g", confidence: 95, calories: 195, protein: 4, carbs: 43, fat: 0.5, box: { top: "35%", left: "55%", width: "30%", height: "35%" } },
      { name: "Steamed Broccoli", serving: "100g", confidence: 96, calories: 35, protein: 3, carbs: 7, fat: 0.4, box: { top: "60%", left: "25%", width: "25%", height: "25%" } },
    ],
  },
  {
    name: "Paneer & Roti Thali",
    items: [
      { name: "Low-Fat Paneer Bhurji", serving: "150g", confidence: 97, calories: 250, protein: 27, carbs: 6, fat: 12, box: { top: "30%", left: "25%", width: "32%", height: "30%" } },
      { name: "Whole Wheat Roti (2 pcs)", serving: "70g", confidence: 99, calories: 208, protein: 6.2, carbs: 42, fat: 1.8, box: { top: "40%", left: "60%", width: "30%", height: "30%" } },
      { name: "Moong Dal Tadka", serving: "1 katori (150g)", confidence: 94, calories: 145, protein: 9, carbs: 20, fat: 3.5, box: { top: "15%", left: "50%", width: "25%", height: "25%" } },
    ],
  },
];

export function PhotoMealScanner({ open, onClose, onLogMeal }: PhotoMealScannerProps) {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [loggedSuccess, setLoggedSuccess] = useState(false);
  const [editableItems, setEditableItems] = useState<Array<DetectedFoodItem & { included: boolean }>>(
    () => PRESET_MEALS[0].items.map((it) => ({ ...it, included: true })),
  );

  if (!open) return null;

  const currentMeal = PRESET_MEALS[selectedPresetIndex];
  const activeItems = editableItems.filter((i) => i.included);
  const totalCalories = Math.round(activeItems.reduce((a, b) => a + b.calories, 0));
  const totalProtein = Math.round(activeItems.reduce((a, b) => a + b.protein, 0) * 10) / 10;
  const totalCarbs = Math.round(activeItems.reduce((a, b) => a + b.carbs, 0) * 10) / 10;
  const totalFat = Math.round(activeItems.reduce((a, b) => a + b.fat, 0) * 10) / 10;

  function runScan(idx: number) {
    setSelectedPresetIndex(idx);
    setIsScanning(true);
    setTimeout(() => {
      setEditableItems(PRESET_MEALS[idx].items.map((it) => ({ ...it, included: true })));
      setIsScanning(false);
    }, 500);
  }

  function updateItemValue(idx: number, field: "calories" | "protein" | "serving", val: string) {
    setEditableItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "serving") return { ...item, serving: val };
        return { ...item, [field]: Math.max(0, Number(val) || 0) };
      }),
    );
  }

  function toggleItem(idx: number) {
    setEditableItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, included: !item.included } : item)),
    );
  }

  function handleLog() {
    if (activeItems.length === 0) return;
    if (onLogMeal) {
      onLogMeal({
        title: currentMeal.name,
        items: activeItems,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
      });
    }
    setLoggedSuccess(true);
    setTimeout(() => {
      setLoggedSuccess(false);
      onClose();
    }, 550);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="animate-scale-in relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-grape/10 text-grape">
                <Camera className="size-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-grape font-bold">
                Photo Meal Estimator · Editable Preview
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-1">
              Photo-to-Macro Scanner
            </h3>
            <p className="text-[12px] text-mist mt-0.5">
              Review and edit estimated portions before confirming into your diary. Live camera AI requires configuring a vision API key.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {!loggedSuccess ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                Sample Plate:
              </span>
              {PRESET_MEALS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => runScan(idx)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
                    selectedPresetIndex === idx
                      ? "bg-acid text-ink font-bold"
                      : "border border-white/10 bg-white/[0.03] text-mist hover:text-chalk",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/15 bg-black/60 flex items-center justify-center">
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>

              {isScanning ? (
                <div className="flex flex-col items-center gap-2 z-10">
                  <Loader2 className="size-8 animate-spin text-acid" />
                  <span className="font-mono text-[10px] text-acid font-bold tracking-wider">
                    ESTIMATING PORTIONS...
                  </span>
                </div>
              ) : (
                <>
                  {editableItems.filter((i) => i.included).map((item, idx) => (
                    <div
                      key={idx}
                      className="absolute rounded-lg border-2 border-acid/80 bg-acid/10 transition-all pointer-events-none"
                      style={{
                        top: item.box.top,
                        left: item.box.left,
                        width: item.box.width,
                        height: item.box.height,
                      }}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-acid whitespace-nowrap">
                        {item.name} (~{item.confidence}%)
                      </span>
                    </div>
                  ))}
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[8px] text-dim">
                    {activeItems.length} item(s) selected · Estimated values
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                <p className="font-mono text-[8px] uppercase tracking-wider text-dim">Calories</p>
                <p className="font-numeric text-base font-bold text-chalk mt-0.5">{totalCalories}</p>
              </div>
              <div className="rounded-xl border border-acid/20 bg-acid/5 p-2">
                <p className="font-mono text-[8px] uppercase tracking-wider text-acid font-bold">Protein</p>
                <p className="font-numeric text-base font-bold text-acid mt-0.5">{Math.round(totalProtein)}g</p>
              </div>
              <div className="rounded-xl border border-sky/20 bg-sky/5 p-2">
                <p className="font-mono text-[8px] uppercase tracking-wider text-sky font-bold">Carbs</p>
                <p className="font-numeric text-base font-bold text-sky mt-0.5">{Math.round(totalCarbs)}g</p>
              </div>
              <div className="rounded-xl border border-amber/20 bg-amber/5 p-2">
                <p className="font-mono text-[8px] uppercase tracking-wider text-amber font-bold">Fat</p>
                <p className="font-numeric text-base font-bold text-amber mt-0.5">{Math.round(totalFat)}g</p>
              </div>
            </div>

            {/* Editable Items List */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {editableItems.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px]",
                    item.included ? "border-white/10 bg-black/30" : "border-white/5 bg-black/15 opacity-50",
                  )}
                >
                  <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={() => toggleItem(idx)}
                      className="accent-acid"
                    />
                    <span className="truncate font-medium text-chalk">{item.name}</span>
                  </label>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <input
                      type="text"
                      value={item.serving}
                      onChange={(e) => updateItemValue(idx, "serving", e.target.value)}
                      aria-label={`${item.name} serving`}
                      className="w-20 rounded border border-white/10 bg-panel px-1.5 py-0.5 text-mist"
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.calories}
                      onChange={(e) => updateItemValue(idx, "calories", e.target.value)}
                      aria-label={`${item.name} calories`}
                      className="w-14 rounded border border-white/10 bg-panel px-1.5 py-0.5 text-right text-chalk"
                    />
                    <span className="text-dim">kcal</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={item.protein}
                      onChange={(e) => updateItemValue(idx, "protein", e.target.value)}
                      aria-label={`${item.name} protein`}
                      className="w-12 rounded border border-white/10 bg-panel px-1.5 py-0.5 text-right text-acid"
                    />
                    <span className="text-dim">g P</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={activeItems.length === 0}
              onClick={handleLog}
              className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-acid font-bold text-[12.5px] text-ink shadow-[0_0_20px_rgba(201,247,58,0.25)] hover:bg-[#b8e330] transition-colors disabled:opacity-40"
            >
              <Check className="size-4 stroke-[3]" /> Confirm &amp; Log Scanned Plate (+{Math.round(totalProtein)}g Protein)
            </button>
          </div>
        ) : (
          <div className="mt-6 text-center py-4 space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-acid/15 text-acid">
              <Check className="size-6 stroke-[3]" />
            </div>
            <h4 className="font-display text-lg font-bold text-chalk">Meal Logged!</h4>
            <p className="text-[12px] text-mist max-w-sm mx-auto">
              Added {currentMeal.name} ({totalCalories} kcal, {Math.round(totalProtein)}g protein) into today&apos;s diary.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
