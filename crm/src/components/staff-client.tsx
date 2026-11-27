"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Clock, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile, Timeline, Toast } from "@/components/ui/primitives";
import { clockStaffShiftAction } from "@/app/actions/phase34-actions";

interface ShiftRow {
  id: string;
  staffName: string;
  branchName: string;
  roleLabel: string;
  startTime: string;
  endTime: string;
  status: string;
  handoverNote: string | null;
}

export function StaffClient({
  shifts,
  auditEntries,
}: {
  shifts: ShiftRow[];
  auditEntries: Array<{ id: string; timestamp: string; badge: string; title: string; body: string }>;
}) {
  const router = useRouter();
  const [handoverDraft, setHandoverDraft] = useState("Cash verified; lockers & keys reconciled.");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const clockedInCount = shifts.filter((s) => s.status === "CLOCKED_IN").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// ATTENDANCE, SHIFT HANDOVER & COMPLIANCE"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">STAFF SHIFTS.</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="// CLOCKED IN NOW" value={clockedInCount} subtext="Active branch floor staff" accent="blue" />
        <StatTile label="// SCHEDULED ROSTER" value={shifts.length} subtext="Today's morning & evening shifts" accent="yellow" />
        <StatTile label="// RECENT AUDIT LOGS" value={auditEntries.length} subtext="Immutable operational trace" accent="ink" />
      </div>

      <div className="bauhaus-card p-4 space-y-2">
        <label htmlFor="sh-handover" className="bauhaus-label block">{"// SHIFT HANDOVER LOG NOTE (ATTACHED ON CLOCK-IN / CLOCK-OUT)"}</label>
        <input
          id="sh-handover"
          className="bauhaus-input"
          value={handoverDraft}
          onChange={(e) => setHandoverDraft(e.target.value)}
        />
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
              <Clock className="size-3.5 inline mr-1" /> {s.startTime} — {s.endTime} IST
            </p>
            {s.handoverNote && (
              <p className="text-[13px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-2.5">
                {s.handoverNote}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {s.status !== "CLOCKED_IN" && (
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    await clockStaffShiftAction({ shiftId: s.id, action: "CLOCK_IN", handoverNote: handoverDraft });
                    setToast({ msg: `${s.staffName} clocked in.`, tone: "blue" });
                    router.refresh();
                  })}
                >
                  <LogIn className="size-4" /> Clock In
                </Button>
              )}
              {s.status === "CLOCKED_IN" && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    await clockStaffShiftAction({ shiftId: s.id, action: "CLOCK_OUT", handoverNote: handoverDraft });
                    setToast({ msg: `${s.staffName} clocked out with handover logged.`, tone: "ink" });
                    router.refresh();
                  })}
                >
                  <LogOut className="size-4" /> Clock Out
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-headline text-[24px]">RECENT STAFF ACTIVITY LOGS</h2>
        <Timeline entries={auditEntries} />
      </div>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
