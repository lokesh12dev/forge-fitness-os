import crypto from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { macroTargets, syncProposals, users, type SyncProposalRecord } from "@/db/schema";
import {
  calculateEnergyTargets,
  calculateMacroTargets,
  planMissedSessionRecovery,
  type NutritionGoal,
} from "@/lib/fitness";
import type { AiModule } from "./schemas";

export type SyncTriggerType =
  | "goal_change"
  | "missed_workout"
  | "plateau"
  | "equipment_change";

export interface SyncProposalItem {
  id: string;
  triggerType: SyncTriggerType;
  originModule: AiModule;
  targetModule: AiModule;
  targetEntity: string;
  causalChainId: string;
  depth: number;
  status: "pending" | "accepted" | "edited" | "dismissed" | "expired";
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
  createdAt: number;
  resolvedAt: number | null;
}

const MAX_SYNC_DEPTH = 3;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

function toProposalItem(row: SyncProposalRecord): SyncProposalItem {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    triggerType: row.triggerType as SyncTriggerType,
    originModule: row.originModule as AiModule,
    targetModule: row.targetModule as AiModule,
    targetEntity: row.targetEntity,
    causalChainId: row.causalChainId,
    depth: row.depth,
    status: row.status as SyncProposalItem["status"],
    title: row.title,
    rationale: row.rationale,
    payload,
    createdAt: new Date(row.createdAt).getTime(),
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).getTime() : null,
  };
}

export interface PureSyncDraft {
  triggerType: SyncTriggerType;
  originModule: AiModule;
  targetModule: AiModule;
  targetEntity: string;
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
}

/**
 * Pure deterministic generator for the 4 cross-section sync scenarios.
 */
export function buildSyncDraftsForScenario(params: {
  scenario: SyncTriggerType;
  sex: "male" | "female";
  weightKg: number;
  heightCm: number;
  newGoal?: string;
  daysMissed?: number;
  missedDayName?: string;
  nextDayName?: string;
  currentCalories?: number;
  newEquipment?: string[];
}): PureSyncDraft[] {
  const { scenario } = params;

  if (scenario === "goal_change") {
    const goal = params.newGoal ?? "hypertrophy";
    const nutGoal: NutritionGoal =
      goal === "fat_loss" ? "cut" : goal === "hypertrophy" ? "lean_bulk" : "maintain";
    const energy = calculateEnergyTargets({
      sex: params.sex,
      age: 28,
      heightCm: params.heightCm,
      weightKg: params.weightKg,
      activity: "moderate",
      goal: nutGoal,
    });
    const macros = calculateMacroTargets({
      targetCalories: energy.targetCalories,
      weightKg: params.weightKg,
      goal: nutGoal,
    });

    return [
      {
        triggerType: "goal_change",
        originModule: "body",
        targetModule: "nutrition",
        targetEntity: "macro_targets",
        title: `Sync Nutrition Targets for ${goal.replace("_", " ")}`,
        rationale: `Goal updated to ${goal}: Mifflin-St Jeor TDEE (${energy.tdee} kcal) yields ${macros.calories} kcal, ${macros.proteinG}g P, ${macros.carbsG}g C, ${macros.fatG}g F.`,
        payload: {
          goalUpdate: goal,
          calories: macros.calories,
          protein: macros.proteinG,
          carbs: macros.carbsG,
          fat: macros.fatG,
          waterMl: macros.hydrationMl,
        },
      },
      {
        triggerType: "goal_change",
        originModule: "body",
        targetModule: "schedule",
        targetEntity: "weekly_split",
        title: `Align Weekly Split for ${goal.replace("_", " ")}`,
        rationale: `Adjust weekly rep ranges & recovery cadence to match ${goal.replace("_", " ")}.`,
        payload: { goalUpdate: goal, recommendedDays: goal === "fat_loss" ? 4 : 5 },
      },
    ];
  }

  if (scenario === "missed_workout") {
    const recovery = planMissedSessionRecovery({
      daysMissed: params.daysMissed ?? 2,
      missedDayName: params.missedDayName ?? "Scheduled Workout",
      nextScheduledDayName: params.nextDayName ?? "Next Session",
    });
    return [
      {
        triggerType: "missed_workout",
        originModule: "workout",
        targetModule: "schedule",
        targetEntity: "missed_session_rebalance",
        title: `Rebalance Schedule (${recovery.strategy})`,
        rationale: recovery.guidance,
        payload: {
          strategy: recovery.strategy,
          loadMultiplier: recovery.loadMultiplier,
          volumeMultiplier: recovery.volumeMultiplier,
        },
      },
    ];
  }

  if (scenario === "plateau") {
    const curCals = params.currentCalories ?? 2400;
    const adjustedCals = Math.max(params.sex === "female" ? 1200 : 1500, curCals - 175);
    return [
      {
        triggerType: "plateau",
        originModule: "body",
        targetModule: "nutrition",
        targetEntity: "plateau_calorie_nudge",
        title: "Break Plateau: -175 kcal Daily Adjustment",
        rationale: `14+ day trend stalled with >=70% adherence. Adjusting intake from ${curCals} to ${adjustedCals} kcal while keeping protein anchored.`,
        payload: { calories: adjustedCals },
      },
    ];
  }

  // equipment_change
  const eq = params.newEquipment ?? ["dumbbell", "bodyweight"];
  return [
    {
      triggerType: "equipment_change",
      originModule: "schedule",
      targetModule: "workout",
      targetEntity: "equipment_profile",
      title: `Substitute Exercises for [${eq.join(", ")}]`,
      rationale: `Equipment profile changed to ${eq.join(", ")}. Swap barbell/machine lifts to matching movement-pattern alternatives.`,
      payload: { equipment: eq },
    },
  ];
}

export async function createSyncProposalIfAllowed(input: {
  userId: string;
  draft: PureSyncDraft;
  causalChainId?: string;
  depth?: number;
}): Promise<{ created: boolean; reason?: string; proposal?: SyncProposalItem }> {
  const depth = input.depth ?? 1;
  if (depth > MAX_SYNC_DEPTH) {
    return { created: false, reason: `Max sync depth (${MAX_SYNC_DEPTH}) exceeded.` };
  }

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await db
    .select()
    .from(syncProposals)
    .where(
      and(
        eq(syncProposals.userId, input.userId),
        eq(syncProposals.triggerType, input.draft.triggerType),
        eq(syncProposals.targetModule, input.draft.targetModule),
        eq(syncProposals.targetEntity, input.draft.targetEntity),
        gte(syncProposals.createdAt, since),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { created: false, reason: "24h dedupe: matching proposal already exists." };
  }

  const id = `sync-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date();
  const causalChainId = input.causalChainId ?? `chain-${crypto.randomUUID().slice(0, 10)}`;

  await db.insert(syncProposals).values({
    id,
    userId: input.userId,
    triggerType: input.draft.triggerType,
    originModule: input.draft.originModule,
    targetModule: input.draft.targetModule,
    targetEntity: input.draft.targetEntity,
    causalChainId,
    depth,
    status: "pending",
    title: input.draft.title,
    rationale: input.draft.rationale,
    payloadJson: JSON.stringify(input.draft.payload),
    createdAt: now,
    resolvedAt: null,
  });

  return {
    created: true,
    proposal: {
      id,
      triggerType: input.draft.triggerType,
      originModule: input.draft.originModule,
      targetModule: input.draft.targetModule,
      targetEntity: input.draft.targetEntity,
      causalChainId,
      depth,
      status: "pending",
      title: input.draft.title,
      rationale: input.draft.rationale,
      payload: input.draft.payload,
      createdAt: now.getTime(),
      resolvedAt: null,
    },
  };
}

export async function listUserSyncProposals(
  userId: string,
  statusFilter?: string,
): Promise<SyncProposalItem[]> {
  const cond = statusFilter
    ? and(eq(syncProposals.userId, userId), eq(syncProposals.status, statusFilter))
    : eq(syncProposals.userId, userId);

  const rows = await db
    .select()
    .from(syncProposals)
    .where(cond)
    .orderBy(desc(syncProposals.createdAt))
    .limit(40);

  return rows.map(toProposalItem);
}

export async function resolveSyncProposal(input: {
  userId: string;
  proposalId: string;
  action: "accept" | "edit" | "dismiss" | "snooze";
  editedPayload?: Record<string, unknown>;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const [row] = await db
    .select()
    .from(syncProposals)
    .where(and(eq(syncProposals.id, input.proposalId), eq(syncProposals.userId, input.userId)))
    .limit(1);

  if (!row) return { ok: false, error: "Sync proposal not found" };

  const now = new Date();
  if (input.action === "dismiss") {
    await db
      .update(syncProposals)
      .set({ status: "dismissed", resolvedAt: now })
      .where(and(eq(syncProposals.id, row.id), eq(syncProposals.userId, input.userId)));
    return { ok: true, status: "dismissed" };
  }

  if (input.action === "snooze") {
    await db
      .update(syncProposals)
      .set({ status: "expired", resolvedAt: now })
      .where(and(eq(syncProposals.id, row.id), eq(syncProposals.userId, input.userId)));
    return { ok: true, status: "expired" };
  }

  const basePayload = JSON.parse(row.payloadJson) as Record<string, unknown>;
  const finalPayload = input.editedPayload ? { ...basePayload, ...input.editedPayload } : basePayload;
  const nextStatus = input.action === "edit" ? "edited" : "accepted";

  db.transaction((tx) => {
    if (typeof finalPayload.goalUpdate === "string") {
      tx.update(users)
        .set({ goal: finalPayload.goalUpdate })
        .where(eq(users.id, input.userId))
        .run();
    }
    if (
      typeof finalPayload.calories === "number" ||
      typeof finalPayload.protein === "number"
    ) {
      const cur = tx
        .select()
        .from(macroTargets)
        .where(eq(macroTargets.userId, input.userId))
        .limit(1)
        .all()[0];
      const nextTargets = {
        calories: typeof finalPayload.calories === "number" ? finalPayload.calories : cur?.calories ?? 2600,
        protein: typeof finalPayload.protein === "number" ? finalPayload.protein : cur?.protein ?? 170,
        carbs: typeof finalPayload.carbs === "number" ? finalPayload.carbs : cur?.carbs ?? 290,
        fat: typeof finalPayload.fat === "number" ? finalPayload.fat : cur?.fat ?? 75,
        waterMl: typeof finalPayload.waterMl === "number" ? finalPayload.waterMl : cur?.waterMl ?? 3200,
      };
      if (cur) {
        tx.update(macroTargets).set(nextTargets).where(eq(macroTargets.userId, input.userId)).run();
      } else {
        tx.insert(macroTargets).values({ userId: input.userId, ...nextTargets }).run();
      }
    }
    if (Array.isArray(finalPayload.equipment)) {
      tx.update(users)
        .set({ equipment: finalPayload.equipment.map(String) })
        .where(eq(users.id, input.userId))
        .run();
    }

    tx.update(syncProposals)
      .set({
        status: nextStatus,
        payloadJson: JSON.stringify(finalPayload),
        resolvedAt: now,
      })
      .where(and(eq(syncProposals.id, row.id), eq(syncProposals.userId, input.userId)))
      .run();
  });

  return { ok: true, status: nextStatus };
}
