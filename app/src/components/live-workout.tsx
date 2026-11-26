"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Dumbbell, Flame, Info,
  Layers, Mic, Plus, Search, Sparkles, Timer, Trash2, TrendingUp, Trophy,
  Users, Wand2, X, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { PRCard } from "@/components/pr-card";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { PlateCalculatorModal } from "@/components/plate-calculator";
import { FloatingRestTimer, type RestTimerState } from "@/components/rest-timer";
import { SetRow, type SetType } from "@/components/workout-keypad";
import { syncManager } from "@/lib/offline-sync";
import { matchExercise } from "@/lib/exercise-aliases";
import { cn, formatClock, formatVolume, titleCase } from "@/lib/utils";
import {
  alternativesFor, compressSession, e1rm, muscleColor, muscleLabel, plateBreakdown,
  adaptiveTargetWeightWithReason, EQUIPMENT_PROFILES, type EquipmentProfileId,
} from "@/lib/engine";
import { adaptForCrowdedGym } from "@/lib/adaptive-features";
import { parseWorkoutVoiceCommand, type ParsedLogCommand } from "@/lib/voice-parser";
import {
  addExerciseToWorkout, completeSet, compressWorkout, finishWorkout,
  swapExercise, undoSet, updateTargetSets,
} from "@/app/actions";

type ExerciseLite = {
  id: string; slug: string; name: string; primaryMuscle: string; secondaryMuscles: string[];
  equipment: string; category: string; pattern: string; unilateral: boolean; difficulty: string;
  instructions: string[]; cues: string[]; tempo: string; popularity: number;
};

type SessionSet = {
  id: string; setIndex: number; weightKg: number; reps: number; rpe: number;
  isPR: boolean; completedAt: string;
};

export type SessionExercise = {
  id: string; exerciseId: string; position: number; targetSets: number;
  repsMin: number; repsMax: number; restSec: number; rpeTarget: number;
  supersetGroup: string | null; swappedFrom: string | null; notes: string | null;
  exercise: ExerciseLite; sets: SessionSet[];
  history: { weight: number; reps: number; date: string | null };
  suggestion: number;
};

export type LiveWorkoutProps = {
  workout: {
    id: string; name: string; focus: string; startedAt: string; readiness: number;
    compressed: boolean; totalVolume: number; totalSets: number;
  };
  items: SessionExercise[];
  allExercises: ExerciseLite[];
  equipment: string[];
  user: { name: string; initials: string };
  prs: { exerciseId: string; value: number }[];
};

const roundTo = (n: number, step = 2.5) => Math.max(0, Math.round(n / step) * step);
const uid = () => Math.random().toString(36).slice(2, 9);

function useElapsed(start: string) {
  const [sec, setSec] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSec(Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [start]);
  return sec;
}

export function LiveWorkout({ workout, items: initialItems, allExercises, equipment, user, prs }: LiveWorkoutProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState(initialItems.find((i) => i.sets.length < i.targetSets)?.id ?? initialItems[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string; rpe: number }>>(() => {
    const out: Record<string, { weight: string; reps: string; rpe: number }> = {};
    for (const it of initialItems) {
      out[it.id] = { weight: String(it.suggestion || it.history.weight || 0), reps: String(it.repsMin), rpe: it.rpeTarget };
    }
    return out;
  });
  const [rest, setRest] = useState<RestTimerState | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showCues, setShowCues] = useState(false);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [showCompress, setShowCompress] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [activeProfile, setActiveProfile] = useState<EquipmentProfileId>("commercial");
  const [voiceConfirm, setVoiceConfirm] = useState<ParsedLogCommand | null>(null);
  const [commandInput, setCommandInput] = useState("");
  const [celebrate, setCelebrate] = useState<{ exercise: string; value: number; previous: number | null; weight: number; reps: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const [finishing, setFinishing] = useState(false);
  const elapsed = useElapsed(workout.startedAt);

  // Crash recovery: restore snapshot from local storage if page reloaded
  useEffect(() => {
    const snapshot = syncManager.loadActiveSnapshot(workout.id);
    if (snapshot?.state && Array.isArray(snapshot.state) && snapshot.state.length > 0) {
      setItems(snapshot.state);
    }
  }, [workout.id]);

  // Persist snapshot on every update
  useEffect(() => {
    syncManager.saveActiveSnapshot(workout.id, items);
  }, [items, workout.id]);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const draft = active ? drafts[active.id] ?? { weight: "0", reps: String(active.repsMin), rpe: active.rpeTarget } : { weight: "0", reps: "8", rpe: 8 };

  const allSets = useMemo(() => items.flatMap((i) => i.sets), [items]);
  const volume = allSets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const targetSets = items.reduce((a, i) => a + i.targetSets, 0);
  const donePct = Math.round((allSets.length / Math.max(1, targetSets)) * 100);
  const totalSets = allSets.length;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!rest) return;
    if (rest.remainingSec <= 0) {
      setRest(null);
      return;
    }
    const t = setTimeout(() => {
      setRest((r) => (r ? { ...r, remainingSec: Math.max(0, r.remainingSec - 1) } : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const setDraft = (patch: Partial<{ weight: string; reps: string; rpe: number }>) => {
    if (!active) return;
    setDrafts((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? draft), ...patch } }));
    setNudge(null);
  };

  const logSetSpecific = (weight: number, reps: number, rpe: number, type: SetType = "normal") => {
    if (!active) return;
    const setIndex = active.sets.length;
    const tempId = `tmp-${uid()}`;
    const optimistic: SessionSet = {
      id: tempId,
      setIndex,
      weightKg: weight,
      reps,
      rpe,
      isPR: false,
      completedAt: new Date().toISOString(),
    };

    setItems((prev) => prev.map((i) => (i.id === active.id ? { ...i, sets: [...i.sets, optimistic] } : i)));
    setRest({
      totalSec: active.restSec,
      remainingSec: active.restSec,
      label: active.supersetGroup ? `${active.supersetGroup} · superset` : active.exercise.name,
    });

    // Superset auto-advance: if this exercise is paired, auto-focus next lift
    if (active.supersetGroup) {
      const basePrefix = active.supersetGroup.replace(/[AB]$/, "");
      const paired = items.find(
        (i) => i.id !== active.id && i.supersetGroup && i.supersetGroup.startsWith(basePrefix) && i.sets.length < i.targetSets,
      );
      if (paired) {
        setActiveId(paired.id);
        setToast(`Auto-advanced to superset partner: ${paired.exercise.name}`);
      }
    }

    // Enqueue mutation in offline sync queue
    syncManager.enqueue("COMPLETE_SET", {
      workoutId: workout.id,
      workoutExerciseId: active.id,
      exerciseId: active.exerciseId,
      setIndex,
      weightKg: weight,
      reps,
      rpe,
    });

    startTransition(async () => {
      const res = await completeSet({
        workoutId: workout.id,
        workoutExerciseId: active.id,
        exerciseId: active.exerciseId,
        setIndex,
        weightKg: weight,
        reps,
        rpe,
      });

      if (!res?.ok) {
        setItems((prev) => prev.map((i) => (i.id === active.id ? { ...i, sets: i.sets.filter((s) => s.id !== tempId) } : i)));
        setToast(res?.error ?? "Could not log set");
        return;
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === active.id
            ? { ...i, sets: i.sets.map((s) => (s.id === tempId ? { ...s, id: res.setId ?? tempId, isPR: res.isPR } : s)) }
            : i,
        ),
      );

      if (res.isPR) {
        setCelebrate({ exercise: active.exercise.name, value: res.e1rm, previous: res.previousBest ?? null, weight, reps });
      }

      if (rpe >= 9.5) {
        setNudge(`RPE ${rpe} — Forge suggests ${roundTo(weight * 0.95)}kg next set to protect quality.`);
        setDrafts((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? draft), weight: String(roundTo(weight * 0.95)) } }));
      } else if (rpe <= 6.5 && weight > 0) {
        setNudge(`RPE ${rpe} — green light. Auto-regulating +2.5kg next set.`);
        setDrafts((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? draft), weight: String(roundTo(weight + 2.5)) } }));
      } else {
        setNudge(`Set banked. ${active.targetSets - setIndex - 1 > 0 ? `${active.targetSets - setIndex - 1} working sets left.` : "Exercise volume complete."}`);
      }
      router.refresh();
    });
  };

  const logSet = () => {
    const weight = Math.max(0, Number(draft.weight) || 0);
    const reps = Math.max(1, Math.min(100, Math.round(Number(draft.reps) || 0)));
    logSetSpecific(weight, reps, draft.rpe, "normal");
  };

  const removeSet = (setId: string, itemId: string) => {
    if (setId.startsWith("tmp-")) return;
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, sets: i.sets.filter((s) => s.id !== setId) } : i)));
    startTransition(async () => {
      await undoSet(setId);
      router.refresh();
    });
  };

  const changeTarget = (delta: number) => {
    if (!active) return;
    const next = Math.max(1, Math.min(12, active.targetSets + delta));
    setItems((prev) => prev.map((i) => (i.id === active.id ? { ...i, targetSets: next } : i)));
    startTransition(async () => {
      await updateTargetSets(active.id, next);
    });
  };

  const doSwap = (newExercise: ExerciseLite) => {
    if (!active) return;
    const removed = active.sets.length;
    setItems((prev) => prev.map((i) => (i.id === active.id
      ? { ...i, exerciseId: newExercise.id, exercise: newExercise, sets: [], swappedFrom: i.exerciseId }
      : i)));
    setDrafts((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? draft), weight: String(roundTo((active.history.weight || 40) * 0.85)) } }));
    setShowSwap(false);
    setToast(removed ? `Swapped to ${newExercise.name}. ${removed} set${removed > 1 ? "s" : ""} re-assigned.` : `Swapped to ${newExercise.name}.`);
    startTransition(async () => {
      await swapExercise({ workoutId: workout.id, workoutExerciseId: active.id, newExerciseId: newExercise.id });
      router.refresh();
    });
  };

  const doCompressWithTime = (targetMinutes = 25) => {
    const result = compressSession(
      items.map((i) => ({
        ...i,
        exerciseId: i.exerciseId,
        targetSets: i.targetSets,
        restSec: i.restSec,
        supersetGroup: i.supersetGroup,
        category: i.exercise.category,
        position: i.position,
      })),
      targetMinutes,
    );
    const map = new Map(result.exercises.map((e) => [e.id, e]));
    setItems((prev) =>
      prev
        .filter((i) => !result.dropped.some((d) => d.id === i.id))
        .map((i) => {
          const e = map.get(i.id);
          return e ? { ...i, restSec: e.restSec, supersetGroup: e.supersetGroup } : i;
        }),
    );
    setShowCompress(false);
    setToast(`Compressed to ~${result.compressedMin} min. ${result.diffSummary[0] ?? ""}`);
    startTransition(async () => {
      await compressWorkout(workout.id);
      router.refresh();
    });
  };

  const toggleCrowdedGym = () => {
    const result = adaptForCrowdedGym(
      items.map((i) => ({
        name: i.exercise.name,
        primaryMuscle: i.exercise.primaryMuscle,
        equipment: i.exercise.equipment,
        sets: i.targetSets,
        reps: 8,
      }))
    );
    if (result.substitutedCount > 0) {
      setToast(`Crowded gym: swapped ${result.substitutedCount} rack lifts to dumbbells.`);
    } else {
      setToast("Crowded gym mode active: all exercises use open dumbbell/cable stations.");
    }
  };

  const addExercise = (ex: ExerciseLite) => {
    const tempId = `we-tmp-${uid()}`;
    const item: SessionExercise = {
      id: tempId, exerciseId: ex.id, position: items.length, targetSets: 3,
      repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8, supersetGroup: null,
      swappedFrom: null, notes: null, exercise: ex, sets: [],
      history: { weight: 0, reps: 0, date: null }, suggestion: ex.equipment === "bodyweight" ? 0 : 40,
    };
    setItems((prev) => [...prev, item]);
    setDrafts((d) => ({ ...d, [tempId]: { weight: String(item.suggestion), reps: "8", rpe: 8 } }));
    setActiveId(tempId);
    setShowAdd(false);
    setToast(`${ex.name} added to session.`);
    startTransition(async () => {
      const res = await addExerciseToWorkout({ workoutId: workout.id, exerciseId: ex.id });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === tempId ? { ...i, id: res.id ?? tempId } : i)));
        router.refresh();
      }
    });
  };

  const plates = active ? plateBreakdown(Number(draft.weight) || 0) : null;
  const profileEquipment = EQUIPMENT_PROFILES[activeProfile]?.equipment ?? equipment;
  const alternatives = active ? alternativesFor(active.exercise, allExercises, profileEquipment, 6) : [];
  const prForActive = active ? prs.find((p) => p.exerciseId === active.exerciseId) : null;
  const projectedE1rm = active ? e1rm(Number(draft.weight) || 0, Number(draft.reps) || 0) : 0;
  const recommendation = active
    ? adaptiveTargetWeightWithReason(
        active.history.weight || 0,
        workout.readiness,
        active.rpeTarget,
        active.exercise.equipment,
        active.history.reps,
        active.repsMax,
      )
    : null;

  if (!active) {
    return <div className="p-8 text-center text-mist">This session has no exercises. Add one from the library.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl pb-40">
      {/* top bar */}
      <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-white/[0.06] bg-ink/90 px-4 py-3 backdrop-blur-xl md:top-16 md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href="/app/train" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-chalk">{workout.name}</p>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-dim">
              <span className="flex items-center gap-1"><Clock className="size-2.5" /> {formatClock(elapsed)}</span>
              <span>·</span>
              <span>{totalSets} sets</span>
              <span>·</span>
              <span>{formatVolume(volume)} kg</span>
            </div>
          </div>
          <SyncStatusPill className="shrink-0" />
          <button onClick={() => setShowFinish(true)} className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-acid px-4 text-[12px] font-semibold text-ink">
            Finish <Check className="size-3.5" />
          </button>
        </div>
        <div className="mx-auto mt-3 flex max-w-4xl items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-acid transition-[width] duration-500" style={{ width: `${Math.min(100, donePct)}%` }} />
          </div>
          <span className="font-mono text-[9px] text-dim">{totalSets}/{targetSets}</span>
        </div>
      </div>

      {/* exercise pills */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {items.map((item, idx) => {
          const complete = item.sets.length >= item.targetSets;
          const isActive = item.id === active.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] transition-colors",
                isActive ? "border-acid/40 bg-acid/10 text-chalk" : complete ? "border-mint/20 bg-mint/[0.04] text-mist" : "border-white/[0.07] bg-white/[0.02] text-mist hover:border-white/15",
              )}
            >
              <span className={cn("grid size-4 place-items-center rounded-full font-mono text-[8px]", complete ? "bg-mint/20 text-mint" : isActive ? "bg-acid text-ink" : "bg-white/10 text-dim")}>
                {complete ? "✓" : idx + 1}
              </span>
              <span className="max-w-[116px] truncate">{item.exercise.name}</span>
              {item.supersetGroup && (
                <span className="rounded bg-amber/15 px-1 py-0.5 font-mono text-[8px] font-bold text-amber">
                  {item.supersetGroup}
                </span>
              )}
              <span className="font-mono text-[8.5px] text-dim">{item.sets.length}/{item.targetSets}</span>
            </button>
          );
        })}
        <button onClick={() => setShowAdd(true)} className="grid size-8 shrink-0 place-items-center self-center rounded-full border border-dashed border-white/15 text-dim hover:border-acid/40 hover:text-acid" aria-label="Add exercise">
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* main exercise card */}
      <div className="surface relative overflow-hidden rounded-3xl">
        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full" style={{ background: `radial-gradient(circle, ${muscleColor(active.exercise.primaryMuscle)}18, transparent 70%)` }} />
        <div className="relative p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em]" style={{ borderColor: `${muscleColor(active.exercise.primaryMuscle)}40`, color: muscleColor(active.exercise.primaryMuscle), background: `${muscleColor(active.exercise.primaryMuscle)}10` }}>
                  {muscleLabel(active.exercise.primaryMuscle)}
                </span>
                <Badge tone="neutral">{titleCase(active.exercise.equipment)}</Badge>
                {active.supersetGroup && <Badge tone="amber">{active.supersetGroup}</Badge>}
                {active.swappedFrom && <Badge tone="sky">swapped</Badge>}
                {workout.compressed && <Badge tone="grape">compressed</Badge>}
              </div>
              <h1 className="font-display text-[26px] font-bold leading-[0.95] tracking-[-0.045em] md:text-[34px]">{active.exercise.name}</h1>
              <p className="mt-1.5 text-[11.5px] text-mist">
                {active.exercise.unilateral ? "Per side · " : ""}Target {active.repsMin}–{active.repsMax} reps · RPE {active.rpeTarget} · {active.restSec}s rest
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPlateCalc(true)}
                className="press flex shrink-0 items-center gap-1.5 rounded-full border border-acid/20 bg-acid/[0.05] px-3 py-2 text-[11px] font-medium text-acid hover:border-acid/40"
              >
                <Dumbbell className="size-3" /> Plates
              </button>
              <button onClick={() => setShowSwap(true)} className="press flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-mist hover:text-chalk">
                <ArrowRight className="size-3" /> Swap
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Last time</p>
              <p className="mt-1 font-numeric text-[13px] font-medium">{active.history.weight ? `${active.history.weight}kg × ${active.history.reps}` : "First time"}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">PR e1RM</p>
              <p className="mt-1 font-numeric text-[13px] font-medium text-amber">{prForActive ? `${prForActive.value}kg` : "—"}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">This set e1RM</p>
              <p className="mt-1 font-numeric text-[13px] font-medium text-acid">{projectedE1rm || "—"}{projectedE1rm ? "kg" : ""}</p>
            </div>
          </div>

          {/* Auto-Regulation Explainer (Why) */}
          {recommendation && recommendation.targetWeight > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowWhy((w) => !w)}
                className="flex w-full items-center justify-between rounded-xl border border-acid/25 bg-acid/[0.06] p-2.5 text-left transition-colors hover:border-acid/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-acid shrink-0" />
                  <span className="text-[11.5px] font-medium text-chalk">
                    Adaptive Target: <strong className="text-acid">{recommendation.targetWeight} kg</strong>
                  </span>
                  <span className="rounded bg-acid/15 px-1.5 py-0.5 font-mono text-[7.5px] font-bold uppercase text-acid">
                    {recommendation.factor.replace("_", " ")}
                  </span>
                </div>
                <span className="font-mono text-[8.5px] text-acid/90 hover:underline">
                  {showWhy ? "Hide why ▲" : "Why this weight? ▼"}
                </span>
              </button>

              {showWhy && (
                <div className="animate-fade-in mt-1.5 rounded-xl border border-white/[0.08] bg-black/40 p-3 text-[11px] text-mist space-y-1.5">
                  <p className="font-semibold text-chalk">Engine Auto-Regulation Reason:</p>
                  <p className="leading-relaxed">{recommendation.reason}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/[0.06] font-mono text-[8.5px] text-dim">
                    <span>Baseline: {recommendation.baseWeight} kg</span>
                    <span>Adjustment: {recommendation.adjustmentKg > 0 ? `+${recommendation.adjustmentKg}` : recommendation.adjustmentKg} kg</span>
                    <span>Readiness: {recommendation.readinessScore}/100</span>
                    <span>RPE Target: {recommendation.rpeTarget}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <button onClick={() => setShowCues((v) => !v)} className="flex items-center gap-1.5 text-[11px] text-mist hover:text-chalk">
              <Info className="size-3.5" /> Form cues <ChevronDown className={cn("size-3 transition-transform", showCues && "rotate-180")} />
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => changeTarget(-1)} className="grid size-6 place-items-center rounded-md border border-white/10 text-dim hover:text-chalk">−</button>
              <span className="px-1 font-mono text-[9.5px] text-mist">{active.targetSets} sets</span>
              <button onClick={() => changeTarget(1)} className="grid size-6 place-items-center rounded-md border border-white/10 text-dim hover:text-chalk">+</button>
            </div>
          </div>

          {showCues && (
            <div className="animate-fade-in mt-3 rounded-xl border border-white/[0.07] bg-black/25 p-3">
              <ul className="space-y-1.5">
                {active.exercise.cues.map((cue) => (
                  <li key={cue} className="flex gap-2 text-[11px] leading-relaxed text-mist">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-acid" /> {cue}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-white/[0.06] pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-dim">Tempo {active.exercise.tempo} · {active.exercise.difficulty}</p>
            </div>
          )}
        </div>
      </div>

      {/* sets */}
      <div className="mt-4 space-y-2 rounded-2xl border border-white/[0.07] bg-panel/60 p-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-dim">Lifting sets</span>
            <span className="font-mono text-[8.5px] text-acid">
              {active.sets.length}/{active.targetSets} completed
            </span>
          </div>
          <button
            onClick={() => setShowPlateCalc(true)}
            className="flex items-center gap-1 font-mono text-[9px] text-mist hover:text-acid transition-colors"
          >
            <Dumbbell className="size-3" /> Plate Math
          </button>
        </div>

        {/* Completed Sets using SetRow */}
        {active.sets.map((s, idx) => (
          <SetRow
            key={s.id}
            index={idx}
            setData={{
              id: s.id,
              setIndex: idx,
              weightKg: s.weightKg,
              reps: s.reps,
              rpe: s.rpe,
              isPR: s.isPR,
              isCompleted: true,
            }}
            previousWeight={active.history.weight}
            previousReps={active.history.reps}
            targetRepsMin={active.repsMin}
            targetRepsMax={active.repsMax}
            targetWeight={active.suggestion || 40}
            onLog={(w, r, rpe, t) => logSetSpecific(w, r, rpe, t)}
            onDelete={() => removeSet(s.id, active.id)}
            onOpenPlateCalc={() => setShowPlateCalc(true)}
          />
        ))}

        {/* Next / Planned Pending Sets */}
        {Array.from({ length: Math.max(1, active.targetSets - active.sets.length) }).map((_, pIdx) => {
          const currentSetIdx = active.sets.length + pIdx;
          return (
            <SetRow
              key={`pending-${currentSetIdx}`}
              index={currentSetIdx}
              setData={{
                id: `pending-${currentSetIdx}`,
                setIndex: currentSetIdx,
                weightKg: Number(draft.weight) || active.suggestion || active.history.weight || 40,
                reps: Number(draft.reps) || active.repsMin || 8,
                rpe: draft.rpe,
                isCompleted: false,
              }}
              previousWeight={active.history.weight}
              previousReps={active.history.reps}
              targetRepsMin={active.repsMin}
              targetRepsMax={active.repsMax}
              targetWeight={active.suggestion || active.history.weight || 40}
              onLog={(w, r, rpe, t) => logSetSpecific(w, r, rpe, t)}
              onOpenPlateCalc={() => setShowPlateCalc(true)}
            />
          );
        })}

        {/* Quick Stepper & Voice / NLP Input (C1) */}
        <div className="pt-2 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">Quick Load</span>
            {[-10, -5, -2.5, 2.5, 5, 10].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() =>
                  setDraft({
                    weight: String(Math.max(0, roundTo((Number(draft.weight) || active.suggestion || 40) + delta))),
                  })
                }
                className="rounded-md border border-white/[0.08] px-2 py-1 font-mono text-[9.5px] text-mist hover:border-acid/40 hover:text-acid transition-colors"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        {/* NLP Command Bar & Voice Recognition (C1) */}
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 p-1.5">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commandInput.trim()) {
                const parsed = parseWorkoutVoiceCommand(commandInput, {
                  currentExercise: active.exercise.name,
                  currentWeight: Number(draft.weight) || active.suggestion || 40,
                  currentReps: Number(draft.reps) || 8,
                  currentRpe: draft.rpe,
                });
                if (parsed.matched) {
                  if (parsed.action === "skip_rest") {
                    setRest(null);
                    setToast("Rest timer skipped.");
                  } else if (parsed.action === "adjust_rest" && parsed.restAdjustmentSec) {
                    setRest((r) => r ? { ...r, remainingSec: r.remainingSec + parsed.restAdjustmentSec!, totalSec: r.totalSec + parsed.restAdjustmentSec! } : null);
                    setToast(`Added ${parsed.restAdjustmentSec}s to rest.`);
                  } else {
                    setVoiceConfirm(parsed);
                  }
                  setCommandInput("");
                } else {
                  setToast("Command not recognized. Try e.g. '100x8@8' or 'two plates for 5'.");
                }
              }
            }}
            placeholder="Command or shorthand (e.g. 100x8@8, 2 plates for 5, skip rest)..."
            className="flex-1 bg-transparent px-2.5 text-[11px] text-chalk placeholder:text-dim focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
              if (!SR) {
                setToast("Voice logging requires Chrome or Safari speech API. Use the command bar to type shorthand.");
                return;
              }
              const rec = new SR();
              rec.lang = "en-US";
              rec.interimResults = false;
              rec.onresult = (e: any) => {
                const transcript = e.results[0][0].transcript;
                const parsed = parseWorkoutVoiceCommand(transcript, {
                  currentExercise: active.exercise.name,
                  currentWeight: Number(draft.weight) || active.suggestion || 40,
                  currentReps: Number(draft.reps) || 8,
                  currentRpe: draft.rpe,
                });
                if (parsed.matched) {
                  if (parsed.action === "skip_rest") {
                    setRest(null);
                    setToast("Rest timer skipped.");
                  } else if (parsed.action === "adjust_rest" && parsed.restAdjustmentSec) {
                    setRest((r) => r ? { ...r, remainingSec: r.remainingSec + parsed.restAdjustmentSec!, totalSec: r.totalSec + parsed.restAdjustmentSec! } : null);
                    setToast(`Added ${parsed.restAdjustmentSec}s to rest.`);
                  } else {
                    setVoiceConfirm(parsed);
                  }
                } else {
                  setToast(`Heard: "${transcript}". Couldn't parse set. Try e.g. "100 kilos for 8".`);
                }
              };
              rec.onerror = () => setToast("Mic unavailable. Please check microphone permissions.");
              rec.start();
              setToast("Listening… say e.g. “bench 100 kilos for 8” or “two plates for 5”");
            }}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-acid/30 bg-acid/[0.1] px-2.5 font-mono text-[9.5px] font-semibold text-acid hover:bg-acid/[0.2] transition-colors"
          >
            <Mic className="size-3" /> Voice
          </button>
        </div>

        {nudge && (
          <div className="animate-fade-in mt-2 flex items-start gap-2 rounded-xl border border-acid/20 bg-acid/[0.06] p-2.5">
            <Zap className="mt-0.5 size-3.5 shrink-0 text-acid" />
            <p className="text-[10.5px] leading-relaxed text-acid/90">{nudge}</p>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button onClick={() => setShowCompress(true)} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-grape/30 hover:text-grape">
          <Wand2 className="size-4" /> Compress
        </button>
        <button onClick={toggleCrowdedGym} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-amber/30 hover:text-amber">
          <Users className="size-4" /> Crowded
        </button>
        <button onClick={() => setShowSwap(true)} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-sky/30 hover:text-sky">
          <ArrowRight className="size-4" /> Swap
        </button>
        <button onClick={() => setShowAdd(true)} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-acid/30 hover:text-acid">
          <Plus className="size-4" /> Add lift
        </button>
      </div>

      {active.sets.length >= active.targetSets && items.some((i) => i.sets.length < i.targetSets) && (
        <button
          onClick={() => setActiveId(items.find((i) => i.sets.length < i.targetSets)!.id)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-mint/20 bg-mint/[0.06] py-3 text-[12px] font-medium text-mint"
        >
          Exercise complete — next lift <ArrowRight className="size-3.5" />
        </button>
      )}

      {/* floating rest timer */}
      <FloatingRestTimer
        timer={rest}
        onAdjust={(delta) =>
          setRest((r) =>
            r
              ? {
                  ...r,
                  remainingSec: Math.max(0, r.remainingSec + delta),
                  totalSec: Math.max(r.totalSec, r.totalSec + delta),
                }
              : null,
          )
        }
        onSkip={() => setRest(null)}
      />

      {/* toast */}
      {toast && (
        <div className="animate-fade-in fixed left-1/2 top-24 z-[70] w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-white/10 bg-panel-3 px-4 py-2 text-[11.5px] text-chalk shadow-xl">
          {toast}
        </div>
      )}

      {/* PR celebration */}
      <PRCard
        open={!!celebrate}
        onClose={() => setCelebrate(null)}
        user={user}
        exercise={celebrate?.exercise ?? ""}
        value={celebrate?.value ?? 0}
        previous={celebrate?.previous ?? null}
        weight={celebrate?.weight ?? 0}
        reps={celebrate?.reps ?? 0}
      />

      {/* plate calculator modal */}
      <PlateCalculatorModal
        isOpen={showPlateCalc}
        onClose={() => setShowPlateCalc(false)}
        weightKg={Number(draft.weight) || active.suggestion || active.history.weight || 40}
        exerciseName={active.exercise.name}
        onSelectWeight={(w) => {
          setDraft({ weight: String(w) });
          setShowPlateCalc(false);
        }}
      />

      {/* swap modal with equipment profiles (B3) */}
      {showSwap && (
        <Sheet title="Swap exercise" subtitle="Same pattern, same stimulus — ranked for your kit." onClose={() => setShowSwap(false)}>
          <div className="mb-3">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim block mb-1.5">
              Gym Equipment Profile:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(Object.keys(EQUIPMENT_PROFILES) as EquipmentProfileId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => setActiveProfile(pid)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[9.5px] font-medium transition-colors",
                    activeProfile === pid
                      ? "border-acid bg-acid/10 text-acid font-semibold"
                      : "border-white/[0.08] bg-white/[0.02] text-dim hover:text-mist",
                  )}
                >
                  {EQUIPMENT_PROFILES[pid].name}
                </button>
              ))}
            </div>
            <p className="mt-1 font-mono text-[8px] text-dim">
              {EQUIPMENT_PROFILES[activeProfile].description}
            </p>
          </div>

          <div className="space-y-2">
            {alternatives.map((alt) => (
              <button key={alt.id} onClick={() => doSwap(alt)} className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition-colors hover:border-acid/30 hover:bg-acid/[0.04]">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: `${muscleColor(alt.primaryMuscle)}14`, color: muscleColor(alt.primaryMuscle) }}>
                  <Dumbbell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-chalk">{alt.name}</p>
                  <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">{titleCase(alt.equipment)} · {muscleLabel(alt.primaryMuscle)} · {alt.reasons.join(" · ") || "Compatible"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-acid/10 px-2 py-0.5 font-numeric text-[10px] text-acid">{alt.score}</span>
              </button>
            ))}
            {!alternatives.length && (
              <p className="rounded-xl border border-white/[0.07] p-6 text-center text-[12px] text-mist">
                No ranked matches with {EQUIPMENT_PROFILES[activeProfile].name} profile. Switch profile above or pick any compatible lift below.
              </p>
            )}
          </div>
          <p className="mt-4 label-mono">All compatible lifts</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {allExercises.filter((e) => profileEquipment.includes(e.equipment) && e.id !== active.exerciseId && !alternatives.some((a) => a.id === e.id)).slice(0, 8).map((e) => (
              <button key={e.id} onClick={() => doSwap(e)} className="rounded-lg border border-white/[0.05] px-3 py-2 text-left text-[11px] text-mist hover:border-white/15 hover:text-chalk">
                {e.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* session compression modal (B4) */}
      {showCompress && (
        <CompressionModal
          exercises={items}
          onApply={(targetMin) => doCompressWithTime(targetMin)}
          onClose={() => setShowCompress(false)}
        />
      )}

      {/* voice / command confirmation sheet (C1) */}
      {voiceConfirm && (
        <VoiceConfirmSheet
          command={voiceConfirm}
          activeExerciseName={active.exercise.name}
          onConfirm={(w, r, rpe, t) => {
            logSetSpecific(w, r, rpe, t);
            setVoiceConfirm(null);
            setToast(`Logged: ${w}kg × ${r} @ RPE ${rpe}`);
          }}
          onClose={() => setVoiceConfirm(null)}
        />
      )}

      {/* add modal */}
      {showAdd && <AddExerciseSheet allExercises={allExercises} onAdd={addExercise} onClose={() => setShowAdd(false)} />}

      {/* finish modal */}
      {showFinish && (
        <Sheet title="Finish session" subtitle="Lock in the work. Your coach will adjust tomorrow." onClose={() => setShowFinish(false)}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Duration", value: formatClock(elapsed), icon: Clock },
              { label: "Volume", value: `${formatVolume(volume)}kg`, icon: TrendingUp },
              { label: "Sets", value: String(totalSets), icon: Layers },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                <s.icon className="mx-auto mb-1.5 size-3.5 text-dim" />
                <p className="font-numeric text-[15px] font-semibold">{s.value}</p>
                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">{s.label}</p>
              </div>
            ))}
          </div>
          <form
            action={finishWorkout}
            onSubmit={() => setFinishing(true)}
            className="mt-4"
          >
            <input type="hidden" name="workoutId" value={workout.id} />
            <label className="label-mono mb-1.5 block">Session notes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Bar speed was crisp. Left shoulder slightly tight on incline…"
              className="w-full resize-none rounded-xl border border-white/[0.09] bg-ink px-3 py-2.5 text-[12px] text-chalk placeholder:text-dim focus:border-acid/40 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] leading-relaxed text-dim">{totalSets < targetSets ? `${targetSets - totalSets} sets short of target. Finish anyway?` : "All target sets logged. Strong session."}</p>
              <button disabled={finishing} className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-acid px-6 text-[13px] font-semibold text-ink disabled:opacity-50">
                {finishing ? "Saving…" : "Finish & save"} <Check className="size-4" />
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}

/* ─────────────────────── helpers ─────────────────────── */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onerror: () => void;
};

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close backdrop" />
      <div className="animate-fade-up relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold tracking-[-0.03em]">{title}</h3>
            <p className="mt-1 text-[11px] text-mist">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close sheet" className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddExerciseSheet({ allExercises, onAdd, onClose }: { allExercises: ExerciseLite[]; onAdd: (e: ExerciseLite) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const filtered = allExercises.filter((e) => matchExercise(q, e)).slice(0, 30);
  return (
    <Sheet title="Add exercise" subtitle="Anything in the library. Forge logs it the same way." onClose={onClose}>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-ink px-3">
        <Search className="size-3.5 text-dim" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 63 movements…" className="flex-1 bg-transparent text-[12px] text-chalk placeholder:text-dim focus:outline-none" />
      </div>
      <div className="mt-3 max-h-[52vh] space-y-1 overflow-y-auto pr-1">
        {filtered.map((e) => (
          <button key={e.id} onClick={() => onAdd(e)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: muscleColor(e.primaryMuscle) }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-chalk/90">{e.name}</p>
              <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">{muscleLabel(e.primaryMuscle)} · {e.equipment}</p>
            </div>
            <Plus className="size-3.5 shrink-0 text-dim" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function CompressionModal({
  exercises,
  onApply,
  onClose,
}: {
  exercises: SessionExercise[];
  onApply: (targetMin: number) => void;
  onClose: () => void;
}) {
  const [selectedMin, setSelectedMin] = useState<number>(25);
  const diff = useMemo(() => {
    return compressSession(
      exercises.map((i) => ({
        ...i,
        exerciseId: i.exerciseId,
        targetSets: i.targetSets,
        restSec: i.restSec,
        supersetGroup: i.supersetGroup,
        category: i.exercise.category,
        position: i.position,
      })),
      selectedMin,
    );
  }, [exercises, selectedMin]);

  return (
    <Sheet
      title="Compress Session (B4)"
      subtitle="Running short on time? Compress straight sets into paired supersets and trim rest."
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Time Target Selector */}
        <div>
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
            Select Time Window:
          </span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[15, 25, 40].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setSelectedMin(mins)}
                className={cn(
                  "rounded-xl border p-3 text-center transition-all",
                  selectedMin === mins
                    ? "border-acid bg-acid/10 text-chalk"
                    : "border-white/[0.08] bg-white/[0.02] text-mist hover:border-white/20",
                )}
              >
                <p className="font-numeric text-xl font-bold">{mins}</p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-dim">
                  {mins === 15 ? "Blitz" : mins === 25 ? "Standard" : "Moderate"} min
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Diff Comparison Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Original Estimate</span>
              <p className="font-numeric text-base text-mist line-through">~{diff.originalMin} min</p>
            </div>
            <ArrowRight className="size-4 text-acid" />
            <div className="text-right">
              <span className="font-mono text-[8px] uppercase tracking-wider text-acid">Compressed Duration</span>
              <p className="font-numeric text-xl font-bold text-acid">~{diff.compressedMin} min</p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Changes Applied:</span>
            {diff.diffSummary.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[11px] text-chalk/90">
                <span className="mt-1 size-1.5 rounded-full bg-acid shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2.5 text-[12px] text-mist hover:text-chalk"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(selectedMin)}
            className="press inline-flex items-center gap-2 rounded-full bg-acid px-6 py-2.5 text-[12px] font-semibold text-ink"
          >
            Apply {selectedMin}-Min Compression <Wand2 className="size-3.5" />
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function VoiceConfirmSheet({
  command,
  activeExerciseName,
  onConfirm,
  onClose,
}: {
  command: ParsedLogCommand;
  activeExerciseName: string;
  onConfirm: (weight: number, reps: number, rpe: number, type: SetType) => void;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState(command.weightKg ?? 40);
  const [reps, setReps] = useState(command.reps ?? 8);
  const [rpe, setRpe] = useState(command.rpe ?? 8);
  const [type, setType] = useState<SetType>(command.isWarmup ? "warmup" : command.isFailure ? "failure" : "normal");

  return (
    <Sheet
      title="Confirm Logged Set (C1)"
      subtitle={command.rawText ? `Parsed: “${command.rawText}”` : "Verify logged set details"}
      onClose={onClose}
    >
      <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Exercise</span>
            <p className="text-[14px] font-semibold text-chalk">
              {command.exerciseName ?? activeExerciseName}
            </p>
          </div>
          <span className="rounded-full bg-acid/15 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-acid">
            {Math.round(command.confidence * 100)}% match
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Weight</span>
            <div className="mt-1 flex items-center justify-center gap-1">
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-16 bg-transparent text-center font-numeric text-lg font-bold text-acid focus:outline-none"
              />
              <span className="text-[11px] text-dim">kg</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">Reps</span>
            <div className="mt-1 flex items-center justify-center gap-1">
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="w-12 bg-transparent text-center font-numeric text-lg font-bold text-chalk focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">RPE</span>
            <div className="mt-1 flex items-center justify-center gap-1">
              <input
                type="number"
                step="0.5"
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-12 bg-transparent text-center font-numeric text-lg font-bold text-amber focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <span className="font-mono text-[9px] uppercase tracking-wider text-dim">Set Type</span>
          <div className="flex gap-1">
            {(["normal", "warmup", "failure"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                  type === t ? "bg-acid text-ink font-semibold" : "bg-white/[0.04] text-mist hover:text-chalk",
                )}
              >
                {t === "normal" ? "Normal" : t === "warmup" ? "Warmup" : "Failure"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 px-4 py-2.5 text-[12px] text-mist hover:text-chalk"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(weight, reps, rpe, type)}
          className="press inline-flex items-center gap-1.5 rounded-full bg-acid px-6 py-2.5 text-[12px] font-semibold text-ink"
        >
          Confirm &amp; Log Set <Check className="size-3.5" />
        </button>
      </div>
    </Sheet>
  );
}
