import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { AuthorizationError, hasPermission } from "@/lib/rbac";
import { calculateTrainerCommission } from "@/lib/ops-math";
import { TrainersClient } from "@/components/trainers-client";

export default async function TrainersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const canRead = hasPermission(ctx.role, "trainers:read");
  const canViewPayroll = hasPermission(ctx.role, "trainers:payroll");
  if (!canRead && !canViewPayroll) {
    throw new AuthorizationError(`Role ${ctx.role} cannot access Trainers & PT.`);
  }

  const sp = await searchParams;
  const selectedMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "ALL";
  let monthRange: { gte: Date; lt: Date } | undefined;
  if (selectedMonth !== "ALL") {
    const [yStr, mStr] = selectedMonth.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const start = new Date(`${selectedMonth}-01T00:00:00+05:30`);
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = new Date(`${nextY}-${String(nextM).padStart(2, "0")}-01T00:00:00+05:30`);
    monthRange = { gte: start, lt: end };
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
        ...(monthRange ? { scheduledAt: monthRange } : {}),
      },
      orderBy: { scheduledAt: "desc" },
      take: 80,
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
      select: {
        id: true,
        fullName: true,
        memberCode: true,
        subscriptions: {
          where: { status: "ACTIVE", sessionsRemaining: { gt: 0 }, plan: { billingModel: "PT_PACK" } },
          select: { sessionsRemaining: true },
          take: 1,
        },
      },
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

  const now = new Date();
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });

  return (
    <TrainersClient
      currency={ctx.org.currency}
      canManageSessions={ctx.role !== "ACCOUNTANT"}
      showPayrollColumns={canViewPayroll || isTrainerSelf}
      selectedMonth={selectedMonth}
      monthOptions={monthOptions}
      branches={ctx.visibleBranches.filter((b) => branchIds.includes(b.id)).map((b) => ({ id: b.id, name: b.name }))}
      roster={rosterWithPayroll}
      members={members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        memberCode: m.memberCode,
        ptCredits: m.subscriptions[0]?.sessionsRemaining ?? 0,
      }))}
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
