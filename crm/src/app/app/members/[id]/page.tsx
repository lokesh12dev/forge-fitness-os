import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { decryptSensitiveField } from "@/lib/encryption";
import { createSignedObjectUrl } from "@/lib/adapters/storage";
import { AuthorizationError, canAccessBranch, canAccessFinance, hasPermission } from "@/lib/rbac";
import { formatDateInBranchTz } from "@/lib/membership-math";
import { MemberProfileClient } from "@/components/member-profile-client";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: true });

  const member = await prisma.member.findFirst({
    where: { id, orgId: ctx.org.id, deletedAt: null },
    include: {
      branch: true,
      group: true,
      assignedTrainer: { select: { id: true, name: true } },
      subscriptions: {
        include: { plan: true },
        orderBy: { startDate: "desc" },
      },
      freezes: { orderBy: { createdAt: "desc" } },
      measurements: { orderBy: { recordedAt: "desc" }, take: 12 },
      documents: { orderBy: { createdAt: "desc" } },
      notes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      comms: { orderBy: { createdAt: "desc" }, take: 25 },
      consents: { orderBy: { recordedAt: "desc" } },
      checkIns: { orderBy: { visitedAt: "desc" }, take: 45 },
      planAssignments: {
        include: {
          template: true,
          trainer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!member) notFound();
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member belongs to a branch outside your scope.");
  }

  const showFinance = canAccessFinance(ctx.role);
  const canReadHealth = hasPermission(ctx.role, "members:health:read");

  const [invoices, plans, addons, promoCodes, workoutTemplates, customFields] = await Promise.all([
    showFinance
      ? prisma.invoice.findMany({
          where: { orgId: ctx.org.id, memberId: member.id },
          orderBy: { issueDate: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.plan.findMany({ where: { orgId: ctx.org.id, isActive: true }, orderBy: { pricePaise: "asc" } }),
    prisma.planAddon.findMany({ where: { orgId: ctx.org.id, isActive: true } }),
    prisma.promoCode.findMany({ where: { orgId: ctx.org.id, isActive: true } }),
    prisma.workoutDietTemplate.findMany({ where: { orgId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.customFieldDefinition.findMany({
      where: { orgId: ctx.org.id, entityType: "MEMBER", isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const now = new Date();
  const recentCheckInDays = member.checkIns
    .filter((c) => c.visitedAt.getTime() >= now.getTime() - 30 * 86_400_000)
    .map((c) => Number(c.visitedAt.toLocaleDateString("en-CA", { day: "2-digit", timeZone: member.branch.timezone })));

  return (
    <MemberProfileClient
      role={ctx.role}
      currency={ctx.org.currency}
      showFinance={showFinance}
      member={{
        id: member.id,
        memberCode: member.memberCode,
        qrToken: member.qrToken,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email ?? "",
        address: member.address ?? "",
        stateCode: member.stateCode,
        emergencyName: member.emergencyName ?? "",
        emergencyPhone: member.emergencyPhone ?? "",
        goals: member.goals ?? "",
        healthNotes: canReadHealth ? decryptSensitiveField(member.healthNotesEnc) : "[Restricted]",
        status: member.status,
        expiryDate: member.expiryDate ? member.expiryDate.toISOString().slice(0, 10) : null,
        branchName: member.branch.name,
        branchCode: member.branch.code,
        groupLabel: member.group ? `${member.group.name} (${member.group.type})` : null,
        trainerName: member.assignedTrainer?.name ?? "Unassigned",
        referralCode: member.referralCode,
        tags: member.tags,
        walletBalancePaise: member.walletBalancePaise,
        customFieldsJson: (member.customFieldsJson ?? {}) as Record<string, unknown>,
      }}
      subscriptions={member.subscriptions.map((s) => ({
        id: s.id,
        planId: s.planId,
        planName: s.plan.name,
        status: s.status,
        startDate: s.startDate.toISOString().slice(0, 10),
        endDate: s.endDate.toISOString().slice(0, 10),
        basePricePaise: s.basePricePaise,
        maxFreezeDays: s.plan.maxFreezeDays,
        freezeDaysUsed: s.freezeDaysUsed,
        sessionsRemaining: s.sessionsRemaining,
        autoRenew: s.autoRenew,
      }))}
      freezes={member.freezes.map((f) => ({
        id: f.id,
        startDate: f.startDate.toISOString().slice(0, 10),
        endDate: f.endDate.toISOString().slice(0, 10),
        daysCount: f.daysCount,
        reason: f.reason,
      }))}
      invoices={invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        issueDate: formatDateInBranchTz(i.issueDate, member.branch.timezone),
        status: i.status,
        totalPaise: i.totalPaise,
        paidPaise: i.paidPaise,
        balanceDuePaise: i.balanceDuePaise,
      }))}
      checkInDays={Array.from(new Set(recentCheckInDays))}
      recentCheckIns={member.checkIns.slice(0, 15).map((c) => ({
        id: c.id,
        visitedAt: formatDateInBranchTz(c.visitedAt, member.branch.timezone, true),
        method: c.method,
        result: c.result,
        overrideReason: c.overrideReason,
      }))}
      measurements={member.measurements.map((m) => ({
        id: m.id,
        date: formatDateInBranchTz(m.recordedAt, member.branch.timezone),
        weightKg: (m.weightGrams / 1000).toFixed(1),
        bodyFatPct: m.bodyFatBps ? (m.bodyFatBps / 100).toFixed(1) : "--",
        waistCm: m.waistMm ? (m.waistMm / 10).toFixed(1) : "--",
        notes: m.notes ?? "",
      }))}
      documents={member.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        signedAt: d.signedAt ? formatDateInBranchTz(d.signedAt, member.branch.timezone, true) : null,
        signedIp: d.signedIp,
        kycLast4: d.kycLast4,
        downloadUrl: d.fileKey ? createSignedObjectUrl(d.fileKey) : null,
      }))}
      consents={member.consents.map((c) => ({
        id: c.id,
        channel: c.channel,
        granted: c.granted,
        source: c.source,
      }))}
      notes={member.notes.map((n) => ({
        id: n.id,
        kind: n.kind,
        authorName: n.author.name,
        body: n.body,
        createdAt: formatDateInBranchTz(n.createdAt, member.branch.timezone, true),
      }))}
      comms={member.comms.map((cm) => ({
        id: cm.id,
        channel: cm.channel,
        status: cm.status,
        body: cm.body,
        createdAt: formatDateInBranchTz(cm.createdAt, member.branch.timezone, true),
      }))}
      planAssignments={member.planAssignments.map((pa) => ({
        id: pa.id,
        templateName: pa.template.name,
        goal: pa.template.goal,
        dietType: pa.template.dietType,
        caloriesTarget: pa.template.caloriesTarget,
        proteinGrams: pa.template.proteinGrams,
        trainerName: pa.trainer.name,
        syncToken: pa.syncToken,
        syncedAt: pa.syncedAt ? formatDateInBranchTz(pa.syncedAt, member.branch.timezone, true) : null,
      }))}
      workoutTemplates={workoutTemplates.map((wt) => ({
        id: wt.id,
        name: wt.name,
        dietType: wt.dietType,
        caloriesTarget: wt.caloriesTarget,
      }))}
      customFields={customFields.map((cf) => ({
        id: cf.id,
        fieldKey: cf.fieldKey,
        label: cf.label,
        fieldType: cf.fieldType,
        options: Array.isArray(cf.optionsJson) ? (cf.optionsJson as string[]) : [],
      }))}
      catalogPlans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        pricePaise: p.pricePaise,
        joiningFeePaise: p.joiningFeePaise,
        durationDays: p.durationDays,
        gstRateBps: p.gstRateBps,
      }))}
      catalogAddons={addons.map((a) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise }))}
      promoCodes={promoCodes.map((p) => p.code)}
    />
  );
}
