"use client";

import { useState } from "react";
import {
  Camera, Check, ChevronRight, Eye, Flame, Info, Loader2,
  Salad, Sparkles, UploadCloud, Utensils, X, Zap
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
    imageHint: "High-protein athlete bowl",
    items: [
      { name: "Grilled Chicken Breast", serving: "200g", confidence: 98, calories: 330, protein: 62, carbs: 0, fat: 7, box: { top: "25%", left: "20%", width: "35%", height: "30%" } },
      { name: "Steamed White Rice", serving: "150g", confidence: 95, calories: 195, protein: 4, carbs: 43, fat: 0.5, box: { top: "35%", left: "55%", width: "30%", height: "35%" } },
      { name: "Steamed Broccoli", serving: "100g", confidence: 96, calories: 35, protein: 3, carbs: 7, fat: 0.4, box: { top: "60%", left: "25%", width: "25%", height: "25%" } },
    ],
  },
  {
    name: "Paneer & Roti Thali",
    imageHint: "Vegetarian high-protein Indian staple",
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
  const [analyzed, setAnalyzed] = useState(true);
  const [loggedSuccess, setLoggedSuccess] = useState(false);

  if (!open) return null;

  const currentMeal = PRESET_MEALS[selectedPresetIndex];
  const totalCalories = currentMeal.items.reduce((a, b) => a + b.calories, 0);
  const totalProtein = currentMeal.items.reduce((a, b) => a + b.protein, 0);
  const totalCarbs = currentMeal.items.reduce((a, b) => a + b.carbs, 0);
  const totalFat = currentMeal.items.reduce((a, b) => a + b.fat, 0);

  function runScan(idx: number) {
    setSelectedPresetIndex(idx);
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setAnalyzed(true);
    }, 700);
  }

  function handleLog() {
    if (onLogMeal) {
      onLogMeal({
        title: currentMeal.name,
        items: currentMeal.items,
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
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="animate-scale-in relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-grape/10 text-grape">
                <Camera className="size-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-grape font-bold">
                Computer Vision Macro AI (D5)
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-1">
              Photo-to-Macro Scanner
            </h3>
            <p className="text-[12px] text-mist mt-0.5">
              Multimodal image recognition segments ingredients and computes macros instantly.
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
            {/* Sample Photo Presets */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                Test Photo:
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
                      : "border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Visual Viewfinder Mock */}
            <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/15 bg-black/60 flex items-center justify-center">
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>

              {isScanning ? (
                <div className="flex flex-col items-center gap-2 z-10">
                  <Loader2 className="size-8 animate-spin text-acid" />
                  <span className="font-mono text-[10px] text-acid font-bold tracking-wider">
                    SEGMENTING INGREDIENTS...
                  </span>
                </div>
              ) : (
                <>
                  {/* Bounding boxes */}
                  {currentMeal.items.map((item, idx) => (
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
                        {item.name} ({item.confidence}%)
                      </span>
                    </div>
                  ))}
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[8px] text-dim">
                    3 items recognized
                  </div>
                </>
              )}
            </div>

            {/* Macro Summary Totals */}
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

            {/* Detected Items List */}
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {currentMeal.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[11px]">
                  <div>
                    <span className="font-medium text-chalk">{item.name}</span>
                    <span className="text-dim ml-2 font-mono text-[10px]">({item.serving})</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-right">
                    <span className="text-acid font-bold">{item.protein}g P</span>
                    <span className="text-dim ml-2">{item.calories} kcal</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleLog}
              className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-acid font-bold text-[12.5px] text-ink shadow-[0_0_20px_rgba(201,247,58,0.25)] hover:bg-[#b8e330] transition-colors"
            >
              <Check className="size-4 stroke-[3]" /> Log Scanned Plate (+{Math.round(totalProtein)}g Protein)
            </button>
          </div>
        ) : (
          <div className="mt-6 text-center py-4 space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-acid/15 text-acid">
              <Check className="size-6 stroke-[3]" />
            </div>
            <h4 className="font-display text-lg font-bold text-chalk">
              Meal Logged!
            </h4>
            <p className="text-[12px] text-mist max-w-sm mx-auto">
              Added {currentMeal.name} ({totalCalories} kcal, {Math.round(totalProtein)}g protein) into today&apos;s nutrition plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
