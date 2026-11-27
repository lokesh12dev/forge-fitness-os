import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { StaffClient } from "@/components/staff-client";

export default async function StaffPage() {
  const ctx = await requireAuthContext({
    permission: "staff:shifts",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const [shifts, auditLogs] = await Promise.all([
    prisma.staffShift.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: [{ shiftDate: "desc" }, { startTime: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return (
    <StaffClient
      shifts={shifts.map((s) => ({
        id: s.id,
        staffName: s.user.name,
        branchName: s.branch.name,
        roleLabel: s.roleLabel,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        handoverNote: s.handoverNote,
      }))}
      auditEntries={auditLogs.map((a) => ({
        id: a.id,
        timestamp: a.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        badge: a.actorRole,
        title: `${a.action} · ${a.resourceType}`,
        body: `Actor: ${a.actor.name} · Ref: ${a.resourceId}`,
      }))}
    />
  );
}
