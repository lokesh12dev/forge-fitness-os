"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Check, HeartPulse, Moon, Sparkles, X, Zap, ChevronRight,
} from "lucide-react";
import { saveDailyCheckIn } from "@/app/actions";
import { readinessScore, readinessVerdict } from "@/lib/engine";
import { cn } from "@/lib/utils";

type CheckInProps = {
  isOpen: boolean;
  onClose: () => void;
  initialValues?: {
    sleepHours?: number | null;
    hrv?: number | null;
    restingHr?: number | null;
    soreness?: number;
    weightKg?: number;
  };
};

export function ReadinessCheckInModal({ isOpen, onClose, initialValues }: CheckInProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [sleep, setSleep] = useState<number>(initialValues?.sleepHours ?? 7.5);
  const [hrv, setHrv] = useState<number>(initialValues?.hrv ?? 62);
  const [restingHr, setRestingHr] = useState<number>(initialValues?.restingHr ?? 56);
  const [soreness, setSoreness] = useState<number>(initialValues?.soreness ?? 2);
  const [weightKg, setWeightKg] = useState<string>(initialValues?.weightKg ? String(initialValues.weightKg) : "");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live score computation
  const liveScore = readinessScore({
    sleepHours: sleep,
    hrv,
    restingHr,
    soreness,
  });
  const verdict = readinessVerdict(liveScore);

  const applyPreset = (preset: "primed" | "normal" | "fatigued") => {
    if (preset === "primed") {
      setSleep(8.5);
      setHrv(75);
      setRestingHr(52);
      setSoreness(1);
    } else if (preset === "normal") {
      setSleep(7.2);
      setHrv(62);
      setRestingHr(56);
      setSoreness(3);
    } else {
      setSleep(5.5);
      setHrv(48);
      setRestingHr(64);
      setSoreness(7);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveDailyCheckIn({
        sleepHours: sleep,
        hrv,
        restingHr,
        soreness,
        weightKg: weightKg ? Number(weightKg) : undefined,
      });

      if (res.ok) {
        setToast(`Check-in saved! Readiness is ${res.score} (${verdict.label})`);
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 600);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close backdrop"
      />
      <div className="animate-fade-up relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-acid/15 text-acid">
                <HeartPulse className="size-3" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                Daily Check-in
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk">
              Log Physiological Signals
            </h3>
            <p className="mt-1 text-[11.5px] text-mist">
              Calibrate your readiness score and auto-regulate today&apos;s training weights.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close check-in modal"
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Live Score Banner */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div
              className="grid size-12 place-items-center rounded-xl font-numeric text-xl font-bold"
              style={{
                background: liveScore >= 85 ? "rgba(201,247,58,0.15)" : liveScore >= 70 ? "rgba(123,224,173,0.15)" : "rgba(255,209,102,0.15)",
                color: liveScore >= 85 ? "#C9F73A" : liveScore >= 70 ? "#7BE0AD" : "#FFD166",
              }}
            >
              {liveScore}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-chalk">{verdict.label}</span>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wider"
                  style={{
                    background: liveScore >= 85 ? "rgba(201,247,58,0.12)" : "rgba(255,255,255,0.08)",
                    color: liveScore >= 85 ? "#C9F73A" : "#D0D6E0",
                  }}
                >
                  {verdict.coachAction}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-mist">{verdict.advice}</p>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset("primed")}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-mist hover:border-acid/40 hover:text-acid transition-colors"
          >
            Primed (8.5h, low sore)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("normal")}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-mist hover:border-white/20 hover:text-chalk transition-colors"
          >
            Normal (7h, mild)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("fatigued")}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-mist hover:border-amber/40 hover:text-amber transition-colors"
          >
            Fatigued (&lt;6h, high sore)
          </button>
        </div>

        {/* Inputs */}
        <div className="mt-5 space-y-4">
          {/* Sleep Hours */}
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-chalk">
                <Moon className="size-3.5 text-sky" /> Sleep Duration
              </label>
              <span className="font-numeric text-[14px] font-semibold text-acid">
                {sleep.toFixed(1)} hrs
              </span>
            </div>
            <input
              type="range"
              min="4"
              max="11"
              step="0.5"
              value={sleep}
              onChange={(e) => setSleep(Number(e.target.value))}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-acid"
            />
            <div className="mt-1 flex justify-between font-mono text-[8px] text-dim">
              <span>4.0h (Deficit)</span>
              <span>7.5h (Optimal)</span>
              <span>11.0h</span>
            </div>
          </div>

          {/* HRV & Resting HR Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <label className="flex items-center justify-between text-[11px] font-medium text-chalk">
                <span className="flex items-center gap-1">
                  <Activity className="size-3 text-mint" /> HRV
                </span>
                <span className="font-mono text-[8px] text-dim">ms</span>
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHrv((h) => Math.max(20, h - 5))}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 text-dim hover:text-chalk"
                >
                  −
                </button>
                <input
                  type="number"
                  value={hrv}
                  onChange={(e) => setHrv(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-numeric text-base font-semibold text-chalk focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setHrv((h) => Math.min(180, h + 5))}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 text-dim hover:text-chalk"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center font-mono text-[7.5px] uppercase tracking-wider text-dim">
                Baseline ~62ms
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <label className="flex items-center justify-between text-[11px] font-medium text-chalk">
                <span className="flex items-center gap-1">
                  <HeartPulse className="size-3 text-flame" /> Resting HR
                </span>
                <span className="font-mono text-[8px] text-dim">bpm</span>
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRestingHr((r) => Math.max(35, r - 2))}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 text-dim hover:text-chalk"
                >
                  −
                </button>
                <input
                  type="number"
                  value={restingHr}
                  onChange={(e) => setRestingHr(Number(e.target.value))}
                  className="w-full bg-transparent text-center font-numeric text-base font-semibold text-chalk focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRestingHr((r) => Math.min(120, r + 2))}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 text-dim hover:text-chalk"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center font-mono text-[7.5px] uppercase tracking-wider text-dim">
                Baseline ~56 bpm
              </p>
            </div>
          </div>

          {/* Soreness Level */}
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-chalk">
                <Zap className="size-3.5 text-amber" /> Muscle Soreness
              </label>
              <span className="font-numeric text-[13px] font-semibold text-amber">
                {soreness} / 10 · {soreness <= 2 ? "Fresh" : soreness <= 5 ? "Moderate" : soreness <= 8 ? "Heavy" : "Crippled"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={soreness}
              onChange={(e) => setSoreness(Number(e.target.value))}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-amber"
            />
            <div className="mt-1 flex justify-between font-mono text-[8px] text-dim">
              <span>0 (None)</span>
              <span>5 (Noticeable)</span>
              <span>10 (Severe)</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
          <p className="text-[10px] text-dim">
            Readiness propagates immediately to active and upcoming workout loads.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-acid px-6 text-[13px] font-semibold text-ink disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save & Update Readiness"} <Check className="size-4" />
          </button>
        </div>

        {toast && (
          <div className="animate-fade-in mt-3 rounded-xl border border-acid/20 bg-acid/[0.08] p-2.5 text-center text-[11px] font-medium text-acid">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReadinessCheckInTrigger({
  currentScore,
  hasCheckedInToday,
  initialValues,
}: {
  currentScore: number;
  hasCheckedInToday: boolean;
  initialValues?: {
    sleepHours?: number | null;
    hrv?: number | null;
    restingHr?: number | null;
    soreness?: number;
    weightKg?: number;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-chalk hover:border-acid/40 hover:bg-acid/[0.06] hover:text-acid transition-colors"
      >
        <HeartPulse className="size-3 text-acid" />
        {hasCheckedInToday ? "Update Check-in" : "Daily Check-in"}
        <ChevronRight className="size-3 text-dim" />
      </button>

      <ReadinessCheckInModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialValues={initialValues}
      />
    </>
  );
}
