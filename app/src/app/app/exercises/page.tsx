import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { suggestedLoad } from "@/lib/engine";
import { ExerciseLibrary } from "@/components/exercise-library";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string; m?: string }>;
}) {
  const { q, mode, m } = await searchParams;
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

  const stats: Record<
    string,
    {
      pr: number | null;
      lastWeight: number | null;
      lastReps: number | null;
      target: number | null;
      totalSets: number;
      history: { label: string; value: number }[];
    }
  > = {};

  const trainedIds = new Set<string>();
  for (const s of ws.sets) trainedIds.add(s.exerciseId);

  const exerciseIds = new Set<string>([...ws.exercises.map((e) => e.id), ...trainedIds]);
  for (const exId of exerciseIds) {
    const pr = ws.prs.find((p) => p.exerciseId === exId && p.type === "e1rm")?.value ?? null;
    const exerciseSets = ws.sets
      .filter((s) => s.exerciseId === exId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    const last = exerciseSets[0] ?? null;
    const map = byExerciseWorkout.get(exId);
    const history = map
      ? [...map.values()]
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(-8)
          .map((h) => ({
            label: h.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
            value: Math.round(h.best * 10) / 10,
          }))
      : [];
    stats[exId] = {
      pr: pr ? Math.round(pr * 10) / 10 : null,
      lastWeight: last?.weightKg ?? null,
      lastReps: last?.reps ?? null,
      target: suggestedLoad(last ? { weightKg: last.weightKg, reps: last.reps } : null, 8),
      totalSets: exerciseSets.length,
      history,
    };
  }

  return (
    <ExerciseLibrary
      stats={stats}
      equipment={(user.equipment ?? []).filter(Boolean)}
      activeWorkoutId={ws.activeWorkout?.id ?? null}
      initialQuery={q ?? ""}
      initialMode={mode === "muscles" ? "muscles" : "library"}
      initialMuscle={m ?? null}
      trainedIds={[...trainedIds]}
    />
  );
}
