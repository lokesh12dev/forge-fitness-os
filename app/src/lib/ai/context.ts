import { getWorkspace, nutritionTotals, weekVolumeSeries } from "@/lib/queries";
import { e1rm, recoveryMap } from "@/lib/engine";
import { listCoachMemories, type CoachMemoryEntry } from "./memory";
import { estimateTokens } from "./providers";

export function sanitizeUntrustedText(input: string, maxLen = 400): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, maxLen)
    .trim();
}

export function wrapUntrustedUserData(label: string, value: unknown): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `<untrusted_user_data label="${safeLabel}">${sanitizeUntrustedText(raw, 1200)}</untrusted_user_data>`;
}

export interface UnifiedUserFitnessContext {
  userId: string;
  firstName: string;
  fullName: string;
  goal: string;
  experience: string;
  sex: "male" | "female";
  weightKg: number;
  heightCm: number;
  equipment: string[];
  streak: number;
  readiness: number;
  latestMetric: {
    date: string;
    weightKg: number | null;
    bodyFat: number | null;
    sleepHours: number | null;
    hrv: number | null;
    restingHr: number | null;
    soreness: number;
  } | null;
  weightTrend: Array<{ date: string; weightKg: number }>;
  activeProgram: {
    id: string;
    name: string;
    daysPerWeek: number;
    days: Array<{ id: string; name: string; focus: string; exerciseNames: string[] }>;
  } | null;
  activeWorkout: {
    id: string;
    name: string;
    focus: string;
    totalSets: number;
    totalVolume: number;
  } | null;
  lastWorkout: {
    id: string;
    name: string;
    focus: string;
    daysAgo: number;
    totalVolume: number;
    totalSets: number;
  } | null;
  completedSessionsCount: number;
  weekWorkoutsCount: number;
  weeklyVolumes: Array<{ label: string; volume: number; sessions: number }>;
  prs: Array<{ exerciseId: string; exerciseName: string; e1rm: number; reps: number }>;
  lowestRecoveredMuscles: Array<{ muscle: string; recovery: number }>;
  nutrition: {
    caloriesTarget: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
    waterTargetMl: number;
    caloriesConsumed: number;
    proteinConsumed: number;
    carbsConsumed: number;
    fatConsumed: number;
    waterConsumedMl: number;
    todayLogNames: string[];
  };
  memories?: CoachMemoryEntry[];
}

export function buildPromptContextString(
  ctx: UnifiedUserFitnessContext,
  tokenBudget = 2200,
): string {
  const sections: string[] = [
    `ATHLETE_PROFILE: goal=${ctx.goal}, experience=${ctx.experience}, sex=${ctx.sex}, weightKg=${ctx.weightKg}, heightCm=${ctx.heightCm}, readiness=${ctx.readiness}/100, streak=${ctx.streak}d, equipment=[${ctx.equipment.join(",")}]`,
    `NAME: ${wrapUntrustedUserData("athlete_name", ctx.firstName)}`,
    ctx.latestMetric
      ? `LATEST_METRIC(${ctx.latestMetric.date}): weight=${ctx.latestMetric.weightKg ?? "Not recorded"}, bodyFat=${ctx.latestMetric.bodyFat ?? "Not recorded"}, sleep=${ctx.latestMetric.sleepHours ?? "Not recorded"}h, hrv=${ctx.latestMetric.hrv ?? "Not recorded"}, rhr=${ctx.latestMetric.restingHr ?? "Not recorded"}, soreness=${ctx.latestMetric.soreness}/10`
      : "LATEST_METRIC: Not recorded",
    ctx.activeProgram
      ? `ACTIVE_PROGRAM: ${wrapUntrustedUserData("program_name", ctx.activeProgram.name)} (${ctx.activeProgram.daysPerWeek}d/wk)`
      : "ACTIVE_PROGRAM: None",
    ctx.lastWorkout
      ? `LAST_WORKOUT: ${wrapUntrustedUserData("workout_name", ctx.lastWorkout.name)} (${ctx.lastWorkout.daysAgo}d ago, ${ctx.lastWorkout.totalSets} sets, ${ctx.lastWorkout.totalVolume}kg vol)`
      : "LAST_WORKOUT: None",
    `NUTRITION_TODAY: ${ctx.nutrition.caloriesConsumed}/${ctx.nutrition.caloriesTarget} kcal, P ${ctx.nutrition.proteinConsumed}/${ctx.nutrition.proteinTarget}g, C ${ctx.nutrition.carbsConsumed}/${ctx.nutrition.carbsTarget}g, F ${ctx.nutrition.fatConsumed}/${ctx.nutrition.fatTarget}g, water ${ctx.nutrition.waterConsumedMl}/${ctx.nutrition.waterTargetMl}ml`,
  ];

  if (ctx.nutrition.todayLogNames.length > 0) {
    sections.push(
      `TODAY_FOODS: ${wrapUntrustedUserData("today_foods", ctx.nutrition.todayLogNames.slice(0, 12).join(", "))}`,
    );
  }

  if (ctx.memories && ctx.memories.length > 0) {
    const memLines = ctx.memories
      .slice(0, 10)
      .map((m) => `${m.kind}:${m.key}=${JSON.stringify(m.value)}`)
      .join(" | ");
    sections.push(`COACH_MEMORY: ${wrapUntrustedUserData("coach_memory", memLines)}`);
  }

  const out: string[] = [];
  let used = 0;
  for (const s of sections) {
    const t = estimateTokens(s);
    if (used + t > tokenBudget) break;
    out.push(s);
    used += t;
  }
  return out.join("\n");
}

export async function buildUserFitnessContext(userId: string): Promise<UnifiedUserFitnessContext> {
  const [ws, memories] = await Promise.all([
    getWorkspace(userId),
    listCoachMemories(userId, undefined, 15).catch(() => [] as CoachMemoryEntry[]),
  ]);
  const totals = nutritionTotals(ws);

  const recovery = recoveryMap(
    ws.sets.map((s) => ({
      primaryMuscle: ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core",
      completedAt: s.completedAt,
      weightKg: s.weightKg,
      reps: s.reps,
    })),
  );

  const lowestRecoveredMuscles = Object.entries(recovery)
    .map(([muscle, v]) => ({ muscle, recovery: v.recovery }))
    .sort((a, b) => a.recovery - b.recovery)
    .slice(0, 5);

  const routineDays = ws.enrolledRoutine
    ? ws.routineDays
        .filter((d) => d.routineId === ws.enrolledRoutine!.id)
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((d) => ({
          id: d.id,
          name: d.name,
          focus: d.focus,
          exerciseNames: ws.routineExercises
            .filter((re) => re.routineDayId === d.id)
            .sort((a, b) => a.position - b.position)
            .map((re) => ws.exerciseMap.get(re.exerciseId)?.name ?? re.exerciseId),
        }))
    : [];

  const last = ws.completedWorkouts[0] ?? null;
  const prsMap = new Map<string, { exerciseId: string; exerciseName: string; e1rm: number; reps: number }>();
  for (const pr of ws.prs) {
    if (pr.type !== "e1rm") continue;
    const prev = prsMap.get(pr.exerciseId);
    const exName = ws.exerciseMap.get(pr.exerciseId)?.name ?? "Lift";
    if (!prev || pr.value > prev.e1rm) {
      prsMap.set(pr.exerciseId, {
        exerciseId: pr.exerciseId,
        exerciseName: exName,
        e1rm: Math.round(pr.value * 10) / 10,
        reps: pr.reps,
      });
    }
  }

  for (const s of ws.sets) {
    const score = Math.round(e1rm(s.weightKg, s.reps) * 10) / 10;
    const prev = prsMap.get(s.exerciseId);
    if (!prev && score > 0) {
      prsMap.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exerciseName: ws.exerciseMap.get(s.exerciseId)?.name ?? "Lift",
        e1rm: score,
        reps: s.reps,
      });
    }
  }

  const weightTrend = ws.metrics
    .filter((m) => m.weightKg != null)
    .slice(-14)
    .map((m) => ({ date: m.date, weightKg: m.weightKg! }));

  const waterConsumedMl = ws.water.reduce((sum, w) => sum + w.ml, 0);

  return {
    userId: ws.user.id,
    firstName: ws.user.name.split(" ")[0] || "Athlete",
    fullName: ws.user.name,
    goal: ws.user.goal || "hypertrophy",
    experience: ws.user.experience || "intermediate",
    sex: ws.user.sex === "female" ? "female" : "male",
    weightKg: ws.user.weightKg || 75,
    heightCm: ws.user.heightCm || 175,
    equipment: Array.isArray(ws.user.equipment) ? ws.user.equipment : ["barbell", "dumbbell", "bodyweight"],
    streak: ws.user.streak,
    readiness: ws.readiness,
    latestMetric: ws.latestMetric
      ? {
          date: ws.latestMetric.date,
          weightKg: ws.latestMetric.weightKg,
          bodyFat: ws.latestMetric.bodyFat,
          sleepHours: ws.latestMetric.sleepHours,
          hrv: ws.latestMetric.hrv,
          restingHr: ws.latestMetric.restingHr,
          soreness: ws.latestMetric.soreness,
        }
      : null,
    weightTrend,
    activeProgram: ws.enrolledRoutine
      ? {
          id: ws.enrolledRoutine.id,
          name: ws.enrolledRoutine.name,
          daysPerWeek: ws.enrolledRoutine.daysPerWeek,
          days: routineDays,
        }
      : null,
    activeWorkout: ws.activeWorkout
      ? {
          id: ws.activeWorkout.id,
          name: ws.activeWorkout.name,
          focus: ws.activeWorkout.focus,
          totalSets: ws.activeWorkout.totalSets,
          totalVolume: ws.activeWorkout.totalVolume,
        }
      : null,
    lastWorkout: last
      ? {
          id: last.id,
          name: last.name,
          focus: last.focus,
          daysAgo: Math.max(0, Math.floor((Date.now() - new Date(last.completedAt ?? last.startedAt).getTime()) / 86_400_000)),
          totalVolume: Math.round(last.totalVolume),
          totalSets: last.totalSets,
        }
      : null,
    completedSessionsCount: ws.completedWorkouts.length,
    weekWorkoutsCount: ws.weekWorkouts.length,
    weeklyVolumes: weekVolumeSeries(ws, 6).map((w) => ({
      label: w.label,
      volume: w.volume,
      sessions: w.sessions,
    })),
    prs: [...prsMap.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 8),
    lowestRecoveredMuscles,
    nutrition: {
      caloriesTarget: ws.targets.calories,
      proteinTarget: ws.targets.protein,
      carbsTarget: ws.targets.carbs,
      fatTarget: ws.targets.fat,
      waterTargetMl: ws.targets.waterMl,
      caloriesConsumed: Math.round(totals.calories),
      proteinConsumed: Math.round(totals.protein),
      carbsConsumed: Math.round(totals.carbs),
      fatConsumed: Math.round(totals.fat),
      waterConsumedMl: Math.round(waterConsumedMl),
      todayLogNames: ws.nutrition.map((n) => n.name),
    },
    memories,
  };
}
