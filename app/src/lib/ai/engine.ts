import { FULL_EXERCISE_CATALOG, type CatalogExercise } from "@/lib/opengym-catalog";
import { FOOD_DATABASE } from "@/lib/food-db";
import { ONT_CORE_FOODS, scaleNutrients } from "@/lib/opennutri-core";
import type { UnifiedUserFitnessContext } from "./context";
import { generateWithConfiguredProvider, type AiProviderName } from "./providers";
import {
  validateAndNormalizeAiPlan,
  type AiModule,
  type AnyAiPlan,
  type BodyProgressPlan,
  type CrossSyncProposal,
  type ExerciseGuidePlan,
  type NutritionPlan,
  type WarmupSchedulePlan,
  type WorkoutPlan,
} from "./schemas";

export interface CoachGenerationResult {
  reply: string;
  plan: AnyAiPlan | null;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
  tokensEstimated: number;
  fallbackUsed: boolean;
  mutatedExistingDraft: boolean;
}

export interface ModuleClientHints {
  selectedExerciseId?: string;
  selectedExerciseName?: string;
  currentScheduleMode?: "week" | "rotation";
  recordedTapeMetrics?: Array<{ label: string; value: string }>;
  dietPreference?: string;
  allergies?: string;
}

const WEEKDAY_NAMES = [
  { dow: 1, label: "Monday" },
  { dow: 2, label: "Tuesday" },
  { dow: 3, label: "Wednesday" },
  { dow: 4, label: "Thursday" },
  { dow: 5, label: "Friday" },
  { dow: 6, label: "Saturday" },
  { dow: 0, label: "Sunday" },
];

function findCatalogExercise(query: string, equipmentPool?: string[]): CatalogExercise {
  const ql = query.toLowerCase().trim();
  const candidates = equipmentPool?.length
    ? FULL_EXERCISE_CATALOG.filter((e) => equipmentPool.includes(e.equipment) || e.equipment === "bodyweight")
    : FULL_EXERCISE_CATALOG;
  const exact = candidates.find((e) => e.name.toLowerCase() === ql);
  if (exact) return exact;
  const partial = candidates.find((e) => e.name.toLowerCase().includes(ql));
  if (partial) return partial;
  return FULL_EXERCISE_CATALOG.find((e) => e.id === "ex-bench-press") ?? FULL_EXERCISE_CATALOG[0];
}

function pickExercisesByPattern(
  muscles: string[],
  count: number,
  equipmentPool: string[],
  environment: "gym" | "home" | "bodyweight",
): CatalogExercise[] {
  const allowedEq =
    environment === "bodyweight"
      ? new Set(["bodyweight"])
      : environment === "home"
        ? new Set(["dumbbell", "bodyweight", "kettlebell", "bands"])
        : new Set(equipmentPool.length ? [...equipmentPool, "bodyweight"] : ["barbell", "dumbbell", "machine", "cable", "bodyweight"]);

  const picked: CatalogExercise[] = [];
  const usedIds = new Set<string>();

  for (const muscle of muscles) {
    const match = FULL_EXERCISE_CATALOG.find(
      (e) =>
        !usedIds.has(e.id) &&
        allowedEq.has(e.equipment) &&
        (e.primaryMuscle.toLowerCase() === muscle.toLowerCase() || e.bodyPart.toLowerCase().includes(muscle.toLowerCase())),
    );
    if (match) {
      picked.push(match);
      usedIds.add(match.id);
    }
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    for (const e of FULL_EXERCISE_CATALOG) {
      if (!usedIds.has(e.id) && allowedEq.has(e.equipment)) {
        picked.push(e);
        usedIds.add(e.id);
      }
      if (picked.length >= count) break;
    }
  }
  return picked;
}

function detectGoalShift(message: string, ctx: UnifiedUserFitnessContext): CrossSyncProposal | undefined {
  const m = message.toLowerCase();
  const wantsMuscle = /muscle|hypertrophy|bulk|lean bulk|mass|size/.test(m);
  const wantsCut = /fat.?loss|lose fat|cut|shred|lean out|weight loss/.test(m);
  const wantsStrength = /strength|powerlifting|1rm|get stronger/.test(m);

  if (wantsMuscle && ctx.goal !== "hypertrophy") {
    return {
      summary: "Shift primary goal to Muscle Building (Hypertrophy): adjust calories +250 kcal above maintenance, protein 2.0g/kg, and 4–5 day hypertrophy split.",
      goalUpdate: "hypertrophy",
      calorieTarget: Math.round(ctx.weightKg * 36),
      proteinTarget: Math.round(ctx.weightKg * 2.1),
      carbsTarget: Math.round((ctx.weightKg * 36 * 0.45) / 4),
      fatTarget: Math.round((ctx.weightKg * 36 * 0.25) / 9),
      daysPerWeek: 5,
      affectedModules: ["schedule", "workout", "exercise", "body", "nutrition"],
    };
  }
  if (wantsCut && ctx.goal !== "fat_loss") {
    const cals = Math.max(1500, Math.round(ctx.weightKg * 27));
    return {
      summary: "Shift primary goal to Fat Loss: set moderate -400 kcal deficit, keep protein high (2.2g/kg) to preserve lean mass, and maintain 4x/wk resistance training.",
      goalUpdate: "fat_loss",
      calorieTarget: cals,
      proteinTarget: Math.round(ctx.weightKg * 2.2),
      carbsTarget: Math.round((cals * 0.35) / 4),
      fatTarget: Math.round((cals * 0.28) / 9),
      daysPerWeek: 4,
      affectedModules: ["schedule", "workout", "exercise", "body", "nutrition"],
    };
  }
  if (wantsStrength && ctx.goal !== "strength") {
    return {
      summary: "Shift primary goal to Strength: prioritize 3–6 rep heavy compounds, longer 150–180s rest intervals, and maintenance/slight surplus calories.",
      goalUpdate: "strength",
      calorieTarget: Math.round(ctx.weightKg * 34),
      proteinTarget: Math.round(ctx.weightKg * 2.0),
      daysPerWeek: 4,
      affectedModules: ["schedule", "workout", "exercise", "body", "nutrition"],
    };
  }
  return undefined;
}

/* ───────────────────── 1. SCHEDULE & WARM-UP AI ───────────────────── */

function generateScheduleCoach(
  message: string,
  ctx: UnifiedUserFitnessContext,
  hints?: ModuleClientHints,
): { reply: string; plan: WarmupSchedulePlan } {
  const m = message.toLowerCase();
  const level: "beginner" | "intermediate" | "advanced" =
    /beginner|new|starter/.test(m) ? "beginner"
    : /advanced|intense|6.?day/.test(m) ? "advanced"
    : ctx.experience === "beginner" ? "beginner"
    : ctx.experience === "advanced" ? "advanced" : "intermediate";

  const horizon: "daily" | "weekly" | "monthly" =
    /30.?day|month|4.?week/.test(m) ? "monthly"
    : /today|warm.?up only|mobility/.test(m) ? "daily"
    : "weekly";

  const daysMatch = m.match(/\b([2-6])[\s-]*day\b/);
  const daysPerWeek = daysMatch
    ? Math.max(2, Math.min(6, Number(daysMatch[1])))
    : level === "beginner" ? 3 : /6[\s-]*day/.test(m) ? 6 : 4;

  const minsMatch = m.match(/(\d{2,3})[\s-]*min/);
  const durationMin = minsMatch ? Math.max(20, Math.min(120, Number(minsMatch[1]))) : 50;
  const isMissedRebalance = /miss|skip|rearrange|adjust|reschedule/.test(m);
  const isRecoveryFocus = /recovery|deload|stretch|mobility|rest/.test(m);

  const warmup = [
    { name: "90/90 Hip Switches & Thoracic Rotations", durationSec: 90, reps: "8/side", intensity: "low" as const, focus: "Hip capsule & T-spine mobility" },
    { name: "Band Pull-Aparts & Scapular Push-Ups", durationSec: 75, reps: "15 reps", intensity: "activation" as const, focus: "Scapular upward rotation & rear delts" },
    { name: "World's Greatest Stretch + Ankle Rocks", durationSec: 90, reps: "5/side", intensity: "moderate" as const, focus: "Hamstrings, hip flexors & dorsiflexion" },
    { name: "2 Ramp-Up Sets on First Compound (50% × 6, 75% × 3)", durationSec: 180, reps: "6 + 3 reps", intensity: "activation" as const, focus: "Neural priming & bar path groove" },
  ];

  const splitTemplates =
    daysPerWeek <= 3
      ? [
          { name: "Full Body A · Strength & Push", focus: "Chest · Quads · Back", muscles: ["chest", "quads", "back", "shoulders"] },
          { name: "Full Body B · Hinge & Pull", focus: "Hamstrings · Lats · Arms", muscles: ["hamstrings", "lats", "biceps", "core"] },
          { name: "Full Body C · Athletic & Volume", focus: "Glutes · Shoulders · Core", muscles: ["glutes", "shoulders", "triceps", "calves"] },
        ]
      : daysPerWeek === 4
        ? [
            { name: "Upper Power", focus: "Chest · Back · Shoulders", muscles: ["chest", "back", "shoulders", "triceps"] },
            { name: "Lower Strength", focus: "Quads · Hamstrings · Calves", muscles: ["quads", "hamstrings", "glutes", "calves"] },
            { name: "Upper Hypertrophy", focus: "Lats · Incline Chest · Arms", muscles: ["lats", "chest", "biceps", "shoulders"] },
            { name: "Lower & Posterior Chain", focus: "Glutes · Hamstrings · Core", muscles: ["hamstrings", "glutes", "quads", "core"] },
          ]
        : daysPerWeek === 5
          ? [
              { name: "Push · Chest & Delts", focus: "Chest · Shoulders · Triceps", muscles: ["chest", "shoulders", "triceps"] },
              { name: "Pull · Back & Rear Delts", focus: "Lats · Upper Back · Biceps", muscles: ["lats", "back", "biceps"] },
              { name: "Legs · Squat & Posterior", focus: "Quads · Hamstrings · Calves", muscles: ["quads", "hamstrings", "calves"] },
              { name: "Upper Density", focus: "Incline · Rows · Arms", muscles: ["chest", "back", "biceps", "triceps"] },
              { name: "Lower & Core", focus: "Glutes · Unilateral · Abs", muscles: ["glutes", "quads", "core"] },
            ]
          : [
              { name: "Push A", focus: "Chest · Anterior Delts · Triceps", muscles: ["chest", "shoulders", "triceps"] },
              { name: "Pull A", focus: "Lats · Mid-Back · Biceps", muscles: ["lats", "back", "biceps"] },
              { name: "Legs A", focus: "Quads · Hamstrings · Calves", muscles: ["quads", "hamstrings", "calves"] },
              { name: "Push B", focus: "Shoulders · Upper Chest · Triceps", muscles: ["shoulders", "chest", "triceps"] },
              { name: "Pull B", focus: "Upper Back · Lats · Forearms", muscles: ["back", "lats", "biceps"] },
              { name: "Legs B & Core", focus: "Glutes · Hamstrings · Core", muscles: ["glutes", "hamstrings", "core"] },
            ];

  const trainingDows =
    daysPerWeek === 2 ? [1, 4]
    : daysPerWeek === 3 ? [1, 3, 5]
    : daysPerWeek === 4 ? [1, 2, 4, 5]
    : daysPerWeek === 5 ? [1, 2, 3, 5, 6]
    : [1, 2, 3, 4, 5, 6];

  let templateIdx = 0;
  const days = WEEKDAY_NAMES.map((wd) => {
    const isTraining = trainingDows.includes(wd.dow);
    if (!isTraining || (isRecoveryFocus && wd.dow === 3)) {
      return {
        weekday: wd.dow,
        dayLabel: wd.label,
        isRest: true,
        routineName: "Active Recovery & Mobility",
        focus: "Zone-2 walk (25 min) + hip/thoracic flow",
        durationMin: 25,
        intensity: "recovery" as const,
        exercises: [],
      };
    }
    const tpl = splitTemplates[templateIdx % splitTemplates.length];
    templateIdx += 1;
    const exCount = durationMin <= 30 ? 3 : durationMin >= 60 ? 5 : 4;
    const picked = pickExercisesByPattern(tpl.muscles, exCount, ctx.equipment, "gym");
    return {
      weekday: wd.dow,
      dayLabel: wd.label,
      isRest: false,
      routineName: tpl.name,
      focus: tpl.focus,
      durationMin,
      intensity: isRecoveryFocus ? ("light" as const) : level === "advanced" ? ("high" as const) : ("moderate" as const),
      exercises: picked.map((ex, i) => ({
        exerciseId: ex.id,
        name: ex.name,
        sets: isRecoveryFocus ? 2 : i === 0 ? 4 : 3,
        repsMin: i === 0 ? 6 : 8,
        repsMax: i === 0 ? 8 : 12,
        restSec: durationMin <= 30 ? 60 : i === 0 ? 120 : 90,
        rpeTarget: isRecoveryFocus ? 6.5 : 8,
        tempo: "2-0-1",
      })),
    };
  });

  const crossSync = detectGoalShift(message, ctx);
  const title =
    horizon === "monthly"
      ? `30-Day ${level.charAt(0).toUpperCase() + level.slice(1)} ${daysPerWeek}-Day Blueprint`
      : isMissedRebalance
        ? `Rebalanced ${daysPerWeek}-Day Weekly Schedule`
        : isRecoveryFocus
          ? "Recovery & Mobility Reset Week"
          : `${daysPerWeek}-Day ${level.charAt(0).toUpperCase() + level.slice(1)} Plan & Warm-Up`;

  const plan: WarmupSchedulePlan = {
    kind: "schedule",
    title,
    level,
    horizon,
    daysPerWeek,
    scheduleMode: hints?.currentScheduleMode ?? "week",
    summary: `Built for ${ctx.firstName} (Readiness ${ctx.readiness}/100, ${ctx.equipment.slice(0, 4).join(", ")}). Includes a 7-minute dynamic warm-up and ${daysPerWeek} structured sessions.`,
    warmup,
    days,
    progressionStrategy:
      horizon === "monthly"
        ? "Weeks 1–2: establish clean RPE 7.5–8 technique and hit top of rep ranges. Week 3: add +2.5kg on primary compounds. Week 4: deload volume by 35% to supercompensate."
        : "Double progression: once you hit the top of the rep window across all sets at RPE ≤ 8, add +2.5kg next session.",
    recoveryGuidance: `Current readiness is ${ctx.readiness}/100. Keep 7.5+ hours of sleep and 10–15 min Zone-2 walking on rest days.`,
    rebalanceNote: isMissedRebalance
      ? "Missed session absorbed cleanly via rolling slide — no double-booking required; priority compound lifts remain evenly spaced."
      : undefined,
    crossSync,
  };

  const reply = [
    `**${title}** is ready for you, ${ctx.firstName}.`,
    "",
    isMissedRebalance
      ? "I've rebalanced your week so your missed workout slides cleanly without overloading back-to-back muscle groups."
      : `I factored in your current readiness (**${ctx.readiness}/100**), **${ctx.weekWorkoutsCount}** completed sessions this week, and your available kit (${ctx.equipment.slice(0, 4).join(", ")}).`,
    "",
    `- **Dynamic Warm-Up:** ${warmup.length} mobility & activation drills (~7 min) before working sets.`,
    `- **Weekly Cadence:** ${daysPerWeek} training days (~${durationMin} min each) + structured recovery days.`,
    crossSync ? `- **Cross-Section Sync Available:** ${crossSync.summary}` : "",
    "",
    "Review the structured schedule below — you can **Preview**, **Edit**, **Regenerate**, or click **Apply Plan** to push it straight into your weekly schedule.",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply, plan };
}

/* ───────────────────── 2. WORKOUT AI COACH ───────────────────── */

function generateWorkoutCoach(
  message: string,
  ctx: UnifiedUserFitnessContext,
): { reply: string; plan: WorkoutPlan } {
  const m = message.toLowerCase();
  const environment: "gym" | "home" | "bodyweight" =
    /bodyweight|calisthenics|no equipment/.test(m) ? "bodyweight"
    : /home|dumbbell only|minimal/.test(m) ? "home"
    : "gym";

  const goal: WorkoutPlan["goal"] =
    /strength|heavy|power/.test(m) ? "strength"
    : /fat.?loss|burn|shred|metabolic/.test(m) ? "fat_loss"
    : /endurance|stamina|high rep/.test(m) ? "endurance"
    : /conditioning|hiit|circuit/.test(m) ? "conditioning"
    : "hypertrophy";

  const focus =
    /push/.test(m) ? "Push · Chest, Shoulders & Triceps"
    : /pull/.test(m) ? "Pull · Back, Lats & Biceps"
    : /leg|lower|squat|glute/.test(m) ? "Lower Body · Quads, Hamstrings & Glutes"
    : /upper/.test(m) ? "Upper Body · Balanced Push/Pull"
    : /full/.test(m) ? "Full Body · Compound Priority"
    : ctx.activeProgram?.days[ctx.weekWorkoutsCount % Math.max(1, ctx.activeProgram.days.length)]?.focus ?? "Push · Chest, Shoulders & Triceps";

  const muscles =
    /pull/.test(focus.toLowerCase()) ? ["lats", "back", "biceps", "shoulders"]
    : /lower|leg/.test(focus.toLowerCase()) ? ["quads", "hamstrings", "glutes", "calves", "core"]
    : /upper/.test(focus.toLowerCase()) ? ["chest", "back", "shoulders", "biceps", "triceps"]
    : /full/.test(focus.toLowerCase()) ? ["quads", "chest", "back", "shoulders", "core"]
    : ["chest", "shoulders", "triceps", "chest", "shoulders"];

  const minsMatch = m.match(/(\d{2,3})[\s-]*min/);
  const durationMin = minsMatch ? Math.max(15, Math.min(120, Number(minsMatch[1]))) : 48;
  const exCount = durationMin <= 25 ? 3 : durationMin >= 60 ? 6 : 5;
  const picked = pickExercisesByPattern(muscles, exCount, ctx.equipment, environment);

  const topPr = ctx.prs[0];
  const intensityScale = ctx.readiness >= 80 ? 1 : ctx.readiness >= 65 ? 0.94 : 0.88;

  const exercises = picked.map((ex, idx) => {
    const matchingPr = ctx.prs.find((p) => p.exerciseId === ex.id || p.exerciseName.toLowerCase() === ex.name.toLowerCase());
    const baseLoad = matchingPr ? matchingPr.e1rm * (goal === "strength" ? 0.82 : 0.72) : ex.equipment === "bodyweight" ? 0 : idx === 0 ? 60 : 22.5;
    const suggestedWeightKg = baseLoad > 0 ? Math.round((baseLoad * intensityScale) / 2.5) * 2.5 : 0;

    return {
      exerciseId: ex.id,
      name: ex.name,
      primaryMuscle: ex.primaryMuscle,
      equipment: ex.equipment,
      sets: durationMin <= 25 ? 3 : idx === 0 ? 4 : 3,
      repsMin: goal === "strength" ? 4 : goal === "endurance" || goal === "fat_loss" ? 12 : 8,
      repsMax: goal === "strength" ? 6 : goal === "endurance" || goal === "fat_loss" ? 15 : 12,
      suggestedWeightKg,
      restSec: goal === "strength" ? 150 : goal === "conditioning" || durationMin <= 25 ? 60 : 90,
      tempo: goal === "hypertrophy" ? "3-1-1" : "2-0-1",
      rpeTarget: ctx.readiness >= 75 ? 8 : 7,
      notes: idx === 0 ? "Primary compound — log RPE accurately for next-session auto-regulation." : "Controlled eccentric, full range of motion.",
    };
  });

  const crossSync = detectGoalShift(message, ctx);
  const title = `${focus.split("·")[0].trim()} · ${goal.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} (${environment})`;

  const plan: WorkoutPlan = {
    kind: "workout",
    title,
    focus,
    goal,
    environment,
    durationMin,
    intensity: ctx.readiness >= 75 ? "RPE 8 (Optimal)" : "RPE 7 (Auto-Regulated)",
    summary: `Tailored for ${ctx.firstName} at ${ctx.readiness}/100 readiness${topPr ? ` (lead e1RM: ${topPr.exerciseName} ${topPr.e1rm}kg)` : ""}.`,
    exercises,
    progressiveOverloadRule:
      goal === "strength"
        ? "Add +2.5kg whenever all working sets are completed at RPE ≤ 8."
        : "Hit the upper rep bound on all sets with clean tempo, then increase load by 2.5kg (or 1–2kg dumbbells).",
    recoveryNote:
      ctx.lowestRecoveredMuscles[0]
        ? `Watch ${ctx.lowestRecoveredMuscles[0].muscle} recovery (${ctx.lowestRecoveredMuscles[0].recovery}%).`
        : "Keep 90s rest between compounds and hydrate 500ml intra-workout.",
    crossSync,
  };

  const reply = [
    `Built **${title}** (~${durationMin} min, ${exercises.length} exercises) using your ${environment} setup.`,
    "",
    `- **Readiness Auto-Regulation:** Your readiness is **${ctx.readiness}/100**, so working loads are calibrated at **${plan.intensity}**.`,
    ctx.lastWorkout ? `- **History Context:** Following your last session (**${ctx.lastWorkout.name}**, ${ctx.lastWorkout.totalVolume.toLocaleString("en-US")}kg volume).` : "",
    `- **Progression:** ${plan.progressiveOverloadRule}`,
    "",
    "Click **Apply Plan** below to launch this exact workout immediately with live set/rep/RPE tracking.",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply, plan };
}

/* ───────────────────── 3. EXERCISE AI COACH ───────────────────── */

function generateExerciseCoach(
  message: string,
  ctx: UnifiedUserFitnessContext,
  hints?: ModuleClientHints,
): { reply: string; plan: ExerciseGuidePlan } {
  const m = message.toLowerCase();
  const hinted = hints?.selectedExerciseId
    ? FULL_EXERCISE_CATALOG.find((e) => e.id === hints.selectedExerciseId)
    : undefined;

  // Try to match an exercise name mentioned in the user's message
  const mentioned = FULL_EXERCISE_CATALOG.find((e) => m.includes(e.name.toLowerCase()));
  const keywordMatch = !mentioned
    ? FULL_EXERCISE_CATALOG.find((e) => {
        const tokens = e.name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
        return tokens.length >= 2 && tokens.every((t) => m.includes(t));
      })
    : undefined;

  const ex = mentioned ?? keywordMatch ?? hinted ?? findCatalogExercise("bench press", ctx.equipment);

  const alts = FULL_EXERCISE_CATALOG.filter(
    (cand) => cand.id !== ex.id && cand.primaryMuscle === ex.primaryMuscle && cand.equipment !== ex.equipment,
  )
    .slice(0, 3)
    .map((cand) => ({
      exerciseId: cand.id,
      name: cand.name,
      reason: `Targets ${cand.primaryMuscle} using ${cand.equipment} (${cand.difficulty} friendly).`,
    }));

  const antagonistMuscle =
    ex.primaryMuscle === "chest" ? "back"
    : ex.primaryMuscle === "back" || ex.primaryMuscle === "lats" ? "chest"
    : ex.primaryMuscle === "quads" ? "hamstrings"
    : ex.primaryMuscle === "biceps" ? "triceps"
    : "core";

  const supersets = FULL_EXERCISE_CATALOG.filter(
    (cand) => cand.id !== ex.id && cand.primaryMuscle === antagonistMuscle,
  )
    .slice(0, 2)
    .map((cand) => ({
      exerciseId: cand.id,
      name: cand.name,
      benefit: `Antagonist pairing with ${ex.name} cuts rest time while maintaining output.`,
    }));

  const steps = ex.instructions.length >= 2
    ? ex.instructions
    : [
        `Set up with balanced stance/grip and 360° core bracing before initiating ${ex.name}.`,
        `Lower under a controlled ${ex.tempo} tempo to full comfortable range of motion.`,
        `Drive smoothly through the target ${ex.primaryMuscle} musculature without bouncing or losing joint alignment.`,
      ];

  const plan: ExerciseGuidePlan = {
    kind: "exercise",
    title: `${ex.name} · Complete Form & Progression Guide`,
    exerciseId: ex.id,
    exerciseName: ex.name,
    openGymId: ex.openGymId,
    primaryMuscle: ex.primaryMuscle,
    secondaryMuscles: ex.secondaryMuscles,
    equipment: ex.equipment,
    startingPosition: `Align joints cleanly for ${ex.name} (${ex.equipment}). Set shoulder blades, brace core, and stabilize your base before the first rep.`,
    movementSteps: steps,
    breathingCues: "Inhale deeply into your brace before the eccentric lowering phase; exhale smoothly past the sticking point on exertion.",
    commonMistakes: [
      "Using momentum or bouncing out of the bottom range instead of controlling the eccentric.",
      `Letting secondary joints take over tension away from ${ex.primaryMuscle}.`,
      "Cutting range of motion short as fatigue builds.",
    ],
    safetyGuidance: `Start with a 1–2 warm-up sets at 50–65% working load. Stop immediately if you feel sharp joint pain (distinct from muscular fatigue).`,
    prescription: {
      sets: ex.category === "compound" ? 4 : 3,
      reps: ex.category === "compound" ? "6–10" : "10–15",
      tempo: ex.tempo || "2-1-1",
      restSec: ex.category === "compound" ? 120 : 75,
    },
    alternatives: alts,
    supersetPairings: supersets,
    progressionPlan: `Build from 3×8 to 4×10 at RPE 8 with strict ${ex.tempo || "2-1-1"} tempo, then increase load by 2.5kg.`,
  };

  const reply = [
    `**${ex.name}** (${ex.primaryMuscle} · ${ex.equipment})`,
    "",
    `- **Starting Position:** ${plan.startingPosition}`,
    `- **Breathing:** ${plan.breathingCues}`,
    `- **Prescription:** ${plan.prescription.sets} sets × ${plan.prescription.reps} reps @ ${plan.prescription.tempo} tempo (${plan.prescription.restSec}s rest).`,
    alts.length ? `- **Best Alternatives:** ${alts.map((a) => `${a.name} (${a.reason})`).join(" | ")}` : "",
    "",
    "You can inspect the full step-by-step guide, superset pairings, and launch a session with this exercise below.",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply, plan };
}

/* ───────────────────── 4. STATUS & BODY AI COACH ───────────────────── */

function generateBodyCoach(
  message: string,
  ctx: UnifiedUserFitnessContext,
  hints?: ModuleClientHints,
): { reply: string; plan: BodyProgressPlan } {
  const firstW = ctx.weightTrend[0]?.weightKg;
  const lastW = ctx.weightTrend[ctx.weightTrend.length - 1]?.weightKg ?? ctx.weightKg;
  const weightDelta = firstW != null ? Math.round((lastW - firstW) * 10) / 10 : null;

  const recentVol = ctx.weeklyVolumes[ctx.weeklyVolumes.length - 1]?.volume ?? 0;
  const prevVol = ctx.weeklyVolumes[ctx.weeklyVolumes.length - 2]?.volume ?? 0;
  const volChangePct = prevVol > 0 ? Math.round(((recentVol - prevVol) / prevVol) * 100) : 0;

  const recordedMetrics = [
    {
      label: "Body Weight",
      value: `${lastW.toFixed(1)} kg`,
      recorded: true,
      trend: weightDelta !== null ? `${weightDelta >= 0 ? "+" : ""}${weightDelta} kg over recorded window` : "Single baseline recorded",
    },
    {
      label: "Height",
      value: `${ctx.heightCm} cm`,
      recorded: true,
    },
    {
      label: "Body Fat %",
      value: ctx.latestMetric?.bodyFat != null ? `${ctx.latestMetric.bodyFat}%` : "Not recorded",
      recorded: ctx.latestMetric?.bodyFat != null,
    },
    {
      label: "Sleep / HRV",
      value: ctx.latestMetric?.sleepHours != null ? `${ctx.latestMetric.sleepHours}h · ${ctx.latestMetric.hrv ?? "—"}ms HRV` : "Not recorded",
      recorded: ctx.latestMetric?.sleepHours != null,
    },
    {
      label: "Training Volume (Last Week)",
      value: `${recentVol.toLocaleString("en-US")} kg`,
      recorded: recentVol > 0,
      trend: prevVol > 0 ? `${volChangePct >= 0 ? "+" : ""}${volChangePct}% vs prior week` : undefined,
    },
  ];

  if (hints?.recordedTapeMetrics?.length) {
    for (const tm of hints.recordedTapeMetrics) {
      recordedMetrics.push({ label: tm.label, value: tm.value, recorded: true });
    }
  }

  const missingMeasurements: string[] = [];
  if (ctx.latestMetric?.bodyFat == null) missingMeasurements.push("Body fat %");
  if (!hints?.recordedTapeMetrics?.some((t) => t.label.toLowerCase().includes("waist"))) missingMeasurements.push("Waist circumference");
  if (!hints?.recordedTapeMetrics?.some((t) => t.label.toLowerCase().includes("chest"))) missingMeasurements.push("Chest circumference");
  if (!hints?.recordedTapeMetrics?.some((t) => t.label.toLowerCase().includes("arm"))) missingMeasurements.push("Arm circumference");
  if (!hints?.recordedTapeMetrics?.some((t) => t.label.toLowerCase().includes("hip"))) missingMeasurements.push("Hip circumference");

  const plateauDetected =
    (weightDelta !== null && Math.abs(weightDelta) < 0.2 && ctx.weightTrend.length >= 5) ||
    (prevVol > 0 && volChangePct <= 0 && ctx.completedSessionsCount >= 4);

  const weeklyDelta = ctx.goal === "fat_loss" ? -0.4 : ctx.goal === "hypertrophy" ? 0.25 : 0;
  const crossSync = detectGoalShift(message, ctx);

  const plan: BodyProgressPlan = {
    kind: "body",
    title: `Body & Performance Audit · ${ctx.firstName}`,
    summary: `Analysis strictly grounded in your recorded SQLite metrics (${ctx.weightTrend.length} weight entries, ${ctx.completedSessionsCount} workouts, ${ctx.prs.length} PRs).`,
    dataAuditNote:
      missingMeasurements.length > 0
        ? `Missing measurements not yet logged in your records: ${missingMeasurements.join(", ")}. Log them in the Anthropometric Tape Tracker for full circumference tracking.`
        : "All core anthropometric and performance markers are recorded.",
    recordedMetrics,
    missingMeasurements,
    plateauDetected,
    plateauAnalysis: plateauDetected
      ? `Weight delta (${weightDelta ?? 0} kg) or weekly volume (${volChangePct}%) has flattened. A small 150–200 kcal nutrition adjustment or +1 working set on lagging muscle groups will restart progression.`
      : `Momentum is steady: readiness is ${ctx.readiness}/100 with ${ctx.prs[0] ? `lead PR ${ctx.prs[0].exerciseName} at ${ctx.prs[0].e1rm}kg` : "consistent session logging"}.`,
    targets: {
      targetWeightKg: Math.round((lastW + weeklyDelta * 4) * 10) / 10,
      weeklyWeightDeltaKg: weeklyDelta,
      targetSleepHours: 7.5,
      weeklySessionsTarget: ctx.activeProgram?.daysPerWeek ?? 4,
    },
    recommendations: [
      `Keep protein anchored near ${ctx.nutrition.proteinTarget}g/day while tracking morning weight 3–5×/week.`,
      ctx.readiness < 70
        ? `Prioritize 45 min extra sleep tonight — readiness (${ctx.readiness}/100) is your primary recovery lever.`
        : `Maintain ${ctx.activeProgram?.daysPerWeek ?? 4} weekly sessions and add +2.5kg to primary lifts when RPE ≤ 8.`,
      missingMeasurements.length > 0
        ? `Record ${missingMeasurements.slice(0, 3).join(", ")} in the Tape Tracker so I can track true recomposition.`
        : "Compare 4-week circumference deltas alongside your 7-day smoothed weight curve.",
    ],
    crossSync,
  };

  const reply = [
    `**Status & Body Analysis · ${ctx.firstName}**`,
    "",
    `- **Recorded Weight:** ${lastW.toFixed(1)} kg${weightDelta !== null ? ` (${weightDelta >= 0 ? "+" : ""}${weightDelta} kg across ${ctx.weightTrend.length} logs)` : ""}.`,
    `- **Strength & Volume:** ${ctx.completedSessionsCount} completed workouts · last week volume **${recentVol.toLocaleString("en-US")} kg**${ctx.prs[0] ? ` · top e1RM: **${ctx.prs[0].exerciseName} (${ctx.prs[0].e1rm} kg)**` : ""}.`,
    `- **Plateau Check:** ${plan.plateauAnalysis}`,
    missingMeasurements.length > 0
      ? `- **Unrecorded Metrics (Not Assumed):** ${missingMeasurements.join(", ")} have not been logged yet — log them in the Tape Tracker to include them in future audits.`
      : "",
    "",
    "Click **Apply Plan** to update your body & training targets (and review any cross-section sync).",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply, plan };
}

/* ───────────────────── 5. NUTRITION CHECK AI COACH ───────────────────── */

function generateNutritionCoach(
  message: string,
  ctx: UnifiedUserFitnessContext,
  hints?: ModuleClientHints,
): { reply: string; plan: NutritionPlan } {
  const m = message.toLowerCase();
  const isVegan = /vegan/.test(m) || hints?.dietPreference === "vegan";
  const isVeg = !isVegan && (/vegetarian|veg\b|paneer|tofu/.test(m) || hints?.dietPreference === "vegetarian");
  const isIndian = /indian|dal|roti|dosa|idli|paneer|rajma|chana/.test(m) || hints?.dietPreference === "indian";

  const dietStyle: NutritionPlan["dietStyle"] =
    isVegan ? "vegan"
    : isIndian ? "indian"
    : isVeg ? "vegetarian"
    : "non_vegetarian";

  const crossSync = detectGoalShift(message, ctx);
  const cals = crossSync?.calorieTarget ?? ( /cut|fat loss|deficit/.test(m) ? Math.max(1500, ctx.nutrition.caloriesTarget - 350) : /bulk|surplus|gain/.test(m) ? ctx.nutrition.caloriesTarget + 300 : ctx.nutrition.caloriesTarget );
  const protein = crossSync?.proteinTarget ?? ctx.nutrition.proteinTarget;
  const fat = crossSync?.fatTarget ?? Math.round((cals * 0.25) / 9);
  const carbs = crossSync?.carbsTarget ?? Math.max(60, Math.round((cals - protein * 4 - fat * 9) / 4));
  const waterMl = Math.max(2500, Math.round(ctx.weightKg * 42));

  // Build meals from real local FOOD_DATABASE & ONT_CORE_FOODS
  const indianMatches = FOOD_DATABASE.filter((f) => {
    if (isVegan && !f.isVegan) return false;
    if (isVeg && !f.isVegetarian) return false;
    return f.isHighProtein || f.category === "grain_bread" || f.category === "dairy";
  });

  const oats = scaleNutrients(ONT_CORE_FOODS[0].per100g, 80);
  const banana = scaleNutrients(ONT_CORE_FOODS[8].per100g, 120);
  const paneer = indianMatches.find((f) => f.id === "paneer_raw") ?? indianMatches[0];
  const chicken = ONT_CORE_FOODS.find((f) => f.id === "ont-chicken-breast") ?? ONT_CORE_FOODS[3];
  const rice = ONT_CORE_FOODS.find((f) => f.id === "ont-brown-rice") ?? ONT_CORE_FOODS[1];
  const yogurt = ONT_CORE_FOODS.find((f) => f.id === "ont-greek-yogurt") ?? ONT_CORE_FOODS[4];

  const meals: NutritionPlan["meals"] = [
    {
      slot: "breakfast",
      label: "Breakfast",
      items: [
        {
          name: isIndian ? "Moong Dal Chilla / Besan Cheela" : "Rolled Oats & Chia Bowl",
          serving: isIndian ? "2 chillas (160g)" : "80g dry oats",
          calories: Math.round(oats.kcal + 60),
          protein: Math.round(oats.protein + (isVegan ? 14 : 18)),
          carbs: Math.round(oats.carbs),
          fat: Math.round(oats.fat + 3),
          substitute: "Overnight oats with soy/whey isolate",
        },
        {
          name: "Banana",
          serving: "1 medium (120g)",
          calories: Math.round(banana.kcal),
          protein: Math.round(banana.protein),
          carbs: Math.round(banana.carbs),
          fat: Math.round(banana.fat),
        },
      ],
    },
    {
      slot: "lunch",
      label: "Lunch",
      items: [
        isVeg || isVegan || isIndian
          ? {
              name: isVegan ? "Tofu & Chickpea Masala Bowl" : paneer?.name ?? "Low-Fat Paneer Bhurji",
              serving: paneer?.servingUnit ?? "150g",
              calories: Math.round(paneer?.calories ?? 198),
              protein: Math.round(paneer?.protein ?? 21),
              carbs: Math.round(paneer?.carbs ?? 4),
              fat: Math.round(paneer?.fat ?? 11),
              substitute: "Soya chunks curry (50g dry)",
            }
          : {
              name: chicken.name,
              serving: "180g grilled",
              calories: Math.round(scaleNutrients(chicken.per100g, 180).kcal),
              protein: Math.round(scaleNutrients(chicken.per100g, 180).protein),
              carbs: 0,
              fat: Math.round(scaleNutrients(chicken.per100g, 180).fat),
              substitute: "Grilled salmon or 150g paneer",
            },
        {
          name: isIndian ? "Steamed Rice / 2 Whole Wheat Rotis" : rice.name,
          serving: "200g cooked",
          calories: Math.round(scaleNutrients(rice.per100g, 200).kcal),
          protein: Math.round(scaleNutrients(rice.per100g, 200).protein),
          carbs: Math.round(scaleNutrients(rice.per100g, 200).carbs),
          fat: Math.round(scaleNutrients(rice.per100g, 200).fat),
        },
      ],
    },
    {
      slot: "pre_workout",
      label: "Pre / Post-Workout",
      items: [
        {
          name: isVegan ? "Pea + Rice Protein Shake & Dates" : `${yogurt.name} + Whey Isolate`,
          serving: "200g bowl + 1 scoop",
          calories: Math.round(scaleNutrients(yogurt.per100g, 200).kcal + 120),
          protein: Math.round(scaleNutrients(yogurt.per100g, 200).protein + 24),
          carbs: Math.round(scaleNutrients(yogurt.per100g, 200).carbs + 12),
          fat: Math.round(scaleNutrients(yogurt.per100g, 200).fat),
          substitute: "Roasted chana (50g) + soy milk",
        },
      ],
    },
    {
      slot: "dinner",
      label: "Dinner",
      items: [
        {
          name: isVegan ? "Lentil Dal & Quinoa Stir-Fry" : isVeg || isIndian ? "Dal Tadka + Grilled Paneer / Curd" : "Salmon Fillet & Roasted Vegetables",
          serving: "1 balanced plate",
          calories: Math.max(380, Math.round(cals * 0.28)),
          protein: Math.max(28, Math.round(protein * 0.28)),
          carbs: Math.round(carbs * 0.28),
          fat: Math.round(fat * 0.3),
        },
      ],
    },
  ];

  const groceryList = [
    isVegan ? "Firm tofu (400g) & soya chunks" : isVeg ? "Low-fat paneer (400g) & Greek yogurt" : "Chicken breast / salmon & Greek yogurt",
    "Rolled oats & brown rice / whole wheat atta",
    "Moong dal / lentils & chickpeas",
    "Bananas, spinach, broccoli, tomatoes, onions",
    isVegan ? "Plant protein powder & chia seeds" : "Whey isolate & almonds",
  ];

  const plan: NutritionPlan = {
    kind: "nutrition",
    title: `${dietStyle.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} ${cals} kcal Meal Plan`,
    dietStyle,
    goal: ctx.goal,
    disclaimer: "Estimated daily calorie & macro targets for general fitness planning — not medical or clinical dietary advice.",
    dailyTargets: {
      calories: cals,
      protein,
      carbs,
      fat,
      waterMl,
    },
    summary: `Calibrated around your ${ctx.weightKg}kg bodyweight, today's logged intake (${ctx.nutrition.caloriesConsumed} kcal / ${ctx.nutrition.proteinConsumed}g P), and ${ctx.activeProgram?.daysPerWeek ?? 4}×/week training schedule.`,
    meals,
    groceryList,
    hydrationPlan: `Target ${(waterMl / 1000).toFixed(1)}L daily (${ctx.nutrition.waterConsumedMl} ml logged today). Drink 500ml on waking and 500ml around training.`,
    crossSync,
  };

  const proteinLeft = Math.max(0, protein - ctx.nutrition.proteinConsumed);
  const reply = [
    `**${plan.title}** *(Estimated Fitness Targets — Non-Medical)*`,
    "",
    `- **Today's Snapshot:** ${ctx.nutrition.caloriesConsumed} / ${cals} kcal · **${ctx.nutrition.proteinConsumed}g / ${protein}g** protein (${proteinLeft}g remaining) · ${ctx.nutrition.waterConsumedMl}ml water.`,
    `- **Diet Style:** ${dietStyle.replace("_", " ")} with built-in food substitutions and a ready-to-shop grocery list.`,
    crossSync ? `- **Cross-Section Sync Available:** ${crossSync.summary}` : "",
    "",
    "Click **Apply Plan** to update your Nutrition targets and log today's planned meals directly.",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply, plan };
}

/* ───────────────────── DRAFT-AWARE FOLLOW-UP MUTATION ───────────────────── */

function tryMutateExistingDraft(
  module: AiModule,
  message: string,
  draft: AnyAiPlan | null | undefined,
  ctx: UnifiedUserFitnessContext,
): { reply: string; plan: AnyAiPlan } | null {
  if (!draft || draft.kind !== module) return null;
  const m = message.toLowerCase();

  // 1. Schedule follow-up: "Make Wednesday a recovery day" / "Make Friday rest"
  if (draft.kind === "schedule") {
    const dayMatch = m.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const wantsRecovery = /recovery|rest|off|mobility/.test(m);
    if (dayMatch && wantsRecovery) {
      const targetDayName = dayMatch[1];
      const updatedDays = draft.days.map((d) =>
        d.dayLabel.toLowerCase() === targetDayName
          ? {
              ...d,
              isRest: true,
              routineName: "Active Recovery & Mobility",
              focus: "Zone-2 walk (25 min) + hip/thoracic flow",
              durationMin: 25,
              intensity: "recovery" as const,
              exercises: [],
            }
          : d,
      );
      const trainingDaysCount = updatedDays.filter((d) => !d.isRest).length;
      const updated: WarmupSchedulePlan = {
        ...draft,
        daysPerWeek: Math.max(1, trainingDaysCount),
        days: updatedDays,
        rebalanceNote: `Updated ${targetDayName.charAt(0).toUpperCase() + targetDayName.slice(1)} to an active recovery day while preserving the rest of your ${draft.title}.`,
      };
      return {
        reply: `Updated your existing **${draft.title}** draft: **${targetDayName.charAt(0).toUpperCase() + targetDayName.slice(1)}** is now an **Active Recovery & Mobility** day (${trainingDaysCount} training days remaining). Review and click **Apply Plan** when ready.`,
        plan: updated,
      };
    }
  }

  // 2. Workout follow-up: "Replace <exercise>" / "Swap <exercise>"
  if (draft.kind === "workout" && /\b(replace|swap|substitute|change)\b/.test(m)) {
    const targetIdx = draft.exercises.findIndex((ex) => {
      const tokens = ex.name.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      return m.includes(ex.name.toLowerCase()) || tokens.some((t) => m.includes(t));
    });
    const idxToSwap = targetIdx >= 0 ? targetIdx : /first|1st/.test(m) ? 0 : -1;
    if (idxToSwap >= 0) {
      const oldEx = draft.exercises[idxToSwap];
      const alt =
        FULL_EXERCISE_CATALOG.find(
          (cand) =>
            cand.id !== oldEx.exerciseId &&
            cand.primaryMuscle === oldEx.primaryMuscle &&
            cand.equipment !== oldEx.equipment &&
            (ctx.equipment.includes(cand.equipment) || cand.equipment === "bodyweight"),
        ) ??
        FULL_EXERCISE_CATALOG.find((cand) => cand.id !== oldEx.exerciseId && cand.primaryMuscle === oldEx.primaryMuscle);

      if (alt) {
        const nextExercises = draft.exercises.map((ex, i) =>
          i === idxToSwap
            ? {
                ...ex,
                exerciseId: alt.id,
                name: alt.name,
                equipment: alt.equipment,
                notes: `Swapped in place of ${oldEx.name} (${alt.equipment}).`,
              }
            : ex,
        );
        const updated: WorkoutPlan = {
          ...draft,
          exercises: nextExercises,
        };
        return {
          reply: `Replaced **${oldEx.name}** with **${alt.name}** (${alt.equipment}) inside your **${draft.title}** draft while keeping your remaining ${nextExercises.length - 1} exercises intact.`,
          plan: updated,
        };
      }
    }
  }

  // 3. Workout duration follow-up: "Make it 30 minutes" / "Compress to 25 min"
  if (draft.kind === "workout" && /\b(\d{2,3})[\s-]*min/.test(m) && !/\bbuild|create|generate|new\b/.test(m)) {
    const mins = Math.max(15, Math.min(120, Number(m.match(/\b(\d{2,3})[\s-]*min/)?.[1] ?? draft.durationMin)));
    const trimmed = mins <= 30 ? draft.exercises.slice(0, 3) : draft.exercises;
    const updated: WorkoutPlan = {
      ...draft,
      durationMin: mins,
      exercises: trimmed.map((e) => ({ ...e, restSec: mins <= 30 ? Math.min(60, e.restSec) : e.restSec })),
    };
    return {
      reply: `Adjusted **${draft.title}** to **${mins} minutes** (${updated.exercises.length} exercises, tighter rest intervals). Click **Apply Plan** to launch it.`,
      plan: updated,
    };
  }

  return null;
}

/* ───────────────────── UNIFIED ENTRYPOINT ───────────────────── */

export async function generateModuleCoachResponse(params: {
  module: AiModule;
  message: string;
  context: UnifiedUserFitnessContext;
  hints?: ModuleClientHints;
  activeDraftPlan?: AnyAiPlan | null;
}): Promise<CoachGenerationResult> {
  const { module, message, context, hints, activeDraftPlan } = params;

  const mutated = tryMutateExistingDraft(module, message, activeDraftPlan, context);
  const generated: { reply: string; plan: AnyAiPlan } =
    mutated ??
    (module === "schedule"
      ? generateScheduleCoach(message, context, hints)
      : module === "workout"
        ? generateWorkoutCoach(message, context)
        : module === "exercise"
          ? generateExerciseCoach(message, context, hints)
          : module === "body"
            ? generateBodyCoach(message, context, hints)
            : generateNutritionCoach(message, context, hints));

  const validated = validateAndNormalizeAiPlan(module, generated.plan);
  const validPlan = validated.ok ? validated.plan : null;

  const systemPrompt = `You are Forge Fitness's ${module.toUpperCase()} AI Coach. User: ${context.firstName}, Goal: ${context.goal}, Weight: ${context.weightKg}kg, Readiness: ${context.readiness}/100, Calories today: ${context.nutrition.caloriesConsumed}/${context.nutrition.caloriesTarget} kcal, Protein: ${context.nutrition.proteinConsumed}/${context.nutrition.proteinTarget}g. Never invent unrecorded body measurements. Keep response concise, actionable, and grounded in their real stats.`;

  const completion = await generateWithConfiguredProvider({
    module,
    systemPrompt,
    userPrompt: `${message}\n\nStructured Plan Title: ${validPlan?.title ?? "N/A"}`,
    deterministicReply: generated.reply,
  });

  return {
    reply: completion.text,
    plan: validPlan,
    provider: completion.provider,
    model: completion.model,
    latencyMs: completion.latencyMs,
    tokensEstimated: completion.tokensEstimated,
    fallbackUsed: completion.fallbackUsed,
    mutatedExistingDraft: Boolean(mutated),
  };
}
