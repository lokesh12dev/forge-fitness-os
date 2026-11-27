/**
 * Lead scoring, duplicate detection, and Source ROI analytics (integer paise).
 */

export type LeadStageType =
  | "NEW"
  | "CONTACTED"
  | "TRIAL_BOOKED"
  | "TRIAL_DONE"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

const SOURCE_WEIGHT: Record<string, number> = {
  Referral: 30,
  "Walk-in": 26,
  WhatsApp: 22,
  Website: 18,
  Google: 16,
  Instagram: 14,
  Justdial: 12,
};

const STAGE_BOOST: Record<LeadStageType, number> = {
  NEW: 10,
  CONTACTED: 20,
  TRIAL_BOOKED: 35,
  TRIAL_DONE: 45,
  NEGOTIATION: 55,
  WON: 65,
  LOST: 0,
};

export function calculateLeadScore(input: {
  source: string;
  stage: LeadStageType;
  hasEmail: boolean;
  hasTrialScheduled: boolean;
  ageDays: number;
}): number {
  if (input.stage === "LOST") return 5;
  const sourcePts = SOURCE_WEIGHT[input.source] ?? 12;
  const stagePts = STAGE_BOOST[input.stage];
  const emailPts = input.hasEmail ? 6 : 0;
  const trialPts = input.hasTrialScheduled ? 10 : 0;
  const decay = Math.min(20, Math.max(0, Math.floor(input.ageDays / 3)));
  return Math.max(5, Math.min(100, sourcePts + stagePts + emailPts + trialPts - decay));
}

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function findDuplicateContact(input: {
  phone: string;
  email?: string | null;
  leads: Array<{ id: string; fullName: string; phone: string; email: string | null; stage: string }>;
  members: Array<{ id: string; fullName: string; phone: string; email: string | null; memberCode: string }>;
}): {
  duplicateLead: { id: string; fullName: string; stage: string } | null;
  existingMember: { id: string; fullName: string; memberCode: string } | null;
} {
  const normPhone = normalizeIndianPhone(input.phone);
  const normEmail = input.email?.trim().toLowerCase() || "";

  const dupLead =
    input.leads.find(
      (l) =>
        (normPhone.length >= 8 && normalizeIndianPhone(l.phone) === normPhone) ||
        (normEmail !== "" && (l.email ?? "").toLowerCase() === normEmail)
    ) ?? null;

  const existingMember =
    input.members.find(
      (m) =>
        (normPhone.length >= 8 && normalizeIndianPhone(m.phone) === normPhone) ||
        (normEmail !== "" && (m.email ?? "").toLowerCase() === normEmail)
    ) ?? null;

  return {
    duplicateLead: dupLead
      ? { id: dupLead.id, fullName: dupLead.fullName, stage: dupLead.stage }
      : null,
    existingMember: existingMember
      ? { id: existingMember.id, fullName: existingMember.fullName, memberCode: existingMember.memberCode }
      : null,
  };
}

export interface SourceRoiRow {
  source: string;
  leadsCount: number;
  wonCount: number;
  conversionRatePct: number;
  spendPaise: number;
  costPerLeadPaise: number;
  revenuePaise: number;
  roiMultiplierPct: number;
}

export function computeSourceRoiReport(input: {
  leads: Array<{ source: string; stage: string; convertedMemberId: string | null }>;
  spendBySourcePaise: Record<string, number>;
  revenueByMemberPaise: Record<string, number>;
}): SourceRoiRow[] {
  const sources = new Set<string>([
    ...Object.keys(input.spendBySourcePaise),
    ...input.leads.map((l) => l.source),
  ]);

  const rows: SourceRoiRow[] = [];
  for (const source of sources) {
    const group = input.leads.filter((l) => l.source === source);
    const won = group.filter((l) => l.stage === "WON");
    const spendPaise = Math.max(0, Math.trunc(input.spendBySourcePaise[source] ?? 0));
    const revenuePaise = won.reduce(
      (acc, l) =>
        acc + (l.convertedMemberId ? Math.max(0, input.revenueByMemberPaise[l.convertedMemberId] ?? 0) : 0),
      0
    );

    const leadsCount = group.length;
    const wonCount = won.length;
    const conversionRatePct = leadsCount > 0 ? Math.round((wonCount / leadsCount) * 100) : 0;
    const costPerLeadPaise = leadsCount > 0 ? Math.round(spendPaise / leadsCount) : 0;
    const roiMultiplierPct =
      spendPaise > 0 ? Math.round((revenuePaise / spendPaise) * 100) : revenuePaise > 0 ? 999 : 0;

    rows.push({
      source,
      leadsCount,
      wonCount,
      conversionRatePct,
      spendPaise,
      costPerLeadPaise,
      revenuePaise,
      roiMultiplierPct,
    });
  }

  return rows.sort((a, b) => b.revenuePaise - a.revenuePaise || b.leadsCount - a.leadsCount);
}
