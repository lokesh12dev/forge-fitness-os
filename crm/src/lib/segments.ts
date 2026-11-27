/**
 * Pure audience segmenting & message variable interpolation for FORGE CRM Broadcasts & Automations.
 */

import { formatMoney } from "./money";
import { diffCalendarDays } from "./membership-math";

export type SegmentKey =
  | "EXPIRING"
  | "INACTIVE"
  | "BIRTHDAY"
  | "UNPAID"
  | "PT_CLIENTS"
  | "NEW_JOINERS";

export interface SegmentCandidate {
  id: string;
  fullName: string;
  status: string;
  expiryDate: Date | null;
  lastVisitedAt: Date | null;
  dob: Date | null;
  createdAt: Date;
  balanceDuePaise: number;
  planName: string;
  billingModel: string | null;
  tags: string[];
  whatsappOptIn: boolean;
}

export function matchesSegment(
  member: SegmentCandidate,
  segment: SegmentKey,
  now: Date = new Date(),
  timeZone: string = "Asia/Kolkata"
): boolean {
  switch (segment) {
    case "EXPIRING": {
      if (member.status === "EXPIRING") return true;
      if (!member.expiryDate) return false;
      const daysLeft = diffCalendarDays(member.expiryDate, now, timeZone);
      return daysLeft >= 0 && daysLeft <= 7;
    }
    case "INACTIVE": {
      if (member.status === "FROZEN") return false;
      if (!member.lastVisitedAt) return true;
      return diffCalendarDays(now, member.lastVisitedAt, timeZone) >= 14;
    }
    case "BIRTHDAY": {
      if (!member.dob) return false;
      return (
        member.dob.getUTCMonth() === now.getUTCMonth() &&
        member.dob.getUTCDate() === now.getUTCDate()
      );
    }
    case "UNPAID": {
      return member.balanceDuePaise > 0 || member.status === "OVERDUE";
    }
    case "PT_CLIENTS": {
      return (
        member.billingModel === "PT_PACK" ||
        member.tags.some((t) => /pt/i.test(t))
      );
    }
    case "NEW_JOINERS": {
      return diffCalendarDays(now, member.createdAt, timeZone) <= 14;
    }
  }
}

export function filterCampaignRecipients(
  members: SegmentCandidate[],
  segment: SegmentKey,
  now: Date = new Date()
): {
  matched: SegmentCandidate[];
  eligibleOptIn: SegmentCandidate[];
  optedOutCount: number;
} {
  const matched = members.filter((m) => matchesSegment(m, segment, now));
  const eligibleOptIn = matched.filter((m) => m.whatsappOptIn);
  return {
    matched,
    eligibleOptIn,
    optedOutCount: matched.length - eligibleOptIn.length,
  };
}

export function interpolateTemplateVars(
  template: string,
  vars: {
    name: string;
    plan?: string;
    expiry?: string;
    dueAmountPaise?: number;
    branch?: string;
  }
): string {
  const firstName = vars.name.trim().split(/\s+/)[0] || vars.name;
  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{full_name\}/g, vars.name)
    .replace(/\{plan\}/g, vars.plan || "Membership")
    .replace(/\{expiry\}/g, vars.expiry || "--")
    .replace(/\{due_amount\}/g, formatMoney(vars.dueAmountPaise ?? 0))
    .replace(/\{branch\}/g, vars.branch || "Ironworks Club");
}
