"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Check, Dumbbell, ExternalLink, Info, Play, Plus, Scale, Star, Trash2, TrendingUp, Trophy, X,
} from "lucide-react";
import { cn, titleCase } from "@/lib/utils";
import {
  computeEpley1RM,
  computeMusclePercentages,
  type CatalogExercise,
} from "@/lib/opengym-catalog";
import { BodyMap, MUSCLE_METADATA } from "@/components/body-map";
import { ExerciseMotionDemo } from "@/components/exercise-motion";
import {
  deleteOwnExerciseMedia,
  fileToDataUrl,
  getOwnExerciseMedia,
  putOwnExerciseMedia,
  type ExercisePrefs,
  type ExerciseWeightUnit,
  type StoredOwnMedia,
} from "@/lib/own-media-db";
import type { ExerciseStat } from "./exercise-library";

export function ExerciseDetailSheet({
  exercise,
  stat,
  isFav,
  prefs,
  activeWorkoutId,
  pending,
  onToggleFav,
  onUpdatePrefs,
  onClose,
  onTrainNow,
}: {
  exercise: CatalogExercise;
  stat?: ExerciseStat;
  isFav: boolean;
  prefs: ExercisePrefs;
  activeWorkoutId: string | null;
  pending: boolean;
  onToggleFav: (id: string) => void;
  onUpdatePrefs: (exerciseId: string, patch: ExercisePrefs) => void;
  onClose: () => void;
  onTrainNow: (ex: CatalogExercise) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"motion" | "anatomy">("motion");
  const [editingAliases, setEditingAliases] = useState(false);
  const [aliasDraft, setAliasDraft] = useState("");
  const [ownMedia, setOwnMedia] = useState<StoredOwnMedia | null>(null);
  const [showingOwn, setShowingOwn] = useState(Boolean(prefs.showOwnFirst));
  const [mediaBusy, setMediaBusy] = useState(false);

  // Interactive Epley 1RM calculator (defaults 20 kg × 5 reps -> 23.3 kg matching Screenshot 1, or last logged set!)
  const [calcWeight, setCalcWeight] = useState<string>(
    stat?.lastWeight != null && stat.lastWeight > 0 ? String(stat.lastWeight) : "20",
  );
  const [calcReps, setCalcReps] = useState<string>(
    stat?.lastReps != null && stat.lastReps > 0 ? String(stat.lastReps) : "5",
  );

  useEffect(() => {
    setAliasDraft((prefs.aliases ?? []).join(", "));
  }, [exercise.id, prefs.aliases]);

  useEffect(() => {
    let alive = true;
    getOwnExerciseMedia(exercise.id).then((rec) => {
      if (!alive) return;
      setOwnMedia(rec);
      if (rec) setShowingOwn(prefs.showOwnFirst !== false);
    });
    return () => {
      alive = false;
    };
  }, [exercise.id, prefs.showOwnFirst]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const muscleShares = useMemo(() => computeMusclePercentages(exercise), [exercise]);
  const weightUnit: ExerciseWeightUnit = prefs.weightUnit ?? "default";
  const plateLoading = Boolean(prefs.plateLoading);
  const baseWeightKg = prefs.baseWeightKg ?? 0;

  const estimated1RM = useMemo(
    () => computeEpley1RM(Number(calcWeight) || 0, Number(calcReps) || 0),
    [calcWeight, calcReps],
  );

  const unitLabel = weightUnit === "lb" ? "lb" : "kg";
  const issueHref = `https://github.com/DuarteSantos8/openGym/issues/new?template=exercise.yml&exercise=${encodeURIComponent(
    `${exercise.openGymId ?? exercise.id}, ${exercise.name}`,
  )}`;

  async function handleFilePicked(file: File | null) {
    if (!file) return;
    setMediaBusy(true);
    try {
      const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
      const dataUrl = await fileToDataUrl(file);
      const record: StoredOwnMedia = {
        exerciseId: exercise.id,
        kind,
        mimeType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
        dataUrl,
        updatedAt: Date.now(),
      };
      await putOwnExerciseMedia(record);
      setOwnMedia(record);
      setShowingOwn(true);
      onUpdatePrefs(exercise.id, { showOwnFirst: true });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleRemoveMedia() {
    setMediaBusy(true);
    try {
      await deleteOwnExerciseMedia(exercise.id);
      setOwnMedia(null);
      setShowingOwn(false);
    } finally {
      setMediaBusy(false);
    }
  }

  function saveAliases() {
    const clean = aliasDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdatePrefs(exercise.id, { aliases: clean });
    setEditingAliases(false);
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close modal backdrop" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/12 bg-panel p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        {/* Top drag bar + Title + Favorite + Close */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold tracking-tight text-chalk">{exercise.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleFav(exercise.id)}
              aria-label="Bookmark favorite"
              className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist hover:text-amber"
            >
              <Star className={cn("size-4", isFav && "fill-amber text-amber")} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close exercise detail"
              className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist hover:text-chalk"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Viewport Toggle: Motion / Muscle Map */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-panel-2 p-1">
            <button
              type="button"
              onClick={() => setViewMode("motion")}
              className={cn(
                "rounded-lg px-3 py-1 text-[12px] font-medium transition",
                viewMode === "motion" ? "bg-panel-3 text-chalk" : "text-mist hover:text-chalk",
              )}
            >
              Movement animation
            </button>
            <button
              type="button"
              onClick={() => setViewMode("anatomy")}
              className={cn(
                "rounded-lg px-3 py-1 text-[12px] font-medium transition",
                viewMode === "anatomy" ? "bg-panel-3 text-chalk" : "text-mist hover:text-chalk",
              )}
            >
              360° Muscle Map
            </button>
          </div>
          {exercise.openGymId && (
            <span className="font-mono text-[10px] text-dim">ID #{exercise.openGymId}</span>
          )}
        </div>

        {/* Exact White-Card Anatomical Animation / MuscleMap Stage */}
        <div className="mt-3">
          {viewMode === "motion" ? (
            <ExerciseMotionDemo
              pattern={exercise.pattern}
              equipment={exercise.equipment}
              primaryMuscle={exercise.primaryMuscle}
              secondaryMuscles={exercise.secondaryMuscles}
              muscleWeights={exercise.muscleWeights}
              name={exercise.name}
              customMedia={ownMedia ? { kind: ownMedia.kind, dataUrl: ownMedia.dataUrl } : null}
              showingOwn={showingOwn}
              onToggleOwn={() => setShowingOwn((s) => !s)}
              size="lg"
              interactive
            />
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141416] p-4">
              <BodyMap
                selectedMuscle={exercise.primaryMuscle}
                secondaryMuscles={exercise.secondaryMuscles}
                highlightWeights={exercise.muscleWeights}
                interactive={false}
                showDetailsCard={false}
                svgHeightClass="max-h-[225px]"
              />
            </div>
          )}
        </div>

        {/* Exact Screenshot 1 Pills Row: Equipment · Body part · Muscle % shares */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 px-2.5 py-1 text-[11px] font-medium text-mist">
            △ {titleCase(exercise.equipment)}
          </span>
          <span className="rounded-full bg-[#3A6B35]/65 px-2.5 py-1 text-[11px] font-medium text-[#C8F5BA]">
            {titleCase(exercise.bodyPart)}
          </span>
          {muscleShares.map((m) => (
            <span
              key={m.label}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                m.isPrimary ? "bg-panel-3 text-chalk" : "bg-panel-2 text-mist",
              )}
            >
              {m.label} {m.pct}%
            </span>
          ))}
        </div>

        {/* "+ Add another name" Aliases */}
        <div className="mt-3">
          {!editingAliases ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingAliases(true)}
                className="text-[12px] font-medium text-mist hover:text-acid"
              >
                + {prefs.aliases?.length ? "Edit aliases" : "Add another name"}
              </button>
              {prefs.aliases?.map((al) => (
                <span key={al} className="rounded-full border border-white/10 bg-panel-2 px-2 py-0.5 text-[11px] text-chalk">
                  aka {al}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-panel-2 p-2.5">
              <input
                type="text"
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                placeholder="Separate aliases with commas (e.g. Box step jump, Plyo box)"
                className="min-w-[180px] flex-1 bg-transparent text-xs text-chalk placeholder:text-dim focus:outline-none"
              />
              <button
                type="button"
                onClick={saveAliases}
                className="inline-flex items-center gap-1 rounded-lg bg-acid px-2.5 py-1 text-xs font-semibold text-ink"
              >
                <Check className="size-3" /> Save
              </button>
              <button
                type="button"
                onClick={() => setEditingAliases(false)}
                className="rounded-lg bg-panel-3 px-2 py-1 text-xs text-mist"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* "Your photo or video" Device-Only Local Media Section */}
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-panel-2 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
                <Camera className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-chalk">Your photo or video</p>
                <p className="text-[11px] text-mist">
                  {ownMedia
                    ? "Only you see it. Saved directly on this device."
                    : "Show how you do it, on your own machine. Only you see it."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={mediaBusy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#3A6B35]/75 px-3 py-1.5 text-xs font-semibold text-[#DDFCE0] hover:bg-[#498543]"
              >
                <Camera className="size-3.5" />
                {mediaBusy ? "Saving..." : ownMedia ? "Change" : "Add"}
              </button>
              {ownMedia && (
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  aria-label="Remove uploaded media"
                  className="grid size-8 place-items-center rounded-xl bg-panel-3 text-mist hover:text-flame"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          {ownMedia && (
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-xs">
              <span className="text-mist">Show first in player</span>
              <div className="inline-flex rounded-lg bg-panel-3 p-0.5">
                {(
                  [
                    { key: true, label: "Yours" },
                    { key: false, label: "Animation" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    onClick={() => {
                      setShowingOwn(opt.key);
                      onUpdatePrefs(exercise.id, { showOwnFirst: opt.key });
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium",
                      showingOwn === opt.key ? "bg-acid text-ink font-semibold" : "text-mist",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void handleFilePicked(f);
            }}
          />
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-dim">
          Kept on this device only. Export with photos &amp; videos keeps a copy.
        </p>

        {/* Description paragraph */}
        {exercise.description && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-chalk/90">
            {exercise.description}
          </p>
        )}

        {/* Weight unit & Plate loading settings (exact OpenGym settings block) */}
        <div className="mt-4 space-y-2.5">
          <div className="rounded-2xl border border-white/[0.08] bg-panel-2 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-chalk">
                <Scale className="size-4 text-teal-400" /> Weight unit
              </span>
              <div className="inline-flex rounded-xl bg-panel-3 p-0.5">
                {(["default", "kg", "lb"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => onUpdatePrefs(exercise.id, { weightUnit: u })}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                      weightUnit === u ? "bg-acid text-ink" : "text-mist hover:text-chalk",
                    )}
                  >
                    {u === "default" ? "Default" : u}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
              For gyms that mix kg and lb. This exercise is shown and typed in it everywhere, plates and steps included. Totals in Stats stay in kg.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-panel-2 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-chalk">
                  <Dumbbell className="size-4 text-acid" /> Plate loading
                </p>
                <p className="mt-0.5 text-[11.5px] text-dim">
                  One stack: a belt, a landmine, a plate-loaded machine, a sled.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={plateLoading}
                onClick={() => onUpdatePrefs(exercise.id, { plateLoading: !plateLoading })}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  plateLoading ? "bg-acid" : "bg-white/15",
                )}
              >
                <span
                  className={cn(
                    "block size-5 translate-y-0.5 rounded-full bg-ink transition-transform",
                    plateLoading ? "translate-x-5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            <div className="border-t border-white/[0.06] pt-2.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[12.5px] font-medium text-chalk">
                  Base weight ({unitLabel})
                </label>
                <input
                  type="number"
                  min="0"
                  step="2.5"
                  value={baseWeightKg}
                  onChange={(e) => onUpdatePrefs(exercise.id, { baseWeightKg: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-8 w-24 rounded-lg border border-white/12 bg-panel-3 px-2.5 text-right font-numeric text-xs text-chalk focus:border-acid/50 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
                The machine or sled itself, before any plate goes on. 0 if it is all plates. You still log the total weight. This only feeds the plate line under each set.
              </p>
            </div>
          </div>
        </div>

        {/* Estimated 1RM (Interactive Epley Calculator) */}
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-panel-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-chalk">
              <TrendingUp className="size-4 text-acid" /> Estimated 1RM
            </h4>
            {stat?.pr ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber">
                <Trophy className="size-3" /> Your PR {stat.pr} kg
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] text-mist">Weight ({unitLabel})</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={calcWeight}
                onChange={(e) => setCalcWeight(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/10 bg-panel-3 px-3 font-numeric text-sm text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-mist">Reps</label>
              <input
                type="number"
                min="1"
                max="30"
                value={calcReps}
                onChange={(e) => setCalcReps(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/10 bg-panel-3 px-3 font-numeric text-sm text-chalk focus:border-acid/50 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-acid/25 bg-acid/[0.08] px-3 py-1.5 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-acid">Estimate</span>
              <span className="font-display text-lg font-bold text-chalk">
                {estimated1RM} {unitLabel}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-dim">
            Epley formula: calculated from one set, not a tested max.
          </p>
        </div>

        {/* How to numbered instructions */}
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-panel-2 p-4">
          <h4 className="text-[13px] font-semibold text-chalk">How to</h4>
          <ol className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-mist">
            {exercise.instructions.map((step, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span className="font-numeric font-semibold text-acid">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Suggest a fix for this exercise link */}
        <div className="mt-3 flex items-center justify-between px-1 text-[12px]">
          <a
            href={issueHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-mist underline decoration-white/20 underline-offset-4 hover:text-acid"
          >
            <Info className="size-3.5" /> Suggest a fix for this exercise <ExternalLink className="size-3" />
          </a>
          <span className="font-mono text-[10px] text-dim">{MUSCLE_METADATA[exercise.primaryMuscle]?.scientific ?? ""}</span>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onTrainNow(exercise)}
            className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-acid py-2.5 text-[14px] font-semibold text-ink"
          >
            <Play className="size-4 fill-current" />
            {activeWorkoutId ? "Add to active session" : "Train this now"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-panel-2 px-5 py-2.5 text-[14px] font-medium text-chalk"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
