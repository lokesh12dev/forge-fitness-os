"use client";

import { useState } from "react";
import {
  Check, Copy, Download, Flame, Layers, Share2, Sparkles, Trophy, X, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  workoutTitle?: string;
  volumeKg?: number;
  setsCount?: number;
  streakDays?: number;
  prHighlight?: string;
  userName?: string;
}

export function ShareCardModal({
  open,
  onClose,
  workoutTitle = "PPL Push Day (Chest Focus)",
  volumeKg = 14200,
  setsCount = 18,
  streakDays = 18,
  prHighlight = "Bench Press: 110 kg (New 1RM)",
  userName = "Alex Rivera",
}: ShareCardModalProps) {
  const [format, setFormat] = useState<"square" | "story">("square");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function copyCard() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="animate-scale-in relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-acid/10 text-acid">
                <Share2 className="size-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                Social ShareCard (G2, G3)
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-1">
              Share Achievement
            </h3>
            <p className="text-[12px] text-mist mt-0.5">
              Export an aesthetic, uncompressed workout card for Instagram, X, or training logs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setFormat("square")}
            className={cn(
              "rounded-xl px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all",
              format === "square"
                ? "bg-acid text-ink font-bold"
                : "border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
            )}
          >
            Square (1:1)
          </button>
          <button
            type="button"
            onClick={() => setFormat("story")}
            className={cn(
              "rounded-xl px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all",
              format === "story"
                ? "bg-acid text-ink font-bold"
                : "border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
            )}
          >
            Story (9:16)
          </button>
        </div>

        {/* The Visual Share Card */}
        <div
          className={cn(
            "relative mx-auto mt-4 overflow-hidden rounded-3xl border border-white/15 bg-ink p-6 transition-all shadow-2xl flex flex-col justify-between",
            format === "square" ? "aspect-square w-full" : "aspect-[9/14] w-[85%]"
          )}
        >
          {/* Background Ambient Glow */}
          <div className="pointer-events-none absolute -right-16 -top-20 size-60 rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.18),transparent_65%)]" />

          {/* Top Brand Header */}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-acid text-ink font-display font-black text-sm">
                F
              </span>
              <span className="font-display font-black text-sm tracking-tight text-chalk">
                FORGE<span className="text-acid">.</span>
              </span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {/* Middle Content */}
          <div className="relative my-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-acid/30 bg-acid/10 px-3 py-1 font-mono text-[9.5px] uppercase tracking-wider text-acid font-bold">
              <Trophy className="size-3 text-acid" /> Personal Record
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-chalk sm:text-3xl">
              {workoutTitle}
            </h2>
            <p className="font-mono text-[12px] font-bold text-acid">
              ⭐ {prHighlight}
            </p>
          </div>

          {/* Bottom Stats Grid */}
          <div className="relative grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <p className="font-mono text-[8px] uppercase tracking-wider text-dim">Volume</p>
              <p className="font-numeric text-sm font-bold text-chalk mt-0.5">
                {(volumeKg / 1000).toFixed(1)}k <span className="text-[9px] font-normal text-dim">kg</span>
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <p className="font-mono text-[8px] uppercase tracking-wider text-dim">Sets</p>
              <p className="font-numeric text-sm font-bold text-chalk mt-0.5">
                {setsCount}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <p className="font-mono text-[8px] uppercase tracking-wider text-dim">Streak</p>
              <p className="font-numeric text-sm font-bold text-flame mt-0.5">
                {streakDays}d
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={copyCard}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-chalk font-semibold text-[12px] hover:bg-white/[0.08]"
          >
            {copied ? (
              <>
                <Check className="size-4 text-acid" /> Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copy Image
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              copyCard();
              setTimeout(onClose, 800);
            }}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-acid text-ink font-bold text-[12px] shadow-[0_0_20px_rgba(201,247,58,0.25)] hover:bg-[#b8e330]"
          >
            <Download className="size-4" /> Save Card
          </button>
        </div>
      </div>
    </div>
  );
}
