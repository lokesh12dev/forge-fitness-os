"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, FastForward, Play, Plus, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { formatClock } from "@/lib/utils";

// Web Audio synthesizer chime for zero-dependency local sound
function playChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Dual chime tone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gainNode.gain.setValueAtTime(0.35, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.85);
  } catch (err) {
    // Audio context may be restricted by autoplay policy
  }
}

export type RestTimerState = {
  totalSec: number;
  remainingSec: number;
  label: string;
};

export function FloatingRestTimer({
  timer,
  onAdjust,
  onSkip,
}: {
  timer: RestTimerState | null;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const chimeTriggeredRef = useRef(false);

  useEffect(() => {
    if (!timer) {
      chimeTriggeredRef.current = false;
      return;
    }

    if (timer.remainingSec <= 0 && !chimeTriggeredRef.current) {
      chimeTriggeredRef.current = true;
      if (!muted) playChime();
      if ("vibrate" in navigator) {
        navigator.vibrate?.([100, 60, 100]);
      }
    }
  }, [timer?.remainingSec, muted, timer]);

  if (!timer || timer.remainingSec <= 0) return null;

  const pct = Math.max(0, Math.min(100, ((timer.totalSec - timer.remainingSec) / timer.totalSec) * 100));

  return (
    <aside aria-label="Active rest timer" className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md animate-slide-up sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-xs">
      <div className="relative overflow-hidden rounded-2xl border border-acid/30 bg-ink-2/95 p-3.5 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Progress bar line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-white/[0.08]">
          <div
            className="h-full bg-acid transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(201,247,58,0.8)]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-wider text-acid">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" />
              <span className="truncate">{timer.label}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-numeric text-2xl font-extrabold tracking-tight text-chalk">
                {formatClock(timer.remainingSec)}
              </span>
              <span className="font-mono text-[9px] text-dim">/ {formatClock(timer.totalSec)}</span>
            </div>
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAdjust(30)}
              title="Add 30 seconds"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] text-mist hover:border-white/20 hover:text-chalk transition-colors"
            >
              +30s
            </button>
            <button
              onClick={() => onAdjust(-15)}
              title="Minus 15 seconds"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] text-mist hover:border-white/20 hover:text-chalk transition-colors"
            >
              -15s
            </button>
            <button
              onClick={() => setMuted((m) => !m)}
              title={muted ? "Unmute chime" : "Mute chime"}
              className="grid size-8 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-dim hover:text-chalk transition-colors"
            >
              {muted ? <VolumeX className="size-3.5 text-dim" /> : <Volume2 className="size-3.5 text-acid" />}
            </button>
            <button
              onClick={onSkip}
              title="Skip rest"
              className="grid size-8 place-items-center rounded-lg bg-acid text-ink hover:bg-[#d8ff5e] transition-colors"
            >
              <FastForward className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
