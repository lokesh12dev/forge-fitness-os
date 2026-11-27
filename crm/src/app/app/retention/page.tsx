import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { canAccessFinance, hasPermission } from "@/lib/rbac";
import { evaluateMemberChurnRisk } from "@/lib/churn";
import { buildRetentionCohorts, computeRenewalForecast } from "@/lib/cohorts";
import { RetentionClient } from "@/components/retention-client";

export default async function RetentionPage() {
  const ctx = await requireAuthContext({
    permission: "retention:read",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const canViewRevenue = canAccessFinance(ctx.role);
  const canOutreach = hasPermission(ctx.role, "retention:outreach");

  const now = new Date();
  const d14Ago = new Date(now.getTime() - 14 * 86_400_000);
  const d28Ago = new Date(now.getTime() - 28 * 86_400_000);
  const d30Ahead = new Date(now.getTime() + 30 * 86_400_000);

  const memberWhere = {
    orgId: ctx.org.id,
    branchId: { in: branchIds },
    deletedAt: null,
    mergedIntoMemberId: null,
    ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
  };

  const [members, recentCheckIns] = await Promise.all([
    prisma.member.findMany({
      where: memberWhere,
      include: {
        branch: { select: { name: true } },
        subscriptions: {
          orderBy: { endDate: "desc" },
          include: { plan: { select: { name: true, billingModel: true, pricePaise: true } } },
        },
        invoices: {
          where: { balanceDuePaise: { gt: 0 } },
          select: { balanceDuePaise: true },
        },
      },
    }),
    prisma.checkIn.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        visitedAt: { gte: d28Ago },
        result: { in: ["ALLOWED", "OVERRIDE_ALLOWED"] },
      },
      select: { memberId: true, visitedAt: true },
    }),
  ]);

  const checkInCounts = new Map<string, { last14: number; prev14: number }>();
  for (const ci of recentCheckIns) {
    const entry = checkInCounts.get(ci.memberId) ?? { last14: 0, prev14: 0 };
    if (ci.visitedAt >= d14Ago) {
      entry.last14++;
    } else {
      entry.prev14++;
    }
    checkInCounts.set(ci.memberId, entry);
  }

  const evaluated = members
    .filter((m) => m.status !== "FROZEN" && m.status !== "EXPIRED")
    .map((m) => {
      const counts = checkInCounts.get(m.id) ?? { last14: 0, prev14: 0 };
      const daysSinceLastVisit = m.lastVisitedAt
        ? Math.max(0, Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000))
        : 30;
      const overdueBalancePaise = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);
      const sub = m.subscriptions[0];
      const tenureDays = Math.max(0, Math.round((now.getTime() - m.createdAt.getTime()) / 86_400_000));

      const assessment = evaluateMemberChurnRisk(
        {
          visitsLast14d: counts.last14,
          visitsPrev14d: counts.prev14,
          daysSinceLastVisit,
          status: m.status,
          overdueBalancePaise,
          billingModel: sub?.plan.billingModel ?? null,
          tenureDays,
        },
        m.fullName
      );

      return {
        memberId: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        phone: m.phone,
        branchName: m.branch.name,
        planName: sub?.plan.name ?? "Club Plan",
        planPricePaise: sub?.plan.pricePaise ?? 0,
        status: m.status,
        expiryDate: m.expiryDate ? m.expiryDate.toISOString() : null,
        rawExpiryDate: m.expiryDate,
        daysSinceLastVisit,
        visitsLast14d: counts.last14,
        visitsPrev14d: counts.prev14,
        assessment,
      };
    })
    .sort((a, b) => b.assessment.score - a.assessment.score);

  const cohorts = buildRetentionCohorts(
    members.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      expiryDate: m.expiryDate,
      lastVisitedAt: m.lastVisitedAt,
      status: m.status,
      subscriptions: m.subscriptions.map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
      })),
    })),
    now
  );

  const expiring30d = evaluated.filter(
    (e) => e.rawExpiryDate && e.rawExpiryDate >= now && e.rawExpiryDate <= d30Ahead
  );

  const forecast = canViewRevenue
    ? computeRenewalForecast(
        expiring30d.map((e) => ({
          planPricePaise: e.planPricePaise,
          churnScore: e.assessment.score,
        }))
      )
    : null;

  const totalHighRisk = evaluated.filter((e) => e.assessment.tier === "HIGH").length;
  const totalMedRisk = evaluated.filter((e) => e.assessment.tier === "MEDIUM").length;

  return (
    <RetentionClient
      currency={ctx.org.currency}
      canViewRevenue={canViewRevenue}
      canOutreach={canOutreach}
      summary={{
        highRiskCount: totalHighRisk,
        medRiskCount: totalMedRisk,
        expiring30dCount: expiring30d.length,
        forecast,
      }}
      cohorts={cohorts}
      atRiskMembers={evaluated.slice(0, 60).map((e) => ({
        memberId: e.memberId,
        memberCode: e.memberCode,
        fullName: e.fullName,
        phone: e.phone,
        branchName: e.branchName,
        planName: e.planName,
        planValuePaise: canViewRevenue ? e.planPricePaise : null,
        status: e.status,
        expiryDate: e.expiryDate,
        daysSinceLastVisit: e.daysSinceLastVisit,
        visitsLast14d: e.visitsLast14d,
        visitsPrev14d: e.visitsPrev14d,
        score: e.assessment.score,
        tier: e.assessment.tier,
        factors: e.assessment.factors,
        savePlan: e.assessment.savePlan,
      }))}
    />
  );
}
