import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  allocateProportionally,
  applyBpsDiscount,
  computeProratedCredit,
  formatMoney,
} from "./money";
import { aggregateGstInvoice, calculateGstLineItem } from "./gst";
import {
  computeFreezeApplication,
  computeMembershipRenewal,
  computeUpgradeProration,
  deriveMemberStatus,
} from "./membership-math";
import {
  applyCreditNoteRefund,
  applyPaymentToInvoice,
  classifyDuesAging,
  reconcileCashDrawer,
} from "./dues-ledger";
import {
  AuthorizationError,
  assertAuthorized,
  canAccessBranch,
  canAccessFinance,
} from "./rbac";
import { evaluateCheckInAccess } from "./checkin-gate";
import { decryptSensitiveField, encryptSensitiveField, maskKycLast4 } from "./encryption";

describe("FORGE CRM — Integer Paise Money Engine & Property Tests", () => {
  it("formats INR paise strictly without floating point drift", () => {
    expect(formatMoney(199900)).toBe("₹1,999");
    expect(formatMoney(199950)).toBe("₹1,999.50");
    expect(formatMoney(199900, { showDecimals: true })).toBe("₹1,999.00");
    expect(formatMoney(-45025)).toBe("-₹450.25");
  });

  it("property: allocateProportionally preserves exact integer sum for any total & weights", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 12 }),
        (totalPaise, weights) => {
          const split = allocateProportionally(totalPaise, weights);
          const sum = split.reduce((acc, x) => acc + x, 0);
          expect(sum).toBe(totalPaise);
          for (const part of split) {
            expect(Number.isInteger(part)).toBe(true);
            expect(part).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it("property: applyBpsDiscount never exceeds amountPaise or drops below zero", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 12_000 }),
        (amountPaise, bps) => {
          const disc = applyBpsDiscount(amountPaise, bps);
          expect(Number.isInteger(disc)).toBe(true);
          expect(disc).toBeGreaterThanOrEqual(0);
          expect(disc).toBeLessThanOrEqual(amountPaise);
        }
      ),
      { numRuns: 150 }
    );
  });

  it("computes pro-rated integer credits safely", () => {
    expect(computeProratedCredit(300_000, 30, 15)).toBe(150_000);
    expect(computeProratedCredit(199_900, 90, 45)).toBe(99_950);
    expect(computeProratedCredit(100_000, 30, 0)).toBe(0);
  });
});

describe("FORGE CRM — Indian GST Engine (CGST/SGST vs IGST)", () => {
  it("property: GST math preserves taxable + tax === total with zero float drift", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5_000_000 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.constantFrom("KA", "MH", "DL"),
        fc.constantFrom("KA", "MH", "TN"),
        (unitPricePaise, quantity, discountPaise, supplyState, branchState) => {
          const row = calculateGstLineItem({
            description: "Plan Charge",
            unitPricePaise,
            quantity,
            discountPaise,
            gstRateBps: 1800,
            placeOfSupplyState: supplyState,
            branchStateCode: branchState,
          });

          expect(row.subtotalPaise - row.discountPaise).toBe(row.taxablePaise);
          expect(row.taxablePaise + row.cgstPaise + row.sgstPaise + row.igstPaise).toBe(
            row.totalPaise
          );
          if (supplyState === branchState) {
            expect(row.igstPaise).toBe(0);
            expect(row.cgstPaise + row.sgstPaise).toBe(row.totalTaxPaise);
          } else {
            expect(row.cgstPaise).toBe(0);
            expect(row.sgstPaise).toBe(0);
            expect(row.igstPaise).toBe(row.totalTaxPaise);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it("aggregates multi-line GST invoices accurately", () => {
    const summary = aggregateGstInvoice(
      [
        { description: "Quarterly Black", unitPricePaise: 500_000, quantity: 1, gstRateBps: 1800 },
        { description: "Locker Add-on", unitPricePaise: 60_000, quantity: 1, gstRateBps: 1800 },
      ],
      "KA",
      "KA"
    );
    expect(summary.isInterState).toBe(false);
    expect(summary.taxablePaise).toBe(560_000);
    expect(summary.cgstPaise).toBe(50_400);
    expect(summary.sgstPaise).toBe(50_400);
    expect(summary.totalPaise).toBe(660_800);
  });
});

describe("FORGE CRM — Membership Renewal, Freeze & Upgrade Math", () => {
  const tz = "Asia/Kolkata";
  const now = new Date("2026-11-26T08:00:00.000Z");

  it("extends active future expiry cleanly and resets expired memberships from today", () => {
    const futureExpiry = new Date("2026-12-10T00:00:00.000Z");
    const activeRenewal = computeMembershipRenewal(futureExpiry, now, 30, tz);
    expect(activeRenewal.startDate.toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(activeRenewal.newEndDate.toISOString().slice(0, 10)).toBe("2027-01-09");

    const pastExpiry = new Date("2026-10-01T00:00:00.000Z");
    const expiredRenewal = computeMembershipRenewal(pastExpiry, now, 30, tz);
    expect(expiredRenewal.startDate.toISOString().slice(0, 10)).toBe("2026-11-26");
    expect(expiredRenewal.newEndDate.toISOString().slice(0, 10)).toBe("2026-12-26");
  });

  it("enforces max freeze allowance and extends endDate by freeze days", () => {
    const ok = computeFreezeApplication({
      currentEndDate: new Date("2026-12-20T00:00:00.000Z"),
      freezeStartDate: new Date("2026-11-27T00:00:00.000Z"),
      freezeDays: 14,
      maxFreezeDays: 30,
      freezeDaysUsed: 10,
      feePaise: 29_900,
      timeZone: tz,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.newFreezeDaysUsed).toBe(24);
      expect(ok.newMembershipEndDate.toISOString().slice(0, 10)).toBe("2027-01-03");
    }

    const denied = computeFreezeApplication({
      currentEndDate: new Date("2026-12-20T00:00:00.000Z"),
      freezeStartDate: new Date("2026-11-27T00:00:00.000Z"),
      freezeDays: 25,
      maxFreezeDays: 30,
      freezeDaysUsed: 10,
      feePaise: 0,
      timeZone: tz,
    });
    expect(denied.ok).toBe(false);
  });

  it("computes pro-rated mid-cycle upgrade credit", () => {
    const up = computeUpgradeProration({
      currentPaidPaise: 300_000,
      currentStartDate: new Date("2026-11-01T00:00:00.000Z"),
      currentEndDate: new Date("2026-12-01T00:00:00.000Z"),
      upgradeOnDate: new Date("2026-11-16T00:00:00.000Z"),
      newPlanPricePaise: 600_000,
      timeZone: tz,
    });
    expect(up.totalCycleDays).toBe(30);
    expect(up.unusedDays).toBe(15);
    expect(up.creditPaise).toBe(150_000);
    expect(up.netUpgradePaise).toBe(450_000);
  });

  it("derives member statuses deterministically", () => {
    expect(deriveMemberStatus({ expiryDate: null, isFrozen: true, hasOverdueDues: true })).toBe("FROZEN");
    expect(deriveMemberStatus({ expiryDate: null, isFrozen: false, hasOverdueDues: true })).toBe("OVERDUE");
    expect(
      deriveMemberStatus({
        expiryDate: new Date("2026-11-30T00:00:00.000Z"),
        isFrozen: false,
        hasOverdueDues: false,
        referenceNow: now,
      })
    ).toBe("EXPIRING");
    expect(
      deriveMemberStatus({
        expiryDate: new Date("2026-12-20T00:00:00.000Z"),
        isFrozen: false,
        hasOverdueDues: false,
        referenceNow: now,
      })
    ).toBe("ACTIVE");
  });
});

describe("FORGE CRM — Dues Ledger, Refunds & Cash Drawer", () => {
  it("tracks partial payments, full settlement, credit notes, and cash drawer variance", () => {
    const part1 = applyPaymentToInvoice({ totalPaise: 500_000, paidSoFarPaise: 0, paymentPaise: 200_000 });
    expect(part1.ok).toBe(true);
    if (part1.ok) {
      expect(part1.nextStatus).toBe("PARTIALLY_PAID");
      expect(part1.nextBalanceDuePaise).toBe(300_000);
    }

    const part2 = applyPaymentToInvoice({ totalPaise: 500_000, paidSoFarPaise: 200_000, paymentPaise: 300_000 });
    expect(part2.ok).toBe(true);
    if (part2.ok) {
      expect(part2.nextStatus).toBe("PAID");
      expect(part2.nextBalanceDuePaise).toBe(0);
    }

    const overpay = applyPaymentToInvoice({ totalPaise: 500_000, paidSoFarPaise: 200_000, paymentPaise: 400_000 });
    expect(overpay.ok).toBe(false);

    const ref = applyCreditNoteRefund({
      totalPaise: 500_000,
      paidSoFarPaise: 500_000,
      alreadyRefundedPaise: 0,
      refundPaise: 500_000,
    });
    expect(ref.ok).toBe(true);
    if (ref.ok) {
      expect(ref.nextStatus).toBe("REFUNDED");
    }

    const drawer = reconcileCashDrawer({
      openingCashPaise: 200_000,
      cashCollectedPaise: 450_000,
      cashRefundsPaise: 50_000,
      countedCashPaise: 595_000,
    });
    expect(drawer.expectedCashPaise).toBe(600_000);
    expect(drawer.variancePaise).toBe(-5_000);
    expect(drawer.isBalanced).toBe(false);
  });

  it("buckets overdue balances cleanly", () => {
    const now = new Date("2026-11-26T00:00:00.000Z");
    expect(classifyDuesAging(new Date("2026-11-20T00:00:00.000Z"), 10_000, now)).toBe("DAYS_1_30");
    expect(classifyDuesAging(new Date("2026-10-10T00:00:00.000Z"), 10_000, now)).toBe("DAYS_31_60");
    expect(classifyDuesAging(new Date("2026-09-01T00:00:00.000Z"), 10_000, now)).toBe("DAYS_60_PLUS");
  });
});

describe("FORGE CRM — Server RBAC Matrix, Check-in Gate & Encryption", () => {
  it("enforces strict role & branch boundaries (trainer denied finance, manager denied other branch)", () => {
    expect(canAccessFinance("TRAINER")).toBe(false);
    expect(canAccessFinance("OWNER")).toBe(true);
    expect(canAccessFinance("ACCOUNTANT")).toBe(true);

    expect(() =>
      assertAuthorized({
        role: "TRAINER",
        assignedBranchIds: ["br-blr"],
        permission: "billing:read",
        branchId: "br-blr",
      })
    ).toThrow(AuthorizationError);

    expect(canAccessBranch("MANAGER", ["br-blr"], "br-blr")).toBe(true);
    expect(canAccessBranch("MANAGER", ["br-blr"], "br-mum")).toBe(false);

    expect(() =>
      assertAuthorized({
        role: "MANAGER",
        assignedBranchIds: ["br-blr"],
        permission: "members:read",
        branchId: "br-mum",
      })
    ).toThrow(AuthorizationError);

    expect(() =>
      assertAuthorized({
        role: "ACCOUNTANT",
        assignedBranchIds: [],
        permission: "billing:refund",
        branchId: "br-blr",
      })
    ).toThrow(AuthorizationError);
  });

  it("blocks expired/frozen check-ins unless explicit override reason is logged", () => {
    const ref = new Date("2026-11-26T08:00:00.000Z");
    const blocked = evaluateCheckInAccess({
      status: "EXPIRED",
      expiryDate: new Date("2026-11-10T00:00:00.000Z"),
      referenceNow: ref,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.result).toBe("BLOCKED_EXPIRED");

    const overridden = evaluateCheckInAccess({
      status: "EXPIRED",
      expiryDate: new Date("2026-11-10T00:00:00.000Z"),
      overrideReason: "Owner approved 1-day renewal grace",
      referenceNow: ref,
    });
    expect(overridden.allowed).toBe(true);
    expect(overridden.result).toBe("OVERRIDE_ALLOWED");
  });

  it("round-trips AES-256-GCM sensitive health & KYC fields cleanly", () => {
    const cipher = encryptSensitiveField("Mild lumbar disc bulge — avoid heavy axial loading.");
    expect(cipher.startsWith("v1:")).toBe(true);
    expect(cipher).not.toContain("lumbar");
    expect(decryptSensitiveField(cipher)).toBe("Mild lumbar disc bulge — avoid heavy axial loading.");
    expect(maskKycLast4("1234 5678 9012")).toBe("XXXXXXXX9012");
  });
});
