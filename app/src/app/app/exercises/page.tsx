import Link from "next/link";
import { BookOpen, Dumbbell, Play, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { suggestedLoad } from "@/lib/engine";
import { Badge, ButtonLink } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { ExerciseLibrary } from "@/components/exercise-library";

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const workoutDate = new Map(ws.workouts.map((w) => [w.id, new Date(w.startedAt)]));
  const byExerciseWorkout = new Map<string, Map<string, { date: Date; best: number; reps: number }>>();
  for (const s of ws.sets) {
    let map = byExerciseWorkout.get(s.exerciseId);
    if (!map) {
      map = new Map();
      byExerciseWorkout.set(s.exerciseId, map);
    }
    const date = workoutDate.get(s.workoutId) ?? new Date(s.completedAt);
    const key = s.workoutId;
    const cur = map.get(key);
    const score = s.weightKg * (1 + s.reps / 30);
    if (!cur || score > cur.best * (1 + cur.reps / 30)) map.set(key, { date, best: s.weightKg, reps: s.reps });
  }

  const stats: Record<string, {
    pr: number | null;
    lastWeight: number | null;
    lastReps: number | null;
    target: number | null;
    totalSets: number;
    history: { label: string; value: number }[];
  }> = {};

  for (const ex of ws.exercises) {
    const pr = ws.prs.find((p) => p.exerciseId === ex.id && p.type === "e1rm")?.value ?? null;
    const exerciseSets = ws.sets
      .filter((s) => s.exerciseId === ex.id)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    const last = exerciseSets[0] ?? null;
    const map = byExerciseWorkout.get(ex.id);
    const history = map
      ? [...map.values()]
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(-8)
          .map((h) => ({ label: h.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), value: Math.round(h.best * 10) / 10 }))
      : [];
    stats[ex.id] = {
      pr: pr ? Math.round(pr * 10) / 10 : null,
      lastWeight: last?.weightKg ?? null,
      lastReps: last?.reps ?? null,
      target: suggestedLoad(last ? { weightKg: last.weightKg, reps: last.reps } : null, 8),
      totalSets: exerciseSets.length,
      history,
    };
  }

  const totalSets = ws.sets.length;
  const trained = Object.values(stats).filter((s) => s.totalSets > 0).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid"><BookOpen className="size-2.5" /> {ws.exercises.length} movements</Badge>
            <span className="label-mono text-dim">{trained} trained · {totalSets} sets logged</span>
          </>
        }
        title="Exercise library"
        subtitle="Every lift, cue, and strength standard — filtered to the equipment you actually have. Tap any movement for technique and your history."
        actions={
          <>
            <ButtonLink href="/app/form-check" variant="secondary" size="md"><Sparkles className="size-3.5 text-acid" /> Form check</ButtonLink>
            <ButtonLink href="/app/train" size="md"><Play className="size-3.5" /> {ws.activeWorkout ? "Resume session" : "Start training"}</ButtonLink>
          </>
        }
      />
      {!ws.activeWorkout && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <Dumbbell className="mt-0.5 size-3.5 shrink-0 text-dim" />
          <p className="text-[11px] leading-relaxed text-mist">
            Tip: start a session and this library becomes a live picker — add any lift mid-workout without breaking your rest timer.
          </p>
        </div>
      )}
      <ExerciseLibrary
        exercises={ws.exercises}
        stats={stats}
        equipment={(user.equipment ?? []).filter(Boolean)}
        activeWorkoutId={ws.activeWorkout?.id ?? null}
        initialQuery={q ?? ""}
      />
    </>
  );
}
