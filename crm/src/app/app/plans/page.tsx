import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { PlansCatalogClient } from "@/components/plans-client";

export default async function PlansPage() {
  const ctx = await requireAuthContext({ permission: "plans:read", redirectOnUnauth: true });

  const [plans, addons, promos] = await Promise.all([
    prisma.plan.findMany({ where: { orgId: ctx.org.id }, orderBy: [{ isActive: "desc" }, { pricePaise: "asc" }] }),
    prisma.planAddon.findMany({ where: { orgId: ctx.org.id }, orderBy: { pricePaise: "asc" } }),
    prisma.promoCode.findMany({ where: { orgId: ctx.org.id }, orderBy: { validUntil: "desc" } }),
  ]);

  return (
    <PlansCatalogClient
      role={ctx.role}
      currency={ctx.org.currency}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        billingModel: p.billingModel,
        durationDays: p.durationDays,
        sessionCredits: p.sessionCredits,
        pricePaise: p.pricePaise,
        joiningFeePaise: p.joiningFeePaise,
        gstRateBps: p.gstRateBps,
        sacCode: p.sacCode,
        maxFreezeDays: p.maxFreezeDays,
        freezeFeePaise: p.freezeFeePaise,
        autoRenewDefault: p.autoRenewDefault,
        isActive: p.isActive,
      }))}
      addons={addons.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        pricePaise: a.pricePaise,
        durationDays: a.durationDays,
      }))}
      promos={promos.map((pr) => ({
        id: pr.id,
        code: pr.code,
        discountType: pr.discountType,
        discountValue: pr.discountValue,
        scope: pr.scope,
        redeemedCount: pr.redeemedCount,
        maxRedemptions: pr.maxRedemptions,
        validUntil: pr.validUntil.toISOString().slice(0, 10),
      }))}
    />
  );
}
