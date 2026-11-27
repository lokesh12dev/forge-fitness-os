import { buildProgressReportSummary, type ProgressReportSummary } from "@/lib/fitness";
import type { UnifiedUserFitnessContext } from "./context";

export interface DailyBriefing {
  dateLabel: string;
  greeting: string;
  todaysWorkout: string;
  warmupFocus: string;
  recoveryNote: string;
  nutritionFocus: string;
  outstandingActions: string[];
}

export interface WeeklyReport {
  weekRangeLabel: string;
  workoutsCompleted: number;
  workoutsPlanned: number;
  consistencyPct: number;
  totalVolumeKg: number;
  strengthHighlights: string[];
  nutritionAdherenceNote: string;
  recoveryTrendNote: string;
  nextWeekFocus: string[];
  progressSummary?: ProgressReportSummary;
}

export interface CoachRecommendation {
  id: string;
  module: "schedule" | "workout" | "exercise" | "body" | "nutrition";
  tone: "acid" | "mint" | "amber" | "sky";
  title: string;
  detail: string;
  prompt: string;
}

export function buildDailyBriefing(ctx: UnifiedUserFitnessContext): DailyBriefing {
  const nextDay = ctx.activeProgram?.days[ctx.weekWorkoutsCount % Math.max(1, ctx.activeProgram.days.length)] ?? null;
  const proteinLeft = Math.max(0, ctx.nutrition.proteinTarget - ctx.nutrition.proteinConsumed);
  const caloriesLeft = Math.max(0, ctx.nutrition.caloriesTarget - ctx.nutrition.caloriesConsumed);
  const lowest = ctx.lowestRecoveredMuscles[0];

  const outstandingActions: string[] = [];
  if (ctx.activeWorkout) {
    outstandingActions.push(`Resume live workout: ${ctx.activeWorkout.name} (${ctx.activeWorkout.totalSets} sets logged)`);
  } else if (nextDay) {
    outstandingActions.push(`Scheduled session ready: ${nextDay.name} (${nextDay.focus})`);
  }
  if (proteinLeft > 15) {
    outstandingActions.push(`Close ${proteinLeft}g protein gap (${caloriesLeft} kcal remaining today)`);
  }
  if (ctx.nutrition.waterConsumedMl < ctx.nutrition.waterTargetMl * 0.6) {
    outstandingActions.push(`Hydrate: ${ctx.nutrition.waterConsumedMl}/${ctx.nutrition.waterTargetMl} ml logged`);
  }

  return {
    dateLabel: new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    greeting: `${ctx.firstName}, readiness is ${ctx.readiness}/100 with a ${ctx.streak}-day streak.`,
    todaysWorkout: ctx.activeWorkout
      ? `In progress: ${ctx.activeWorkout.name}`
      : nextDay
        ? `${nextDay.name} · ${nextDay.focus}`
        : "Open training slot — ask Workout AI to generate today's session.",
    warmupFocus: "7-min dynamic mobility: 90/90 hips, band pull-aparts, and 2 progressive ramp-up sets.",
    recoveryNote: lowest
      ? `${lowest.muscle} is at ${lowest.recovery}% recovery. ${ctx.readiness >= 75 ? "Cleared for RPE 8 working sets." : "Keep working RPE ≤ 7.5 today."}`
      : `Readiness ${ctx.readiness}/100 — keep sleep ≥ 7.5h tonight.`,
    nutritionFocus: `${ctx.nutrition.caloriesConsumed}/${ctx.nutrition.caloriesTarget} kcal · ${ctx.nutrition.proteinConsumed}/${ctx.nutrition.proteinTarget}g protein`,
    outstandingActions,
  };
}

export function buildWeeklyReport(ctx: UnifiedUserFitnessContext): WeeklyReport {
  const planned = ctx.activeProgram?.daysPerWeek ?? 4;
  const completed = ctx.weekWorkoutsCount;
  const consistencyPct = Math.min(100, Math.round((completed / Math.max(1, planned)) * 100));
  const latestWeek = ctx.weeklyVolumes[ctx.weeklyVolumes.length - 1];
  const totalVolumeKg = Math.round(latestWeek?.volume ?? 0);

  const strengthHighlights = ctx.prs.slice(0, 3).map(
    (pr) => `${pr.exerciseName}: ${pr.e1rm} kg est. 1RM (${pr.reps} reps)`,
  );

  const proteinPct = Math.round((ctx.nutrition.proteinConsumed / Math.max(1, ctx.nutrition.proteinTarget)) * 100);
  const nutritionAdherenceNote =
    ctx.nutrition.caloriesConsumed > 0
      ? `Today's intake is at ${proteinPct}% of your ${ctx.nutrition.proteinTarget}g protein target (${ctx.nutrition.caloriesConsumed}/${ctx.nutrition.caloriesTarget} kcal).`
      : "No meals logged yet today — log meals in Nutrition to track adherence.";

  const recoveryTrendNote = ctx.latestMetric?.sleepHours
    ? `Latest check-in: ${ctx.latestMetric.sleepHours}h sleep, ${ctx.latestMetric.hrv ?? "—"}ms HRV, readiness ${ctx.readiness}/100.`
    : `Readiness is ${ctx.readiness}/100. Log sleep and HRV in Stats & Body for sharper trend analysis.`;

  const nextWeekFocus: string[] = [];
  if (consistencyPct >= 100) {
    nextWeekFocus.push("Consistency hit 100% — progress primary compound loads by +2.5kg where RPE ≤ 8.");
  } else {
    nextWeekFocus.push(`Complete ${Math.max(1, planned - completed)} remaining session(s) or ask Schedule AI to rebalance.`);
  }
  if (ctx.readiness < 70) {
    nextWeekFocus.push("Schedule a light recovery/deload day and prioritize +45 min sleep.");
  } else {
    nextWeekFocus.push("Maintain 2.0g/kg protein and log working-set RPE for auto-regulation.");
  }

  return {
    weekRangeLabel: "Current 7-Day Window",
    workoutsCompleted: completed,
    workoutsPlanned: planned,
    consistencyPct,
    totalVolumeKg,
    strengthHighlights,
    nutritionAdherenceNote,
    recoveryTrendNote,
    nextWeekFocus,
    progressSummary: buildProgressReportSummary({
      period: "weekly",
      workoutsCompleted: completed,
      totalVolumeKg,
      weightEntries: ctx.weightTrend,
      nutritionAdherencePct: ctx.nutrition.caloriesConsumed > 0 ? proteinPct : null,
      latestBodyFatPct: ctx.latestMetric?.bodyFat ?? null,
    }),
  };
}

export function buildMonthlyReport(ctx: UnifiedUserFitnessContext): ProgressReportSummary {
  const totalVolumeKg = ctx.weeklyVolumes.slice(-4).reduce((sum, w) => sum + w.volume, 0);
  const workoutsCompleted = ctx.weeklyVolumes.slice(-4).reduce((sum, w) => sum + w.sessions, 0);
  return buildProgressReportSummary({
    period: "monthly",
    workoutsCompleted,
    totalVolumeKg,
    weightEntries: ctx.weightTrend,
    nutritionAdherencePct: null,
    latestBodyFatPct: ctx.latestMetric?.bodyFat ?? null,
  });
}

export function buildContextualRecommendations(ctx: UnifiedUserFitnessContext): CoachRecommendation[] {
  const recs: CoachRecommendation[] = [];

  if (ctx.activeProgram && ctx.weekWorkoutsCount < ctx.activeProgram.daysPerWeek) {
    const nextDay = ctx.activeProgram.days[ctx.weekWorkoutsCount % Math.max(1, ctx.activeProgram.days.length)];
    recs.push({
      id: "rec-next-session",
      module: "workout",
      tone: "acid",
      title: `Your scheduled workout is ready${nextDay ? `: ${nextDay.name}` : ""}`,
      detail: `${ctx.weekWorkoutsCount}/${ctx.activeProgram.daysPerWeek} sessions completed this week at ${ctx.readiness}/100 readiness.`,
      prompt: nextDay ? `Build today's ${nextDay.name} workout with warm-up` : "Build today's workout",
    });
  }

  if (ctx.prs.length > 0) {
    const top = ctx.prs[0];
    recs.push({
      id: "rec-pr-progression",
      module: "exercise",
      tone: "mint",
      title: `Recorded strength: ${top.exerciseName} (${top.e1rm} kg e1RM)`,
      detail: "Inspect technique cues, tempo, and next-step progression variations.",
      prompt: `Explain ${top.exerciseName} form cues and progression plan`,
    });
  }

  const proteinGap = ctx.nutrition.proteinTarget - ctx.nutrition.proteinConsumed;
  if (proteinGap > 20) {
    recs.push({
      id: "rec-protein-gap",
      module: "nutrition",
      tone: "sky",
      title: `${Math.round(proteinGap)}g protein remaining today`,
      detail: `${ctx.nutrition.proteinConsumed}/${ctx.nutrition.proteinTarget}g logged. Generate a quick meal plan or high-protein snack.`,
      prompt: "Create a meal plan to close my remaining protein gap",
    });
  }

  if (ctx.readiness < 72 || (ctx.lowestRecoveredMuscles[0]?.recovery ?? 100) < 65) {
    recs.push({
      id: "rec-recovery",
      module: "schedule",
      tone: "amber",
      title: "Recovery adjustment recommended",
      detail: `Readiness is ${ctx.readiness}/100. Consider a mobility/recovery day or reduced RPE.`,
      prompt: "Create a beginner-friendly recovery plan for today",
    });
  }

  return recs;
}
