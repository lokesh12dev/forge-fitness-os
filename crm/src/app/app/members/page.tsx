import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { MembersDirectoryClient } from "@/components/members-client";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: true });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const query = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "ALL").toUpperCase();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 25;

  const whereClause = {
    orgId: ctx.org.id,
    branchId: { in: branchIds },
    deletedAt: null,
    mergedIntoMemberId: null,
    ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
    ...(statusFilter !== "ALL" && ["ACTIVE", "EXPIRING", "OVERDUE", "FROZEN", "EXPIRED"].includes(statusFilter)
      ? { status: statusFilter as "ACTIVE" | "EXPIRING" | "OVERDUE" | "FROZEN" | "EXPIRED" }
      : {}),
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" as const } },
            { memberCode: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [totalCount, rows, statusCounts] = await Promise.all([
    prisma.member.count({ where: whereClause }),
    prisma.member.findMany({
      where: whereClause,
      include: {
        branch: { select: { name: true, code: true, stateCode: true } },
        subscriptions: {
          orderBy: { endDate: "desc" },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.member.groupBy({
      by: ["status"],
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        deletedAt: null,
        mergedIntoMemberId: null,
        ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const countsMap: Record<string, number> = {
    ACTIVE: 0,
    EXPIRING: 0,
    OVERDUE: 0,
    FROZEN: 0,
    EXPIRED: 0,
  };
  for (const row of statusCounts) {
    countsMap[row.status] = row._count._all;
  }

  return (
    <MembersDirectoryClient
      role={ctx.role}
      activeBranchId={ctx.activeBranchId}
      branches={ctx.visibleBranches}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      initialQuery={query}
      initialStatus={statusFilter}
      openNewOnMount={sp.action === "new"}
      statusCounts={countsMap}
      rows={rows.map((m) => ({
        id: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email ?? "",
        branchName: m.branch.name,
        branchCode: m.branch.code,
        status: m.status,
        expiryDate: m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : null,
        lastVisitedAt: m.lastVisitedAt ? m.lastVisitedAt.toISOString().slice(0, 10) : null,
        planName: m.subscriptions[0]?.plan.name ?? "No Active Plan",
        tags: m.tags,
      }))}
    />
  );
}
