"use client";

import { useState } from "react";
import { Camera, Check, Plus, ScanLine, X, Zap } from "lucide-react";
import { resolveBarcode, type FoodItem } from "@/lib/food-db";
import { cn } from "@/lib/utils";

interface BarcodeScannerModalProps {
  onClose: () => void;
  onSelectFood: (food: FoodItem) => void;
}

const PRESET_BARCODES = [
  { code: "8901262010051", name: "Amul High Protein Lassi", tag: "15g Protein" },
  { code: "0748927028669", name: "ON Gold Standard Whey", tag: "24g Protein" },
  { code: "8906079850123", name: "Epigamia Greek Yogurt", tag: "6.5g Protein" },
  { code: "8901058852924", name: "Fortune Soya Chunks", tag: "26g Protein" },
];

export function BarcodeScannerModal({ onClose, onSelectFood }: BarcodeScannerModalProps) {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [resolvedFood, setResolvedFood] = useState<FoodItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleScan(code: string) {
    setBarcodeInput(code);
    setError(null);
    const match = resolveBarcode(code);
    if (match) {
      setResolvedFood(match);
    } else {
      setResolvedFood(null);
      setError(`No verified match for barcode "${code}". Try custom entry.`);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close scanner" />
      <div className="animate-scale-in relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sky">
              <ScanLine className="size-4" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-sky font-semibold">
                Camera Barcode Scanner (D1)
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk">
              Scan Food Barcode
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Viewfinder Mock */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-sky/40 bg-black/60 p-6 text-center">
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-sky/80 shadow-[0_0_12px_#6EA8FF] animate-pulse" />
          <Camera className="mx-auto size-12 text-sky/40 mb-2" />
          <p className="text-[12px] font-medium text-chalk">
            Point camera at food packaging barcode
          </p>
          <p className="font-mono text-[9px] text-dim mt-0.5">
            Instant EAN-13 / UPC lookup with IFCT & brand database
          </p>
        </div>

        {/* Quick Test Presets */}
        <div className="mt-4">
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim block mb-2">
            Sample Verified Barcodes:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_BARCODES.map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => handleScan(preset.code)}
                className="flex flex-col items-start rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 text-left hover:border-sky/40 transition-colors"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11.5px] font-semibold text-chalk truncate">
                    {preset.name}
                  </span>
                  <span className="rounded bg-sky/15 px-1 font-mono text-[8px] text-sky shrink-0">
                    {preset.tag}
                  </span>
                </div>
                <span className="font-mono text-[8px] text-dim mt-0.5">{preset.code}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Barcode Input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Or enter barcode numbers..."
            className="h-10 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 font-mono text-[11px] text-chalk placeholder:text-dim focus:border-sky/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleScan(barcodeInput)}
            className="h-10 rounded-xl bg-sky/15 border border-sky/30 px-4 text-[12px] font-medium text-sky hover:bg-sky/25 transition-colors"
          >
            Lookup
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-center text-[11px] text-rose-300">
            {error}
          </p>
        )}

        {/* Matched Food Result Card */}
        {resolvedFood && (
          <div className="animate-fade-up mt-4 rounded-2xl border border-sky/30 bg-sky/[0.06] p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[8px] uppercase tracking-wider text-sky">
                  Match Verified
                </span>
                <h4 className="text-[14px] font-bold text-chalk mt-0.5">
                  {resolvedFood.name}
                </h4>
                <p className="text-[11px] text-mist">
                  {resolvedFood.servingUnit} · {resolvedFood.calories} kcal
                </p>
              </div>
              <span className="rounded-full bg-sky/20 px-2 py-0.5 font-numeric text-[11px] font-bold text-sky">
                {resolvedFood.protein}g Protein
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-sky/20 pt-3">
              <div className="flex gap-3 font-mono text-[9px] text-dim">
                <span>C: {resolvedFood.carbs}g</span>
                <span>F: {resolvedFood.fat}g</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectFood(resolvedFood);
                  onClose();
                }}
                className="press flex items-center gap-1.5 rounded-full bg-sky px-4 py-1.5 text-[12px] font-semibold text-ink"
              >
                Log Scanned Item <Check className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
