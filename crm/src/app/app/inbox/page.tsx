import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { AuthorizationError, hasPermission } from "@/lib/rbac";
import { filterCampaignRecipients, type SegmentCandidate, type SegmentKey } from "@/lib/segments";
import { InboxClient } from "@/components/inbox-client";

const SEGMENT_KEYS: SegmentKey[] = [
  "EXPIRING",
  "INACTIVE",
  "BIRTHDAY",
  "UNPAID",
  "PT_CLIENTS",
  "NEW_JOINERS",
];

export default async function InboxPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });
  const canReadInbox = hasPermission(ctx.role, "inbox:read");
  const canWriteInbox = hasPermission(ctx.role, "inbox:write");
  const canBroadcast = hasPermission(ctx.role, "campaigns:broadcast");

  if (!canReadInbox && !canBroadcast) {
    throw new AuthorizationError(`Role ${ctx.role} lacks permission for Communication Center.`);
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  const [threads, templates, campaigns, staffMemberships, members] = await Promise.all([
    prisma.inboxThread.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds } },
      orderBy: { lastMessageAt: "desc" },
      include: {
        branch: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.messageTemplate.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.broadcastCampaign.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.orgMembership.findMany({
      where: { orgId: ctx.org.id, role: { in: ["OWNER", "MANAGER", "FRONTDESK"] } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        status: true,
        expiryDate: true,
        lastVisitedAt: true,
        dob: true,
        createdAt: true,
        tags: true,
        consents: {
          where: { channel: "WHATSAPP" },
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { granted: true },
        },
        subscriptions: {
          orderBy: { endDate: "desc" },
          take: 1,
          select: { plan: { select: { name: true, billingModel: true } } },
        },
        invoices: {
          where: { balanceDuePaise: { gt: 0 } },
          select: { balanceDuePaise: true },
        },
      },
    }),
  ]);

  const candidates: SegmentCandidate[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    status: m.status,
    expiryDate: m.expiryDate,
    lastVisitedAt: m.lastVisitedAt,
    dob: m.dob,
    createdAt: m.createdAt,
    balanceDuePaise: m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0),
    planName: m.subscriptions[0]?.plan.name ?? "Club Membership",
    billingModel: m.subscriptions[0]?.plan.billingModel ?? null,
    tags: m.tags,
    whatsappOptIn: m.consents[0]?.granted ?? true,
  }));

  const segmentCounts: Record<SegmentKey, { matched: number; eligible: number; optedOut: number }> = {
    EXPIRING: { matched: 0, eligible: 0, optedOut: 0 },
    INACTIVE: { matched: 0, eligible: 0, optedOut: 0 },
    BIRTHDAY: { matched: 0, eligible: 0, optedOut: 0 },
    UNPAID: { matched: 0, eligible: 0, optedOut: 0 },
    PT_CLIENTS: { matched: 0, eligible: 0, optedOut: 0 },
    NEW_JOINERS: { matched: 0, eligible: 0, optedOut: 0 },
  };
  for (const key of SEGMENT_KEYS) {
    const res = filterCampaignRecipients(candidates, key);
    segmentCounts[key] = {
      matched: res.matched.length,
      eligible: res.eligibleOptIn.length,
      optedOut: res.optedOutCount,
    };
  }

  const totalOptedIn = candidates.filter((c) => c.whatsappOptIn).length;
  const totalOptedOut = candidates.length - totalOptedIn;

  return (
    <InboxClient
      canWriteInbox={canWriteInbox}
      canBroadcast={canBroadcast}
      activeBranchId={ctx.activeBranchId}
      staff={staffMemberships.map((s) => s.user)}
      segmentCounts={segmentCounts}
      consentSummary={{ totalOptedIn, totalOptedOut }}
      threads={threads.map((t) => ({
        id: t.id,
        contactName: t.contactName,
        contactPhone: t.contactPhone,
        channel: t.channel,
        branchName: t.branch.name,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedTo?.name ?? "Unassigned",
        unreadCount: t.unreadCount,
        lastPreview: t.lastPreview,
        lastMessageAt: t.lastMessageAt.toISOString(),
        messages: t.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          status: m.status,
          senderName: m.senderName,
          createdAt: m.createdAt.toISOString(),
        })),
      }))}
      templates={templates.map((tp) => ({
        id: tp.id,
        code: tp.code,
        name: tp.name,
        channel: tp.channel,
        body: tp.body,
        variables: tp.variables,
        approvalStatus: tp.approvalStatus,
      }))}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        segmentKey: c.segmentKey,
        channel: c.channel,
        throttlePerMin: c.throttlePerMin,
        targetCount: c.targetCount,
        sentCount: c.sentCount,
        deliveredCount: c.deliveredCount,
        readCount: c.readCount,
        repliedCount: c.repliedCount,
        blockedOptOutCount: c.blockedOptOutCount,
        scheduledAt: c.scheduledAt.toISOString(),
      }))}
    />
  );
}
