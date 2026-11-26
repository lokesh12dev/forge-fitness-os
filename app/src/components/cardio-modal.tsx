"use client";

import { useState, useMemo } from "react";
import {
  Activity, Check, ChevronRight, Clock, Flame, Footprints,
  Heart, Play, RotateCcw, Timer, Trophy, X, Zap
} from "lucide-react";
import {
  calculateCardioCalories,
  calculateHeartRateZones,
  calculatePace,
  MODALITY_METS,
  type CardioModality,
} from "@/lib/cardio-engine";
import { cn } from "@/lib/utils";

interface CardioModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (entry: {
    modality: CardioModality;
    durationMinutes: number;
    distanceKm: number;
    calories: number;
    avgHr?: number;
  }) => void;
}

export function CardioModal({ open, onClose, onSave }: CardioModalProps) {
  const [modality, setModality] = useState<CardioModality>("treadmill");
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [distanceKm, setDistanceKm] = useState<number>(3.2);
  const [avgHr, setAvgHr] = useState<number>(142);
  const [isSaved, setIsSaved] = useState(false);

  const zones = useMemo(() => calculateHeartRateZones(28, 56), []);
  const calories = useMemo(
    () => calculateCardioCalories(modality, durationMinutes, 78),
    [modality, durationMinutes]
  );
  const pace = useMemo(
    () => calculatePace(distanceKm, durationMinutes * 60),
    [distanceKm, durationMinutes]
  );

  const currentZone = useMemo(() => {
    if (!avgHr) return null;
    if (avgHr < zones.zone1.min) return { name: "Warmup", color: "text-dim" };
    if (avgHr <= zones.zone1.max) return { name: "Zone 1 · Recovery", color: "text-sky" };
    if (avgHr <= zones.zone2.max) return { name: "Zone 2 · Aerobic Base", color: "text-mint" };
    if (avgHr <= zones.zone3.max) return { name: "Zone 3 · Tempo", color: "text-acid" };
    if (avgHr <= zones.zone4.max) return { name: "Zone 4 · Threshold", color: "text-amber" };
    return { name: "Zone 5 · Anaerobic Peak", color: "text-rose-400" };
  }, [avgHr, zones]);

  if (!open) return null;

  function handleSave() {
    setIsSaved(true);
    if (onSave) {
      onSave({
        modality,
        durationMinutes,
        distanceKm,
        calories,
        avgHr,
      });
    }
    setTimeout(() => {
      setIsSaved(false);
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
              <span className="grid size-7 place-items-center rounded-lg bg-acid/10 text-acid">
                <Footprints className="size-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                Cardio &amp; Conditioning (A12)
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-1">
              Log Cardio Activity
            </h3>
            <p className="text-[12px] text-mist mt-0.5">
              Real-time pace calculation, ACSM MET expenditure, and physiological HR zones.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {!isSaved ? (
          <div className="mt-5 space-y-4">
            {/* Modality Chips */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(MODALITY_METS) as CardioModality[]).map((key) => {
                const info = MODALITY_METS[key];
                const active = modality === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModality(key)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all",
                      active
                        ? "bg-acid text-ink font-bold shadow-[0_0_15px_rgba(201,247,58,0.25)]"
                        : "border border-white/10 bg-white/[0.03] text-mist hover:border-white/20 hover:text-chalk"
                    )}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <span className="flex items-center justify-center gap-1 font-mono text-[8.5px] uppercase tracking-wider text-dim">
                  <Flame className="size-3 text-flame" /> Burned
                </span>
                <p className="font-numeric text-xl font-black text-chalk mt-1">
                  {calories} <span className="text-[10px] font-normal text-dim">kcal</span>
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <span className="flex items-center justify-center gap-1 font-mono text-[8.5px] uppercase tracking-wider text-dim">
                  <Timer className="size-3 text-sky" /> Avg Pace
                </span>
                <p className="font-numeric text-lg font-bold text-chalk mt-1">
                  {pace.paceFormatted}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <span className="flex items-center justify-center gap-1 font-mono text-[8.5px] uppercase tracking-wider text-dim">
                  <Activity className="size-3 text-acid" /> Speed
                </span>
                <p className="font-numeric text-xl font-black text-chalk mt-1">
                  {pace.speedKmh} <span className="text-[10px] font-normal text-dim">km/h</span>
                </p>
              </div>
            </div>

            {/* Inputs Form */}
            <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim block mb-1">
                    Duration (Minutes)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-numeric text-[14px] text-chalk focus:border-acid focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim block mb-1">
                    Distance (Kilometers)
                  </span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={100}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-numeric text-[14px] text-chalk focus:border-acid focus:outline-none"
                  />
                </label>
              </div>

              <label className="block">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                    Average Heart Rate (BPM)
                  </span>
                  {currentZone && (
                    <span className={cn("font-mono text-[9.5px] font-bold", currentZone.color)}>
                      {currentZone.name}
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={80}
                  max={200}
                  value={avgHr}
                  onChange={(e) => setAvgHr(parseInt(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-acid"
                />
                <div className="flex justify-between font-mono text-[8px] text-dim mt-1">
                  <span>80 bpm (Z1)</span>
                  <span className="text-acid font-bold">{avgHr} BPM</span>
                  <span>200 bpm (Z5)</span>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-acid font-bold text-[12.5px] text-ink shadow-[0_0_20px_rgba(201,247,58,0.25)] hover:bg-[#b8e330] transition-colors"
            >
              <Check className="size-4 stroke-[3]" /> Log {durationMinutes}m Cardio Session
            </button>
          </div>
        ) : (
          <div className="mt-6 text-center py-4 space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-acid/15 text-acid">
              <Check className="size-6 stroke-[3]" />
            </div>
            <h4 className="font-display text-lg font-bold text-chalk">
              Cardio Logged!
            </h4>
            <p className="text-[12px] text-mist max-w-sm mx-auto">
              Added {distanceKm} km ({durationMinutes} mins) and {calories} kcal to today&apos;s training expenditure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
