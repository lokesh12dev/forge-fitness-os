import { z } from "zod";

export const AI_MODULES = ["schedule", "workout", "exercise", "body", "nutrition"] as const;
export type AiModule = (typeof AI_MODULES)[number];

export const AiModuleSchema = z.enum(AI_MODULES);

export const CrossSyncProposalSchema = z.object({
  summary: z.string(),
  goalUpdate: z.enum(["hypertrophy", "strength", "fat_loss", "athletic", "endurance"]).optional(),
  calorieTarget: z.number().int().min(1200).max(6000).optional(),
  proteinTarget: z.number().int().min(50).max(400).optional(),
  carbsTarget: z.number().int().min(20).max(800).optional(),
  fatTarget: z.number().int().min(20).max(250).optional(),
  waterTargetMl: z.number().int().min(1000).max(8000).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  affectedModules: z.array(AiModuleSchema).default([]),
});

export type CrossSyncProposal = z.infer<typeof CrossSyncProposalSchema>;

/* ───────────────────── 1. WARM-UP, PLAN & SCHEDULE SCHEMA ───────────────────── */

export const WarmupDrillSchema = z.object({
  name: z.string().min(1),
  durationSec: z.number().int().min(15).max(600).default(60),
  reps: z.string().default("10 reps"),
  intensity: z.enum(["low", "moderate", "activation"]).default("moderate"),
  focus: z.string().default("Mobility & blood flow"),
});

export const ScheduleExerciseSlotSchema = z.object({
  exerciseId: z.string().min(1),
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10).default(3),
  repsMin: z.number().int().min(1).max(50).default(8),
  repsMax: z.number().int().min(1).max(60).default(12),
  restSec: z.number().int().min(15).max(300).default(90),
  rpeTarget: z.number().min(5).max(10).default(8),
  tempo: z.string().default("2-0-1"),
});

export const ScheduleDaySchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0=Sun .. 6=Sat
  dayLabel: z.string(),
  isRest: z.boolean().default(false),
  routineName: z.string(),
  focus: z.string(),
  durationMin: z.number().int().min(10).max(150).default(50),
  intensity: z.enum(["recovery", "light", "moderate", "high"]).default("moderate"),
  exercises: z.array(ScheduleExerciseSlotSchema).default([]),
});

export const WarmupSchedulePlanSchema = z.object({
  kind: z.literal("schedule"),
  title: z.string().min(2),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  horizon: z.enum(["daily", "weekly", "14d", "monthly", "60d", "90d"]).default("weekly"),
  daysPerWeek: z.number().int().min(1).max(7),
  scheduleMode: z.enum(["week", "rotation"]).default("week"),
  summary: z.string(),
  warmup: z.array(WarmupDrillSchema).min(1),
  days: z.array(ScheduleDaySchema).min(1),
  progressionStrategy: z.string(),
  recoveryGuidance: z.string(),
  rebalanceNote: z.string().optional(),
  crossSync: CrossSyncProposalSchema.optional(),
});

export type WarmupSchedulePlan = z.infer<typeof WarmupSchedulePlanSchema>;

/* ───────────────────── 2. WORKOUT AI SCHEMA ───────────────────── */

export const WorkoutExercisePlanItemSchema = z.object({
  exerciseId: z.string().min(1),
  name: z.string().min(1),
  primaryMuscle: z.string().default("chest"),
  equipment: z.string().default("barbell"),
  sets: z.number().int().min(1).max(10).default(3),
  repsMin: z.number().int().min(1).max(50).default(8),
  repsMax: z.number().int().min(1).max(60).default(12),
  suggestedWeightKg: z.number().min(0).max(500).default(0),
  restSec: z.number().int().min(15).max(300).default(90),
  tempo: z.string().default("2-0-1"),
  rpeTarget: z.number().min(5).max(10).default(8),
  notes: z.string().default(""),
});

export const WorkoutPlanSchema = z.object({
  kind: z.literal("workout"),
  title: z.string().min(2),
  focus: z.string(),
  goal: z.enum(["strength", "hypertrophy", "endurance", "fat_loss", "conditioning"]).default("hypertrophy"),
  environment: z.enum(["gym", "home", "bodyweight"]).default("gym"),
  durationMin: z.number().int().min(10).max(150).default(50),
  intensity: z.string().default("RPE 7.5–8.5"),
  summary: z.string(),
  exercises: z.array(WorkoutExercisePlanItemSchema).min(1),
  progressiveOverloadRule: z.string(),
  recoveryNote: z.string(),
  crossSync: CrossSyncProposalSchema.optional(),
});

export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

/* ───────────────────── 3. EXERCISE AI SCHEMA ───────────────────── */

export const ExerciseGuidePlanSchema = z.object({
  kind: z.literal("exercise"),
  title: z.string().min(2),
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1),
  openGymId: z.string().optional(),
  primaryMuscle: z.string(),
  secondaryMuscles: z.array(z.string()).default([]),
  equipment: z.string(),
  startingPosition: z.string(),
  movementSteps: z.array(z.string()).min(2),
  breathingCues: z.string(),
  commonMistakes: z.array(z.string()).min(1),
  safetyGuidance: z.string(),
  prescription: z.object({
    sets: z.number().int().min(1).max(10).default(3),
    reps: z.string().default("8–12"),
    tempo: z.string().default("2-1-1"),
    restSec: z.number().int().min(30).max(240).default(90),
  }),
  alternatives: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      reason: z.string(),
    }),
  ).default([]),
  supersetPairings: z.array(
    z.object({
      exerciseId: z.string(),
      name: z.string(),
      benefit: z.string(),
    }),
  ).default([]),
  progressionPlan: z.string(),
  crossSync: CrossSyncProposalSchema.optional(),
});

export type ExerciseGuidePlan = z.infer<typeof ExerciseGuidePlanSchema>;

/* ───────────────────── 4. STATUS & BODY AI SCHEMA ───────────────────── */

export const BodyMeasurementSnapshotSchema = z.object({
  label: z.string(),
  value: z.string(),
  recorded: z.boolean(),
  trend: z.string().optional(),
});

export const BodyProgressPlanSchema = z.object({
  kind: z.literal("body"),
  title: z.string().min(2),
  summary: z.string(),
  dataAuditNote: z.string(),
  recordedMetrics: z.array(BodyMeasurementSnapshotSchema),
  missingMeasurements: z.array(z.string()).default([]),
  plateauDetected: z.boolean().default(false),
  plateauAnalysis: z.string(),
  targets: z.object({
    targetWeightKg: z.number().min(30).max(250).optional(),
    weeklyWeightDeltaKg: z.number().min(-1.5).max(1.5),
    targetSleepHours: z.number().min(5).max(11).default(7.5),
    weeklySessionsTarget: z.number().int().min(1).max(7).default(4),
  }),
  recommendations: z.array(z.string()).min(2),
  crossSync: CrossSyncProposalSchema.optional(),
});

export type BodyProgressPlan = z.infer<typeof BodyProgressPlanSchema>;

/* ───────────────────── 5. NUTRITION CHECK AI SCHEMA ───────────────────── */

export const NutritionMealItemSchema = z.object({
  name: z.string().min(1),
  serving: z.string().default("1 serving"),
  calories: z.number().int().min(0).max(3000),
  protein: z.number().min(0).max(250),
  carbs: z.number().min(0).max(400),
  fat: z.number().min(0).max(200),
  substitute: z.string().optional(),
});

export const NutritionMealSlotSchema = z.object({
  slot: z.enum(["breakfast", "morning_snack", "lunch", "evening_snack", "dinner", "pre_workout", "post_workout"]),
  label: z.string(),
  items: z.array(NutritionMealItemSchema).min(1),
});

export const NutritionPlanSchema = z.object({
  kind: z.literal("nutrition"),
  title: z.string().min(2),
  dietStyle: z.enum(["balanced", "vegetarian", "vegan", "non_vegetarian", "indian"]).default("balanced"),
  goal: z.string(),
  disclaimer: z.string().default("Estimated targets for general fitness planning — not medical or clinical nutrition advice."),
  dailyTargets: z.object({
    calories: z.number().int().min(1200).max(6000),
    protein: z.number().int().min(40).max(400),
    carbs: z.number().int().min(20).max(800),
    fat: z.number().int().min(20).max(250),
    waterMl: z.number().int().min(1000).max(8000),
  }),
  summary: z.string(),
  meals: z.array(NutritionMealSlotSchema).min(1),
  groceryList: z.array(z.string()).default([]),
  hydrationPlan: z.string(),
  crossSync: CrossSyncProposalSchema.optional(),
});

export type NutritionPlan = z.infer<typeof NutritionPlanSchema>;

export const AnyAiPlanSchema = z.discriminatedUnion("kind", [
  WarmupSchedulePlanSchema,
  WorkoutPlanSchema,
  ExerciseGuidePlanSchema,
  BodyProgressPlanSchema,
  NutritionPlanSchema,
]);

export type AnyAiPlan = z.infer<typeof AnyAiPlanSchema>;

export function validateAndNormalizeAiPlan(
  expectedModule: AiModule,
  raw: unknown,
): { ok: true; plan: AnyAiPlan } | { ok: false; error: string } {
  const parsed = AnyAiPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  if (parsed.data.kind !== expectedModule) {
    return {
      ok: false,
      error: `Plan kind "${parsed.data.kind}" does not match module "${expectedModule}".`,
    };
  }
  return { ok: true, plan: parsed.data };
}
