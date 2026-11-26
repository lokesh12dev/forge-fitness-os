"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark, Check, Clock, FolderOpen, Play, Star, Zap
} from "lucide-react";
import { BUILTIN_PROGRAMS, type BuiltinProgram } from "@/lib/programs-db";
import { INITIAL_ROUTINE_FOLDERS } from "@/lib/b2b-portal";
import { ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ProgramsClientProps {
  currentWeek: number;
  totalWeeks: number;
  completedWorkoutsCount: number;
  totalVolumeKg: number;
  streakDays: number;
  userAccent?: string;
}

export function ProgramsClient({
  currentWeek,
  totalWeeks,
  completedWorkoutsCount,
  totalVolumeKg,
  streakDays,
  userAccent = "#C9F73A",
}: ProgramsClientProps) {
  const [activeProgramId, setActiveProgramId] = useState<string>("ppl-hypertrophy");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [selectedGoal, setSelectedGoal] = useState<string>("all");
  const [selectedDays, setSelectedDays] = useState<number | "all">("all");
  const [savedIds, setSavedIds] = useState<string[]>(["ppl-hypertrophy", "strength-531-bbb"]);
  const [previewProgram, setPreviewProgram] = useState<BuiltinProgram | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("forge_saved_program_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedIds(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("forge_saved_program_ids", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const activeProgram = BUILTIN_PROGRAMS.find((p) => p.id === activeProgramId) ?? BUILTIN_PROGRAMS[0];

  const filteredPrograms = BUILTIN_PROGRAMS.filter((p) => {
    if (selectedFolder === "saved" && !savedIds.includes(p.id)) return false;
    if (selectedFolder !== "all" && selectedFolder !== "saved") {
      const folder = INITIAL_ROUTINE_FOLDERS.find((f) => f.id === selectedFolder);
      if (folder && !folder.programIds.includes(p.id)) return false;
    }
    if (selectedGoal !== "all" && p.goal !== selectedGoal) return false;
    if (selectedDays !== "all" && p.daysPerWeek !== selectedDays) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ACTIVE ENROLLED PROGRAM HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-panel p-5 md:p-7 shadow-xl">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full"
          style={{ background: `radial-gradient(circle, ${activeProgram.accent}16, transparent 65%)` }}
        />
        <div className="relative">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-acid/30 bg-acid/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                  <span className="size-1.5 rounded-full bg-acid animate-pulse" /> Active Plan
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mist">
                  {activeProgram.level}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mist">
                  {activeProgram.goal}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mist">
                  {activeProgram.daysPerWeek} Days / Wk
                </span>
              </div>

              <h2 className="mt-3 font-display text-[30px] font-bold leading-[0.95] tracking-[-0.04em] text-chalk md:text-[40px]">
                {activeProgram.name}
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mist md:text-[13.5px]">
                {activeProgram.description}
              </p>

              {/* Progression Rule Pill */}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-1.5 text-[11px] text-chalk font-mono">
                <Zap className="size-3 text-acid" />
                <span className="text-dim">Progression:</span> {activeProgram.progressionRule}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Sessions</p>
                  <p className="mt-0.5 font-numeric text-lg font-bold text-chalk">{completedWorkoutsCount}</p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Volume</p>
                  <p className="mt-0.5 font-numeric text-lg font-bold text-chalk">
                    {(totalVolumeKg / 1000).toFixed(1)}k <span className="text-xs font-normal text-dim">kg</span>
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Streak</p>
                  <p className="mt-0.5 font-numeric text-lg font-bold text-flame">{streakDays}d</p>
                </div>
              </div>
            </div>

            {/* Macrocycle Progression Widget */}
            <div className="w-full shrink-0 rounded-2xl border border-white/[0.07] bg-black/25 p-4 md:w-[290px]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Macrocycle Wave</p>
                <span className="font-mono text-[9px] text-acid font-bold">Week {currentWeek} of {activeProgram.weeks}</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={(currentWeek / activeProgram.weeks) * 100} color={activeProgram.accent} height={6} />
              </div>
              <div className="mt-3 grid grid-cols-8 gap-1">
                {Array.from({ length: activeProgram.weeks }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-6 rounded-[4px] flex items-center justify-center font-mono text-[8px]",
                      i + 1 < currentWeek
                        ? "bg-acid/70 text-ink font-bold"
                        : i + 1 === currentWeek
                        ? "border border-acid bg-acid/20 text-acid font-bold"
                        : "bg-white/[0.05] text-dim"
                    )}
                  >
                    W{i + 1}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-dim">
                Double progression enforces smallest plate increments (+2.5kg) only after all prescribed sets achieve RPE ≤ 8.
              </p>
            </div>
          </div>

          {/* DAYS ROSTER */}
          <div className="mt-6">
            <h4 className="font-mono text-[9px] uppercase tracking-wider text-dim mb-3">
              Weekly Training Cadence ({activeProgram.days.length} Sessions)
            </h4>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {activeProgram.days.map((day, i) => (
                <div
                  key={day.id}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-acid font-bold">
                        Day {i + 1}
                      </p>
                      <p className="mt-0.5 font-display text-[15px] font-bold leading-tight text-chalk">
                        {day.name}
                      </p>
                    </div>
                    <span className="grid size-6 place-items-center rounded-full border border-white/10 font-mono text-[9px] text-dim">
                      {day.exercises.length}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-mist">{day.focus}</p>

                  <div className="mt-2.5 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                    <Clock className="size-2.5 text-sky" /> ≈ 45 min
                    <span>·</span>
                    {day.exercises.reduce((a, e) => a + e.sets, 0)} working sets
                  </div>

                  <div className="mt-3">
                    <Link
                      href="/app/train"
                      className="press flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] py-1.5 text-[10.5px] font-semibold text-chalk hover:bg-acid hover:text-ink transition-colors"
                    >
                      <Play className="size-3" /> Train Day {i + 1}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 10 CANONICAL PROGRAMS DIRECTORY */}
      <div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
              Programs Catalog (F1)
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight text-chalk mt-0.5">
              10 Built-in Training Programs
            </h2>
            <p className="text-[12px] text-mist">
              Periodized blueprints engineered for strength, hypertrophy, athletic conditioning, and bodyweight dominance.
            </p>
          </div>

          {/* Goal & Days Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", "hypertrophy", "strength", "athletic", "bodyweight"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGoal(g)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-all",
                  selectedGoal === g
                    ? "bg-acid text-ink font-bold"
                    : "border border-white/10 bg-white/[0.03] text-mist hover:text-chalk"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Routine Folders Strip (GYM-One) */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
          <span className="flex items-center gap-1.5 px-2 font-mono text-[9px] uppercase tracking-wider text-dim">
            <FolderOpen className="size-3 text-acid" /> Routine Folders:
          </span>
          <button
            type="button"
            onClick={() => setSelectedFolder("all")}
            className={cn(
              "rounded-xl px-2.5 py-1 font-mono text-[9.5px] transition-colors",
              selectedFolder === "all" ? "bg-white/15 text-chalk font-bold" : "text-mist hover:text-chalk"
            )}
          >
            All ({BUILTIN_PROGRAMS.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFolder("saved")}
            className={cn(
              "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 font-mono text-[9.5px] transition-colors",
              selectedFolder === "saved" ? "bg-amber/20 text-amber font-bold" : "text-mist hover:text-chalk"
            )}
          >
            <Bookmark className="size-3" /> Saved ({savedIds.length})
          </button>
          {INITIAL_ROUTINE_FOLDERS.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelectedFolder(folder.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-[9.5px] transition-colors",
                selectedFolder === folder.id ? "bg-acid/15 text-acid font-bold" : "text-mist hover:text-chalk"
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: folder.accent }} />
              {folder.name}
            </button>
          ))}
        </div>

        {/* PROGRAM CARDS GRID */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((p) => {
            const isCurrent = p.id === activeProgramId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border p-4 transition-all",
                  isCurrent
                    ? "border-acid/40 bg-acid/[0.03] shadow-[0_0_20px_rgba(201,247,58,0.08)]"
                    : "border-white/[0.08] bg-panel hover:border-white/20 hover:bg-white/[0.03]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
                      {p.daysPerWeek} Days/Wk · {p.weeks} Weeks
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSaved(p.id)}
                        title={savedIds.includes(p.id) ? "Remove from Saved folder" : "Bookmark to Saved folder"}
                        className={cn(
                          "transition-colors",
                          savedIds.includes(p.id) ? "text-amber" : "text-dim hover:text-chalk"
                        )}
                      >
                        <Bookmark className={cn("size-3.5", savedIds.includes(p.id) && "fill-current")} />
                      </button>
                      <div className="flex items-center gap-1 text-amber text-[10px] font-mono font-bold">
                        <Star className="size-2.5 fill-current" /> {p.rating}
                      </div>
                    </div>
                  </div>

                  <h3 className="mt-1 font-display text-lg font-bold text-chalk">
                    {p.name}
                  </h3>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-acid font-semibold">
                    {p.subtitle}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-mist line-clamp-2">
                    {p.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.days.slice(0, 3).map((d) => (
                      <span key={d.id} className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[9.5px] font-mono text-dim">
                        {d.name}
                      </span>
                    ))}
                    {p.days.length > 3 && (
                      <span className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[9.5px] font-mono text-dim">
                        +{p.days.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewProgram(p)}
                    className="text-[11px] font-semibold text-mist hover:text-chalk underline decoration-dim"
                  >
                    Inspect Days
                  </button>

                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-acid/15 px-3 py-1 font-mono text-[10px] font-bold text-acid">
                      <Check className="size-3" /> Active Plan
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveProgramId(p.id)}
                      className="press inline-flex items-center gap-1 rounded-lg border border-acid/30 bg-acid/10 px-3 py-1 font-mono text-[10px] font-bold text-acid hover:bg-acid hover:text-ink transition-colors"
                    >
                      Set Active
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PROGRAM PREVIEW MODAL */}
      {previewProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Close"
            onClick={() => setPreviewProgram(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="animate-scale-in relative z-10 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                  {previewProgram.level} · {previewProgram.goal.toUpperCase()}
                </span>
                <h3 className="font-display text-2xl font-bold tracking-tight text-chalk mt-0.5">
                  {previewProgram.name}
                </h3>
                <p className="text-[12px] text-mist mt-1">{previewProgram.description}</p>
              </div>
              <button
                onClick={() => setPreviewProgram(null)}
                className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="font-mono text-[9px] uppercase tracking-wider text-dim">
                Day-by-Day Prescriptions
              </h4>
              {previewProgram.days.map((d, idx) => (
                <div key={d.id} className="rounded-xl border border-white/[0.08] bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-chalk">
                      Day {idx + 1}: {d.name}
                    </span>
                    <span className="font-mono text-[9px] text-dim">{d.focus}</span>
                  </div>
                  <div className="space-y-1">
                    {d.exercises.map((e, eIdx) => (
                      <div key={eIdx} className="flex items-center justify-between text-[11px] font-mono text-mist">
                        <span>{e.name}</span>
                        <span className="text-dim">
                          {e.sets} sets × {e.repsMin}-{e.repsMax} reps @ RPE {e.rpeTarget}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewProgram(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-[12px] font-semibold text-mist hover:text-chalk"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveProgramId(previewProgram.id);
                  setPreviewProgram(null);
                }}
                className="press rounded-xl bg-acid px-5 py-2 text-[12px] font-bold text-ink hover:bg-[#b8e330]"
              >
                Enroll & Set Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
