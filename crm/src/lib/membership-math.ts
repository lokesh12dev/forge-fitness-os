/**
 * Timezone-safe membership date math, freeze extensions, pro-rated upgrades,
 * and member status derivation for FORGE CRM.
 */

import { computeProratedCredit } from "./money";

const DAY_MS = 86_400_000;

/**
 * Formats a UTC date in the branch's IANA timezone (default Asia/Kolkata).
 */
export function formatDateInBranchTz(
  date: Date | string,
  timeZone: string = "Asia/Kolkata",
  includeTime: boolean = false
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      : {}),
  }).format(d);
}

/**
 * Extracts YYYY-MM-DD calendar date in the specified branch timezone.
 */
export function toBranchDateKey(date: Date, timeZone: string = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function branchDateToUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addCalendarDays(date: Date, days: number, timeZone: string = "Asia/Kolkata"): Date {
  const baseKey = toBranchDateKey(date, timeZone);
  const baseUtc = branchDateToUtcMidnight(baseKey);
  return new Date(baseUtc.getTime() + Math.trunc(days) * DAY_MS);
}

export function diffCalendarDays(later: Date, earlier: Date, timeZone: string = "Asia/Kolkata"): number {
  const laterUtc = branchDateToUtcMidnight(toBranchDateKey(later, timeZone));
  const earlierUtc = branchDateToUtcMidnight(toBranchDateKey(earlier, timeZone));
  return Math.round((laterUtc.getTime() - earlierUtc.getTime()) / DAY_MS);
}

export function computeMembershipRenewal(
  currentExpiry: Date | null,
  referenceNow: Date,
  durationDays: number,
  timeZone: string = "Asia/Kolkata"
): { startDate: Date; newEndDate: Date } {
  const cleanDays = Math.max(1, Math.trunc(durationDays));
  const todayUtc = branchDateToUtcMidnight(toBranchDateKey(referenceNow, timeZone));

  let anchorUtc = todayUtc;
  if (currentExpiry) {
    const expiryUtc = branchDateToUtcMidnight(toBranchDateKey(currentExpiry, timeZone));
    if (expiryUtc.getTime() > todayUtc.getTime()) {
      anchorUtc = expiryUtc;
    }
  }

  return {
    startDate: anchorUtc,
    newEndDate: new Date(anchorUtc.getTime() + cleanDays * DAY_MS),
  };
}

export function computeFreezeApplication(input: {
  currentEndDate: Date;
  freezeStartDate: Date;
  freezeDays: number;
  maxFreezeDays: number;
  freezeDaysUsed: number;
  feePaise: number;
  timeZone?: string;
}):
  | {
      ok: true;
      freezeEndDate: Date;
      newMembershipEndDate: Date;
      newFreezeDaysUsed: number;
      feePaise: number;
    }
  | { ok: false; error: string } {
  const tz = input.timeZone ?? "Asia/Kolkata";
  const days = Math.trunc(input.freezeDays);
  if (days < 1) {
    return { ok: false, error: "Freeze duration must be at least 1 day." };
  }
  const remainingAllowance = Math.max(0, input.maxFreezeDays - input.freezeDaysUsed);
  if (days > remainingAllowance) {
    return {
      ok: false,
      error: `Requested ${days} freeze days exceeds remaining plan allowance (${remainingAllowance} days).`,
    };
  }

  const freezeEndDate = addCalendarDays(input.freezeStartDate, days, tz);
  const newMembershipEndDate = addCalendarDays(input.currentEndDate, days, tz);

  return {
    ok: true,
    freezeEndDate,
    newMembershipEndDate,
    newFreezeDaysUsed: input.freezeDaysUsed + days,
    feePaise: Math.max(0, Math.trunc(input.feePaise)),
  };
}

export function computeUpgradeProration(input: {
  currentPaidPaise: number;
  currentStartDate: Date;
  currentEndDate: Date;
  upgradeOnDate: Date;
  newPlanPricePaise: number;
  timeZone?: string;
}): {
  totalCycleDays: number;
  unusedDays: number;
  creditPaise: number;
  netUpgradePaise: number;
} {
  const tz = input.timeZone ?? "Asia/Kolkata";
  const totalCycleDays = Math.max(
    1,
    diffCalendarDays(input.currentEndDate, input.currentStartDate, tz)
  );
  const unusedDays = Math.max(
    0,
    Math.min(totalCycleDays, diffCalendarDays(input.currentEndDate, input.upgradeOnDate, tz))
  );
  const creditPaise = computeProratedCredit(input.currentPaidPaise, totalCycleDays, unusedDays);
  const netUpgradePaise = Math.max(0, Math.trunc(input.newPlanPricePaise) - creditPaise);

  return {
    totalCycleDays,
    unusedDays,
    creditPaise,
    netUpgradePaise,
  };
}

export type DerivedMemberStatus = "ACTIVE" | "EXPIRING" | "OVERDUE" | "FROZEN" | "EXPIRED";

export function deriveMemberStatus(input: {
  expiryDate: Date | null;
  isFrozen: boolean;
  hasOverdueDues: boolean;
  referenceNow?: Date;
  expiringWindowDays?: number;
  timeZone?: string;
}): DerivedMemberStatus {
  if (input.isFrozen) return "FROZEN";
  if (input.hasOverdueDues) return "OVERDUE";
  if (!input.expiryDate) return "EXPIRED";

  const tz = input.timeZone ?? "Asia/Kolkata";
  const now = input.referenceNow ?? new Date();
  const daysLeft = diffCalendarDays(input.expiryDate, now, tz);
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= (input.expiringWindowDays ?? 7)) return "EXPIRING";
  return "ACTIVE";
}
