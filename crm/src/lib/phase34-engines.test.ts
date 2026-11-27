import { describe, expect, it } from "vitest";
import {
  calculateTrainerCommission,
  computePosSaleTotals,
  evaluateClassBookingCapacity,
  isLateCancellation,
} from "./ops-math";
import {
  aggregateGstrSummary,
  buildCsvContent,
  resolveGroundedOrgAiQuery,
  validateMigrationCsvRows,
} from "./reports-ai";
import { hasPermission } from "./rbac";

describe("Phase 3 & 4 Operations, Reports & AI Engines", () => {
  it("evaluates class capacity waitlists, late cancellation cutoffs, trainer commission slabs, and POS GST totals", () => {
    expect(
      evaluateClassBookingCapacity({ capacity: 16, bookedCount: 14, waitlistedCount: 0 })
    ).toEqual({ bookingStatus: "BOOKED", waitlistPos: null });

    expect(
      evaluateClassBookingCapacity({ capacity: 16, bookedCount: 16, waitlistedCount: 2 })
    ).toEqual({ bookingStatus: "WAITLISTED", waitlistPos: 3 });

    const start = new Date("2026-12-01T12:00:00Z");
    expect(
      isLateCancellation({
        sessionStartsAt: start,
        cancelledAt: new Date("2026-12-01T11:15:00Z"),
        cutoffMinutes: 120,
      })
    ).toBe(true);
    expect(
      isLateCancellation({
        sessionStartsAt: start,
        cancelledAt: new Date("2026-12-01T08:00:00Z"),
        cutoffMinutes: 120,
      })
    ).toBe(false);

    // 16 sessions >= 15 earns +500 bps slab bonus!
    const payout = calculateTrainerCommission({
      baseRetainerPaise: 3500000,
      completedSessionFeesPaise: Array.from({ length: 16 }, () => 150000),
      baseCommissionBps: 3500,
    });
    expect(payout.effectiveBps).toBe(4000);
    expect(payout.grossPtRevenuePaise).toBe(2400000);
    expect(payout.commissionEarnedPaise).toBe(960000);
    expect(payout.totalPayoutPaise).toBe(4460000);

    const pos = computePosSaleTotals([
      { itemId: "sku1", name: "Whey Isolate 1kg", unitPricePaise: 350000, quantity: 2, gstRateBps: 1800 },
    ]);
    expect(pos.subtotalPaise).toBe(700000);
    expect(pos.gstPaise).toBe(126000);
    expect(pos.totalPaise).toBe(826000);
  });

  it("sanitizes CSV formula injection, summarizes GSTR tax totals, validates CSV import rows, and enforces RBAC in AI queries", () => {
    const csv = buildCsvContent(
      ["Name", "Amount"],
      [["=cmd|'/C calc'!A0", 299900]]
    );
    expect(csv).toContain("'=cmd|'/C calc'!A0,299900");

    const gstr = aggregateGstrSummary([
      { taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, totalPaise: 118000, sacCode: "999723" },
      { taxablePaise: 200000, cgstPaise: 0, sgstPaise: 0, igstPaise: 36000, totalPaise: 236000, sacCode: "999723" },
    ]);
    expect(gstr.totalPaise).toBe(354000);
    expect(gstr.cgstPaise + gstr.sgstPaise + gstr.igstPaise).toBe(54000);

    const importDry = validateMigrationCsvRows(
      "fullName,phone,email,status\nKabir Rao,+91 98450 99881,kabir@test.in,ACTIVE\nX,123,bad,ACTIVE"
    );
    expect(importDry.validCount).toBe(1);
    expect(importDry.errorCount).toBe(1);

    const trainerFinanceAi = resolveGroundedOrgAiQuery("What is today's overdue revenue?", {
      orgName: "Ironworks",
      branchName: "Indiranagar HQ",
      role: "TRAINER",
      canAccessFinance: false,
      currency: "INR",
      activeMembers: 300,
      expiring7d: 25,
      overdueCount: 12,
      overdueTotalPaise: 500000,
      todayRevenuePaise: 200000,
      openLeadsCount: 40,
      lowStockItemsCount: 3,
      topAbsentMemberName: "Rhea Kapoor",
      topAbsentMemberId: "mem_1",
    });
    expect(trainerFinanceAi.answer).toContain("Access restricted");
    expect(trainerFinanceAi.suggestedAction).toBeNull();

    // Strict RBAC permissions check for Phase 3 & 4
    expect(hasPermission("OWNER", "settings:admin")).toBe(true);
    expect(hasPermission("MANAGER", "settings:admin")).toBe(false);
    expect(hasPermission("TRAINER", "training:write")).toBe(true);
    expect(hasPermission("TRAINER", "inventory:pos")).toBe(false);
    expect(hasPermission("TRAINER", "reports:export")).toBe(false);
    expect(hasPermission("ACCOUNTANT", "trainers:payroll")).toBe(true);
    expect(hasPermission("ACCOUNTANT", "reports:export")).toBe(true);
    expect(hasPermission("MEMBER", "portal:self")).toBe(true);
  });
});
