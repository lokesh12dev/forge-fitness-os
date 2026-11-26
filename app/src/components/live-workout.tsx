"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Dumbbell, Flame, Info,
  Layers, Mic, Plus, Search, Sparkles, Timer, Trash2, TrendingUp, Trophy,
  Wand2, X, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { PRCard } from "@/components/pr-card";
import { cn, formatClock, formatVolume, titleCase } from "@/lib/utils";
import { alternativesFor, compressSession, e1rm, muscleColor, muscleLabel, plateBreakdown } from "@/lib/engine";
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
  const [rest, setRest] = useState<{ total: number; remaining: number; label: string } | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showCues, setShowCues] = useState(false);
  const [celebrate, setCelebrate] = useState<{ exercise: string; value: number; previous: number | null; weight: number; reps: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const [finishing, setFinishing] = useState(false);
  const elapsed = useElapsed(workout.startedAt);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const draft = active ? drafts[active.id] ?? { weight: "0", reps: String(active.repsMin), rpe: active.rpeTarget } : { weight: "0", reps: "8", rpe: 8 };

  const allSets = useMemo(() => items.flatMap((i) => i.sets), [items]);
  const volume = allSets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const targetSets = items.reduce((a, i) => a + i.targetSets, 0);
  const donePct = Math.round((allSets.length / Math.max(1, targetSets)) * 100);
  const totalSets = allSets.length;

  useEffect(() => {
    if (!rest) return;
    if (rest.remaining <= 0) {
      setRest(null);
      if ("vibrate" in navigator) navigator.vibrate?.([90, 60, 90]);
      return;
    }
    const t = setTimeout(() => {
      setRest((r) => (r ? { ...r, remaining: Math.max(0, r.remaining - 1) } : r));
    }, 1000);
    return () => clearTimeout(t);
  }, [rest]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const setDraft = (patch: Partial<{ weight: string; reps: string; rpe: number }>) => {
    if (!active) return;
    setDrafts((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? draft), ...patch } }));
    setNudge(null);
  };

  const startRest = (seconds: number, label: string) => {
    setRest({ total: seconds, remaining: seconds, label });
  };

  const logSet = () => {
    if (!active) return;
    const weight = Math.max(0, Number(draft.weight) || 0);
    const reps = Math.max(1, Math.min(100, Math.round(Number(draft.reps) || 0)));
    const rpe = draft.rpe;
    const setIndex = active.sets.length;
    const tempId = `tmp-${uid()}`;
    const optimistic: SessionSet = {
      id: tempId, setIndex, weightKg: weight, reps, rpe, isPR: false, completedAt: new Date().toISOString(),
    };
    setItems((prev) => prev.map((i) => (i.id === active.id ? { ...i, sets: [...i.sets, optimistic] } : i)));
    startRest(active.restSec, active.supersetGroup ? `${active.supersetGroup} · superset` : active.exercise.name);

    startTransition(async () => {
      const res = await completeSet({
        workoutId: workout.id, workoutExerciseId: active.id, exerciseId: active.exerciseId,
        setIndex, weightKg: weight, reps, rpe,
      });
      if (!res?.ok) {
        setItems((prev) => prev.map((i) => (i.id === active.id ? { ...i, sets: i.sets.filter((s) => s.id !== tempId) } : i)));
        setToast(res?.error ?? "Could not log set");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === active.id
        ? { ...i, sets: i.sets.map((s) => (s.id === tempId ? { ...s, id: res.setId ?? tempId, isPR: res.isPR } : s)) }
        : i)));
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

  const doCompress = () => {
    const result = compressSession(items.map((i) => ({ ...i, exerciseId: i.exerciseId, targetSets: i.targetSets, restSec: i.restSec, supersetGroup: i.supersetGroup })), 25);
    const map = new Map(result.exercises.map((e) => [e.id, e]));
    setItems((prev) => prev.map((i) => {
      const e = map.get(i.id);
      return e ? { ...i, restSec: e.restSec, supersetGroup: e.supersetGroup } : i;
    }));
    setToast(`Compressed to ~${result.compressedMin} min. Rest cut to 45s, lifts paired.`);
    startTransition(async () => {
      await compressWorkout(workout.id);
      router.refresh();
    });
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
  const alternatives = active ? alternativesFor(active.exercise, allExercises, equipment, 6) : [];
  const prForActive = active ? prs.find((p) => p.exerciseId === active.exerciseId) : null;
  const projectedE1rm = active ? e1rm(Number(draft.weight) || 0, Number(draft.reps) || 0) : 0;

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
            <button onClick={() => setShowSwap(true)} className="press flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-mist hover:text-chalk">
              <ArrowRight className="size-3" /> Swap
            </button>
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
      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-panel/60">
        <div className="grid grid-cols-[36px_1fr_1fr_56px_28px] items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <span className="label-mono">Set</span>
          <span className="label-mono">Weight</span>
          <span className="label-mono">Reps</span>
          <span className="label-mono">RPE</span>
          <span />
        </div>
        {active.sets.map((s, idx) => (
          <div key={s.id} className="group grid grid-cols-[36px_1fr_1fr_56px_28px] items-center gap-2 border-b border-white/[0.04] px-4 py-2.5">
            <span className={cn("grid size-6 place-items-center rounded-md font-mono text-[10px]", s.isPR ? "bg-amber/15 text-amber" : "bg-white/[0.05] text-mist")}>
              {s.isPR ? <Trophy className="size-3" /> : idx + 1}
            </span>
            <span className="font-numeric text-[13px] text-chalk">{s.weightKg}<span className="ml-0.5 text-[9px] text-dim">kg</span></span>
            <span className="font-numeric text-[13px] text-chalk">{s.reps}<span className="ml-0.5 text-[9px] text-dim">reps</span></span>
            <span className="font-numeric text-[11px] text-mist">{s.rpe}</span>
            <button onClick={() => removeSet(s.id, active.id)} className="grid size-6 place-items-center rounded text-dim opacity-0 transition-opacity hover:text-flame group-hover:opacity-100" aria-label="Delete set">
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}

        {/* logger */}
        <div className="bg-white/[0.02] p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label-mono mb-1.5 block">Weight · kg</label>
              <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.1] bg-ink">
                <button onClick={() => setDraft({ weight: String(Math.max(0, roundTo(Number(draft.weight) - 2.5))) })} className="grid h-11 w-10 shrink-0 place-items-center text-lg text-mist hover:bg-white/5">−</button>
                <input
                  inputMode="decimal"
                  value={draft.weight}
                  onChange={(e) => setDraft({ weight: e.target.value.replace(/[^0-9.]/g, "") })}
                  className="h-11 min-w-0 flex-1 bg-transparent text-center font-numeric text-xl font-semibold text-chalk outline-none"
                />
                <button onClick={() => setDraft({ weight: String(roundTo(Number(draft.weight) + 2.5)) })} className="grid h-11 w-10 shrink-0 place-items-center text-lg text-mist hover:bg-white/5">+</button>
              </div>
            </div>
            <div className="w-[104px]">
              <label className="label-mono mb-1.5 block">Reps</label>
              <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.1] bg-ink">
                <button onClick={() => setDraft({ reps: String(Math.max(1, Number(draft.reps) - 1)) })} className="grid h-11 w-8 shrink-0 place-items-center text-mist hover:bg-white/5">−</button>
                <input
                  inputMode="numeric"
                  value={draft.reps}
                  onChange={(e) => setDraft({ reps: e.target.value.replace(/[^0-9]/g, "") })}
                  onKeyDown={(e) => { if (e.key === "Enter") logSet(); }}
                  className="h-11 min-w-0 flex-1 bg-transparent text-center font-numeric text-xl font-semibold text-chalk outline-none"
                />
                <button onClick={() => setDraft({ reps: String(Number(draft.reps) + 1) })} className="grid h-11 w-8 shrink-0 place-items-center text-mist hover:bg-white/5">+</button>
              </div>
            </div>
            <button onClick={logSet} disabled={pending} className="press grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-acid text-ink shadow-[0_6px_24px_-8px_rgba(201,247,58,0.6)] disabled:opacity-60" aria-label="Log set">
              <Check className="size-5" strokeWidth={3} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">RPE</span>
            {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => (
              <button
                key={r}
                onClick={() => setDraft({ rpe: r })}
                className={cn(
                  "h-6 min-w-[26px] rounded-md border px-1.5 font-numeric text-[10px] transition-colors",
                  draft.rpe === r ? "border-acid bg-acid text-ink" : "border-white/10 text-mist hover:border-white/25",
                )}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => {
                const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
                  ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
                if (!SR) { setToast("Voice logging needs Chrome or Safari. Type it for now."); return; }
                const rec = new SR();
                rec.lang = "en-US";
                rec.interimResults = false;
                rec.onresult = (e: { results: { 0: { 0: { transcript: string } } } }) => {
                  const text = e.results[0][0].transcript.toLowerCase();
                  const nums = text.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
                  const rpeMatch = text.match(/rpe\s*(\d+(\.\d+)?)/);
                  const forMatch = text.match(/(?:for|x)\s*(\d+)/);
                  if (nums.length) {
                    const weight = nums[0];
                    const reps = forMatch ? Number(forMatch[1]) : nums[1] ?? Number(draft.reps);
                    setDraft({ weight: String(weight), reps: String(reps), ...(rpeMatch ? { rpe: Number(rpeMatch[1]) } : {}) });
                    setToast(`Heard: ${weight}kg × ${reps}${rpeMatch ? ` @ RPE ${rpeMatch[1]}` : ""}`);
                  } else setToast("Couldn't parse that. Try “100 kilos for 8”.");
                };
                rec.onerror = () => setToast("Mic unavailable. Check permissions.");
                rec.start();
                setToast("Listening… say “100 kilos for 8”");
              }}
              className="ml-auto flex h-6 items-center gap-1 rounded-md border border-white/10 px-2 text-[9.5px] text-mist hover:border-acid/40 hover:text-acid"
            >
              <Mic className="size-2.5" /> Voice
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">Quick</span>
              {[0.9, 0.95, 1, 1.05].map((m) => {
                const base = active.suggestion || active.history.weight || 40;
                const w = roundTo(base * m);
                return (
                  <button key={m} onClick={() => setDraft({ weight: String(w) })} className="rounded-md border border-white/[0.08] px-2 py-1 font-numeric text-[10px] text-mist hover:border-acid/30 hover:text-chalk">
                    {w}
                  </button>
                );
              })}
            </div>
            {plates && Number(draft.weight) > 0 && (
              <div className="flex items-center gap-1.5 text-[9.5px] text-dim">
                <Dumbbell className="size-3" />
                <span>Per side</span>
                {plates.perSide.length ? plates.perSide.map((p, i) => (
                  <span key={i} className="rounded bg-white/[0.07] px-1.5 py-0.5 font-numeric text-[9px] text-mist">{p}</span>
                )) : <span className="text-dim">bar only</span>}
              </div>
            )}
          </div>

          {nudge && (
            <div className="animate-fade-in mt-3 flex items-start gap-2 rounded-xl border border-acid/20 bg-acid/[0.06] p-2.5">
              <Zap className="mt-0.5 size-3.5 shrink-0 text-acid" />
              <p className="text-[10.5px] leading-relaxed text-acid/90">{nudge}</p>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={doCompress} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-grape/30 hover:text-grape">
          <Wand2 className="size-4" /> Compress
        </button>
        <button onClick={() => setShowSwap(true)} className="press flex flex-col items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2.5 text-[10px] text-mist hover:border-sky/30 hover:text-sky">
          <ArrowRight className="size-4" /> Swap exercise
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

      {/* rest timer */}
      {rest && (
        <div className="fixed inset-x-0 bottom-[64px] z-50 px-3 md:bottom-4 md:left-[248px] md:px-6">
          <div className="animate-fade-in mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-acid/30 bg-[#0c0e12]/95 p-3 shadow-[0_20px_60px_-15px_rgba(201,247,58,0.35)] backdrop-blur-xl">
            <div className="relative grid size-12 shrink-0 place-items-center">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
                <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle cx="22" cy="22" r="19" fill="none" stroke="#C9F73A" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - rest.remaining / Math.max(1, rest.total))} style={{ transition: "stroke-dashoffset 1s linear" }} />
              </svg>
              <span className="font-numeric text-[13px] font-bold text-acid">{rest.remaining}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-chalk">Resting · {rest.label}</p>
              <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">Next set in {rest.remaining}s · breathe</p>
            </div>
            <button onClick={() => setRest((r) => (r ? { ...r, remaining: r.remaining + 30, total: r.total + 30 } : r))} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[10px] text-mist hover:text-chalk">+30</button>
            <button onClick={() => setRest(null)} className="rounded-lg bg-acid px-3 py-1.5 text-[10.5px] font-semibold text-ink">Skip</button>
          </div>
        </div>
      )}

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

      {/* swap modal */}
      {showSwap && (
        <Sheet title="Swap exercise" subtitle="Same pattern, same stimulus — ranked for your kit." onClose={() => setShowSwap(false)}>
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
                No ranked matches with your current equipment. Add more kit in Settings, or pick any lift below.
              </p>
            )}
          </div>
          <p className="mt-4 label-mono">All compatible lifts</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {allExercises.filter((e) => equipment.includes(e.equipment) && e.id !== active.exerciseId && !alternatives.some((a) => a.id === e.id)).slice(0, 8).map((e) => (
              <button key={e.id} onClick={() => doSwap(e)} className="rounded-lg border border-white/[0.05] px-3 py-2 text-left text-[11px] text-mist hover:border-white/15 hover:text-chalk">
                {e.name}
              </button>
            ))}
          </div>
        </Sheet>
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
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="animate-fade-up relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:rounded-3xl md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold tracking-[-0.03em]">{title}</h3>
            <p className="mt-1 text-[11px] text-mist">{subtitle}</p>
          </div>
          <button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddExerciseSheet({ allExercises, onAdd, onClose }: { allExercises: ExerciseLite[]; onAdd: (e: ExerciseLite) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const filtered = allExercises.filter((e) => `${e.name} ${e.primaryMuscle} ${e.equipment}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
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
