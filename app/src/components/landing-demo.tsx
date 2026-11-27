"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight, BatteryLow, Check, Dumbbell, Gauge, Play, RefreshCw,
  Sparkles, Timer, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Equipment = "full" | "dumbbells" | "bodyweight";
type Time = 25 | 45 | 70;

type Slot = {
  name: string;
  muscle: string;
  alt: Record<Equipment, string>;
  sets: number;
  reps: string;
  rest: number;
};

const SLOTS: Slot[] = [
  { name: "Barbell Back Squat", muscle: "Quads", alt: { full: "Barbell Back Squat", dumbbells: "Dumbbell Front Squat", bodyweight: "Tempo Air Squat" }, sets: 4, reps: "5–6", rest: 180 },
  { name: "Barbell Bench Press", muscle: "Chest", alt: { full: "Barbell Bench Press", dumbbells: "Dumbbell Bench Press", bodyweight: "Deficit Push-Up" }, sets: 4, reps: "5–6", rest: 180 },
  { name: "Romanian Deadlift", muscle: "Hamstrings", alt: { full: "Romanian Deadlift", dumbbells: "DB Romanian Deadlift", bodyweight: "Single-Leg Hip Hinge" }, sets: 3, reps: "8–10", rest: 120 },
  { name: "Seated Cable Row", muscle: "Back", alt: { full: "Seated Cable Row", dumbbells: "One-Arm DB Row", bodyweight: "Inverted Row" }, sets: 3, reps: "8–10", rest: 90 },
  { name: "Dumbbell Shoulder Press", muscle: "Shoulders", alt: { full: "Dumbbell Shoulder Press", dumbbells: "Dumbbell Shoulder Press", bodyweight: "Pike Push-Up" }, sets: 3, reps: "8–10", rest: 90 },
  { name: "Walking Lunge", muscle: "Quads", alt: { full: "Walking Lunge", dumbbells: "DB Walking Lunge", bodyweight: "Reverse Lunge" }, sets: 3, reps: "10–12", rest: 75 },
  { name: "Cable Lateral Raise", muscle: "Shoulders", alt: { full: "Cable Lateral Raise", dumbbells: "DB Lateral Raise", bodyweight: "Wall Lean Lateral Raise" }, sets: 3, reps: "12–15", rest: 60 },
  { name: "Cable Crunch", muscle: "Core", alt: { full: "Cable Crunch", dumbbells: "Weighted Crunch", bodyweight: "Hollow Body Hold" }, sets: 3, reps: "12–15", rest: 60 },
];

const TIME_CFG: Record<Time, { count: number; restScale: number; setsScale: number }> = {
  25: { count: 4, restScale: 0.4, setsScale: 0.75 },
  45: { count: 5, restScale: 0.7, setsScale: 1 },
  70: { count: 6, restScale: 1, setsScale: 1 },
};

const EQUIP_LABEL: Record<Equipment, string> = {
  full: "Full gym",
  dumbbells: "Dumbbells only",
  bodyweight: "Hotel room",
};

export function LandingDemo() {
  const [time, setTime] = useState<Time>(45);
  const [readiness, setReadiness] = useState(82);
  const [equipment, setEquipment] = useState<Equipment>("full");

  const cfg = TIME_CFG[time];
  const rows = useMemo(() => SLOTS.slice(0, cfg.count), [cfg.count]);
  const lowReadiness = readiness < 68;
  const highReadiness = readiness >= 86;
  const loadMod = lowReadiness ? "−10% load" : highReadiness ? "+2.5 kg top set" : "hold load";
  const rest = Math.round(90 * cfg.restScale);
  const supserset = time === 25;
  const totalSets = rows.reduce((a, r) => a + Math.max(2, Math.round(r.sets * cfg.setsScale)), 0);
  const estMin = Math.round(totalSets * (supserset ? 1.9 : 3.1) + 6);

  const note = lowReadiness
    ? `Sleep debt detected. Keeping every set, capping top sets at RPE 7 and trimming 10% off the bar. You'll leave fresher than you came in.`
    : highReadiness
      ? `Green light. Adding 2.5 kg to your top set and one clean rep to the back-off work. If bar speed drops, the engine pulls it back automatically.`
      : `Solid readiness. Holding load, adding one rep per set. The engine will re-check after every set and adjust if RPE drifts.`;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-panel/90 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-acid/70" />
          </span>
          <span className="ml-1 font-mono text-[8px] uppercase tracking-[0.14em] text-dim">forge / today&apos;s session</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-acid/20 bg-acid/[0.06] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-acid">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> Live demo
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
        {/* CONTROLS */}
        <div className="border-b border-white/[0.07] p-4 md:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2">
            <p className="label-mono">Adaptive inputs</p>
            <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
              <RefreshCw className="size-2.5 text-acid" /> re-plans instantly
            </span>
          </div>

          {/* time */}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-mist"><Timer className="size-3 text-sky" /> How much time do you have?</span>
              <span className="font-numeric text-[10px] text-chalk">{time} min</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([25, 45, 70] as Time[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-xl border py-2 font-mono text-[9px] uppercase tracking-[0.1em] transition-all",
                    time === t ? "border-acid/30 bg-acid/10 text-acid" : "border-white/[0.07] bg-white/[0.02] text-dim hover:text-mist",
                  )}
                >
                  {t} min
                </button>
              ))}
            </div>
          </div>

          {/* readiness */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-mist"><Gauge className="size-3 text-acid" /> Readiness today</span>
              <span className={cn("font-numeric text-[10px]", readiness >= 80 ? "text-acid" : readiness >= 68 ? "text-amber" : "text-flame")}>{readiness}/100</span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              value={readiness}
              onChange={(e) => setReadiness(Number(e.target.value))}
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-acid [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-acid [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(201,247,58,0.6)]"
              aria-label="Readiness"
            />
            <div className="mt-2 flex items-center gap-1.5">
              <BatteryLow className="size-3 text-dim" />
              <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">
                {lowReadiness ? "Under-recovered · protect the session" : highReadiness ? "Primed · push the top set" : "Steady · hold and progress reps"}
              </span>
            </div>
          </div>

          {/* equipment */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-mist"><Dumbbell className="size-3 text-grape" /> Equipment</span>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">swaps, not skips</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(Object.keys(EQUIP_LABEL) as Equipment[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEquipment(e)}
                  className={cn(
                    "rounded-xl border px-1 py-2 font-mono text-[8px] uppercase tracking-[0.06em] transition-all",
                    equipment === e ? "border-grape/30 bg-grape/10 text-grape" : "border-white/[0.07] bg-white/[0.02] text-dim hover:text-mist",
                  )}
                >
                  {EQUIP_LABEL[e]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-acid/15 bg-acid/[0.04] p-3">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-acid" />
            <p className="text-[10.5px] leading-relaxed text-mist">{note}</p>
          </div>
        </div>

        {/* OUTPUT */}
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label-mono mb-1">Today&apos;s prescription</p>
              <h3 className="font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-chalk">
                {time === 25 ? "Express Full Body" : time === 70 ? "Full Body · Extended" : "Full Body · A"}
              </h3>
            </div>
            <span className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em]",
              lowReadiness ? "border-amber/25 bg-amber/10 text-amber" : "border-acid/25 bg-acid/10 text-acid",
            )}>
              {loadMod}
            </span>
          </div>

          <div className="mt-3 space-y-1.5">
            {rows.map((row, i) => {
              const name = row.alt[equipment];
              const swapped = name !== row.name;
              return (
                <div key={row.name} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                  <span className="w-4 font-mono text-[8px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10.5px] font-medium text-chalk/90">{name}</p>
                    <p className="truncate font-mono text-[7px] uppercase tracking-[0.08em] text-dim">
                      {row.muscle}
                      {swapped && <span className="ml-1 text-grape">· swapped</span>}
                      {supserset && i % 2 === 0 && <span className="ml-1 text-acid">· superset {(i / 2 | 0) + 1}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 font-numeric text-[9px] text-mist">
                    {Math.max(2, Math.round(row.sets * cfg.setsScale))} × {row.reps}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              { label: "Est. time", value: `${estMin}m` },
              { label: "Working sets", value: totalSets },
              { label: "Rest", value: `${rest}s` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/[0.05] bg-black/20 px-2 py-1.5 text-center">
                <p className="font-numeric text-[12px] font-semibold leading-none text-chalk">{s.value}</p>
                <p className="mt-1 font-mono text-[6.5px] uppercase tracking-[0.1em] text-dim">{s.label}</p>
              </div>
            ))}
          </div>

          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-acid py-2.5 text-[11px] font-semibold text-ink transition-colors hover:bg-acid-deep">
            <Play className="size-3.5" /> Start this session
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 font-mono text-[7px] uppercase tracking-[0.1em] text-dim">
            <Check className="size-2.5 text-acid" /> Adjusts after every logged set
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] bg-black/25 px-4 py-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
          <Zap className="size-2.5 text-acid" /> One engine · training, fuel, recovery
        </span>
        <a href="/login" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid">
          Try the full app <ArrowRight className="size-2.5" />
        </a>
      </div>
    </div>
  );
}
