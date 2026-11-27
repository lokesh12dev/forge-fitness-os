import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ClassesClient } from "@/components/classes-client";

export default async function ClassesPage() {
  const ctx = await requireAuthContext({
    permission: "classes:read",
    redirectOnUnauth: true,
  });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const canManage = hasPermission(ctx.role, "classes:manage");

  const [sessions, classTypes, trainerUsers, members, feedbacks] = await Promise.all([
    prisma.classSession.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { startsAt: "asc" },
      take: 36,
      include: {
        classType: {
          select: {
            name: true,
            category: true,
            noShowFeePaise: true,
            layoutRows: true,
            layoutCols: true,
            layoutPrefix: true,
          },
        },
        trainer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        bookings: {
          orderBy: [{ status: "asc" }, { waitlistPos: "asc" }, { bookedAt: "asc" }],
          include: { member: { select: { id: true, fullName: true, memberCode: true } } },
        },
      },
    }),
    prisma.classType.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { name: "asc" },
    }),
    prisma.trainerProfile.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null, status: { in: ["ACTIVE", "EXPIRING"] } },
      take: 80,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberCode: true },
    }),
    prisma.memberFeedbackNps.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { member: { select: { fullName: true, memberCode: true } } },
    }),
  ]);

  return (
    <ClassesClient
      currency={ctx.org.currency}
      canManage={canManage}
      branches={ctx.visibleBranches
        .filter((b) => branchIds.includes(b.id))
        .map((b) => ({ id: b.id, name: b.name }))}
      classTypes={classTypes.map((ct) => ({
        id: ct.id,
        name: ct.name,
        category: ct.category,
        defaultDurationMin: ct.defaultDurationMin,
        defaultCapacity: ct.defaultCapacity,
        noShowFeePaise: ct.noShowFeePaise,
        cutoffMinutes: ct.cutoffMinutes,
        layoutRows: ct.layoutRows,
        layoutCols: ct.layoutCols,
        layoutPrefix: ct.layoutPrefix,
      }))}
      trainers={trainerUsers.map((t) => ({ id: t.user.id, name: t.user.name }))}
      members={members}
      sessions={sessions.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        branchName: s.branch.name,
        title: s.title,
        category: s.classType.category,
        studioRoom: s.studioRoom,
        trainerName: s.trainer.name,
        startsAt: s.startsAt.toISOString(),
        capacity: s.capacity,
        cutoffMinutes: s.cutoffMinutes,
        noShowFeePaise: s.classType.noShowFeePaise,
        layoutRows: s.classType.layoutRows,
        layoutCols: s.classType.layoutCols,
        layoutPrefix: s.classType.layoutPrefix,
        bookings: s.bookings.map((b) => ({
          id: b.id,
          memberName: b.member.fullName,
          memberCode: b.member.memberCode,
          status: b.status,
          waitlistPos: b.waitlistPos,
          spotCode: b.spotCode,
        })),
      }))}
      feedbacks={feedbacks.map((f) => ({
        id: f.id,
        memberName: f.member.fullName,
        memberCode: f.member.memberCode,
        npsScore: f.npsScore,
        category: f.category,
        comment: f.comment,
        createdAt: f.createdAt.toISOString(),
      }))}
    />
  );
}
