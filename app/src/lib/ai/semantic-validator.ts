import {
  computeWeeklyMuscleVolume,
  estimateWorkoutDurationMin,
  isExerciseContraindicated,
  matchesAllergenConstraint,
  matchesDietHardConstraint,
  validateMuscleRecoverySpacing,
  type DietType,
  type ExperienceLevel,
} from "@/lib/fitness";
import { FOOD_DATABASE } from "@/lib/food-db";
import { CATALOG_BY_ID } from "@/lib/opengym-catalog";
import type { AnyAiPlan } from "./schemas";

export type SemanticCode =
  | "EX_UNKNOWN"
  | "EX_EQUIPMENT"
  | "EX_INJURY"
  | "VOL_BELOW_MEV"
  | "VOL_ABOVE_MRV"
  | "FREQ_RECOVERY"
  | "DUR_EXCEEDS"
  | "NUT_BELOW_FLOOR"
  | "NUT_MACRO_MISMATCH"
  | "NUT_DIET_VIOLATION"
  | "NUT_ALLERGEN_VIOLATION"
  | "XSEC_STALE_CONTEXT";

export interface SemanticIssue {
  severity: "error" | "warning";
  code: SemanticCode;
  path: string;
  message: string;
}

export interface SemanticValidationContext {
  sex: "male" | "female";
  experience: ExperienceLevel;
  equipment: string[];
  injuries?: string[];
  diet?: DietType;
  allergens?: string[];
  maxSessionMin?: number;
}

export interface SemanticValidationResult {
  valid: boolean;
  errors: SemanticIssue[];
  warnings: SemanticIssue[];
}

export function validatePlanSemantically(
  plan: AnyAiPlan,
  ctx: SemanticValidationContext,
): SemanticValidationResult {
  const issues: SemanticIssue[] = [];
  const injuries = ctx.injuries ?? [];
  const equipSet = new Set(ctx.equipment.map((e) => e.toLowerCase()));

  if (plan.kind === "schedule") {
    const daySchedule: Array<{ dayIndex: number; label: string; primaryMuscles: string[] }> = [];
    const sessionsForVolume: Array<{
      exercises: Array<{ primaryMuscle: string; secondaryMuscles?: string[]; sets: number }>;
    }> = [];

    for (let dIdx = 0; dIdx < plan.days.length; dIdx++) {
      const day = plan.days[dIdx];
      if (day.isRest || day.exercises.length === 0) continue;

      const dayMuscles: string[] = [];
      const dayVolExercises: Array<{ primaryMuscle: string; secondaryMuscles?: string[]; sets: number }> = [];
      const durExercises: Array<{ sets: number; restSec: number }> = [];

      for (let eIdx = 0; eIdx < day.exercises.length; eIdx++) {
        const slot = day.exercises[eIdx];
        const path = `days[${dIdx}].exercises[${eIdx}]`;
        const cat = CATALOG_BY_ID.get(slot.exerciseId);

        if (!cat) {
          issues.push({
            severity: "error",
            code: "EX_UNKNOWN",
            path,
            message: `Exercise "${slot.exerciseId}" (${slot.name}) is not in the verified catalog.`,
          });
          continue;
        }

        if (equipSet.size > 0 && cat.equipment !== "bodyweight" && !equipSet.has(cat.equipment.toLowerCase())) {
          issues.push({
            severity: "error",
            code: "EX_EQUIPMENT",
            path,
            message: `${cat.name} requires "${cat.equipment}" which is not in user's available equipment.`,
          });
        }

        const inj = isExerciseContraindicated(cat, injuries);
        if (inj.contraindicated && inj.reason) {
          issues.push({
            severity: "error",
            code: "EX_INJURY",
            path,
            message: inj.reason,
          });
        }

        dayMuscles.push(cat.primaryMuscle);
        dayVolExercises.push({
          primaryMuscle: cat.primaryMuscle,
          secondaryMuscles: cat.secondaryMuscles,
          sets: slot.sets,
        });
        durExercises.push({ sets: slot.sets, restSec: slot.restSec });
      }

      daySchedule.push({ dayIndex: day.weekday, label: day.routineName, primaryMuscles: dayMuscles });
      sessionsForVolume.push({ exercises: dayVolExercises });

      const estMin = estimateWorkoutDurationMin(durExercises);
      if (estMin > day.durationMin + 20) {
        issues.push({
          severity: "warning",
          code: "DUR_EXCEEDS",
          path: `days[${dIdx}].durationMin`,
          message: `${day.routineName} estimated at ~${estMin} min, exceeding ${day.durationMin} min target.`,
        });
      }
    }

    const spacing = validateMuscleRecoverySpacing(daySchedule);
    for (const v of spacing.violations) {
      issues.push({
        severity: "warning",
        code: "FREQ_RECOVERY",
        path: "days",
        message: v.message,
      });
    }

    const vol = computeWeeklyMuscleVolume(sessionsForVolume, ctx.experience);
    for (const m of vol.muscles) {
      if (m.status === "over_mrv") {
        issues.push({
          severity: "error",
          code: "VOL_ABOVE_MRV",
          path: "days",
          message: `${m.muscle} weekly volume (${m.effectiveSets} sets) exceeds ${ctx.experience} MRV.`,
        });
      } else if (m.status === "below_mev") {
        issues.push({
          severity: "warning",
          code: "VOL_BELOW_MEV",
          path: "days",
          message: `${m.muscle} weekly volume (${m.effectiveSets} sets) is below ${ctx.experience} MEV.`,
        });
      }
    }
  }

  if (plan.kind === "workout") {
    const durExercises: Array<{ sets: number; restSec: number }> = [];
    for (let i = 0; i < plan.exercises.length; i++) {
      const ex = plan.exercises[i];
      const path = `exercises[${i}]`;
      const cat = CATALOG_BY_ID.get(ex.exerciseId);
      if (!cat) {
        issues.push({
          severity: "error",
          code: "EX_UNKNOWN",
          path,
          message: `Exercise "${ex.exerciseId}" (${ex.name}) is not in the verified catalog.`,
        });
        continue;
      }
      if (equipSet.size > 0 && cat.equipment !== "bodyweight" && !equipSet.has(cat.equipment.toLowerCase())) {
        issues.push({
          severity: "error",
          code: "EX_EQUIPMENT",
          path,
          message: `${cat.name} requires "${cat.equipment}" which is not in user's available equipment.`,
        });
      }
      const inj = isExerciseContraindicated(cat, injuries);
      if (inj.contraindicated && inj.reason) {
        issues.push({
          severity: "error",
          code: "EX_INJURY",
          path,
          message: inj.reason,
        });
      }
      durExercises.push({ sets: ex.sets, restSec: ex.restSec });
    }
    const estMin = estimateWorkoutDurationMin(durExercises);
    const maxMin = ctx.maxSessionMin ?? plan.durationMin;
    if (estMin > maxMin + 15) {
      issues.push({
        severity: "warning",
        code: "DUR_EXCEEDS",
        path: "durationMin",
        message: `Estimated session duration (~${estMin} min) exceeds target (${maxMin} min) by >15 min.`,
      });
    }
  }

  if (plan.kind === "exercise") {
    const cat = CATALOG_BY_ID.get(plan.exerciseId);
    if (!cat) {
      issues.push({
        severity: "error",
        code: "EX_UNKNOWN",
        path: "exerciseId",
        message: `Exercise "${plan.exerciseId}" is not in the verified catalog.`,
      });
    } else {
      const inj = isExerciseContraindicated(cat, injuries);
      if (inj.contraindicated && inj.reason) {
        issues.push({
          severity: "error",
          code: "EX_INJURY",
          path: "exerciseId",
          message: inj.reason,
        });
      }
    }
  }

  if (plan.kind === "nutrition") {
    const floor = ctx.sex === "female" ? 1200 : 1500;
    if (plan.dailyTargets.calories < floor) {
      issues.push({
        severity: "error",
        code: "NUT_BELOW_FLOOR",
        path: "dailyTargets.calories",
        message: `Daily calories (${plan.dailyTargets.calories} kcal) fall below the safe floor of ${floor} kcal.`,
      });
    }
    const macroKcal =
      plan.dailyTargets.protein * 4 +
      plan.dailyTargets.carbs * 4 +
      plan.dailyTargets.fat * 9;
    const diffRatio = Math.abs(macroKcal - plan.dailyTargets.calories) / Math.max(1, plan.dailyTargets.calories);
    if (diffRatio > 0.05) {
      issues.push({
        severity: "warning",
        code: "NUT_MACRO_MISMATCH",
        path: "dailyTargets",
        message: `Macro sum (${macroKcal} kcal) differs by ${Math.round(diffRatio * 100)}% from calorie target (${plan.dailyTargets.calories} kcal).`,
      });
    }

    const diet = ctx.diet;
    const allergens = ctx.allergens ?? [];
    for (let mIdx = 0; mIdx < plan.meals.length; mIdx++) {
      const slot = plan.meals[mIdx];
      for (let iIdx = 0; iIdx < slot.items.length; iIdx++) {
        const item = slot.items[iIdx];
        const path = `meals[${mIdx}].items[${iIdx}]`;
        const dbMatch = FOOD_DATABASE.find(
          (f) => f.name.toLowerCase() === item.name.toLowerCase(),
        );
        const pseudoFood = dbMatch ?? {
          id: "custom",
          name: item.name,
          category: "staple" as const,
          region: "global" as const,
          servingSize: 1,
          servingUnit: item.serving,
          servingGrams: 100,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          isVegetarian: !/\b(chicken|fish|egg|meat|tuna|mutton|prawn)\b/i.test(item.name),
          isVegan: !/\b(chicken|fish|egg|meat|tuna|mutton|prawn|paneer|milk|curd|dahi|yogurt|whey|ghee|cheese)\b/i.test(item.name),
          isHighProtein: item.protein >= 15,
        };

        if (diet && !matchesDietHardConstraint(pseudoFood, diet)) {
          issues.push({
            severity: "error",
            code: "NUT_DIET_VIOLATION",
            path,
            message: `"${item.name}" violates ${diet} diet constraint.`,
          });
        }
        if (allergens.length > 0 && !matchesAllergenConstraint(pseudoFood, allergens)) {
          issues.push({
            severity: "error",
            code: "NUT_ALLERGEN_VIOLATION",
            path,
            message: `"${item.name}" conflicts with reported allergen(s): ${allergens.join(", ")}.`,
          });
        }
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return { valid: errors.length === 0, errors, warnings };
}

export function computePlanDiff(prev: AnyAiPlan, next: AnyAiPlan): string[] {
  const diffs: string[] = [];
  if (prev.title !== next.title) {
    diffs.push(`Title changed: "${prev.title}" -> "${next.title}"`);
  }
  if (prev.kind === "schedule" && next.kind === "schedule") {
    if (prev.daysPerWeek !== next.daysPerWeek) {
      diffs.push(`Training days/week: ${prev.daysPerWeek} -> ${next.daysPerWeek}`);
    }
    if (prev.days.length !== next.days.length) {
      diffs.push(`Schedule days count: ${prev.days.length} -> ${next.days.length}`);
    }
  } else if (prev.kind === "workout" && next.kind === "workout") {
    if (prev.durationMin !== next.durationMin) {
      diffs.push(`Duration: ${prev.durationMin}m -> ${next.durationMin}m`);
    }
    if (prev.exercises.length !== next.exercises.length) {
      diffs.push(`Exercise count: ${prev.exercises.length} -> ${next.exercises.length}`);
    }
  } else if (prev.kind === "nutrition" && next.kind === "nutrition") {
    if (prev.dailyTargets.calories !== next.dailyTargets.calories) {
      diffs.push(`Calories: ${prev.dailyTargets.calories} -> ${next.dailyTargets.calories} kcal`);
    }
    if (prev.dailyTargets.protein !== next.dailyTargets.protein) {
      diffs.push(`Protein: ${prev.dailyTargets.protein}g -> ${next.dailyTargets.protein}g`);
    }
  }
  if (diffs.length === 0) {
    diffs.push("Updated plan parameters or item details.");
  }
  return diffs;
}
