import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { AuthorizationError, hasPermission } from "@/lib/rbac";
import { computeSourceRoiReport } from "@/lib/leads-math";
import { LeadsClient } from "@/components/leads-client";

export default async function LeadsPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const canReadLeads = hasPermission(ctx.role, "leads:read");
  const canViewRoi = hasPermission(ctx.role, "leads:roi");
  const canWrite = hasPermission(ctx.role, "leads:write");

  if (!canReadLeads && !canViewRoi) {
    throw new AuthorizationError(`Role ${ctx.role} lacks permission to access Leads pipeline.`);
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const [leads, spendCampaigns, paidInvoices, plans, staff] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true } },
        tasks: { orderBy: { dueAt: "asc" } },
      },
    }),
    canViewRoi
      ? prisma.adSpendCampaign.findMany({
          where: { orgId: ctx.org.id },
        })
      : Promise.resolve([]),
    canViewRoi
      ? prisma.invoice.groupBy({
          by: ["memberId"],
          where: { orgId: ctx.org.id, branchId: { in: branchIds } },
          _sum: { paidPaise: true },
        })
      : Promise.resolve([]),
    prisma.plan.findMany({
      where: { orgId: ctx.org.id, isActive: true },
      orderBy: { pricePaise: "asc" },
      select: { id: true, name: true, pricePaise: true, durationDays: true },
    }),
    prisma.orgMembership.findMany({
      where: { orgId: ctx.org.id, role: { in: ["OWNER", "MANAGER", "FRONTDESK"] } },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const spendBySourcePaise: Record<string, number> = {};
  for (const sc of spendCampaigns) {
    spendBySourcePaise[sc.source] = (spendBySourcePaise[sc.source] ?? 0) + sc.spendPaise;
  }

  const revenueByMemberPaise: Record<string, number> = {};
  for (const inv of paidInvoices) {
    revenueByMemberPaise[inv.memberId] = inv._sum.paidPaise ?? 0;
  }

  const roiRows = canViewRoi
    ? computeSourceRoiReport({
        leads: leads.map((l) => ({
          source: l.source,
          stage: l.stage,
          convertedMemberId: l.convertedMemberId,
        })),
        spendBySourcePaise,
        revenueByMemberPaise,
      })
    : [];

  return (
    <LeadsClient
      orgSlug={ctx.org.slug}
      orgName={ctx.org.name}
      currency={ctx.org.currency}
      canWrite={canWrite}
      canViewRoi={canViewRoi}
      branches={ctx.visibleBranches
        .filter((b) => branchIds.includes(b.id))
        .map((b) => ({ id: b.id, name: b.name, code: b.code }))}
      plans={plans}
      staff={staff.map((s) => s.user)}
      roiRows={roiRows}
      leads={leads.map((l) => ({
        id: l.id,
        branchId: l.branchId,
        branchName: l.branch.name,
        fullName: l.fullName,
        phone: l.phone,
        email: l.email,
        source: l.source,
        stage: l.stage,
        score: l.score,
        trialAt: l.trialAt ? l.trialAt.toISOString() : null,
        lostReason: l.lostReason,
        ownerId: l.ownerId,
        ownerName: l.owner?.name ?? "Unassigned",
        convertedMemberId: l.convertedMemberId,
        notes: l.notes,
        stageChangedAt: l.stageChangedAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
        tasks: l.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueAt.toISOString(),
          status: t.status,
        })),
      }))}
    />
  );
}
