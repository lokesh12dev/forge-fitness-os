"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSessionCookie,
  destroySessionCookie,
  hashPassword,
  requireAuthContext,
  verifyPassword,
} from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { aggregateGstInvoice } from "@/lib/gst";
import {
  computeFreezeApplication,
  computeMembershipRenewal,
  computeUpgradeProration,
} from "@/lib/membership-math";
import { applyBpsDiscount } from "@/lib/money";
import { applyCreditNoteRefund, applyPaymentToInvoice, reconcileCashDrawer } from "@/lib/dues-ledger";
import { evaluateCheckInAccess } from "@/lib/checkin-gate";
import { encryptSensitiveField } from "@/lib/encryption";
import { dispatchMemberMessage } from "@/lib/adapters/messaging";
import { triggerTurnstileRelay } from "@/lib/adapters/turnstile";
import { seedFullDemoWorkspace } from "@/lib/demo-seed";
import { AuthorizationError, canAccessBranch, type CrmRole } from "@/lib/rbac";

/* ─────────────────────────── AUTH & ORG ONBOARDING ─────────────────────────── */

export async function loginWithPasswordAction(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { org: { include: { branches: true } } },
      },
    },
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return { ok: false as const, error: "Invalid email or password." };
  }

  const membership = user.memberships[0];
  if (!membership) {
    return { ok: false as const, error: "User is not linked to any organization." };
  }

  const firstBranch =
    membership.role === "OWNER" || membership.role === "ACCOUNTANT"
      ? membership.org.branches[0]?.id ?? null
      : membership.branchIds[0] ?? membership.org.branches[0]?.id ?? null;

  await createSessionCookie({
    userId: user.id,
    orgId: membership.orgId,
    activeBranchId: firstBranch,
  });

  return { ok: true as const, role: membership.role as CrmRole };
}

export async function requestPhoneOtpAction(phone: string) {
  const cleanPhone = phone.trim();
  if (cleanPhone.length < 8) {
    return { ok: false as const, error: "Enter a valid phone number." };
  }
  const code = "482910"; // Deterministic dev OTP when SMS key missing
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  await prisma.otpChallenge.create({
    data: {
      phoneOrEmail: cleanPhone,
      codeHash,
      channel: process.env.SMS_API_KEY ? "SMS" : "MOCK_OTP",
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  return {
    ok: true as const,
    mockOtpHint: process.env.SMS_API_KEY ? undefined : "Mock SMS OTP: 482910",
  };
}

export async function verifyPhoneOtpLoginAction(input: { phone: string; code: string }) {
  const cleanPhone = input.phone.trim();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { phoneOrEmail: cleanPhone, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    return { ok: false as const, error: "OTP expired or not requested." };
  }
  const submittedHash = crypto.createHash("sha256").update(input.code.trim()).digest("hex");
  if (submittedHash !== challenge.codeHash) {
    return { ok: false as const, error: "Incorrect OTP code." };
  }

  const user = await prisma.user.findFirst({
    where: { phone: { contains: cleanPhone.replace(/\D/g, "").slice(-10) } },
    include: { memberships: { include: { org: { include: { branches: true } } } } },
  });
  if (!user || !user.memberships[0]) {
    return { ok: false as const, error: "No staff account found for this phone number." };
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
  const m = user.memberships[0];
  await createSessionCookie({
    userId: user.id,
    orgId: m.orgId,
    activeBranchId: m.branchIds[0] ?? m.org.branches[0]?.id ?? null,
  });

  return { ok: true as const, role: m.role as CrmRole };
}

export async function signOutAction() {
  await destroySessionCookie();
  redirect("/login");
}

export async function switchActiveBranchAction(branchId: string) {
  const ctx = await requireAuthContext({ redirectOnUnauth: false });
  if (branchId !== "ALL" && !canAccessBranch(ctx.role, ctx.assignedBranchIds, branchId)) {
    throw new AuthorizationError("You are not authorized for this branch.");
  }
  await prisma.session.update({
    where: { id: ctx.sessionId },
    data: { activeBranchId: branchId === "ALL" ? null : branchId },
  });
  revalidatePath("/app");
  return { ok: true as const };
}

const OnboardingSchema = z.object({
  orgName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(80),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  gstin: z.string().max(20).optional(),
  currency: z.enum(["INR", "USD"]).default("INR"),
  invoicePrefix: z.string().min(2).max(6).default("FRG"),
  defaultGstBps: z.number().int().min(0).max(2800).default(1800),
  branchName: z.string().min(2).max(80),
  branchCode: z.string().min(2).max(12),
  branchAddress: z.string().min(4).max(200),
  branchStateCode: z.string().min(2).max(4).default("KA"),
  openHour: z.string().default("06:00"),
  closeHour: z.string().default("22:00"),
  holidayTitle: z.string().optional(),
  holidayDate: z.string().optional(),
  inviteEmail: z.string().optional(),
  inviteRole: z.enum(["MANAGER", "FRONTDESK", "TRAINER", "ACCOUNTANT"]).optional(),
});

export async function createOrgFromWizardAction(rawInput: z.infer<typeof OnboardingSchema>) {
  const parsed = OnboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid onboarding input" };
  }
  const d = parsed.data;
  const email = d.ownerEmail.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false as const, error: "An account with that email already exists. Sign in instead." };
  }

  const slug = `${d.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: d.orgName.trim(),
        slug,
        currency: d.currency,
        timezone: "Asia/Kolkata",
        gstin: d.gstin?.trim() || null,
        legalStateCode: d.branchStateCode.toUpperCase(),
        invoicePrefix: d.invoicePrefix.toUpperCase(),
        defaultGstBps: d.defaultGstBps,
        demoLoaded: false,
      },
    });

    const branch = await tx.branch.create({
      data: {
        orgId: org.id,
        name: d.branchName.trim(),
        code: d.branchCode.trim().toUpperCase(),
        address: d.branchAddress.trim(),
        stateCode: d.branchStateCode.trim().toUpperCase(),
        timezone: "Asia/Kolkata",
        invoiceSeriesPrefix: `${d.invoicePrefix.toUpperCase()}-${d.branchCode.trim().toUpperCase()}`,
        nextInvoiceSeq: 1,
        hoursJson: { open: d.openHour, close: d.closeHour },
      },
    });

    if (d.holidayDate && d.holidayTitle?.trim()) {
      await tx.branchHoliday.create({
        data: {
          orgId: org.id,
          branchId: branch.id,
          date: new Date(`${d.holidayDate}T00:00:00Z`),
          title: d.holidayTitle.trim(),
        },
      });
    }

    const owner = await tx.user.create({
      data: {
        name: d.ownerName.trim(),
        email,
        passwordHash: hashPassword(d.ownerPassword),
      },
    });

    await tx.orgMembership.create({
      data: {
        orgId: org.id,
        userId: owner.id,
        role: "OWNER",
        branchIds: [branch.id],
        acceptedAt: new Date(),
      },
    });

    if (d.inviteEmail && d.inviteEmail.includes("@") && d.inviteRole) {
      const invitedUser = await tx.user.create({
        data: {
          name: d.inviteEmail.split("@")[0] ?? "Staff",
          email: d.inviteEmail.trim().toLowerCase(),
          passwordHash: hashPassword("ForgeStaff@2026"),
        },
      });
      await tx.orgMembership.create({
        data: {
          orgId: org.id,
          userId: invitedUser.id,
          role: d.inviteRole,
          branchIds: [branch.id],
          acceptedAt: new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        orgId: org.id,
        branchId: branch.id,
        actorUserId: owner.id,
        actorRole: "OWNER",
        action: "ORG_ONBOARDED",
        resourceType: "Organization",
        resourceId: org.id,
        requestId: `req_${crypto.randomBytes(5).toString("hex")}`,
      },
    });

    return { org, branch, owner };
  });

  await createSessionCookie({
    userId: created.owner.id,
    orgId: created.org.id,
    activeBranchId: created.branch.id,
  });

  return { ok: true as const, orgId: created.org.id };
}

export async function loadDemoDataForOrgAction() {
  const ctx = await requireAuthContext({ permission: "org:manage", redirectOnUnauth: false });
  const seeded = await seedFullDemoWorkspace(prisma, ctx.org.id);
  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "DEMO_DATA_LOADED",
    resourceType: "Organization",
    resourceId: ctx.org.id,
    diff: { members: seeded.memberCount, checkIns: seeded.checkInCount },
    ip: ctx.clientIp,
  });
  revalidatePath("/app");
  revalidatePath("/app/members");
  return { ok: true as const, ...seeded };
}

/* ─────────────────────────── MEMBERS ACTIONS ─────────────────────────── */

const CreateMemberSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.string().optional(),
  address: z.string().optional(),
  stateCode: z.string().min(2).max(4).default("KA"),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  goals: z.string().optional(),
  healthNotes: z.string().optional(),
  healthConsent: z.boolean().default(false),
  whatsappConsent: z.boolean().default(true),
  waiverSigned: z.boolean().default(true),
  kycLast4: z.string().max(12).optional(),
  tags: z.array(z.string()).default([]),
});

export async function createMemberAction(rawInput: z.infer<typeof CreateMemberSchema>) {
  const parsed = CreateMemberSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid member data" };
  }
  const d = parsed.data;
  const ctx = await requireAuthContext({
    permission: "members:write",
    branchId: d.branchId,
    redirectOnUnauth: false,
  });

  const count = await prisma.member.count({ where: { orgId: ctx.org.id } });
  const memberCode = `FM-${String(1001 + count + Math.floor(Math.random() * 50))}`;
  const qrToken = `FORGEQR-${ctx.org.slug.slice(0, 3).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const referralCode = `REF${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        orgId: ctx.org.id,
        branchId: d.branchId,
        memberCode,
        qrToken,
        fullName: d.fullName.trim(),
        phone: d.phone.trim(),
        email: d.email?.trim() || null,
        gender: d.gender?.trim() || null,
        address: d.address?.trim() || null,
        stateCode: d.stateCode.trim().toUpperCase(),
        emergencyName: d.emergencyName?.trim() || null,
        emergencyPhone: d.emergencyPhone?.trim() || null,
        goals: d.goals?.trim() || null,
        healthNotesEnc:
          d.healthConsent && d.healthNotes?.trim()
            ? encryptSensitiveField(d.healthNotes)
            : null,
        healthConsentAt: d.healthConsent ? new Date() : null,
        status: "EXPIRED",
        referralCode,
        tags: d.tags,
      },
    });

    await tx.consentRecord.createMany({
      data: [
        {
          orgId: ctx.org.id,
          branchId: d.branchId,
          memberId: created.id,
          channel: "WHATSAPP",
          granted: d.whatsappConsent,
          source: "Member Registration",
          ip: ctx.clientIp,
        },
        {
          orgId: ctx.org.id,
          branchId: d.branchId,
          memberId: created.id,
          channel: "HEALTH_DATA",
          granted: d.healthConsent,
          source: "DPDP Health Declaration",
          ip: ctx.clientIp,
        },
      ],
    });

    if (d.waiverSigned) {
      await tx.memberDocument.create({
        data: {
          orgId: ctx.org.id,
          branchId: d.branchId,
          memberId: created.id,
          kind: "WAIVER",
          title: "Facility Liability Waiver & PAR-Q",
          signedAt: new Date(),
          signedIp: ctx.clientIp,
          signerName: d.fullName.trim(),
        },
      });
    }

    if (d.kycLast4?.trim()) {
      await tx.memberDocument.create({
        data: {
          orgId: ctx.org.id,
          branchId: d.branchId,
          memberId: created.id,
          kind: "KYC_AADHAAR",
          title: "Government ID KYC Verification",
          kycLast4: d.kycLast4.trim().slice(-4),
          kycNumberEnc: encryptSensitiveField(d.kycLast4.trim()),
        },
      });
    }

    return created;
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: d.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "MEMBER_CREATED",
    resourceType: "Member",
    resourceId: member.id,
    ip: ctx.clientIp,
  });

  revalidatePath("/app/members");
  revalidatePath("/app");
  return { ok: true as const, memberId: member.id, memberCode: member.memberCode };
}

export async function addMemberMeasurementAction(input: {
  memberId: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  notes?: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: false });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
  });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member inaccessible");
  }

  await prisma.memberMeasurement.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      weightGrams: Math.round(input.weightKg * 1000),
      bodyFatBps: input.bodyFatPct ? Math.round(input.bodyFatPct * 100) : null,
      waistMm: input.waistCm ? Math.round(input.waistCm * 10) : null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const };
}

export async function addMemberNoteAction(input: {
  memberId: string;
  kind: "NOTE" | "CALL" | "FOLLOWUP";
  body: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: false });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
  });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member inaccessible");
  }
  await prisma.memberNote.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      authorUserId: ctx.user.id,
      kind: input.kind,
      body: input.body.trim(),
    },
  });
  revalidatePath(`/app/members/${member.id}`);
  return { ok: true as const };
}

export async function sendMemberOutreachAction(input: {
  memberId: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  body: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:read", redirectOnUnauth: false });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
  });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Member inaccessible");
  }

  const res = await dispatchMemberMessage({
    orgId: ctx.org.id,
    branchId: member.branchId,
    memberId: member.id,
    channel: input.channel,
    recipient: input.channel === "EMAIL" ? member.email ?? member.phone : member.phone,
    body: input.body.trim(),
  });
  revalidatePath(`/app/members/${member.id}`);
  return res;
}

export async function mergeDuplicateMembersAction(input: {
  survivorId: string;
  duplicateId: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:write", redirectOnUnauth: false });
  if (input.survivorId === input.duplicateId) {
    return { ok: false as const, error: "Select two distinct member profiles." };
  }
  const [survivor, dup] = await Promise.all([
    prisma.member.findFirst({ where: { id: input.survivorId, orgId: ctx.org.id } }),
    prisma.member.findFirst({ where: { id: input.duplicateId, orgId: ctx.org.id } }),
  ]);
  if (!survivor || !dup) return { ok: false as const, error: "Member not found." };

  await prisma.$transaction([
    prisma.membership.updateMany({ where: { memberId: dup.id }, data: { memberId: survivor.id } }),
    prisma.invoice.updateMany({ where: { memberId: dup.id }, data: { memberId: survivor.id } }),
    prisma.payment.updateMany({ where: { memberId: dup.id }, data: { memberId: survivor.id } }),
    prisma.checkIn.updateMany({ where: { memberId: dup.id }, data: { memberId: survivor.id } }),
    prisma.memberNote.updateMany({ where: { memberId: dup.id }, data: { memberId: survivor.id } }),
    prisma.member.update({
      where: { id: dup.id },
      data: { mergedIntoMemberId: survivor.id, deletedAt: new Date() },
    }),
  ]);

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: survivor.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "MEMBER_DUPLICATES_MERGED",
    resourceType: "Member",
    resourceId: survivor.id,
    diff: { duplicateId: dup.id },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/members");
  return { ok: true as const };
}

/* ─────────────────────────── SELL PLAN, BILLING, FREEZE & REFUNDS ─────────────────────────── */

const SellPlanSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().min(1),
  addonIds: z.array(z.string()).default([]),
  promoCode: z.string().optional(),
  includeJoiningFee: z.boolean().default(true),
  payNowPaise: z.number().int().min(0),
  paymentMethod: z.enum(["UPI", "CARD", "CASH", "BANK_TRANSFER", "SPLIT"]).default("UPI"),
});

export async function sellPlanAndInvoiceAction(rawInput: z.infer<typeof SellPlanSchema>) {
  const parsed = SellPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid sale input" };
  }
  const d = parsed.data;
  const ctx = await requireAuthContext({ permission: "billing:collect", redirectOnUnauth: false });

  const [member, plan, addons] = await Promise.all([
    prisma.member.findFirst({
      where: { id: d.memberId, orgId: ctx.org.id },
      include: { branch: true },
    }),
    prisma.plan.findFirst({ where: { id: d.planId, orgId: ctx.org.id } }),
    d.addonIds.length > 0
      ? prisma.planAddon.findMany({ where: { id: { in: d.addonIds }, orgId: ctx.org.id } })
      : Promise.resolve([]),
  ]);

  if (!member || !plan) return { ok: false as const, error: "Member or plan not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Forbidden branch access.");
  }

  let discountPaise = 0;
  if (d.promoCode?.trim()) {
    const promo = await prisma.promoCode.findFirst({
      where: { orgId: ctx.org.id, code: d.promoCode.trim().toUpperCase(), isActive: true },
    });
    if (promo && promo.redeemedCount < promo.maxRedemptions) {
      discountPaise =
        promo.discountType === "PERCENT_BPS"
          ? applyBpsDiscount(plan.pricePaise, promo.discountValue)
          : Math.min(plan.pricePaise, promo.discountValue);
      await prisma.promoCode.update({
        where: { id: promo.id },
        data: { redeemedCount: { increment: 1 } },
      });
    }
  }

  const linesInput = [
    {
      description: `${plan.name} (${plan.durationDays} ${plan.durationDays === 1 ? "day" : "days"})`,
      unitPricePaise: plan.pricePaise,
      quantity: 1,
      discountPaise,
      gstRateBps: plan.gstRateBps,
    },
    ...(d.includeJoiningFee && plan.joiningFeePaise > 0
      ? [
          {
            description: "Club Registration / Joining Fee",
            unitPricePaise: plan.joiningFeePaise,
            quantity: 1,
            discountPaise: 0,
            gstRateBps: plan.gstRateBps,
          },
        ]
      : []),
    ...addons.map((a) => ({
      description: `Add-on: ${a.name}`,
      unitPricePaise: a.pricePaise,
      quantity: 1,
      discountPaise: 0,
      gstRateBps: a.gstRateBps,
    })),
  ];

  const gst = aggregateGstInvoice(linesInput, member.stateCode, member.branch.stateCode);
  const payAmount = Math.min(gst.totalPaise, Math.max(0, d.payNowPaise));
  const renewalDates = computeMembershipRenewal(
    member.expiryDate,
    new Date(),
    plan.durationDays,
    member.branch.timezone
  );

  const created = await prisma.$transaction(async (tx) => {
    const updatedBranch = await tx.branch.update({
      where: { id: member.branchId },
      data: { nextInvoiceSeq: { increment: 1 } },
    });
    const seqNo = updatedBranch.nextInvoiceSeq - 1;
    const invoiceNumber = `${updatedBranch.invoiceSeriesPrefix}-${String(seqNo).padStart(5, "0")}`;

    const membership = await tx.membership.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        planId: plan.id,
        status: payAmount < gst.totalPaise ? "OVERDUE" : "ACTIVE",
        startDate: renewalDates.startDate,
        endDate: renewalDates.newEndDate,
        basePricePaise: plan.pricePaise,
        discountPaise,
        joiningFeePaise: d.includeJoiningFee ? plan.joiningFeePaise : 0,
        sessionsTotal: plan.sessionCredits,
        sessionsRemaining: plan.sessionCredits,
        autoRenew: plan.autoRenewDefault,
        promoCode: d.promoCode?.trim().toUpperCase() || null,
      },
    });

    const applied =
      payAmount > 0
        ? applyPaymentToInvoice({
            totalPaise: gst.totalPaise,
            paidSoFarPaise: 0,
            paymentPaise: payAmount,
          })
        : { ok: true as const, nextPaidPaise: 0, nextBalanceDuePaise: gst.totalPaise, nextStatus: "ISSUED" as const };

    if (!applied.ok) throw new Error(applied.error);

    const invoice = await tx.invoice.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        membershipId: membership.id,
        invoiceNumber,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        status: applied.nextStatus,
        currency: ctx.org.currency,
        sacCode: plan.sacCode,
        placeOfSupplyState: member.stateCode,
        branchStateCode: member.branch.stateCode,
        subtotalPaise: gst.subtotalPaise,
        discountPaise: gst.discountPaise,
        taxablePaise: gst.taxablePaise,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        igstPaise: gst.igstPaise,
        totalPaise: gst.totalPaise,
        paidPaise: applied.nextPaidPaise,
        balanceDuePaise: applied.nextBalanceDuePaise,
        lineItems: {
          create: gst.lines.map((l) => ({
            orgId: ctx.org.id,
            branchId: member.branchId,
            description: l.description,
            quantity: l.quantity,
            unitPricePaise: l.unitPricePaise,
            discountPaise: l.discountPaise,
            gstRateBps: l.gstRateBps,
            cgstPaise: l.cgstPaise,
            sgstPaise: l.sgstPaise,
            igstPaise: l.igstPaise,
            totalPaise: l.totalPaise,
          })),
        },
      },
    });

    if (payAmount > 0) {
      await tx.payment.create({
        data: {
          orgId: ctx.org.id,
          branchId: member.branchId,
          memberId: member.id,
          invoiceId: invoice.id,
          amountPaise: payAmount,
          method: d.paymentMethod,
          provider: d.paymentMethod === "UPI" || d.paymentMethod === "CARD" ? "RAZORPAY" : "MANUAL",
          providerPaymentId: `pay_${crypto.randomBytes(5).toString("hex")}`,
          idempotencyKey: `sale_${invoice.id}_${Date.now()}`,
          status: "CAPTURED",
          collectedById: ctx.user.id,
        },
      });
    }

    await tx.member.update({
      where: { id: member.id },
      data: {
        status: applied.nextBalanceDuePaise > 0 ? "OVERDUE" : "ACTIVE",
        expiryDate: renewalDates.newEndDate,
      },
    });

    return { invoice, membership };
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "PLAN_SOLD_INVOICE_ISSUED",
    resourceType: "Invoice",
    resourceId: created.invoice.id,
    diff: {
      invoiceNumber: created.invoice.invoiceNumber,
      totalPaise: created.invoice.totalPaise,
      paidPaise: created.invoice.paidPaise,
    },
    ip: ctx.clientIp,
  });

  revalidatePath(`/app/members/${member.id}`);
  revalidatePath("/app/members");
  revalidatePath("/app/billing");
  revalidatePath("/app");

  return {
    ok: true as const,
    invoiceId: created.invoice.id,
    invoiceNumber: created.invoice.invoiceNumber,
  };
}

export async function collectInvoicePaymentAction(input: {
  invoiceId: string;
  amountPaise: number;
  method: "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT";
  referenceText?: string;
}) {
  const ctx = await requireAuthContext({ permission: "billing:collect", redirectOnUnauth: false });
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: ctx.org.id },
  });
  if (!invoice || !canAccessBranch(ctx.role, ctx.assignedBranchIds, invoice.branchId)) {
    throw new AuthorizationError("Invoice not found or branch forbidden.");
  }

  const applied = applyPaymentToInvoice({
    totalPaise: invoice.totalPaise,
    paidSoFarPaise: invoice.paidPaise,
    paymentPaise: input.amountPaise,
  });
  if (!applied.ok) return applied;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orgId: ctx.org.id,
        branchId: invoice.branchId,
        memberId: invoice.memberId,
        invoiceId: invoice.id,
        amountPaise: input.amountPaise,
        method: input.method,
        provider: input.method === "UPI" || input.method === "CARD" ? "RAZORPAY" : "MANUAL",
        idempotencyKey: `col_${invoice.id}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        status: "CAPTURED",
        collectedById: ctx.user.id,
        referenceText: input.referenceText?.trim() || null,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidPaise: applied.nextPaidPaise,
        balanceDuePaise: applied.nextBalanceDuePaise,
        status: applied.nextStatus,
      },
    });
    if (applied.nextBalanceDuePaise === 0) {
      await tx.member.update({
        where: { id: invoice.memberId },
        data: { status: "ACTIVE" },
      });
    }
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: invoice.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "PAYMENT_COLLECTED",
    resourceType: "Invoice",
    resourceId: invoice.id,
    diff: { amountPaise: input.amountPaise, method: input.method },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/billing");
  revalidatePath(`/app/billing/invoices/${invoice.id}`);
  revalidatePath(`/app/members/${invoice.memberId}`);
  revalidatePath("/app");
  return { ok: true as const, balanceDuePaise: applied.nextBalanceDuePaise };
}

export async function issueRefundAction(input: {
  invoiceId: string;
  amountPaise: number;
  reason: string;
}) {
  const ctx = await requireAuthContext({ permission: "billing:refund", redirectOnUnauth: false });
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, orgId: ctx.org.id },
    include: {
      payments: { where: { status: "CAPTURED" }, orderBy: { paidAt: "desc" } },
      refunds: true,
    },
  });
  if (!invoice || !canAccessBranch(ctx.role, ctx.assignedBranchIds, invoice.branchId)) {
    throw new AuthorizationError("Forbidden");
  }
  const latestPayment = invoice.payments[0];
  if (!latestPayment) return { ok: false as const, error: "No captured payment to refund." };

  const alreadyRefunded = invoice.refunds.reduce((acc, r) => acc + r.amountPaise, 0);
  const res = applyCreditNoteRefund({
    totalPaise: invoice.totalPaise,
    paidSoFarPaise: invoice.paidPaise,
    alreadyRefundedPaise: alreadyRefunded,
    refundPaise: input.amountPaise,
  });
  if (!res.ok) return res;

  const creditNoteNumber = `CN-${invoice.invoiceNumber}-${invoice.refunds.length + 1}`;
  await prisma.$transaction([
    prisma.creditNoteRefund.create({
      data: {
        orgId: ctx.org.id,
        branchId: invoice.branchId,
        invoiceId: invoice.id,
        paymentId: latestPayment.id,
        creditNoteNumber,
        amountPaise: input.amountPaise,
        reason: input.reason.trim() || "Member refund approved",
        issuedById: ctx.user.id,
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: res.nextStatus, paidPaise: res.nextPaidPaise },
    }),
  ]);

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: invoice.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "CREDIT_NOTE_REFUND_ISSUED",
    resourceType: "Invoice",
    resourceId: invoice.id,
    diff: { creditNoteNumber, amountPaise: input.amountPaise, reason: input.reason },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/billing");
  revalidatePath(`/app/billing/invoices/${invoice.id}`);
  return { ok: true as const, creditNoteNumber };
}

export async function freezeMemberSubscriptionAction(input: {
  memberId: string;
  freezeDays: number;
  reason: string;
}) {
  const ctx = await requireAuthContext({ permission: "members:freeze", redirectOnUnauth: false });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
    include: {
      branch: true,
      subscriptions: {
        include: { plan: true },
        orderBy: { endDate: "desc" },
        take: 1,
      },
    },
  });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Forbidden");
  }
  const sub = member.subscriptions[0];
  if (!sub) return { ok: false as const, error: "Member has no active subscription to freeze." };

  const calc = computeFreezeApplication({
    currentEndDate: sub.endDate,
    freezeStartDate: new Date(),
    freezeDays: input.freezeDays,
    maxFreezeDays: sub.plan.maxFreezeDays,
    freezeDaysUsed: sub.freezeDaysUsed,
    feePaise: sub.plan.freezeFeePaise,
    timeZone: member.branch.timezone,
  });
  if (!calc.ok) return calc;

  await prisma.$transaction([
    prisma.membershipFreeze.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        membershipId: sub.id,
        memberId: member.id,
        startDate: new Date(),
        endDate: calc.freezeEndDate,
        daysCount: input.freezeDays,
        feePaise: calc.feePaise,
        reason: input.reason.trim() || "Member requested pause",
        approvedById: ctx.user.id,
      },
    }),
    prisma.membership.update({
      where: { id: sub.id },
      data: {
        status: "FROZEN",
        endDate: calc.newMembershipEndDate,
        freezeDaysUsed: calc.newFreezeDaysUsed,
      },
    }),
    prisma.member.update({
      where: { id: member.id },
      data: {
        status: "FROZEN",
        expiryDate: calc.newMembershipEndDate,
      },
    }),
  ]);

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "MEMBERSHIP_FROZEN",
    resourceType: "Member",
    resourceId: member.id,
    diff: { freezeDays: input.freezeDays, extendedTo: calc.newMembershipEndDate.toISOString() },
    ip: ctx.clientIp,
  });

  revalidatePath(`/app/members/${member.id}`);
  revalidatePath("/app/members");
  return { ok: true as const, newExpiry: calc.newMembershipEndDate.toISOString().slice(0, 10) };
}

export async function unfreezeMemberAction(memberId: string) {
  const ctx = await requireAuthContext({ permission: "members:freeze", redirectOnUnauth: false });
  const member = await prisma.member.findFirst({ where: { id: memberId, orgId: ctx.org.id } });
  if (!member || !canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Forbidden");
  }
  await prisma.$transaction([
    prisma.member.update({ where: { id: member.id }, data: { status: "ACTIVE" } }),
    prisma.membership.updateMany({ where: { memberId: member.id, status: "FROZEN" }, data: { status: "ACTIVE" } }),
  ]);
  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "MEMBERSHIP_UNFROZEN",
    resourceType: "Member",
    resourceId: member.id,
    ip: ctx.clientIp,
  });
  revalidatePath(`/app/members/${member.id}`);
  revalidatePath("/app/members");
  return { ok: true as const };
}

export async function upgradeMemberPlanProratedAction(input: {
  memberId: string;
  targetPlanId: string;
}) {
  const ctx = await requireAuthContext({ permission: "billing:collect", redirectOnUnauth: false });
  const [member, newPlan] = await Promise.all([
    prisma.member.findFirst({
      where: { id: input.memberId, orgId: ctx.org.id },
      include: {
        branch: true,
        subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
      },
    }),
    prisma.plan.findFirst({ where: { id: input.targetPlanId, orgId: ctx.org.id } }),
  ]);
  if (!member || !newPlan) return { ok: false as const, error: "Member or target plan missing." };
  const currentSub = member.subscriptions[0];
  if (!currentSub) {
    return sellPlanAndInvoiceAction({
      memberId: member.id,
      planId: newPlan.id,
      addonIds: [],
      includeJoiningFee: false,
      payNowPaise: 0,
      paymentMethod: "UPI",
    });
  }

  const pro = computeUpgradeProration({
    currentPaidPaise: Math.max(0, currentSub.basePricePaise - currentSub.discountPaise),
    currentStartDate: currentSub.startDate,
    currentEndDate: currentSub.endDate,
    upgradeOnDate: new Date(),
    newPlanPricePaise: newPlan.pricePaise,
    timeZone: member.branch.timezone,
  });

  const gst = aggregateGstInvoice(
    [
      {
        description: `Pro-rated Upgrade to ${newPlan.name} (${pro.unusedDays}d credit ₹${(pro.creditPaise / 100).toFixed(0)})`,
        unitPricePaise: pro.netUpgradePaise,
        quantity: 1,
        gstRateBps: newPlan.gstRateBps,
      },
    ],
    member.stateCode,
    member.branch.stateCode
  );

  const renewal = computeMembershipRenewal(null, new Date(), newPlan.durationDays, member.branch.timezone);
  const res = await prisma.$transaction(async (tx) => {
    const br = await tx.branch.update({
      where: { id: member.branchId },
      data: { nextInvoiceSeq: { increment: 1 } },
    });
    const invNo = `${br.invoiceSeriesPrefix}-${String(br.nextInvoiceSeq - 1).padStart(5, "0")}`;
    const sub = await tx.membership.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        planId: newPlan.id,
        status: "ACTIVE",
        startDate: renewal.startDate,
        endDate: renewal.newEndDate,
        basePricePaise: pro.netUpgradePaise,
        upgradedFromId: currentSub.id,
      },
    });
    const inv = await tx.invoice.create({
      data: {
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        membershipId: sub.id,
        invoiceNumber: invNo,
        dueDate: new Date(),
        status: gst.totalPaise === 0 ? "PAID" : "ISSUED",
        sacCode: newPlan.sacCode,
        placeOfSupplyState: member.stateCode,
        branchStateCode: member.branch.stateCode,
        subtotalPaise: gst.subtotalPaise,
        taxablePaise: gst.taxablePaise,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        igstPaise: gst.igstPaise,
        totalPaise: gst.totalPaise,
        paidPaise: 0,
        balanceDuePaise: gst.totalPaise,
      },
    });
    await tx.member.update({
      where: { id: member.id },
      data: { status: "ACTIVE", expiryDate: renewal.newEndDate },
    });
    return inv;
  });

  revalidatePath(`/app/members/${member.id}`);
  revalidatePath("/app/billing");
  return { ok: true as const, invoiceId: res.id, creditPaise: pro.creditPaise };
}

export async function closeCashDrawerAction(input: {
  branchId: string;
  openingCashPaise: number;
  countedCashPaise: number;
  notes?: string;
}) {
  const ctx = await requireAuthContext({
    permission: "billing:cash_close",
    branchId: input.branchId,
    redirectOnUnauth: false,
  });

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const cashSum = await prisma.payment.aggregate({
    where: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      method: "CASH",
      status: "CAPTURED",
      paidAt: { gte: startOfDay },
    },
    _sum: { amountPaise: true },
  });

  const collectedCash = cashSum._sum.amountPaise ?? 0;
  const result = reconcileCashDrawer({
    openingCashPaise: input.openingCashPaise,
    cashCollectedPaise: collectedCash,
    countedCashPaise: input.countedCashPaise,
  });

  const dateOnly = new Date(startOfDay.toISOString().slice(0, 10) + "T00:00:00Z");
  await prisma.cashReconciliation.upsert({
    where: { orgId_branchId_date: { orgId: ctx.org.id, branchId: input.branchId, date: dateOnly } },
    update: {
      openingCashPaise: input.openingCashPaise,
      collectedCashPaise: collectedCash,
      countedCashPaise: input.countedCashPaise,
      variancePaise: result.variancePaise,
      notes: input.notes?.trim() || null,
      closedById: ctx.user.id,
      closedAt: new Date(),
    },
    create: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      date: dateOnly,
      openingCashPaise: input.openingCashPaise,
      collectedCashPaise: collectedCash,
      countedCashPaise: input.countedCashPaise,
      variancePaise: result.variancePaise,
      notes: input.notes?.trim() || null,
      closedById: ctx.user.id,
    },
  });

  revalidatePath("/app/billing");
  return { ok: true as const, ...result };
}

export async function addExpenseAction(input: {
  branchId: string;
  category: string;
  vendorName: string;
  description: string;
  amountPaise: number;
  gstPaise: number;
}) {
  const ctx = await requireAuthContext({
    permission: "expenses:write",
    branchId: input.branchId,
    redirectOnUnauth: false,
  });

  await prisma.expense.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      category: input.category.trim(),
      vendorName: input.vendorName.trim(),
      description: input.description.trim(),
      amountPaise: Math.max(0, Math.trunc(input.amountPaise)),
      gstPaise: Math.max(0, Math.trunc(input.gstPaise)),
      incurredOn: new Date(),
      createdById: ctx.user.id,
    },
  });

  revalidatePath("/app/billing");
  return { ok: true as const };
}

/* ─────────────────────────── PLANS & TASKS ─────────────────────────── */

export async function createPlanAction(input: {
  name: string;
  code: string;
  billingModel: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "PT_PACK" | "CLASS_PACK" | "DAY_PASS" | "TRIAL";
  durationDays: number;
  sessionCredits: number | null;
  pricePaise: number;
  joiningFeePaise: number;
  maxFreezeDays: number;
  freezeFeePaise: number;
}) {
  const ctx = await requireAuthContext({ permission: "plans:write", redirectOnUnauth: false });
  await prisma.plan.create({
    data: {
      orgId: ctx.org.id,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      billingModel: input.billingModel,
      durationDays: Math.max(1, input.durationDays),
      sessionCredits: input.sessionCredits,
      pricePaise: Math.max(0, input.pricePaise),
      joiningFeePaise: Math.max(0, input.joiningFeePaise),
      maxFreezeDays: Math.max(0, input.maxFreezeDays),
      freezeFeePaise: Math.max(0, input.freezeFeePaise),
      gstRateBps: ctx.org.defaultGstBps,
    },
  });
  revalidatePath("/app/plans");
  return { ok: true as const };
}

export async function toggleStaffTaskAction(taskId: string) {
  const ctx = await requireAuthContext({ redirectOnUnauth: false });
  const task = await prisma.staffTask.findFirst({ where: { id: taskId, orgId: ctx.org.id } });
  if (!task || !canAccessBranch(ctx.role, ctx.assignedBranchIds, task.branchId)) {
    throw new AuthorizationError("Task inaccessible");
  }
  await prisma.staffTask.update({
    where: { id: task.id },
    data: { status: task.status === "OPEN" ? "DONE" : "OPEN" },
  });
  revalidatePath("/app");
  return { ok: true as const };
}

/* ─────────────────────────── ATTENDANCE / CHECK-IN GATE ─────────────────────────── */

export async function performCheckInAction(input: {
  queryOrToken: string;
  branchId: string;
  method: "QR" | "MANUAL" | "PHONE" | "TURNSTILE";
  overrideReason?: string;
}) {
  const ctx = await requireAuthContext({
    permission: "checkin:operate",
    branchId: input.branchId,
    redirectOnUnauth: false,
  });

  const q = input.queryOrToken.trim();
  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [
        { qrToken: { equals: q, mode: "insensitive" } },
        { memberCode: { equals: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      branch: true,
      subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
    },
  });

  if (!member) {
    return { ok: false as const, matched: false as const, error: `No member matched "${q}".` };
  }

  const latestSub = member.subscriptions[0];
  const decision = evaluateCheckInAccess({
    status: member.status,
    expiryDate: member.expiryDate,
    sessionsRemaining: latestSub?.sessionsRemaining ?? null,
    overrideReason: input.overrideReason,
    timeZone: member.branch.timezone,
  });

  if (!decision.allowed) {
    await prisma.checkIn.create({
      data: {
        orgId: ctx.org.id,
        branchId: input.branchId,
        memberId: member.id,
        method: input.method,
        result: decision.result,
        checkedInById: ctx.user.id,
      },
    });
    revalidatePath("/app/checkin");
    return {
      ok: true as const,
      matched: true as const,
      allowed: false as const,
      result: decision.result,
      reason: decision.reason,
      member: {
        id: member.id,
        fullName: member.fullName,
        memberCode: member.memberCode,
        status: member.status,
        expiryDate: member.expiryDate ? member.expiryDate.toISOString().slice(0, 10) : null,
      },
    };
  }

  const turnstile = await triggerTurnstileRelay({
    branchId: input.branchId,
    memberCode: member.memberCode,
  });

  await prisma.$transaction(async (tx) => {
    await tx.checkIn.create({
      data: {
        orgId: ctx.org.id,
        branchId: input.branchId,
        memberId: member.id,
        method: input.method,
        result: decision.result,
        overrideReason:
          decision.result === "OVERRIDE_ALLOWED" ? input.overrideReason?.trim() : null,
        checkedInById: ctx.user.id,
        deviceId: turnstile.deviceId,
      },
    });
    await tx.member.update({
      where: { id: member.id },
      data: { lastVisitedAt: new Date() },
    });
    if (latestSub && typeof latestSub.sessionsRemaining === "number" && latestSub.sessionsRemaining > 0) {
      await tx.membership.update({
        where: { id: latestSub.id },
        data: { sessionsRemaining: { decrement: 1 } },
      });
    }
  });

  if (decision.result === "OVERRIDE_ALLOWED") {
    await recordAuditLog({
      orgId: ctx.org.id,
      branchId: input.branchId,
      actorUserId: ctx.user.id,
      actorRole: ctx.role,
      action: "CHECKIN_OVERRIDE_EXPIRED_MEMBER",
      resourceType: "Member",
      resourceId: member.id,
      diff: { overrideReason: input.overrideReason },
      ip: ctx.clientIp,
    });
  }

  revalidatePath("/app/checkin");
  revalidatePath("/app");
  return {
    ok: true as const,
    matched: true as const,
    allowed: true as const,
    result: decision.result,
    reason: decision.reason,
    turnstileDevice: turnstile.deviceId,
    member: {
      id: member.id,
      fullName: member.fullName,
      memberCode: member.memberCode,
      status: member.status,
      expiryDate: member.expiryDate ? member.expiryDate.toISOString().slice(0, 10) : null,
    },
  };
}
