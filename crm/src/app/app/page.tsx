import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { toBranchDateKey } from "@/lib/membership-math";
import { evaluateMemberChurnRisk } from "@/lib/churn";
import { TodayDashboardClient } from "@/components/today-client";

export default async function TodayDashboardPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const showFinance = canAccessFinance(ctx.role);
  const now = new Date();
  const tz = ctx.org.timezone || "Asia/Kolkata";

  const totalMembersCount = await prisma.member.count({
    where: {
      orgId: ctx.org.id,
      branchId: { in: branchIds },
      deletedAt: null,
      mergedIntoMemberId: null,
      ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
    },
  });

  if (totalMembersCount === 0) {
    return (
      <TodayDashboardClient
        isEmpty
        role={ctx.role}
        orgName={ctx.org.name}
        currency={ctx.org.currency}
        showFinance={showFinance}
        kpis={{
          checkInsToday: 0,
          todayRevenuePaise: 0,
          newLeadsToday: 0,
          expiring7d: 0,
          overdueCount: 0,
          overdueBalancePaise: 0,
          trialBookings: 0,
          assignedClientsCount: 0,
        }}
        trend={[]}
        heatmap={{ days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], hours: [6, 7, 8, 9, 10, 12, 14, 16, 17, 18, 19, 20, 21], counts: [] }}
        churnRisks={[]}
        tasks={[]}
        branchComparison={[]}
      />
    );
  }

  const todayKey = toBranchDateKey(now, tz);
  const startToday = new Date(`${todayKey}T00:00:00+05:30`);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const d14Ago = new Date(now.getTime() - 14 * 86_400_000);
  const d28Ago = new Date(now.getTime() - 28 * 86_400_000);

  const memberScope = {
    orgId: ctx.org.id,
    branchId: { in: branchIds },
    deletedAt: null,
    mergedIntoMemberId: null,
    ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
  };

  const [
    checkInsToday,
    newLeadsToday,
    trialBookings,
    expiring7d,
    churnCandidateMembers,
    churnRecentCheckIns,
    tasks,
    todayRevenueAgg,
    overdueAgg,
  ] = await Promise.all([
    prisma.checkIn.count({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        visitedAt: { gte: startToday },
        result: { in: ["ALLOWED", "OVERRIDE_ALLOWED"] },
      },
    }),
    prisma.lead.count({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.lead.count({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        stage: "TRIAL_BOOKED",
      },
    }),
    prisma.member.count({
      where: {
        ...memberScope,
        status: { in: ["EXPIRING", "ACTIVE"] },
        expiryDate: { gte: startToday, lte: in7Days },
      },
    }),
    prisma.member.findMany({
      where: {
        ...memberScope,
        status: { in: ["ACTIVE", "EXPIRING", "OVERDUE"] },
      },
      include: {
        branch: { select: { name: true } },
        subscriptions: { orderBy: { endDate: "desc" }, take: 1, include: { plan: { select: { billingModel: true } } } },
        invoices: { where: { balanceDuePaise: { gt: 0 } }, select: { balanceDuePaise: true } },
      },
      orderBy: [{ lastVisitedAt: "asc" }],
      take: 40,
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
    prisma.staffTask.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 8,
    }),
    showFinance
      ? prisma.payment.aggregate({
          where: {
            orgId: ctx.org.id,
            branchId: { in: branchIds },
            status: "CAPTURED",
            paidAt: { gte: startToday },
          },
          _sum: { amountPaise: true },
        })
      : Promise.resolve({ _sum: { amountPaise: 0 } }),
    showFinance
      ? prisma.invoice.aggregate({
          where: {
            orgId: ctx.org.id,
            branchId: { in: branchIds },
            balanceDuePaise: { gt: 0 },
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          },
          _count: { _all: true },
          _sum: { balanceDuePaise: true },
        })
      : Promise.resolve({ _count: { _all: 0 }, _sum: { balanceDuePaise: 0 } }),
  ]);

  const ciCountMap = new Map<string, { last14: number; prev14: number }>();
  for (const ci of churnRecentCheckIns) {
    const entry = ciCountMap.get(ci.memberId) ?? { last14: 0, prev14: 0 };
    if (ci.visitedAt >= d14Ago) entry.last14++;
    else entry.prev14++;
    ciCountMap.set(ci.memberId, entry);
  }

  const scoredChurn = churnCandidateMembers
    .map((m) => {
      const counts = ciCountMap.get(m.id) ?? { last14: 0, prev14: 0 };
      const daysAbsent = m.lastVisitedAt
        ? Math.max(0, Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000))
        : 30;
      const overdueBalancePaise = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);
      const assessment = evaluateMemberChurnRisk(
        {
          visitsLast14d: counts.last14,
          visitsPrev14d: counts.prev14,
          daysSinceLastVisit: daysAbsent,
          status: m.status,
          overdueBalancePaise,
          billingModel: m.subscriptions[0]?.plan.billingModel ?? null,
          tenureDays: Math.max(0, Math.round((now.getTime() - m.createdAt.getTime()) / 86_400_000)),
        },
        m.fullName
      );
      return {
        id: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        branchName: m.branch.name,
        status: m.status,
        daysAbsent,
        riskScore: assessment.score,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  // Real Peak-Hours Day x Hour query directly on CheckIn (IST)
  const hoursList = [6, 7, 8, 9, 10, 12, 14, 16, 17, 18, 19, 20, 21];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatCounts: number[][] = Array.from({ length: 7 }, () => Array(hoursList.length).fill(0));

  if (branchIds.length > 0) {
    const rawHeat = await prisma.$queryRawUnsafe<Array<{ dow: number; hr: number; cnt: bigint }>>(
      `SELECT EXTRACT(ISODOW FROM ("visitedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'))::int AS dow,
              EXTRACT(HOUR FROM ("visitedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'))::int AS hr,
              COUNT(*)::bigint AS cnt
       FROM "CheckIn"
       WHERE "orgId" = $1 AND "branchId" = ANY($2)
       GROUP BY 1, 2`,
      ctx.org.id,
      branchIds
    );
    for (const row of rawHeat) {
      const dIdx = row.dow - 1;
      const hIdx = hoursList.indexOf(row.hr);
      if (dIdx >= 0 && dIdx < 7 && hIdx >= 0) {
        heatCounts[dIdx]![hIdx] = Number(row.cnt);
      }
    }
  }

  // Real 18-month revenue + real historical active membership overlap curve (Finance roles only)
  const trend: Array<{ label: string; revenuePaise: number; activeMembers: number }> = [];
  if (showFinance && branchIds.length > 0) {
    const [rawRev, rawMemberships] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ ym: string; rev: bigint }>>(
        `SELECT to_char("paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS ym,
                COALESCE(SUM("amountPaise"), 0)::bigint AS rev
         FROM "Payment"
         WHERE "orgId" = $1 AND "branchId" = ANY($2) AND "status" = 'CAPTURED'
           AND "paidAt" >= NOW() - INTERVAL '18 months'
         GROUP BY 1
         ORDER BY 1 ASC`,
        ctx.org.id,
        branchIds
      ),
      prisma.$queryRawUnsafe<Array<{ ym: string; active_cnt: bigint }>>(
        `WITH months AS (
           SELECT date_trunc('month', (NOW() AT TIME ZONE 'Asia/Kolkata'))::date - (n || ' months')::interval AS m_start
           FROM generate_series(0, 17) AS n
         )
         SELECT to_char(m.m_start, 'YYYY-MM') AS ym,
                COUNT(DISTINCT s."memberId")::bigint AS active_cnt
         FROM months m
         LEFT JOIN "Membership" s
           ON s."orgId" = $1
           AND s."branchId" = ANY($2)
           AND s."startDate" <= (m.m_start + interval '1 month - 1 day')::date
           AND s."endDate" >= m.m_start::date
         GROUP BY 1
         ORDER BY 1 ASC`,
        ctx.org.id,
        branchIds
      ),
    ]);

    const revMap = new Map(rawRev.map((r) => [r.ym, Number(r.rev)]));
    const activeMap = new Map(rawMemberships.map((r) => [r.ym, Number(r.active_cnt)]));

    for (let offset = 17; offset >= 0; offset--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
      trend.push({
        label,
        revenuePaise: revMap.get(ym) ?? 0,
        activeMembers: activeMap.get(ym) ?? 0,
      });
    }
  }

  // Owner / Accountant Multi-Branch Comparison
  const branchComparison: Array<{
    branchId: string;
    name: string;
    code: string;
    activeMembers: number;
    checkInsToday: number;
    revenueMonthPaise: number;
    duesPaise: number;
  }> = [];

  if (showFinance && ctx.visibleBranches.length > 0 && (ctx.role === "OWNER" || ctx.role === "ACCOUNTANT")) {
    const startMonth = new Date(`${todayKey.slice(0, 7)}-01T00:00:00+05:30`);
    for (const b of ctx.visibleBranches) {
      const [activeCnt, ciCnt, revAgg, dueAgg] = await Promise.all([
        prisma.member.count({
          where: { orgId: ctx.org.id, branchId: b.id, status: { in: ["ACTIVE", "EXPIRING"] }, deletedAt: null },
        }),
        prisma.checkIn.count({
          where: { orgId: ctx.org.id, branchId: b.id, visitedAt: { gte: startToday } },
        }),
        prisma.payment.aggregate({
          where: { orgId: ctx.org.id, branchId: b.id, status: "CAPTURED", paidAt: { gte: startMonth } },
          _sum: { amountPaise: true },
        }),
        prisma.invoice.aggregate({
          where: { orgId: ctx.org.id, branchId: b.id, balanceDuePaise: { gt: 0 } },
          _sum: { balanceDuePaise: true },
        }),
      ]);
      branchComparison.push({
        branchId: b.id,
        name: b.name,
        code: b.code,
        activeMembers: activeCnt,
        checkInsToday: ciCnt,
        revenueMonthPaise: revAgg._sum.amountPaise ?? 0,
        duesPaise: dueAgg._sum.balanceDuePaise ?? 0,
      });
    }
  }

  return (
    <TodayDashboardClient
      isEmpty={false}
      role={ctx.role}
      orgName={ctx.org.name}
      currency={ctx.org.currency}
      showFinance={showFinance}
      kpis={{
        checkInsToday,
        todayRevenuePaise: todayRevenueAgg._sum.amountPaise ?? 0,
        newLeadsToday,
        expiring7d,
        overdueCount: overdueAgg._count._all,
        overdueBalancePaise: overdueAgg._sum.balanceDuePaise ?? 0,
        trialBookings,
        assignedClientsCount: totalMembersCount,
      }}
      trend={trend}
      heatmap={{ days: dayNames, hours: hoursList, counts: heatCounts }}
      churnRisks={scoredChurn}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
      }))}
      branchComparison={branchComparison}
    />
  );
}
