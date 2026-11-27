import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { canAccessFinance, hasPermission } from "@/lib/rbac";
import { aggregateGstrSummary, REPORT_CATALOG } from "@/lib/reports-ai";
import { ReportsClient } from "@/components/reports-client";

export default async function ReportsPage() {
  const ctx = await requireAuthContext({
    permission: "reports:read",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const showFinance = canAccessFinance(ctx.role);
  const canExport = hasPermission(ctx.role, "reports:export");

  const visibleReports = REPORT_CATALOG.filter((r) => showFinance || !r.financialOnly);

  const [invoices, scheduledReports, posSales, activeCount] = await Promise.all([
    showFinance
      ? prisma.invoice.findMany({
          where: { orgId: ctx.org.id, branchId: { in: branchIds } },
          orderBy: { issueDate: "desc" },
          take: 120,
          select: {
            invoiceNumber: true,
            sacCode: true,
            taxablePaise: true,
            cgstPaise: true,
            sgstPaise: true,
            igstPaise: true,
            totalPaise: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    canExport
      ? prisma.scheduledReport.findMany({
          where: { orgId: ctx.org.id },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    showFinance
      ? prisma.posSale.aggregate({
          where: { orgId: ctx.org.id, branchId: { in: branchIds } },
          _sum: { totalPaise: true },
        })
      : Promise.resolve({ _sum: { totalPaise: 0 } }),
    prisma.member.count({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "ACTIVE", deletedAt: null },
    }),
  ]);

  const gstr = showFinance ? aggregateGstrSummary(invoices) : null;

  return (
    <ReportsClient
      currency={ctx.org.currency}
      canExport={canExport}
      showFinance={showFinance}
      activeCount={activeCount}
      posTotalPaise={posSales._sum.totalPaise ?? 0}
      gstr={gstr}
      catalog={visibleReports}
      recentInvoices={invoices.slice(0, 15)}
      scheduledReports={scheduledReports.map((s) => ({
        id: s.id,
        name: s.name,
        reportType: s.reportType,
        cadence: s.cadence,
        recipient: s.recipientPhoneOrEmail,
      }))}
    />
  );
}
