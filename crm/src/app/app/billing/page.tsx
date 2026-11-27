import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { formatDateInBranchTz, toBranchDateKey } from "@/lib/membership-math";
import { classifyDuesAging } from "@/lib/dues-ledger";
import { BillingClient } from "@/components/billing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuthContext({ permission: "billing:read", redirectOnUnauth: true });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const now = new Date();
  const istKey = toBranchDateKey(now, ctx.org.timezone || "Asia/Kolkata");
  const startMonth = new Date(`${istKey.slice(0, 7)}-01T00:00:00+05:30`);
  const q = (sp.q ?? "").trim();

  const [
    invoices,
    expenses,
    monthRevAgg,
    duesAgg,
    refundsAgg,
    monthExpAgg,
    membersList,
    plansList,
    webhooks,
    cashSessions,
    giftCards,
    mandates,
    dunningAttempts,
    memberGroups,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" } },
                { member: { fullName: { contains: q, mode: "insensitive" } } },
                { member: { memberCode: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        member: { select: { id: true, fullName: true, memberCode: true, phone: true, walletBalancePaise: true } },
        branch: { select: { name: true, code: true, timezone: true } },
      },
      orderBy: { issueDate: "desc" },
      take: 80,
    }),
    prisma.expense.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      include: { branch: { select: { code: true, timezone: true } } },
      orderBy: { incurredOn: "desc" },
      take: 30,
    }),
    prisma.payment.aggregate({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "CAPTURED", paidAt: { gte: startMonth } },
      _sum: { amountPaise: true },
    }),
    prisma.invoice.aggregate({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, balanceDuePaise: { gt: 0 } },
      _sum: { balanceDuePaise: true },
      _count: { _all: true },
    }),
    prisma.creditNoteRefund.aggregate({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, issuedAt: { gte: startMonth } },
      _sum: { amountPaise: true },
    }),
    prisma.expense.aggregate({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, incurredOn: { gte: startMonth } },
      _sum: { amountPaise: true },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null },
      select: { id: true, fullName: true, memberCode: true, branchId: true, walletBalancePaise: true },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.plan.findMany({ where: { orgId: ctx.org.id, isActive: true }, orderBy: { pricePaise: "asc" } }),
    prisma.webhookEvent.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.cashReconciliation.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      include: { branch: { select: { code: true } } },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.giftCardVoucher.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.autopayMandate.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      include: { member: { select: { fullName: true, memberCode: true } }, membership: { include: { plan: { select: { name: true } } } } },
      orderBy: { nextChargeDate: "asc" },
      take: 25,
    }),
    prisma.dunningAttempt.findMany({
      where: { orgId: ctx.org.id },
      include: { invoice: { include: { member: { select: { fullName: true, memberCode: true } } } } },
      orderBy: { scheduledAt: "desc" },
      take: 25,
    }),
    prisma.memberGroup.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <BillingClient
      orgId={ctx.org.id}
      role={ctx.role}
      currency={ctx.org.currency}
      activeBranchId={ctx.activeBranchId ?? ctx.visibleBranches[0]?.id ?? ""}
      branches={ctx.visibleBranches}
      openSellOnMount={sp.action === "sell"}
      initialQuery={q}
      summary={{
        monthCollectedPaise: monthRevAgg._sum.amountPaise ?? 0,
        openDuesPaise: duesAgg._sum.balanceDuePaise ?? 0,
        openDuesCount: duesAgg._count._all,
        monthRefundsPaise: refundsAgg._sum.amountPaise ?? 0,
        monthExpensesPaise: monthExpAgg._sum.amountPaise ?? 0,
      }}
      invoices={invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        memberId: inv.member.id,
        memberName: inv.member.fullName,
        memberCode: inv.member.memberCode,
        memberWalletPaise: inv.member.walletBalancePaise,
        branchCode: inv.branch.code,
        issueDate: formatDateInBranchTz(inv.issueDate, inv.branch.timezone),
        agingBucket: classifyDuesAging(inv.dueDate, inv.balanceDuePaise, now, inv.branch.timezone),
        status: inv.status,
        totalPaise: inv.totalPaise,
        paidPaise: inv.paidPaise,
        balanceDuePaise: inv.balanceDuePaise,
        cgstPaise: inv.cgstPaise,
        sgstPaise: inv.sgstPaise,
        igstPaise: inv.igstPaise,
      }))}
      expenses={expenses.map((ex) => ({
        id: ex.id,
        branchCode: ex.branch.code,
        category: ex.category,
        vendorName: ex.vendorName,
        description: ex.description,
        amountPaise: ex.amountPaise,
        gstPaise: ex.gstPaise,
        incurredOn: formatDateInBranchTz(ex.incurredOn, ex.branch.timezone),
      }))}
      members={membersList}
      plans={plansList.map((p) => ({
        id: p.id,
        name: p.name,
        pricePaise: p.pricePaise,
        durationDays: p.durationDays,
      }))}
      webhooks={webhooks.map((w) => ({
        id: w.id,
        provider: w.provider,
        externalEventId: w.externalEventId,
        status: w.status,
        signatureValid: w.signatureValid,
        lastError: w.lastError,
      }))}
      cashSessions={cashSessions.map((c) => ({
        id: c.id,
        branchCode: c.branch.code,
        date: c.date.toISOString().slice(0, 10),
        expectedPaise: c.openingCashPaise + c.collectedCashPaise,
        countedPaise: c.countedCashPaise,
        variancePaise: c.variancePaise,
      }))}
      giftCards={giftCards.map((g) => ({
        id: g.id,
        code: g.code,
        initialPaise: g.initialPaise,
        balancePaise: g.balancePaise,
        recipientName: g.recipientName ?? "Bearer",
        status: g.status,
      }))}
      mandates={mandates.map((m) => ({
        id: m.id,
        memberName: m.member.fullName,
        memberCode: m.member.memberCode,
        planName: m.membership.plan.name,
        provider: m.provider,
        mandateRef: m.mandateRef,
        maxAmountPaise: m.maxAmountPaise,
        nextChargeDate: m.nextChargeDate.toISOString().slice(0, 10),
        status: m.status,
      }))}
      dunningAttempts={dunningAttempts.map((d) => ({
        id: d.id,
        invoiceNumber: d.invoice.invoiceNumber,
        memberName: d.invoice.member.fullName,
        attemptNo: d.attemptNo,
        status: d.status,
        balanceDuePaise: d.invoice.balanceDuePaise,
        scheduledAt: d.scheduledAt.toISOString().slice(0, 10),
      }))}
      memberGroups={memberGroups.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        companyName: g.companyName,
        corporateGstin: g.corporateGstin,
        seatLimit: g.seatLimit,
        memberCount: g._count.members,
      }))}
    />
  );
}
