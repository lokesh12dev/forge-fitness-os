/**
 * Integer-paise dues ledger, part-payment allocation, refund notes,
 * aging buckets, and day-end cash reconciliation helpers.
 */

import { diffCalendarDays } from "./membership-math";

export function applyPaymentToInvoice(input: {
  totalPaise: number;
  paidSoFarPaise: number;
  paymentPaise: number;
}):
  | {
      ok: true;
      nextPaidPaise: number;
      nextBalanceDuePaise: number;
      nextStatus: "ISSUED" | "PARTIALLY_PAID" | "PAID";
    }
  | { ok: false; error: string } {
  const total = Math.max(0, Math.trunc(input.totalPaise));
  const paidSoFar = Math.max(0, Math.trunc(input.paidSoFarPaise));
  const payment = Math.trunc(input.paymentPaise);
  const remaining = Math.max(0, total - paidSoFar);

  if (payment <= 0) {
    return { ok: false, error: "Payment amount must be positive." };
  }
  if (payment > remaining) {
    return {
      ok: false,
      error: `Payment (${payment}p) exceeds remaining invoice balance (${remaining}p).`,
    };
  }

  const nextPaidPaise = paidSoFar + payment;
  const nextBalanceDuePaise = total - nextPaidPaise;
  const nextStatus =
    nextBalanceDuePaise === 0 ? "PAID" : nextPaidPaise > 0 ? "PARTIALLY_PAID" : "ISSUED";

  return {
    ok: true,
    nextPaidPaise,
    nextBalanceDuePaise,
    nextStatus,
  };
}

export function applyCreditNoteRefund(input: {
  totalPaise: number;
  paidSoFarPaise: number;
  alreadyRefundedPaise: number;
  refundPaise: number;
}):
  | {
      ok: true;
      nextPaidPaise: number;
      nextRefundedPaise: number;
      nextStatus: "PAID" | "PARTIALLY_PAID" | "REFUNDED";
    }
  | { ok: false; error: string } {
  const paidSoFar = Math.max(0, Math.trunc(input.paidSoFarPaise));
  const alreadyRefunded = Math.max(0, Math.trunc(input.alreadyRefundedPaise));
  const refund = Math.trunc(input.refundPaise);
  const maxRefundable = Math.max(0, paidSoFar - alreadyRefunded);

  if (refund <= 0) {
    return { ok: false, error: "Refund amount must be positive." };
  }
  if (refund > maxRefundable) {
    return {
      ok: false,
      error: `Refund (${refund}p) exceeds refundable captured payments (${maxRefundable}p).`,
    };
  }

  const nextRefundedPaise = alreadyRefunded + refund;
  const netPaid = paidSoFar - nextRefundedPaise;
  const nextStatus =
    netPaid <= 0
      ? "REFUNDED"
      : netPaid < Math.max(0, Math.trunc(input.totalPaise))
      ? "PARTIALLY_PAID"
      : "PAID";

  return {
    ok: true,
    nextPaidPaise: netPaid,
    nextRefundedPaise,
    nextStatus,
  };
}

export type AgingBucket = "CURRENT" | "DAYS_1_30" | "DAYS_31_60" | "DAYS_60_PLUS";

export function classifyDuesAging(
  dueDate: Date,
  balanceDuePaise: number,
  referenceNow: Date = new Date(),
  timeZone: string = "Asia/Kolkata"
): AgingBucket {
  if (balanceDuePaise <= 0) return "CURRENT";
  const overdueDays = diffCalendarDays(referenceNow, dueDate, timeZone);
  if (overdueDays <= 0) return "CURRENT";
  if (overdueDays <= 30) return "DAYS_1_30";
  if (overdueDays <= 60) return "DAYS_31_60";
  return "DAYS_60_PLUS";
}

export function reconcileCashDrawer(input: {
  openingCashPaise: number;
  cashCollectedPaise: number;
  cashRefundsPaise?: number;
  countedCashPaise: number;
}): {
  expectedCashPaise: number;
  countedCashPaise: number;
  variancePaise: number;
  isBalanced: boolean;
} {
  const opening = Math.max(0, Math.trunc(input.openingCashPaise));
  const collected = Math.max(0, Math.trunc(input.cashCollectedPaise));
  const refunds = Math.max(0, Math.trunc(input.cashRefundsPaise ?? 0));
  const counted = Math.max(0, Math.trunc(input.countedCashPaise));
  const expectedCashPaise = opening + collected - refunds;
  const variancePaise = counted - expectedCashPaise;

  return {
    expectedCashPaise,
    countedCashPaise: counted,
    variancePaise,
    isBalanced: variancePaise === 0,
  };
}
