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

  const [classTypes, sessions, members, trainers, feedbacks] = await Promise.all([
    prisma.classType.findMany({
      where: { orgId: ctx.org.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.classSession.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { startsAt: "asc" },
      include: {
        branch: { select: { name: true } },
        classType: { select: { category: true, colorTag: true, noShowFeePaise: true } },
        trainer: { select: { id: true, name: true } },
        bookings: {
          where: { status: { not: "CANCELLED" } },
          orderBy: [{ status: "asc" }, { waitlistPos: "asc" }],
          include: { member: { select: { id: true, fullName: true, memberCode: true } } },
        },
      },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null, status: { in: ["ACTIVE", "EXPIRING"] } },
      take: 80,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, memberCode: true },
    }),
    prisma.orgMembership.findMany({
      where: { orgId: ctx.org.id, role: "TRAINER" },
      include: { user: { select: { id: true, name: true } } },
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
      canManage={canManage}
      currency={ctx.org.currency}
      branches={ctx.visibleBranches.filter((b) => branchIds.includes(b.id)).map((b) => ({ id: b.id, name: b.name }))}
      classTypes={classTypes.map((ct) => ({
        id: ct.id,
        name: ct.name,
        category: ct.category,
        defaultCapacity: ct.defaultCapacity,
      }))}
      trainers={trainers.map((t) => t.user)}
      members={members}
      sessions={sessions.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        branchName: s.branch.name,
        title: s.title,
        category: s.classType.category,
        trainerName: s.trainer.name,
        studioRoom: s.studioRoom,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        capacity: s.capacity,
        cutoffMinutes: s.cutoffMinutes,
        noShowFeePaise: s.classType.noShowFeePaise,
        bookings: s.bookings.map((b) => ({
          id: b.id,
          memberName: b.member.fullName,
          memberCode: b.member.memberCode,
          status: b.status,
          waitlistPos: b.waitlistPos,
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
