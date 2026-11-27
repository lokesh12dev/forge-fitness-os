import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { AuthorizationError, hasPermission } from "@/lib/rbac";
import { InventoryClient } from "@/components/inventory-client";

export default async function InventoryPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const canInv = hasPermission(ctx.role, "inventory:read");
  const canPos = hasPermission(ctx.role, "inventory:pos");
  const canEquip = hasPermission(ctx.role, "equipment:manage");
  if (!canInv && !canEquip) {
    throw new AuthorizationError(`Role ${ctx.role} lacks inventory/equipment access.`);
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const [items, sales, purchaseOrders, lockers, assets, members] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, isActive: true },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
      include: { branch: { select: { name: true } } },
    }),
    prisma.posSale.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { soldAt: "desc" },
      take: 25,
      include: { member: { select: { fullName: true } }, branch: { select: { name: true } } },
    }),
    prisma.purchaseOrder.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { orderedAt: "desc" },
      include: { branch: { select: { name: true } } },
    }),
    prisma.lockerUnit.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { code: "asc" },
      include: { assignedMember: { select: { fullName: true, memberCode: true } }, branch: { select: { name: true } } },
    }),
    prisma.equipmentAsset.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { assetCode: "asc" },
      include: { branch: { select: { name: true } } },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null },
      take: 60,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberCode: true },
    }),
  ]);

  return (
    <InventoryClient
      currency={ctx.org.currency}
      canPos={canPos}
      canEquip={canEquip}
      branches={ctx.visibleBranches
        .filter((b) => branchIds.includes(b.id))
        .map((b) => ({ id: b.id, name: b.name }))}
      members={members}
      items={items.map((it) => ({
        id: it.id,
        branchId: it.branchId,
        branchName: it.branch.name,
        sku: it.sku,
        name: it.name,
        category: it.category,
        unitPricePaise: it.unitPricePaise,
        costPaise: it.costPaise,
        gstRateBps: it.gstRateBps,
        stockQty: it.stockQty,
        reorderLevel: it.reorderLevel,
        supplierName: it.supplierName,
      }))}
      sales={sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        branchName: s.branch.name,
        memberName: s.member?.fullName ?? "Walk-in Retail",
        totalPaise: s.totalPaise,
        gstPaise: s.gstPaise,
        method: s.method,
        soldAt: s.soldAt.toISOString(),
      }))}
      purchaseOrders={purchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        branchName: po.branch.name,
        supplierName: po.supplierName,
        status: po.status,
        totalPaise: po.totalPaise,
        orderedAt: po.orderedAt.toISOString(),
      }))}
      lockers={lockers.map((l) => ({
        id: l.id,
        code: l.code,
        branchName: l.branch.name,
        size: l.size,
        status: l.status,
        memberName: l.assignedMember ? `${l.assignedMember.fullName} (${l.assignedMember.memberCode})` : null,
      }))}
      assets={assets.map((a) => ({
        id: a.id,
        assetCode: a.assetCode,
        name: a.name,
        branchName: a.branch.name,
        zone: a.zone,
        brand: a.brand,
        status: a.status,
        nextServiceDue: a.nextServiceDue ? a.nextServiceDue.toISOString().slice(0, 10) : null,
        maintenanceNotes: a.maintenanceNotes,
      }))}
    />
  );
}
