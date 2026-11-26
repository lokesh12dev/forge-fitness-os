import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getWorkspace, workoutDetail } from "@/lib/queries";
import { roundTo } from "@/lib/engine";
import { LiveWorkout, type SessionExercise } from "@/components/live-workout";

export default async function LiveWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const detail = workoutDetail(ws, id);
  if (!detail) notFound();
  if (detail.workout.status === "completed") redirect(`/app/train/${id}/summary`);

  const readinessMult = ws.readiness >= 85 ? 1.025 : ws.readiness >= 70 ? 1 : ws.readiness >= 55 ? 0.95 : 0.9;
  const defaultWeight = (equipment: string) => {
    switch (equipment) {
      case "barbell": case "ez-bar": return 40;
      case "dumbbell": return 14;
      case "machine": case "cable": return 30;
      case "kettlebell": return 16;
      case "bands": return 0;
      default: return 0;
    }
  };

  const items: SessionExercise[] = detail.items.map((item) => {
    const base = item.history.weight || defaultWeight(item.exercise.equipment);
    const suggestion = item.exercise.equipment === "bodyweight" ? 0 : roundTo(base * readinessMult);
    return {
      id: item.id,
      exerciseId: item.exerciseId,
      position: item.position,
      targetSets: item.targetSets,
      repsMin: item.repsMin,
      repsMax: item.repsMax,
      restSec: item.restSec,
      rpeTarget: item.rpeTarget,
      supersetGroup: item.supersetGroup,
      swappedFrom: item.swappedFrom,
      notes: item.notes,
      exercise: item.exercise,
      history: {
        weight: item.history.weight,
        reps: item.history.reps,
        date: item.history.date ? new Date(item.history.date).toISOString() : null,
      },
      sets: item.sets.map((s) => ({
        id: s.id,
        setIndex: s.setIndex,
        weightKg: s.weightKg,
        reps: s.reps,
        rpe: s.rpe,
        isPR: s.isPR,
        completedAt: new Date(s.completedAt).toISOString(),
      })),
      suggestion,
    };
  });

  return (
    <LiveWorkout
      workout={{
        id: detail.workout.id,
        name: detail.workout.name,
        focus: detail.workout.focus,
        startedAt: new Date(detail.workout.startedAt).toISOString(),
        readiness: detail.workout.readiness,
        compressed: detail.workout.compressed,
        totalVolume: detail.workout.totalVolume,
        totalSets: detail.workout.totalSets,
      }}
      items={items}
      allExercises={ws.exercises}
      equipment={(user.equipment ?? ["barbell", "dumbbell", "machine", "cable", "bodyweight"]).filter(Boolean)}
      user={{ name: user.name, initials: user.initials }}
      prs={ws.prs.map((p) => ({ exerciseId: p.exerciseId, value: p.value }))}
    />
  );
}
