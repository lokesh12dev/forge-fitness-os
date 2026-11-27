import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { formatDateInBranchTz, toBranchDateKey } from "@/lib/membership-math";
import { CheckInDeskClient } from "@/components/checkin-client";

export default async function CheckInPage() {
  const ctx = await requireAuthContext({ permission: "checkin:operate", redirectOnUnauth: true });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const activeBranchId = ctx.activeBranchId ?? branchIds[0] ?? "";
  const now = new Date();
  const istKey = toBranchDateKey(now, ctx.org.timezone || "Asia/Kolkata");
  const startToday = new Date(`${istKey}T00:00:00+05:30`);
  const cutoff7d = new Date(now.getTime() - 7 * 86_400_000);
  const cutoff14d = new Date(now.getTime() - 14 * 86_400_000);
  const cutoff30d = new Date(now.getTime() - 30 * 86_400_000);

  const [todayCount, onFloorCount, recentLogs, sampleActive, sampleExpiring, sampleExpired, sampleFrozen, absenteesRaw, accessDevices] =
    await Promise.all([
      prisma.checkIn.count({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          visitedAt: { gte: startToday },
          result: { in: ["ALLOWED", "OVERRIDE_ALLOWED"] },
        },
      }),
      prisma.checkIn.count({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          visitedAt: { gte: startToday },
          checkedOutAt: null,
          result: { in: ["ALLOWED", "OVERRIDE_ALLOWED"] },
        },
      }),
      prisma.checkIn.findMany({
        where: { orgId: ctx.org.id, branchId: { in: branchIds } },
        include: {
          member: { select: { id: true, fullName: true, memberCode: true, status: true } },
          branch: { select: { code: true, timezone: true } },
        },
        orderBy: { visitedAt: "desc" },
        take: 30,
      }),
      prisma.member.findFirst({ where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "ACTIVE", deletedAt: null }, select: { fullName: true, qrToken: true, memberCode: true } }),
      prisma.member.findFirst({ where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "EXPIRING", deletedAt: null }, select: { fullName: true, qrToken: true, memberCode: true } }),
      prisma.member.findFirst({ where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "EXPIRED", deletedAt: null }, select: { fullName: true, qrToken: true, memberCode: true } }),
      prisma.member.findFirst({ where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "FROZEN", deletedAt: null }, select: { fullName: true, qrToken: true, memberCode: true } }),
      prisma.member.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          status: { in: ["ACTIVE", "EXPIRING", "OVERDUE"] },
          lastVisitedAt: { lt: cutoff7d },
          deletedAt: null,
        },
        include: { branch: { select: { code: true } } },
        orderBy: { lastVisitedAt: "asc" },
        take: 30,
      }),
      prisma.accessDevice.findMany({
        where: { orgId: ctx.org.id, branchId: { in: branchIds } },
        include: { branch: { select: { code: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const quickTokens = [
    sampleActive && { label: "Active", ...sampleActive },
    sampleExpiring && { label: "Expiring", ...sampleExpiring },
    sampleExpired && { label: "Expired (Block)", ...sampleExpired },
    sampleFrozen && { label: "Frozen (Block)", ...sampleFrozen },
  ].filter((x): x is { label: string; fullName: string; qrToken: string; memberCode: string } => Boolean(x));

  return (
    <CheckInDeskClient
      branchId={activeBranchId}
      branches={ctx.visibleBranches}
      todayCount={todayCount}
      onFloorCount={onFloorCount}
      turnstileConfigured={Boolean(process.env.TURNSTILE_WEBHOOK_URL) || accessDevices.length > 0}
      quickTokens={quickTokens}
      recentLogs={recentLogs.map((c) => ({
        id: c.id,
        memberId: c.member.id,
        fullName: c.member.fullName,
        memberCode: c.member.memberCode,
        branchCode: c.branch.code,
        visitedAt: formatDateInBranchTz(c.visitedAt, c.branch.timezone, true),
        checkedOut: Boolean(c.checkedOutAt),
        method: c.method,
        result: c.result,
        overrideReason: c.overrideReason,
        distanceMeters: c.distanceMeters,
      }))}
      devices={accessDevices.map((d) => ({
        id: d.id,
        branchCode: d.branch.code,
        serialNumber: d.serialNumber,
        name: d.name,
        vendor: d.vendor,
        mode: d.mode,
        status: d.status,
        lastHeartbeat: d.lastHeartbeatAt ? formatDateInBranchTz(d.lastHeartbeatAt, "Asia/Kolkata", true) : "Never",
      }))}
      absentees={absenteesRaw.map((m) => {
        const lastMs = m.lastVisitedAt?.getTime() ?? 0;
        const bucket =
          lastMs < cutoff30d.getTime() ? "30d+" : lastMs < cutoff14d.getTime() ? "14d+" : "7d+";
        const daysAway = m.lastVisitedAt
          ? Math.max(7, Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000))
          : 30;
        return {
          id: m.id,
          memberCode: m.memberCode,
          fullName: m.fullName,
          phone: m.phone,
          branchCode: m.branch.code,
          status: m.status,
          bucket,
          daysAway,
        };
      })}
    />
  );
}
