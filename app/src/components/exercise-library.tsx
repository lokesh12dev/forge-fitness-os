"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check, ChevronDown, ChevronLeft, ChevronUp, LayoutGrid, List, Play, Plus, Search,
  SlidersHorizontal, Sparkles, Star, TrendingUp, Trophy, User, X, Layers, ScanFace,
} from "lucide-react";
import { cn, titleCase } from "@/lib/utils";
import {
  FULL_EXERCISE_CATALOG,
  SKILL_LADDERS,
  type CatalogExercise,
  type SkillLadderDef,
} from "@/lib/opengym-catalog";
import { addExerciseToWorkout, saveBuiltRoutine, startRoutineWorkout } from "@/app/actions";
import { BodyMap, MUSCLE_METADATA } from "@/components/body-map";
import { ExerciseMotionDemo } from "@/components/exercise-motion";
import { ExerciseDetailSheet } from "@/components/exercise-detail-sheet";
import { SessionBuilderModal } from "@/components/session-builder-modal";
import {
  OG_MUSCLE_GROUPS,
  OG_MUSCLE_NAME,
  OG_MUSCLES,
  groupOfTerm,
  groupTerm,
  matchesTerms,
  ogMusclesOf,
  shownMuscles,
  termDisplayName,
  termsWeight,
  toggleTerm,
} from "@/lib/muscle-explorer";
import type { SessionPick } from "@/lib/session-builder";
import { loadAllExercisePrefs, saveExercisePrefs, type ExercisePrefs } from "@/lib/own-media-db";
import { ModuleAiCoach } from "@/components/ai/module-ai-coach";

export type ExerciseStat = {
  pr: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  target: number | null;
  totalSets: number;
  history: { label: string; value: number }[];
};

const BODYPART_CHIPS = [
  { key: "back", label: "Back" },
  { key: "cardio", label: "Cardio" },
  { key: "chest", label: "Chest" },
  { key: "full body", label: "Full Body" },
  { key: "lower arms", label: "Lower Arms" },
  { key: "lower legs", label: "Lower Legs" },
  { key: "neck", label: "Neck" },
  { key: "shoulders", label: "Shoulders" },
  { key: "upper arms", label: "Upper Arms" },
  { key: "upper legs", label: "Upper Legs" },
  { key: "waist", label: "Waist" },
];

const EXPLORER_MUSCLES = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Upper back" },
  { key: "lats", label: "Lats" },
  { key: "shoulders", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "forearms", label: "Forearms" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "glutes", label: "Glutes" },
  { key: "calves", label: "Calves" },
  { key: "core", label: "Abs & core" },
];

const CUSTOM_EX_KEY = "forge_custom_exercises_v1";
const FAV_EX_KEY = "forge_fav_exercises_v1";
const CUSTOM_LADDERS_KEY = "forge_custom_ladders_v1";

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ExerciseLibrary({
  stats,
  equipment,
  activeWorkoutId,
  initialQuery = "",
  initialMode = "library",
  initialMuscle = null,
  trainedIds = [],
}: {
  stats: Record<string, ExerciseStat>;
  equipment: string[];
  activeWorkoutId: string | null;
  initialQuery?: string;
  initialMode?: "library" | "muscles";
  initialMuscle?: string | null;
  trainedIds?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"library" | "muscles">(initialMode);
  const [q, setQ] = useState(initialQuery);
  const [bodyPart, setBodyPart] = useState("");
  const [eqFilter, setEqFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [onlyMyGym, setOnlyMyGym] = useState(false);
  const [viewLayout, setViewLayout] = useState<"list" | "grid">("list");
  const [shown, setShown] = useState(40);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showLaddersModal, setShowLaddersModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedEx, setSelectedEx] = useState<CatalogExercise | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Explorer states (exact openGym MuscleExplorer)
  const [explorerTerms, setExplorerTerms] = useState<string[]>(initialMuscle ? [initialMuscle] : []);
  const [explorerOpenGroup, setExplorerOpenGroup] = useState<string | null>(null);
  const [explorerMatch, setExplorerMatch] = useState<"all" | "any">("all");
  const [showSessionBuilder, setShowSessionBuilder] = useState(false);

  // Persistent client customizations
  const [customExercises, setCustomExercises] = useState<CatalogExercise[]>([]);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [customLadders, setCustomLadders] = useState<SkillLadderDef[]>([]);
  const [exercisePrefs, setExercisePrefs] = useState<Record<string, ExercisePrefs>>({});

  // Custom exercise form
  const [cxName, setCxName] = useState("");
  const [cxMuscle, setCxMuscle] = useState("chest");
  const [cxEq, setCxEq] = useState("barbell");
  const [cxInst, setCxInst] = useState("");

  // Custom ladder form
  const [creatingLadder, setCreatingLadder] = useState(false);
  const [ldName, setLdName] = useState("");
  const [ldSteps, setLdSteps] = useState<string[]>(["ex-push-up", "ex-dips"]);

  useEffect(() => {
    setCustomExercises(loadJson<CatalogExercise[]>(CUSTOM_EX_KEY, []));
    setFavIds(loadJson<string[]>(FAV_EX_KEY, []));
    setCustomLadders(loadJson<SkillLadderDef[]>(CUSTOM_LADDERS_KEY, []));
    setExercisePrefs(loadAllExercisePrefs());
  }, []);

  const updateExercisePrefs = (exerciseId: string, patch: ExercisePrefs) => {
    setExercisePrefs(saveExercisePrefs(exerciseId, patch));
  };

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2800);
  };

  const fullCatalog = useMemo(
    () => [...customExercises, ...FULL_EXERCISE_CATALOG],
    [customExercises],
  );

  const catalogById = useMemo(
    () => new Map(fullCatalog.map((e) => [e.id, e])),
    [fullCatalog],
  );

  const toggleFav = (id: string) => {
    setFavIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      try {
        localStorage.setItem(FAV_EX_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const equipmentOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of fullCatalog) {
      counts.set(e.equipment, (counts.get(e.equipment) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [fullCatalog]);

  const categoryOptions = useMemo(() => {
    const set = new Set(fullCatalog.map((e) => e.category));
    return [...set].sort();
  }, [fullCatalog]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = fullCatalog.filter((e) => {
      if (onlyMyGym && equipment.length && !equipment.includes(e.equipment) && e.equipment !== "bodyweight") {
        return false;
      }
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (eqFilter && e.equipment !== eqFilter) return false;
      if (catFilter && e.category !== catFilter) return false;
      if (ql) {
        const aliases = exercisePrefs[e.id]?.aliases ?? [];
        const match =
          e.name.toLowerCase().includes(ql) ||
          aliases.some((al) => al.toLowerCase().includes(ql)) ||
          e.primaryMuscle.toLowerCase().includes(ql) ||
          e.equipment.toLowerCase().includes(ql) ||
          e.bodyPart.toLowerCase().includes(ql) ||
          e.secondaryMuscles.some((s) => s.toLowerCase().includes(ql));
        if (!match) return false;
      }
      return true;
    });

    const favSet = new Set(favIds);
    return list.sort((a, b) => {
      const af = favSet.has(a.id) ? 1 : 0;
      const bf = favSet.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      if (ql) {
        const ae = a.name.toLowerCase().startsWith(ql) ? 1 : 0;
        const be = b.name.toLowerCase().startsWith(ql) ? 1 : 0;
        if (ae !== be) return be - ae;
      }
      return a.name.localeCompare(b.name);
    });
  }, [fullCatalog, onlyMyGym, equipment, bodyPart, eqFilter, catFilter, q, favIds, exercisePrefs]);

  const explorerLit = useMemo(() => shownMuscles(explorerTerms), [explorerTerms]);

  const explorerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of OG_MUSCLES) counts[m] = 0;
    for (const e of fullCatalog) {
      if (onlyMyGym && equipment.length && !equipment.includes(e.equipment) && e.equipment !== "bodyweight") {
        continue;
      }
      const hit = ogMusclesOf(e);
      for (const m of Object.keys(hit)) {
        if (hit[m] > 0 && counts[m] !== undefined) counts[m] += 1;
      }
    }
    return counts;
  }, [fullCatalog, onlyMyGym, equipment]);

  const explorerResults = useMemo(() => {
    if (!explorerTerms.length) return [];
    const ql = q.trim().toLowerCase();
    const hits = fullCatalog.filter((e) => {
      if (onlyMyGym && equipment.length && !equipment.includes(e.equipment) && e.equipment !== "bodyweight") {
        return false;
      }
      if (bodyPart && e.bodyPart !== bodyPart) return false;
      if (eqFilter && e.equipment !== eqFilter) return false;
      if (!matchesTerms(ogMusclesOf(e), explorerTerms, explorerMatch)) return false;
      if (ql) {
        const aliases = exercisePrefs[e.id]?.aliases ?? [];
        const match =
          e.name.toLowerCase().includes(ql) ||
          aliases.some((al) => al.toLowerCase().includes(ql)) ||
          e.equipment.toLowerCase().includes(ql) ||
          e.primaryMuscle.toLowerCase().includes(ql);
        if (!match) return false;
      }
      return true;
    });
    const favSet = new Set(favIds);
    return hits.sort((a, b) => {
      const af = favSet.has(a.id) ? 1 : 0;
      const bf = favSet.has(b.id) ? 1 : 0;
      if (af !== bf) return bf - af;
      if (explorerTerms.length === 1 && !groupOfTerm(explorerTerms[0])) {
        return 0;
      }
      return termsWeight(ogMusclesOf(b), explorerTerms) - termsWeight(ogMusclesOf(a), explorerTerms);
    });
  }, [fullCatalog, explorerTerms, explorerMatch, q, bodyPart, eqFilter, onlyMyGym, equipment, favIds, exercisePrefs]);

  const activeFilterCount = (eqFilter ? 1 : 0) + (catFilter ? 1 : 0) + (onlyMyGym ? 1 : 0);
  const narrowed = !!(q.trim() || bodyPart || activeFilterCount);

  const handleAddToWorkout = (ex: CatalogExercise) => {
    if (activeWorkoutId) {
      startTransition(async () => {
        await addExerciseToWorkout({
          workoutId: activeWorkoutId,
          exerciseId: ex.id,
          customExercise:
            ex.source === "custom"
              ? { name: ex.name, primaryMuscle: ex.primaryMuscle, equipment: ex.equipment, category: ex.category, instructions: ex.instructions }
              : undefined,
        });
        flashToast(`Added ${ex.name} to your active workout.`);
      });
      return;
    }
    startTransition(async () => {
      const res = await startRoutineWorkout({
        name: `${ex.name} Session`,
        focus: titleCase(ex.primaryMuscle),
        slots: [
          {
            exerciseId: ex.id,
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSec: 90,
            rpeTarget: 8,
            customExercise:
              ex.source === "custom"
                ? { name: ex.name, primaryMuscle: ex.primaryMuscle, equipment: ex.equipment, category: ex.category, instructions: ex.instructions }
                : undefined,
          },
        ],
      });
      if (res.ok) router.push(`/app/train/${res.workoutId}`);
    });
  };

  const handleStartBuiltSession = (picks: SessionPick[], title: string) => {
    if (!picks.length) return;
    startTransition(async () => {
      const res = await startRoutineWorkout({
        name: title,
        focus: explorerTerms.map(termDisplayName).join(" · "),
        slots: picks.map((p) => ({
          exerciseId: p.id,
          sets: p.sets,
          repsMin: p.reps,
          repsMax: p.reps,
          restSec: p.restSec,
          rpeTarget: 8,
          customExercise:
            p.exercise.source === "custom"
              ? {
                  name: p.exercise.name,
                  primaryMuscle: p.exercise.primaryMuscle,
                  equipment: p.exercise.equipment,
                  category: p.exercise.category,
                  instructions: p.exercise.instructions,
                }
              : undefined,
        })),
      });
      setShowSessionBuilder(false);
      if (res.ok) router.push(`/app/train/${res.workoutId}`);
    });
  };

  const handleSaveBuiltRoutine = (picks: SessionPick[], title: string) => {
    if (!picks.length) return;
    startTransition(async () => {
      const res = await saveBuiltRoutine({
        name: title,
        focus: explorerTerms.map(termDisplayName).join(" · "),
        slots: picks.map((p) => ({
          exerciseId: p.id,
          sets: p.sets,
          repsMin: p.reps,
          repsMax: p.reps,
          restSec: p.restSec,
          rpeTarget: 8,
          customExercise:
            p.exercise.source === "custom"
              ? {
                  name: p.exercise.name,
                  primaryMuscle: p.exercise.primaryMuscle,
                  equipment: p.exercise.equipment,
                  category: p.exercise.category,
                  instructions: p.exercise.instructions,
                }
              : undefined,
        })),
      });
      setShowSessionBuilder(false);
      if (res.ok) flashToast(`Saved as "${title}".`);
    });
  };

  const handleSaveCustomExercise = () => {
    const clean = cxName.trim();
    if (!clean) return;
    const newEx: CatalogExercise = {
      id: `custom-${Date.now().toString(36)}`,
      slug: `custom-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: clean,
      primaryMuscle: cxMuscle,
      secondaryMuscles: [],
      bodyPart: cxMuscle === "chest" ? "chest" : cxMuscle === "back" || cxMuscle === "lats" ? "back" : "waist",
      equipment: cxEq,
      category: "strength",
      pattern: cxMuscle === "chest" ? "horizontal_push" : cxMuscle === "lats" ? "vertical_pull" : cxMuscle === "quads" ? "squat" : "hinge",
      unilateral: false,
      difficulty: "intermediate",
      instructions: cxInst.trim() ? cxInst.split("\n").filter(Boolean) : [`Perform ${clean} with steady tempo and full control.`],
      cues: [`Keep tension focused on ${MUSCLE_METADATA[cxMuscle]?.name ?? cxMuscle}.`],
      tempo: "2-0-1",
      popularity: 80,
      muscleWeights: { [cxMuscle]: 1 },
      source: "custom",
    };
    const next = [newEx, ...customExercises];
    setCustomExercises(next);
    try {
      localStorage.setItem(CUSTOM_EX_KEY, JSON.stringify(next));
    } catch {}
    setCxName("");
    setCxInst("");
    setShowCustomModal(false);
    setSelectedEx(newEx);
    flashToast(`Created custom exercise "${clean}".`);
  };

  const handleSaveCustomLadder = () => {
    const clean = ldName.trim() || "Custom Skill Ladder";
    if (ldSteps.length < 2) return;
    const nextLadder: SkillLadderDef = {
      id: `own-${Date.now().toString(36)}`,
      name: clean,
      description: "Your custom bodyweight progression chain.",
      steps: ldSteps,
    };
    const next = [nextLadder, ...customLadders];
    setCustomLadders(next);
    try {
      localStorage.setItem(CUSTOM_LADDERS_KEY, JSON.stringify(next));
    } catch {}
    setCreatingLadder(false);
    setLdName("");
    flashToast(`Saved skill ladder "${clean}".`);
  };

  const displayedList = mode === "muscles" ? explorerResults : filtered;
  const trainedSet = new Set(trainedIds);

  return (
    <div className="space-y-4">
      {/* Header matching openGym/#/library and openGym/#/muscles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {mode === "muscles" && (
            <button
              type="button"
              onClick={() => setMode("library")}
              aria-label="Back to Exercises"
              className="press mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-panel-2 text-chalk hover:bg-panel-3"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <div>
            <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight text-chalk">
              {mode === "muscles" ? "Explore muscles" : "Exercises"}
            </h1>
            <p className="mt-0.5 text-[13.5px] text-mist">
              {mode === "muscles"
                ? "Choose a muscle to see exercises that train it, or build a session from it."
                : `${FULL_EXERCISE_CATALOG.length.toLocaleString()} animated exercises${customExercises.length ? ` + ${customExercises.length} of your own` : ""}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "muscles" ? "library" : "muscles")}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
              mode === "muscles"
                ? "bg-acid text-ink"
                : "bg-acid/16 text-acid hover:bg-acid/24",
            )}
          >
            <User className="size-3.5" />
            {mode === "muscles" ? "All exercises" : "By muscle"}
          </button>
          <button
            type="button"
            onClick={() => setShowLaddersModal(true)}
            className="press inline-flex items-center gap-1.5 rounded-full bg-acid/16 px-3.5 py-2 text-[13px] font-medium text-acid hover:bg-acid/24"
          >
            <Layers className="size-3.5" />
            Ladders
          </button>
          <Link
            href="/app/form-check"
            className="press inline-flex items-center gap-1.5 rounded-full bg-panel-2 px-3.5 py-2 text-[13px] font-medium text-chalk hover:bg-panel-3"
          >
            <ScanFace className="size-3.5 text-mist" />
            Form check
          </Link>
        </div>
      </div>

      <ModuleAiCoach
        module="exercise"
        hints={selectedEx ? { selectedExerciseId: selectedEx.id, selectedExerciseName: selectedEx.name } : undefined}
      />

      {/* Interactive Muscle Explorer Mode matching openGym/#/muscles */}
      {mode === "muscles" && (
        <div className="rounded-[22px] border border-white/[0.08] bg-panel p-5">
          <BodyMap
            interactive
            openGymSlugs
            view="both"
            selectedMuscles={explorerLit}
            onSelectMuscle={(slug) => {
              setExplorerTerms((cur) => toggleTerm(cur, slug));
              setEqFilter("");
              setShown(40);
            }}
            showDetailsCard={false}
            svgHeightClass="max-h-[260px]"
          />

          {/* Row 1: 6 Muscle Groups */}
          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Muscle groups">
            {OG_MUSCLE_GROUPS.map((g) => {
              const single = g.muscles.length === 1;
              const term = groupTerm(g.id);
              const on = single ? explorerTerms.includes(g.muscles[0]) : explorerTerms.includes(term);
              const expanded = explorerOpenGroup === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  aria-expanded={single ? undefined : expanded}
                  onClick={() => {
                    if (single) {
                      setExplorerTerms((cur) => toggleTerm(cur, g.muscles[0]));
                    } else {
                      setExplorerTerms((cur) => toggleTerm(cur, term));
                      setExplorerOpenGroup(on && expanded ? null : g.id);
                    }
                    setEqFilter("");
                    setShown(40);
                  }}
                  className={cn(
                    "press inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    on ? "bg-acid text-ink" : "bg-panel-2 text-mist hover:text-chalk",
                  )}
                >
                  <span>{g.name}</span>
                  {!single && (expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
                </button>
              );
            })}
          </div>

          {/* Row 2: Individual Muscles (open group or all 21) with counts */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(OG_MUSCLE_GROUPS.find((g) => g.id === explorerOpenGroup)?.muscles ?? OG_MUSCLES).map((m) => {
              const on = explorerTerms.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setExplorerTerms((cur) => toggleTerm(cur, m));
                    setEqFilter("");
                    setShown(40);
                  }}
                  className={cn(
                    "press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    on ? "bg-acid text-ink" : "bg-panel-2 text-mist hover:text-chalk",
                  )}
                >
                  <span>{OG_MUSCLE_NAME[m] ?? m}</span>
                  <span className={cn("font-numeric text-[11px]", on ? "text-ink/75" : "text-dim")}>
                    {explorerCounts[m] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {explorerTerms.length > 1 && (
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-panel-2 p-1">
              <button
                type="button"
                onClick={() => {
                  setExplorerMatch("all");
                  setShown(40);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-[12.5px] font-medium",
                  explorerMatch === "all" ? "bg-panel-3 text-chalk" : "text-mist",
                )}
              >
                All of them
              </button>
              <button
                type="button"
                onClick={() => {
                  setExplorerMatch("any");
                  setShown(40);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-[12.5px] font-medium",
                  explorerMatch === "any" ? "bg-panel-3 text-chalk" : "text-mist",
                )}
              >
                Any of them
              </button>
            </div>
          )}

          {explorerTerms.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSessionBuilder(true)}
              className="press mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-acid py-3 text-[14.5px] font-semibold text-ink hover:brightness-105"
            >
              <Sparkles className="size-4" />
              Build a session
            </button>
          )}
        </div>
      )}

      {mode === "muscles" && explorerTerms.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <h4 className="text-[14px] font-semibold text-chalk">
            Exercises for {explorerTerms.map(termDisplayName).join(explorerMatch === "all" ? " + " : " / ")}
          </h4>
          <button
            type="button"
            onClick={() => {
              setExplorerTerms([]);
              setExplorerOpenGroup(null);
              setEqFilter("");
              setShown(40);
            }}
            className="text-[13px] font-medium text-mist hover:text-chalk"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Search Bar + Layout Toggle matching library.png */}
      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-panel px-3.5 focus-within:border-white/25">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(40);
            }}
            placeholder="Search…"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-chalk placeholder:text-dim focus:outline-none"
          />
          {narrowed && (
            <span className="rounded-full bg-panel-3 px-2.5 py-0.5 font-numeric text-[12px] font-semibold text-mist">
              {displayedList.length}
            </span>
          )}
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setShown(40);
              }}
              aria-label="Clear search"
              className="grid size-6 place-items-center rounded-full bg-panel-3 text-mist hover:text-chalk"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setViewLayout((v) => (v === "list" ? "grid" : "list"))}
          aria-label="Toggle layout"
          className="press grid size-11 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-panel text-mist hover:text-chalk"
        >
          {viewLayout === "list" ? <LayoutGrid className="size-4.5" /> : <List className="size-4.5" />}
        </button>
      </div>

      {/* Single Filter Row matching library.png */}
      {mode === "library" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setShowFiltersModal(true)}
            className={cn(
              "press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              activeFilterCount ? "bg-panel-3 text-chalk" : "bg-panel text-mist hover:text-chalk",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="grid size-4 place-items-center rounded-full bg-acid text-[10px] font-bold text-ink">
                {activeFilterCount}
              </span>
            )}
          </button>

          {eqFilter && (
            <button
              type="button"
              onClick={() => setEqFilter("")}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-panel-3 px-3 py-1.5 text-[13px] font-medium text-chalk"
            >
              {titleCase(eqFilter)}
              <X className="size-3" />
            </button>
          )}
          {catFilter && (
            <button
              type="button"
              onClick={() => setCatFilter("")}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-panel-3 px-3 py-1.5 text-[13px] font-medium text-chalk"
            >
              {titleCase(catFilter)}
              <X className="size-3" />
            </button>
          )}

          {BODYPART_CHIPS.map((bp) => {
            const on = bodyPart === bp.key;
            return (
              <button
                key={bp.key}
                type="button"
                onClick={() => {
                  setBodyPart(on ? "" : bp.key);
                  setShown(40);
                }}
                className={cn(
                  "press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on ? "bg-panel-3 text-chalk" : "bg-panel text-mist hover:text-chalk",
                )}
              >
                {bp.label}
                {on && <X className="size-3 text-mist" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Results container */}
      {mode === "muscles" && !explorerTerms.length ? (
        <div className="rounded-2xl border border-white/[0.06] bg-panel p-8 text-center text-[14px] text-mist">
          Choose a muscle to see exercises that train it.
        </div>
      ) : (
        <div
          className={cn(
            viewLayout === "grid"
              ? "grid grid-cols-1 gap-2.5 md:grid-cols-2"
              : "overflow-hidden rounded-[20px] border border-white/[0.07] bg-panel divide-y divide-white/[0.06]",
          )}
        >
          {/* Create your own exercise row matching Screenshot 2 */}
          {mode === "library" && (
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className={cn(
                "press flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-panel-2",
                viewLayout === "grid" && "rounded-2xl border border-white/[0.08] bg-panel",
              )}
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-panel-2 text-mist">
                <Plus className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-chalk">Create your own exercise</p>
                <p className="truncate text-[12.5px] text-mist">name + body part, and a photo or video if you like</p>
              </div>
              <Plus className="size-4 shrink-0 text-dim" />
            </button>
          )}

          {displayedList.slice(0, shown).map((ex) => {
            const st = stats[ex.id];
            const isFav = favIds.includes(ex.id);
            return (
              <div
                key={ex.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel-2",
                  viewLayout === "grid" && "rounded-2xl border border-white/[0.08] bg-panel",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedEx(ex)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ExerciseMotionDemo
                    openGymId={ex.openGymId}
                    pattern={ex.pattern}
                    equipment={ex.equipment}
                    primaryMuscle={ex.primaryMuscle}
                    secondaryMuscles={ex.secondaryMuscles}
                    muscleWeights={ex.muscleWeights}
                    name={ex.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[14.5px] font-medium text-chalk">
                      {isFav && <Star className="size-3.5 shrink-0 fill-amber text-amber" />}
                      <span className="truncate">{ex.name}</span>
                    </p>
                    <p className="truncate text-[12.5px] text-mist">
                      {mode === "muscles" && explorerLit.length > 0
                        ? `${explorerLit.some((m) => ogMusclesOf(ex)[m] >= 1) ? "Primary target" : "Also trains"} · `
                        : ""}
                      {ex.targetName ?? MUSCLE_METADATA[ex.primaryMuscle]?.name ?? titleCase(ex.primaryMuscle)} · {titleCase(ex.equipment)}
                    </p>
                  </div>
                </button>

                {st?.pr != null && st.pr > 0 && (
                  <span className="rounded-lg bg-acid/14 px-2 py-0.5 font-numeric text-[12px] font-semibold text-acid">
                    {st.pr}
                  </span>
                )}

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleAddToWorkout(ex)}
                  aria-label={`Add ${ex.name}`}
                  title={activeWorkoutId ? "Add to active session" : "Start session with this movement"}
                  className="press grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-mist hover:bg-acid hover:text-ink"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            );
          })}

          {displayedList.length === 0 && (
            <div className="col-span-full p-10 text-center">
              <p className="text-[15px] font-medium text-chalk">No matching exercises</p>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setBodyPart("");
                  setEqFilter("");
                  setCatFilter("");
                  setOnlyMyGym(false);
                }}
                className="mt-3 rounded-full bg-panel-2 px-4 py-1.5 text-[13px] font-medium text-acid"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {displayedList.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + 40)}
          className="press w-full rounded-2xl border border-white/[0.08] bg-panel py-3 text-[13.5px] font-medium text-chalk hover:bg-panel-2"
        >
          Show more ({displayedList.length - shown} remaining)
        </button>
      )}

      {/* Toast confirmation */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-panel-3 px-4 py-2 text-[13px] font-medium text-chalk shadow-2xl md:bottom-8">
          {toastMsg}
        </div>
      )}

      {/* Filters Sheet */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Filters</h3>
              <button type="button" onClick={() => setShowFiltersModal(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-panel-2 px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium text-chalk">Only equipment I have</p>
                  <p className="text-[12px] text-mist">{equipment.length} equipment types enabled in Settings</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyMyGym((v) => !v)}
                  className={cn("h-7 w-12 rounded-full p-1 transition-colors", onlyMyGym ? "bg-acid" : "bg-panel-3")}
                >
                  <span className={cn("block size-5 rounded-full bg-ink transition-transform", onlyMyGym ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-medium text-mist">Exercise type</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCatFilter("")}
                    className={cn("rounded-full px-3 py-1.5 text-[12.5px]", !catFilter ? "bg-acid font-semibold text-ink" : "bg-panel-2 text-mist")}
                  >
                    Any type
                  </button>
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatFilter(catFilter === cat ? "" : cat)}
                      className={cn("rounded-full px-3 py-1.5 text-[12.5px]", catFilter === cat ? "bg-acid font-semibold text-ink" : "bg-panel-2 text-mist")}
                    >
                      {titleCase(cat)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-medium text-mist">Equipment</p>
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setEqFilter("")}
                    className={cn("rounded-full px-3 py-1.5 text-[12.5px]", !eqFilter ? "bg-acid font-semibold text-ink" : "bg-panel-2 text-mist")}
                  >
                    Any equipment
                  </button>
                  {equipmentOptions.map((eq) => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => setEqFilter(eqFilter === eq ? "" : eq)}
                      className={cn("rounded-full px-3 py-1.5 text-[12.5px]", eqFilter === eq ? "bg-acid font-semibold text-ink" : "bg-panel-2 text-mist")}
                    >
                      {titleCase(eq)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEqFilter("");
                  setCatFilter("");
                  setOnlyMyGym(false);
                }}
                className="flex-1 rounded-full bg-panel-2 py-2.5 text-[13.5px] font-medium text-mist hover:text-chalk"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="flex-1 rounded-full bg-acid py-2.5 text-[13.5px] font-semibold text-ink"
              >
                Show {filtered.length} exercises
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Ladders Modal matching openGym Ladders */}
      {showLaddersModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-chalk">Skill ladders</h3>
                <p className="mt-0.5 text-[13px] text-mist">Bodyweight progression chains from foundational control up to elite mastery.</p>
              </div>
              <button type="button" onClick={() => setShowLaddersModal(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {[...customLadders, ...SKILL_LADDERS].map((ladder) => {
                let reached = -1;
                ladder.steps.forEach((sid, i) => {
                  if (trainedSet.has(sid)) reached = i;
                });
                const nextIdx = Math.min(ladder.steps.length - 1, reached + 1);
                const nextEx = catalogById.get(ladder.steps[nextIdx]);

                return (
                  <div key={ladder.id} className="rounded-2xl border border-white/[0.08] bg-panel-2 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-[16px] font-semibold text-chalk">{ladder.name}</h4>
                      <span className="text-[12px] text-mist">
                        {reached < 0 ? "Not started" : reached >= ladder.steps.length - 1 ? "Top rung reached" : `Rung ${reached + 1} of ${ladder.steps.length}`}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-mist">{ladder.description}</p>

                    <ol className="mt-3 space-y-1.5">
                      {ladder.steps.map((stepId, idx) => {
                        const ex = catalogById.get(stepId);
                        if (!ex) return null;
                        const state = idx <= reached ? "done" : idx === nextIdx ? "next" : "todo";
                        return (
                          <li key={stepId}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowLaddersModal(false);
                                setSelectedEx(ex);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-white/[0.05]"
                            >
                              <span
                                className={cn(
                                  "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                                  state === "done"
                                    ? "bg-mint text-ink"
                                    : state === "next"
                                      ? "bg-acid text-ink"
                                      : "bg-panel-3 text-mist",
                                )}
                              >
                                {state === "done" ? <Check className="size-3" /> : idx + 1}
                              </span>
                              <span className={cn("flex-1 text-[13.5px]", state === "done" ? "text-mist line-through" : "font-medium text-chalk")}>
                                {ex.name}
                              </span>
                              {state === "next" && (
                                <span className="rounded-full bg-acid/16 px-2.5 py-0.5 text-[11px] font-semibold text-acid">
                                  {reached < 0 ? "Start here" : "Next up"}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    {nextEx && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowLaddersModal(false);
                          handleAddToWorkout(nextEx);
                        }}
                        className="press mt-3 inline-flex items-center gap-1.5 rounded-full bg-acid/16 px-3.5 py-1.5 text-[12.5px] font-semibold text-acid hover:bg-acid/24"
                      >
                        <Play className="size-3 fill-current" />
                        Train {nextEx.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {creatingLadder ? (
              <div className="mt-4 rounded-2xl border border-acid/25 bg-panel-2 p-4">
                <h4 className="text-[15px] font-semibold text-chalk">Make your own ladder</h4>
                <input
                  value={ldName}
                  onChange={(e) => setLdName(e.target.value)}
                  placeholder="Ladder name (e.g. Ring Muscle-Up)"
                  className="mt-2.5 w-full rounded-xl border border-white/10 bg-panel px-3 py-2 text-[13.5px] text-chalk"
                />
                <p className="mt-2 text-[12px] text-mist">Selected rungs ({ldSteps.length}): {ldSteps.map((s) => catalogById.get(s)?.name ?? s).join(" -> ")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["ex-push-up", "ex-dips", "ex-pull-up", "ex-plank", "ex-goblet-squat", "ex-overhead-press"].map((id) => {
                    const ex = catalogById.get(id);
                    if (!ex) return null;
                    const active = ldSteps.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLdSteps((cur) => (active ? cur.filter((x) => x !== id) : [...cur, id]))}
                        className={cn("rounded-full px-2.5 py-1 text-[11.5px]", active ? "bg-acid text-ink font-medium" : "bg-panel text-mist")}
                      >
                        {ex.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setCreatingLadder(false)} className="rounded-full bg-panel px-4 py-1.5 text-[12.5px] text-mist">Cancel</button>
                  <button type="button" onClick={handleSaveCustomLadder} className="rounded-full bg-acid px-4 py-1.5 text-[12.5px] font-semibold text-ink">Save ladder</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingLadder(true)}
                className="press mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-panel-2 py-3 text-[13.5px] font-medium text-acid hover:bg-panel-3"
              >
                <Plus className="size-4" />
                Make your own ladder
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Custom Exercise Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">New exercise</h3>
              <button type="button" onClick={() => setShowCustomModal(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={cxName}
                onChange={(e) => setCxName(e.target.value)}
                placeholder="Exercise name (e.g. Belt Squat)"
                className="w-full rounded-xl border border-white/10 bg-panel-2 px-3.5 py-2.5 text-[14px] text-chalk"
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={cxMuscle} onChange={(e) => setCxMuscle(e.target.value)} className="rounded-xl border border-white/10 bg-panel-2 px-3 py-2 text-[13px] text-chalk">
                  {EXPLORER_MUSCLES.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <select value={cxEq} onChange={(e) => setCxEq(e.target.value)} className="rounded-xl border border-white/10 bg-panel-2 px-3 py-2 text-[13px] text-chalk">
                  {["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "bands"].map((eq) => (
                    <option key={eq} value={eq}>{titleCase(eq)}</option>
                  ))}
                </select>
              </div>
              <textarea
                rows={3}
                value={cxInst}
                onChange={(e) => setCxInst(e.target.value)}
                placeholder="Optional step-by-step instructions (one per line)..."
                className="w-full rounded-xl border border-white/10 bg-panel-2 p-3 text-[13px] text-chalk"
              />
              <button
                type="button"
                onClick={handleSaveCustomExercise}
                className="press w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-ink"
              >
                Save exercise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OpenGym Session Builder Modal (Session for Shoulders, etc.) */}
      {showSessionBuilder && explorerTerms.length > 0 && (
        <SessionBuilderModal
          terms={explorerTerms}
          catalog={fullCatalog}
          stats={stats}
          favIds={favIds}
          equipment={equipment}
          onlyMyGym={onlyMyGym}
          pending={pending}
          onInspectExercise={(ex) => setSelectedEx(ex)}
          onStartWorkout={handleStartBuiltSession}
          onSaveAsRoutine={handleSaveBuiltRoutine}
          onClose={() => setShowSessionBuilder(false)}
        />
      )}

      {/* Rich OpenGym Exercise Detail Sheet (Screenshot 1) */}
      {selectedEx && (
        <ExerciseDetailSheet
          exercise={selectedEx}
          stat={stats[selectedEx.id]}
          isFav={favIds.includes(selectedEx.id)}
          prefs={exercisePrefs[selectedEx.id] ?? {}}
          activeWorkoutId={activeWorkoutId}
          pending={pending}
          onToggleFav={toggleFav}
          onUpdatePrefs={updateExercisePrefs}
          onClose={() => setSelectedEx(null)}
          onTrainNow={(target) => {
            setSelectedEx(null);
            handleAddToWorkout(target);
          }}
        />
      )}
    </div>
  );
}
