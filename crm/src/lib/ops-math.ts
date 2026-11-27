/**
 * Phase 3 Operations Pure Engines:
 * Class waitlists/cutoffs, Trainer commission payroll math, and POS GST totals (integer paise).
 */

export function evaluateClassBookingCapacity(input: {
  capacity: number;
  bookedCount: number;
  waitlistedCount: number;
}): { bookingStatus: "BOOKED" | "WAITLISTED"; waitlistPos: number | null } {
  if (input.bookedCount < Math.max(0, input.capacity)) {
    return { bookingStatus: "BOOKED", waitlistPos: null };
  }
  return {
    bookingStatus: "WAITLISTED",
    waitlistPos: Math.max(0, input.waitlistedCount) + 1,
  };
}

export function isLateCancellation(input: {
  sessionStartsAt: Date;
  cancelledAt: Date;
  cutoffMinutes: number;
}): boolean {
  const diffMin = (input.sessionStartsAt.getTime() - input.cancelledAt.getTime()) / 60_000;
  return diffMin < input.cutoffMinutes;
}

export function calculateTrainerCommission(input: {
  baseRetainerPaise: number;
  completedSessionFeesPaise: number[];
  baseCommissionBps: number;
}): {
  retainerPaise: number;
  sessionsCount: number;
  grossPtRevenuePaise: number;
  effectiveBps: number;
  commissionEarnedPaise: number;
  totalPayoutPaise: number;
} {
  const sessionsCount = input.completedSessionFeesPaise.length;
  const grossPtRevenuePaise = input.completedSessionFeesPaise.reduce(
    (sum, p) => sum + Math.max(0, Math.trunc(p)),
    0
  );
  // Slab booster: +500 bps (+5%) when delivering 15+ completed PT sessions in cycle
  const effectiveBps =
    sessionsCount >= 15
      ? Math.min(8000, input.baseCommissionBps + 500)
      : input.baseCommissionBps;
  const commissionEarnedPaise = Math.round((grossPtRevenuePaise * effectiveBps) / 10_000);
  const retainerPaise = Math.max(0, Math.trunc(input.baseRetainerPaise));
  return {
    retainerPaise,
    sessionsCount,
    grossPtRevenuePaise,
    effectiveBps,
    commissionEarnedPaise,
    totalPayoutPaise: retainerPaise + commissionEarnedPaise,
  };
}

export interface PosCartLineInput {
  itemId: string;
  name: string;
  unitPricePaise: number;
  quantity: number;
  gstRateBps: number;
}

export function computePosSaleTotals(lines: PosCartLineInput[]): {
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  lines: Array<PosCartLineInput & { lineSubtotalPaise: number; lineGstPaise: number; lineTotalPaise: number }>;
} {
  let subtotalPaise = 0;
  let gstPaise = 0;
  const computed = lines.map((l) => {
    const qty = Math.max(1, Math.trunc(l.quantity));
    const unit = Math.max(0, Math.trunc(l.unitPricePaise));
    const lineSubtotalPaise = qty * unit;
    const lineGstPaise = Math.round((lineSubtotalPaise * Math.max(0, l.gstRateBps)) / 10_000);
    const lineTotalPaise = lineSubtotalPaise + lineGstPaise;
    subtotalPaise += lineSubtotalPaise;
    gstPaise += lineGstPaise;
    return {
      ...l,
      quantity: qty,
      lineSubtotalPaise,
      lineGstPaise,
      lineTotalPaise,
    };
  });

  return {
    subtotalPaise,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
    lines: computed,
  };
}
