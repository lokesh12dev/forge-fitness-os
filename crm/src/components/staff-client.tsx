"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Clock, LogIn, LogOut, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Modal, StatTile, Timeline, Toast } from "@/components/ui/primitives";
import {
  clockShiftGeofencedAction,
  createStaffShiftAction,
} from "@/app/actions/world-class-actions";
import { calculateStaffNetPayroll } from "@/lib/staff-payroll";
import { formatMoney } from "@/lib/money";

interface ShiftRow {
  id: string;
  branchId: string;
  branchLat: number;
  branchLng: number;
  staffName: string;
  branchName: string;
  roleLabel: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: string;
  geofenceStatus: string;
  lateMinutes: number;
  advancePaise: number;
  handoverNote: string | null;
}

interface StaffPayrollRow {
  userId: string;
  staffName: string;
  roleLabel: string;
  presentShifts: number;
  lateMinutes: number;
  advancePaise: number;
  netPayablePaise: number;
}

export function StaffClient({
  currency,
  branches,
  staffUsers,
  staffPayrollRows,
  shifts,
  auditEntries,
}: {
  currency: string;
  branches: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  staffUsers: Array<{ id: string; name: string; role: string }>;
  staffPayrollRows: StaffPayrollRow[];
  shifts: ShiftRow[];
  auditEntries: Array<{ id: string; timestamp: string; badge: string; title: string; body: string }>;
}) {
  const router = useRouter();
  const [handoverDraft, setHandoverDraft] = useState("Cash verified; lockers & keys reconciled.");
  const [clockLateMins, setClockLateMins] = useState(0);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shBranchId, setShBranchId] = useState(branches[0]?.id ?? "");
  const [shUserId, setShUserId] = useState(staffUsers[0]?.id ?? "");
  const [shDate, setShDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shStart, setShStart] = useState("06:00");
  const [shEnd, setShEnd] = useState("14:00");
  const [shRoleLabel, setShRoleLabel] = useState("Front Desk Reception");
  const [shAdvRupees, setShAdvRupees] = useState(0);

  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();
  const [baseRupees, setBaseRupees] = useState(28000);
  const [presentDays, setPresentDays] = useState(25);
  const [lateMins, setLateMins] = useState(45);
  const [advanceRupees, setAdvanceRupees] = useState(3000);

  const payroll = calculateStaffNetPayroll({
    baseSalaryPaise: baseRupees * 100,
    scheduledDays: 26,
    presentDays,
    lateMinutesTotal: lateMins,
    advanceTakenPaise: advanceRupees * 100,
  });

  const clockedInCount = shifts.filter((s) => s.status === "CLOCKED_IN").length;

  const payrollCols: DataColumn<StaffPayrollRow>[] = [
    { key: "nm", header: "Staff Member", render: (r) => <div><p className="font-bold">{r.staffName}</p><p className="text-[12px] text-[var(--fg-grey)]">{r.roleLabel}</p></div> },
    { key: "sh", header: "Clocked Shifts", align: "right", render: (r) => <span className="font-tabular font-bold">{r.presentShifts}</span> },
    { key: "lt", header: "Late Mins", align: "right", render: (r) => <span className={clsx("font-tabular font-bold", r.lateMinutes > 30 ? "text-[#C8372B]" : "text-[var(--fg-grey)]")}>{r.lateMinutes}m</span> },
    { key: "adv", header: "Advance Taken", align: "right", render: (r) => <span className="font-tabular">{formatMoney(r.advancePaise, { currency })}</span> },
    { key: "net", header: "Projected Net Pay", align: "right", render: (r) => <span className="font-headline text-[16px] font-tabular text-[#2B4BCC]">{formatMoney(r.netPayablePaise, { currency })}</span> },
  ];

  const handleClock = (s: ShiftRow, nextStatus: "CLOCKED_IN" | "CLOCKED_OUT") => {
    startTransition(async () => {
      const res = await clockShiftGeofencedAction({
        shiftId: s.id,
        nextStatus,
        handoverNote: handoverDraft,
        deviceLat: s.branchLat,
        deviceLng: s.branchLng,
        lateMinutes: nextStatus === "CLOCKED_IN" ? clockLateMins : undefined,
      });
      if (res.ok) {
        setToast({
          msg: `${s.staffName} ${nextStatus === "CLOCKED_IN" ? "clocked in" : "clocked out"} · Geo: ${res.geofenceStatus}.`,
          tone: nextStatus === "CLOCKED_IN" ? "blue" : "ink",
        });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// ATTENDANCE, GEOFENCED SHIFTS & NET PAYROLL"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">STAFF SHIFTS.</h1>
        </div>
        <Button variant="primary" onClick={() => setShiftModalOpen(true)}>
          <Plus className="size-4" /> Schedule Shift
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="// CLOCKED IN NOW" value={clockedInCount} subtext="Active branch floor staff" accent="blue" />
        <StatTile label="// SCHEDULED ROSTER" value={shifts.length} subtext="Today's morning & evening shifts" accent="yellow" />
        <StatTile label="// RECENT AUDIT LOGS" value={auditEntries.length} subtext="Immutable operational trace" accent="ink" />
      </div>

      <div className="bauhaus-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2 space-y-1.5">
          <label htmlFor="sh-handover" className="bauhaus-label block">{"// SHIFT HANDOVER LOG NOTE (ATTACHED ON CLOCK-IN / CLOCK-OUT)"}</label>
          <input
            id="sh-handover"
            className="bauhaus-input"
            value={handoverDraft}
            onChange={(e) => setHandoverDraft(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sh-late" className="bauhaus-label block">{"// CLOCK-IN LATE MINS"}</label>
          <input
            id="sh-late"
            type="number"
            min={0}
            className="bauhaus-input"
            value={clockLateMins}
            onChange={(e) => setClockLateMins(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map((s) => (
          <div key={s.id} className="bauhaus-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="bauhaus-label text-[var(--fg-grey)]">{`// ${s.branchName} · ${s.roleLabel}`}</span>
                <h2 className="font-headline text-[20px] mt-1">{s.staffName}</h2>
              </div>
              <span
                className={clsx(
                  "border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase",
                  s.status === "CLOCKED_IN" ? "bg-[#2B4BCC] text-[#FFFFFF]" : s.status === "CLOCKED_OUT" ? "bg-[#151515] text-[#FFFFFF]" : "bg-[#EBC95B] text-[#151515]"
                )}
              >
                {s.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-[13px] font-tabular font-bold">
              <Clock className="size-3.5 inline mr-1" /> {s.shiftDate} · {s.startTime} — {s.endTime} IST
            </p>
            <div className="flex flex-wrap gap-1.5 text-[12px] font-bold">
              <span className="border border-[#151515] bg-[var(--bg-paper)] px-2 py-0.5">
                <MapPin className="size-3 inline mr-1" />{s.geofenceStatus}
              </span>
              {s.lateMinutes > 0 && (
                <span className="border border-[#151515] bg-[#C8372B] text-[#FFFFFF] px-2 py-0.5">
                  LATE {s.lateMinutes}M
                </span>
              )}
              {s.advancePaise > 0 && (
                <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5">
                  ADV {formatMoney(s.advancePaise, { currency })}
                </span>
              )}
            </div>
            {s.handoverNote && (
              <p className="text-[13px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-2.5">
                {s.handoverNote}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {s.status !== "CLOCKED_IN" && (
                <Button variant="primary" disabled={pending} onClick={() => handleClock(s, "CLOCKED_IN")}>
                  <LogIn className="size-4" /> Geofence Clock In
                </Button>
              )}
              {s.status === "CLOCKED_IN" && (
                <Button variant="secondary" disabled={pending} onClick={() => handleClock(s, "CLOCKED_OUT")}>
                  <LogOut className="size-4" /> Clock Out
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {staffPayrollRows.length > 0 && (
        <DataTable title="BRANCH STAFF SHIFT PAYROLL LEDGER" rows={staffPayrollRows} columns={payrollCols} rowKey={(r) => r.userId} />
      )}

      <div className="bauhaus-card p-5 space-y-4">
        <div>
          <p className="bauhaus-label text-[#C8372B]">{`// BIOMETRIC SHIFT PAYROLL & ADVANCE SIMULATOR`}</p>
          <h2 className="font-headline text-[24px] mt-1">Monthly Net Payout Calculator</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-[12px] font-bold">
            Base Salary (INR)
            <input type="number" className="bauhaus-input mt-1" value={baseRupees} onChange={(e) => setBaseRupees(Number(e.target.value) || 0)} />
          </label>
          <label className="text-[12px] font-bold">
            Present Days (/26)
            <input type="number" max={26} min={0} className="bauhaus-input mt-1" value={presentDays} onChange={(e) => setPresentDays(Number(e.target.value) || 0)} />
          </label>
          <label className="text-[12px] font-bold">
            Late Mins (30m grace)
            <input type="number" min={0} className="bauhaus-input mt-1" value={lateMins} onChange={(e) => setLateMins(Number(e.target.value) || 0)} />
          </label>
          <label className="text-[12px] font-bold">
            Salary Advance (INR)
            <input type="number" min={0} className="bauhaus-input mt-1" value={advanceRupees} onChange={(e) => setAdvanceRupees(Number(e.target.value) || 0)} />
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-2 border-[#151515] bg-[var(--bg-surface)] p-4">
          <div>
            <p className="bauhaus-label text-[var(--fg-grey)]">PRORATED PAY</p>
            <p className="font-tabular font-bold text-[18px]">{formatMoney(payroll.proratedPayPaise, { currency })}</p>
          </div>
          <div>
            <p className="bauhaus-label text-[var(--fg-grey)]">LATE DEDUCTION</p>
            <p className="font-tabular font-bold text-[18px] text-[#C8372B]">-{formatMoney(payroll.lateDeductionPaise, { currency })}</p>
          </div>
          <div>
            <p className="bauhaus-label text-[var(--fg-grey)]">ADVANCE SETTLED</p>
            <p className="font-tabular font-bold text-[18px] text-[#C8372B]">-{formatMoney(payroll.advanceDeductionPaise, { currency })}</p>
          </div>
          <div>
            <p className="bauhaus-label text-[#2B4BCC]">NET PAYABLE</p>
            <p className="font-tabular font-bold text-[20px] text-[#2B4BCC]">{formatMoney(payroll.netPayablePaise, { currency })}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-headline text-[24px]">RECENT STAFF ACTIVITY LOGS</h2>
        <Timeline entries={auditEntries} />
      </div>

      <Modal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} eyebrow="SHIFT ROSTER" title="Schedule Staff Shift">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-br" className="bauhaus-label block mb-1">{"// BRANCH"}</label>
              <select id="s-br" className="bauhaus-input" value={shBranchId} onChange={(e) => setShBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-usr" className="bauhaus-label block mb-1">{"// STAFF MEMBER"}</label>
              <select id="s-usr" className="bauhaus-input" value={shUserId} onChange={(e) => setShUserId(e.target.value)}>
                {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="s-dt" className="bauhaus-label block mb-1">{"// DATE"}</label>
              <input id="s-dt" type="date" className="bauhaus-input" value={shDate} onChange={(e) => setShDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="s-st" className="bauhaus-label block mb-1">{"// START"}</label>
              <input id="s-st" type="time" className="bauhaus-input" value={shStart} onChange={(e) => setShStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="s-en" className="bauhaus-label block mb-1">{"// END"}</label>
              <input id="s-en" type="time" className="bauhaus-input" value={shEnd} onChange={(e) => setShEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-rl" className="bauhaus-label block mb-1">{"// ROLE LABEL"}</label>
              <input id="s-rl" className="bauhaus-input" value={shRoleLabel} onChange={(e) => setShRoleLabel(e.target.value)} />
            </div>
            <div>
              <label htmlFor="s-adv" className="bauhaus-label block mb-1">{"// ADVANCE (₹)"}</label>
              <input id="s-adv" type="number" min={0} className="bauhaus-input" value={shAdvRupees} onChange={(e) => setShAdvRupees(Number(e.target.value) || 0)} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              await createStaffShiftAction({
                branchId: shBranchId,
                userId: shUserId,
                shiftDate: shDate,
                startTime: shStart,
                endTime: shEnd,
                roleLabel: shRoleLabel,
                advancePaise: shAdvRupees * 100,
              });
              setShiftModalOpen(false);
              setToast({ msg: "Staff shift scheduled.", tone: "blue" });
              router.refresh();
            })}
          >
            SAVE STAFF SHIFT
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
