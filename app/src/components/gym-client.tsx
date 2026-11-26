"use client";

import { useMemo, useState } from "react";
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
  ScanLine,
  Search,
  Share2,
  ShieldAlert,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  GymFacility,
  GymFinancialMetrics,
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
  evaluateMembershipRenewal,
  processMemberCheckIn,
  renewMemberPlan,
  verifyQrBadgeScan,
  type QrScanResult,
} from "@/lib/b2b-portal";
import { Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

export function GymClient() {
  const [facility, setFacility] = useState<GymFacility>(INITIAL_GYM_FACILITY);
  const [checkIns, setCheckIns] = useState<GymMemberCheckIn[]>(INITIAL_CHECK_INS);
  const [financials, setFinancials] = useState<GymFinancialMetrics>(INITIAL_GYM_FINANCIALS);
  const [members, setMembers] = useState<GymMemberRecord[]>(INITIAL_GYM_MEMBERS);

  // Front Desk Kiosk mode (QR Badge Scanner vs Manual Check-In)
  const [kioskMode, setKioskMode] = useState<"qr" | "manual">("qr");
  const [qrInput, setQrInput] = useState("FRG-1001");
  const [lastScan, setLastScan] = useState<QrScanResult | null>(() =>
    verifyQrBadgeScan("FRG-1001", INITIAL_GYM_MEMBERS)
  );
  const [newMemberName, setNewMemberName] = useState("");
  const [newPlanName, setNewPlanName] = useState("Gold All-Access");

  // Heatmap hover/focus slot
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(8); // 07 PM peak slot

  // Member Directory filter
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "expiring_soon" | "expired">("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const occupancy = calculateGymOccupancyRate(facility.currentOccupancy, facility.maxCapacity);
  const bottleneck = calculateEquipmentBottleneck(facility.equipmentStations);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const { checkIns: updatedCheckIns, newOccupancy } = processMemberCheckIn(
      checkIns,
      {
        memberId: `ath-${Date.now()}`,
        memberName: newMemberName.trim(),
        planName: newPlanName,
        status: newPlanName.includes("Guest") ? "guest_pass" : "active",
      },
      facility.currentOccupancy
    );

    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: newOccupancy }));
    notify(`Checked in ${newMemberName.trim()} (${newPlanName})!`);
    setNewMemberName("");
  };

  const handleQrScan = (badgeCode: string) => {
    setQrInput(badgeCode);
    const result = verifyQrBadgeScan(badgeCode, members);
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

    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: newOccupancy }));
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
    notify(`QR Check-In: ${m.name} (${m.qrBadgeCode}) admitted to floor.`);
  };

  const handleRenewMember = (memberId: string, months: number) => {
    let targetName = "";
    let renewedRecord: GymMemberRecord | null = null;
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const wasExpired = evaluateMembershipRenewal(m.expiryDate).status === "expired";
        const updated = renewMemberPlan(m, m.planName, months);
        targetName = m.name;
        renewedRecord = updated;
        if (wasExpired) {
          setFinancials((fin) => ({
            ...fin,
            activeMembers: fin.activeMembers + 1,
            monthlyRecurringRevenueINR: fin.monthlyRecurringRevenueINR + m.monthlyFeeINR,
            monthlyRecurringRevenueUSD: fin.monthlyRecurringRevenueUSD + Math.round(m.monthlyFeeINR / 83),
          }));
        }
        return updated;
      })
    );
    if (renewedRecord && lastScan?.member?.id === memberId) {
      setLastScan(verifyQrBadgeScan((renewedRecord as GymMemberRecord).qrBadgeCode, [renewedRecord as GymMemberRecord]));
    }
    if (targetName) {
      notify(`Renewed ${targetName} by ${months === 12 ? "1 year" : `${months} month(s)`}!`);
    }
  };

  const handleWhatsAppMemberSummary = (member: GymMemberRecord) => {
    const renewal = evaluateMembershipRenewal(member.expiryDate);
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
    setFacility((prev) => {
      const updatedStations = prev.equipmentStations.map((st) => {
        if (st.id === stationId) {
          const nextInUse = Math.max(0, Math.min(st.totalUnits, st.inUseUnits + delta));
          return { ...st, inUseUnits: nextInUse };
        }
        return st;
      });
      return { ...prev, equipmentStations: updatedStations };
    });
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesQ =
        m.name.toLowerCase().includes(memberQuery.toLowerCase()) ||
        m.qrBadgeCode.toLowerCase().includes(memberQuery.toLowerCase()) ||
        m.planName.toLowerCase().includes(memberQuery.toLowerCase());
      if (!matchesQ) return false;
      if (memberFilter === "all") return true;
      return evaluateMembershipRenewal(m.expiryDate).status === memberFilter;
    });
  }, [members, memberQuery, memberFilter]);

  const maxTierRevenue = Math.max(...MEMBERSHIP_TIER_REVENUE.map((t) => t.mrrINR), 1);
  const focusedHour = PEAK_HOURS_HEATMAP[selectedHourIdx] ?? PEAK_HOURS_HEATMAP[0];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-acid/30 bg-ink-2/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="size-4 text-acid shrink-0" />
          <span className="text-[12.5px] font-medium text-chalk">{toastMessage}</span>
        </div>
      )}

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

            <div className="flex items-center gap-2">
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
              <span>38 (Half Floor)</span>
              <span>75 (Max Fire Limit)</span>
            </div>
          </div>

          {bottleneck.isCrowded && (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3 text-flame">
              <ShieldAlert className="size-4 shrink-0" />
              <p className="text-[11.5px]">
                <strong>Congestion Warning:</strong> {bottleneck.mostCongested} are currently at{" "}
                <strong>{bottleneck.congestionRate}% utilization</strong>. Crowded Gym auto-swaps are active for
                lifters logging sets.
              </p>
            </div>
          )}
        </div>

        {/* Financial / Membership Snapshot */}
        <div className="flex flex-col justify-between rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-dim flex items-center gap-1.5">
              <DollarSign className="size-3 text-emerald-400" /> Revenue & Retention
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
            {MEMBERSHIP_TIER_REVENUE.map((row) => {
              const widthPct = Math.round((row.mrrINR / maxTierRevenue) * 100);
              const sharePct = Math.round((row.mrrINR / INITIAL_GYM_FINANCIALS.monthlyRecurringRevenueINR) * 100);
              return (
                <div key={row.tierName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: row.color }} />
                      <span className="font-medium text-chalk">{row.tierName}</span>
                      <span className="font-mono text-[9px] text-dim">({row.members} members)</span>
                    </div>
                    <div className="font-numeric text-right">
                      <span className="font-semibold text-chalk">₹{(row.mrrINR / 1000).toFixed(1)}k</span>
                      <span className="ml-1.5 font-mono text-[9px] text-dim">{sharePct}%</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${widthPct}%`, background: row.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak Hours Utilization Heatmap */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-flame flex items-center gap-1.5">
                  <Activity className="size-3" /> Floor Traffic Analytics
                </span>
                <h3 className="text-sm font-bold text-chalk mt-0.5">Peak Hours Heatmap</h3>
              </div>
              <span className="rounded-full border border-flame/25 bg-flame/10 px-2.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-flame">
                Rush: 7 AM &amp; 7 PM
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12 items-end h-28 pt-2">
              {PEAK_HOURS_HEATMAP.map((slot, idx) => {
                const isSelected = selectedHourIdx === idx;
                const barColor =
                  slot.occupancyPct >= 85
                    ? "#FF5E5B"
                    : slot.occupancyPct >= 65
                    ? "#FFB020"
                    : slot.occupancyPct >= 40
                    ? "#7BE0AD"
                    : "#38BDF8";

                return (
                  <button
                    key={slot.hourLabel}
                    type="button"
                    onClick={() => setSelectedHourIdx(idx)}
                    onMouseEnter={() => setSelectedHourIdx(idx)}
                    className={cn(
                      "group flex flex-col items-center justify-end h-full rounded-lg p-1 transition-all",
                      isSelected ? "bg-white/[0.08] ring-1 ring-acid/40" : "hover:bg-white/[0.04]"
                    )}
                    title={`${slot.hourLabel}: ${slot.occupancyPct}% (${slot.avgMembers} members)`}
                  >
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className="w-full rounded-t-md transition-all duration-300"
                        style={{
                          height: `${Math.max(14, slot.occupancyPct)}%`,
                          background: barColor,
                          opacity: isSelected ? 1 : 0.72,
                        }}
                      />
                    </div>
                    <span className="mt-1.5 font-mono text-[7.5px] text-dim group-hover:text-chalk whitespace-nowrap">
                      {slot.hourLabel.replace(" ", "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-[11px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-mist">
              {focusedHour.hourLabel} Window
            </span>
            <span className="font-numeric text-chalk font-semibold">
              ~{focusedHour.avgMembers} athletes ({focusedHour.occupancyPct}% capacity)
            </span>
            <span className="font-mono text-[8.5px] text-acid">
              {focusedHour.occupancyPct >= 85 ? "Enable Crowded Swaps" : "Normal Flow"}
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Equipment Utilization Grid */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-chalk flex items-center gap-1.5">
              <Dumbbell className="size-4 text-acid" /> Real-Time Equipment Utilization
            </h3>
            <p className="text-[11px] text-dim">Live station occupancy sensor feed</p>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
            Tap +/- to calibrate sensors
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
                      onClick={() => toggleEquipmentUnit(st.id, -1)}
                      disabled={st.inUseUnits <= 0}
                      className="grid size-6 place-items-center rounded-lg bg-white/5 text-mist hover:text-chalk disabled:opacity-30"
                    >
                      -
                    </button>
                    <button
                      onClick={() => toggleEquipmentUnit(st.id, 1)}
                      disabled={st.inUseUnits >= st.totalUnits}
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
                  <option value="Student Athlete Pass" className="bg-ink-2 text-chalk">Student Athlete Pass</option>
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
              <p className="text-[11px] text-dim">Real-time attendance ledger</p>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid">
              {checkIns.length} total today
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
            {checkIns.map((chk) => (
              <div
                key={chk.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-[12px]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-full bg-white/5 font-mono text-[11px] font-bold text-chalk">
                    {chk.memberName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-chalk">{chk.memberName}</p>
                    <p className="font-mono text-[9px] text-dim">{chk.planName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
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

      {/* Member Directory, Plan Renewal Tracker & WhatsApp Summaries (laragym + gymsmart.in) */}
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
            const renewal = evaluateMembershipRenewal(member.expiryDate);
            return (
              <div
                key={member.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] rounded bg-white/[0.06] px-1.5 py-0.5 text-dim">
                          {member.qrBadgeCode}
                        </span>
                        <span className="font-mono text-[9px] text-dim">{member.phone}</span>
                      </div>
                      <h4 className="text-sm font-bold text-chalk mt-1">{member.name}</h4>
                      <p className="text-[11px] text-mist">{member.planName}</p>
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
    </div>
  );
}
