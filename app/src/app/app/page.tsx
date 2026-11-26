import { requireUser } from "@/lib/auth";
import { getWorkspace, nutritionTotals } from "@/lib/queries";
import { dateKey } from "@/lib/date";
import { muscleLabel, readinessVerdict, recoveryMap } from "@/lib/engine";
import { HomeClient } from "@/components/home-client";

export default async function DashboardPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const totals = nutritionTotals(ws);
  const verdict = readinessVerdict(ws.readiness);

  const today = new Date();
  const todayIso = dateKey(today);
  const todayHeaderLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const completedDateIsos = Array.from(
    new Set(ws.completedWorkouts.map((w) => dateKey(new Date(w.startedAt)))),
  );

  const currentMonthPrefix = todayIso.slice(0, 7);
  const monthlyWorkoutsDone = ws.completedWorkouts.filter((w) =>
    dateKey(new Date(w.startedAt)).startsWith(currentMonthPrefix),
  ).length;
  const monthlyPrsDone = ws.prs.filter((p) =>
    dateKey(new Date(p.achievedAt)).startsWith(currentMonthPrefix),
  ).length;
  const monthlyUniqueExercisesDone = new Set(
    ws.sets
      .filter((s) => dateKey(new Date(s.completedAt)).startsWith(currentMonthPrefix))
      .map((s) => s.exerciseId),
  ).size;

  const weightMetrics = ws.metrics
    .filter((m) => m.weightKg != null)
    .slice(-14);
  const latestWeight = weightMetrics[weightMetrics.length - 1]?.weightKg ?? user.weightKg;
  const prevWeight = weightMetrics[weightMetrics.length - 2]?.weightKg ?? null;
  const weightDelta = prevWeight !== null ? Math.round((latestWeight - prevWeight) * 10) / 10 : null;

  const recovery = recoveryMap(
    ws.sets.map((s) => ({
      primaryMuscle: ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core",
      completedAt: s.completedAt,
      weightKg: s.weightKg,
      reps: s.reps,
    })),
  );
  const stalest = Object.entries(recovery)
    .filter(([, v]) => v.sets > 0)
    .sort((a, b) => (a[1].lastTrained ?? 0) - (b[1].lastTrained ?? 0))[0];

  const recoveryHintTitle =
    stalest && stalest[1].recovery >= 88
      ? `Your ${muscleLabel(stalest[0]).toLowerCase()} is fully recovered and ready.`
      : `Readiness ${ws.readiness} · ${verdict.label}`;

  return (
    <HomeClient
      userName={user.name}
      userInitials={user.initials}
      todayIso={todayIso}
      todayHeaderLabel={todayHeaderLabel}
      monthLabel={monthLabel}
      activeWorkout={
        ws.activeWorkout
          ? {
              id: ws.activeWorkout.id,
              name: ws.activeWorkout.name,
              focus: ws.activeWorkout.focus,
              startedAt: new Date(ws.activeWorkout.startedAt).toISOString(),
              totalVolume: ws.activeWorkout.totalVolume,
              totalSets: ws.activeWorkout.totalSets,
            }
          : null
      }
      completedDateIsos={completedDateIsos}
      monthlyWorkoutsDone={monthlyWorkoutsDone}
      monthlyPrsDone={monthlyPrsDone}
      monthlyUniqueExercisesDone={monthlyUniqueExercisesDone}
      weightKg={latestWeight}
      weightDelta={weightDelta}
      weightPoints={weightMetrics.map((m) => ({
        date: m.date,
        value: Number(m.weightKg),
      }))}
      streakDays={user.streak}
      totalWorkouts={ws.completedWorkouts.length}
      readiness={ws.readiness}
      readinessAdvice={verdict.advice}
      sleepHours={ws.latestMetric?.sleepHours ?? 7.5}
      hrv={ws.latestMetric?.hrv ?? 64}
      restingHr={ws.latestMetric?.restingHr ?? 56}
      soreness={ws.latestMetric?.soreness ?? 2}
      recoveryHintTitle={recoveryHintTitle}
      recoveryHintSub={verdict.advice}
      caloriesConsumed={totals.calories}
      caloriesTarget={ws.targets.calories}
      proteinConsumed={totals.protein}
      proteinTarget={ws.targets.protein}
    />
  );
}
