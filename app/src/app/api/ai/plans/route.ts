import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { dateKey } from "@/lib/date";
import { readinessScore } from "@/lib/engine";
import type { DietType, ExperienceLevel } from "@/lib/fitness";
import { CATALOG_BY_ID, resolveCatalogId } from "@/lib/opengym-catalog";
import {
  AiModuleSchema,
  CrossSyncProposalSchema,
  validateAndNormalizeAiPlan,
  type AnyAiPlan,
} from "@/lib/ai/schemas";
import { computePlanDiff, validatePlanSemantically } from "@/lib/ai/semantic-validator";

const rid = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;

function ensureExerciseExistsSync(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  exerciseId: string,
  fallbackName?: string,
) {
  const found = tx
    .select({ id: schema.exercises.id })
    .from(schema.exercises)
    .where(eq(schema.exercises.id, exerciseId))
    .limit(1)
    .all();
  if (found.length > 0) return exerciseId;

  const catalogEx = CATALOG_BY_ID.get(exerciseId) ?? CATALOG_BY_ID.get(resolveCatalogId(exerciseId));
  tx.insert(schema.exercises)
    .values(
      catalogEx
        ? {
            id: exerciseId,
            slug: `${catalogEx.slug}-${exerciseId}`.slice(0, 80),
            name: catalogEx.name,
            primaryMuscle: catalogEx.primaryMuscle,
            secondaryMuscles: catalogEx.secondaryMuscles,
            equipment: catalogEx.equipment,
            category: catalogEx.category,
            pattern: catalogEx.pattern,
            unilateral: catalogEx.unilateral,
            difficulty: catalogEx.difficulty,
            instructions: catalogEx.instructions,
            cues: catalogEx.cues,
            tempo: catalogEx.tempo,
            popularity: catalogEx.popularity,
          }
        : {
            id: exerciseId,
            slug: `ai-${exerciseId}`.slice(0, 80),
            name: fallbackName || "AI Exercise",
            primaryMuscle: "chest",
            secondaryMuscles: [],
            equipment: "bodyweight",
            category: "strength",
            pattern: "horizontal_push",
            unilateral: false,
            difficulty: "intermediate",
            instructions: ["Perform controlled reps with clean form."],
            cues: ["Maintain control throughout the full range of motion."],
            tempo: "2-0-1",
            popularity: 50,
          },
    )
    .onConflictDoNothing()
    .run();
  return exerciseId;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId")?.trim();
  const includeVersions = searchParams.get("versions") === "1";

  if (planId && includeVersions) {
    const [plan] = await db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.id, planId), eq(schema.aiPlans.userId, user.id)))
      .limit(1);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    const versions = await db
      .select()
      .from(schema.aiPlanVersions)
      .where(eq(schema.aiPlanVersions.planId, planId))
      .orderBy(asc(schema.aiPlanVersions.versionNo));

    const formatted = versions.map((v, idx) => {
      const parsedPayload = JSON.parse(v.payloadJson) as AnyAiPlan;
      const prevPayload = idx > 0 ? (JSON.parse(versions[idx - 1].payloadJson) as AnyAiPlan) : null;
      return {
        id: v.id,
        versionNo: v.versionNo,
        changeSummary: v.changeSummary,
        createdBy: v.createdBy,
        createdAt: new Date(v.createdAt).getTime(),
        appliedAt: v.appliedAt ? new Date(v.appliedAt).getTime() : null,
        diffsFromPrev: prevPayload ? computePlanDiff(prevPayload, parsedPayload) : ["Initial version"],
        payload: parsedPayload,
      };
    });

    return NextResponse.json({ ok: true, planId, versions: formatted });
  }

  const modFilter = searchParams.get("module");
  const statusFilter = searchParams.get("status");
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const rows = await db
    .select()
    .from(schema.aiPlans)
    .where(eq(schema.aiPlans.userId, user.id))
    .orderBy(desc(schema.aiPlans.createdAt))
    .limit(100);

  const filtered = rows
    .filter((r) => (!modFilter || modFilter === "all" ? true : r.module === modFilter))
    .filter((r) => (!statusFilter || statusFilter === "all" ? true : r.status === statusFilter))
    .filter((r) => (!q ? true : r.title.toLowerCase().includes(q) || r.module.toLowerCase().includes(q)))
    .map((r) => ({
      id: r.id,
      module: r.module,
      title: r.title,
      version: r.version,
      currentVersionId: r.currentVersionId,
      parentPlanId: r.parentPlanId,
      provider: r.provider,
      status: r.status,
      plan: JSON.parse(r.planJson) as AnyAiPlan,
      createdAt: new Date(r.createdAt).getTime(),
      appliedAt: r.appliedAt ? new Date(r.appliedAt).getTime() : null,
    }));

  return NextResponse.json({ plans: filtered });
}

const ActionBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("apply_plan"),
    module: AiModuleSchema,
    planId: z.string().optional(),
    applyToken: z.string().min(4).max(120).optional(),
    plan: z.unknown(),
    applyCrossSync: z.boolean().optional(),
    skipEquipmentCheck: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("update_plan"),
    module: AiModuleSchema,
    planId: z.string(),
    plan: z.unknown(),
  }),
  z.object({
    action: z.literal("delete_plan"),
    planId: z.string(),
  }),
  z.object({
    action: z.literal("archive_plan"),
    planId: z.string(),
  }),
  z.object({
    action: z.literal("duplicate_plan"),
    planId: z.string(),
  }),
  z.object({
    action: z.literal("restore_plan"),
    planId: z.string(),
  }),
  z.object({
    action: z.literal("apply_cross_sync"),
    crossSync: CrossSyncProposalSchema,
  }),
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ActionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const body = parsed.data;

  if (body.action === "delete_plan") {
    const [existing] = await db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });
    await db.delete(schema.aiPlans).where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "archive_plan") {
    const [existing] = await db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });
    await db
      .update(schema.aiPlans)
      .set({ status: "archived" })
      .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)));
    return NextResponse.json({ ok: true, status: "archived" });
  }

  if (body.action === "duplicate_plan" || body.action === "restore_plan") {
    const [source] = await db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)))
      .limit(1);
    if (!source) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });

    const latest = await db
      .select({ version: schema.aiPlans.version })
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.userId, user.id), eq(schema.aiPlans.module, source.module)))
      .orderBy(desc(schema.aiPlans.version))
      .limit(1);
    const nextVersion = (latest[0]?.version ?? 0) + 1;
    const newId = rid("aip");
    const verId = rid("apv");
    const parsedPlan = JSON.parse(source.planJson) as AnyAiPlan;
    const nextTitle = body.action === "duplicate_plan" ? `${source.title} (Copy)` : source.title;
    const nextPlanJson = JSON.stringify({ ...parsedPlan, title: nextTitle });

    db.transaction((tx) => {
      tx.insert(schema.aiPlans)
        .values({
          id: newId,
          userId: user.id,
          module: source.module,
          title: nextTitle,
          version: nextVersion,
          currentVersionId: verId,
          parentPlanId: source.id,
          provider: source.provider,
          status: "draft",
          planJson: nextPlanJson,
          createdAt: new Date(),
          appliedAt: null,
        })
        .run();
      tx.insert(schema.aiPlanVersions)
        .values({
          id: verId,
          planId: newId,
          versionNo: 1,
          payloadJson: nextPlanJson,
          schemaVersion: "2.0",
          changeSummary: body.action === "restore_plan" ? `Restored from "${source.title}"` : `Duplicated from "${source.title}"`,
          createdBy: "user",
          createdAt: new Date(),
          appliedAt: null,
        })
        .run();
    });

    return NextResponse.json({
      ok: true,
      planId: newId,
      version: nextVersion,
      plan: JSON.parse(nextPlanJson) as AnyAiPlan,
      message: body.action === "restore_plan" ? `Restored "${source.title}" as draft v${nextVersion}.` : `Duplicated as v${nextVersion}.`,
    });
  }

  if (body.action === "apply_cross_sync") {
    const cs = body.crossSync;
    db.transaction((tx) => {
      if (cs.goalUpdate) {
        tx.update(schema.users).set({ goal: cs.goalUpdate }).where(eq(schema.users.id, user.id)).run();
      }
      if (cs.calorieTarget || cs.proteinTarget) {
        const cur = tx.select().from(schema.macroTargets).where(eq(schema.macroTargets.userId, user.id)).limit(1).all()[0];
        const nextTargets = {
          calories: cs.calorieTarget ?? cur?.calories ?? 2600,
          protein: cs.proteinTarget ?? cur?.protein ?? 170,
          carbs: cs.carbsTarget ?? cur?.carbs ?? 290,
          fat: cs.fatTarget ?? cur?.fat ?? 75,
          waterMl: cs.waterTargetMl ?? cur?.waterMl ?? 3200,
        };
        if (cur) {
          tx.update(schema.macroTargets).set(nextTargets).where(eq(schema.macroTargets.userId, user.id)).run();
        } else {
          tx.insert(schema.macroTargets).values({ userId: user.id, ...nextTargets }).run();
        }
      }
    });
    revalidatePath("/app");
    revalidatePath("/app/programs");
    revalidatePath("/app/train");
    revalidatePath("/app/progress");
    revalidatePath("/app/nutrition");
    return NextResponse.json({ ok: true, message: "Cross-section goals & nutrition targets synchronized." });
  }

  const validated = validateAndNormalizeAiPlan(body.module, body.plan);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: `Validation failed: ${validated.error}` }, { status: 400 });
  }
  const plan: AnyAiPlan = validated.plan;

  if (body.action === "update_plan") {
    const [existing] = await db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: "Plan not found" }, { status: 404 });

    const prevPlan = JSON.parse(existing.planJson) as AnyAiPlan;
    const diffs = computePlanDiff(prevPlan, plan);
    const nextVersion = existing.version + 1;
    const verId = rid("apv");

    db.transaction((tx) => {
      tx.update(schema.aiPlans)
        .set({
          title: plan.title,
          version: nextVersion,
          currentVersionId: verId,
          planJson: JSON.stringify(plan),
        })
        .where(and(eq(schema.aiPlans.id, body.planId), eq(schema.aiPlans.userId, user.id)))
        .run();
      tx.insert(schema.aiPlanVersions)
        .values({
          id: verId,
          planId: body.planId,
          versionNo: nextVersion,
          payloadJson: JSON.stringify(plan),
          schemaVersion: "2.0",
          changeSummary: diffs.join("; "),
          createdBy: "user",
          createdAt: new Date(),
          appliedAt: null,
        })
        .onConflictDoNothing()
        .run();
    });

    return NextResponse.json({ ok: true, planId: body.planId, version: nextVersion, plan, diffs });
  }

  // Idempotency token check for apply_plan
  if (body.applyToken) {
    const existingToken = await db
      .select()
      .from(schema.aiApplyTokens)
      .where(and(eq(schema.aiApplyTokens.token, body.applyToken), eq(schema.aiApplyTokens.userId, user.id)))
      .limit(1);
    if (existingToken[0]) {
      return NextResponse.json({
        ...(JSON.parse(existingToken[0].resultJson) as Record<string, unknown>),
        deduped: true,
      });
    }
  }

  // Semantic validator gate
  const dietMap: Record<string, DietType> = {
    balanced: "non_veg",
    non_vegetarian: "non_veg",
    indian: "non_veg",
    vegetarian: "vegetarian",
    vegan: "vegan",
  };
  const semantic = validatePlanSemantically(plan, {
    sex: user.sex === "female" ? "female" : "male",
    experience: (["beginner", "intermediate", "advanced"].includes(user.experience)
      ? user.experience
      : "intermediate") as ExperienceLevel,
    equipment: body.skipEquipmentCheck
      ? []
      : Array.isArray(user.equipment)
        ? user.equipment
        : ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
    diet: plan.kind === "nutrition" ? dietMap[plan.dietStyle] : undefined,
  });

  if (!semantic.valid) {
    return NextResponse.json(
      {
        ok: false,
        error: semantic.errors.map((e) => `[${e.code}] ${e.message}`).join(" | "),
        validationIssues: [...semantic.errors, ...semantic.warnings],
      },
      { status: 422 },
    );
  }

  // action === "apply_plan": atomic SQLite transaction
  const txResult = db.transaction((tx) => {
    let redirectUrl: string | undefined;
    let appliedSummary = "";
    let clientPlanPatch: unknown = undefined;

    if (plan.kind === "schedule") {
      const routineId = rid("rt");
      tx.update(schema.routines).set({ enrolled: false }).where(eq(schema.routines.ownerId, user.id)).run();
      tx.insert(schema.routines)
        .values({
          id: routineId,
          ownerId: user.id,
          name: plan.title,
          subtitle: `${plan.daysPerWeek}d/wk · AI Schedule`,
          description: plan.summary,
          goal: user.goal || "hypertrophy",
          level: plan.level,
          daysPerWeek: plan.daysPerWeek,
          weeks: plan.horizon === "90d" ? 12 : plan.horizon === "60d" ? 8 : plan.horizon === "monthly" ? 4 : plan.horizon === "14d" ? 2 : 1,
          accent: "#C9F73A",
          isPublic: false,
          enrolled: true,
          rating: 5.0,
          members: 1,
          createdAt: new Date(),
        })
        .run();

      const trainingDays = plan.days.filter((d) => !d.isRest && d.exercises.length > 0);
      for (let idx = 0; idx < trainingDays.length; idx++) {
        const day = trainingDays[idx];
        const dayId = rid("rd");
        tx.insert(schema.routineDays)
          .values({
            id: dayId,
            routineId,
            dayIndex: idx,
            name: day.routineName,
            focus: day.focus,
          })
          .run();

        for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
          const ex = day.exercises[exIdx];
          ensureExerciseExistsSync(tx, ex.exerciseId, ex.name);
          tx.insert(schema.routineExercises)
            .values({
              id: rid("re"),
              routineDayId: dayId,
              exerciseId: ex.exerciseId,
              position: exIdx,
              sets: ex.sets,
              repsMin: ex.repsMin,
              repsMax: ex.repsMax,
              restSec: ex.restSec,
              rpeTarget: ex.rpeTarget,
              supersetGroup: null,
            })
            .run();
        }
      }

      const routinesPatch = trainingDays.map((d, idx) => ({
        id: `rt-ai-${routineId}-${idx}`,
        name: d.routineName,
        folder: "AI Generated Plans",
        glyph: (idx % 3 === 0 ? "barbell" : idx % 3 === 1 ? "pullup" : "legs") as "barbell" | "pullup" | "legs",
        color: "#C9F73A",
        favourite: idx === 0,
        progression: "double" as const,
        slots: d.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets,
          repsMin: e.repsMin,
          repsMax: e.repsMax,
          restSec: e.restSec,
          rpeTarget: e.rpeTarget,
          progression: "double" as const,
        })),
      }));

      const weekPatch: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      trainingDays.forEach((d, idx) => {
        weekPatch[d.weekday] = [routinesPatch[idx].id];
      });

      clientPlanPatch = {
        activeProgrammeId: routineId,
        scheduleMode: plan.scheduleMode,
        week: weekPatch,
        rotation: [...routinesPatch.map((r) => r.id), "rest"],
        routines: routinesPatch,
      };
      appliedSummary = `Saved "${plan.title}" (${trainingDays.length} sessions/week) to your active program & weekly schedule.`;
    } else if (plan.kind === "workout") {
      const existingActive = tx
        .select()
        .from(schema.workouts)
        .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
        .limit(1)
        .all()[0];

      if (existingActive) {
        redirectUrl = `/app/train/${existingActive.id}`;
        appliedSummary = `Active workout "${existingActive.name}" is already in progress — opening it now.`;
      } else {
        const metric = tx
          .select()
          .from(schema.bodyMetrics)
          .where(eq(schema.bodyMetrics.userId, user.id))
          .orderBy(desc(schema.bodyMetrics.date))
          .limit(1)
          .all()[0];
        const workoutId = rid("wk");
        tx.insert(schema.workouts)
          .values({
            id: workoutId,
            userId: user.id,
            routineId: "rt-ai-workout",
            name: plan.title,
            focus: plan.focus,
            status: "active",
            readiness: readinessScore(metric ?? {}),
            startedAt: new Date(),
            totalVolume: 0,
            totalSets: 0,
            notes: plan.summary,
            compressed: false,
          })
          .run();

        for (let i = 0; i < plan.exercises.length; i++) {
          const ex = plan.exercises[i];
          ensureExerciseExistsSync(tx, ex.exerciseId, ex.name);
          tx.insert(schema.workoutExercises)
            .values({
              id: rid("we"),
              workoutId,
              exerciseId: ex.exerciseId,
              position: i,
              targetSets: ex.sets,
              repsMin: ex.repsMin,
              repsMax: ex.repsMax,
              restSec: ex.restSec,
              rpeTarget: ex.rpeTarget,
              supersetGroup: null,
              notes: ex.notes || null,
            })
            .run();
        }
        redirectUrl = `/app/train/${workoutId}`;
        appliedSummary = `Created live workout "${plan.title}" with ${plan.exercises.length} exercises.`;
      }
    } else if (plan.kind === "exercise") {
      ensureExerciseExistsSync(tx, plan.exerciseId, plan.exerciseName);
      const active = tx
        .select()
        .from(schema.workouts)
        .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
        .limit(1)
        .all()[0];

      if (active) {
        const curItems = tx
          .select()
          .from(schema.workoutExercises)
          .where(eq(schema.workoutExercises.workoutId, active.id))
          .all();
        tx.insert(schema.workoutExercises)
          .values({
            id: rid("we"),
            workoutId: active.id,
            exerciseId: plan.exerciseId,
            position: curItems.length,
            targetSets: plan.prescription.sets,
            repsMin: 8,
            repsMax: 12,
            restSec: plan.prescription.restSec,
            rpeTarget: 8,
          })
          .run();
        appliedSummary = `Added ${plan.exerciseName} (${plan.prescription.sets} sets) to your active workout "${active.name}".`;
      } else {
        const routineId = rid("rt");
        const dayId = rid("rd");
        tx.insert(schema.routines)
          .values({
            id: routineId,
            ownerId: user.id,
            name: `${plan.exerciseName} Focus`,
            subtitle: "AI Exercise Progression",
            description: plan.progressionPlan,
            goal: user.goal || "hypertrophy",
            level: "Intermediate",
            daysPerWeek: 1,
            weeks: 4,
            accent: "#C9F73A",
            isPublic: false,
            enrolled: false,
            rating: 5.0,
            members: 1,
            createdAt: new Date(),
          })
          .run();
        tx.insert(schema.routineDays)
          .values({ id: dayId, routineId, dayIndex: 0, name: plan.exerciseName, focus: plan.primaryMuscle })
          .run();
        tx.insert(schema.routineExercises)
          .values({
            id: rid("re"),
            routineDayId: dayId,
            exerciseId: plan.exerciseId,
            position: 0,
            sets: plan.prescription.sets,
            repsMin: 8,
            repsMax: 12,
            restSec: plan.prescription.restSec,
            rpeTarget: 8,
          })
          .run();
        appliedSummary = `Saved ${plan.exerciseName} progression guide to your routines.`;
      }
    } else if (plan.kind === "body") {
      const today = dateKey();
      const existingMetric = tx
        .select()
        .from(schema.bodyMetrics)
        .where(and(eq(schema.bodyMetrics.userId, user.id), eq(schema.bodyMetrics.date, today)))
        .limit(1)
        .all()[0];
      if (!existingMetric) {
        tx.insert(schema.bodyMetrics)
          .values({
            id: rid("bm"),
            userId: user.id,
            date: today,
            weightKg: user.weightKg,
            sleepHours: plan.targets.targetSleepHours,
            soreness: 2,
          })
          .run();
      }
      appliedSummary = `Saved body targets (${plan.targets.weeklySessionsTarget} sessions/wk, ${plan.targets.targetSleepHours}h sleep target).`;
    } else if (plan.kind === "nutrition") {
      const curTargets = tx
        .select()
        .from(schema.macroTargets)
        .where(eq(schema.macroTargets.userId, user.id))
        .limit(1)
        .all()[0];
      const targetValues = {
        calories: plan.dailyTargets.calories,
        protein: plan.dailyTargets.protein,
        carbs: plan.dailyTargets.carbs,
        fat: plan.dailyTargets.fat,
        waterMl: plan.dailyTargets.waterMl,
      };
      if (curTargets) {
        tx.update(schema.macroTargets).set(targetValues).where(eq(schema.macroTargets.userId, user.id)).run();
      } else {
        tx.insert(schema.macroTargets).values({ userId: user.id, ...targetValues }).run();
      }

      const today = dateKey();
      let loggedCount = 0;
      for (const slot of plan.meals) {
        const mappedMeal = slot.slot === "pre_workout" || slot.slot === "post_workout" ? "snack" : slot.slot;
        for (const item of slot.items) {
          tx.insert(schema.nutritionLogs)
            .values({
              id: rid("nl"),
              userId: user.id,
              date: today,
              meal: mappedMeal,
              name: item.name,
              serving: item.serving,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              source: "recipe",
              createdAt: new Date(),
            })
            .run();
          loggedCount += 1;
        }
      }
      appliedSummary = `Updated daily macro targets (${targetValues.calories} kcal, ${targetValues.protein}g P) and logged ${loggedCount} planned meal items for today.`;
    }

    if (body.applyCrossSync && plan.crossSync) {
      if (plan.crossSync.goalUpdate) {
        tx.update(schema.users).set({ goal: plan.crossSync.goalUpdate }).where(eq(schema.users.id, user.id)).run();
      }
      if (plan.crossSync.calorieTarget || plan.crossSync.proteinTarget) {
        const cur = tx.select().from(schema.macroTargets).where(eq(schema.macroTargets.userId, user.id)).limit(1).all()[0];
        const next = {
          calories: plan.crossSync.calorieTarget ?? cur?.calories ?? 2600,
          protein: plan.crossSync.proteinTarget ?? cur?.protein ?? 170,
          carbs: plan.crossSync.carbsTarget ?? cur?.carbs ?? 290,
          fat: plan.crossSync.fatTarget ?? cur?.fat ?? 75,
          waterMl: plan.crossSync.waterTargetMl ?? cur?.waterMl ?? 3200,
        };
        if (cur) tx.update(schema.macroTargets).set(next).where(eq(schema.macroTargets.userId, user.id)).run();
        else tx.insert(schema.macroTargets).values({ userId: user.id, ...next }).run();
      }
    }

    let finalPlanId = body.planId;
    const now = new Date();
    const verId = rid("apv");

    if (finalPlanId) {
      const existingRow = tx
        .select()
        .from(schema.aiPlans)
        .where(and(eq(schema.aiPlans.id, finalPlanId), eq(schema.aiPlans.userId, user.id)))
        .limit(1)
        .all()[0];
      const verNo = (existingRow?.version ?? 1) + 1;

      tx.update(schema.aiPlans)
        .set({ status: "applied", appliedAt: now, currentVersionId: verId, version: verNo, planJson: JSON.stringify(plan) })
        .where(and(eq(schema.aiPlans.id, finalPlanId), eq(schema.aiPlans.userId, user.id)))
        .run();

      tx.insert(schema.aiPlanVersions)
        .values({
          id: verId,
          planId: finalPlanId,
          versionNo: verNo,
          payloadJson: JSON.stringify(plan),
          schemaVersion: "2.0",
          changeSummary: "Applied to workspace",
          createdBy: "user",
          createdAt: now,
          appliedAt: now,
        })
        .onConflictDoNothing()
        .run();
    } else {
      finalPlanId = rid("aip");
      tx.insert(schema.aiPlans)
        .values({
          id: finalPlanId,
          userId: user.id,
          module: body.module,
          title: plan.title,
          version: 1,
          currentVersionId: verId,
          parentPlanId: null,
          provider: "forge-engine",
          status: "applied",
          planJson: JSON.stringify(plan),
          createdAt: now,
          appliedAt: now,
        })
        .run();
      tx.insert(schema.aiPlanVersions)
        .values({
          id: verId,
          planId: finalPlanId,
          versionNo: 1,
          payloadJson: JSON.stringify(plan),
          schemaVersion: "2.0",
          changeSummary: "Created & applied",
          createdBy: "user",
          createdAt: now,
          appliedAt: now,
        })
        .run();
    }

    const responsePayload = {
      ok: true,
      planId: finalPlanId,
      summary: appliedSummary,
      redirectUrl,
      clientPlanPatch,
      warnings: semantic.warnings,
    };

    if (body.applyToken) {
      tx.insert(schema.aiApplyTokens)
        .values({
          token: body.applyToken,
          userId: user.id,
          planId: finalPlanId,
          versionNo: 1,
          resultJson: JSON.stringify(responsePayload),
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
    }

    return responsePayload;
  });

  revalidatePath("/app");
  revalidatePath("/app/programs");
  revalidatePath("/app/train");
  revalidatePath("/app/exercises");
  revalidatePath("/app/progress");
  revalidatePath("/app/nutrition");

  return NextResponse.json(txResult);
}
