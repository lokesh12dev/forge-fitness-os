"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  StatTile,
  StatusPill,
  Toast,
} from "@/components/ui/primitives";
import {
  PeakHoursHeatmap,
  RevenueAndMembersChart,
  type HeatmapMatrix,
  type TrendPoint,
} from "@/components/ui/charts";
import { formatMoney } from "@/lib/money";
import {
  loadDemoDataForOrgAction,
  toggleStaffTaskAction,
} from "@/app/actions/crm-actions";
import type { CrmRole } from "@/lib/rbac";

interface TodayProps {
  isEmpty: boolean;
  role: CrmRole;
  orgName: string;
  currency: string;
  showFinance: boolean;
  kpis: {
    checkInsToday: number;
    todayRevenuePaise: number;
    newLeadsToday: number;
    expiring7d: number;
    overdueCount: number;
    overdueBalancePaise: number;
    trialBookings: number;
    assignedClientsCount: number;
  };
  trend: TrendPoint[];
  heatmap: HeatmapMatrix;
  churnRisks: Array<{
    id: string;
    memberCode: string;
    fullName: string;
    branchName: string;
    status: string;
    daysAbsent: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
  }>;
  branchComparison: Array<{
    branchId: string;
    name: string;
    code: string;
    activeMembers: number;
    checkInsToday: number;
    revenueMonthPaise: number;
    duesPaise: number;
  }>;
}

export function TodayDashboardClient({
  isEmpty,
  role,
  orgName,
  currency,
  showFinance,
  kpis,
  trend,
  heatmap,
  churnRisks,
  tasks,
  branchComparison,
}: TodayProps) {
  const router = useRouter();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLoadDemo = () => {
    startTransition(async () => {
      const res = await loadDemoDataForOrgAction();
      setToastMsg(`Loaded ${res.memberCount} members & ${res.checkInCount.toLocaleString()} check-ins.`);
      router.refresh();
    });
  };

  const handleToggleTask = (taskId: string) => {
    startTransition(async () => {
      await toggleStaffTaskAction(taskId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      {/* Page Poster Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-2">{`// ${orgName} · DAILY BRIEFING`}</p>
          <h1 className="font-headline text-[44px] md:text-[64px]">TODAY.</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/app/checkin">
            <Button variant="secondary">Open QR Turnstile</Button>
          </Link>
          {role !== "TRAINER" && role !== "ACCOUNTANT" && (
            <Link href="/app/billing">
              <Button variant="primary">Collect Payment / Invoice</Button>
            </Link>
          )}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          eyebrow="NEW WORKSPACE READY"
          title="No members registered yet."
          description="Start cleanly by adding your first member at the front desk, or load the full 600-member multi-branch Indian demo club with 18 months of GST billing and 40,000 check-ins."
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/app/members">
                <Button variant="primary" density="hero">+ Add First Member</Button>
              </Link>
              {role === "OWNER" && (
                <Button variant="yellow" density="hero" onClick={handleLoadDemo} disabled={isPending}>
                  {isPending ? "Seeding 600 Members..." : "Load Demo Data (600 Members)"}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {/* 6 Live StatTiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatTile
              label="// CHECK-INS TODAY"
              value={kpis.checkInsToday}
              subtext="Verified QR & manual floor scans"
              accent="blue"
              indicator="LIVE"
            />

            {showFinance ? (
              <StatTile
                label="// TODAY'S REVENUE"
                value={formatMoney(Math.round(kpis.todayRevenuePaise / 100) * 100, { currency })}
                subtext="Captured UPI, card, bank & cash"
                accent="paper"
                indicator="INR"
              />
            ) : (
              <StatTile
                label="// MY ASSIGNED CLIENTS"
                value={kpis.assignedClientsCount}
                subtext="Role: Trainer (Finance gated)"
                accent="ink"
                indicator="RBAC"
              />
            )}

            <StatTile
              label="// NEW LEADS (7D)"
              value={kpis.newLeadsToday}
              subtext="Walk-in, WhatsApp, IG & Google"
              accent="paper"
            />

            <StatTile
              label="// EXPIRING IN 7 DAYS"
              value={kpis.expiring7d}
              subtext="Priority renewal reminders due"
              accent="yellow"
              indicator="ACT"
            />

            {showFinance ? (
              <StatTile
                label="// OVERDUE DUES"
                value={formatMoney(kpis.overdueBalancePaise, { currency, compact: true })}
                subtext={`${kpis.overdueCount} invoices with unpaid balance`}
                accent="red"
                indicator="DUES"
              />
            ) : (
              <StatTile
                label="// TRAINER ACCESS"
                value="CLIENTS ONLY"
                subtext="Finance & dues ledger restricted"
                accent="ink"
              />
            )}

            <StatTile
              label="// TRIAL BOOKINGS"
              value={kpis.trialBookings}
              subtext="Scheduled floor trials awaiting conversion"
              accent="paper"
            />
          </div>

          {/* Finance Trend Chart (Hidden from Trainer!) + Peak Hours Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {showFinance && trend.length > 0 && (
              <div className="lg:col-span-6">
                <RevenueAndMembersChart
                  data={trend}
                  formatY={(p) => formatMoney(p, { currency, compact: true })}
                />
              </div>
            )}
            <div className={showFinance && trend.length > 0 ? "lg:col-span-6" : "lg:col-span-12"}>
              <PeakHoursHeatmap matrix={heatmap} />
            </div>
          </div>

          {/* Top 5 Churn Risks + Staff Task Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 bauhaus-card">
              <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4 flex items-center justify-between">
                <div>
                  <p className="bauhaus-label text-[#C8372B]">{`// RETENTION PRIORITY`}</p>
                  <h2 className="font-headline text-[20px] mt-1">Top 5 Churn Risks</h2>
                </div>
                <Link href="/app/members" className="text-[12px] font-bold uppercase underline">
                  View Roster →
                </Link>
              </div>
              <div className="divide-y-2 divide-[var(--border-ink)]">
                {churnRisks.map((m) => (
                  <Link
                    key={m.id}
                    href={`/app/members/${m.id}`}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#EBC95B]/25"
                  >
                    <div>
                      <p className="font-bold text-[15px]">{m.fullName}</p>
                      <p className="text-[12px] uppercase text-[var(--fg-grey)]">
                        {m.memberCode} · {m.branchName} · Last visit {m.daysAbsent}d ago
                      </p>
                    </div>
                    <StatusPill status={m.status} />
                  </Link>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bauhaus-card">
              <div className="border-b-2 border-[var(--border-ink)] bg-[#151515] text-[#FFFFFF] p-4">
                <p className="bauhaus-label text-[#EBC95B]">{`// SHIFT OPERATIONS`}</p>
                <h2 className="font-headline text-[20px] mt-1 text-[#FFFFFF]">Staff Checklist</h2>
              </div>
              <div className="divide-y-2 divide-[var(--border-ink)]">
                {tasks.map((task) => {
                  const done = task.status === "DONE";
                  return (
                    <button
                      key={task.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleTask(task.id)}
                      className="w-full min-h-[54px] p-4 flex items-start gap-3 text-left hover:bg-[var(--bg-muted)]"
                    >
                      <span
                        className={`mt-0.5 size-5 shrink-0 border-2 border-[var(--border-ink)] grid place-items-center ${
                          done ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[var(--bg-paper)]"
                        }`}
                      >
                        {done ? <Check className="size-3.5 stroke-[3]" /> : <Square className="size-3 opacity-0" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-bold ${done ? "line-through text-[var(--fg-grey)]" : ""}`}>
                          {task.title}
                        </p>
                        <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--fg-grey)] mt-0.5">
                          PRIORITY: {task.priority}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Owner / Accountant Multi-Branch Comparison */}
          {showFinance && branchComparison.length > 0 && (
            <div className="bauhaus-card">
              <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4">
                <p className="bauhaus-label text-[#2B4BCC]">{`// MULTI-BRANCH SNAPSHOT`}</p>
                <h2 className="font-headline text-[20px] mt-1">Branch Comparison</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#151515] text-[#FFFFFF]">
                    <tr>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em]">Branch</th>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em]">Code</th>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-right">Active Members</th>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-right">Check-ins Today</th>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-right">Month Revenue</th>
                      <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-right">Open Dues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[var(--border-ink)]">
                    {branchComparison.map((row) => (
                      <tr key={row.branchId}>
                        <td className="px-4 py-3 font-bold text-[14px]">{row.name}</td>
                        <td className="px-4 py-3 text-[13px] font-bold uppercase">{row.code}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold">{row.activeMembers}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold">{row.checkInsToday}</td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-[#2B4BCC]">
                          {formatMoney(row.revenueMonthPaise, { currency })}
                        </td>
                        <td className="px-4 py-3 text-right font-tabular font-bold text-[#C8372B]">
                          {formatMoney(row.duesPaise, { currency })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
