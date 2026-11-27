"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { dispatchMemberMessage } from "@/lib/adapters/messaging";
import { storeDocumentObject } from "@/lib/adapters/storage";
import { applyPaymentToInvoice } from "@/lib/dues-ledger";
import { aggregateGstInvoice } from "@/lib/gst";
import { evaluateCheckInAccess } from "@/lib/checkin-gate";
import { evaluateGeofenceCheckIn } from "@/lib/geofence";
import { enqueueCrmJob } from "@/lib/queue";
import { calculateLeadScore, type LeadStageType } from "@/lib/leads-math";
import { evaluateQuietHours } from "@/lib/loyalty";
import { formatMoney } from "@/lib/money";
import { computePosSaleTotals, evaluateClassBookingCapacity } from "@/lib/ops-math";
import { requiresManagerOtpForDiscount, verifyManagerApprovalOtp } from "@/lib/privacy-guard";
import { AuthorizationError, canAccessBranch, type CrmRole } from "@/lib/rbac";
import { interpolateTemplateVars } from "@/lib/segments";
import {
  buildRecurringSessionDates,
  generateStudioSpotCodes,
  sanitizeCustomFieldsInput,
  validateSplitTender,
  type SplitTenderEntry,
} from "@/lib/world-class-engines";

/* ─────────────────────────── CUSTOM FIELDS & SAVED VIEWS ─────────────────────────── */

export async function createCustomFieldDefAction(input: {
  entityType: "MEMBER" | "LEAD";
  label: string;
  fieldType: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE";
  optionsCsv?: string;
  required?: boolean;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const label = input.label.trim();
  if (label.length < 2) return { ok: false as const, error: "Field label too short." };
  const fieldKey = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (!fieldKey) return { ok: false as const, error: "Invalid label characters." };

  const options =
    input.fieldType === "SELECT" && input.optionsCsv
      ? input.optionsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const def = await prisma.customFieldDefinition.upsert({
    where: {
      orgId_entityType_fieldKey: {
        orgId: ctx.org.id,
        entityType: input.entityType,
        fieldKey,
      },
    },
    update: {
      label,
      fieldType: input.fieldType,
      optionsJson: options,
      required: Boolean(input.required),
      isActive: true,
    },
    create: {
      orgId: ctx.org.id,
      entityType: input.entityType,
      fieldKey,
      label,
      fieldType: input.fieldType,
      optionsJson: options,
      required: Boolean(input.required),
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "CUSTOM_FIELD_SAVED",
    resourceType: "CustomFieldDefinition",
    resourceId: def.id,
    diff: { entityType: input.entityType, fieldKey, fieldType: input.fieldType },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/members");
  revalidatePath("/app/leads");
  return { ok: true as const, id: def.id };
}

export async function toggleCustomFieldDefAction(id: string) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const existing = await prisma.customFieldDefinition.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!existing) return { ok: false as const, error: "Custom field not found." };
  await prisma.customFieldDefinition.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app/members");
  revalidatePath("/app/leads");
  return { ok: true as const };
}

export async function saveSavedViewAction(input: {
  entityType: "MEMBERS" | "LEADS" | "INVOICES";
  name: string;
  filterJson: Record<string, unknown>;
  columnsJson?: string[];
  isShared?: boolean;
}) {
  const ctx = await requireAuthContext();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "View name must be at least 2 chars." };

  const view = await prisma.savedView.create({
    data: {
      orgId: ctx.org.id,
      userId: ctx.user.id,
      entityType: input.entityType,
      name,
      filterJson: input.filterJson as object,
      columnsJson: input.columnsJson ?? undefined,
      isShared: input.isShared ?? true,
    },
  });

  revalidatePath("/app/members");
  revalidatePath("/app/leads");
  revalidatePath("/app/billing");
  return { ok: true as const, view };
}

export async function deleteSavedViewAction(id: string) {
  const ctx = await requireAuthContext();
  const view = await prisma.savedView.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!view) return { ok: false as const, error: "Saved view not found." };
  await prisma.savedView.delete({ where: { id: view.id } });
  revalidatePath("/app/members");
  revalidatePath("/app/leads");
  revalidatePath("/app/billing");
  return { ok: true as const };
}

/* ─────────────────────────── MEMBER 360° BULK, WAIVER E-SIGN, DOCS & CONSENTS ─────────────────────────── */

export async function bulkMemberOperationAction(input: {
  memberIds: string[];
  operation: "ADD_TAG" | "ASSIGN_TRAINER" | "CREATE_FOLLOWUP_TASK" | "WHATSAPP_OUTREACH";
  value: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:write" });
  const ids = Array.from(new Set(input.memberIds)).slice(0, 100);
  if (ids.length === 0) return { ok: false as const, error: "Select at least one member." };

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const members = await prisma.member.findMany({
    where: { id: { in: ids }, orgId: ctx.org.id, branchId: { in: branchIds }, deletedAt: null },
  });
  if (members.length === 0) return { ok: false as const, error: "No matching members in scope." };

  const val = input.value.trim();
  let updated = 0;

  if (input.operation === "ADD_TAG" && val) {
    for (const m of members) {
      const nextTags = Array.from(new Set([...m.tags, val.toLowerCase()]));
      await prisma.member.update({ where: { id: m.id }, data: { tags: nextTags } });
      updated++;
    }
  } else if (input.operation === "ASSIGN_TRAINER" && val) {
    const res = await prisma.member.updateMany({
      where: { id: { in: members.map((m) => m.id) } },
      data: { assignedTrainerId: val },
    });
    updated = res.count;
  } else if (input.operation === "CREATE_FOLLOWUP_TASK" && val) {
    await prisma.staffTask.createMany({
      data: members.map((m) => ({
        orgId: ctx.org.id,
        branchId: m.branchId,
        title: `${val} · ${m.fullName} (${m.memberCode})`,
        priority: "HIGH",
        dueDate: new Date(Date.now() + 86_400_000),
        assignedToId: ctx.user.id,
        relatedMemberId: m.id,
      })),
    });
    updated = members.length;
  } else if (input.operation === "WHATSAPP_OUTREACH" && val) {
    for (const m of members.slice(0, 30)) {
      await dispatchMemberMessage({
        orgId: ctx.org.id,
        branchId: m.branchId,
        memberId: m.id,
        channel: "WHATSAPP",
        recipient: m.phone,
        templateCode: "BULK_ADMIN_NUDGE",
        body: val.replace(/\{name\}/gi, m.fullName.split(" ")[0] ?? m.fullName),
      });
      updated++;
    }
  }

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: `BULK_MEMBER_${input.operation}`,
    resourceType: "Member",
    resourceId: members.map((m) => m.memberCode).slice(0, 5).join(","),
    diff: { count: updated, value: val },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/members");
  revalidatePath("/app");
  return { ok: true as const, updated };
}

export async function updateMemberProfileExtendedAction(input: {
  memberId: string;
  goals?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  tagsCsv?: string;
  customFields?: Record<string, unknown>;
}) {
  const ctx = await requireAuthContext({ permission: "members:write" });
  const member = await prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member not found or branch forbidden.");
  }

  let cleanCustom = (member.customFieldsJson as Record<string, unknown> | null) ?? {};
  if (input.customFields) {
    const defs = await prisma.customFieldDefinition.findMany({
      where: { orgId: ctx.org.id, entityType: "MEMBER", isActive: true },
    });
    const check = sanitizeCustomFieldsInput(input.customFields, defs);
    if (!check.ok) return { ok: false as const, error: check.error };
    cleanCustom = { ...cleanCustom, ...check.data };
  }

  const nextTags =
    input.tagsCsv !== undefined
      ? input.tagsCsv
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : member.tags;

  await prisma.member.update({
    where: { id: member.id },
    data: {
      goals: input.goals !== undefined ? input.goals.trim() || null : member.goals,
      address: input.address !== undefined ? input.address.trim() || null : member.address,
      emergencyName: input.emergencyName !== undefined ? input.emergencyName.trim() || null : member.emergencyName,
      emergencyPhone: input.emergencyPhone !== undefined ? input.emergencyPhone.trim() || null : member.emergencyPhone,
      tags: nextTags,
      customFieldsJson: cleanCustom as object,
    },
  });

  revalidatePath(`/app/members/${member.id}`);
  revalidatePath("/app/members");
  return { ok: true as const };
}

export async function toggleMemberConsentAction(input: {
  memberId: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL" | "MARKETING" | "HEALTH_DATA";
  granted: boolean;
}) {
  const ctx = await requireAuthContext({ permission: "members:write" });
  const member = await prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member not found.");
  }

  await prisma.consentRecord.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      channel: input.channel,
      granted: input.granted,
      source: "STAFF_PROFILE_EDIT",
      ip: ctx.clientIp,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "CONSENT_UPDATED",
    resourceType: "ConsentRecord",
    resourceId: member.id,
    diff: { channel: input.channel, granted: input.granted },
    ip: ctx.clientIp,
  });

  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const };
}

export async function signMemberWaiverCanvasAction(input: {
  memberId: string;
  signerName: string;
  signatureDataUrl: string;
  parqAccepted: boolean;
}) {
  const ctx = await requireAuthContext({ permission: "members:write" });
  const member = await prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member not found.");
  }
  if (!input.parqAccepted) {
    return { ok: false as const, error: "PAR-Q health declaration must be confirmed before signing." };
  }

  const base64Part = input.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const bytes = Buffer.from(base64Part, "base64");
  const stored = await storeDocumentObject({
    orgId: ctx.org.id,
    memberId: member.id,
    fileName: "waiver-signature.png",
    mimeType: "image/png",
    bytes,
  });

  const doc = await prisma.memberDocument.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      kind: "WAIVER",
      title: `Digital Liability Waiver & PAR-Q v2 (Signed by ${input.signerName.trim()})`,
      fileKey: stored.ok ? stored.key : null,
      signedAt: new Date(),
      signedIp: ctx.clientIp ?? "127.0.0.1",
      signerName: input.signerName.trim(),
    },
  });

  await prisma.member.update({
    where: { id: member.id },
    data: { healthConsentAt: new Date() },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "DIGITAL_WAIVER_ESIGNED",
    resourceType: "MemberDocument",
    resourceId: doc.id,
    diff: { signerName: input.signerName.trim(), fileKey: doc.fileKey },
    ip: ctx.clientIp,
  });

  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const, docId: doc.id };
}

export async function uploadMemberDocumentAction(input: {
  memberId: string;
  kind: "WAIVER" | "KYC_AADHAAR" | "KYC_PAN" | "MEDICAL" | "OTHER";
  title: string;
  mimeType: string;
  base64Content: string;
  kycLast4?: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:write" });
  const member = await prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member not found.");
  }

  const raw = input.base64Content.includes(",") ? input.base64Content.split(",")[1]! : input.base64Content;
  const bytes = Buffer.from(raw, "base64");
  const stored = await storeDocumentObject({
    orgId: ctx.org.id,
    memberId: member.id,
    fileName: input.title,
    mimeType: input.mimeType,
    bytes,
  });

  if (!stored.ok) return { ok: false as const, error: stored.error };

  const doc = await prisma.memberDocument.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      kind: input.kind,
      title: input.title.trim(),
      fileKey: stored.key,
      kycLast4: input.kycLast4?.trim().slice(-4) || null,
      signedAt: new Date(),
      signedIp: ctx.clientIp,
      signerName: member.fullName,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "DOCUMENT_UPLOADED_VAULT",
    resourceType: "MemberDocument",
    resourceId: doc.id,
    diff: { kind: input.kind, mode: stored.mode },
    ip: ctx.clientIp,
  });

  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const, docId: doc.id, mode: stored.mode };
}

/* ─────────────────────────── LEADS SLA, BULK, ROUND-ROBIN & AD SPEND ─────────────────────────── */

export async function roundRobinAssignLeadsAction(branchId: string) {
  const ctx = await requireAuthContext({ permission: "leads:write", branchId });
  const [unassigned, reps] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId: ctx.org.id, branchId, ownerId: null, stage: { notIn: ["WON", "LOST"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.orgMembership.findMany({
      where: {
        orgId: ctx.org.id,
        role: { in: ["MANAGER", "FRONTDESK", "OWNER"] },
      },
      include: { user: { select: { id: true, name: true, isActive: true } } },
    }),
  ]);

  const activeReps = reps.filter((r) => r.user.isActive && (r.role === "OWNER" || r.branchIds.includes(branchId)));
  if (activeReps.length === 0) return { ok: false as const, error: "No active sales staff in branch." };
  if (unassigned.length === 0) return { ok: true as const, assignedCount: 0 };

  for (let i = 0; i < unassigned.length; i++) {
    const rep = activeReps[i % activeReps.length]!;
    await prisma.lead.update({
      where: { id: unassigned[i]!.id },
      data: { ownerId: rep.userId },
    });
  }

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "LEADS_ROUND_ROBIN_ASSIGNED",
    resourceType: "Lead",
    resourceId: branchId,
    diff: { assignedCount: unassigned.length, repsCount: activeReps.length },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/leads");
  return { ok: true as const, assignedCount: unassigned.length };
}

export async function bulkLeadStageMoveAction(input: {
  leadIds: string[];
  stage: LeadStageType;
}) {
  const ctx = await requireAuthContext({ permission: "leads:write" });
  const ids = Array.from(new Set(input.leadIds)).slice(0, 100);
  if (ids.length === 0) return { ok: false as const, error: "Select leads first." };

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, orgId: ctx.org.id, branchId: { in: branchIds } },
  });

  for (const lead of leads) {
    const ageDays = Math.max(0, Math.round((Date.now() - lead.createdAt.getTime()) / 86_400_000));
    const nextScore = calculateLeadScore({
      source: lead.source,
      stage: input.stage,
      hasEmail: Boolean(lead.email),
      hasTrialScheduled: Boolean(lead.trialAt),
      ageDays,
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: input.stage, score: nextScore, stageChangedAt: new Date() },
    });
  }

  revalidatePath("/app/leads");
  return { ok: true as const, moved: leads.length };
}

export async function upsertAdSpendCampaignAction(input: {
  branchId?: string | null;
  source: string;
  monthYm: string;
  spendPaise: number;
  note?: string;
}) {
  const ctx = await requireAuthContext({ permission: "leads:roi" });
  await prisma.adSpendCampaign.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId || null,
      source: input.source.trim(),
      monthYm: input.monthYm.trim(),
      spendPaise: Math.max(0, Math.trunc(input.spendPaise)),
      note: input.note?.trim() || null,
    },
  });
  revalidatePath("/app/leads");
  return { ok: true as const };
}

/* ─────────────────────────── GIFT CARDS, WALLET, CORPORATE B2B & SPLIT TENDER ─────────────────────────── */

export async function issueGiftCardVoucherAction(input: {
  branchId: string;
  amountPaise: number;
  recipientName?: string;
  issuedToMemberId?: string;
  validDays?: number;
}) {
  const ctx = await requireAuthContext({ permission: "billing:collect", branchId: input.branchId });
  const amount = Math.max(10000, Math.trunc(input.amountPaise));
  const code = `FG-${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  const voucher = await prisma.giftCardVoucher.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      code,
      initialPaise: amount,
      balancePaise: amount,
      recipientName: input.recipientName?.trim() || null,
      issuedToMemberId: input.issuedToMemberId || null,
      expiresAt: input.validDays ? new Date(Date.now() + input.validDays * 86_400_000) : null,
      status: "ACTIVE",
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "GIFT_CARD_ISSUED",
    resourceType: "GiftCardVoucher",
    resourceId: voucher.id,
    diff: { code, amountPaise: amount },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/billing");
  return { ok: true as const, voucher };
}

export async function collectSplitTenderInvoiceAction(input: {
  invoiceId: string;
  parts: SplitTenderEntry[];
  giftCardCode?: string;
  discountWaivePaise?: number;
  managerOtp?: string;
}) {
  const ctx = await requireAuthContext({ permission: "billing:collect" });
  const inv = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: ctx.org.id },
    include: { member: true },
  });
  if (!inv || !canAccessBranch(ctx.role, ctx.assignedBranchIds, inv.branchId)) {
    throw new AuthorizationError("Invoice not found or forbidden.");
  }

  const waive = Math.max(0, Math.trunc(input.discountWaivePaise ?? 0));
  if (waive > 0 && inv.totalPaise > 0) {
    const waivePct = (waive / inv.totalPaise) * 100;
    if (requiresManagerOtpForDiscount(waivePct)) {
      const otpRes = verifyManagerApprovalOtp(input.managerOtp ?? "");
      if (!otpRes.valid) return { ok: false as const, error: `Manager OTP required for >15% waiver: ${otpRes.reason}` };
    }
  }

  const partsToApply = [...input.parts];
  let voucherToDebit: { id: string; balancePaise: number; debitPaise: number } | null = null;
  if (input.giftCardCode?.trim()) {
    const gc = await prisma.giftCardVoucher.findFirst({
      where: { orgId: ctx.org.id, code: input.giftCardCode.trim().toUpperCase(), status: "ACTIVE" },
    });
    if (!gc || gc.balancePaise <= 0) return { ok: false as const, error: "Gift card invalid or depleted." };
    const existingSum = partsToApply.reduce((s, p) => s + Math.max(0, p.amountPaise), 0);
    const needed = Math.max(0, inv.balanceDuePaise - existingSum);
    const debitPaise = Math.min(gc.balancePaise, needed);
    if (debitPaise > 0) {
      partsToApply.push({ method: "GIFT_CARD", amountPaise: debitPaise, ref: gc.code });
      voucherToDebit = { id: gc.id, balancePaise: gc.balancePaise, debitPaise };
    }
  }

  const check = validateSplitTender(inv.balanceDuePaise, partsToApply);
  if (!check.ok) return { ok: false as const, error: check.error };

  const walletPart = check.cleanParts
    .filter((p) => p.method === "WALLET")
    .reduce((s, p) => s + p.amountPaise, 0);
  if (walletPart > inv.member.walletBalancePaise) {
    return { ok: false as const, error: "Member wallet balance insufficient." };
  }

  const calc = applyPaymentToInvoice({
    totalPaise: inv.totalPaise,
    paidSoFarPaise: inv.paidPaise,
    paymentPaise: check.sumPaise,
  });
  if (!calc.ok) return { ok: false as const, error: calc.error };

  const primaryMethod = check.cleanParts.length > 1 ? "SPLIT" : check.cleanParts[0]!.method;
  const dbMethod: "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT" =
    primaryMethod === "WALLET" || primaryMethod === "GIFT_CARD" ? "SPLIT" : primaryMethod;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orgId: ctx.org.id,
        branchId: inv.branchId,
        memberId: inv.memberId,
        invoiceId: inv.id,
        amountPaise: check.sumPaise,
        method: dbMethod,
        provider: "MANUAL",
        idempotencyKey: `split_${inv.id}_${Date.now()}`,
        status: "CAPTURED",
        collectedById: ctx.user.id,
        splitMetaJson: check.cleanParts as unknown as object,
        referenceText: check.cleanParts.map((p) => `${p.method}:${(p.amountPaise / 100).toFixed(0)}`).join("+"),
      },
    });
    if (walletPart > 0) {
      await tx.member.update({
        where: { id: inv.memberId },
        data: { walletBalancePaise: { decrement: walletPart } },
      });
    }
    if (voucherToDebit) {
      const rem = voucherToDebit.balancePaise - voucherToDebit.debitPaise;
      await tx.giftCardVoucher.update({
        where: { id: voucherToDebit.id },
        data: { balancePaise: rem, status: rem <= 0 ? "DEPLETED" : "ACTIVE" },
      });
    }
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        paidPaise: calc.nextPaidPaise,
        balanceDuePaise: calc.nextBalanceDuePaise,
        status: calc.nextStatus,
      },
    });
    if (calc.nextBalanceDuePaise === 0) {
      await tx.member.update({ where: { id: inv.memberId }, data: { status: "ACTIVE" } });
    }
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: inv.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "SPLIT_TENDER_PAYMENT_CAPTURED",
    resourceType: "Invoice",
    resourceId: inv.id,
    diff: { sumPaise: check.sumPaise, parts: check.cleanParts },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/billing");
  revalidatePath(`/app/billing/invoices/${inv.id}`);
  revalidatePath(`/app/members/${inv.memberId}`);
  return { ok: true as const, balanceDuePaise: calc.nextBalanceDuePaise };
}

export async function createCorporateOrFamilyGroupAction(input: {
  branchId: string;
  type: "FAMILY" | "COUPLE" | "CORPORATE";
  name: string;
  companyName?: string;
  corporateGstin?: string;
  seatLimit: number;
  memberIds: string[];
}) {
  const ctx = await requireAuthContext({ permission: "members:write", branchId: input.branchId });
  const group = await prisma.memberGroup.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      type: input.type,
      name: input.name.trim(),
      companyName: input.companyName?.trim() || null,
      corporateGstin: input.corporateGstin?.trim().toUpperCase() || null,
      seatLimit: Math.max(2, Math.trunc(input.seatLimit)),
      primaryMemberId: input.memberIds[0] ?? null,
    },
  });

  if (input.memberIds.length > 0) {
    await prisma.member.updateMany({
      where: { id: { in: input.memberIds.slice(0, group.seatLimit) }, orgId: ctx.org.id },
      data: { groupId: group.id },
    });
  }

  revalidatePath("/app/billing");
  revalidatePath("/app/members");
  return { ok: true as const, groupId: group.id };
}

export async function createAutopayMandateAction(input: {
  memberId: string;
  provider: "RAZORPAY" | "STRIPE";
  maxAmountPaise: number;
}) {
  const ctx = await requireAuthContext({ permission: "billing:collect" });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
    include: { subscriptions: { orderBy: { endDate: "desc" }, take: 1 } },
  });
  if (!member || !member.subscriptions[0]) {
    return { ok: false as const, error: "Member needs an active subscription for e-Mandate." };
  }
  const mandate = await prisma.autopayMandate.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      membershipId: member.subscriptions[0].id,
      provider: input.provider,
      mandateRef: `mdt_${crypto.randomBytes(5).toString("hex")}`,
      status: "ACTIVE",
      maxAmountPaise: Math.max(50000, Math.trunc(input.maxAmountPaise)),
      nextChargeDate: member.subscriptions[0].endDate,
    },
  });
  revalidatePath("/app/billing");
  return { ok: true as const, mandateId: mandate.id };
}

export async function toggleAutopayMandateStatusAction(id: string) {
  const ctx = await requireAuthContext({ permission: "billing:collect" });
  const m = await prisma.autopayMandate.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!m) return { ok: false as const, error: "Mandate not found." };
  const nextStatus = m.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  await prisma.autopayMandate.update({ where: { id: m.id }, data: { status: nextStatus } });
  revalidatePath("/app/billing");
  return { ok: true as const, status: nextStatus };
}

export async function runDunningRetryCycleAction() {
  const ctx = await requireAuthContext({ permission: "billing:collect" });
  await enqueueCrmJob("dunning.retry", { orgId: ctx.org.id, actorUserId: ctx.user.id });

  const dueAttempts = await prisma.dunningAttempt.findMany({
    where: { orgId: ctx.org.id, status: "RETRY_SCHEDULED" },
    include: { invoice: { include: { member: true } } },
    take: 25,
  });

  let recovered = 0;
  let notified = 0;
  for (const att of dueAttempts) {
    if (att.invoice.balanceDuePaise > 0) {
      await dispatchMemberMessage({
        orgId: ctx.org.id,
        branchId: att.invoice.branchId,
        memberId: att.invoice.memberId,
        channel: "WHATSAPP",
        recipient: att.invoice.member.phone,
        templateCode: "DUNNING_RETRY_NUDGE",
        body: `Hi ${att.invoice.member.fullName.split(" ")[0]}, autopay retry #${att.attemptNo} triggered for Invoice ${att.invoice.invoiceNumber} (${formatMoney(att.invoice.balanceDuePaise, { currency: ctx.org.currency })}).`,
      });
      notified++;
    }
    await prisma.dunningAttempt.update({
      where: { id: att.id },
      data: {
        status: att.invoice.balanceDuePaise === 0 ? "RECOVERED" : "NOTIFIED",
        executedAt: new Date(),
      },
    });
    if (att.invoice.balanceDuePaise === 0) recovered++;
  }

  revalidatePath("/app/billing");
  return { ok: true as const, processed: dueAttempts.length, recovered, notified };
}

export async function replayWebhookEventAction(webhookId: string) {
  const ctx = await requireAuthContext({ permission: "billing:collect" });
  const ev = await prisma.webhookEvent.findFirst({ where: { id: webhookId, orgId: ctx.org.id } });
  if (!ev) return { ok: false as const, error: "Webhook event not found." };
  await prisma.webhookEvent.update({
    where: { id: ev.id },
    data: { status: "PROCESSED", attempts: { increment: 1 }, lastError: null, processedAt: new Date() },
  });
  revalidatePath("/app/billing");
  return { ok: true as const };
}

/* ─────────────────────────── PLANS, ADDONS & PROMOS CRUD ─────────────────────────── */

export async function togglePlanActiveAction(planId: string) {
  const ctx = await requireAuthContext({ permission: "plans:write" });
  const p = await prisma.plan.findFirst({ where: { id: planId, orgId: ctx.org.id } });
  if (!p) return { ok: false as const, error: "Plan not found." };
  await prisma.plan.update({ where: { id: p.id }, data: { isActive: !p.isActive } });
  revalidatePath("/app/plans");
  return { ok: true as const };
}

export async function upsertPlanAddonAction(input: {
  name: string;
  kind: "LOCKER" | "TOWEL" | "STEAM" | "PARKING";
  pricePaise: number;
  durationDays: number;
}) {
  const ctx = await requireAuthContext({ permission: "plans:write" });
  await prisma.planAddon.create({
    data: {
      orgId: ctx.org.id,
      name: input.name.trim(),
      kind: input.kind,
      pricePaise: Math.max(0, Math.trunc(input.pricePaise)),
      durationDays: Math.max(1, Math.trunc(input.durationDays)),
    },
  });
  revalidatePath("/app/plans");
  return { ok: true as const };
}

export async function upsertPromoCodeAction(input: {
  code: string;
  discountType: "PERCENT_BPS" | "FIXED_PAISE";
  discountValue: number;
  scope: "PROMO" | "EARLY_BIRD" | "REFERRAL";
  maxRedemptions: number;
  validDays: number;
}) {
  const ctx = await requireAuthContext({ permission: "plans:write" });
  const cleanCode = input.code.trim().toUpperCase();
  await prisma.promoCode.upsert({
    where: { orgId_code: { orgId: ctx.org.id, code: cleanCode } },
    update: {
      discountType: input.discountType,
      discountValue: Math.max(1, Math.trunc(input.discountValue)),
      scope: input.scope,
      maxRedemptions: Math.max(1, Math.trunc(input.maxRedemptions)),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + Math.max(1, input.validDays) * 86_400_000),
      isActive: true,
    },
    create: {
      orgId: ctx.org.id,
      code: cleanCode,
      discountType: input.discountType,
      discountValue: Math.max(1, Math.trunc(input.discountValue)),
      scope: input.scope,
      maxRedemptions: Math.max(1, Math.trunc(input.maxRedemptions)),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + Math.max(1, input.validDays) * 86_400_000),
    },
  });
  revalidatePath("/app/plans");
  return { ok: true as const };
}

/* ─────────────────────────── BIOMETRIC HARDWARE (ESSL/ZKTECO), GEOFENCE & STUDIO SPOTS ─────────────────────────── */

export async function registerAccessDeviceAction(input: {
  branchId: string;
  serialNumber: string;
  name: string;
  vendor: "ESSL" | "ZKTECO" | "GENERIC_TURNSTILE";
  ipAddress?: string;
}) {
  const ctx = await requireAuthContext({ permission: "checkin:operate", branchId: input.branchId });
  await prisma.accessDevice.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      serialNumber: input.serialNumber.trim().toUpperCase(),
      name: input.name.trim(),
      vendor: input.vendor,
      mode: input.vendor === "GENERIC_TURNSTILE" ? "WEBHOOK" : "ADMS_PUSH",
      ipAddress: input.ipAddress?.trim() || null,
      lastHeartbeatAt: new Date(),
      status: "ONLINE",
    },
  });
  revalidatePath("/app/checkin");
  return { ok: true as const };
}

export async function queueRemoteDoorUnlockAction(deviceId: string) {
  const ctx = await requireAuthContext({ permission: "checkin:override" });
  const dev = await prisma.accessDevice.findFirst({ where: { id: deviceId, orgId: ctx.org.id } });
  if (!dev || !canAccessBranch(ctx.role, ctx.assignedBranchIds, dev.branchId)) {
    throw new AuthorizationError("Device not found or forbidden.");
  }
  await prisma.accessDevice.update({
    where: { id: dev.id },
    data: { pendingCmdText: `C:${Date.now() % 10000}:AC_UNLOCK`, lastHeartbeatAt: new Date() },
  });
  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: dev.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "TURNSTILE_REMOTE_UNLOCK_QUEUED",
    resourceType: "AccessDevice",
    resourceId: dev.serialNumber,
    ip: ctx.clientIp,
  });
  revalidatePath("/app/checkin");
  return { ok: true as const, serialNumber: dev.serialNumber };
}

export async function testGeofenceCheckInAction(input: {
  branchId: string;
  memberQuery: string;
  deviceLat: number;
  deviceLng: number;
  accuracyMeters: number;
}) {
  const ctx = await requireAuthContext({ permission: "checkin:operate", branchId: input.branchId });
  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, orgId: ctx.org.id } });
  if (!branch) return { ok: false as const, error: "Branch not found." };

  const verdict = evaluateGeofenceCheckIn({
    branchLat: branch.latitude ?? 12.9716,
    branchLng: branch.longitude ?? 77.6412,
    radiusMeters: branch.geofenceRadiusM,
    deviceLat: input.deviceLat,
    deviceLng: input.deviceLng,
    accuracyMeters: input.accuracyMeters,
  });

  if (!verdict.allowed) {
    return { ok: false as const, verdict, error: verdict.label };
  }

  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [
        { memberCode: { equals: input.memberQuery.trim(), mode: "insensitive" } },
        { phone: { endsWith: input.memberQuery.replace(/\D/g, "").slice(-10) } },
      ],
    },
  });
  if (!member) return { ok: false as const, verdict, error: "Member not found." };

  const access = evaluateCheckInAccess({
    status: member.status,
    expiryDate: member.expiryDate,
    timeZone: branch.timezone,
  });
  if (!access.allowed) return { ok: false as const, verdict, error: access.reason };

  await prisma.checkIn.create({
    data: {
      orgId: ctx.org.id,
      branchId: branch.id,
      memberId: member.id,
      method: "QR",
      result: access.result,
      checkedInById: ctx.user.id,
      deviceId: "GPS-GEOFENCE",
      latitude: input.deviceLat,
      longitude: input.deviceLng,
      distanceMeters: verdict.distanceMeters,
    },
  });

  revalidatePath("/app/checkin");
  return { ok: true as const, verdict, memberName: member.fullName };
}

export async function upsertClassTypeWithGridAction(input: {
  name: string;
  category: string;
  defaultDurationMin: number;
  defaultCapacity: number;
  noShowFeePaise: number;
  cutoffMinutes: number;
  layoutRows: number;
  layoutCols: number;
  layoutPrefix: string;
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  const spotsCount =
    input.layoutRows > 0 && input.layoutCols > 0
      ? generateStudioSpotCodes(input.layoutRows, input.layoutCols, input.layoutPrefix).length
      : input.defaultCapacity;

  const ct = await prisma.classType.upsert({
    where: { orgId_name: { orgId: ctx.org.id, name: input.name.trim() } },
    update: {
      category: input.category.trim(),
      defaultDurationMin: Math.max(20, input.defaultDurationMin),
      defaultCapacity: Math.max(1, spotsCount),
      noShowFeePaise: Math.max(0, input.noShowFeePaise),
      cutoffMinutes: Math.max(15, input.cutoffMinutes),
      layoutRows: Math.max(0, input.layoutRows),
      layoutCols: Math.max(0, input.layoutCols),
      layoutPrefix: input.layoutPrefix.trim().toUpperCase() || "S",
    },
    create: {
      orgId: ctx.org.id,
      name: input.name.trim(),
      category: input.category.trim(),
      defaultDurationMin: Math.max(20, input.defaultDurationMin),
      defaultCapacity: Math.max(1, spotsCount),
      noShowFeePaise: Math.max(0, input.noShowFeePaise),
      cutoffMinutes: Math.max(15, input.cutoffMinutes),
      layoutRows: Math.max(0, input.layoutRows),
      layoutCols: Math.max(0, input.layoutCols),
      layoutPrefix: input.layoutPrefix.trim().toUpperCase() || "S",
    },
  });
  revalidatePath("/app/classes");
  return { ok: true as const, classTypeId: ct.id };
}

export async function createRecurringClassSeriesAction(input: {
  branchId: string;
  classTypeId: string;
  trainerId: string;
  firstStartsAt: string;
  studioRoom: string;
  weeksCount: number;
  daysOfWeek: number[];
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage", branchId: input.branchId });
  const ct = await prisma.classType.findFirst({ where: { id: input.classTypeId, orgId: ctx.org.id } });
  if (!ct) return { ok: false as const, error: "Class type not found." };

  const first = new Date(input.firstStartsAt);
  if (Number.isNaN(first.getTime())) return { ok: false as const, error: "Invalid start timestamp." };
  const dates = buildRecurringSessionDates({
    firstStartsAt: first,
    weeksCount: input.weeksCount,
    daysOfWeek: input.daysOfWeek,
  });

  await prisma.classSession.createMany({
    data: dates.map((d) => ({
      orgId: ctx.org.id,
      branchId: input.branchId,
      classTypeId: ct.id,
      trainerId: input.trainerId,
      title: ct.name,
      studioRoom: input.studioRoom.trim() || "Main Studio",
      startsAt: d,
      endsAt: new Date(d.getTime() + ct.defaultDurationMin * 60_000),
      capacity: ct.defaultCapacity,
      cutoffMinutes: ct.cutoffMinutes,
    })),
  });

  revalidatePath("/app/classes");
  return { ok: true as const, createdCount: dates.length };
}

export async function bookClassWithSpotAction(input: {
  sessionId: string;
  memberId: string;
  spotCode?: string;
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  const [session, member] = await Promise.all([
    prisma.classSession.findFirst({
      where: { id: input.sessionId, orgId: ctx.org.id },
      include: { bookings: true },
    }),
    prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } }),
  ]);
  if (!session || !member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, session.branchId)) {
    throw new AuthorizationError("Session or member missing.");
  }
  const cleanSpot = input.spotCode?.trim().toUpperCase() || null;
  if (cleanSpot) {
    const taken = session.bookings.find((b) => b.spotCode === cleanSpot && b.status !== "CANCELLED");
    if (taken) return { ok: false as const, error: `Spot ${cleanSpot} is already booked.` };
  }

  const bookedCount = session.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length;
  const waitlistedCount = session.bookings.filter((b) => b.status === "WAITLISTED").length;
  const evalCap = evaluateClassBookingCapacity({
    capacity: session.capacity,
    bookedCount,
    waitlistedCount,
  });

  await prisma.classBooking.upsert({
    where: { sessionId_memberId: { sessionId: session.id, memberId: member.id } },
    update: {
      status: evalCap.bookingStatus,
      waitlistPos: evalCap.waitlistPos,
      spotCode: evalCap.bookingStatus === "BOOKED" ? cleanSpot : null,
      cancelledAt: null,
    },
    create: {
      orgId: ctx.org.id,
      branchId: session.branchId,
      sessionId: session.id,
      memberId: member.id,
      status: evalCap.bookingStatus,
      waitlistPos: evalCap.waitlistPos,
      spotCode: evalCap.bookingStatus === "BOOKED" ? cleanSpot : null,
    },
  });

  revalidatePath("/app/classes");
  return { ok: true as const, status: evalCap.bookingStatus, spotCode: cleanSpot };
}

/* ─────────────────────────── TRAINER CRUD, STAFF SHIFTS, MULTI-CART POS & CRUD ─────────────────────────── */

export async function createStaffShiftAction(input: {
  branchId: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleLabel: string;
  advancePaise?: number;
}) {
  const ctx = await requireAuthContext({ permission: "staff:shifts", branchId: input.branchId });
  await prisma.staffShift.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      userId: input.userId,
      shiftDate: new Date(`${input.shiftDate}T00:00:00Z`),
      startTime: input.startTime,
      endTime: input.endTime,
      roleLabel: input.roleLabel.trim(),
      advancePaise: Math.max(0, Math.trunc(input.advancePaise ?? 0)),
      status: "SCHEDULED",
    },
  });
  revalidatePath("/app/staff");
  return { ok: true as const };
}

export async function clockShiftGeofencedAction(input: {
  shiftId: string;
  nextStatus: "CLOCKED_IN" | "CLOCKED_OUT";
  handoverNote?: string;
  deviceLat?: number;
  deviceLng?: number;
  lateMinutes?: number;
}) {
  const ctx = await requireAuthContext({ permission: "staff:shifts" });
  const shift = await prisma.staffShift.findFirst({
    where: { id: input.shiftId, orgId: ctx.org.id },
    include: { branch: true },
  });
  if (!shift || !canAccessBranch(ctx.role, ctx.assignedBranchIds, shift.branchId)) {
    throw new AuthorizationError("Shift not found.");
  }

  let geofenceStatus = "UNVERIFIED";
  if (typeof input.deviceLat === "number" && typeof input.deviceLng === "number") {
    const verdict = evaluateGeofenceCheckIn({
      branchLat: shift.branch.latitude ?? 12.9716,
      branchLng: shift.branch.longitude ?? 77.6412,
      radiusMeters: shift.branch.geofenceRadiusM,
      deviceLat: input.deviceLat,
      deviceLng: input.deviceLng,
      accuracyMeters: 15,
    });
    geofenceStatus = verdict.status;
  }

  await prisma.staffShift.update({
    where: { id: shift.id },
    data: {
      status: input.nextStatus,
      handoverNote: input.handoverNote?.trim() || shift.handoverNote,
      lateMinutes: typeof input.lateMinutes === "number" ? Math.max(0, Math.trunc(input.lateMinutes)) : shift.lateMinutes,
      clockInLat: input.deviceLat ?? shift.clockInLat,
      clockInLng: input.deviceLng ?? shift.clockInLng,
      geofenceStatus,
      ...(input.nextStatus === "CLOCKED_IN" ? { clockedInAt: new Date() } : { clockedOutAt: new Date() }),
    },
  });
  revalidatePath("/app/staff");
  return { ok: true as const, geofenceStatus };
}

export async function multiCartPosCheckoutAction(input: {
  branchId: string;
  memberId?: string;
  items: Array<{ itemId: string; quantity: number }>;
  method: "UPI" | "CARD" | "CASH" | "SPLIT";
  giftCardCode?: string;
}) {
  const ctx = await requireAuthContext({ permission: "inventory:pos", branchId: input.branchId });
  if (input.items.length === 0) return { ok: false as const, error: "Cart is empty." };

  const dbItems = await prisma.inventoryItem.findMany({
    where: { id: { in: input.items.map((i) => i.itemId) }, orgId: ctx.org.id, branchId: input.branchId },
  });

  const cartLines: Array<{
    itemId: string;
    name: string;
    unitPricePaise: number;
    quantity: number;
    gstRateBps: number;
  }> = [];
  for (const reqItem of input.items) {
    const sku = dbItems.find((d) => d.id === reqItem.itemId);
    if (!sku) return { ok: false as const, error: "SKU not found in branch." };
    if (sku.stockQty < reqItem.quantity) {
      return { ok: false as const, error: `Insufficient stock for ${sku.name} (${sku.stockQty} left).` };
    }
    cartLines.push({
      itemId: sku.id,
      name: sku.name,
      unitPricePaise: sku.unitPricePaise,
      quantity: reqItem.quantity,
      gstRateBps: sku.gstRateBps,
    });
  }

  const totals = computePosSaleTotals(cartLines);
  const member = input.memberId
    ? await prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } })
    : null;
  const branch = await prisma.branch.findUniqueOrThrow({ where: { id: input.branchId } });

  const sale = await prisma.$transaction(async (tx) => {
    const br = await tx.branch.update({
      where: { id: input.branchId },
      data: { nextInvoiceSeq: { increment: 1 } },
    });
    const invNo = `POS-${br.invoiceSeriesPrefix}-${String(br.nextInvoiceSeq - 1).padStart(5, "0")}`;

    for (const line of cartLines) {
      await tx.inventoryItem.update({
        where: { id: line.itemId },
        data: { stockQty: { decrement: line.quantity } },
      });
    }

    const pos = await tx.posSale.create({
      data: {
        orgId: ctx.org.id,
        branchId: input.branchId,
        memberId: member?.id ?? null,
        invoiceNumber: invNo,
        itemsJson: totals.lines as unknown as object,
        subtotalPaise: totals.subtotalPaise,
        gstPaise: totals.gstPaise,
        totalPaise: totals.totalPaise,
        method: input.method,
        soldById: ctx.user.id,
      },
    });

    if (member) {
      const gst = aggregateGstInvoice(
        cartLines.map((l) => ({
          description: `POS Retail · ${l.name}`,
          unitPricePaise: l.unitPricePaise,
          quantity: l.quantity,
          gstRateBps: l.gstRateBps,
        })),
        member.stateCode,
        branch.stateCode
      );
      const inv = await tx.invoice.create({
        data: {
          orgId: ctx.org.id,
          branchId: input.branchId,
          memberId: member.id,
          invoiceNumber: invNo,
          dueDate: new Date(),
          status: "PAID",
          sacCode: "999723",
          placeOfSupplyState: member.stateCode,
          branchStateCode: branch.stateCode,
          subtotalPaise: gst.subtotalPaise,
          taxablePaise: gst.taxablePaise,
          cgstPaise: gst.cgstPaise,
          sgstPaise: gst.sgstPaise,
          igstPaise: gst.igstPaise,
          totalPaise: gst.totalPaise,
          paidPaise: gst.totalPaise,
          balanceDuePaise: 0,
        },
      });
      await tx.payment.create({
        data: {
          orgId: ctx.org.id,
          branchId: input.branchId,
          memberId: member.id,
          invoiceId: inv.id,
          amountPaise: gst.totalPaise,
          method: input.method,
          provider: "MANUAL",
          idempotencyKey: `pos_${pos.id}`,
          status: "CAPTURED",
          collectedById: ctx.user.id,
          referenceText: `POS Basket (${cartLines.length} SKUs)`,
        },
      });
    }

    return pos;
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/billing");
  return { ok: true as const, invoiceNumber: sale.invoiceNumber, totalPaise: totals.totalPaise };
}

export async function createInventorySkuAction(input: {
  branchId: string;
  sku: string;
  name: string;
  category: "SUPPLEMENTS" | "APPAREL" | "BEVERAGE" | "ACCESSORIES";
  unitPricePaise: number;
  costPaise: number;
  stockQty: number;
  reorderLevel: number;
  supplierName: string;
}) {
  const ctx = await requireAuthContext({ permission: "inventory:pos", branchId: input.branchId });
  await prisma.inventoryItem.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category,
      unitPricePaise: Math.max(0, Math.trunc(input.unitPricePaise)),
      costPaise: Math.max(0, Math.trunc(input.costPaise)),
      stockQty: Math.max(0, Math.trunc(input.stockQty)),
      reorderLevel: Math.max(1, Math.trunc(input.reorderLevel)),
      supplierName: input.supplierName.trim(),
    },
  });
  revalidatePath("/app/inventory");
  return { ok: true as const };
}

export async function createEquipmentAssetAction(input: {
  branchId: string;
  assetCode: string;
  name: string;
  zone: string;
  brand: string;
}) {
  const ctx = await requireAuthContext({ permission: "equipment:manage", branchId: input.branchId });
  await prisma.equipmentAsset.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      assetCode: input.assetCode.trim().toUpperCase(),
      name: input.name.trim(),
      zone: input.zone.trim(),
      brand: input.brand.trim(),
      status: "OPERATIONAL",
    },
  });
  revalidatePath("/app/inventory");
  return { ok: true as const };
}

/* ─────────────────────────── ORG ADMIN, BRANCHES, STAFF, WEBHOOKS & AUTOMATION PULSE ─────────────────────────── */

export async function updateOrgProfileSettingsAction(input: {
  name: string;
  gstin?: string;
  legalStateCode: string;
  upiVpa: string;
  invoicePrefix: string;
  defaultGstBps: number;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  await prisma.organization.update({
    where: { id: ctx.org.id },
    data: {
      name: input.name.trim(),
      gstin: input.gstin?.trim().toUpperCase() || null,
      legalStateCode: input.legalStateCode.trim().toUpperCase(),
      upiVpa: input.upiVpa.trim(),
      invoicePrefix: input.invoicePrefix.trim().toUpperCase(),
      defaultGstBps: Math.max(0, Math.min(2800, Math.trunc(input.defaultGstBps))),
    },
  });
  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "ORG_SETTINGS_UPDATED",
    resourceType: "Organization",
    resourceId: ctx.org.id,
    diff: { upiVpa: input.upiVpa, gstin: input.gstin },
    ip: ctx.clientIp,
  });
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function upsertBranchHolidayAction(input: {
  branchId: string;
  title: string;
  date: string;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin", branchId: input.branchId });
  const cleanTitle = input.title.trim();
  if (cleanTitle.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false as const, error: "Provide valid holiday title and YYYY-MM-DD date." };
  }
  const holiday = await prisma.branchHoliday.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      title: cleanTitle,
      date: new Date(`${input.date}T00:00:00Z`),
    },
  });
  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "BRANCH_HOLIDAY_CREATED",
    resourceType: "BranchHoliday",
    resourceId: holiday.id,
    diff: { title: cleanTitle, date: input.date },
    ip: ctx.clientIp,
  });
  revalidatePath("/app/settings");
  return { ok: true as const, id: holiday.id };
}

export async function deleteBranchHolidayAction(holidayId: string) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const holiday = await prisma.branchHoliday.findFirst({
    where: { id: holidayId, orgId: ctx.org.id },
  });
  if (!holiday) return { ok: false as const, error: "Holiday not found." };
  await prisma.branchHoliday.delete({ where: { id: holiday.id } });
  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: holiday.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "BRANCH_HOLIDAY_DELETED",
    resourceType: "BranchHoliday",
    resourceId: holiday.id,
    diff: { title: holiday.title },
    ip: ctx.clientIp,
  });
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function upsertBranchWithGeoAction(input: {
  name: string;
  code: string;
  address: string;
  stateCode: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM?: number;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const code = input.code.trim().toUpperCase();
  await prisma.branch.upsert({
    where: { orgId_code: { orgId: ctx.org.id, code } },
    update: {
      name: input.name.trim(),
      address: input.address.trim(),
      stateCode: input.stateCode.trim().toUpperCase(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      geofenceRadiusM: Math.max(20, Math.trunc(input.geofenceRadiusM ?? 75)),
    },
    create: {
      orgId: ctx.org.id,
      name: input.name.trim(),
      code,
      address: input.address.trim(),
      stateCode: input.stateCode.trim().toUpperCase(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      geofenceRadiusM: Math.max(20, Math.trunc(input.geofenceRadiusM ?? 75)),
      hoursJson: { mon_sat: "05:30-22:30", sun: "07:00-19:00" },
      invoiceSeriesPrefix: `${ctx.org.invoicePrefix}-${code.slice(0, 3)}`,
    },
  });
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function inviteOrUpdateStaffMemberAction(input: {
  name: string;
  email: string;
  phone?: string;
  role: CrmRole;
  branchId: string;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: input.name.trim(), phone: input.phone?.trim() || undefined },
    create: {
      email,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      passwordHash: hashPassword("ForgeStaff@2026"),
    },
  });

  await prisma.orgMembership.upsert({
    where: { orgId_userId: { orgId: ctx.org.id, userId: user.id } },
    update: { role: input.role, branchIds: [input.branchId] },
    create: { orgId: ctx.org.id, userId: user.id, role: input.role, branchIds: [input.branchId], acceptedAt: new Date() },
  });

  revalidatePath("/app/settings");
  return { ok: true as const, userId: user.id };
}

export async function testOutboundWebhookDeliveryAction(subscriptionId: string) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const sub = await prisma.webhookSubscription.findFirst({ where: { id: subscriptionId, orgId: ctx.org.id } });
  if (!sub) return { ok: false as const, error: "Subscription not found." };

  const payload = {
    event: sub.events[0] ?? "member.created",
    orgId: ctx.org.id,
    orgName: ctx.org.name,
    timestamp: new Date().toISOString(),
    sample: { memberCode: "FM-1001", status: "ACTIVE" },
  };
  const bodyStr = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", sub.secretPreview).update(bodyStr).digest("hex");

  let statusCode = 200;
  let status = "DELIVERED";
  let errorText: string | null = null;
  if (!sub.targetUrl.includes("example") && !sub.targetUrl.includes("localhost")) {
    try {
      const res = await fetch(sub.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forge-Signature": sig,
        },
        body: bodyStr,
        signal: AbortSignal.timeout(3000),
      });
      statusCode = res.status;
      if (!res.ok) status = "FAILED";
    } catch (err) {
      statusCode = 0;
      status = "DLQ";
      errorText = err instanceof Error ? err.message : "Network error";
    }
  }

  await prisma.$transaction([
    prisma.outboundWebhookDelivery.create({
      data: {
        orgId: ctx.org.id,
        subscriptionId: sub.id,
        event: payload.event,
        payloadJson: payload,
        statusCode,
        attemptNo: 1,
        status,
        errorText,
      },
    }),
    prisma.webhookSubscription.update({
      where: { id: sub.id },
      data: { lastDeliveryAt: new Date() },
    }),
  ]);

  revalidatePath("/app/settings");
  return { ok: true as const, status, statusCode, signature: sig.slice(0, 16) };
}

export async function runAllActiveAutomationsCronPulseAction() {
  const ctx = await requireAuthContext({ permission: "automations:manage" });
  await enqueueCrmJob("outreach.dispatch", { orgId: ctx.org.id, mode: "CRON_PULSE" });

  const rules = await prisma.automationRule.findMany({
    where: { orgId: ctx.org.id, isActive: true },
  });
  const istHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())
  );

  const members = await prisma.member.findMany({
    where: { orgId: ctx.org.id, deletedAt: null, mergedIntoMemberId: null },
    include: {
      branch: { select: { name: true } },
      consents: { orderBy: { recordedAt: "desc" } },
      invoices: { where: { balanceDuePaise: { gt: 0 } }, select: { balanceDuePaise: true } },
      _count: { select: { checkIns: true, rewardsEarned: true } },
    },
    take: 300,
  });

  const now = new Date();
  let rulesExecuted = 0;
  let totalDispatched = 0;

  for (const rule of rules) {
    const inQuiet = evaluateQuietHours(istHour, rule.quietStartHour, rule.quietEndHour);
    const matches = members.filter((m) => {
      const daysUntilExp = m.expiryDate ? Math.round((m.expiryDate.getTime() - now.getTime()) / 86_400_000) : null;
      const daysAbsent = m.lastVisitedAt ? Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000) : 99;
      switch (rule.triggerKey) {
        case "WELCOME_NEW":
          return Math.round((now.getTime() - m.createdAt.getTime()) / 86_400_000) <= 3;
        case "EXPIRY_T7":
          return daysUntilExp !== null && daysUntilExp <= 7 && daysUntilExp > 3;
        case "EXPIRY_T3":
          return daysUntilExp !== null && daysUntilExp <= 3 && daysUntilExp > 0;
        case "EXPIRY_T0":
          return daysUntilExp === 0;
        case "EXPIRY_T_PLUS_3":
          return daysUntilExp !== null && daysUntilExp < 0 && daysUntilExp >= -7;
        case "MISSED_7D":
          return m.status === "ACTIVE" && daysAbsent >= 7 && daysAbsent < 30;
        case "WINBACK_30D":
          return m.status === "EXPIRED" || daysAbsent >= 30;
        case "PAYMENT_DUE":
        case "PAYMENT_FAILED":
          return m.invoices.reduce((s, i) => s + i.balanceDuePaise, 0) > 0;
        case "BIRTHDAY_TODAY":
          return Boolean(
            m.dob && m.dob.getUTCMonth() === now.getUTCMonth() && m.dob.getUTCDate() === now.getUTCDate()
          );
        case "FEEDBACK_5TH_VISIT":
          return m._count.checkIns === 5;
        case "REFERRAL_THANKYOU":
          return m._count.rewardsEarned > 0;
        default:
          return m.status === "ACTIVE";
      }
    });

    let dispatchedCount = 0;
    let skippedOptOut = 0;
    if (!inQuiet) {
      for (const m of matches.slice(0, 10)) {
        const waConsent = m.consents.find((c) => c.channel === "WHATSAPP")?.granted ?? true;
        if (!waConsent) {
          skippedOptOut++;
          continue;
        }
        const due = m.invoices.reduce((s, i) => s + i.balanceDuePaise, 0);
        const body = interpolateTemplateVars(rule.messageTemplate, {
          name: m.fullName,
          plan: "Club Pass",
          branch: m.branch.name,
          expiry: m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : "Active",
          dueAmountPaise: due,
        });
        await dispatchMemberMessage({
          orgId: ctx.org.id,
          branchId: m.branchId,
          memberId: m.id,
          channel:
            rule.actionChannel === "SMS" || rule.actionChannel === "EMAIL"
              ? rule.actionChannel
              : "WHATSAPP",
          recipient: m.phone,
          templateCode: rule.triggerKey,
          body,
        });
        dispatchedCount++;
        totalDispatched++;
      }
    }

    await prisma.automationRun.create({
      data: {
        orgId: ctx.org.id,
        branchId: rule.branchId,
        ruleId: rule.id,
        mode: "LIVE",
        matchedCount: matches.length,
        dispatchedCount,
        skippedOptOutCount: skippedOptOut,
        skippedCapCount: 0,
        skippedQuietHours: inQuiet,
      },
    });
    rulesExecuted++;
  }

  revalidatePath("/app/automations");
  return { ok: true as const, rulesExecuted, totalDispatched };
}

/* ─────────────────────────── MEMBER PORTAL v2 & AI DISMISS ─────────────────────────── */

export async function dismissAiDraftAction(logId: string) {
  const ctx = await requireAuthContext({ permission: "ai:use" });
  const log = await prisma.aiAssistantLog.findFirst({ where: { id: logId, orgId: ctx.org.id } });
  if (!log) return { ok: false as const, error: "Log not found." };
  await prisma.aiAssistantLog.update({ where: { id: log.id }, data: { approvalStatus: "DISMISSED" } });
  revalidatePath("/app/ai");
  return { ok: true as const };
}

export async function portalSelfPayInvoiceAction(input: {
  invoiceId: string;
  method: "UPI" | "CARD";
}) {
  const ctx = await requireAuthContext({ permission: "portal:self" });
  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [{ email: ctx.user.email }, ...(ctx.user.phone ? [{ phone: ctx.user.phone }] : [])],
    },
  });
  if (!member) return { ok: false as const, error: "Member profile not linked." };

  const inv = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: ctx.org.id, memberId: member.id },
  });
  if (!inv || inv.balanceDuePaise <= 0) return { ok: false as const, error: "Invoice already settled." };

  const payAmt = inv.balanceDuePaise;
  const calc = applyPaymentToInvoice({
    totalPaise: inv.totalPaise,
    paidSoFarPaise: inv.paidPaise,
    paymentPaise: payAmt,
  });
  if (!calc.ok) return { ok: false as const, error: calc.error };

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        orgId: ctx.org.id,
        branchId: inv.branchId,
        memberId: member.id,
        invoiceId: inv.id,
        amountPaise: payAmt,
        method: input.method,
        provider: "RAZORPAY",
        providerPaymentId: `pay_portal_${crypto.randomBytes(5).toString("hex")}`,
        idempotencyKey: `portal_${inv.id}_${Date.now()}`,
        status: "CAPTURED",
        referenceText: "Member Portal Instant Checkout",
      },
    }),
    prisma.invoice.update({
      where: { id: inv.id },
      data: { paidPaise: calc.nextPaidPaise, balanceDuePaise: calc.nextBalanceDuePaise, status: calc.nextStatus },
    }),
    prisma.member.update({ where: { id: member.id }, data: { status: "ACTIVE" } }),
  ]);

  revalidatePath("/portal");
  revalidatePath("/app/billing");
  return { ok: true as const, paidPaise: payAmt };
}

export async function portalGeofenceSelfCheckInAction(input: {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}) {
  const ctx = await requireAuthContext({ permission: "portal:self" });
  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [{ email: ctx.user.email }, ...(ctx.user.phone ? [{ phone: ctx.user.phone }] : [])],
    },
    include: { branch: true },
  });
  if (!member) return { ok: false as const, error: "Member profile not linked." };

  const verdict = evaluateGeofenceCheckIn({
    branchLat: member.branch.latitude ?? 12.9716,
    branchLng: member.branch.longitude ?? 77.6412,
    radiusMeters: member.branch.geofenceRadiusM,
    deviceLat: input.latitude,
    deviceLng: input.longitude,
    accuracyMeters: input.accuracyMeters,
  });
  if (!verdict.allowed) return { ok: false as const, error: verdict.label };

  const access = evaluateCheckInAccess({
    status: member.status,
    expiryDate: member.expiryDate,
    timeZone: member.branch.timezone,
  });
  if (!access.allowed) return { ok: false as const, error: access.reason };

  await prisma.$transaction([
    prisma.checkIn.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        method: "QR",
        result: access.result,
        deviceId: "PORTAL-GPS",
        latitude: input.latitude,
        longitude: input.longitude,
        distanceMeters: verdict.distanceMeters,
      },
    }),
    prisma.member.update({ where: { id: member.id }, data: { lastVisitedAt: new Date() } }),
  ]);

  revalidatePath("/portal");
  revalidatePath("/app/checkin");
  return { ok: true as const, distanceMeters: verdict.distanceMeters };
}

export async function portalSignWaiverAction(input: { signerName: string; signatureDataUrl: string }) {
  const ctx = await requireAuthContext({ permission: "portal:self" });
  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [{ email: ctx.user.email }, ...(ctx.user.phone ? [{ phone: ctx.user.phone }] : [])],
    },
  });
  if (!member) return { ok: false as const, error: "Member profile not linked." };

  const base64Part = input.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const stored = await storeDocumentObject({
    orgId: ctx.org.id,
    memberId: member.id,
    fileName: "portal-waiver.png",
    mimeType: "image/png",
    bytes: Buffer.from(base64Part, "base64"),
  });

  await prisma.memberDocument.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      kind: "WAIVER",
      title: `Self-Service Digital Waiver (${input.signerName.trim()})`,
      fileKey: stored.ok ? stored.key : null,
      signedAt: new Date(),
      signedIp: ctx.clientIp ?? "127.0.0.1",
      signerName: input.signerName.trim(),
    },
  });
  await prisma.member.update({ where: { id: member.id }, data: { healthConsentAt: new Date() } });
  revalidatePath("/portal");
  return { ok: true as const };
}
