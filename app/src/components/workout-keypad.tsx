"use client";

import { useState } from "react";
import { Check, ChevronDown, Delete, Minus, Plus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type SetType = "warmup" | "normal" | "drop" | "failure";

export type SetData = {
  id: string;
  setIndex: number;
  type?: SetType;
  weightKg: number;
  reps: number;
  rpe?: number;
  isPR?: boolean;
  completedAt?: string;
  isCompleted: boolean;
};

export function SetRow({
  index,
  setData,
  previousWeight,
  previousReps,
  targetRepsMin,
  targetRepsMax,
  targetWeight,
  onLog,
  onUpdate,
  onDelete,
  onOpenPlateCalc,
}: {
  index: number;
  setData: SetData;
  previousWeight?: number;
  previousReps?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetWeight?: number;
  onLog: (weight: number, reps: number, rpe: number, type: SetType) => void;
  onUpdate?: (weight: number, reps: number, rpe: number, type: SetType) => void;
  onDelete?: () => void;
  onOpenPlateCalc?: () => void;
}) {
  const [weight, setWeight] = useState<string>(
    setData.isCompleted
      ? String(setData.weightKg)
      : setData.weightKg > 0
      ? String(setData.weightKg)
      : previousWeight && previousWeight > 0
      ? String(previousWeight)
      : targetWeight && targetWeight > 0
      ? String(targetWeight)
      : "",
  );

  const [reps, setReps] = useState<string>(
    setData.isCompleted
      ? String(setData.reps)
      : setData.reps > 0
      ? String(setData.reps)
      : previousReps && previousReps > 0
      ? String(previousReps)
      : String(targetRepsMin ?? 8),
  );

  const [rpe, setRpe] = useState<number>(setData.rpe ?? 8);
  const [type, setType] = useState<SetType>(setData.type ?? (index === 0 && previousWeight && previousWeight > 50 ? "warmup" : "normal"));

  // 1-tap logging: if user taps checkmark directly without typing, it uses the ghost / target values
  const handleCheck = () => {
    if (setData.isCompleted) {
      if (onDelete) onDelete();
      return;
    }

    const finalWeight = Number(weight) || previousWeight || targetWeight || 0;
    const finalReps = Number(reps) || previousReps || targetRepsMin || 8;
    onLog(finalWeight, finalReps, rpe, type);
  };

  const cycleType = () => {
    if (setData.isCompleted) return;
    const types: SetType[] = ["normal", "warmup", "drop", "failure"];
    const nextIdx = (types.indexOf(type) + 1) % types.length;
    setType(types[nextIdx]);
  };

  const ghostWeight = previousWeight ?? targetWeight ?? 0;
  const ghostReps = previousReps ?? targetRepsMin ?? 8;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200",
        setData.isCompleted
          ? "border-mint/25 bg-mint/[0.04]"
          : "border-white/[0.06] bg-black/20 hover:border-white/[0.12]",
      )}
    >
      {/* Set Number & Type Badge */}
      <button
        onClick={cycleType}
        title="Tap to toggle set type (Normal, Warmup, Drop, Failure)"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold transition-colors select-none",
          type === "warmup"
            ? "border border-amber/30 bg-amber/15 text-amber"
            : type === "drop"
            ? "border border-sky/30 bg-sky/15 text-sky"
            : type === "failure"
            ? "border border-flame/30 bg-flame/15 text-flame"
            : "border border-white/10 bg-white/[0.04] text-dim group-hover:text-chalk",
        )}
      >
        {type === "warmup" ? "W" : type === "drop" ? "D" : type === "failure" ? "F" : index + 1}
      </button>

      {/* Previous Performance Ghost Watermark */}
      <div className="hidden sm:flex flex-col min-w-[70px]">
        <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Previous</span>
        <span className="font-numeric text-[11px] text-mist font-medium">
          {ghostWeight > 0 ? `${ghostWeight}kg × ${ghostReps}` : "—"}
        </span>
      </div>

      {/* Weight Input Field + Plate Calc Button */}
      <div className="relative flex-1 min-w-[85px]">
        <input
          type="number"
          step="any"
          disabled={setData.isCompleted}
          placeholder={ghostWeight > 0 ? String(ghostWeight) : "0"}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className={cn(
            "w-full rounded-lg border bg-white/[0.03] px-2.5 py-1.5 text-right font-numeric text-[14px] font-bold text-chalk transition-colors focus:border-acid focus:outline-none focus:ring-1 focus:ring-acid/40 disabled:opacity-80 placeholder:text-dim/40",
            setData.isCompleted ? "border-transparent" : "border-white/[0.08]",
          )}
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase text-dim">
          kg
        </span>
        {onOpenPlateCalc && !setData.isCompleted && (
          <button
            onClick={onOpenPlateCalc}
            title="Plate calculator"
            className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center text-[9px] font-mono text-acid bg-black/60 px-1 rounded"
          >
            calc
          </button>
        )}
      </div>

      {/* Multiply symbol */}
      <span className="font-mono text-[11px] text-dim select-none">×</span>

      {/* Reps Input Field */}
      <div className="relative w-[65px] sm:w-[75px]">
        <input
          type="number"
          disabled={setData.isCompleted}
          placeholder={String(ghostReps)}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className={cn(
            "w-full rounded-lg border bg-white/[0.03] px-2 py-1.5 text-center font-numeric text-[14px] font-bold text-chalk transition-colors focus:border-acid focus:outline-none focus:ring-1 focus:ring-acid/40 disabled:opacity-80 placeholder:text-dim/40",
            setData.isCompleted ? "border-transparent" : "border-white/[0.08]",
          )}
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 font-mono text-[8px] uppercase text-dim">
          reps
        </span>
      </div>

      {/* RPE Selector / Badge */}
      <select
        disabled={setData.isCompleted}
        value={rpe}
        onChange={(e) => setRpe(Number(e.target.value))}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-1.5 py-1.5 font-mono text-[10px] text-mist focus:border-acid focus:outline-none disabled:opacity-70"
      >
        <option value={6}>RPE 6</option>
        <option value={7}>RPE 7</option>
        <option value={7.5}>RPE 7.5</option>
        <option value={8}>RPE 8</option>
        <option value={8.5}>RPE 8.5</option>
        <option value={9}>RPE 9</option>
        <option value={9.5}>RPE 9.5</option>
        <option value={10}>RPE 10</option>
      </select>

      {/* Checkmark 1-Tap Log Button */}
      <button
        onClick={handleCheck}
        title={setData.isCompleted ? "Completed (tap to undo)" : "Tap to log set"}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl transition-all select-none shadow-md",
          setData.isCompleted
            ? "bg-mint text-ink font-bold hover:bg-mint/80"
            : "border border-white/10 bg-white/[0.05] text-dim hover:border-acid hover:bg-acid hover:text-ink hover:scale-105",
        )}
      >
        <Check className={cn("size-4", setData.isCompleted && "stroke-[3]")} />
      </button>
    </div>
  );
}

export function NumberStepper({
  value,
  onChange,
  step = 2.5,
  min = 0,
  max = 500,
  label = "Weight",
  unit = "kg",
}: {
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/30 p-1">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-mist hover:text-chalk active:scale-95 transition-all"
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-3.5" />
      </button>
      <div className="min-w-[50px] text-center font-numeric text-sm font-bold text-chalk">
        {value}
        <span className="ml-0.5 text-[9px] font-normal text-dim">{unit}</span>
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="grid size-8 place-items-center rounded-lg bg-white/[0.04] text-mist hover:text-chalk active:scale-95 transition-all"
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
