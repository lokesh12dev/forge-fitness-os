"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Flame, Info, Sparkles, X } from "lucide-react";
import { roundTo } from "@/lib/engine";
import { cn } from "@/lib/utils";

const PLATE_COLORS: Record<number, { bg: string; text: string; border: string; height: string }> = {
  25: { bg: "#EF4444", text: "#FFFFFF", border: "#DC2626", height: "h-24" },
  20: { bg: "#3B82F6", text: "#FFFFFF", border: "#2563EB", height: "h-22" },
  15: { bg: "#EAB308", text: "#000000", border: "#CA8A04", height: "h-20" },
  10: { bg: "#10B981", text: "#FFFFFF", border: "#059669", height: "h-16" },
  5: { bg: "#E2E8F0", text: "#0F172A", border: "#CBD5E1", height: "h-14" },
  2.5: { bg: "#334155", text: "#FFFFFF", border: "#1E293B", height: "h-12" },
  1.25: { bg: "#94A3B8", text: "#0F172A", border: "#64748B", height: "h-10" },
};

const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function plateBreakdownDetailed(totalKg: number, barKg = 20) {
  if (totalKg <= barKg) {
    return { perSide: [] as number[], remainder: Math.max(0, totalKg - barKg), barKg };
  }
  let perSideKg = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const p of AVAILABLE_PLATES) {
    while (perSideKg >= p - 0.001) {
      perSide.push(p);
      perSideKg -= p;
    }
  }
  return { perSide, remainder: Math.round(perSideKg * 100) / 100, barKg };
}

export function generateWarmupSets(workingWeightKg: number, barKg = 20) {
  if (workingWeightKg <= barKg + 5) {
    return [
      { step: 1, weight: barKg, reps: 10, label: "Empty bar warm-up", pct: 100 },
    ];
  }

  const sets = [
    { step: 1, weight: barKg, reps: 10, label: "Empty bar mobility", pct: Math.round((barKg / workingWeightKg) * 100) },
    { step: 2, weight: roundTo(Math.max(barKg, workingWeightKg * 0.45)), reps: 6, label: "Pattern groove", pct: 45 },
    { step: 3, weight: roundTo(Math.max(barKg, workingWeightKg * 0.65)), reps: 4, label: "Acclimation", pct: 65 },
    { step: 4, weight: roundTo(Math.max(barKg, workingWeightKg * 0.825)), reps: 2, label: "CNS potentiation", pct: 82 },
  ];

  // Filter out duplicates if working weight is light
  return sets.filter((s, idx, arr) => idx === 0 || s.weight > arr[idx - 1].weight);
}

export function PlateCalculatorModal({
  weightKg,
  exerciseName,
  isOpen,
  onClose,
  onSelectWeight,
}: {
  weightKg: number;
  exerciseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectWeight?: (w: number) => void;
}) {
  const [currentWeight, setCurrentWeight] = useState(weightKg || 60);
  const [barKg, setBarKg] = useState(20);
  const [activeTab, setActiveTab] = useState<"plates" | "warmup">("plates");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const breakdown = plateBreakdownDetailed(currentWeight, barKg);
  const warmups = generateWarmupSets(currentWeight, barKg);

  // Group plates per side: count each denomination
  const plateCounts = breakdown.perSide.reduce((acc, p) => {
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-panel-2 shadow-2xl overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-acid/15 text-acid">
              <Dumbbell className="size-4" />
            </span>
            <div>
              <h3 className="text-[14px] font-bold text-chalk">Barbell & Plate Math</h3>
              <p className="font-mono text-[9px] uppercase tracking-wider text-dim">{exerciseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close plate calculator"
            className="grid size-8 place-items-center rounded-full bg-white/[0.04] text-dim hover:text-chalk transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Weight & Bar weight picker */}
        <div className="px-5 pt-4 pb-2 bg-ink/40 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Total barbell load</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-numeric text-3xl font-extrabold text-chalk">{currentWeight}</span>
                <span className="font-mono text-sm text-acid font-semibold">kg</span>
              </div>
            </div>

            {/* Quick bar weight options */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/30 p-1">
              {[
                { w: 20, label: "20kg Standard" },
                { w: 15, label: "15kg Women's" },
                { w: 10, label: "10kg EZ" },
              ].map((b) => (
                <button
                  key={b.w}
                  onClick={() => setBarKg(b.w)}
                  className={cn(
                    "rounded-lg px-2 py-1 font-mono text-[9px] transition-colors",
                    barKg === b.w ? "bg-acid text-ink font-bold" : "text-mist hover:text-chalk",
                  )}
                >
                  {b.w}kg
                </button>
              ))}
            </div>
          </div>

          {/* Quick weight adjustment stepper */}
          <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-white/[0.04]">
            {[-10, -2.5, -1.25, 1.25, 2.5, 10].map((delta) => (
              <button
                key={delta}
                onClick={() => setCurrentWeight((w) => Math.max(barKg, roundTo(w + delta)))}
                className="flex-1 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-dim hover:text-chalk transition-colors"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switch: Plate Visualizer vs Warmup sets */}
        <div className="flex border-b border-white/[0.06] bg-black/20 px-5 pt-2">
          <button
            onClick={() => setActiveTab("plates")}
            className={cn(
              "flex-1 pb-2.5 text-center font-mono text-[10px] uppercase tracking-wider transition-colors border-b-2",
              activeTab === "plates" ? "border-acid text-acid font-bold" : "border-transparent text-dim hover:text-mist",
            )}
          >
            Plates Per Side ({breakdown.perSide.reduce((a, b) => a + b, 0)} kg)
          </button>
          <button
            onClick={() => setActiveTab("warmup")}
            className={cn(
              "flex-1 pb-2.5 text-center font-mono text-[10px] uppercase tracking-wider transition-colors border-b-2",
              activeTab === "warmup" ? "border-acid text-acid font-bold" : "border-transparent text-dim hover:text-mist",
            )}
          >
            Warm-up Ramp ({warmups.length} sets)
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 max-h-[380px] overflow-y-auto no-scrollbar">
          {activeTab === "plates" ? (
            <div className="space-y-4">
              {/* Visual barbell sleeve graphic */}
              <div className="relative flex items-center justify-center py-6 px-2 bg-black/40 rounded-2xl border border-white/[0.06] overflow-x-auto">
                {/* Barbell sleeve shaft */}
                <div className="flex items-center h-28">
                  {/* Inside collar */}
                  <div className="w-4 h-16 rounded-sm bg-gradient-to-r from-neutral-600 to-neutral-400 border border-neutral-700 shadow-md" />
                  {/* Sleeve */}
                  <div className="flex items-center -space-x-1 pl-1">
                    {breakdown.perSide.map((plateWeight, i) => {
                      const spec = PLATE_COLORS[plateWeight] ?? { bg: "#475569", text: "#fff", border: "#334155", height: "h-14" };
                      return (
                        <div
                          key={i}
                          className={cn(
                            "w-6 rounded-md border flex items-center justify-center font-mono font-black text-[9px] shadow-lg transition-transform",
                            spec.height,
                          )}
                          style={{
                            background: spec.bg,
                            borderColor: spec.border,
                            color: spec.text,
                          }}
                          title={`${plateWeight} kg plate`}
                        >
                          <span className="-rotate-90 select-none whitespace-nowrap">{plateWeight}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Outer collar */}
                  <div className="w-3.5 h-10 rounded-r-md bg-neutral-500 border border-neutral-600 ml-1.5" />
                </div>
              </div>

              {/* Plate count summary list */}
              <div>
                <p className="label-mono mb-2 text-mist">Load each side with:</p>
                {breakdown.perSide.length === 0 ? (
                  <p className="text-[12px] text-dim py-2">Bare bar only ({barKg} kg). No plates needed.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(plateCounts)
                      .sort((a, b) => Number(b[0]) - Number(a[0]))
                      .map(([pWeight, count]) => {
                        const w = Number(pWeight);
                        const spec = PLATE_COLORS[w];
                        return (
                          <div
                            key={w}
                            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="size-3 rounded-full"
                                style={{ background: spec?.bg ?? "#64748B" }}
                              />
                              <span className="font-numeric font-bold text-chalk text-[13px]">{w} kg</span>
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-acid">
                              × {count} <span className="text-[9px] text-dim font-normal">({count * w} kg)</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
                {breakdown.remainder > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/[0.05] p-2.5 text-[11px] text-amber">
                    <Info className="size-3.5 shrink-0" />
                    <span>Remainder {breakdown.remainder} kg cannot be evenly divided with available plates.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="label-mono mb-2 text-mist">Optimal warm-up ramp up to working weight:</p>
              {warmups.map((w) => (
                <div
                  key={w.step}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-white/[0.06] font-mono text-[9px] text-dim">
                      {w.step}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-semibold text-chalk">
                        {w.weight} kg × {w.reps} reps
                      </p>
                      <p className="font-mono text-[8.5px] text-dim uppercase tracking-wider">{w.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9.5px] text-mist">{w.pct}%</span>
                    {onSelectWeight && (
                      <button
                        onClick={() => {
                          onSelectWeight(w.weight);
                          onClose();
                        }}
                        className="rounded-lg bg-acid/15 px-2.5 py-1 font-mono text-[9px] font-bold text-acid hover:bg-acid/25 transition-colors"
                      >
                        Load
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-ink/60 px-5 py-3">
          <span className="font-mono text-[9px] text-dim">
            Bar: {barKg}kg · Plates: {breakdown.perSide.reduce((a, b) => a + b, 0) * 2}kg
          </span>
          <button
            onClick={() => {
              if (onSelectWeight) onSelectWeight(currentWeight);
              onClose();
            }}
            className="rounded-full bg-acid px-5 py-2 text-[12px] font-bold text-ink hover:bg-[#d8ff5e] transition-colors shadow-md"
          >
            Apply {currentWeight} kg
          </button>
        </div>
      </div>
    </div>
  );
}
