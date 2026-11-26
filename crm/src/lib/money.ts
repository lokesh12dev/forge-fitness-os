/**
 * Integer-paise monetary arithmetic helpers for FORGE CRM.
 * All financial calculations operate strictly in integer smallest currency units (paise for INR).
 */

export function formatMoney(
  paise: number,
  options: {
    currency?: string;
    showDecimals?: boolean;
    compact?: boolean;
  } = {}
): string {
  const currency = (options.currency ?? "INR").toUpperCase();
  const safePaise = Math.trunc(paise);
  const sign = safePaise < 0 ? "-" : "";
  const absPaise = Math.abs(safePaise);

  if (options.compact && currency === "INR") {
    const wholeRupees = Math.trunc(absPaise / 100);
    if (wholeRupees >= 10_000_000) {
      const crTenths = Math.round(wholeRupees / 100_000);
      return `${sign}₹${(crTenths / 100).toFixed(2)}Cr`;
    }
    if (wholeRupees >= 100_000) {
      const lakhHundredths = Math.round(wholeRupees / 1000);
      return `${sign}₹${(lakhHundredths / 100).toFixed(2)}L`;
    }
  }

  const wholeUnits = Math.trunc(absPaise / 100);
  const remPaise = absPaise % 100;
  const symbol = currency === "USD" ? "$" : "₹";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const formattedWhole = wholeUnits.toLocaleString(locale);

  if (options.showDecimals || remPaise > 0) {
    return `${sign}${symbol}${formattedWhole}.${String(remPaise).padStart(2, "0")}`;
  }
  return `${sign}${symbol}${formattedWhole}`;
}

/**
 * Computes discount in integer paise from basis points (100 bps = 1%).
 */
export function applyBpsDiscount(amountPaise: number, discountBps: number): number {
  const safeAmount = Math.max(0, Math.trunc(amountPaise));
  const safeBps = Math.max(0, Math.min(10_000, Math.trunc(discountBps)));
  const discount = Math.round((safeAmount * safeBps) / 10_000);
  return Math.min(safeAmount, Math.max(0, discount));
}

/**
 * Distributes a positive integer total across positive weights while guaranteeing
 * sum(result) === totalPaise (zero penny/paisa drift).
 */
export function allocateProportionally(totalPaise: number, weights: number[]): number[] {
  const target = Math.trunc(totalPaise);
  if (weights.length === 0) return [];
  const cleanWeights = weights.map((w) => Math.max(0, Math.trunc(w)));
  const weightSum = cleanWeights.reduce((acc, w) => acc + w, 0);

  if (weightSum <= 0) {
    const base = Math.trunc(target / cleanWeights.length);
    const rem = target - base * cleanWeights.length;
    return cleanWeights.map((_, idx) => base + (idx < Math.abs(rem) ? (rem > 0 ? 1 : -1) : 0));
  }

  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < cleanWeights.length; i++) {
    if (i === cleanWeights.length - 1) {
      out.push(target - allocated);
    } else {
      const share = Math.trunc((target * (cleanWeights[i] ?? 0)) / weightSum);
      out.push(share);
      allocated += share;
    }
  }
  return out;
}

/**
 * Calculates integer pro-rated credit for unused days in an active membership cycle.
 */
export function computeProratedCredit(
  paidPaise: number,
  totalDays: number,
  remainingDays: number
): number {
  const safePaid = Math.max(0, Math.trunc(paidPaise));
  const safeTotal = Math.max(1, Math.trunc(totalDays));
  const safeRemaining = Math.max(0, Math.min(safeTotal, Math.trunc(remainingDays)));
  return Math.floor((safePaid * safeRemaining) / safeTotal);
}
