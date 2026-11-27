"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { AuthorizationError, canAccessBranch, canAccessFinance } from "@/lib/rbac";
import { dispatchMemberMessage } from "@/lib/adapters/messaging";
import { formatMoney } from "@/lib/money";
import {
  computePosSaleTotals,
  evaluateClassBookingCapacity,
  isLateCancellation,
} from "@/lib/ops-math";
import {
  resolveGroundedOrgAiQuery,
  validateMigrationCsvRows,
} from "@/lib/reports-ai";

/* ─────────────────────────── CLASSES, WAITLIST & NPS ─────────────────────────── */

export async function createClassSessionAction(input: {
  branchId: string;
  classTypeId: string;
  trainerId: string;
  startsAt: string;
  studioRoom: string;
  capacity: number;
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, input.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const ct = await prisma.classType.findFirst({
    where: { id: input.classTypeId, orgId: ctx.org.id },
  });
  if (!ct) return { ok: false as const, error: "Class type not found." };

  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false as const, error: "Invalid start timestamp." };
  }
  const end = new Date(start.getTime() + ct.defaultDurationMin * 60_000);

  const session = await prisma.classSession.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      classTypeId: ct.id,
      trainerId: input.trainerId,
      title: ct.name,
      studioRoom: input.studioRoom.trim() || "Main Studio",
      startsAt: start,
      endsAt: end,
      capacity: Math.max(1, Math.trunc(input.capacity)),
      cutoffMinutes: ct.cutoffMinutes,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "CLASS_SESSION_CREATED",
    resourceType: "ClassSession",
    resourceId: session.id,
    diff: { title: ct.name, capacity: session.capacity },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/classes");
  return { ok: true as const, sessionId: session.id };
}

export async function bookMemberInClassAction(input: {
  sessionId: string;
  memberId: string;
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  const [session, member] = await Promise.all([
    prisma.classSession.findFirst({
      where: { id: input.sessionId, orgId: ctx.org.id },
      include: { bookings: true },
    }),
    prisma.member.findFirst({
      where: { id: input.memberId, orgId: ctx.org.id },
    }),
  ]);
  if (!session || !member) return { ok: false as const, error: "Session or member not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, session.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const existing = session.bookings.find((b) => b.memberId === member.id && b.status !== "CANCELLED");
  if (existing) {
    return { ok: false as const, error: `${member.fullName} is already ${existing.status.toLowerCase()}.` };
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
      cancelledAt: null,
    },
    create: {
      orgId: ctx.org.id,
      branchId: session.branchId,
      sessionId: session.id,
      memberId: member.id,
      status: evalCap.bookingStatus,
      waitlistPos: evalCap.waitlistPos,
    },
  });

  revalidatePath("/app/classes");
  return { ok: true as const, bookingStatus: evalCap.bookingStatus, waitlistPos: evalCap.waitlistPos };
}

export async function updateClassBookingStatusAction(input: {
  bookingId: string;
  nextStatus: "CHECKED_IN" | "NO_SHOW" | "CANCELLED";
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  const booking = await prisma.classBooking.findFirst({
    where: { id: input.bookingId, orgId: ctx.org.id },
    include: { session: true },
  });
  if (!booking) return { ok: false as const, error: "Booking not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, booking.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const wasBooked = booking.status === "BOOKED";
  const now = new Date();
  const lateCancel =
    input.nextStatus === "CANCELLED" &&
    isLateCancellation({
      sessionStartsAt: booking.session.startsAt,
      cancelledAt: now,
      cutoffMinutes: booking.session.cutoffMinutes,
    });

  const promotedMemberName = await prisma.$transaction(async (tx) => {
    await tx.classBooking.update({
      where: { id: booking.id },
      data: {
        status: input.nextStatus,
        checkedInAt: input.nextStatus === "CHECKED_IN" ? now : booking.checkedInAt,
        cancelledAt: input.nextStatus === "CANCELLED" ? now : booking.cancelledAt,
        waitlistPos: null,
      },
    });

    if (input.nextStatus === "CANCELLED" && wasBooked) {
      const nextWait = await tx.classBooking.findFirst({
        where: { sessionId: booking.sessionId, status: "WAITLISTED" },
        orderBy: { waitlistPos: "asc" },
        include: { member: { select: { fullName: true } } },
      });
      if (nextWait) {
        await tx.classBooking.update({
          where: { id: nextWait.id },
          data: { status: "BOOKED", waitlistPos: null },
        });
        return nextWait.member.fullName;
      }
    }
    return null as string | null;
  });

  revalidatePath("/app/classes");
  return { ok: true as const, promotedMemberName, lateCancel };
}

export async function submitNpsFeedbackAction(input: {
  branchId: string;
  memberId: string;
  npsScore: number;
  category: string;
  comment: string;
}) {
  const ctx = await requireAuthContext({ permission: "classes:manage" });
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, input.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.memberFeedbackNps.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      memberId: input.memberId,
      npsScore: Math.min(10, Math.max(0, Math.trunc(input.npsScore))),
      category: input.category,
      comment: input.comment.trim() || "Member review logged",
    },
  });

  revalidatePath("/app/classes");
  return { ok: true as const };
}

/* ─────────────────────────── TRAINERS & PT SESSIONS ─────────────────────────── */

export async function createPtSessionAction(input: {
  branchId: string;
  trainerId: string;
  memberId: string;
  scheduledAt: string;
  sessionFeePaise: number;
  notes?: string;
}) {
  const ctx = await requireAuthContext({ permission: "trainers:read" });
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, input.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const profile = await prisma.trainerProfile.findFirst({
    where: { orgId: ctx.org.id, userId: input.trainerId },
  });
  const bps = profile?.commissionBps ?? 3500;
  const fee = Math.max(50000, Math.trunc(input.sessionFeePaise));
  const commission = Math.round((fee * bps) / 10_000);

  await prisma.ptSession.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      trainerId: input.trainerId,
      memberId: input.memberId,
      scheduledAt: new Date(input.scheduledAt || Date.now() + 86_400_000),
      sessionFeePaise: fee,
      commissionPaise: commission,
      status: "SCHEDULED",
      notes: input.notes?.trim() || "1-on-1 PT Session",
    },
  });

  revalidatePath("/app/trainers");
  return { ok: true as const };
}

export async function updatePtSessionStatusAction(input: {
  ptSessionId: string;
  status: "COMPLETED" | "NO_SHOW" | "CANCELLED";
}) {
  const ctx = await requireAuthContext({ permission: "trainers:read" });
  const sess = await prisma.ptSession.findFirst({
    where: { id: input.ptSessionId, orgId: ctx.org.id },
  });
  if (!sess) return { ok: false as const, error: "PT session not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, sess.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }
  if (ctx.role === "TRAINER" && sess.trainerId !== ctx.user.id) {
    throw new AuthorizationError("Trainers may only update their own PT sessions.");
  }

  await prisma.ptSession.update({
    where: { id: sess.id },
    data: { status: input.status },
  });

  revalidatePath("/app/trainers");
  return { ok: true as const };
}

/* ─────────────────────────── TRAINING & INDIAN DIET PLANS ─────────────────────────── */

export async function createWorkoutDietTemplateAction(input: {
  name: string;
  goal: string;
  dietType: "VEG" | "EGG" | "NON_VEG" | "JAIN" | "VEGAN";
  caloriesTarget: number;
  proteinGrams: number;
  workoutBlockTitle: string;
  workoutExercisesCsv: string;
  mealSummary: string;
}) {
  const ctx = await requireAuthContext({ permission: "training:write" });
  if (input.name.trim().length < 3) {
    return { ok: false as const, error: "Template name required." };
  }

  const exercises = input.workoutExercisesCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const tpl = await prisma.workoutDietTemplate.create({
    data: {
      orgId: ctx.org.id,
      name: input.name.trim(),
      goal: input.goal.trim() || "General Strength & Conditioning",
      dietType: input.dietType,
      caloriesTarget: Math.max(1200, Math.trunc(input.caloriesTarget)),
      proteinGrams: Math.max(50, Math.trunc(input.proteinGrams)),
      workoutsJson: [
        {
          day: input.workoutBlockTitle.trim() || "Day 1 - Compound Split",
          exercises: exercises.length > 0 ? exercises : ["Goblet Squat 4x10", "Barbell Row 4x8"],
        },
      ],
      mealsJson: [
        {
          slot: `${input.dietType} Daily Nutrition Plan`,
          items: input.mealSummary.trim() || "Balanced high-protein whole-food Indian meals",
          macros: `${input.proteinGrams}g Protein / ${input.caloriesTarget} kcal`,
        },
      ],
      createdById: ctx.user.id,
    },
  });

  revalidatePath("/app/training-plans");
  return { ok: true as const, templateId: tpl.id };
}

export async function assignTrainingTemplateAction(input: {
  memberId: string;
  templateId: string;
}) {
  const ctx = await requireAuthContext({ permission: "training:write" });
  const [member, tpl] = await Promise.all([
    prisma.member.findFirst({ where: { id: input.memberId, orgId: ctx.org.id } }),
    prisma.workoutDietTemplate.findFirst({ where: { id: input.templateId, orgId: ctx.org.id } }),
  ]);
  if (!member || !tpl) return { ok: false as const, error: "Member or template not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, member.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const syncToken = `FRGSYNC-${member.memberCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const assignment = await prisma.memberPlanAssignment.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      memberId: member.id,
      templateId: tpl.id,
      trainerId: ctx.user.id,
      syncToken,
      syncedAt: new Date(),
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "TRAINING_PLAN_ASSIGNED",
    resourceType: "MemberPlanAssignment",
    resourceId: assignment.id,
    diff: { memberCode: member.memberCode, templateName: tpl.name, syncToken },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/training-plans");
  return { ok: true as const, syncToken };
}

/* ─────────────────────────── INVENTORY, POS, LOCKERS & EQUIPMENT ─────────────────────────── */

export async function posCheckoutAction(input: {
  branchId: string;
  memberId?: string;
  itemId: string;
  quantity: number;
  method: "UPI" | "CARD" | "CASH";
}) {
  const ctx = await requireAuthContext({ permission: "inventory:pos" });
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, input.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.itemId, orgId: ctx.org.id, branchId: input.branchId },
    include: { branch: { select: { code: true } } },
  });
  if (!item) return { ok: false as const, error: "Inventory item not found." };

  const qty = Math.max(1, Math.trunc(input.quantity));
  if (item.stockQty < qty) {
    return { ok: false as const, error: `Only ${item.stockQty} unit(s) left in stock.` };
  }

  const totals = computePosSaleTotals([
    {
      itemId: item.id,
      name: item.name,
      unitPricePaise: item.unitPricePaise,
      quantity: qty,
      gstRateBps: item.gstRateBps,
    },
  ]);

  const invNo = `POS-${item.branch.code}-${String(Date.now()).slice(-5)}`;

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { stockQty: { decrement: qty } },
    });

    await tx.posSale.create({
      data: {
        orgId: ctx.org.id,
        branchId: input.branchId,
        memberId: input.memberId || null,
        invoiceNumber: invNo,
        itemsJson: [{ sku: item.sku, name: item.name, qty, unitPricePaise: item.unitPricePaise }],
        subtotalPaise: totals.subtotalPaise,
        gstPaise: totals.gstPaise,
        totalPaise: totals.totalPaise,
        method: input.method,
        soldById: ctx.user.id,
      },
    });
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "POS_SALE_COMPLETED",
    resourceType: "PosSale",
    resourceId: invNo,
    diff: { sku: item.sku, qty, totalPaise: totals.totalPaise, method: input.method },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/inventory");
  return { ok: true as const, invoiceNumber: invNo, totalPaise: totals.totalPaise };
}

export async function receivePurchaseOrderAction(poId: string) {
  const ctx = await requireAuthContext({ permission: "inventory:pos" });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, orgId: ctx.org.id },
  });
  if (!po) return { ok: false as const, error: "Purchase Order not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, po.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }
  if (po.status === "RECEIVED") {
    return { ok: false as const, error: "PO already received into stock." };
  }

  const lines = Array.isArray(po.itemsJson)
    ? (po.itemsJson as Array<{ sku: string; qty: number }>)
    : [];

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await tx.inventoryItem.updateMany({
        where: { orgId: ctx.org.id, branchId: po.branchId, sku: line.sku },
        data: { stockQty: { increment: Math.max(1, Math.trunc(line.qty)) } },
      });
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  });

  revalidatePath("/app/inventory");
  return { ok: true as const };
}

export async function assignOrReleaseLockerAction(input: {
  lockerId: string;
  action: "ASSIGN" | "RELEASE" | "MAINTENANCE";
  memberId?: string;
}) {
  const ctx = await requireAuthContext({ permission: "inventory:read" });
  const locker = await prisma.lockerUnit.findFirst({
    where: { id: input.lockerId, orgId: ctx.org.id },
  });
  if (!locker) return { ok: false as const, error: "Locker not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, locker.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.lockerUnit.update({
    where: { id: locker.id },
    data:
      input.action === "ASSIGN"
        ? {
            status: "ASSIGNED",
            assignedMemberId: input.memberId || null,
            expiresAt: new Date(Date.now() + 30 * 86_400_000),
          }
        : input.action === "MAINTENANCE"
        ? { status: "MAINTENANCE", assignedMemberId: null, expiresAt: null }
        : { status: "AVAILABLE", assignedMemberId: null, expiresAt: null },
  });

  revalidatePath("/app/inventory");
  return { ok: true as const };
}

export async function logEquipmentMaintenanceAction(input: {
  assetId: string;
  status: "OPERATIONAL" | "NEEDS_SERVICE" | "OUT_OF_ORDER";
  notes: string;
}) {
  const ctx = await requireAuthContext({ permission: "equipment:manage" });
  const asset = await prisma.equipmentAsset.findFirst({
    where: { id: input.assetId, orgId: ctx.org.id },
  });
  if (!asset) return { ok: false as const, error: "Equipment asset not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, asset.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  const now = new Date();
  await prisma.equipmentAsset.update({
    where: { id: asset.id },
    data: {
      status: input.status,
      maintenanceNotes: input.notes.trim() || asset.maintenanceNotes,
      ...(input.status === "OPERATIONAL"
        ? {
            lastServicedAt: now,
            nextServiceDue: new Date(now.getTime() + 90 * 86_400_000),
          }
        : {}),
    },
  });

  revalidatePath("/app/inventory");
  return { ok: true as const };
}

/* ─────────────────────────── STAFF SHIFTS & HANDOVER ─────────────────────────── */

export async function clockStaffShiftAction(input: {
  shiftId: string;
  action: "CLOCK_IN" | "CLOCK_OUT";
  handoverNote?: string;
}) {
  const ctx = await requireAuthContext({ permission: "staff:shifts" });
  const shift = await prisma.staffShift.findFirst({
    where: { id: input.shiftId, orgId: ctx.org.id },
  });
  if (!shift) return { ok: false as const, error: "Shift not found." };
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, shift.branchId)) {
    throw new AuthorizationError("Branch access denied.");
  }

  await prisma.staffShift.update({
    where: { id: shift.id },
    data: {
      status: input.action === "CLOCK_IN" ? "CLOCKED_IN" : "CLOCKED_OUT",
      clockedInAt: input.action === "CLOCK_IN" ? new Date() : shift.clockedInAt,
      clockedOutAt: input.action === "CLOCK_OUT" ? new Date() : shift.clockedOutAt,
      handoverNote: input.handoverNote?.trim() || shift.handoverNote,
    },
  });

  revalidatePath("/app/staff");
  return { ok: true as const };
}

/* ─────────────────────────── MEMBER PWA PORTAL ACTIONS ─────────────────────────── */

async function resolvePortalMember(ctx: Awaited<ReturnType<typeof requireAuthContext>>) {
  return prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [
        { email: ctx.user.email },
        ...(ctx.user.phone ? [{ phone: ctx.user.phone }] : []),
      ],
    },
  });
}

export async function portalToggleClassBookingAction(input: {
  sessionId: string;
  action: "BOOK" | "CANCEL";
}) {
  const ctx = await requireAuthContext({ permission: "portal:self" });
  const member = await resolvePortalMember(ctx);
  if (!member) return { ok: false as const, error: "Member profile not linked." };

  const session = await prisma.classSession.findFirst({
    where: { id: input.sessionId, orgId: ctx.org.id },
    include: { bookings: true },
  });
  if (!session) return { ok: false as const, error: "Class session not found." };

  if (input.action === "CANCEL") {
    const mine = session.bookings.find((b) => b.memberId === member.id && b.status !== "CANCELLED");
    if (!mine) return { ok: false as const, error: "No active booking found." };
    await prisma.$transaction(async (tx) => {
      await tx.classBooking.update({
        where: { id: mine.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), waitlistPos: null },
      });
      if (mine.status === "BOOKED") {
        const nextWait = await tx.classBooking.findFirst({
          where: { sessionId: session.id, status: "WAITLISTED" },
          orderBy: { waitlistPos: "asc" },
        });
        if (nextWait) {
          await tx.classBooking.update({
            where: { id: nextWait.id },
            data: { status: "BOOKED", waitlistPos: null },
          });
        }
      }
    });
    revalidatePath("/portal");
    revalidatePath("/app/classes");
    return { ok: true as const, message: "Booking cancelled." };
  }

  const bookedCount = session.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length;
  const waitlistedCount = session.bookings.filter((b) => b.status === "WAITLISTED").length;
  const cap = evaluateClassBookingCapacity({
    capacity: session.capacity,
    bookedCount,
    waitlistedCount,
  });

  await prisma.classBooking.upsert({
    where: { sessionId_memberId: { sessionId: session.id, memberId: member.id } },
    update: { status: cap.bookingStatus, waitlistPos: cap.waitlistPos, cancelledAt: null },
    create: {
      orgId: ctx.org.id,
      branchId: session.branchId,
      sessionId: session.id,
      memberId: member.id,
      status: cap.bookingStatus,
      waitlistPos: cap.waitlistPos,
    },
  });

  revalidatePath("/portal");
  revalidatePath("/app/classes");
  return {
    ok: true as const,
    message:
      cap.bookingStatus === "BOOKED"
        ? `Confirmed spot in ${session.title}!`
        : `Class full — added to Waitlist #${cap.waitlistPos}.`,
  };
}

export async function portalRequestFreezeAction(reason: string) {
  const ctx = await requireAuthContext({ permission: "portal:self" });
  const member = await resolvePortalMember(ctx);
  if (!member) return { ok: false as const, error: "Member profile not found." };

  await prisma.staffTask.create({
    data: {
      orgId: ctx.org.id,
      branchId: member.branchId,
      title: `Member Portal Freeze Request: ${member.fullName} (${reason.trim() || "Travel"})`,
      priority: "MEDIUM",
      dueDate: new Date(Date.now() + 86_400_000),
      relatedMemberId: member.id,
      status: "OPEN",
    },
  });

  revalidatePath("/portal");
  revalidatePath("/app");
  return { ok: true as const };
}

/* ─────────────────────────── PHASE 4: REPORTS, AI ASSISTANT, IMPORTER, SETTINGS ─────────────────────────── */

export async function createScheduledReportAction(input: {
  name: string;
  reportType: string;
  cadence: "DAILY_9PM" | "WEEKLY_MON" | "MONTHLY_1ST";
  recipient: string;
}) {
  const ctx = await requireAuthContext({ permission: "reports:export" });
  const rep = await prisma.scheduledReport.create({
    data: {
      orgId: ctx.org.id,
      branchId: ctx.activeBranchId ?? null,
      name: input.name.trim() || "Scheduled Owner Digest",
      reportType: input.reportType,
      cadence: input.cadence,
      recipientPhoneOrEmail: input.recipient.trim(),
    },
  });

  revalidatePath("/app/reports");
  return { ok: true as const, reportId: rep.id };
}

export async function askOrgAiAssistantAction(prompt: string) {
  const ctx = await requireAuthContext({ permission: "ai:use" });
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 3) {
    return { ok: false as const, error: "Ask a concrete question about your gym." };
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const showFinance = canAccessFinance(ctx.role);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const in7d = new Date(now.getTime() + 7 * 86_400_000);

  const memberWhere = {
    orgId: ctx.org.id,
    branchId: { in: branchIds },
    deletedAt: null,
    ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
  };

  const [
    activeMembers,
    expiring7d,
    overdueCount,
    overdueAgg,
    todayRevAgg,
    openLeadsCount,
    lowStockCount,
    topAbsentMember,
  ] = await Promise.all([
    prisma.member.count({ where: { ...memberWhere, status: "ACTIVE" } }),
    prisma.member.count({
      where: { ...memberWhere, status: { in: ["EXPIRING", "ACTIVE"] }, expiryDate: { gte: startToday, lte: in7d } },
    }),
    prisma.member.count({ where: { ...memberWhere, status: "OVERDUE" } }),
    showFinance
      ? prisma.invoice.aggregate({
          where: { orgId: ctx.org.id, branchId: { in: branchIds }, balanceDuePaise: { gt: 0 } },
          _sum: { balanceDuePaise: true },
        })
      : Promise.resolve({ _sum: { balanceDuePaise: 0 } }),
    showFinance
      ? prisma.payment.aggregate({
          where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "CAPTURED", paidAt: { gte: startToday } },
          _sum: { amountPaise: true },
        })
      : Promise.resolve({ _sum: { amountPaise: 0 } }),
    prisma.lead.count({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, stage: { notIn: ["WON", "LOST"] } },
    }),
    prisma.inventoryItem.count({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, stockQty: { lte: 8 } },
    }),
    prisma.member.findFirst({
      where: { ...memberWhere, status: { in: ["EXPIRING", "OVERDUE", "ACTIVE"] } },
      orderBy: { lastVisitedAt: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const branchName =
    ctx.visibleBranches.find((b) => b.id === ctx.activeBranchId)?.name ?? "Scoped Branches";

  const result = resolveGroundedOrgAiQuery(cleanPrompt, {
    orgName: ctx.org.name,
    branchName,
    role: ctx.role,
    canAccessFinance: showFinance,
    currency: ctx.org.currency,
    activeMembers,
    expiring7d,
    overdueCount,
    overdueTotalPaise: overdueAgg._sum.balanceDuePaise ?? 0,
    todayRevenuePaise: todayRevAgg._sum.amountPaise ?? 0,
    openLeadsCount,
    lowStockItemsCount: lowStockCount,
    topAbsentMemberName: topAbsentMember?.fullName ?? null,
    topAbsentMemberId: topAbsentMember?.id ?? null,
  });

  const log = await prisma.aiAssistantLog.create({
    data: {
      orgId: ctx.org.id,
      userId: ctx.user.id,
      prompt: cleanPrompt,
      response: result.answer,
      citationsJson: result.citations,
      draftActionJson: result.suggestedAction ?? undefined,
      approvalStatus: "SUGGESTED",
      tokensUsed: 185,
    },
  });

  revalidatePath("/app/ai");
  return {
    ok: true as const,
    logId: log.id,
    answer: result.answer,
    citations: result.citations,
    suggestedAction: result.suggestedAction,
  };
}

export async function approveAiDraftAction(logId: string) {
  const ctx = await requireAuthContext({ permission: "ai:use" });
  const log = await prisma.aiAssistantLog.findFirst({
    where: { id: logId, orgId: ctx.org.id },
  });
  if (!log || !log.draftActionJson) {
    return { ok: false as const, error: "No pending draft action found." };
  }
  if (log.approvalStatus === "APPROVED") {
    return { ok: false as const, error: "Draft already approved & executed." };
  }

  const draft = log.draftActionJson as {
    type: "CREATE_TASK" | "DRAFT_WHATSAPP";
    title: string;
    targetMemberId?: string;
    payloadText: string;
  };
  const fallbackBranchId = ctx.activeBranchId ?? ctx.visibleBranches[0]?.id ?? "";

  if (draft.type === "DRAFT_WHATSAPP" && draft.targetMemberId) {
    const member = await prisma.member.findFirst({
      where: { id: draft.targetMemberId, orgId: ctx.org.id },
    });
    if (member) {
      await dispatchMemberMessage({
        orgId: ctx.org.id,
        branchId: member.branchId,
        memberId: member.id,
        channel: "WHATSAPP",
        recipient: member.phone,
        templateCode: "AI_APPROVED_OUTREACH",
        body: draft.payloadText,
      });
    }
  } else if (fallbackBranchId) {
    await prisma.staffTask.create({
      data: {
        orgId: ctx.org.id,
        branchId: fallbackBranchId,
        title: draft.title,
        priority: "HIGH",
        dueDate: new Date(Date.now() + 86_400_000),
        assignedToId: ctx.user.id,
        status: "OPEN",
      },
    });
  }

  await prisma.aiAssistantLog.update({
    where: { id: log.id },
    data: { approvalStatus: "APPROVED" },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: fallbackBranchId || null,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "AI_DRAFT_APPROVED_EXECUTED",
    resourceType: "AiAssistantLog",
    resourceId: log.id,
    diff: { draftType: draft.type, title: draft.title },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/ai");
  revalidatePath("/app");
  return { ok: true as const };
}

export async function runMigrationImportAction(input: {
  branchId: string;
  sourcePlatform: "CSV" | "GYMDESK" | "MINDBODY" | "HEVY";
  mode: "DRY_RUN" | "COMMITTED";
  csvText: string;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const parsed = validateMigrationCsvRows(input.csvText);

  if (input.mode === "COMMITTED") {
    const validRows = parsed.rows.filter((r) => r.valid);
    let seqBase = await prisma.member.count({ where: { orgId: ctx.org.id } });
    for (const r of validRows) {
      seqBase++;
      await prisma.member.create({
        data: {
          orgId: ctx.org.id,
          branchId: input.branchId,
          memberCode: `FM-${1001 + seqBase}`,
          qrToken: `FORGEQR-${ctx.org.slug.slice(0, 3).toUpperCase()}-${1001 + seqBase}`,
          fullName: r.fullName,
          phone: r.phone,
          email: r.email || null,
          stateCode: ctx.org.legalStateCode,
          status: r.status === "OVERDUE" ? "OVERDUE" : "ACTIVE",
          expiryDate: new Date(Date.now() + 30 * 86_400_000),
          referralCode: `IMP${1000 + seqBase}`,
          tags: [`import:${input.sourcePlatform.toLowerCase()}`],
        },
      });
    }
  }

  const job = await prisma.migrationImportJob.create({
    data: {
      orgId: ctx.org.id,
      branchId: input.branchId,
      sourcePlatform: input.sourcePlatform,
      entityType: "MEMBERS",
      mode: input.mode,
      totalRows: parsed.rows.length,
      validRows: parsed.validCount,
      errorRows: parsed.errorCount,
      summaryJson: {
        sampleErrors: parsed.rows
          .filter((r) => !r.valid)
          .slice(0, 5)
          .map((r) => ({ rowNum: r.rowNum, fullName: r.fullName, error: r.error ?? "" })),
      },
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: input.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: input.mode === "DRY_RUN" ? "IMPORT_DRY_RUN" : "IMPORT_COMMITTED",
    resourceType: "MigrationImportJob",
    resourceId: job.id,
    diff: { source: input.sourcePlatform, valid: parsed.validCount, errors: parsed.errorCount },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/members");
  return {
    ok: true as const,
    validCount: parsed.validCount,
    errorCount: parsed.errorCount,
    rows: parsed.rows,
  };
}

export async function createApiKeyAction(input: { name: string; scopes: string[] }) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const rawKey = `frg_live_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const key = await prisma.apiKey.create({
    data: {
      orgId: ctx.org.id,
      name: input.name.trim() || "CRM Integration Key",
      keyPrefix: rawKey.slice(0, 14),
      keyHash,
      scopes: input.scopes.length > 0 ? input.scopes : ["members:read"],
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: "API_KEY_CREATED",
    resourceType: "ApiKey",
    resourceId: key.id,
    diff: { prefix: key.keyPrefix },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/settings");
  return { ok: true as const, rawKey, prefix: key.keyPrefix };
}

export async function revokeApiKeyAction(keyId: string) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  await prisma.apiKey.updateMany({
    where: { id: keyId, orgId: ctx.org.id },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/app/settings");
  return { ok: true as const };
}

export async function createWebhookSubscriptionAction(input: {
  targetUrl: string;
  event: string;
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const sub = await prisma.webhookSubscription.create({
    data: {
      orgId: ctx.org.id,
      targetUrl: input.targetUrl.trim(),
      events: [input.event],
      secretPreview: `whsec_••••${crypto.randomBytes(2).toString("hex")}`,
      isActive: true,
    },
  });
  revalidatePath("/app/settings");
  return { ok: true as const, id: sub.id };
}

export async function executeDpdpComplianceAction(input: {
  memberId: string;
  kind: "DPDP_EXPORT" | "DPDP_ERASURE";
}) {
  const ctx = await requireAuthContext({ permission: "settings:admin" });
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, orgId: ctx.org.id },
  });
  if (!member) return { ok: false as const, error: "Member not found." };

  if (input.kind === "DPDP_ERASURE") {
    await prisma.member.update({
      where: { id: member.id },
      data: {
        fullName: `ERASED-${member.memberCode}`,
        email: null,
        phone: "+91 0000000000",
        emergencyName: null,
        emergencyPhone: null,
        healthNotesEnc: null,
        deletedAt: new Date(),
      },
    });
  }

  const job = await prisma.dataExportDeletionJob.create({
    data: {
      orgId: ctx.org.id,
      memberId: member.id,
      kind: input.kind,
      status: input.kind === "DPDP_ERASURE" ? "ANONYMIZED" : "COMPLETED",
      requestedById: ctx.user.id,
    },
  });

  await recordAuditLog({
    orgId: ctx.org.id,
    branchId: member.branchId,
    actorUserId: ctx.user.id,
    actorRole: ctx.role,
    action: input.kind,
    resourceType: "Member",
    resourceId: member.id,
    diff: { memberCode: member.memberCode, jobId: job.id },
    ip: ctx.clientIp,
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/members");
  return {
    ok: true as const,
    status: job.status,
    exportPreview:
      input.kind === "DPDP_EXPORT"
        ? JSON.stringify({ memberCode: member.memberCode, fullName: member.fullName, status: member.status }, null, 2)
        : undefined,
  };
}

export async function sendDailyOwnerSummaryDigestAction() {
  const ctx = await requireAuthContext({ permission: "reports:export" });
  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const now = new Date();
  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);

  const [checkInsToday, revToday, anyMember] = await Promise.all([
    prisma.checkIn.count({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, visitedAt: { gte: startToday } },
    }),
    prisma.payment.aggregate({
      where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: "CAPTURED", paidAt: { gte: startToday } },
      _sum: { amountPaise: true },
    }),
    prisma.member.findFirst({ where: { orgId: ctx.org.id }, select: { id: true, branchId: true } }),
  ]);

  const summary = `FORGE CRM 9 PM Pulse (${ctx.org.name}): ${checkInsToday} floor check-ins today, ${formatMoney(revToday._sum.amountPaise ?? 0, { currency: ctx.org.currency })} captured collections.`;
  if (anyMember) {
    await dispatchMemberMessage({
      orgId: ctx.org.id,
      branchId: anyMember.branchId,
      memberId: anyMember.id,
      channel: "WHATSAPP",
      recipient: "+91 98450 10001",
      templateCode: "DAILY_9PM_DIGEST",
      body: summary,
      skipConsentCheck: true,
    });
  }

  revalidatePath("/app/reports");
  return { ok: true as const, summary };
}
