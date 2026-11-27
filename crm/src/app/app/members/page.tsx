import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { maskPhoneForRole } from "@/lib/privacy-guard";
import { MembersDirectoryClient } from "@/components/members-client";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tag?: string; page?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: true });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const query = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "ALL").toUpperCase();
  const tagFilter = (sp.tag ?? "").trim().toLowerCase();
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
    ...(tagFilter ? { tags: { has: tagFilter } } : {}),
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

  const [totalCount, rows, statusCounts, savedViews, customFields, trainers] = await Promise.all([
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
    prisma.savedView.findMany({
      where: { orgId: ctx.org.id, entityType: "MEMBERS" },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),
    prisma.customFieldDefinition.findMany({
      where: { orgId: ctx.org.id, entityType: "MEMBER", isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.orgMembership.findMany({
      where: { orgId: ctx.org.id, role: "TRAINER" },
      include: { user: { select: { id: true, name: true } } },
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
      initialTag={tagFilter}
      openNewOnMount={sp.action === "new"}
      statusCounts={countsMap}
      savedViews={savedViews.map((v) => ({
        id: v.id,
        name: v.name,
        filterJson: (v.filterJson ?? {}) as { status?: string; q?: string; tag?: string },
      }))}
      customFields={customFields.map((c) => ({
        id: c.id,
        fieldKey: c.fieldKey,
        label: c.label,
        fieldType: c.fieldType,
        options: Array.isArray(c.optionsJson) ? (c.optionsJson as string[]) : [],
        required: c.required,
      }))}
      trainers={trainers.map((t) => t.user)}
      rows={rows.map((m) => ({
        id: m.id,
        memberCode: m.memberCode,
        fullName: m.fullName,
        phone: maskPhoneForRole(m.phone, ctx.role),
        email: m.email ?? "",
        branchName: m.branch.name,
        branchCode: m.branch.code,
        status: m.status,
        expiryDate: m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : null,
        lastVisitedAt: m.lastVisitedAt ? m.lastVisitedAt.toISOString().slice(0, 10) : null,
        planName: m.subscriptions[0]?.plan.name ?? "No Active Plan",
        tags: m.tags,
        walletBalancePaise: m.walletBalancePaise,
      }))}
    />
  );
}
