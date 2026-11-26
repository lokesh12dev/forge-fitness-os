"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Dumbbell,
  Flame,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  GymFacility,
  GymMemberCheckIn,
  GymMemberRecord,
  INITIAL_CHECK_INS,
  INITIAL_GYM_FACILITY,
  INITIAL_GYM_FINANCIALS,
  INITIAL_GYM_MEMBERS,
  MEMBERSHIP_TIER_REVENUE,
  PEAK_HOURS_HEATMAP,
  calculateEquipmentBottleneck,
  calculateGymOccupancyRate,
  computeLiveGymFinancials,
  createNewGymMember,
  evaluateMembershipRenewal,
  processMemberCheckIn,
  renewMemberPlan,
  verifyQrBadgeScan,
  type QrScanResult,
} from "@/lib/b2b-portal";
import { recordGymFloorCheckIn, syncGymFacilityMetrics } from "@/app/actions";
import { Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "forge_gym_portal_v1";
const CROWDED_MODE_KEY = "forge_crowded_gym_mode";

export type GymDbFacilitySeed = {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  busyness: number;
  accent: string;
};

type GymClientProps = {
  currentUser?: {
    id: string;
    name: string;
    initials: string;
    accent: string;
  };
  dbGyms?: GymDbFacilitySeed[];
  dbCheckins?: GymMemberCheckIn[];
  referenceDateKey?: string;
};

type PersistedGymState = {
  facility: GymFacility;
  checkIns: GymMemberCheckIn[];
  members: GymMemberRecord[];
  crowdedSwapsEnabled: boolean;
  selectedHourIdx: number;
  selectedDbGymId: string;
};

const PLAN_PRICING_INR: Record<string, number> = {
  "Annual Black Tier": 2499,
  "Gold All-Access": 1799,
  "Monthly Standard": 1499,
  "Student & Day Passes": 899,
};

function mergeCheckIns(dbCheckins: GymMemberCheckIn[], seedCheckins: GymMemberCheckIn[]): GymMemberCheckIn[] {
  const seen = new Set<string>();
  const combined: GymMemberCheckIn[] = [];
  for (const row of [...dbCheckins, ...seedCheckins]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    combined.push(row);
  }
  return combined.slice(0, 40);
}

export function GymClient({
  currentUser,
  dbGyms = [],
  dbCheckins = [],
  referenceDateKey = "2026-11-26",
}: GymClientProps) {
  const refDate = useMemo(() => new Date(`${referenceDateKey}T12:00:00Z`), [referenceDateKey]);
  const primaryDbGym = dbGyms[0];

  const initialFacility: GymFacility = useMemo(() => {
    if (!primaryDbGym) return INITIAL_GYM_FACILITY;
    const derivedOccupancy = Math.max(
      12,
      Math.min(
        INITIAL_GYM_FACILITY.maxCapacity,
        Math.round((primaryDbGym.busyness / 100) * INITIAL_GYM_FACILITY.maxCapacity)
      )
    );
    return {
      ...INITIAL_GYM_FACILITY,
      id: primaryDbGym.id,
      name: primaryDbGym.name,
      city: primaryDbGym.city,
      currentOccupancy: derivedOccupancy,
    };
  }, [primaryDbGym]);

  const initialMergedCheckIns = useMemo(
    () => mergeCheckIns(dbCheckins, INITIAL_CHECK_INS),
    [dbCheckins]
  );

  const [selectedDbGymId, setSelectedDbGymId] = useState<string>(primaryDbGym?.id ?? INITIAL_GYM_FACILITY.id);
  const [facility, setFacility] = useState<GymFacility>(initialFacility);
  const [checkIns, setCheckIns] = useState<GymMemberCheckIn[]>(initialMergedCheckIns);
  const [members, setMembers] = useState<GymMemberRecord[]>(INITIAL_GYM_MEMBERS);
  const [crowdedSwapsEnabled, setCrowdedSwapsEnabled] = useState<boolean>(false);

  // Front Desk Kiosk mode (QR Badge Scanner vs Manual Check-In)
  const [kioskMode, setKioskMode] = useState<"qr" | "manual">("qr");
  const [qrInput, setQrInput] = useState("FRG-1001");
  const [lastScan, setLastScan] = useState<QrScanResult | null>(() =>
    verifyQrBadgeScan("FRG-1001", INITIAL_GYM_MEMBERS, new Date("2026-11-26T12:00:00Z"))
  );
  const [newMemberName, setNewMemberName] = useState("");
  const [newPlanName, setNewPlanName] = useState("Gold All-Access");

  // Register Member Modal state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPlan, setRegPlan] = useState("Gold All-Access");
  const [regMonths, setRegMonths] = useState(3);

  // Heatmap hover/focus slot
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(8);

  // Member Directory filter
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "expiring_soon" | "expired">("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncingDb, startTransition] = useTransition();
  const hydratedRef = useRef(false);

  // Hydrate persisted floor/member operations from localStorage cleanly after SSR mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const savedCrowded = localStorage.getItem(CROWDED_MODE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedGymState>;
        if (parsed.facility) setFacility(parsed.facility);
        if (Array.isArray(parsed.checkIns) && parsed.checkIns.length > 0) {
          setCheckIns(mergeCheckIns(dbCheckins, parsed.checkIns));
        }
        if (Array.isArray(parsed.members) && parsed.members.length > 0) {
          setMembers(parsed.members);
          setLastScan((prev) =>
            prev?.member
              ? verifyQrBadgeScan(prev.member.qrBadgeCode, parsed.members!, refDate)
              : verifyQrBadgeScan("FRG-1001", parsed.members!, refDate)
          );
        }
        if (typeof parsed.crowdedSwapsEnabled === "boolean") {
          setCrowdedSwapsEnabled(parsed.crowdedSwapsEnabled);
        }
        if (typeof parsed.selectedHourIdx === "number") {
          setSelectedHourIdx(parsed.selectedHourIdx);
        }
        if (typeof parsed.selectedDbGymId === "string" && parsed.selectedDbGymId) {
          setSelectedDbGymId(parsed.selectedDbGymId);
        }
      } else if (savedCrowded === "1") {
        setCrowdedSwapsEnabled(true);
      }
    } catch {}
    hydratedRef.current = true;
  }, [dbCheckins, refDate]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const payload: PersistedGymState = {
        facility,
        checkIns,
        members,
        crowdedSwapsEnabled,
        selectedHourIdx,
        selectedDbGymId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(CROWDED_MODE_KEY, crowdedSwapsEnabled ? "1" : "0");
    } catch {}
  }, [facility, checkIns, members, crowdedSwapsEnabled, selectedHourIdx, selectedDbGymId]);

  const occupancy = calculateGymOccupancyRate(facility.currentOccupancy, facility.maxCapacity);
  const bottleneck = calculateEquipmentBottleneck(facility.equipmentStations);

  const liveStats = useMemo(
    () =>
      computeLiveGymFinancials(
        INITIAL_GYM_FINANCIALS,
        MEMBERSHIP_TIER_REVENUE,
        members,
        INITIAL_GYM_MEMBERS,
        refDate
      ),
    [members, refDate]
  );

  const financials = liveStats.financials;
  const tierRows = liveStats.tierRows;

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const syncBusynessToDb = (nextOcc: number, cap: number, memberCount?: number) => {
    if (!dbGyms.length) return;
    const pct = cap > 0 ? Math.round((nextOcc / cap) * 100) : 50;
    startTransition(async () => {
      try {
        await syncGymFacilityMetrics({
          gymId: selectedDbGymId,
          occupancyPct: pct,
          memberCount,
        });
      } catch {}
    });
  };

  const handleSelectDbFacility = (gymId: string) => {
    setSelectedDbGymId(gymId);
    const chosen = dbGyms.find((g) => g.id === gymId);
    if (!chosen) return;
    const nextOcc = Math.max(
      8,
      Math.min(facility.maxCapacity, Math.round((chosen.busyness / 100) * facility.maxCapacity))
    );
    setFacility((prev) => ({
      ...prev,
      id: chosen.id,
      name: chosen.name,
      city: chosen.city,
      currentOccupancy: nextOcc,
    }));
    notify(`Switched floor telemetry to ${chosen.name}`);
  };

  const handleQuickSelfCheckIn = () => {
    if (!currentUser) return;
    const { checkIns: updatedCheckIns, newOccupancy } = processMemberCheckIn(
      checkIns,
      {
        memberId: currentUser.id,
        memberName: currentUser.name,
        planName: "Annual Black Tier (Owner/Athlete)",
        status: "active",
      },
      facility.currentOccupancy
    );
    const clampedOcc = Math.min(facility.maxCapacity, newOccupancy);
    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: clampedOcc }));
    const occPct = Math.round((clampedOcc / Math.max(1, facility.maxCapacity)) * 100);
    startTransition(async () => {
      try {
        await recordGymFloorCheckIn({
          gymId: selectedDbGymId,
          memberName: currentUser.name,
          planName: "Annual Black Tier",
          note: `Checked in at ${facility.name}`,
          occupancyPct: occPct,
        });
      } catch {}
    });
    notify(`DB Check-In logged for ${currentUser.name} at ${facility.name}`);
  };

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const cleanName = newMemberName.trim();

    const { checkIns: updatedCheckIns, newOccupancy } = processMemberCheckIn(
      checkIns,
      {
        memberId: `walkin-${Date.now()}`,
        memberName: cleanName,
        planName: newPlanName,
        status: newPlanName.includes("Guest") || newPlanName.includes("Day") ? "guest_pass" : "active",
      },
      facility.currentOccupancy
    );

    const clampedOcc = Math.min(facility.maxCapacity, newOccupancy);
    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: clampedOcc }));

    const occPct = Math.round((clampedOcc / Math.max(1, facility.maxCapacity)) * 100);
    startTransition(async () => {
      try {
        await recordGymFloorCheckIn({
          gymId: selectedDbGymId,
          memberName: cleanName,
          planName: newPlanName,
          note: `Front desk manual check-in: ${cleanName} (${newPlanName})`,
          occupancyPct: occPct,
        });
      } catch {}
    });

    notify(`Checked in ${cleanName} (${newPlanName})!`);
    setNewMemberName("");
  };

  const handleQrScan = (badgeCode: string) => {
    setQrInput(badgeCode);
    const result = verifyQrBadgeScan(badgeCode, members, refDate);
    setLastScan(result);
  };

  const handleQrAdmit = () => {
    if (!lastScan?.matched || !lastScan.member || !lastScan.canEnter) return;
    const m = lastScan.member;
    const { checkIns: updatedCheckIns, newOccupancy } = processMemberCheckIn(
      checkIns,
      {
        memberId: m.id,
        memberName: m.name,
        planName: m.planName,
        status: lastScan.status === "guest_pass" ? "guest_pass" : "active",
      },
      facility.currentOccupancy
    );

    const clampedOcc = Math.min(facility.maxCapacity, newOccupancy);
    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: clampedOcc }));
    setMembers((prev) =>
      prev.map((row) =>
        row.id === m.id
          ? {
              ...row,
              sessionsThisMonth: row.sessionsThisMonth + 1,
              lastCheckIn: "Just now",
            }
          : row
      )
    );

    const occPct = Math.round((clampedOcc / Math.max(1, facility.maxCapacity)) * 100);
    startTransition(async () => {
      try {
        await recordGymFloorCheckIn({
          gymId: selectedDbGymId,
          memberName: m.name,
          planName: m.planName,
          note: `QR Turnstile ${m.qrBadgeCode} · ${m.name}`,
          occupancyPct: occPct,
        });
      } catch {}
    });

    notify(`QR Check-In: ${m.name} (${m.qrBadgeCode}) admitted to floor.`);
  };

  const handleRenewMember = (memberId: string, months: number) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    const renewedRecord = renewMemberPlan(targetMember, targetMember.planName, months, refDate);
    const nextMembers = members.map((m) => (m.id === memberId ? renewedRecord : m));

    setMembers(nextMembers);

    if (
      lastScan?.member?.id === memberId ||
      qrInput.trim().toUpperCase() === renewedRecord.qrBadgeCode.toUpperCase()
    ) {
      setLastScan(verifyQrBadgeScan(renewedRecord.qrBadgeCode, nextMembers, refDate));
    }

    notify(
      `Renewed ${targetMember.name} by ${months === 12 ? "1 year" : `${months} month(s)`} · active through ${renewedRecord.expiryDate}`
    );
  };

  const handleRegisterMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;
    const fee = PLAN_PRICING_INR[regPlan] ?? 1499;
    const created = createNewGymMember(
      {
        name: regName,
        phone: regPhone,
        planName: regPlan,
        monthlyFeeINR: fee,
        months: regMonths,
        existingCount: members.length,
      },
      refDate
    );

    const nextMembers = [created, ...members];
    setMembers(nextMembers);
    setQrInput(created.qrBadgeCode);
    setLastScan(verifyQrBadgeScan(created.qrBadgeCode, nextMembers, refDate));
    setRegisterModalOpen(false);
    setRegName("");
    setRegPhone("");

    syncBusynessToDb(facility.currentOccupancy, facility.maxCapacity, financials.totalMembers + 1);
    notify(`Registered ${created.name} · Badge ${created.qrBadgeCode} unlocked!`);
  };

  const handleWhatsAppMemberSummary = (member: GymMemberRecord) => {
    const renewal = evaluateMembershipRenewal(member.expiryDate, refDate);
    const statusLine =
      renewal.status === "expired"
        ? `Membership Expired (${Math.abs(renewal.daysLeft)}d ago) — Tap front desk to renew!`
        : renewal.status === "expiring_soon"
        ? `Plan expires in ${renewal.daysLeft} days (${member.expiryDate})`
        : `Plan active until ${member.expiryDate}`;

    const text = `🏋️ *${facility.name} — Member Progress Card*\n👤 Member: *${member.name}* (${member.qrBadgeCode})\n📋 Plan: ${member.planName}\n🔥 Current Streak: *${member.streakDays} days*\n📆 Sessions This Month: *${member.sessionsThisMonth}*\n💪 Latest Workout: ${member.lastWorkoutName}\n📌 Status: ${statusLine}\n\nKeep showing up! · Powered by FORGE`;

    if (typeof window !== "undefined") {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    }
    notify(`Opened WhatsApp summary for ${member.name}.`);
  };

  const toggleEquipmentUnit = (stationId: string, delta: number) => {
    const updatedStations = facility.equipmentStations.map((st) => {
      if (st.id === stationId) {
        const nextInUse = Math.max(0, Math.min(st.totalUnits, st.inUseUnits + delta));
        return { ...st, inUseUnits: nextInUse };
      }
      return st;
    });
    const nextOcc = Math.max(0, Math.min(facility.maxCapacity, facility.currentOccupancy + delta));
    setFacility((prev) => ({
      ...prev,
      currentOccupancy: nextOcc,
      equipmentStations: updatedStations,
    }));
    syncBusynessToDb(nextOcc, facility.maxCapacity);
  };

  const adjustFloorHeadcount = (delta: number) => {
    const nextOcc = Math.max(0, Math.min(facility.maxCapacity, facility.currentOccupancy + delta));
    setFacility((prev) => ({ ...prev, currentOccupancy: nextOcc }));
    syncBusynessToDb(nextOcc, facility.maxCapacity);
  };

  const toggleCrowdedSwaps = () => {
    setCrowdedSwapsEnabled((prev) => {
      const next = !prev;
      notify(
        next
          ? "Crowded Gym Auto-Swaps enabled! Lifters receive rack/bench alternatives."
          : "Crowded Gym Auto-Swaps paused — back to normal equipment flow."
      );
      return next;
    });
  };

  const handleResetDemo = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CROWDED_MODE_KEY);
    } catch {}
    setFacility(initialFacility);
    setCheckIns(initialMergedCheckIns);
    setMembers(INITIAL_GYM_MEMBERS);
    setCrowdedSwapsEnabled(false);
    setQrInput("FRG-1001");
    setLastScan(verifyQrBadgeScan("FRG-1001", INITIAL_GYM_MEMBERS, refDate));
    setSelectedHourIdx(8);
    notify("Floor ops reset to live SQLite baseline.");
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesQ =
        m.name.toLowerCase().includes(memberQuery.toLowerCase()) ||
        m.qrBadgeCode.toLowerCase().includes(memberQuery.toLowerCase()) ||
        m.planName.toLowerCase().includes(memberQuery.toLowerCase());
      if (!matchesQ) return false;
      if (memberFilter === "all") return true;
      return evaluateMembershipRenewal(m.expiryDate, refDate).status === memberFilter;
    });
  }, [members, memberQuery, memberFilter, refDate]);

  const maxTierRevenue = Math.max(...tierRows.map((t) => t.mrrINR), 1);
  const focusedHour = PEAK_HOURS_HEATMAP[selectedHourIdx] ?? PEAK_HOURS_HEATMAP[0];
  const crowdedActive = crowdedSwapsEnabled || bottleneck.isCrowded;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] flex items-center gap-2.5 rounded-2xl border border-acid/30 bg-ink-2/95 px-4 py-3 shadow-2xl backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:max-w-md">
          <CheckCircle2 className="size-4 text-acid shrink-0" />
          <span className="text-[12.5px] font-medium text-chalk">{toastMessage}</span>
        </div>
      )}

      {/* Facility Control Bar (DB Club Switcher + Quick Check-In + Reset) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-wider text-dim">Facility:</span>
          {dbGyms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {dbGyms.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectDbFacility(g.id)}
                  className={cn(
                    "rounded-xl border px-2.5 py-1 font-mono text-[9.5px] transition-colors",
                    selectedDbGymId === g.id
                      ? "border-acid/60 bg-acid/15 text-acid font-bold"
                      : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk"
                  )}
                >
                  {g.name} ({g.busyness}%)
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[12px] font-semibold text-chalk">{facility.name}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {currentUser && (
            <Button size="sm" onClick={handleQuickSelfCheckIn} disabled={isSyncingDb}>
              <Zap className="size-3.5" /> Quick Check-In ({currentUser.name.split(" ")[0]})
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setRegisterModalOpen(true)}>
            <UserPlus className="size-3.5" /> Register Member
          </Button>
          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-wider text-dim hover:border-white/25 hover:text-chalk transition-colors"
            title="Reset floor changes back to DB baseline"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        </div>
      </div>

      {/* Facility Header & Live Occupancy Gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1.5">
                <Building2 className="size-3" /> Facility Live Feed
              </span>
              <h2 className="text-xl font-bold text-chalk mt-0.5">{facility.name}</h2>
              <p className="text-[11px] text-dim">{facility.city}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => adjustFloorHeadcount(-1)}
                  disabled={facility.currentOccupancy <= 0}
                  aria-label="Decrease floor occupancy"
                  className="grid size-6 place-items-center rounded-lg bg-white/5 text-mist hover:text-chalk disabled:opacity-30"
                >
                  -
                </button>
                <span className="px-1.5 font-mono text-[9px] text-dim">Floor</span>
                <button
                  type="button"
                  onClick={() => adjustFloorHeadcount(1)}
                  disabled={facility.currentOccupancy >= facility.maxCapacity}
                  aria-label="Increase floor occupancy"
                  className="grid size-6 place-items-center rounded-lg bg-white/5 text-mist hover:text-chalk disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider font-bold ${
                  occupancy.status === "at_capacity"
                    ? "bg-red-500/20 text-red-400"
                    : occupancy.status === "crowded"
                    ? "bg-flame/20 text-flame"
                    : occupancy.status === "busy"
                    ? "bg-amber-400/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                ● {occupancy.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-numeric text-3xl font-extrabold text-chalk">
                  {facility.currentOccupancy}
                </span>
                <span className="text-sm text-dim"> / {facility.maxCapacity} members on floor</span>
              </div>
              <span className="font-mono text-sm font-bold text-acid">{occupancy.ratePct}% load</span>
            </div>

            <ProgressBar
              value={occupancy.ratePct}
              color={
                occupancy.ratePct >= 90
                  ? "#FF5E5B"
                  : occupancy.ratePct >= 75
                  ? "#FFB020"
                  : "#C9F73A"
              }
            />

            <div className="flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-dim pt-1">
              <span>0 (Empty)</span>
              <span>{Math.round(facility.maxCapacity / 2)} (Half Floor)</span>
              <span>{facility.maxCapacity} (Max Fire Limit)</span>
            </div>
          </div>

          {crowdedActive && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3 text-flame">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert className="size-4 shrink-0" />
                <p className="text-[11.5px]">
                  <strong>{crowdedSwapsEnabled ? "Crowded Swaps Active:" : "Congestion Warning:"}</strong>{" "}
                  {bottleneck.mostCongested} at <strong>{bottleneck.congestionRate}% utilization</strong>.{" "}
                  {crowdedSwapsEnabled
                    ? "Alternative equipment swaps unlocked for lifters."
                    : "Crowded Gym auto-swaps ready for busy rack stations."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleCrowdedSwaps}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider font-bold transition-colors",
                    crowdedSwapsEnabled
                      ? "border-acid bg-acid text-ink"
                      : "border-flame/40 bg-flame/15 text-flame hover:bg-flame hover:text-ink"
                  )}
                >
                  {crowdedSwapsEnabled ? "Auto-Swaps ON ✓" : "Activate Auto-Swaps"}
                </button>
                <Link
                  href="/app/train"
                  className="rounded-lg border border-white/15 bg-black/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-chalk hover:border-acid hover:text-acid"
                >
                  Workout Floor →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Financial / Membership Snapshot */}
        <div className="flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-dim flex items-center gap-1.5">
              <DollarSign className="size-3 text-emerald-400" /> Revenue &amp; Retention
            </span>
            <div className="mt-2 space-y-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Monthly Revenue</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-numeric text-2xl font-bold text-chalk">
                    ₹{(financials.monthlyRecurringRevenueINR / 100000).toFixed(2)}L
                  </span>
                  <span className="font-mono text-xs text-mist">
                    (${financials.monthlyRecurringRevenueUSD.toLocaleString()})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Active Members</p>
                  <p className="font-numeric text-lg font-bold text-chalk mt-0.5">
                    {financials.activeMembers} <span className="text-[10px] text-dim">/ {financials.totalMembers}</span>
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Monthly Churn</p>
                  <p className="font-numeric text-lg font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <TrendingDown className="size-3.5" /> {financials.churnRatePercent}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Avg Frequency</span>
            <p className="text-[11px] text-mist mt-0.5">
              <strong className="text-chalk">{financials.avgSessionsPerMemberMonth} sessions/mo</strong> per active member
            </p>
          </div>
        </div>
      </div>

      {/* Membership Tier Revenue Breakdown + Peak Hours Heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tier Revenue Breakdown */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1.5">
                <BarChart3 className="size-3" /> Revenue Split
              </span>
              <h3 className="text-sm font-bold text-chalk mt-0.5">Membership Tier Breakdown</h3>
            </div>
            <span className="font-mono text-[9px] text-dim">
              {financials.activeMembers} billed plans
            </span>
          </div>

          <div className="space-y-3">
            {tierRows.map((row) => {
              const widthPct = Math.round((row.mrrINR / maxTierRevenue) * 100);
              const sharePct = Math.round((row.mrrINR / Math.max(1, financials.monthlyRecurringRevenueINR)) * 100);
              return (
                <div key={row.tierName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-medium text-chalk truncate">{row.tierName}</span>
                      <span className="font-mono text-[9px] text-dim shrink-0">({row.members} members)</span>
                    </div>
                    <div className="text-right font-mono text-[10.5px] shrink-0">
                      <span className="text-chalk font-bold">₹{row.mrrINR.toLocaleString()}</span>
                      <span className="text-dim ml-1.5">· {sharePct}%</span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${widthPct}%`, backgroundColor: row.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Hours Floor Heatmap */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Activity className="size-3" /> Attendance Density
              </span>
              <h3 className="text-sm font-bold text-chalk mt-0.5">Peak Hours Floor Heatmap</h3>
            </div>
            <span className="font-mono text-[9px] text-dim">Click bar for load details</span>
          </div>

          <div className="grid grid-cols-12 items-end gap-1.5 h-36 pt-2">
            {PEAK_HOURS_HEATMAP.map((slot, idx) => {
              const selected = idx === selectedHourIdx;
              const isPeak = slot.occupancyPct >= 85;
              const isBusy = slot.occupancyPct >= 65 && !isPeak;
              const barColor = isPeak ? "#FF5E5B" : isBusy ? "#FFB020" : "#C9F73A";
              return (
                <button
                  key={slot.hourLabel}
                  type="button"
                  onClick={() => setSelectedHourIdx(idx)}
                  className="group flex h-full flex-col items-center justify-end gap-1 focus:outline-none"
                  title={`${slot.hourLabel}: ${slot.occupancyPct}% (${slot.avgMembers} members)`}
                >
                  <span
                    className={cn(
                      "font-numeric text-[8px] transition-opacity",
                      selected ? "text-chalk font-bold opacity-100" : "text-dim opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {slot.occupancyPct}%
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      selected ? "ring-2 ring-white/60" : "opacity-85 group-hover:opacity-100"
                    )}
                    style={{
                      height: `${Math.max(12, slot.occupancyPct)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  <span
                    className={cn(
                      "font-mono text-[7.5px]",
                      selected ? "text-acid font-bold" : "text-dim"
                    )}
                  >
                    {slot.hourLabel.replace(" ", "")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-mist">
              {focusedHour.hourLabel} Window
            </span>
            <span className="font-numeric text-chalk font-semibold">
              ~{focusedHour.avgMembers} athletes ({focusedHour.occupancyPct}% capacity)
            </span>
            <button
              type="button"
              onClick={toggleCrowdedSwaps}
              className={cn(
                "rounded-lg border px-2 py-0.5 font-mono text-[8.5px] font-bold transition-colors",
                crowdedSwapsEnabled
                  ? "border-acid bg-acid text-ink"
                  : focusedHour.occupancyPct >= 85
                  ? "border-acid/40 bg-acid/10 text-acid hover:bg-acid hover:text-ink"
                  : "border-white/15 bg-white/[0.04] text-mist hover:text-chalk"
              )}
            >
              {crowdedSwapsEnabled
                ? "Crowded Swaps: ON ✓"
                : focusedHour.occupancyPct >= 85
                ? "Enable Crowded Swaps"
                : "Crowded Swaps: Ready"}
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Equipment Utilization Grid */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-chalk flex items-center gap-1.5">
              <Dumbbell className="size-4 text-acid" /> Real-Time Equipment Utilization
            </h3>
            <p className="text-[11px] text-dim">Live station occupancy sensor feed</p>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
            Tap +/- to calibrate sensors (syncs floor load)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facility.equipmentStations.map((st) => {
            const usagePct = Math.round((st.inUseUnits / st.totalUnits) * 100);
            const isFull = st.inUseUnits === st.totalUnits;
            return (
              <div
                key={st.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[12.5px] font-semibold text-chalk">{st.name}</h4>
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
                      {st.category}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      isFull ? "text-flame" : usagePct >= 75 ? "text-amber-300" : "text-acid"
                    }`}
                  >
                    {st.inUseUnits} / {st.totalUnits}
                  </span>
                </div>

                <ProgressBar value={usagePct} color={isFull ? "#FF5E5B" : usagePct >= 75 ? "#FFB020" : "#C9F73A"} />

                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[8.5px] text-dim">{usagePct}% occupied</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEquipmentUnit(st.id, -1)}
                      disabled={st.inUseUnits <= 0}
                      aria-label={`Free one ${st.name}`}
                      className="grid size-6 place-items-center rounded-lg bg-white/5 text-mist hover:text-chalk disabled:opacity-30"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEquipmentUnit(st.id, 1)}
                      disabled={st.inUseUnits >= st.totalUnits}
                      aria-label={`Occupy one ${st.name}`}
                      className="grid size-6 place-items-center rounded-lg bg-white/5 text-mist hover:text-chalk disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member Attendance & Fast Check-In Terminal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Fast Check-In Kiosk with QR Badge Scanner */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
              <QrCode className="size-3" /> Front Desk Kiosk
            </span>
            <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setKioskMode("qr")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[8.5px] uppercase transition-colors",
                  kioskMode === "qr" ? "bg-acid text-ink font-bold" : "text-dim hover:text-mist"
                )}
              >
                QR Scan
              </button>
              <button
                type="button"
                onClick={() => setKioskMode("manual")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[8.5px] uppercase transition-colors",
                  kioskMode === "manual" ? "bg-acid text-ink font-bold" : "text-dim hover:text-mist"
                )}
              >
                Manual
              </button>
            </div>
          </div>

          <h3 className="text-base font-bold text-chalk">
            {kioskMode === "qr" ? "QR Badge Turnstile" : "Quick Member Check-In"}
          </h3>
          <p className="text-[11px] text-dim mb-4">
            {kioskMode === "qr" ? "Scan member pass or test badge IDs below" : "Manual override for guests & walk-ins"}
          </p>

          {kioskMode === "qr" ? (
            <div className="space-y-3">
              {/* Visual Optical Scanner Viewport */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-4 flex items-center gap-3.5">
                <div className="relative grid size-16 shrink-0 place-items-center rounded-xl border border-acid/40 bg-acid/[0.06]">
                  <QrCode className="size-9 text-acid" />
                  <div className="pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-acid shadow-[0_0_8px_#C9F73A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="block font-mono text-[8px] uppercase tracking-wider text-dim mb-1">
                    Badge Code / Member Name
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={qrInput}
                      onChange={(e) => handleQrScan(e.target.value)}
                      placeholder="FRG-1001"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 font-mono text-[11.5px] uppercase text-chalk focus:border-acid focus:outline-none"
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[
                      { code: "FRG-1001", label: "Active" },
                      { code: "FRG-1004", label: "Expiring" },
                      { code: "FRG-1005", label: "Expired" },
                    ].map((preset) => (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => handleQrScan(preset.code)}
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[8px] transition-colors",
                          qrInput.toUpperCase() === preset.code
                            ? "border-acid/50 bg-acid/15 text-acid font-bold"
                            : "border-white/10 text-dim hover:text-chalk"
                        )}
                      >
                        {preset.code} ({preset.label})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scan Decision Panel */}
              {lastScan && (
                <div
                  className={cn(
                    "rounded-2xl border p-3 text-[11px] space-y-2",
                    lastScan.status === "active"
                      ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
                      : lastScan.status === "expiring_soon"
                      ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-200"
                      : "border-flame/30 bg-flame/[0.08] text-flame"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider font-bold flex items-center gap-1">
                      <ScanLine className="size-3" />
                      {lastScan.canEnter ? "Gate Unlocked" : "Access Hold"}
                    </span>
                    {lastScan.member && (
                      <span className="font-mono text-[8.5px] opacity-80">
                        Streak: {lastScan.member.streakDays}d
                      </span>
                    )}
                  </div>
                  <p className="leading-snug">{lastScan.reason}</p>

                  {lastScan.matched && lastScan.member && (
                    <div className="pt-1 flex gap-2">
                      {lastScan.canEnter ? (
                        <Button size="sm" className="w-full" onClick={handleQrAdmit}>
                          <CheckCircle2 className="size-3.5" /> Admit {lastScan.member.name.split(" ")[0]}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => handleRenewMember(lastScan.member!.id, 1)}
                        >
                          <RefreshCw className="size-3.5" /> Renew +1 Month &amp; Unlock
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualCheckIn} className="space-y-3">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-wider text-mist mb-1">
                  Member Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arjun Patel"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase tracking-wider text-mist mb-1">
                  Membership Tier
                </label>
                <select
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                >
                  <option value="Gold All-Access" className="bg-ink-2 text-chalk">Gold All-Access</option>
                  <option value="Annual Black Tier" className="bg-ink-2 text-chalk">Annual Black Tier</option>
                  <option value="Monthly Standard" className="bg-ink-2 text-chalk">Monthly Standard</option>
                  <option value="Student & Day Passes" className="bg-ink-2 text-chalk">Student &amp; Day Passes</option>
                  <option value="Day Pass (Guest)" className="bg-ink-2 text-chalk">Day Pass (Guest)</option>
                </select>
              </div>

              <Button type="submit" size="md" className="w-full mt-2">
                <Plus className="size-3.5" /> Check-In Member
              </Button>
            </form>
          )}
        </div>

        {/* Live Attendance Stream */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-chalk flex items-center gap-1.5">
                <Clock className="size-4 text-dim" /> Live Member Check-In Log
              </h3>
              <p className="text-[11px] text-dim">SQLite + turnstile real-time attendance ledger</p>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid">
              {checkIns.length} logged visits
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
            {checkIns.map((chk) => (
              <div
                key={chk.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[12px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 font-mono text-[11px] font-bold text-chalk">
                    {chk.memberName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-chalk truncate">{chk.memberName}</p>
                    <p className="font-mono text-[9px] text-dim truncate">{chk.planName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-dim">{chk.checkedInAt}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                      chk.status === "active"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {chk.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member Directory, Plan Renewal Tracker & WhatsApp Summaries */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1.5">
              <Users className="size-3" /> CRM &amp; Subscription Ledger · laragym &amp; gymsmart.in
            </span>
            <h3 className="text-base font-bold text-chalk mt-0.5">
              Member Renewals &amp; WhatsApp Workout Summaries
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "expiring_soon", label: "Expiring" },
                  { id: "expired", label: "Expired" },
                  { id: "active", label: "Active" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMemberFilter(f.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider border transition-colors",
                    memberFilter === f.id
                      ? "border-acid bg-acid text-ink font-bold"
                      : "border-white/10 text-mist hover:text-chalk"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-dim" />
              <input
                type="text"
                placeholder="Search name or QR ID..."
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-3 py-1.5 text-[11.5px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const renewal = evaluateMembershipRenewal(member.expiryDate, refDate);
            return (
              <div
                key={member.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleQrScan(member.qrBadgeCode)}
                          className="font-mono text-[9px] rounded bg-white/[0.06] px-1.5 py-0.5 text-acid hover:bg-acid/20 transition-colors"
                          title="Load badge into QR scanner"
                        >
                          {member.qrBadgeCode}
                        </button>
                        <span className="font-mono text-[9px] text-dim truncate">{member.phone}</span>
                      </div>
                      <h4 className="text-sm font-bold text-chalk mt-1 truncate">{member.name}</h4>
                      <p className="text-[11px] text-mist truncate">{member.planName}</p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider font-bold",
                        renewal.status === "expired"
                          ? "bg-flame/20 text-flame"
                          : renewal.status === "expiring_soon"
                          ? "bg-amber-400/20 text-amber-300"
                          : "bg-emerald-500/15 text-emerald-400"
                      )}
                    >
                      {renewal.status === "expired"
                        ? `Expired ${Math.abs(renewal.daysLeft)}d ago`
                        : renewal.status === "expiring_soon"
                        ? `${renewal.daysLeft}d left`
                        : "Active"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.05] bg-black/25 p-2.5 text-center">
                    <div>
                      <span className="font-mono text-[7.5px] uppercase text-dim block">Expires</span>
                      <span className="font-numeric text-[10.5px] font-semibold text-chalk">{member.expiryDate}</span>
                    </div>
                    <div>
                      <span className="font-mono text-[7.5px] uppercase text-dim block">Sessions/mo</span>
                      <span className="font-numeric text-[10.5px] font-semibold text-acid">{member.sessionsThisMonth}</span>
                    </div>
                    <div>
                      <span className="font-mono text-[7.5px] uppercase text-dim block">Streak</span>
                      <span className="font-numeric text-[10.5px] font-semibold text-flame flex items-center justify-center gap-0.5">
                        <Flame className="size-2.5" /> {member.streakDays}d
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => handleRenewMember(member.id, 1)}
                    className="press flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-acid/30 bg-acid/10 py-1.5 font-mono text-[9.5px] font-bold text-acid hover:bg-acid hover:text-ink transition-colors"
                  >
                    <Calendar className="size-3" /> Renew +1M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWhatsAppMemberSummary(member)}
                    className="press flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-mint/25 bg-mint/[0.08] py-1.5 font-mono text-[9.5px] font-bold text-mint hover:bg-mint/20 transition-colors"
                    title="Send WhatsApp workout summary"
                  >
                    <Share2 className="size-3" /> WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Register New Member Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
                  <Sparkles className="size-3" /> New Member Onboarding
                </span>
                <h2 className="text-lg font-bold text-chalk mt-0.5">Register Club Member</h2>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
                aria-label="Close member registration"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterMember} className="mt-4 space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Member Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Siddharth Rao"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Phone Number (WhatsApp Cards)
                </label>
                <input
                  type="text"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                    Plan Tier
                  </label>
                  <select
                    value={regPlan}
                    onChange={(e) => setRegPlan(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                  >
                    <option value="Gold All-Access" className="bg-ink-2 text-chalk">Gold All-Access (₹1,799)</option>
                    <option value="Annual Black Tier" className="bg-ink-2 text-chalk">Annual Black (₹2,499)</option>
                    <option value="Monthly Standard" className="bg-ink-2 text-chalk">Monthly Std (₹1,499)</option>
                    <option value="Student & Day Passes" className="bg-ink-2 text-chalk">Student Pass (₹899)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                    Billing Term
                  </label>
                  <select
                    value={regMonths}
                    onChange={(e) => setRegMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                  >
                    <option value={1} className="bg-ink-2 text-chalk">1 Month</option>
                    <option value={3} className="bg-ink-2 text-chalk">3 Months</option>
                    <option value={12} className="bg-ink-2 text-chalk">12 Months</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-3 text-[11px] text-mist">
                Auto-issues QR Badge <strong className="text-acid">FRG-{1001 + members.length}</strong> and updates monthly revenue split live.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setRegisterModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="md">
                  <UserPlus className="size-3.5" /> Issue Pass &amp; Activate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
