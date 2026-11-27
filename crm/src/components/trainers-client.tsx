"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { createPtSessionAction, updatePtSessionStatusAction } from "@/app/actions/phase34-actions";

interface RosterRow {
  id: string;
  userId: string;
  name: string;
  branchName: string;
  specialties: string[];
  availability: { morning?: string; evening?: string; offDay?: string };
  sessionsCount: number;
  effectiveBps: number;
  retainerPaise: number | null;
  commissionEarnedPaise: number | null;
  totalPayoutPaise: number | null;
}

interface PtSessionRow {
  id: string;
  trainerName: string;
  memberName: string;
  memberCode: string;
  branchName: string;
  scheduledAt: string;
  status: string;
  sessionFeePaise: number | null;
  commissionPaise: number | null;
  notes: string | null;
}

export function TrainersClient({
  currency,
  canManageSessions,
  showPayrollColumns,
  branches,
  roster,
  members,
  sessions,
}: {
  currency: string;
  canManageSessions: boolean;
  showPayrollColumns: boolean;
  branches: Array<{ id: string; name: string }>;
  roster: RosterRow[];
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  sessions: PtSessionRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"PAYROLL" | "SESSIONS">("PAYROLL");
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const [ptBranchId, setPtBranchId] = useState(branches[0]?.id ?? "");
  const [ptTrainerId, setPtTrainerId] = useState(roster[0]?.userId ?? "");
  const [ptMemberId, setPtMemberId] = useState(members[0]?.id ?? "");
  const [ptFeeRupees, setPtFeeRupees] = useState(1500);
  const [ptWhen, setPtWhen] = useState(() =>
    new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16)
  );
  const [ptNotes, setPtNotes] = useState("Hypertrophy & barbell form block");

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "COMPLETED").length;
    const totalPay = roster.reduce((s, r) => s + (r.totalPayoutPaise ?? 0), 0);
    const totalComm = roster.reduce((s, r) => s + (r.commissionEarnedPaise ?? 0), 0);
    return { completed, totalPay, totalComm };
  }, [roster, sessions]);

  const payrollCols: DataColumn<RosterRow>[] = [
    { key: "name", header: "Coach", render: (r) => <div><p className="font-bold">{r.name}</p><p className="text-[12px] text-[var(--fg-grey)]">{r.branchName} · Off: {r.availability.offDay ?? "Sun"}</p></div> },
    { key: "spec", header: "Specialties & Hours", render: (r) => <div><p className="text-[13px] font-bold">{r.specialties.join(" · ")}</p><p className="text-[12px] text-[var(--fg-grey)]">{r.availability.morning} / {r.availability.evening}</p></div> },
    { key: "cnt", header: "Completed PT", align: "right", render: (r) => <span className="font-headline text-[18px] font-tabular">{r.sessionsCount}</span> },
    { key: "slab", header: "Comm Slab", align: "right", render: (r) => <span className="border border-[#151515] px-2 py-0.5 text-[12px] font-bold font-tabular">{(r.effectiveBps / 100).toFixed(0)}%</span> },
    ...(showPayrollColumns
      ? [
          { key: "ret", header: "Retainer", align: "right" as const, render: (r: RosterRow) => <span className="font-tabular">{formatMoney(r.retainerPaise ?? 0, { currency })}</span> },
          { key: "comm", header: "PT Earned", align: "right" as const, render: (r: RosterRow) => <span className="font-tabular font-bold text-[#2B4BCC]">{formatMoney(r.commissionEarnedPaise ?? 0, { currency })}</span> },
          { key: "tot", header: "Total Payout", align: "right" as const, render: (r: RosterRow) => <span className="font-headline text-[16px] font-tabular text-[#C8372B]">{formatMoney(r.totalPayoutPaise ?? 0, { currency })}</span> },
        ]
      : []),
  ];

  const sessionCols: DataColumn<PtSessionRow>[] = [
    { key: "coach", header: "Coach", render: (r) => <span className="font-bold">{r.trainerName}</span> },
    { key: "mem", header: "Member", render: (r) => <span>{r.memberName} ({r.memberCode})</span> },
    { key: "when", header: "Scheduled", render: (r) => <span className="text-[12px] font-tabular">{new Date(r.scheduledAt).toLocaleDateString("en-IN")}</span> },
    {
      key: "st",
      header: "Status",
      render: (r) => (
        <span className={clsx("px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase", r.status === "COMPLETED" ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#EBC95B] text-[#151515]")}>
          {r.status}
        </span>
      ),
    },
    ...(showPayrollColumns
      ? [{ key: "fee", header: "Comm", align: "right" as const, render: (r: PtSessionRow) => <span className="font-tabular font-bold">{formatMoney(r.commissionPaise ?? 0, { currency })}</span> }]
      : []),
    ...(canManageSessions
      ? [
          {
            key: "act",
            header: "Action",
            render: (r: PtSessionRow) =>
              r.status === "SCHEDULED" ? (
                <button
                  type="button"
                  onClick={() => startTransition(async () => {
                    await updatePtSessionStatusAction({ ptSessionId: r.id, status: "COMPLETED" });
                    setToast({ msg: "PT session logged COMPLETED + commission added.", tone: "blue" });
                    router.refresh();
                  })}
                  className="border border-[#151515] bg-[#151515] text-[#FFFFFF] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#2B4BCC]"
                >
                  <Check className="size-3.5 inline mr-1" /> Complete
                </button>
              ) : (
                <span className="text-[12px] text-[var(--fg-grey)]">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// COACH AVAILABILITY, PT TRACKING & PAYROLL SLABS"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">TRAINERS & PT.</h1>
        </div>
        {canManageSessions && roster.length > 0 && (
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" /> Book PT Session
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// SCOPED COACHES" value={roster.length} subtext="Active floor performance team" accent="blue" />
        <StatTile label="// COMPLETED PT" value={stats.completed} subtext="Sessions credited to payroll" accent="yellow" />
        {showPayrollColumns ? (
          <>
            <StatTile label="// PT COMMISSIONS" value={formatMoney(stats.totalComm, { currency })} subtext="Slabbed variable payouts (+5% @15+)" accent="ink" />
            <StatTile label="// TOTAL PAYROLL" value={formatMoney(stats.totalPay, { currency })} subtext="Retainers + PT commissions" accent="red" />
          </>
        ) : (
          <StatTile label="// PAYROLL ACCESS" value="SCOPED" subtext="Finance gated per RBAC" accent="paper" />
        )}
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["PAYROLL", "SESSIONS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "PAYROLL" ? "COACH ROSTER & PAYROLL SLABS" : `PT SESSIONS (${sessions.length})`}
            </button>
          ))}
        </div>
        <span className="bauhaus-label text-[var(--fg-grey)]">SLAB BONUS: +5% COMMISSION AT 15+ COMPLETED SESSIONS</span>
      </FilterBar>

      {tab === "PAYROLL" && <DataTable title="COACH COMMISSION & AVAILABILITY MATRIX" rows={roster} columns={payrollCols} rowKey={(r) => r.id} />}
      {tab === "SESSIONS" && <DataTable title="1-ON-1 PT SESSION LEDGER" rows={sessions} columns={sessionCols} rowKey={(r) => r.id} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} eyebrow="1-ON-1 COACHING" title="Schedule PT Session">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pt-br" className="bauhaus-label block mb-1.5">{"// BRANCH"}</label>
              <select id="pt-br" className="bauhaus-input" value={ptBranchId} onChange={(e) => setPtBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pt-co" className="bauhaus-label block mb-1.5">{"// COACH"}</label>
              <select id="pt-co" className="bauhaus-input" value={ptTrainerId} onChange={(e) => setPtTrainerId(e.target.value)}>
                {roster.map((c) => <option key={c.userId} value={c.userId}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pt-mem" className="bauhaus-label block mb-1.5">{"// MEMBER"}</label>
              <select id="pt-mem" className="bauhaus-input" value={ptMemberId} onChange={(e) => setPtMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pt-fee" className="bauhaus-label block mb-1.5">{"// SESSION FEE (₹)"}</label>
              <input id="pt-fee" type="number" min={500} className="bauhaus-input" value={ptFeeRupees} onChange={(e) => setPtFeeRupees(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pt-wh" className="bauhaus-label block mb-1.5">{"// SCHEDULED SLOT"}</label>
              <input id="pt-wh" type="datetime-local" className="bauhaus-input" value={ptWhen} onChange={(e) => setPtWhen(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pt-nt" className="bauhaus-label block mb-1.5">{"// SESSION FOCUS"}</label>
              <input id="pt-nt" className="bauhaus-input" value={ptNotes} onChange={(e) => setPtNotes(e.target.value)} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await createPtSessionAction({
                  branchId: ptBranchId,
                  trainerId: ptTrainerId,
                  memberId: ptMemberId,
                  scheduledAt: ptWhen,
                  sessionFeePaise: ptFeeRupees * 100,
                  notes: ptNotes,
                });
                setModalOpen(false);
                setToast({ msg: "PT session booked cleanly.", tone: "blue" });
                router.refresh();
              });
            }}
          >
            SCHEDULE PT SESSION
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
