import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { AuthorizationError, hasPermission } from "@/lib/rbac";
import { calculateTrainerCommission } from "@/lib/ops-math";
import { TrainersClient } from "@/components/trainers-client";

export default async function TrainersPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const canRead = hasPermission(ctx.role, "trainers:read");
  const canViewPayroll = hasPermission(ctx.role, "trainers:payroll");
  if (!canRead && !canViewPayroll) {
    throw new AuthorizationError(`Role ${ctx.role} cannot access Trainers & PT.`);
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const isTrainerSelf = ctx.role === "TRAINER";

  const [profiles, ptSessions, members] = await Promise.all([
    prisma.trainerProfile.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        ...(isTrainerSelf ? { userId: ctx.user.id } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.ptSession.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        ...(isTrainerSelf ? { trainerId: ctx.user.id } : {}),
      },
      orderBy: { scheduledAt: "desc" },
      take: 60,
      include: {
        trainer: { select: { name: true } },
        member: { select: { fullName: true, memberCode: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null, status: { in: ["ACTIVE", "EXPIRING"] } },
      take: 80,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberCode: true },
    }),
  ]);

  const rosterWithPayroll = profiles.map((p) => {
    const completedFees = ptSessions
      .filter((s) => s.trainerId === p.userId && s.status === "COMPLETED")
      .map((s) => s.sessionFeePaise);
    const calc = calculateTrainerCommission({
      baseRetainerPaise: p.baseRetainerPaise,
      completedSessionFeesPaise: completedFees,
      baseCommissionBps: p.commissionBps,
    });
    const showMoney = canViewPayroll || (isTrainerSelf && p.userId === ctx.user.id);
    return {
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      branchName: p.branch.name,
      specialties: p.specialties,
      availability: (p.availabilityJson as { morning?: string; evening?: string; offDay?: string } | null) ?? {},
      sessionsCount: calc.sessionsCount,
      effectiveBps: calc.effectiveBps,
      retainerPaise: showMoney ? calc.retainerPaise : null,
      commissionEarnedPaise: showMoney ? calc.commissionEarnedPaise : null,
      totalPayoutPaise: showMoney ? calc.totalPayoutPaise : null,
    };
  });

  return (
    <TrainersClient
      currency={ctx.org.currency}
      canManageSessions={ctx.role !== "ACCOUNTANT"}
      showPayrollColumns={canViewPayroll || isTrainerSelf}
      branches={ctx.visibleBranches.filter((b) => branchIds.includes(b.id)).map((b) => ({ id: b.id, name: b.name }))}
      roster={rosterWithPayroll}
      members={members}
      sessions={ptSessions.map((s) => ({
        id: s.id,
        trainerName: s.trainer.name,
        memberName: s.member.fullName,
        memberCode: s.member.memberCode,
        branchName: s.branch.name,
        scheduledAt: s.scheduledAt.toISOString(),
        status: s.status,
        sessionFeePaise: canViewPayroll || isTrainerSelf ? s.sessionFeePaise : null,
        commissionPaise: canViewPayroll || isTrainerSelf ? s.commissionPaise : null,
        notes: s.notes,
      }))}
    />
  );
}
