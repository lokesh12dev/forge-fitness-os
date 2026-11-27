/**
 * Pure Training Science Domain Module
 * Wraps and extends src/lib/engine.ts & src/lib/opengym-catalog.ts.
 * Zero DB calls, zero LLM calls, deterministic outputs.
 */

import {
  alternativesFor,
  calculate1RM,
  checkDeloadRecommendation,
  estimateSessionMinutes,
  roundTo,
} from "../engine";
import { FULL_EXERCISE_CATALOG, type CatalogExercise } from "../opengym-catalog";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type TrainingGoal =
  | "strength"
  | "hypertrophy"
  | "fat_loss"
  | "recomp"
  | "endurance"
  | "athletic"
  | "mobility"
  | "general";

export interface SplitRecommendation {
  splitId: "full_body" | "upper_lower" | "ppl" | "ppl_ul" | "body_part_hybrid";
  name: string;
  daysPerWeek: number;
  dayTemplates: Array<{ dayIndex: number; label: string; targetMuscles: string[] }>;
  weeklyFrequencyPerMuscle: number;
  rationale: string;
}

export const VOLUME_BANDS_BY_EXPERIENCE: Record<
  ExperienceLevel,
  { mev: number; optimalMin: number; optimalMax: number; mrv: number }
> = {
  beginner: { mev: 4, optimalMin: 6, optimalMax: 12, mrv: 14 },
  intermediate: { mev: 8, optimalMin: 10, optimalMax: 18, mrv: 20 },
  advanced: { mev: 10, optimalMin: 12, optimalMax: 22, mrv: 24 },
};

export function recommendSplit(
  daysPerWeek: number,
  experience: ExperienceLevel,
  goal: TrainingGoal,
): SplitRecommendation {
  const days = Math.max(2, Math.min(6, Math.round(daysPerWeek)));

  if (days <= 3) {
    return {
      splitId: "full_body",
      name: `${days}-Day Full Body`,
      daysPerWeek: days,
      weeklyFrequencyPerMuscle: days,
      dayTemplates: Array.from({ length: days }, (_, i) => ({
        dayIndex: i * 2,
        label: `Full Body ${String.fromCharCode(65 + i)}`,
        targetMuscles: ["quads", "chest", "back", "hamstrings", "shoulders", "core"],
      })),
      rationale: `${days} sessions/week maximizes muscle protein synthesis frequency (2–3x/muscle/week) with 48h recovery between sessions.`,
    };
  }

  if (days === 4) {
    return {
      splitId: "upper_lower",
      name: "4-Day Upper / Lower",
      daysPerWeek: 4,
      weeklyFrequencyPerMuscle: 2,
      dayTemplates: [
        { dayIndex: 0, label: "Upper A (Strength Bias)", targetMuscles: ["chest", "back", "lats", "shoulders", "biceps", "triceps"] },
        { dayIndex: 1, label: "Lower A (Quad Bias)", targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"] },
        { dayIndex: 3, label: "Upper B (Hypertrophy Bias)", targetMuscles: ["chest", "back", "lats", "shoulders", "biceps", "triceps"] },
        { dayIndex: 4, label: "Lower B (Posterior Bias)", targetMuscles: ["hamstrings", "glutes", "quads", "calves", "core"] },
      ],
      rationale: "4-day Upper/Lower hits every muscle 2x/week with built-in 72h recovery between identical movement patterns.",
    };
  }

  if (days === 5) {
    const labelSuffix = goal === "strength" ? "Strength + Volume" : "Hypertrophy";
    return {
      splitId: "ppl_ul",
      name: `5-Day Push / Pull / Legs + Upper / Lower (${labelSuffix})`,
      daysPerWeek: 5,
      weeklyFrequencyPerMuscle: 2,
      dayTemplates: [
        { dayIndex: 0, label: "Upper Power", targetMuscles: ["chest", "back", "shoulders", "biceps", "triceps"] },
        { dayIndex: 1, label: "Lower Power", targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"] },
        { dayIndex: 3, label: "Push Hypertrophy", targetMuscles: ["chest", "shoulders", "triceps"] },
        { dayIndex: 4, label: "Pull Hypertrophy", targetMuscles: ["back", "lats", "biceps", "forearms"] },
        { dayIndex: 5, label: "Legs Hypertrophy", targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"] },
      ],
      rationale: `5-day ${experience} hybrid hits every muscle 2x/week while distributing axial fatigue cleanly.`,
    };
  }

  return {
    splitId: "ppl",
    name: "6-Day Push / Pull / Legs (2x)",
    daysPerWeek: 6,
    weeklyFrequencyPerMuscle: 2,
    dayTemplates: [
      { dayIndex: 0, label: "Push A", targetMuscles: ["chest", "shoulders", "triceps"] },
      { dayIndex: 1, label: "Pull A", targetMuscles: ["back", "lats", "biceps"] },
      { dayIndex: 2, label: "Legs A", targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"] },
      { dayIndex: 3, label: "Push B", targetMuscles: ["chest", "shoulders", "triceps"] },
      { dayIndex: 4, label: "Pull B", targetMuscles: ["back", "lats", "biceps"] },
      { dayIndex: 5, label: "Legs B", targetMuscles: ["hamstrings", "glutes", "quads", "calves", "core"] },
    ],
    rationale: "6-day PPL provides 72h recovery per muscle group while supporting high weekly volume.",
  };
}

export function validateMuscleRecoverySpacing(
  daySchedule: Array<{ dayIndex: number; label?: string; primaryMuscles: string[] }>,
): {
  valid: boolean;
  violations: Array<{ muscle: string; dayA: number; dayB: number; hoursBetween: number; message: string }>;
} {
  const violations: Array<{ muscle: string; dayA: number; dayB: number; hoursBetween: number; message: string }> = [];
  const sorted = [...daySchedule].sort((a, b) => a.dayIndex - b.dayIndex);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const rawGapDays =
      i + 1 < sorted.length
        ? next.dayIndex - cur.dayIndex
        : 7 - cur.dayIndex + next.dayIndex;
    if (rawGapDays <= 1 && sorted.length > 1) {
      const hoursBetween = rawGapDays * 24;
      const curSet = new Set(cur.primaryMuscles.map((m) => m.toLowerCase()));
      for (const m of next.primaryMuscles) {
        const low = m.toLowerCase();
        if (low === "core" || low === "calves") continue;
        if (curSet.has(low)) {
          violations.push({
            muscle: low,
            dayA: cur.dayIndex,
            dayB: next.dayIndex,
            hoursBetween,
            message: `${low} scheduled on consecutive days (${cur.label ?? `Day ${cur.dayIndex}`} -> ${next.label ?? `Day ${next.dayIndex}`}); allow >=48h recovery.`,
          });
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

export interface MuscleVolumeReport {
  muscle: string;
  directSets: number;
  indirectSets: number;
  effectiveSets: number;
  status: "below_mev" | "optimal" | "near_mrv" | "over_mrv";
}

export function computeWeeklyMuscleVolume(
  sessions: Array<{
    exercises: Array<{ primaryMuscle: string; secondaryMuscles?: string[]; sets: number }>;
  }>,
  experience: ExperienceLevel,
): { muscles: MuscleVolumeReport[]; totalHardSets: number; warnings: string[] } {
  const direct: Record<string, number> = {};
  const indirect: Record<string, number> = {};
  let totalHardSets = 0;

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const sets = Math.max(0, ex.sets);
      totalHardSets += sets;
      const p = ex.primaryMuscle.toLowerCase();
      direct[p] = (direct[p] ?? 0) + sets;
      for (const sec of ex.secondaryMuscles ?? []) {
        const s = sec.toLowerCase();
        if (s !== p) {
          indirect[s] = (indirect[s] ?? 0) + sets * 0.5;
        }
      }
    }
  }

  const band = VOLUME_BANDS_BY_EXPERIENCE[experience];
  const allMuscles = Array.from(new Set([...Object.keys(direct), ...Object.keys(indirect)])).sort();
  const warnings: string[] = [];

  const muscles: MuscleVolumeReport[] = allMuscles.map((muscle) => {
    const d = direct[muscle] ?? 0;
    const ind = Math.round((indirect[muscle] ?? 0) * 10) / 10;
    const eff = Math.round((d + ind) * 10) / 10;
    let status: MuscleVolumeReport["status"] = "optimal";
    if (eff > band.mrv) {
      status = "over_mrv";
      warnings.push(`${muscle} weekly volume (${eff} effective sets) exceeds ${experience} MRV (${band.mrv} sets).`);
    } else if (eff > band.optimalMax) {
      status = "near_mrv";
    } else if (eff > 0 && eff < band.mev) {
      status = "below_mev";
      warnings.push(`${muscle} weekly volume (${eff} effective sets) is below ${experience} MEV (${band.mev} sets).`);
    }
    return { muscle, directSets: d, indirectSets: ind, effectiveSets: eff, status };
  });

  return { muscles, totalHardSets, warnings };
}

export function estimateWorkoutDurationMin(
  exercises: Array<{ sets: number; restSec: number; supersetGroup?: string | null }>,
  warmupMin = 8,
): number {
  const base = estimateSessionMinutes(
    exercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec, supersetGroup: e.supersetGroup })),
  );
  return Math.max(10, base - 8 + warmupMin);
}

export function rpeToRir(rpe: number): number {
  return Math.max(0, Math.round((10 - rpe) * 10) / 10);
}

export function rirToRpe(rir: number): number {
  return Math.min(10, Math.max(5, Math.round((10 - rir) * 10) / 10));
}

export function targetRpeBand(
  goal: TrainingGoal,
  weekInBlock: number,
  isDeload = false,
): { min: number; max: number; rirMin: number; rirMax: number } {
  if (isDeload) return { min: 5, max: 6, rirMin: 4, rirMax: 5 };
  if (goal === "strength") {
    const min = Math.min(9, 7.5 + (Math.max(1, weekInBlock) - 1) * 0.5);
    const max = Math.min(9.5, min + 0.5);
    return { min, max, rirMin: rpeToRir(max), rirMax: rpeToRir(min) };
  }
  const min = Math.min(8.5, 7 + (Math.max(1, weekInBlock) - 1) * 0.5);
  const max = Math.min(9.5, min + 1);
  return { min, max, rirMin: rpeToRir(max), rirMax: rpeToRir(min) };
}

export interface DoubleProgressionResult {
  action: "increase_load" | "add_reps" | "hold" | "reduce_load";
  nextWeightKg: number;
  reason: string;
}

export function evaluateDoubleProgression(input: {
  lastWeightKg: number;
  lastReps: number[];
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe: number;
  actualRpeAvg?: number;
  equipment: string;
}): DoubleProgressionResult {
  if (input.lastWeightKg <= 0 || input.lastReps.length === 0) {
    return {
      action: "hold",
      nextWeightKg: Math.max(0, input.lastWeightKg),
      reason: "No prior working sets recorded; establish baseline at target RPE.",
    };
  }

  const step = input.equipment === "dumbbell" ? 2 : input.equipment === "machine" ? 5 : 2.5;
  const allHitTop = input.lastReps.every((r) => r >= input.targetRepsMax);
  const avgReps = input.lastReps.reduce((a, b) => a + b, 0) / input.lastReps.length;
  const rpeTooHigh = input.actualRpeAvg !== undefined && input.actualRpeAvg > input.targetRpe + 1;

  if (rpeTooHigh || avgReps < input.targetRepsMin) {
    const nextWeightKg = roundTo(input.lastWeightKg * 0.95, step);
    return {
      action: "reduce_load",
      nextWeightKg,
      reason: `Reps/RPE exceeded recovery ceiling (avg ${avgReps.toFixed(1)} reps); trim load ~5% to ${nextWeightKg} kg.`,
    };
  }

  if (allHitTop && (input.actualRpeAvg === undefined || input.actualRpeAvg <= input.targetRpe + 0.5)) {
    const nextWeightKg = roundTo(input.lastWeightKg + step, step);
    return {
      action: "increase_load",
      nextWeightKg,
      reason: `All working sets hit >=${input.targetRepsMax} reps within RPE target. Increase load +${step} kg to ${nextWeightKg} kg.`,
    };
  }

  return {
    action: "add_reps",
    nextWeightKg: input.lastWeightKg,
    reason: `Keep ${input.lastWeightKg} kg and aim to add 1–2 reps per set toward ${input.targetRepsMax} reps.`,
  };
}

export function safeE1RM(
  weightKg: number,
  reps: number,
  formula: "epley" | "brzycki" = "epley",
): { e1rmKg: number | null; reliable: boolean; note?: string } {
  if (weightKg <= 0 || reps <= 0) {
    return { e1rmKg: null, reliable: false, note: "Weight and reps must be positive." };
  }
  if (reps > 10) {
    return {
      e1rmKg: null,
      reliable: false,
      note: "e1RM is omitted above 10 reps because high-rep fatigue distorts 1RM estimates.",
    };
  }
  return { e1rmKg: calculate1RM(weightKg, reps, formula), reliable: true };
}

export { checkDeloadRecommendation };

export function buildDeloadWeekPlan<T extends { sets: number; rpeTarget?: number }>(
  exercises: T[],
): Array<T & { deloadSets: number; deloadRpe: number; intensityScalePct: number }> {
  return exercises.map((ex) => ({
    ...ex,
    deloadSets: Math.max(1, Math.round(ex.sets * 0.5)),
    deloadRpe: 6,
    intensityScalePct: 75,
  }));
}

export interface MissedSessionPlan {
  strategy: "shift" | "merge" | "reentry_light" | "ramp_back";
  loadMultiplier: number;
  volumeMultiplier: number;
  guidance: string;
}

export function planMissedSessionRecovery(input: {
  daysMissed: number;
  missedDayName: string;
  nextScheduledDayName: string;
}): MissedSessionPlan {
  const d = Math.max(0, Math.round(input.daysMissed));
  if (d <= 2) {
    return {
      strategy: "shift",
      loadMultiplier: 1.0,
      volumeMultiplier: 1.0,
      guidance: `Missed ${input.missedDayName} (${d}d gap): resume directly with ${input.missedDayName} or shift the week by 1–2 days without doubling up.`,
    };
  }
  if (d <= 6) {
    return {
      strategy: "merge",
      loadMultiplier: 1.0,
      volumeMultiplier: 0.85,
      guidance: `Missed ${input.missedDayName} (${d}d gap): merge the 2–3 priority compound lifts into ${input.nextScheduledDayName} and trim redundant isolation sets.`,
    };
  }
  if (d <= 13) {
    return {
      strategy: "reentry_light",
      loadMultiplier: 0.875,
      volumeMultiplier: 0.8,
      guidance: `${d}-day layoff: run a re-entry week at -12.5% working load and ~80% volume to prevent excessive DOMS.`,
    };
  }
  return {
    strategy: "ramp_back",
    loadMultiplier: 0.775,
    volumeMultiplier: 0.7,
    guidance: `${d}-day layoff (>=14d): run a 1-week ramp-back at -22.5% load and -30% volume before resuming progression.`,
  };
}

export interface PhaseBlock {
  phaseNumber: number;
  name: string;
  weeks: number[];
  focus: string;
  targetRpe: string;
  includesDeload: boolean;
}

export function buildPeriodizedPhasePlan(
  horizonDays: 7 | 14 | 30 | 60 | 90,
  goal: TrainingGoal,
  experience: ExperienceLevel,
): { horizonDays: number; totalWeeks: number; blocks: PhaseBlock[] } {
  if (horizonDays === 7) {
    return {
      horizonDays,
      totalWeeks: 1,
      blocks: [
        {
          phaseNumber: 1,
          name: "Microcycle Baseline",
          weeks: [1],
          focus: `Establish ${goal} baseline loads and movement quality (${experience}).`,
          targetRpe: "RPE 7–8",
          includesDeload: false,
        },
      ],
    };
  }
  if (horizonDays === 14) {
    return {
      horizonDays,
      totalWeeks: 2,
      blocks: [
        {
          phaseNumber: 1,
          name: "2-Week Accumulation Sprint",
          weeks: [1, 2],
          focus: "Week 1 baseline (RPE 7.5), Week 2 progressive overload (+1 rep or +2.5 kg).",
          targetRpe: "RPE 7.5–8.5",
          includesDeload: false,
        },
      ],
    };
  }
  if (horizonDays === 30) {
    return {
      horizonDays,
      totalWeeks: 4,
      blocks: [
        {
          phaseNumber: 1,
          name: "4-Week Mesocycle",
          weeks: [1, 2, 3, 4],
          focus: "Weeks 1–3 progressive overload; Week 4 active deload/consolidation.",
          targetRpe: "RPE 7.5–9 (W4 RPE 6)",
          includesDeload: true,
        },
      ],
    };
  }
  if (horizonDays === 60) {
    return {
      horizonDays,
      totalWeeks: 8,
      blocks: [
        {
          phaseNumber: 1,
          name: "Block 1: Accumulation",
          weeks: [1, 2, 3, 4],
          focus: "Volume build + technical mastery, deload on Week 4.",
          targetRpe: "RPE 7–8.5",
          includesDeload: true,
        },
        {
          phaseNumber: 2,
          name: "Block 2: Intensification",
          weeks: [5, 6, 7, 8],
          focus: "Load progression on primary compounds, deload/test on Week 8.",
          targetRpe: "RPE 8–9",
          includesDeload: true,
        },
      ],
    };
  }

  return {
    horizonDays: 90,
    totalWeeks: 12,
    blocks: [
      {
        phaseNumber: 1,
        name: "Block 1: Foundation & Volume",
        weeks: [1, 2, 3, 4],
        focus: "Work capacity + hypertrophy base; Week 4 deload.",
        targetRpe: "RPE 7–8",
        includesDeload: true,
      },
      {
        phaseNumber: 2,
        name: "Block 2: Progressive Overload",
        weeks: [5, 6, 7, 8],
        focus: "Peak working volume and moderate-heavy loads; Week 8 deload.",
        targetRpe: "RPE 8–9",
        includesDeload: true,
      },
      {
        phaseNumber: 3,
        name: "Block 3: Peak & Consolidation",
        weeks: [9, 10, 11, 12],
        focus: "Top-end strength/physique expression; Week 12 taper/deload.",
        targetRpe: "RPE 8.5–9.5 (W12 RPE 6)",
        includesDeload: true,
      },
    ],
  };
}

export interface WarmupSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  pctOfWorking: number;
  restSec: number;
}

export function generateWarmupRamp(
  workingWeightKg: number,
  isCompound = true,
  barKg = 20,
): WarmupSet[] {
  if (workingWeightKg <= barKg || !isCompound) {
    return [
      {
        setNumber: 1,
        weightKg: Math.max(0, roundTo(workingWeightKg * 0.6, 2.5)),
        reps: 10,
        pctOfWorking: 60,
        restSec: 45,
      },
    ];
  }
  const stages = [
    { pct: 0.45, reps: 8, restSec: 45 },
    { pct: 0.65, reps: 5, restSec: 60 },
    { pct: 0.82, reps: 3, restSec: 90 },
  ];
  return stages.map((st, idx) => ({
    setNumber: idx + 1,
    weightKg: Math.max(barKg, roundTo(workingWeightKg * st.pct, 2.5)),
    reps: st.reps,
    pctOfWorking: Math.round(st.pct * 100),
    restSec: st.restSec,
  }));
}

export function substituteByEquipmentTier(
  exerciseId: string,
  availableEquipment: string[],
  limit = 4,
): Array<CatalogExercise & { score: number; reasons: string[] }> {
  const target = FULL_EXERCISE_CATALOG.find((e) => e.id === exerciseId);
  if (!target) return [];
  return alternativesFor(target, FULL_EXERCISE_CATALOG, availableEquipment, limit);
}
