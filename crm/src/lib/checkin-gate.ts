/**
 * Attendance & Turnstile access decision engine for FORGE CRM.
 * Blocks expired or frozen memberships unless an explicit staff override reason is logged.
 */

import { diffCalendarDays, type DerivedMemberStatus } from "./membership-math";

export type CheckInDecision = {
  allowed: boolean;
  result: "ALLOWED" | "BLOCKED_EXPIRED" | "BLOCKED_FROZEN" | "OVERRIDE_ALLOWED";
  requiresOverride: boolean;
  reason: string;
  daysUntilExpiry: number | null;
};

export function evaluateCheckInAccess(input: {
  status: DerivedMemberStatus;
  expiryDate: Date | null;
  sessionsRemaining?: number | null;
  overrideReason?: string | null;
  referenceNow?: Date;
  timeZone?: string;
}): CheckInDecision {
  const tz = input.timeZone ?? "Asia/Kolkata";
  const now = input.referenceNow ?? new Date();
  const daysLeft = input.expiryDate ? diffCalendarDays(input.expiryDate, now, tz) : null;
  const cleanOverride = input.overrideReason?.trim() ?? "";
  const hasValidOverride = cleanOverride.length >= 4;

  if (input.status === "FROZEN") {
    if (hasValidOverride) {
      return {
        allowed: true,
        result: "OVERRIDE_ALLOWED",
        requiresOverride: false,
        reason: `Staff override admitted frozen member: ${cleanOverride}`,
        daysUntilExpiry: daysLeft,
      };
    }
    return {
      allowed: false,
      result: "BLOCKED_FROZEN",
      requiresOverride: true,
      reason: "Membership is currently FROZEN. Unfreeze or supply a manager override reason.",
      daysUntilExpiry: daysLeft,
    };
  }

  const noCredits =
    typeof input.sessionsRemaining === "number" && input.sessionsRemaining <= 0;

  if (input.status === "EXPIRED" || input.status === "OVERDUE" || noCredits) {
    const issueLabel = noCredits
      ? "Session pack exhausted (0 credits left)."
      : input.status === "OVERDUE"
      ? "Account has OVERDUE invoice balance."
      : `Membership expired ${daysLeft !== null ? `${Math.abs(daysLeft)}d ago` : ""}.`;

    if (hasValidOverride) {
      return {
        allowed: true,
        result: "OVERRIDE_ALLOWED",
        requiresOverride: false,
        reason: `Override permitted (${cleanOverride}) — ${issueLabel}`,
        daysUntilExpiry: daysLeft,
      };
    }
    return {
      allowed: false,
      result: "BLOCKED_EXPIRED",
      requiresOverride: true,
      reason: `${issueLabel} Collect payment/renew or enter staff override reason.`,
      daysUntilExpiry: daysLeft,
    };
  }

  return {
    allowed: true,
    result: "ALLOWED",
    requiresOverride: false,
    reason:
      input.status === "EXPIRING"
        ? `Access granted — plan expires in ${daysLeft ?? 0} day(s). Prompt renewal.`
        : "Access granted — membership active.",
    daysUntilExpiry: daysLeft,
  };
}
