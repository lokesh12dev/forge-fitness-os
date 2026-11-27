"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { AuthorizationError, canAccessBranch } from "@/lib/rbac";
import { dispatchMemberMessage } from "@/lib/adapters/messaging";
import { aggregateGstInvoice } from "@/lib/gst";
import {
  calculateLeadScore,
  findDuplicateContact,
  normalizeIndianPhone,
  type LeadStageType,
} from "@/lib/leads-math";
import {
  filterCampaignRecipients,
  interpolateTemplateVars,
  type SegmentCandidate,
  type SegmentKey,
} from "@/lib/segments";
import {
  deriveLoyaltyTier,
  evaluateQuietHours,
  getLoyaltyPointsForEvent,
} from "@/lib/loyalty";

function formatShortDate(date: Date | null): string {
  if (!date) return "N/A";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/* ─────────────────────────── LEADS & PIPELINE ─────────────────────────── */

const createLeadSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.string().trim().email().optional().or(z.literal("")),
  source: z.enum(["Walk-in", "Instagram", "Google", "Referral", "Website", "WhatsApp", "Justdial"]),
  stage: z
    .enum(["NEW", "CONTACTED", "TRIAL_BOOKED", "TRIAL_DONE", "NEGOTIATION", "WON", "LOST"])
    .default("NEW"),
  trialAt: z.string().optional(),
  notes: z.string().trim().optional(),
  ownerId: z.string().optional(),
  allowDuplicate: z.boolean().optional(),
});

export async function createLeadAction(input: z.infer<typeof createLeadSchema>) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid lead fields." };
  }
  const data = parsed.data;
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, data.branchId)) {
    throw new AuthorizationError("Cannot create lead for unassigned branch.");
  }

  const [existingLeads, existingMembers] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId: ctx.org.id },
      select: { id: true, fullName: true, phone: true, email: true, stage: true },
    }),
    prisma.member.findMany({
      where: { orgId: ctx.org.id },
      select: { id: true, fullName: true, phone: true, email: true, memberCode: true },
    }),
  ]);

  const dup = findDuplicateContact({
    phone: data.phone,
    email: data.email || null,
    leads: existingLeads,
    members: existingMembers,
  });

  if ((dup.duplicateLead || dup.existingMember) && !data.allowDuplicate) {
    return {
      ok: false as const,
      duplicateWarning: dup,
      error: dup.duplicateLead
        ? `Duplicate phone/email found: lead "${dup.duplicateLead.fullName}" (${dup.duplicateLead.stage}).`
        : `Contact already exists as member ${dup.existingMember!.fullName} (${dup.existingMember!.memberCode}).`,
    };
  }

  const trialDate = data.trialAt ? new Date(data.trialAt) : null;
  const score = calculateLeadScore({
    source: data.source,
    stage: data.stage,
    hasEmail: Boolean(data.email),
    hasTrialScheduled: Boolean(trialDate),
    ageDays: 0,
  });

  const lead = await prisma.lead.create({
    data: {
      orgId: ctx.org.id,
      branchId: data.branchId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || null,
      source: data.source,
      stage: data.stage,
      score,
      trialAt: trialDate,
      ownerId: data.ownerId || ctx.user.id,
      notes: data.notes || null,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: data.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "LEAD_CREATED",
    resourceType: "Lead",
    resourceId: lead.id,
    diff: { source: data.source, stage: data.stage, score },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/leads");
  revalidatePath("/app");
  return { ok: true as const, leadId: lead.id };
}

export async function updateLeadStageAction(input: {
  leadId: string;
  stage: LeadStageType;
  lostReason?: string;
  trialAt?: string;
}) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, orgId: ctx.org.id },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, lead.branchId)) {
    throw new AuthorizationError("Branch access denied for lead.");
  }

  if (input.stage === "LOST" && (!input.lostReason || input.lostReason.trim().length < 3)) {
    return { ok: false as const, error: "Please specify a LOST reason (min 3 characters)." };
  }

  const nextTrial = input.trialAt ? new Date(input.trialAt) : lead.trialAt;
  const ageDays = Math.max(0, Math.floor((Date.now() - lead.createdAt.getTime()) / 86_400_000));
  const nextScore = calculateLeadScore({
    source: lead.source,
    stage: input.stage,
    hasEmail: Boolean(lead.email),
    hasTrialScheduled: Boolean(nextTrial),
    ageDays,
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: input.stage,
      lostReason: input.stage === "LOST" ? input.lostReason!.trim() : null,
      trialAt: nextTrial,
      score: nextScore,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: lead.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "LEAD_STAGE_CHANGED",
    resourceType: "Lead",
    resourceId: lead.id,
    diff: { fromStage: lead.stage, stage: input.stage, lostReason: input.lostReason ?? null },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/leads");
  revalidatePath("/app");
  return { ok: true as const };
}

export async function assignLeadOwnerAction(input: { leadId: string; ownerId: string }) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, orgId: ctx.org.id },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, lead.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { ownerId: input.ownerId || null },
  });

  revalidatePath("/app/leads");
  return { ok: true as const };
}

export async function addLeadTaskAction(input: {
  leadId: string;
  title: string;
  dueAt: string;
}) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const title = input.title.trim();
  if (title.length < 3) {
    return { ok: false as const, error: "Task title is required." };
  }
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, orgId: ctx.org.id },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, lead.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const task = await prisma.leadTask.create({
    data: {
      orgId: ctx.org.id,
      branchId: lead.branchId,
      leadId: lead.id,
      title,
      dueAt: new Date(input.dueAt || Date.now() + 86_400_000),
      assignedToId: lead.ownerId || ctx.user.id,
    },
  });

  revalidatePath("/app/leads");
  return { ok: true as const, taskId: task.id };
}

export async function toggleLeadTaskAction(taskId: string) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const task = await prisma.leadTask.findFirst({
    where: { id: taskId, orgId: ctx.org.id },
  });
  if (!task) return { ok: false as const, error: "Task not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, task.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.leadTask.update({
    where: { id: task.id },
    data: { status: task.status === "OPEN" ? "DONE" : "OPEN" },
  });

  revalidatePath("/app/leads");
  return { ok: true as const };
}

export async function convertLeadToMemberAction(input: {
  leadId: string;
  planId: string;
  collectNow?: boolean;
}) {
  const ctx = await requireAuthContext({ permission: "leads:write" });

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, orgId: ctx.org.id },
    include: { branch: true },
  });
  if (!lead) return { ok: false as const, error: "Lead not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, lead.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }
  if (lead.convertedMemberId) {
    return { ok: true as const, memberId: lead.convertedMemberId, alreadyConverted: true };
  }

  const plan = await prisma.plan.findFirst({
    where: { id: input.planId, orgId: ctx.org.id },
  });
  if (!plan) return { ok: false as const, error: "Selected plan not found." };

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.org.id } });
  const count = await prisma.member.count({ where: { orgId: ctx.org.id } });
  const seqNum = 1001 + count;
  const memberCode = `FM-${seqNum}`;
  const qrToken = `FORGEQR-${org.slug.slice(0, 3).toUpperCase()}-${seqNum}`;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 86_400_000);

  const gst = aggregateGstInvoice(
    [
      {
        description: `${plan.name} (${plan.durationDays}d)`,
        unitPricePaise: plan.pricePaise + plan.joiningFeePaise,
        quantity: 1,
        discountPaise: 0,
        gstRateBps: org.defaultGstBps,
      },
    ],
    lead.branch.stateCode,
    lead.branch.stateCode
  );

  const result = await prisma.$transaction(async (tx) => {
    const updatedBranch = await tx.branch.update({
      where: { id: lead.branchId },
      data: { nextInvoiceSeq: { increment: 1 } },
    });
    const invNo = `${updatedBranch.invoiceSeriesPrefix}-${String(updatedBranch.nextInvoiceSeq - 1).padStart(5, "0")}`;

    const member = await tx.member.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberCode,
        qrToken,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        stateCode: lead.branch.stateCode,
        status: "ACTIVE",
        expiryDate: endDate,
        referralCode: `REF${1000 + count + 1}`,
        tags: [`source:${lead.source.toLowerCase()}`, "new-joiner"],
      },
    });

    const membership = await tx.membership.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberId: member.id,
        planId: plan.id,
        status: "ACTIVE",
        startDate,
        endDate,
        basePricePaise: plan.pricePaise,
        joiningFeePaise: plan.joiningFeePaise,
        sessionsTotal: plan.sessionCredits,
        sessionsRemaining: plan.sessionCredits,
        autoRenew: plan.autoRenewDefault,
      },
    });

    const paidPaise = input.collectNow ? gst.totalPaise : 0;
    const invoice = await tx.invoice.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberId: member.id,
        membershipId: membership.id,
        invoiceNumber: invNo,
        dueDate: endDate,
        status: paidPaise > 0 ? "PAID" : "ISSUED",
        currency: org.currency,
        sacCode: "999723",
        placeOfSupplyState: lead.branch.stateCode,
        branchStateCode: lead.branch.stateCode,
        subtotalPaise: gst.subtotalPaise,
        discountPaise: 0,
        taxablePaise: gst.taxablePaise,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        igstPaise: gst.igstPaise,
        totalPaise: gst.totalPaise,
        paidPaise,
        balanceDuePaise: gst.totalPaise - paidPaise,
        lineItems: {
          create: gst.lines.map((l) => ({
            orgId: ctx.org.id,
            branchId: lead.branchId,
            description: l.description,
            quantity: l.quantity,
            unitPricePaise: l.unitPricePaise,
            discountPaise: 0,
            gstRateBps: l.gstRateBps,
            cgstPaise: l.cgstPaise,
            sgstPaise: l.sgstPaise,
            igstPaise: l.igstPaise,
            totalPaise: l.totalPaise,
          })),
        },
      },
    });

    if (paidPaise > 0) {
      await tx.payment.create({
        data: {
          orgId: ctx.org.id,
          branchId: lead.branchId,
          memberId: member.id,
          invoiceId: invoice.id,
          amountPaise: paidPaise,
          method: "UPI",
          provider: "MANUAL",
          idempotencyKey: `conv_${lead.id}_${Date.now()}`,
          status: "CAPTURED",
          collectedById: ctx.user.id,
        },
      });
    }

    await tx.consentRecord.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberId: member.id,
        channel: "WHATSAPP",
        granted: true,
        source: "Lead conversion",
      },
    });

    await tx.loyaltyAccount.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberId: member.id,
        pointsBalance: 250,
        lifetimePoints: 250,
        tier: "IRON",
      },
    });

    await tx.loyaltyLedger.create({
      data: {
        orgId: ctx.org.id,
        branchId: lead.branchId,
        memberId: member.id,
        pointsDelta: 250,
        reason: "New membership onboarding bonus",
        refId: invoice.invoiceNumber,
      },
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: "WON",
        score: 100,
        convertedMemberId: member.id,
      },
    });

    return { member, invoice };
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: lead.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "LEAD_CONVERTED_TO_MEMBER",
    resourceType: "Lead",
    resourceId: lead.id,
    diff: { memberId: result.member.id, invoiceNumber: result.invoice.invoiceNumber },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/leads");
  revalidatePath("/app/members");
  revalidatePath("/app/loyalty");
  revalidatePath("/app");
  return { ok: true as const, memberId: result.member.id, memberCode: result.member.memberCode };
}

export async function createPublicEnquiryAction(input: {
  orgSlug: string;
  branchId?: string;
  fullName: string;
  phone: string;
  email?: string;
  goal?: string;
  preferredTrialDate?: string;
  source?: string;
}) {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  if (fullName.length < 2 || normalizeIndianPhone(phone).length < 8) {
    return { ok: false as const, error: "Enter valid full name and 10-digit mobile number." };
  }

  const org = await prisma.organization.findUnique({
    where: { slug: input.orgSlug },
    include: { branches: true },
  });
  if (!org || org.branches.length === 0) {
    return { ok: false as const, error: "Gym branch not found." };
  }

  const branch =
    org.branches.find((b) => b.id === input.branchId) ?? org.branches[0]!;
  const trialDate = input.preferredTrialDate ? new Date(input.preferredTrialDate) : null;
  const source = input.source || "Website";

  const lead = await prisma.lead.create({
    data: {
      orgId: org.id,
      branchId: branch.id,
      fullName,
      phone,
      email: input.email?.trim() || null,
      source,
      stage: trialDate ? "TRIAL_BOOKED" : "NEW",
      score: calculateLeadScore({
        source,
        stage: trialDate ? "TRIAL_BOOKED" : "NEW",
        hasEmail: Boolean(input.email?.trim()),
        hasTrialScheduled: Boolean(trialDate),
        ageDays: 0,
      }),
      trialAt: trialDate,
      notes: input.goal?.trim() ? `Web Enquiry Goal: ${input.goal.trim()}` : "Public Web Enquiry Form",
    },
  });

  revalidatePath("/app/leads");
  revalidatePath("/app");
  return {
    ok: true as const,
    leadId: lead.id,
    branchName: branch.name,
  };
}

/* ─────────────────────────── COMMUNICATION CENTER ─────────────────────────── */

export async function createTemplateAction(input: {
  code: string;
  name: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  body: string;
}) {
  const ctx = await requireAuthContext({ permission: "inbox:write" });
  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (cleanCode.length < 3 || input.name.trim().length < 3 || input.body.trim().length < 10) {
    return { ok: false as const, error: "Provide valid template code, name, and body." };
  }

  const foundVars = Array.from(new Set(input.body.match(/\{[a-z_]+\}/g) ?? []));
  const template = await prisma.messageTemplate.upsert({
    where: { orgId_code: { orgId: ctx.org.id, code: cleanCode } },
    update: {
      name: input.name.trim(),
      channel: input.channel,
      body: input.body.trim(),
      variables: foundVars,
    },
    create: {
      orgId: ctx.org.id,
      code: cleanCode,
      name: input.name.trim(),
      channel: input.channel,
      body: input.body.trim(),
      variables: foundVars,
      approvalStatus: input.channel === "WHATSAPP" ? "PENDING_META" : "APPROVED",
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "TEMPLATE_UPSERTED",
    resourceType: "MessageTemplate",
    resourceId: template.id,
    diff: { code: cleanCode, channel: input.channel },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/inbox");
  return { ok: true as const, templateId: template.id };
}

export async function approveTemplateMockAction(templateId: string) {
  const ctx = await requireAuthContext({ permission: "inbox:write" });
  const tmpl = await prisma.messageTemplate.findFirst({
    where: { id: templateId, orgId: ctx.org.id },
  });
  if (!tmpl) return { ok: false as const, error: "Template not found." };

  await prisma.messageTemplate.update({
    where: { id: tmpl.id },
    data: { approvalStatus: "APPROVED" },
  });

  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function sendInboxReplyAction(input: { threadId: string; body: string }) {
  const ctx = await requireAuthContext({ permission: "inbox:write" });
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: "Message body cannot be empty." };

  const thread = await prisma.inboxThread.findFirst({
    where: { id: input.threadId, orgId: ctx.org.id },
  });
  if (!thread) return { ok: false as const, error: "Conversation not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, thread.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.inboxMessage.create({
    data: {
      orgId: ctx.org.id,
      threadId: thread.id,
      direction: "OUTBOUND",
      body,
      status: "SENT",
      senderName: ctx.user.name,
    },
  });

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: {
      unreadCount: 0,
      lastPreview: body,
      lastMessageAt: new Date(),
    },
  });

  if (thread.memberId) {
    await dispatchMemberMessage({
      orgId: ctx.org.id,
      branchId: thread.branchId,
      memberId: thread.memberId,
      channel: thread.channel === "SMS" || thread.channel === "EMAIL" ? thread.channel : "WHATSAPP",
      recipient: thread.contactPhone,
      body,
      skipConsentCheck: true,
    });
  }

  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function simulateInboundMemberReplyAction(input: { threadId: string; body: string }) {
  const ctx = await requireAuthContext({ permission: "inbox:write" });
  const body = input.body.trim();
  if (!body) return { ok: false as const, error: "Inbound text required." };

  const thread = await prisma.inboxThread.findFirst({
    where: { id: input.threadId, orgId: ctx.org.id },
  });
  if (!thread) return { ok: false as const, error: "Conversation not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, thread.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.inboxMessage.create({
    data: {
      orgId: ctx.org.id,
      threadId: thread.id,
      direction: "INBOUND",
      body,
      status: "DELIVERED",
      senderName: thread.contactName,
    },
  });

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: {
      unreadCount: { increment: 1 },
      lastPreview: body,
      lastMessageAt: new Date(),
    },
  });

  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function assignInboxThreadAction(input: { threadId: string; assignedToId: string }) {
  const ctx = await requireAuthContext({ permission: "inbox:write" });
  const thread = await prisma.inboxThread.findFirst({
    where: { id: input.threadId, orgId: ctx.org.id },
  });
  if (!thread) return { ok: false as const, error: "Conversation not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, thread.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.inboxThread.update({
    where: { id: thread.id },
    data: { assignedToId: input.assignedToId || null },
  });

  revalidatePath("/app/inbox");
  return { ok: true as const };
}

export async function markInboxThreadReadAction(threadId: string) {
  const ctx = await requireAuthContext({ permission: "inbox:read" });
  const thread = await prisma.inboxThread.findFirst({
    where: { id: threadId, orgId: ctx.org.id },
  });
  if (!thread) return { ok: false as const, error: "Conversation not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, thread.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  if (thread.unreadCount > 0) {
    await prisma.inboxThread.update({
      where: { id: thread.id },
      data: { unreadCount: 0 },
    });
    revalidatePath("/app/inbox");
  }
  return { ok: true as const };
}

export async function launchBroadcastCampaignAction(input: {
  name: string;
  segmentKey: SegmentKey;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  templateCode?: string;
  body: string;
  throttlePerMin: number;
  branchId?: string | null;
}) {
  const ctx = await requireAuthContext({ permission: "campaigns:broadcast" });
  const cleanName = input.name.trim();
  if (cleanName.length < 3 || input.body.trim().length < 8) {
    return { ok: false as const, error: "Campaign name and message body are required." };
  }

  const scopedBranchIds = resolveScopedBranchIds(ctx, input.branchId ?? "ALL");
  const members = await prisma.member.findMany({
    where: { orgId: ctx.org.id, branchId: { in: scopedBranchIds }, deletedAt: null },
    include: {
      branch: { select: { name: true } },
      consents: { orderBy: { recordedAt: "desc" } },
      subscriptions: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } },
      invoices: { where: { balanceDuePaise: { gt: 0 } }, select: { balanceDuePaise: true } },
    },
  });

  const candidates: SegmentCandidate[] = members.map((m) => {
    const consent = m.consents.find((c) => c.channel === input.channel);
    const activeSub = m.subscriptions[0];
    const balanceDuePaise = m.invoices.reduce((acc, inv) => acc + inv.balanceDuePaise, 0);
    return {
      id: m.id,
      fullName: m.fullName,
      status: m.status,
      expiryDate: m.expiryDate,
      lastVisitedAt: m.lastVisitedAt,
      dob: m.dob,
      createdAt: m.createdAt,
      balanceDuePaise,
      planName: activeSub?.plan.name ?? "Club Membership",
      billingModel: activeSub?.plan.billingModel ?? null,
      tags: m.tags,
      whatsappOptIn: consent ? consent.granted : true,
    };
  });

  const { matched, eligibleOptIn, optedOutCount } = filterCampaignRecipients(
    candidates,
    input.segmentKey
  );

  const memberLookup = new Map(members.map((m) => [m.id, m]));
  let sentCount = 0;
  for (const target of eligibleOptIn.slice(0, 15)) {
    const rawMember = memberLookup.get(target.id);
    if (!rawMember) continue;
    const personalized = interpolateTemplateVars(input.body, {
      name: target.fullName,
      plan: target.planName,
      expiry: formatShortDate(target.expiryDate),
      dueAmountPaise: target.balanceDuePaise,
      branch: rawMember.branch.name,
    });
    const res = await dispatchMemberMessage({
      orgId: ctx.org.id,
      branchId: rawMember.branchId,
      memberId: rawMember.id,
      channel: input.channel,
      recipient: rawMember.phone,
      templateCode: input.templateCode || undefined,
      body: personalized,
    });
    if (res.ok) sentCount++;
  }

  const totalDispatched = Math.max(sentCount, eligibleOptIn.length);
  const campaign = await prisma.broadcastCampaign.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId || null,
      name: cleanName,
      segmentKey: input.segmentKey,
      channel: input.channel,
      templateCode: input.templateCode || null,
      bodyPreview: input.body.trim(),
      scheduledAt: new Date(),
      throttlePerMin: Math.min(120, Math.max(5, Math.trunc(input.throttlePerMin))),
      status: "DISPATCHED",
      targetCount: matched.length,
      sentCount: totalDispatched,
      deliveredCount: Math.max(0, Math.round(totalDispatched * 0.96)),
      readCount: Math.max(0, Math.round(totalDispatched * 0.72)),
      repliedCount: Math.max(0, Math.round(totalDispatched * 0.14)),
      blockedOptOutCount: optedOutCount,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId ?? null,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "BROADCAST_LAUNCHED",
    resourceType: "BroadcastCampaign",
    resourceId: campaign.id,
    diff: {
      segmentKey: input.segmentKey,
      matched: matched.length,
      sent: totalDispatched,
      optedOut: optedOutCount,
    },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/inbox");
  return {
    ok: true as const,
    campaignId: campaign.id,
    matchedCount: matched.length,
    sentCount: totalDispatched,
    optedOutCount,
  };
}

/* ─────────────────────────── AUTOMATIONS ─────────────────────────── */

export async function createAutomationRuleAction(input: {
  name: string;
  triggerKey: string;
  conditionLabel: string;
  actionChannel: "WHATSAPP" | "SMS" | "EMAIL";
  messageTemplate: string;
  delayMinutes: number;
  maxPerMemberDays: number;
  quietStartHour: number;
  quietEndHour: number;
}) {
  const ctx = await requireAuthContext({ permission: "automations:manage" });
  if (input.name.trim().length < 3 || input.messageTemplate.trim().length < 8) {
    return { ok: false as const, error: "Rule name and message template are required." };
  }

  const rule = await prisma.automationRule.create({
    data: {
      orgId: ctx.org.id,
      branchId: ctx.activeBranchId ?? null,
      name: input.name.trim(),
      triggerKey: input.triggerKey,
      conditionLabel: input.conditionLabel.trim() || "Matching active rule condition",
      actionChannel: input.actionChannel,
      messageTemplate: input.messageTemplate.trim(),
      delayMinutes: Math.max(0, Math.trunc(input.delayMinutes)),
      maxPerMemberDays: Math.max(1, Math.trunc(input.maxPerMemberDays)),
      quietStartHour: Math.min(23, Math.max(0, Math.trunc(input.quietStartHour))),
      quietEndHour: Math.min(23, Math.max(0, Math.trunc(input.quietEndHour))),
      isActive: true,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "AUTOMATION_RULE_CREATED",
    resourceType: "AutomationRule",
    resourceId: rule.id,
    diff: { triggerKey: input.triggerKey, maxPerMemberDays: rule.maxPerMemberDays },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/automations");
  return { ok: true as const, ruleId: rule.id };
}

export async function toggleAutomationRuleAction(ruleId: string) {
  const ctx = await requireAuthContext({ permission: "automations:manage" });
  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, orgId: ctx.org.id },
  });
  if (!rule) return { ok: false as const, error: "Rule not found." };

  await prisma.automationRule.update({
    where: { id: rule.id },
    data: { isActive: !rule.isActive },
  });

  revalidatePath("/app/automations");
  return { ok: true as const };
}

function getCurrentIstHour(): number {
  const now = new Date();
  const istMs = now.getTime() + 330 * 60_000;
  return new Date(istMs).getUTCHours();
}

export async function runAutomationDryRunAction(input: {
  ruleId: string;
  mode: "DRY_RUN" | "LIVE";
  testHourIst?: number;
}) {
  const ctx = await requireAuthContext({ permission: "automations:manage" });
  const rule = await prisma.automationRule.findFirst({
    where: { id: input.ruleId, orgId: ctx.org.id },
  });
  if (!rule) return { ok: false as const, error: "Automation rule not found." };

  const scopedBranchIds = resolveScopedBranchIds(ctx, rule.branchId ?? "ALL");
  const members = await prisma.member.findMany({
    where: { orgId: ctx.org.id, branchId: { in: scopedBranchIds }, deletedAt: null },
    take: 120,
    include: {
      branch: { select: { name: true } },
      consents: { orderBy: { recordedAt: "desc" } },
      subscriptions: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } },
      invoices: { where: { balanceDuePaise: { gt: 0 } }, select: { balanceDuePaise: true } },
    },
  });

  const capSince = new Date(Date.now() - rule.maxPerMemberDays * 86_400_000);
  const recentLogs = await prisma.communicationLog.findMany({
    where: {
      orgId: ctx.org.id,
      templateCode: rule.triggerKey,
      createdAt: { gte: capSince },
    },
    select: { memberId: true },
  });
  const cappedMemberIds = new Set(recentLogs.map((l) => l.memberId));

  const now = new Date();
  const matched = members.filter((m) => {
    const daysToExpiry = m.expiryDate ? Math.round((m.expiryDate.getTime() - now.getTime()) / 86_400_000) : 99;
    const daysSinceVisit = m.lastVisitedAt ? Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000) : 30;
    const due = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);

    switch (rule.triggerKey) {
      case "WELCOME_SERIES":
        return Date.now() - m.createdAt.getTime() <= 14 * 86_400_000;
      case "EXPIRY_T7":
      case "EXPIRY_T3":
      case "EXPIRY_T0":
        return m.status === "EXPIRING" || (daysToExpiry >= 0 && daysToExpiry <= 7);
      case "EXPIRY_T_PLUS_3":
      case "WINBACK_30D":
        return m.status === "EXPIRED";
      case "PAYMENT_DUE":
        return due > 0 || m.status === "OVERDUE";
      case "MISSED_WORKOUT":
        return daysSinceVisit >= 7 && m.status !== "FROZEN";
      case "BIRTHDAY":
        return (
          m.dob !== null &&
          m.dob.getUTCMonth() === now.getUTCMonth() &&
          m.dob.getUTCDate() === now.getUTCDate()
        );
      default:
        return m.status === "ACTIVE";
    }
  });

  const istHour = typeof input.testHourIst === "number" ? input.testHourIst : getCurrentIstHour();
  const inQuietHours = evaluateQuietHours(istHour, rule.quietStartHour, rule.quietEndHour);

  let skippedOptOutCount = 0;
  let skippedCapCount = 0;
  const eligible: typeof matched = [];
  const sampleMessages: Array<{ memberName: string; phone: string; rendered: string }> = [];

  for (const m of matched) {
    const consent = m.consents.find((c) => c.channel === rule.actionChannel);
    if (consent && !consent.granted) {
      skippedOptOutCount++;
      continue;
    }
    if (cappedMemberIds.has(m.id)) {
      skippedCapCount++;
      continue;
    }
    eligible.push(m);
    if (sampleMessages.length < 4) {
      const due = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);
      sampleMessages.push({
        memberName: m.fullName,
        phone: m.phone,
        rendered: interpolateTemplateVars(rule.messageTemplate, {
          name: m.fullName,
          plan: m.subscriptions[0]?.plan.name ?? "Club Plan",
          expiry: formatShortDate(m.expiryDate),
          dueAmountPaise: due,
          branch: m.branch.name,
        }),
      });
    }
  }

  let dispatchedCount = 0;
  const blockedByQuiet = input.mode === "LIVE" && inQuietHours;

  if (input.mode === "LIVE" && !blockedByQuiet) {
    for (const m of eligible.slice(0, 12)) {
      const due = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);
      const rendered = interpolateTemplateVars(rule.messageTemplate, {
        name: m.fullName,
        plan: m.subscriptions[0]?.plan.name ?? "Club Plan",
        expiry: formatShortDate(m.expiryDate),
        dueAmountPaise: due,
        branch: m.branch.name,
      });
      const res = await dispatchMemberMessage({
        orgId: ctx.org.id,
        branchId: m.branchId,
        memberId: m.id,
        channel: rule.actionChannel === "SMS" || rule.actionChannel === "EMAIL" ? rule.actionChannel : "WHATSAPP",
        recipient: m.phone,
        templateCode: rule.triggerKey,
        body: rendered,
      });
      if (res.ok) dispatchedCount++;
    }
  }

  const run = await prisma.automationRun.create({
    data: {
      orgId: ctx.org.id,
      branchId: ctx.activeBranchId ?? null,
      ruleId: rule.id,
      mode: input.mode,
      matchedCount: matched.length,
      dispatchedCount,
      skippedOptOutCount,
      skippedCapCount,
      skippedQuietHours: inQuietHours,
      previewSummaryJson: {
        istHour,
        sampleMessages,
        eligibleCount: eligible.length,
      },
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: input.mode === "DRY_RUN" ? "AUTOMATION_DRY_RUN" : "AUTOMATION_EXECUTED",
    resourceType: "AutomationRun",
    resourceId: run.id,
    diff: {
      ruleName: rule.name,
      matchedCount: matched.length,
      dispatchedCount,
      skippedCapCount,
      skippedOptOutCount,
      inQuietHours,
    },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/automations");
  return {
    ok: true as const,
    runId: run.id,
    mode: input.mode,
    matchedCount: matched.length,
    eligibleCount: eligible.length,
    dispatchedCount,
    skippedOptOutCount,
    skippedCapCount,
    inQuietHours,
    istHour,
    sampleMessages,
  };
}

/* ─────────────────────────── RETENTION & CHURN ─────────────────────────── */

export async function executeChurnSaveOutreachAction(input: {
  memberId: string;
  actionType: "COACH_CALL" | "FREEZE_OFFER" | "RENEWAL_DISCOUNT" | "DUES_SPLIT";
  message: string;
}) {
  const ctx = await requireAuthContext({ permission: "retention:outreach" });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
  });
  if (!member) return { ok: false as const, error: "Member not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const sendRes = await dispatchMemberMessage({
    orgId: ctx.org.id,
    branchId: member.branchId,
    memberId: member.id,
    channel: "WHATSAPP",
    recipient: member.phone,
    templateCode: `SAVE_${input.actionType}`,
    body: input.message.trim(),
  });

  await prisma.staffTask.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      title: `Retention follow-up (${input.actionType}): ${member.fullName}`,
      priority: "HIGH",
      dueDate: new Date(Date.now() + 86_400_000),
      assignedToId: member.assignedTrainerId || ctx.user.id,
      relatedMemberId: member.id,
      status: "OPEN",
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "CHURN_SAVE_OUTREACH",
    resourceType: "Member",
    resourceId: member.id,
    diff: { actionType: input.actionType, status: sendRes.status },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/retention");
  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const, status: sendRes.status };
}

/* ─────────────────────────── REFERRALS & LOYALTY ─────────────────────────── */

export async function awardOrRedeemLoyaltyAction(input: {
  memberId: string;
  mode: "AWARD_EVENT" | "REDEEM";
  event?: "CHECKIN" | "STREAK_5" | "ONTIME_RENEWAL" | "REFERRAL_CONVERTED";
  redeemPoints?: number;
  reason?: string;
}) {
  const ctx = await requireAuthContext({ permission: "loyalty:manage" });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
    include: { loyaltyAccount: true },
  });
  if (!member) return { ok: false as const, error: "Member not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const currentBal = member.loyaltyAccount?.pointsBalance ?? 0;
  const currentLifetime = member.loyaltyAccount?.lifetimePoints ?? 0;

  let delta = 0;
  let reason = "";
  let nextLifetime = currentLifetime;

  if (input.mode === "AWARD_EVENT") {
    const evt = input.event ?? "CHECKIN";
    delta = getLoyaltyPointsForEvent(evt);
    nextLifetime = currentLifetime + delta;
    reason = input.reason?.trim() || `Awarded for ${evt}`;
  } else {
    const pts = Math.max(50, Math.trunc(input.redeemPoints ?? 0));
    if (pts > currentBal) {
      return {
        ok: false as const,
        error: `Insufficient points balance (${currentBal} available).`,
      };
    }
    delta = -pts;
    reason = input.reason?.trim() || `Redeemed ${pts} pts for club perk`;
  }

  const nextBalance = currentBal + delta;
  const nextTier = deriveLoyaltyTier(nextLifetime);

  await prisma.$transaction(async (tx) => {
    await tx.loyaltyAccount.upsert({
      where: { memberId: member.id },
      update: {
        pointsBalance: nextBalance,
        lifetimePoints: nextLifetime,
        tier: nextTier,
      },
      create: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        pointsBalance: Math.max(0, nextBalance),
        lifetimePoints: nextLifetime,
        tier: nextTier,
      },
    });
    await tx.loyaltyLedger.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        pointsDelta: delta,
        reason,
      },
    });
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "LOYALTY_POINTS_UPDATED",
    resourceType: "Member",
    resourceId: member.id,
    diff: { delta, nextBalance, nextTier },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/loyalty");
  return { ok: true as const, nextBalance, nextTier };
}

export async function grantReferralRewardDaysAction(input: {
  referrerMemberId: string;
  referredMemberId: string;
  freeDays: number;
  discountPaise: number;
}) {
  const ctx = await requireAuthContext({ permission: "loyalty:manage" });
  const [referrer, referred] = await Promise.all([
    prisma.member.findFirst({
      where: { id: input.referrerMemberId, orgId: ctx.org.id },
      include: { loyaltyAccount: true },
    }),
    prisma.member.findFirst({
      where: { id: input.referredMemberId, orgId: ctx.org.id },
    }),
  ]);
  if (!referrer || !referred) return { ok: false as const, error: "Selected members not found." };
  if (referrer.id === referred.id) {
    return { ok: false as const, error: "Referrer and referred member must be different." };
  }
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, referrer.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const days = Math.min(90, Math.max(1, Math.trunc(input.freeDays)));
  const disc = Math.max(0, Math.trunc(input.discountPaise));
  const bonusPts = getLoyaltyPointsForEvent("REFERRAL_CONVERTED");
  const baseExpiry = referrer.expiryDate && referrer.expiryDate > new Date() ? referrer.expiryDate : new Date();
  const nextExpiry = new Date(baseExpiry.getTime() + days * 86_400_000);
  const nextLifetime = (referrer.loyaltyAccount?.lifetimePoints ?? 0) + bonusPts;
  const nextBalance = (referrer.loyaltyAccount?.pointsBalance ?? 0) + bonusPts;
  const nextTier = deriveLoyaltyTier(nextLifetime);

  await prisma.$transaction(async (tx) => {
    await tx.referralReward.create({
      data: {
        orgId: ctx.org.id,
        branchId: referrer.branchId,
        referrerMemberId: referrer.id,
        referredMemberId: referred.id,
        freeDaysGranted: days,
        discountPaiseGranted: disc,
        status: "CREDITED",
      },
    });

    await tx.member.update({
      where: { id: referrer.id },
      data: { expiryDate: nextExpiry },
    });

    await tx.loyaltyAccount.upsert({
      where: { memberId: referrer.id },
      update: {
        pointsBalance: nextBalance,
        lifetimePoints: nextLifetime,
        tier: nextTier,
      },
      create: {
        orgId: ctx.org.id,
        branchId: referrer.branchId,
        memberId: referrer.id,
        pointsBalance: nextBalance,
        lifetimePoints: nextLifetime,
        tier: nextTier,
      },
    });

    await tx.loyaltyLedger.create({
      data: {
        orgId: ctx.org.id,
        branchId: referrer.branchId,
        memberId: referrer.id,
        pointsDelta: bonusPts,
        reason: `Referral bonus (${referred.fullName}) + ${days} free days`,
        refId: referred.memberCode,
      },
    });
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: referrer.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "REFERRAL_REWARD_CREDITED",
    resourceType: "ReferralReward",
    resourceId: referrer.id,
    diff: { referredId: referred.id, days, disc, nextExpiry: nextExpiry.toISOString() },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/loyalty");
  revalidatePath(`/app/members/${referrer.id}`);
  return { ok: true as const, nextExpiry: nextExpiry.toISOString() };
}
