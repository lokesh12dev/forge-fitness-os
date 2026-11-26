/**
 * FORGE B2B Portal Engine
 * Powers the Trainer Athlete Management and Gym Owner Facility Management Portals.
 * Pure TypeScript functions, fully tested, server-authoritative calculations.
 */

export type AthleteClient = {
  id: string;
  name: string;
  initials: string;
  avatarAccent: string;
  email: string;
  tier: "pro" | "elite_coached";
  currentProgramId: string;
  currentProgramName: string;
  adherenceRate: number; // 0 - 100%
  streakDays: number;
  lastSessionDate: string;
  readinessScore: number; // 0 - 100
  fatigueRisk: "low" | "medium" | "high";
  notes: string[];
};

export type TrainerPrescription = {
  id: string;
  clientId: string;
  programId: string;
  programName: string;
  customIntensityMultiplier: number; // e.g. 0.90 for deload, 1.05 for peak
  focusCue: string;
  assignedAt: string;
};

export type EquipmentStation = {
  id: string;
  name: string;
  totalUnits: number;
  inUseUnits: number;
  category: "barbell" | "cable" | "machine" | "free-weight";
};

export type GymFacility = {
  id: string;
  name: string;
  city: string;
  maxCapacity: number;
  currentOccupancy: number;
  equipmentStations: EquipmentStation[];
};

export type GymMemberCheckIn = {
  id: string;
  memberId: string;
  memberName: string;
  planName: string;
  checkedInAt: string;
  status: "active" | "flagged_expired" | "guest_pass";
};

export type GymFinancialMetrics = {
  totalMembers: number;
  activeMembers: number;
  monthlyRecurringRevenueINR: number;
  monthlyRecurringRevenueUSD: number;
  churnRatePercent: number;
  avgSessionsPerMemberMonth: number;
};

/**
 * Calculates athlete compliance rate across scheduled microcycle sessions.
 */
export function calculateAthleteAdherence(completedSessions: number, scheduledSessions: number): number {
  if (scheduledSessions <= 0) return 100;
  if (completedSessions < 0) return 0;
  const rate = Math.round((completedSessions / scheduledSessions) * 100);
  return Math.min(100, Math.max(0, rate));
}

/**
 * Assesses athlete fatigue risk from central nervous system readiness and consecutive high-RPE sessions.
 */
export function evaluateAthleteFatigueRisk(
  readinessScore: number,
  consecutiveHighRpeSessions: number
): "low" | "medium" | "high" {
  if (readinessScore < 55 || consecutiveHighRpeSessions >= 3) {
    return "high";
  }
  if (readinessScore < 75 || consecutiveHighRpeSessions >= 2) {
    return "medium";
  }
  return "low";
}

/**
 * Computes live gym occupancy rate and operational threshold category.
 */
export function calculateGymOccupancyRate(
  currentOccupancy: number,
  maxCapacity: number
): {
  ratePct: number;
  status: "optimal" | "busy" | "crowded" | "at_capacity";
} {
  if (maxCapacity <= 0) {
    return { ratePct: 0, status: "optimal" };
  }
  const rawPct = Math.round((currentOccupancy / maxCapacity) * 100);
  const ratePct = Math.min(100, Math.max(0, rawPct));

  if (ratePct >= 95) return { ratePct, status: "at_capacity" };
  if (ratePct >= 80) return { ratePct, status: "crowded" };
  if (ratePct >= 50) return { ratePct, status: "busy" };
  return { ratePct, status: "optimal" };
}

/**
 * Scans gym equipment stations to find bottlenecks and check if crowded gym mode should trigger.
 */
export function calculateEquipmentBottleneck(stations: EquipmentStation[]): {
  mostCongested: string;
  congestionRate: number;
  isCrowded: boolean;
} {
  if (!stations || stations.length === 0) {
    return { mostCongested: "None", congestionRate: 0, isCrowded: false };
  }

  let maxRatio = -1;
  let topStation = stations[0].name;

  for (const st of stations) {
    const ratio = st.totalUnits > 0 ? st.inUseUnits / st.totalUnits : 0;
    if (ratio > maxRatio) {
      maxRatio = ratio;
      topStation = st.name;
    }
  }

  const congestionRate = Math.round(Math.max(0, maxRatio) * 100);
  const isCrowded = congestionRate >= 80;

  return {
    mostCongested: topStation,
    congestionRate,
    isCrowded,
  };
}

/**
 * Prescribes a training program to an athlete with custom coaching adjustments.
 */
export function prescribeProgramToAthlete(
  athlete: AthleteClient,
  programId: string,
  programName: string,
  customIntensityMultiplier = 1.0,
  focusCue = "Focus on explosive intent on the concentric."
): AthleteClient & { prescription: TrainerPrescription } {
  const prescription: TrainerPrescription = {
    id: `rx-${Date.now()}`,
    clientId: athlete.id,
    programId,
    programName,
    customIntensityMultiplier,
    focusCue,
    assignedAt: new Date().toISOString(),
  };

  return {
    ...athlete,
    currentProgramId: programId,
    currentProgramName: programName,
    notes: [
      `Assigned ${programName} (${Math.round(customIntensityMultiplier * 100)}% load intensity): ${focusCue}`,
      ...athlete.notes,
    ],
    prescription,
  };
}

/**
 * Processes a new member arrival and updates active facility attendance.
 */
export function processMemberCheckIn(
  currentCheckIns: GymMemberCheckIn[],
  newCheckIn: Omit<GymMemberCheckIn, "id" | "checkedInAt">,
  currentOccupancy: number
): { checkIns: GymMemberCheckIn[]; newOccupancy: number } {
  const record: GymMemberCheckIn = {
    ...newCheckIn,
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    checkedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  return {
    checkIns: [record, ...currentCheckIns],
    newOccupancy: currentOccupancy + 1,
  };
}

/* ───────────────────────────── AUTHENTIC MOCK SEED DATA ───────────────────────────── */

export const INITIAL_ATHLETES: AthleteClient[] = [
  {
    id: "ath-1",
    name: "Vikram Sharma",
    initials: "VS",
    avatarAccent: "#C9F73A",
    email: "vikram.sharma@forge.fit",
    tier: "elite_coached",
    currentProgramId: "ppl-hypertrophy-6x",
    currentProgramName: "6-Day Push / Pull / Legs Hypertrophy",
    adherenceRate: 94,
    streakDays: 14,
    lastSessionDate: "Today, 07:15 AM",
    readinessScore: 88,
    fatigueRisk: "low",
    notes: ["Hit 120kg bench double progression top set cleanly.", "Hydration on point."],
  },
  {
    id: "ath-2",
    name: "Sarah Jenkins",
    initials: "SJ",
    avatarAccent: "#9E86FF",
    email: "sarah.j@athlete.io",
    tier: "elite_coached",
    currentProgramId: "531-bbb",
    currentProgramName: "5/3/1 Boring But Big (Power & Mass)",
    adherenceRate: 88,
    streakDays: 8,
    lastSessionDate: "Yesterday, 06:40 PM",
    readinessScore: 52,
    fatigueRisk: "high",
    notes: ["CNS readiness dipped below 55 (HRV dropped 18ms). Prescribe 10% deload on squat back-offs."],
  },
  {
    id: "ath-3",
    name: "Marcus Vance",
    initials: "MV",
    avatarAccent: "#00E5FF",
    email: "m.vance@vancestrength.com",
    tier: "pro",
    currentProgramId: "gzclp-linear",
    currentProgramName: "GZCLP Tiered Linear Progression",
    adherenceRate: 91,
    streakDays: 11,
    lastSessionDate: "2 days ago",
    readinessScore: 78,
    fatigueRisk: "low",
    notes: ["Squat Tier 1 completed 5x3 at 140kg. Ready for 142.5kg."],
  },
  {
    id: "ath-4",
    name: "Ananya Patel",
    initials: "AP",
    avatarAccent: "#FF5E5B",
    email: "ananya.patel@designhub.in",
    tier: "elite_coached",
    currentProgramId: "glute-hypertrophy",
    currentProgramName: "Glute Specialization & Lower Body Sculpt",
    adherenceRate: 96,
    streakDays: 19,
    lastSessionDate: "Today, 08:30 AM",
    readinessScore: 82,
    fatigueRisk: "low",
    notes: ["Hip thrust 160kg PR reached. Left knee tracking stable."],
  },
  {
    id: "ath-5",
    name: "Dave Chen",
    initials: "DC",
    avatarAccent: "#FFB020",
    email: "dave.chen@techventures.co",
    tier: "pro",
    currentProgramId: "upper-lower-4x",
    currentProgramName: "4-Day Upper / Lower Split",
    adherenceRate: 72,
    streakDays: 3,
    lastSessionDate: "3 days ago",
    readinessScore: 68,
    fatigueRisk: "medium",
    notes: ["Missed Thursday Lower session due to late flight. Triggered rolling calendar slide."],
  },
  {
    id: "ath-6",
    name: "Priya Nair",
    initials: "PN",
    avatarAccent: "#2ED573",
    email: "priya.nair@biomech.ac.in",
    tier: "elite_coached",
    currentProgramId: "fullbody-novice",
    currentProgramName: "Full Body 3x Compound Foundation",
    adherenceRate: 100,
    streakDays: 24,
    lastSessionDate: "Today, 06:10 AM",
    readinessScore: 92,
    fatigueRisk: "low",
    notes: ["Perfect 3x weekly compliance. Overhead press form check passed cleanly."],
  },
];

export const INITIAL_GYM_FACILITY: GymFacility = {
  id: "gym-blr-01",
  name: "FORGE Iron & Performance Club",
  city: "Indiranagar, Bengaluru",
  maxCapacity: 75,
  currentOccupancy: 46,
  equipmentStations: [
    { id: "st-1", name: "Squat Racks & Olympic Platforms", totalUnits: 4, inUseUnits: 4, category: "barbell" },
    { id: "st-2", name: "Competition Bench Press Racks", totalUnits: 4, inUseUnits: 3, category: "barbell" },
    { id: "st-3", name: "Dual Adjustable Cable Towers", totalUnits: 6, inUseUnits: 5, category: "cable" },
    { id: "st-4", name: "Hammer Strength Plate Loaded", totalUnits: 8, inUseUnits: 5, category: "machine" },
    { id: "st-5", name: "Dumbbell & Adjustable Benches", totalUnits: 12, inUseUnits: 8, category: "free-weight" },
    { id: "st-6", name: "Deadlift Dead-Bounce Platforms", totalUnits: 3, inUseUnits: 3, category: "barbell" },
  ],
};

export const INITIAL_CHECK_INS: GymMemberCheckIn[] = [
  { id: "chk-01", memberId: "ath-1", memberName: "Vikram Sharma", planName: "Annual Black Tier", checkedInAt: "07:15 AM", status: "active" },
  { id: "chk-02", memberId: "ath-4", memberName: "Ananya Patel", planName: "Gold All-Access", checkedInAt: "08:30 AM", status: "active" },
  { id: "chk-03", memberId: "ath-6", memberName: "Priya Nair", planName: "Student Athlete Pass", checkedInAt: "06:10 AM", status: "active" },
  { id: "chk-04", memberId: "ath-99", memberName: "Rohan Gupta", planName: "Monthly Standard", checkedInAt: "08:42 AM", status: "active" },
  { id: "chk-05", memberId: "ath-102", memberName: "Tara Deshmukh", planName: "Guest Pass (Day 1/3)", checkedInAt: "08:55 AM", status: "guest_pass" },
];

export const INITIAL_GYM_FINANCIALS: GymFinancialMetrics = {
  totalMembers: 412,
  activeMembers: 368,
  monthlyRecurringRevenueINR: 588000, // ₹5.88L/month
  monthlyRecurringRevenueUSD: 7080,   // $7,080/month
  churnRatePercent: 1.8,
  avgSessionsPerMemberMonth: 14.6,
};
