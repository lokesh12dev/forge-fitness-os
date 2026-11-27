import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { calculateStaffNetPayroll } from "@/lib/staff-payroll";
import { StaffClient } from "@/components/staff-client";

export default async function StaffPage() {
  const ctx = await requireAuthContext({
    permission: "staff:shifts",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const [shifts, auditLogs, staffMembers, branchesGeo] = await Promise.all([
    prisma.staffShift.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: [{ shiftDate: "desc" }, { startTime: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { actor: { select: { name: true } } },
    }),
    prisma.orgMembership.findMany({
      where: { orgId: ctx.org.id, role: { not: "MEMBER" } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.branch.findMany({
      where: { orgId: ctx.org.id, id: { in: branchIds } },
      select: { id: true, name: true, latitude: true, longitude: true },
    }),
  ]);

  const payrollByStaff = new Map<
    string,
    { name: string; roleLabel: string; presentDays: number; lateMins: number; advancePaise: number }
  >();
  for (const s of shifts) {
    const prev = payrollByStaff.get(s.userId) ?? {
      name: s.user.name,
      roleLabel: s.roleLabel,
      presentDays: 0,
      lateMins: 0,
      advancePaise: 0,
    };
    if (s.status === "CLOCKED_IN" || s.status === "CLOCKED_OUT") {
      prev.presentDays += 1;
    }
    prev.lateMins += s.lateMinutes;
    prev.advancePaise += s.advancePaise;
    payrollByStaff.set(s.userId, prev);
  }

  const staffPayrollRows = Array.from(payrollByStaff.entries()).map(([userId, row]) => {
    const basePaise = row.roleLabel.toLowerCase().includes("manager") ? 4500000 : 2800000;
    const calc = calculateStaffNetPayroll({
      baseSalaryPaise: basePaise,
      scheduledDays: 26,
      presentDays: Math.min(26, row.presentDays > 0 ? row.presentDays + 20 : 22),
      lateMinutesTotal: row.lateMins,
      advanceTakenPaise: row.advancePaise,
    });
    return {
      userId,
      staffName: row.name,
      roleLabel: row.roleLabel,
      presentShifts: row.presentDays,
      lateMinutes: row.lateMins,
      advancePaise: row.advancePaise,
      netPayablePaise: calc.netPayablePaise,
    };
  });

  return (
    <StaffClient
      currency={ctx.org.currency}
      branches={branchesGeo.map((b) => ({
        id: b.id,
        name: b.name,
        latitude: b.latitude ?? 12.9716,
        longitude: b.longitude ?? 77.6412,
      }))}
      staffUsers={staffMembers.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.role,
      }))}
      staffPayrollRows={staffPayrollRows}
      shifts={shifts.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        branchLat: s.branch.latitude ?? 12.9716,
        branchLng: s.branch.longitude ?? 77.6412,
        staffName: s.user.name,
        branchName: s.branch.name,
        roleLabel: s.roleLabel,
        shiftDate: s.shiftDate.toISOString().slice(0, 10),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        geofenceStatus: s.geofenceStatus ?? "UNVERIFIED",
        lateMinutes: s.lateMinutes,
        advancePaise: s.advancePaise,
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
