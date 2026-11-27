/**
 * Explainable Member Churn Scoring Engine & Save-Plan recommender.
 */

export interface ChurnInputs {
  visitsLast14d: number;
  visitsPrev14d: number;
  daysSinceLastVisit: number;
  status: string;
  overdueBalancePaise: number;
  billingModel: string | null;
  tenureDays: number;
}

export interface ChurnFactor {
  code: string;
  label: string;
  points: number;
}

export interface SavePlanSuggestion {
  actionType: "COACH_CALL" | "FREEZE_OFFER" | "RENEWAL_DISCOUNT" | "DUES_SPLIT";
  title: string;
  outreachMessage: string;
}

export interface ChurnAssessment {
  score: number; // 0..100
  tier: "HIGH" | "MEDIUM" | "LOW";
  factors: ChurnFactor[];
  savePlan: SavePlanSuggestion;
}

export function evaluateMemberChurnRisk(input: ChurnInputs, memberName: string): ChurnAssessment {
  const factors: ChurnFactor[] = [];
  let total = 0;

  if (input.daysSinceLastVisit >= 21) {
    factors.push({ code: "ABSENT_21D", label: `Absent ${input.daysSinceLastVisit}d since last visit`, points: 36 });
    total += 36;
  } else if (input.daysSinceLastVisit >= 12) {
    factors.push({ code: "ABSENT_12D", label: `${input.daysSinceLastVisit}d quiet streak`, points: 22 });
    total += 22;
  }

  if (input.visitsPrev14d >= 3 && input.visitsLast14d <= Math.floor(input.visitsPrev14d / 2)) {
    factors.push({
      code: "FREQ_DROP",
      label: `Visit drop (${input.visitsPrev14d} → ${input.visitsLast14d} visits / 14d)`,
      points: 20,
    });
    total += 20;
  } else if (input.visitsLast14d === 0 && input.daysSinceLastVisit < 21) {
    factors.push({ code: "ZERO_RECENT", label: "0 floor visits in past 14d", points: 14 });
    total += 14;
  }

  if (input.overdueBalancePaise > 0 || input.status === "OVERDUE") {
    factors.push({ code: "PAYMENT_DUE", label: "Overdue invoice / failed billing", points: 24 });
    total += 24;
  } else if (input.status === "EXPIRING") {
    factors.push({ code: "EXPIRING_7D", label: "Plan expires within 7 days", points: 14 });
    total += 14;
  }

  if (input.billingModel === "MONTHLY" || input.billingModel === "TRIAL") {
    factors.push({ code: "SHORT_COMMIT", label: `High-churn tier (${input.billingModel})`, points: 12 });
    total += 12;
  } else if (input.tenureDays < 60) {
    factors.push({ code: "EARLY_TENURE", label: "Early tenure (< 60 days habit lock)", points: 10 });
    total += 10;
  }

  const score = Math.min(100, Math.max(0, total));
  const tier: ChurnAssessment["tier"] =
    score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const firstName = memberName.trim().split(/\s+/)[0] || memberName;

  let savePlan: SavePlanSuggestion;
  if (input.overdueBalancePaise > 0) {
    savePlan = {
      actionType: "DUES_SPLIT",
      title: "Offer 2-Installment UPI Dues Link",
      outreachMessage: `Hi ${firstName}, we can split your pending club balance across 2 quick UPI steps so your access stays open today.`,
    };
  } else if (input.daysSinceLastVisit >= 21) {
    savePlan = {
      actionType: "FREEZE_OFFER",
      title: "Offer 7-Day Pause or 1-on-1 Restart Session",
      outreachMessage: `Hey ${firstName}, missed seeing you on the floor! Traveling or busy? Want a complimentary 7-day freeze or a 25-min coach reset this week?`,
    };
  } else if (input.status === "EXPIRING") {
    savePlan = {
      actionType: "RENEWAL_DISCOUNT",
      title: "Send REF500 Fast-Renewal Perk",
      outreachMessage: `Hi ${firstName}, your cycle is up soon! Renew before expiry with REF500 for ₹500 off Quarterly/Annual.`,
    };
  } else {
    savePlan = {
      actionType: "COACH_CALL",
      title: "Schedule 15-Min Coach Check-In",
      outreachMessage: `Hey ${firstName}, checking in on your training streak — want Coach Vikram to tweak your split for this week?`,
    };
  }

  return { score, tier, factors, savePlan };
}
