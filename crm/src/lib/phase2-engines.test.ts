import { describe, expect, it } from "vitest";
import {
  calculateLeadScore,
  computeSourceRoiReport,
  findDuplicateContact,
  normalizeIndianPhone,
} from "./leads-math";
import {
  filterCampaignRecipients,
  interpolateTemplateVars,
  matchesSegment,
  type SegmentCandidate,
} from "./segments";
import { evaluateMemberChurnRisk } from "./churn";
import { buildRetentionCohorts, computeRenewalForecast } from "./cohorts";
import {
  deriveLoyaltyTier,
  evaluateQuietHours,
  getLoyaltyPointsForEvent,
} from "./loyalty";
import { canAccessFinance, hasPermission } from "./rbac";

describe("Phase 2 Growth Engines", () => {
  it("computes lead score bounds, normalizes Indian phone digits, detects duplicates, and aggregates Source ROI", () => {
    expect(normalizeIndianPhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianPhone("919900112233")).toBe("9900112233");

    const high = calculateLeadScore({
      source: "Referral",
      stage: "NEGOTIATION",
      hasEmail: true,
      hasTrialScheduled: true,
      ageDays: 1,
    });
    const lost = calculateLeadScore({
      source: "Referral",
      stage: "LOST",
      hasEmail: true,
      hasTrialScheduled: true,
      ageDays: 1,
    });
    expect(high).toBe(100);
    expect(lost).toBe(5);

    const dup = findDuplicateContact({
      phone: "919800112233",
      email: "Test@Mail.In",
      leads: [
        {
          id: "l1",
          fullName: "Existing Lead",
          phone: "+91 9800112233",
          email: "other@mail.in",
          stage: "CONTACTED",
        },
      ],
      members: [
        {
          id: "m1",
          fullName: "Existing Member",
          phone: "+91 9911223344",
          email: "test@mail.in",
          memberCode: "FM-1001",
        },
      ],
    });
    expect(dup.duplicateLead?.id).toBe("l1");
    expect(dup.existingMember?.memberCode).toBe("FM-1001");

    const roi = computeSourceRoiReport({
      leads: [
        { source: "Instagram", stage: "WON", convertedMemberId: "m1" },
        { source: "Instagram", stage: "NEW", convertedMemberId: null },
        { source: "Referral", stage: "WON", convertedMemberId: "m2" },
      ],
      spendBySourcePaise: { Instagram: 500000, Referral: 100000 },
      revenueByMemberPaise: { m1: 1500000, m2: 2000000 },
    });
    expect(roi[0]?.source).toBe("Referral");
    expect(roi[0]?.roiMultiplierPct).toBe(2000);
    const insta = roi.find((r) => r.source === "Instagram")!;
    expect(insta.conversionRatePct).toBe(50);
    expect(insta.costPerLeadPaise).toBe(250000);
  });

  it("segments audiences strictly, filters opted-out members, and interpolates template variables", () => {
    const now = new Date("2026-11-27T06:00:00.000Z");
    const base: SegmentCandidate = {
      id: "m1",
      fullName: "Aarav Sharma",
      status: "EXPIRING",
      expiryDate: new Date("2026-11-30T06:00:00.000Z"),
      lastVisitedAt: new Date("2026-11-01T06:00:00.000Z"),
      dob: new Date("1995-11-27T00:00:00.000Z"),
      createdAt: new Date("2026-11-20T06:00:00.000Z"),
      balanceDuePaise: 50000,
      planName: "Strength Quarterly",
      billingModel: "PT_PACK",
      tags: ["pt-vip"],
      whatsappOptIn: true,
    };

    expect(matchesSegment(base, "EXPIRING", now)).toBe(true);
    expect(matchesSegment(base, "INACTIVE", now)).toBe(true);
    expect(matchesSegment(base, "BIRTHDAY", now)).toBe(true);
    expect(matchesSegment(base, "UNPAID", now)).toBe(true);
    expect(matchesSegment(base, "PT_CLIENTS", now)).toBe(true);
    expect(matchesSegment(base, "NEW_JOINERS", now)).toBe(true);

    const optedOut: SegmentCandidate = {
      ...base,
      id: "m2",
      whatsappOptIn: false,
    };
    const filtered = filterCampaignRecipients([base, optedOut], "EXPIRING", now);
    expect(filtered.matched).toHaveLength(2);
    expect(filtered.eligibleOptIn).toHaveLength(1);
    expect(filtered.optedOutCount).toBe(1);

    const rendered = interpolateTemplateVars(
      "Hi {name}, your {plan} at {branch} expires {expiry}. Due: {due_amount}.",
      {
        name: "Aarav Sharma",
        plan: "Strength Quarterly",
        branch: "Indiranagar HQ",
        expiry: "30 Nov",
        dueAmountPaise: 150000,
      }
    );
    expect(rendered).toContain("Hi Aarav,");
    expect(rendered).toContain("Strength Quarterly");
    expect(rendered).toContain("Indiranagar HQ");
    expect(rendered).toContain("₹1,500");
  });

  it("scores churn explainably with non-empty reasons and tailored save plans", () => {
    const overdueMember = evaluateMemberChurnRisk(
      {
        visitsLast14d: 1,
        visitsPrev14d: 6,
        daysSinceLastVisit: 24,
        status: "OVERDUE",
        overdueBalancePaise: 240000,
        billingModel: "MONTHLY",
        tenureDays: 40,
      },
      "Rhea Kapoor"
    );
    expect(overdueMember.tier).toBe("HIGH");
    expect(overdueMember.score).toBeGreaterThanOrEqual(80);
    expect(overdueMember.factors.map((f) => f.code)).toContain("ABSENT_21D");
    expect(overdueMember.factors.map((f) => f.code)).toContain("FREQ_DROP");
    expect(overdueMember.savePlan.actionType).toBe("DUES_SPLIT");

    const healthy = evaluateMemberChurnRisk(
      {
        visitsLast14d: 7,
        visitsPrev14d: 6,
        daysSinceLastVisit: 1,
        status: "ACTIVE",
        overdueBalancePaise: 0,
        billingModel: "ANNUAL",
        tenureDays: 240,
      },
      "Vikram Mehta"
    );
    expect(healthy.tier).toBe("LOW");
    expect(healthy.score).toBe(0);
  });

  it("builds retention cohorts and computes integer-paise renewal forecasts", () => {
    const now = new Date("2026-11-27T00:00:00.000Z");
    const cohorts = buildRetentionCohorts(
      [
        {
          id: "1",
          createdAt: new Date("2026-09-10T00:00:00.000Z"),
          expiryDate: null,
          lastVisitedAt: null,
          status: "ACTIVE",
        },
        {
          id: "2",
          createdAt: new Date("2026-09-15T00:00:00.000Z"),
          expiryDate: null,
          lastVisitedAt: null,
          status: "EXPIRED",
        },
      ],
      now
    );
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0]?.size).toBe(2);
    expect(cohorts[0]?.retentionPcts[0]).toBe(100);
    expect(cohorts[0]?.retentionPcts.at(-1)).toBe(50);

    const forecast = computeRenewalForecast([
      { planPricePaise: 799900, churnScore: 70 },
      { planPricePaise: 299900, churnScore: 10 },
    ]);
    expect(forecast.expiringCount).toBe(2);
    expect(forecast.grossRenewablePaise).toBe(1099800);
    expect(forecast.atRiskPaise).toBe(799900);
    expect(forecast.projectedCollectedPaise).toBeLessThan(forecast.grossRenewablePaise);
  });

  it("derives loyalty tiers, point rewards, quiet hours, and strict Phase 2 RBAC boundaries", () => {
    expect(deriveLoyaltyTier(0)).toBe("IRON");
    expect(deriveLoyaltyTier(500)).toBe("BRONZE");
    expect(deriveLoyaltyTier(1500)).toBe("SILVER");
    expect(deriveLoyaltyTier(3000)).toBe("GOLD");
    expect(getLoyaltyPointsForEvent("REFERRAL_CONVERTED")).toBe(500);

    expect(evaluateQuietHours(22, 21, 8)).toBe(true);
    expect(evaluateQuietHours(7, 21, 8)).toBe(true);
    expect(evaluateQuietHours(10, 21, 8)).toBe(false);

    // TRAINER cannot see ad-spend ROI, broadcasts, automations, or finance
    expect(hasPermission("TRAINER", "leads:read")).toBe(true);
    expect(hasPermission("TRAINER", "retention:read")).toBe(true);
    expect(hasPermission("TRAINER", "leads:roi")).toBe(false);
    expect(hasPermission("TRAINER", "campaigns:broadcast")).toBe(false);
    expect(hasPermission("TRAINER", "automations:manage")).toBe(false);
    expect(canAccessFinance("TRAINER")).toBe(false);

    // ACCOUNTANT sees ROI read-only but cannot edit leads/automations
    expect(hasPermission("ACCOUNTANT", "leads:roi")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "leads:write")).toBe(false);
    expect(hasPermission("ACCOUNTANT", "automations:manage")).toBe(false);
  });
});
