import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { LoyaltyClient } from "@/components/loyalty-client";

export default async function LoyaltyPage() {
  const ctx = await requireAuthContext({
    permission: "loyalty:read",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const canManage = hasPermission(ctx.role, "loyalty:manage");

  const [accounts, referrals, ledger, members] = await Promise.all([
    prisma.loyaltyAccount.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { lifetimePoints: "desc" },
      take: 60,
      include: {
        branch: { select: { name: true } },
        member: { select: { id: true, fullName: true, memberCode: true, referralCode: true } },
      },
    }),
    prisma.referralReward.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        referrer: { select: { id: true, fullName: true, referralCode: true } },
        referred: { select: { id: true, fullName: true, memberCode: true } },
      },
    }),
    prisma.loyaltyLedger.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { member: { select: { fullName: true, memberCode: true } } },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null },
      orderBy: { fullName: "asc" },
      take: 80,
      select: { id: true, fullName: true, memberCode: true, referralCode: true },
    }),
  ]);

  return (
    <LoyaltyClient
      currency={ctx.org.currency}
      canManage={canManage}
      members={members}
      accounts={accounts.map((a) => ({
        id: a.id,
        memberId: a.memberId,
        memberName: a.member.fullName,
        memberCode: a.member.memberCode,
        referralCode: a.member.referralCode,
        branchName: a.branch.name,
        pointsBalance: a.pointsBalance,
        lifetimePoints: a.lifetimePoints,
        tier: a.tier,
      }))}
      referrals={referrals.map((r) => ({
        id: r.id,
        referrerName: r.referrer.fullName,
        referralCode: r.referrer.referralCode,
        referredName: r.referred.fullName,
        referredCode: r.referred.memberCode,
        freeDaysGranted: r.freeDaysGranted,
        discountPaiseGranted: r.discountPaiseGranted,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }))}
      ledger={ledger.map((l) => ({
        id: l.id,
        memberName: l.member.fullName,
        memberCode: l.member.memberCode,
        pointsDelta: l.pointsDelta,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
