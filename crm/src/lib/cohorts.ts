/**
 * Cohort Retention & 30-Day Renewal Forecast calculators (integer paise).
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
  }>,
  now: Date = new Date()
): CohortRow[] {
  const rows: CohortRow[] = [];

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
    const label = start.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

    // For demo & multi-month snapshots, include historical cohorts anchored by join/expiry cadence
    const cohort = members.filter((m) => {
      const t = m.createdAt.getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    if (cohort.length === 0) {
      continue;
    }

    const activeCount = cohort.filter(
      (m) => m.status === "ACTIVE" || m.status === "EXPIRING" || m.status === "FROZEN"
    ).length;

    const retentionPcts: number[] = [];
    for (let offset = 0; offset <= monthsAgo; offset++) {
      if (offset === 0) {
        retentionPcts.push(100);
      } else {
        const currentRatio = Math.round((activeCount / cohort.length) * 100);
        const interpolated = Math.max(
          currentRatio,
          Math.round(100 - ((100 - currentRatio) * offset) / Math.max(1, monthsAgo))
        );
        retentionPcts.push(Math.min(100, interpolated));
      }
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
