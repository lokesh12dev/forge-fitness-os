"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight, ChevronRight, Dumbbell, Filter, Info, Search, SlidersHorizontal,
  Sparkles, Target, TrendingUp, Trophy, User, X,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { cn, titleCase } from "@/lib/utils";
import { alternativesFor, muscleColor, muscleLabel } from "@/lib/engine";
import { matchExercise } from "@/lib/exercise-aliases";
import { addExerciseToWorkout } from "@/app/actions";
import { BodyMap, MiniBodyMap, MUSCLE_METADATA } from "@/components/body-map";

type ExerciseLite = {
  id: string; slug: string; name: string; primaryMuscle: string; secondaryMuscles: string[];
  equipment: string; category: string; pattern: string; unilateral: boolean; difficulty: string;
  instructions: string[]; cues: string[]; tempo: string; popularity: number;
};

type Stat = {
  pr: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  target: number | null;
  totalSets: number;
  history: { label: string; value: number }[];
};

const MUSCLE_TABS = [
  { key: "all", label: "All" },
  { key: "chest", label: "Chest" },
  { key: "back", label: "Upper Back" },
  { key: "lats", label: "Lats" },
  { key: "shoulders", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes", label: "Glutes" },
  { key: "calves", label: "Calves" },
  { key: "core", label: "Core" },
  { key: "forearms", label: "Forearms" },
];

const ARM_MUSCLES = ["biceps", "triceps", "forearms"];

export function ExerciseLibrary({
  exercises,
  stats,
  equipment,
  activeWorkoutId,
  initialQuery = "",
}: {
  exercises: ExerciseLite[];
  stats: Record<string, Stat>;
  equipment: string[];
  activeWorkoutId: string | null;
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [muscle, setMuscle] = useState("all");
  const [equip, setEquip] = useState("all");
  const [level, setLevel] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<ExerciseLite | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showBodyMap, setShowBodyMap] = useState(true);

  const filtered = useMemo(() => {
    const list = exercises.filter((e) => {
      if (q && !matchExercise(q, e)) return false;
      if (muscle !== "all") {
        const matchesPrimary = e.primaryMuscle === muscle;
        const matchesSecondary = e.secondaryMuscles.includes(muscle);
        if (muscle === "arms") {
          if (!ARM_MUSCLES.includes(e.primaryMuscle) && !e.secondaryMuscles.some((m) => ARM_MUSCLES.includes(m))) {
            return false;
          }
        } else if (muscle === "back") {
          if (
            e.primaryMuscle !== "back" &&
            e.primaryMuscle !== "lats" &&
            !e.secondaryMuscles.includes("back") &&
            !e.secondaryMuscles.includes("lats")
          ) {
            return false;
          }
        } else if (!matchesPrimary && !matchesSecondary) {
          return false;
        }
      }
      if (equip !== "all" && e.equipment !== equip) return false;
      if (level !== "all" && e.difficulty !== level) return false;
      if (onlyMine && !equipment.includes(e.equipment)) return false;
      return true;
    });

    if (muscle !== "all") {
      return [...list].sort((a, b) => {
        const aPrimary = a.primaryMuscle === muscle ? 1 : 0;
        const bPrimary = b.primaryMuscle === muscle ? 1 : 0;
        return bPrimary - aPrimary;
      });
    }

    return list;
  }, [exercises, q, muscle, equip, level, onlyMine, equipment]);

  const equipOptions = useMemo(() => [...new Set(exercises.map((e) => e.equipment))].sort(), [exercises]);

  const add = (ex: ExerciseLite) => {
    if (!activeWorkoutId) return;
    setAdded(ex.id);
    addExerciseToWorkout({ workoutId: activeWorkoutId, exerciseId: ex.id });
    setTimeout(() => setAdded(null), 2200);
  };

  const activeMeta = muscle !== "all" ? MUSCLE_METADATA[muscle] : null;

  return (
    <>
      {/* Sticky Filter Bar */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-white/[0.06] bg-ink/92 px-4 py-3 backdrop-blur-xl md:top-16 md:-mx-8 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex items-center gap-2">
            <div className="flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 focus-within:border-acid/40">
              <Search className="size-4 shrink-0 text-dim" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search movements, muscles, patterns…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-chalk placeholder:text-dim focus:outline-none"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-dim hover:text-chalk">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Anatomical Explorer Toggle Button */}
            <button
              onClick={() => setShowBodyMap((v) => !v)}
              className={cn(
                "press flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] transition-colors",
                showBodyMap
                  ? "border-acid/40 bg-acid/10 text-acid font-medium"
                  : "border-white/[0.09] bg-white/[0.03] text-mist hover:text-chalk"
              )}
              title="Toggle Anatomical Muscle Map"
            >
              <User className="size-3.5" />
              <span className="hidden sm:inline">Anatomy Map</span>
            </button>

            {/* Standard Filters Toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "press flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] transition-colors",
                showFilters
                  ? "border-acid/40 bg-acid/10 text-acid font-medium"
                  : "border-white/[0.09] bg-white/[0.03] text-mist hover:text-chalk"
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          {/* Muscle Pills Bar */}
          <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {MUSCLE_TABS.map((t) => {
              const isActive = muscle === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setMuscle(t.key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[10.5px] transition-colors",
                    isActive
                      ? "border-acid/40 bg-acid/10 text-acid font-semibold"
                      : "border-white/[0.07] text-dim hover:border-white/15 hover:text-mist"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {showFilters && (
            <div className="animate-fade-in mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <select
                value={equip}
                onChange={(e) => setEquip(e.target.value)}
                className="h-8 rounded-lg border border-white/10 bg-panel px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-mist focus:outline-none"
              >
                <option value="all">All equipment</option>
                {equipOptions.map((e) => (
                  <option key={e} value={e}>
                    {titleCase(e)}
                  </option>
                ))}
              </select>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-8 rounded-lg border border-white/10 bg-panel px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-mist focus:outline-none"
              >
                <option value="all">Any level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                onClick={() => setOnlyMine((v) => !v)}
                className={cn(
                  "h-8 rounded-lg border px-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em]",
                  onlyMine ? "border-acid/40 bg-acid/10 text-acid" : "border-white/10 text-dim"
                )}
              >
                My equipment only
              </button>
              <span className="ml-auto font-mono text-[9px] text-dim">
                {filtered.length} of {exercises.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {added && (
        <div className="animate-fade-in fixed left-1/2 top-28 z-50 -translate-x-1/2 rounded-full border border-acid/30 bg-acid px-4 py-2 text-[11.5px] font-semibold text-ink shadow-xl">
          Added to today&apos;s session
        </div>
      )}

      {/* High-Definition Anatomical Body Map Explorer (openGym Vector Engine) */}
      {showBodyMap && (
        <div className="animate-fade-in mb-6 rounded-3xl border border-white/[0.08] bg-panel/75 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex size-2 rounded-full bg-acid animate-pulse" />
                <h3 className="font-display text-sm font-bold tracking-tight text-chalk">
                  Anatomical Muscle Map
                </h3>
                <Badge tone="acid">openGym Vector Engine</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-mist">
                Tap any muscle contour on the human figure to filter movements and view targeted biomechanics.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {muscle !== "all" && (
                <button
                  onClick={() => setMuscle("all")}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-mist hover:border-white/20 hover:text-chalk transition-colors"
                >
                  <X className="size-3 text-acid" /> Clear muscle selection
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center">
            <BodyMap
              selectedMuscle={muscle === "all" ? null : muscle}
              onSelectMuscle={(m) => setMuscle(m)}
              interactive={true}
              allowViewSwitch={true}
              showLabels={true}
              showDetailsCard={false}
              className="w-full"
            />
          </div>

          {activeMeta && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-acid/20 bg-acid/[0.04] p-3.5">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-acid/15 text-acid">
                  <Target className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-chalk">
                      {activeMeta.name}
                    </span>
                    <span className="font-mono text-[10px] text-dim">
                      ({activeMeta.scientific})
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-mist">
                    {activeMeta.role} · <span className="font-semibold text-acid">{filtered.length}</span> movements available
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMuscle("all")}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist hover:text-chalk"
              >
                Reset to All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Movement Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((e) => {
          const stat = stats[e.id];
          return (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-panel/70 p-4 text-left transition-all hover:border-white/15 hover:bg-panel hover:shadow-lg"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: `radial-gradient(circle, ${muscleColor(e.primaryMuscle)}18, transparent 70%)` }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em]"
                      style={{
                        borderColor: `${muscleColor(e.primaryMuscle)}35`,
                        color: muscleColor(e.primaryMuscle),
                        background: `${muscleColor(e.primaryMuscle)}0d`,
                      }}
                    >
                      {muscleLabel(e.primaryMuscle)}
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">{e.category}</span>
                  </div>
                  <h3 className="mt-2.5 font-display text-[16px] font-bold leading-tight tracking-[-0.02em] text-chalk group-hover:text-white">
                    {e.name}
                  </h3>
                  <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.09em] text-dim">
                    {titleCase(e.equipment)} · {e.difficulty} · {e.pattern.replace(/_/g, " ")}
                  </p>
                </div>

                {/* OpenGym Mini Vector Anatomical Preview */}
                <div className="shrink-0 rounded-xl border border-white/[0.06] bg-black/35 p-1 transition-transform group-hover:scale-105">
                  <MiniBodyMap
                    primaryMuscle={e.primaryMuscle}
                    secondaryMuscles={e.secondaryMuscles}
                    className="h-14 w-8"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-white/[0.05] pt-2.5">
                <div className="flex gap-4">
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">PR</p>
                    <p className="font-numeric text-[12px] font-medium text-amber">{stat?.pr ? `${stat.pr}kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">Last</p>
                    <p className="font-numeric text-[12px] text-mist">
                      {stat?.lastWeight ? `${stat.lastWeight}×${stat.lastReps}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">Target</p>
                    <p className="font-numeric text-[12px] text-acid">{stat?.target ? `${stat.target}kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">Sets</p>
                    <p className="font-numeric text-[12px] text-mist">{stat?.totalSets ?? 0}</p>
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-acid" />
              </div>
            </button>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="surface mt-4 flex flex-col items-center rounded-3xl py-16 text-center">
          <Filter className="size-6 text-dim" />
          <p className="mt-3 font-display text-lg font-bold">No movements match</p>
          <p className="mt-1 text-[12px] text-mist">Loosen a filter or search a different muscle.</p>
          <button
            onClick={() => {
              setQ("");
              setMuscle("all");
              setEquip("all");
              setLevel("all");
              setOnlyMine(false);
            }}
            className="mt-4 rounded-full border border-white/10 px-4 py-2 text-[11px] text-mist hover:text-chalk"
          >
            Reset filters
          </button>
        </div>
      )}

      {selected && (
        <ExerciseSheet
          exercise={selected}
          stat={stats[selected.id]}
          allExercises={exercises}
          equipment={equipment}
          activeWorkoutId={activeWorkoutId}
          onClose={() => setSelected(null)}
          onAdd={() => add(selected)}
          added={added === selected.id}
        />
      )}
    </>
  );
}

function ExerciseSheet({
  exercise,
  stat,
  allExercises,
  equipment,
  activeWorkoutId,
  onClose,
  onAdd,
  added,
}: {
  exercise: ExerciseLite;
  stat?: Stat;
  allExercises: ExerciseLite[];
  equipment: string[];
  activeWorkoutId: string | null;
  onClose: () => void;
  onAdd: () => void;
  added: boolean;
}) {
  const [tab, setTab] = useState<"how" | "data" | "swap">("how");
  const alts = alternativesFor(exercise, allExercises, equipment, 4);
  const max = Math.max(...(stat?.history.map((h) => h.value) ?? [1]), 1);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="animate-fade-up relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-panel shadow-2xl sm:rounded-3xl">
        <div className="relative overflow-hidden border-b border-white/[0.07] p-5">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full"
            style={{ background: `radial-gradient(circle, ${muscleColor(exercise.primaryMuscle)}22, transparent 70%)` }}
          />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{muscleLabel(exercise.primaryMuscle)}</Badge>
                <Badge tone="neutral">{titleCase(exercise.equipment)}</Badge>
                <Badge tone="neutral">{exercise.difficulty}</Badge>
              </div>
              <button
                onClick={onClose}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
              >
                <X className="size-4" />
              </button>
            </div>
            <h2 className="mt-3 font-display text-[26px] font-bold leading-[0.95] tracking-[-0.04em]">
              {exercise.name}
            </h2>
            <p className="mt-1.5 text-[11.5px] text-mist">
              {exercise.primaryMuscle.charAt(0).toUpperCase() + exercise.primaryMuscle.slice(1)}
              {exercise.secondaryMuscles.length ? ` · ${exercise.secondaryMuscles.map(muscleLabel).join(", ")}` : ""} · Tempo {exercise.tempo}
            </p>

            {/* Dual Anatomical Recruitment Visualization */}
            <div className="mt-3.5 flex items-center gap-3.5 rounded-2xl border border-white/[0.07] bg-black/30 p-3">
              <div className="flex shrink-0 gap-1.5">
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-1 text-center">
                  <MiniBodyMap
                    primaryMuscle={exercise.primaryMuscle}
                    secondaryMuscles={exercise.secondaryMuscles}
                    view="front"
                    className="h-16 w-9"
                  />
                  <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-wider text-dim">Anterior</span>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-1 text-center">
                  <MiniBodyMap
                    primaryMuscle={exercise.primaryMuscle}
                    secondaryMuscles={exercise.secondaryMuscles}
                    view="back"
                    className="h-16 w-9"
                  />
                  <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-wider text-dim">Posterior</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <span className="font-mono text-[7.5px] uppercase tracking-wider text-acid">Primary Motor</span>
                  <p className="text-[12px] font-bold text-chalk">{muscleLabel(exercise.primaryMuscle)}</p>
                </div>
                {exercise.secondaryMuscles.length > 0 && (
                  <div>
                    <span className="font-mono text-[7.5px] uppercase tracking-wider text-mint">Synergists & Stabilizers</span>
                    <p className="truncate text-[10.5px] text-mist">{exercise.secondaryMuscles.map(muscleLabel).join(", ")}</p>
                  </div>
                )}
                <div>
                  <span className="font-mono text-[7.5px] uppercase tracking-wider text-dim">Movement Pattern</span>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-dim">{exercise.pattern.replace(/_/g, " ")}</p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {[
                { label: "Est. 1RM", value: stat?.pr ? `${stat.pr}kg` : "—", icon: Trophy, tone: "#FFD166" },
                { label: "Last set", value: stat?.lastWeight ? `${stat.lastWeight}×${stat.lastReps}` : "—", icon: TrendingUp, tone: "#C9F73A" },
                { label: "Target · 8 reps", value: stat?.target ? `${stat.target}kg` : "—", icon: Target, tone: "#6EA8FF" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.07] bg-black/20 p-2.5 text-center">
                  <s.icon className="mx-auto mb-1 size-3" style={{ color: s.tone }} />
                  <p className="font-numeric text-[12.5px] font-semibold">{s.value}</p>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-white/[0.07] px-4 pt-3">
          {([["how", "Technique"], ["data", "Your data"], ["swap", "Alternatives"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "border-b-2 px-3 py-2 text-[11px] font-medium transition-colors",
                tab === k ? "border-acid text-chalk" : "border-transparent text-dim hover:text-mist"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "how" && (
            <div className="space-y-4">
              <div>
                <p className="label-mono mb-2">Execution</p>
                <ol className="space-y-2">
                  {exercise.instructions.map((step, i) => (
                    <li key={step} className="flex gap-2.5 text-[11.5px] leading-relaxed text-mist">
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[8px] text-dim">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-xl border border-acid/15 bg-acid/[0.04] p-3">
                <p className="mb-2 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">
                  <Info className="size-3" /> Coach cues
                </p>
                <ul className="space-y-1.5">
                  {exercise.cues.map((c) => (
                    <li key={c} className="flex gap-2 text-[11px] leading-relaxed text-mist">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-acid" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <span className="text-[11px] text-mist">Movement pattern</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-chalk">
                  {exercise.pattern.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          )}

          {tab === "data" && (
            <div>
              <p className="label-mono mb-2">Load trend · last sessions</p>
              {stat?.history.length ? (
                <div className="flex h-32 items-end gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  {stat.history.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <span className="font-numeric text-[8px] text-dim">{h.value}</span>
                      <div
                        className="w-full rounded-t-[3px]"
                        style={{
                          height: `${Math.max(6, (h.value / max) * 80)}%`,
                          background: i === stat.history.length - 1 ? "#C9F73A" : "rgba(255,255,255,0.14)",
                        }}
                      />
                      <span className="font-mono text-[7px] text-dim">{h.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-[11.5px] text-mist">
                  No history yet. Log this lift and Forge will start auto-regulating load from your RPE.
                </div>
              )}
              <div className="mt-3 rounded-xl border border-sky/15 bg-sky/[0.04] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-sky">
                  <Sparkles className="size-3" /> Strength standard
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-mist">
                  {stat?.pr
                    ? `Your best e1RM is ${stat.pr}kg. Add a top set at RPE 8 and Forge projects the next milestone automatically.`
                    : "Set a baseline with a clean set of 5 at RPE 7. Everything after is progressive overload."}
                </p>
              </div>
            </div>
          )}

          {tab === "swap" && (
            <div className="space-y-2">
              <p className="mb-2 text-[11px] leading-relaxed text-mist">
                Same-pattern substitutes ranked by muscle overlap and your available equipment.
              </p>
              {alts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="size-1.5 rounded-full" style={{ background: muscleColor(a.primaryMuscle) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-chalk">{a.name}</p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">
                      {a.reasons.join(" · ") || titleCase(a.equipment)}
                    </p>
                  </div>
                  <span className="font-numeric text-[9.5px] text-acid">{a.score}</span>
                </div>
              ))}
              {!alts.length && <p className="py-6 text-center text-[11.5px] text-mist">No close substitutes with your equipment.</p>}
            </div>
          )}

          <div className="mt-5">
            {activeWorkoutId ? (
              <button
                onClick={onAdd}
                className={cn(
                  "press flex w-full items-center justify-center gap-2 rounded-full py-3 text-[12.5px] font-semibold",
                  added ? "bg-mint text-ink" : "bg-acid text-ink"
                )}
              >
                {added ? "Added to session" : "Add to today's session"} <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] py-3 text-[11.5px] text-mist">
                <Dumbbell className="size-3.5 text-acid" /> Start a session to add this lift
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
