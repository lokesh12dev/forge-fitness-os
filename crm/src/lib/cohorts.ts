/**
 * Cohort Retention & 30-Day Renewal Forecast calculators (integer paise).
 * Uses real Membership start/end date windows (or falls back to current status snapshot when no subscription array is passed).
 */

export interface CohortRow {
  cohortLabel: string;
  size: number;
  retentionPcts: number[]; // M0..M5 percentages
}

export function buildRetentionCohorts(
  members: Array<{
    id: string;
    createdAt: Date;
    expiryDate: Date | null;
    lastVisitedAt: Date | null;
    status: string;
    subscriptions?: Array<{ startDate: Date; endDate: Date; status?: string }>;
  }>,
  now: Date = new Date()
): CohortRow[] {
  const rows: CohortRow[] = [];

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
    const label = start.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

    const cohort = members.filter((m) => {
      const t = m.createdAt.getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    if (cohort.length === 0) {
      continue;
    }

    const retentionPcts: number[] = [];
    for (let offset = 0; offset <= monthsAgo; offset++) {
      if (offset === 0) {
        retentionPcts.push(100);
        continue;
      }

      const targetMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + offset, 1)
      );
      const targetMonthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + offset + 1, 0, 23, 59, 59, 999)
      );

      let retained = 0;
      for (const m of cohort) {
        if (m.subscriptions && m.subscriptions.length > 0) {
          const activeInMonth = m.subscriptions.some(
            (sub) =>
              sub.startDate.getTime() <= targetMonthEnd.getTime() &&
              sub.endDate.getTime() >= targetMonthStart.getTime()
          );
          if (activeInMonth) retained++;
        } else {
          // Pure status fallback when unit-testing without full subscription ledger
          const isCurrentActive = m.status === "ACTIVE" || m.status === "EXPIRING" || m.status === "FROZEN";
          const hadFutureExpiry = m.expiryDate ? m.expiryDate.getTime() >= targetMonthStart.getTime() : false;
          if (isCurrentActive || hadFutureExpiry) retained++;
        }
      }

      retentionPcts.push(Math.round((retained / cohort.length) * 100));
    }

    rows.push({
      cohortLabel: label,
      size: cohort.length,
      retentionPcts,
    });
  }

  return rows;
}

export function computeRenewalForecast(
  expiringMembers: Array<{ planPricePaise: number; churnScore: number }>,
  baseRenewalRatePct: number = 78
): {
  expiringCount: number;
  grossRenewablePaise: number;
  projectedCollectedPaise: number;
  atRiskPaise: number;
} {
  let grossRenewablePaise = 0;
  let projectedCollectedPaise = 0;
  let atRiskPaise = 0;

  for (const m of expiringMembers) {
    const p = Math.max(0, Math.trunc(m.planPricePaise));
    grossRenewablePaise += p;
    const expectedPct =
      m.churnScore >= 60
        ? Math.max(35, baseRenewalRatePct - 35)
        : m.churnScore >= 35
        ? Math.max(55, baseRenewalRatePct - 15)
        : baseRenewalRatePct;
    const projected = Math.round((p * expectedPct) / 100);
    projectedCollectedPaise += projected;
    if (m.churnScore >= 35) {
      atRiskPaise += p;
    }
  }

  return {
    expiringCount: expiringMembers.length,
    grossRenewablePaise,
    projectedCollectedPaise,
    atRiskPaise,
  };
}
