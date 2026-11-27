/**
 * FORGE Adaptive Engine — Advanced Phase 4 Features
 *
 * - Plateau Detection (B6)
 * - Missed-Session Rescheduling (B9, B10)
 * - Crowded Gym Mode (B7)
 */

import { e1rm } from "./engine";

/* ───────────────────────────── PLATEAU DETECTION (B6) ───────────────────────────── */

export interface ExerciseSessionLog {
  date: string;
  weightKg: number;
  reps: number;
  rpe?: number;
}

export interface PlateauAnalysis {
  isPlateaued: boolean;
  sessionsStalled: number;
  peakE1rm: number;
  recentE1rm: number;
  stagnationPercentage: number;
  reason?: string;
  recommendations: {
    strategy: "micro_loading" | "rep_scheme_shift" | "back_off_reset";
    title: string;
    description: string;
    actionLabel: string;
    suggestedWeightKg?: number;
    suggestedReps?: number;
  }[];
}

/**
 * Evaluates whether an exercise has hit a strength/repetition plateau
 * across 3 or more consecutive sessions at high exertion (RPE ≥ 8.0).
 */
export function detectPlateau(
  history: ExerciseSessionLog[],
  minStalledSessions = 3
): PlateauAnalysis {
  if (history.length < minStalledSessions) {
    return {
      isPlateaued: false,
      sessionsStalled: 0,
      peakE1rm: 0,
      recentE1rm: 0,
      stagnationPercentage: 0,
      recommendations: [],
    };
  }

  // Calculate e1RM for each session
  const evaluated = history.map((s) => ({
    ...s,
    e1rm: e1rm(s.weightKg, s.reps),
  }));

  const recentSessions = evaluated.slice(-minStalledSessions);
  const peakE1rm = Math.max(...evaluated.map((s) => s.e1rm));
  const firstRecentE1rm = recentSessions[0].e1rm;
  const recentE1rm = recentSessions[recentSessions.length - 1].e1rm;

  // Check if all recent sessions had high RPE and e1rm did not improve by > 1%
  const allHighEffort = recentSessions.every((s) => (s.rpe ?? 8.5) >= 8.0);
  const progressPct = firstRecentE1rm > 0 ? ((recentE1rm - firstRecentE1rm) / firstRecentE1rm) * 100 : 0;
  const isStalled = allHighEffort && progressPct <= 1.0;

  if (!isStalled) {
    return {
      isPlateaued: false,
      sessionsStalled: 0,
      peakE1rm,
      recentE1rm,
      stagnationPercentage: 0,
      recommendations: [],
    };
  }

  const lastSession = recentSessions[recentSessions.length - 1];
  const resetWeight = Math.round(lastSession.weightKg * 0.9 * 2) / 2; // -10% rounded to 0.5kg
  const microWeight = lastSession.weightKg + 1.0; // +1kg microplate

  return {
    isPlateaued: true,
    sessionsStalled: minStalledSessions,
    peakE1rm,
    recentE1rm,
    stagnationPercentage: Math.round(progressPct * 10) / 10,
    reason: `Load has stalled across ${minStalledSessions} consecutive sessions at RPE ≥ 8.0 with zero progression. Neural and muscular adaptation has saturated under the current stimulus.`,
    recommendations: [
      {
        strategy: "micro_loading",
        title: "Micro-Loading (+1.0 kg)",
        description: "Bypass psychological barriers and incremental fatigue using 0.5kg micro-plates rather than standard 2.5kg jumps.",
        actionLabel: `Attempt ${microWeight} kg next session`,
        suggestedWeightKg: microWeight,
        suggestedReps: lastSession.reps,
      },
      {
        strategy: "rep_scheme_shift",
        title: "Periodized Rep Shift",
        description: lastSession.reps <= 5
          ? "Shift from 5s to 8s for 3 weeks to accumulate hypertrophy volume before re-testing strength."
          : "Shift from hypertrophy to heavy triples (3 reps) to increase motor unit recruitment.",
        actionLabel: lastSession.reps <= 5 ? "Switch to 3 sets of 8 reps" : "Switch to 4 sets of 3 reps",
        suggestedWeightKg: lastSession.reps <= 5 ? Math.round(lastSession.weightKg * 0.85) : Math.round(lastSession.weightKg * 1.05),
        suggestedReps: lastSession.reps <= 5 ? 8 : 3,
      },
      {
        strategy: "back_off_reset",
        title: "10% Deload Reset",
        description: "Drop working weight 10% for one week, prioritize explosive bar speed, and build back up over 3 weeks.",
        actionLabel: `Reset working load to ${resetWeight} kg`,
        suggestedWeightKg: resetWeight,
        suggestedReps: lastSession.reps,
      },
    ],
  };
}

/* ───────────────────────────── MISSED SESSION RESCHEDULING (B9, B10) ───────────────────────────── */

export type RescheduleStrategy = "rolling_slide" | "antagonist_merge" | "forgive_advance";

export interface ScheduledDay {
  dayIndex: number;
  name: string;
  focus: string;
  exercises: { name: string; sets: number; equipment: string }[];
}

export interface RescheduleResult {
  strategy: RescheduleStrategy;
  title: string;
  summary: string;
  updatedSchedule: ScheduledDay[];
  mergedNotes?: string;
}

/**
 * Rebalances a weekly training calendar when one or more sessions are missed.
 */
export function rescheduleMissedSession(
  schedule: ScheduledDay[],
  missedDayIndex: number,
  strategy: RescheduleStrategy
): RescheduleResult {
  const missedDay = schedule.find((d) => d.dayIndex === missedDayIndex);
  if (!missedDay) {
    return {
      strategy,
      title: "No Change",
      summary: "Specified day was not found in active schedule.",
      updatedSchedule: schedule,
    };
  }

  if (strategy === "rolling_slide") {
    // Shifts all remaining days forward by 1 slot
    const updatedSchedule = schedule.map((day) => {
      if (day.dayIndex < missedDayIndex) return day;
      return {
        ...day,
        dayIndex: day.dayIndex + 1,
      };
    });

    return {
      strategy: "rolling_slide",
      title: "Rolling Calendar Slide",
      summary: `Pushed all upcoming sessions forward by 1 calendar day so ${missedDay.name} is completed first without dropping any prescribed volume.`,
      updatedSchedule,
    };
  }

  if (strategy === "antagonist_merge") {
    // Merges the missed day's compounds with the next scheduled day
    const nextDay = schedule.find((d) => d.dayIndex > missedDayIndex);
    if (!nextDay) {
      return rescheduleMissedSession(schedule, missedDayIndex, "rolling_slide");
    }

    const mergedExercises = [
      ...missedDay.exercises.slice(0, 2), // Top 2 compounds from missed day
      ...nextDay.exercises.slice(0, 3),   // Top 3 from next day
    ];

    const updatedSchedule = schedule
      .filter((d) => d.dayIndex !== missedDayIndex)
      .map((d) => {
        if (d.dayIndex === nextDay.dayIndex) {
          return {
            ...d,
            name: `${missedDay.name} + ${nextDay.name} (Condensed)`,
            focus: "Hybrid Compound Antagonist Session",
            exercises: mergedExercises,
          };
        }
        return d;
      });

    return {
      strategy: "antagonist_merge",
      title: "Antagonist Superset Merge",
      summary: `Merged the core compound movements from ${missedDay.name} into ${nextDay.name} as efficient supersets, keeping the weekly training cycle strictly on time.`,
      updatedSchedule,
      mergedNotes: `Consolidated 5 total exercises into supersets. Session duration estimated at 45 minutes.`,
    };
  }

  // Strategy: forgive_advance
  const updatedSchedule = schedule.filter((d) => d.dayIndex !== missedDayIndex);
  return {
    strategy: "forgive_advance",
    title: "Forgive & Advance",
    summary: `Skipped ${missedDay.name} cleanly. The macrocycle advances as scheduled, and missed muscle groups will receive supplementary volume on the next cycle.`,
    updatedSchedule,
  };
}

/* ───────────────────────────── CROWDED GYM MODE (B7) ───────────────────────────── */

export interface GymExercise {
  name: string;
  primaryMuscle: string;
  equipment: string;
  sets: number;
  reps: number;
}

export interface CrowdedGymSubstitution {
  originalExercise: string;
  originalEquipment: string;
  substitutedExercise: string;
  substitutedEquipment: string;
  reason: string;
  sets: number;
  reps: number;
}

export interface CrowdedGymResult {
  originalExerciseCount: number;
  substitutedCount: number;
  substitutions: CrowdedGymSubstitution[];
  adaptedExercises: GymExercise[];
}

const BARBELL_EQUIPMENT_SUBS: Record<string, { name: string; equipment: string; repMod?: number; reason: string }> = {
  "barbell bench press": {
    name: "Heavy Dumbbell Bench Press",
    equipment: "dumbbell",
    repMod: 0,
    reason: "Free benches/dumbbells available; provides greater pectoralis stretch and equal pec recruitment.",
  },
  "barbell back squat": {
    name: "Bulgarian Split Squat",
    equipment: "dumbbell",
    repMod: 2,
    reason: "Replaces occupied squat rack with unilateral dumbbell training; eliminates lower spine shear load.",
  },
  "barbell deadlift": {
    name: "Dumbbell Romanian Deadlift",
    equipment: "dumbbell",
    repMod: 3,
    reason: "Zero deadlift platform required; isolates hamstrings and glutes with controlled eccentric tension.",
  },
  "barbell row": {
    name: "One-Arm Dumbbell Row",
    equipment: "dumbbell",
    repMod: 2,
    reason: "No barbell or plates needed; unilateral bracing reduces lower back fatigue while maximizing lat ROM.",
  },
  "overhead press": {
    name: "Seated Dumbbell Shoulder Press",
    equipment: "dumbbell",
    repMod: 2,
    reason: "Overhead rack occupied; seated dumbbell press isolates anterior deltoid with high stability.",
  },
};

/**
 * 1-Tap Crowded Gym Mode: Swaps barbell and power rack dependencies to
 * accessible dumbbell, cable, and machine alternatives.
 */
export function adaptForCrowdedGym(exercises: GymExercise[]): CrowdedGymResult {
  const substitutions: CrowdedGymSubstitution[] = [];
  const adaptedExercises: GymExercise[] = [];

  for (const ex of exercises) {
    const key = ex.name.toLowerCase().trim();
    const sub = BARBELL_EQUIPMENT_SUBS[key];

    if (ex.equipment === "barbell" && sub) {
      const newReps = ex.reps + (sub.repMod ?? 0);
      substitutions.push({
        originalExercise: ex.name,
        originalEquipment: ex.equipment,
        substitutedExercise: sub.name,
        substitutedEquipment: sub.equipment,
        reason: sub.reason,
        sets: ex.sets,
        reps: newReps,
      });

      adaptedExercises.push({
        name: sub.name,
        primaryMuscle: ex.primaryMuscle,
        equipment: sub.equipment,
        sets: ex.sets,
        reps: newReps,
      });
    } else {
      adaptedExercises.push(ex);
    }
  }

  return {
    originalExerciseCount: exercises.length,
    substitutedCount: substitutions.length,
    substitutions,
    adaptedExercises,
  };
}
