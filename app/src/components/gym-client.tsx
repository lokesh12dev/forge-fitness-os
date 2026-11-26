"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Dumbbell,
  Layers,
  Plus,
  QrCode,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  EquipmentStation,
  GymFacility,
  GymFinancialMetrics,
  GymMemberCheckIn,
  INITIAL_CHECK_INS,
  INITIAL_GYM_FACILITY,
  INITIAL_GYM_FINANCIALS,
  calculateEquipmentBottleneck,
  calculateGymOccupancyRate,
  processMemberCheckIn,
} from "@/lib/b2b-portal";
import { Badge, Button, ProgressBar } from "@/components/ui";

export function GymClient() {
  const [facility, setFacility] = useState<GymFacility>(INITIAL_GYM_FACILITY);
  const [checkIns, setCheckIns] = useState<GymMemberCheckIn[]>(INITIAL_CHECK_INS);
  const [financials] = useState<GymFinancialMetrics>(INITIAL_GYM_FINANCIALS);

  // New check-in state
  const [newMemberName, setNewMemberName] = useState("");
  const [newPlanName, setNewPlanName] = useState("Gold All-Access");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const occupancy = calculateGymOccupancyRate(facility.currentOccupancy, facility.maxCapacity);
  const bottleneck = calculateEquipmentBottleneck(facility.equipmentStations);

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const { checkIns: updatedCheckIns, newOccupancy } = processMemberCheckIn(
      checkIns,
      {
        memberId: `ath-${Date.now()}`,
        memberName: newMemberName.trim(),
        planName: newPlanName,
        status: "active",
      },
      facility.currentOccupancy
    );

    setCheckIns(updatedCheckIns);
    setFacility((prev) => ({ ...prev, currentOccupancy: newOccupancy }));
    setNewMemberName("");

    setToastMessage(`Checked in ${newMemberName.trim()} (${newPlanName})!`);
    setTimeout(() => setToastMessage(null), 3500);
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
        {/* Fast Check-In Kiosk */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
            <QrCode className="size-3" /> Front Desk Kiosk
          </span>
          <h3 className="text-base font-bold text-chalk mt-0.5">Quick Member Check-In</h3>
          <p className="text-[11px] text-dim mb-4">Manual override or QR badge scan</p>

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
    </div>
  );
}
