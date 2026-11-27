import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { TrainingPlansClient } from "@/components/training-plans-client";

export default async function TrainingPlansPage() {
  const ctx = await requireAuthContext({
    permission: "training:read",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const canWrite = hasPermission(ctx.role, "training:write");

  const [templates, assignments, members] = await Promise.all([
    prisma.workoutDietTemplate.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.memberPlanAssignment.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        member: { select: { id: true, fullName: true, memberCode: true } },
        template: { select: { name: true, dietType: true, caloriesTarget: true, proteinGrams: true } },
        trainer: { select: { name: true } },
      },
    }),
    prisma.member.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        deletedAt: null,
        ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
      },
      take: 80,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberCode: true },
    }),
  ]);

  return (
    <TrainingPlansClient
      canWrite={canWrite}
      members={members}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        goal: t.goal,
        dietType: t.dietType,
        caloriesTarget: t.caloriesTarget,
        proteinGrams: t.proteinGrams,
        createdByName: t.createdBy.name,
        workouts: (t.workoutsJson as Array<{ day: string; exercises: string[] }>) ?? [],
        meals: (t.mealsJson as Array<{ slot: string; items: string; macros: string }>) ?? [],
      }))}
      assignments={assignments.map((a) => ({
        id: a.id,
        memberName: a.member.fullName,
        memberCode: a.member.memberCode,
        templateName: a.template.name,
        dietType: a.template.dietType,
        caloriesTarget: a.template.caloriesTarget,
        proteinGrams: a.template.proteinGrams,
        trainerName: a.trainer.name,
        syncToken: a.syncToken,
        syncedAt: a.syncedAt ? a.syncedAt.toISOString() : null,
      }))}
    />
  );
}
