"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ExternalLink, MessageSquare, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, Modal, StatTile, StatusPill, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import type { ChurnFactor, SavePlanSuggestion } from "@/lib/churn";
import type { CohortRow } from "@/lib/cohorts";
import { executeChurnSaveOutreachAction } from "@/app/actions/phase2-actions";

interface RiskRow {
  memberId: string;
  memberCode: string;
  fullName: string;
  phone: string;
  branchName: string;
  planName: string;
  planValuePaise: number | null;
  status: string;
  expiryDate: string | null;
  daysSinceLastVisit: number;
  visitsLast14d: number;
  visitsPrev14d: number;
  score: number;
  tier: "HIGH" | "MEDIUM" | "LOW";
  factors: ChurnFactor[];
  savePlan: SavePlanSuggestion;
}

export function RetentionClient({
  currency,
  canViewRevenue,
  canOutreach,
  summary,
  cohorts,
  atRiskMembers,
}: {
  currency: string;
  canViewRevenue: boolean;
  canOutreach: boolean;
  summary: {
    highRiskCount: number;
    medRiskCount: number;
    expiring30dCount: number;
    forecast: {
      expiringCount: number;
      grossRenewablePaise: number;
      projectedCollectedPaise: number;
      atRiskPaise: number;
    } | null;
  };
  cohorts: CohortRow[];
  atRiskMembers: RiskRow[];
}) {
  const [tierFilter, setTierFilter] = useState<"ALL" | "HIGH" | "MEDIUM">("ALL");
  const [activeRow, setActiveRow] = useState<RiskRow | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      atRiskMembers.filter((m) =>
        tierFilter === "ALL" ? m.score > 0 : m.tier === tierFilter
      ),
    [atRiskMembers, tierFilter]
  );

  const openOutreachModal = (row: RiskRow) => {
    setActiveRow(row);
    setMessageDraft(row.savePlan.outreachMessage);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// PREDICTIVE SAVE ENGINE & COHORTS"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">RETENTION & CHURN.</h1>
        </div>
        <span className="border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
          SIGNALS: VISIT DROP · SILENCE DAYS · DUES · TENURE
        </span>
      </div>

      {/* KPI Row — Revenue masked for Trainers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// HIGH CHURN RISK (60+)" value={summary.highRiskCount} subtext="Immediate coach / save action" accent="red" />
        <StatTile label="// MEDIUM RISK (35–59)" value={summary.medRiskCount} subtext="Early habit drift detected" accent="yellow" />
        <StatTile label="// RENEWALS NEXT 30D" value={summary.expiring30dCount} subtext="Active members approaching cycle end" accent="blue" />
        {canViewRevenue && summary.forecast ? (
          <StatTile
            label="// AT-RISK REVENUE (30D)"
            value={formatMoney(summary.forecast.atRiskPaise, { currency })}
            subtext={`Projected collection: ${formatMoney(summary.forecast.projectedCollectedPaise, { currency })}`}
            accent="ink"
          />
        ) : (
          <StatTile label="// COACH FOCUS" value={summary.highRiskCount + summary.medRiskCount} subtext="Assigned athletes needing check-in" accent="ink" />
        )}
      </div>

      {/* 30-Day Renewal Forecast Bar + Cohort Retention Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bauhaus-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="bauhaus-label text-[#2B4BCC]">{"// MONTHLY COHORT RETENTION GRID"}</p>
              <h2 className="font-headline text-[24px] mt-1">Join Cohort Survival (M0–M5)</h2>
            </div>
            <div className="flex items-center gap-3 text-[12px] font-bold uppercase">
              <span className="inline-flex items-center gap-1"><span className="size-3 bg-[#2B4BCC] border border-[#151515]" /> 80%+</span>
              <span className="inline-flex items-center gap-1"><span className="size-3 bg-[#EBC95B] border border-[#151515]" /> 60–79%</span>
              <span className="inline-flex items-center gap-1"><span className="size-3 bg-[#C8372B] border border-[#151515]" /> &lt;60%</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)]">
                  <th className="p-2.5 text-left font-bold uppercase">Cohort</th>
                  <th className="p-2.5 text-right font-bold uppercase">Joined</th>
                  {["M0", "M1", "M2", "M3", "M4", "M5"].map((m) => (
                    <th key={m} className="p-2.5 text-center font-bold uppercase">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-ink)]">
                {cohorts.map((row) => (
                  <tr key={row.cohortLabel}>
                    <td className="p-2.5 font-bold whitespace-nowrap">{row.cohortLabel}</td>
                    <td className="p-2.5 text-right font-tabular font-bold">{row.size}</td>
                    {Array.from({ length: 6 }).map((_, idx) => {
                      const val = row.retentionPcts[idx];
                      if (val === undefined) {
                        return <td key={idx} className="p-2 text-center text-[var(--fg-grey)]">—</td>;
                      }
                      const tone =
                        val >= 80
                          ? "bg-[#2B4BCC] text-[#FFFFFF]"
                          : val >= 60
                          ? "bg-[#EBC95B] text-[#151515]"
                          : "bg-[#C8372B] text-[#FFFFFF]";
                      return (
                        <td key={idx} className="p-1.5 text-center">
                          <span className={clsx("block py-1.5 border border-[#151515] font-tabular font-bold", tone)}>
                            {val}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bauhaus-card p-5 space-y-4">
          <p className="bauhaus-label text-[#C8372B]">{"// 30-DAY RENEWAL OUTLOOK"}</p>
          <h2 className="font-headline text-[24px]">Cycle Forecast</h2>
          {canViewRevenue && summary.forecast ? (
            <div className="space-y-3 text-[14px]">
              <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3 flex justify-between">
                <span className="font-bold">Gross Renewable</span>
                <span className="font-headline text-[18px] font-tabular">
                  {formatMoney(summary.forecast.grossRenewablePaise, { currency })}
                </span>
              </div>
              <div className="border-2 border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] p-3 flex justify-between">
                <span className="font-bold">Expected Collection</span>
                <span className="font-headline text-[18px] font-tabular">
                  {formatMoney(summary.forecast.projectedCollectedPaise, { currency })}
                </span>
              </div>
              <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] p-3 flex justify-between">
                <span className="font-bold">Exposed to High/Med Risk</span>
                <span className="font-headline text-[18px] font-tabular">
                  {formatMoney(summary.forecast.atRiskPaise, { currency })}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-4 text-[14px]">
              <p className="font-bold uppercase text-[12px] text-[#2B4BCC] mb-1">ATHLETE RETENTION PRIORITY</p>
              <p>
                {summary.expiring30dCount} active members are entering renewal window over the next 30 days. Focus check-ins on those with 12+ quiet days.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Risk Queue */}
      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "HIGH", "MEDIUM"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tierFilter === tier ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {tier === "ALL" ? `ALL WATCHLIST (${atRiskMembers.filter((m) => m.score > 0).length})` : `${tier} RISK`}
            </button>
          ))}
        </div>
        <span className="bauhaus-label text-[var(--fg-grey)]">SORTED BY RISK SCORE DESCENDING</span>
      </FilterBar>

      {/* Explainable Churn Risk Cards */}
      <div className="space-y-3">
        {filtered.map((m) => (
          <div key={m.memberId} className="bauhaus-card p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={clsx(
                    "size-14 border-2 border-[#151515] flex flex-col items-center justify-center font-headline shrink-0",
                    m.tier === "HIGH"
                      ? "bg-[#C8372B] text-[#FFFFFF]"
                      : m.tier === "MEDIUM"
                      ? "bg-[#EBC95B] text-[#151515]"
                      : "bg-[#2B4BCC] text-[#FFFFFF]"
                  )}
                >
                  <span className="text-[22px] leading-none font-tabular">{m.score}</span>
                  <span className="text-[12px] leading-none mt-0.5">{m.tier}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/members/${m.memberId}`} className="font-headline text-[20px] hover:text-[#C8372B] inline-flex items-center gap-1">
                      {m.fullName} <ExternalLink className="size-3.5" />
                    </Link>
                    <StatusPill status={m.status} />
                  </div>
                  <p className="text-[12px] font-bold uppercase text-[var(--fg-grey)] mt-0.5">
                    {m.memberCode} · {m.branchName} · {m.planName}
                    {canViewRevenue && m.planValuePaise !== null ? ` (${formatMoney(m.planValuePaise, { currency })})` : ""}
                    {" · "}LAST VISIT {m.daysSinceLastVisit}D AGO ({m.visitsPrev14d} → {m.visitsLast14d} / 14D)
                  </p>
                </div>
              </div>

              {canOutreach && (
                <Button variant="primary" onClick={() => openOutreachModal(m)}>
                  <MessageSquare className="size-4" /> Save Plan: {m.savePlan.actionType.replace("_", " ")}
                </Button>
              )}
            </div>

            {/* Explainable Reason Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bauhaus-label text-[#C8372B]">{"// RISK FACTORS:"}</span>
              {m.factors.map((f) => (
                <span key={f.code} className="border border-[#151515] bg-[var(--bg-paper)] px-2.5 py-1 text-[12px] font-bold">
                  <ShieldAlert className="size-3.5 inline mr-1 text-[#C8372B]" />
                  {f.label} (+{f.points})
                </span>
              ))}
            </div>

            <div className="border-t-2 border-[var(--border-ink)]/30 pt-2 text-[13px] flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="uppercase text-[#2B4BCC] mr-1.5">RECOMMENDED SAVE:</strong>
                {m.savePlan.title}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 1-Click Save Outreach Modal */}
      <Modal
        open={Boolean(activeRow)}
        onClose={() => setActiveRow(null)}
        eyebrow="RETENTION INTERVENTION"
        title={activeRow ? `Save Plan — ${activeRow.fullName}` : "Save Plan"}
      >
        {activeRow && (
          <div className="space-y-4">
            <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-3 text-[13px] font-bold">
              ACTION: {activeRow.savePlan.title} · Score {activeRow.score}/100
            </div>
            <div>
              <label htmlFor="ret-msg" className="bauhaus-label block mb-1.5">{"// WHATSAPP OUTREACH MESSAGE"}</label>
              <textarea
                id="ret-msg"
                rows={4}
                className="bauhaus-input h-auto py-2"
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
              />
            </div>
            <p className="text-[12px] text-[var(--fg-grey)]">
              Dispatches WhatsApp via adapter AND creates a high-priority follow-up task for the assigned coach/manager.
            </p>
            <Button
              variant="primary"
              density="hero"
              fullWidth
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await executeChurnSaveOutreachAction({
                    memberId: activeRow.memberId,
                    actionType: activeRow.savePlan.actionType,
                    message: messageDraft,
                  });
                  if (!res.ok) {
                    setToast({ msg: res.error, tone: "red" });
                    return;
                  }
                  setActiveRow(null);
                  setToast({ msg: `Save outreach dispatched (${res.status}) & task queued.`, tone: "blue" });
                });
              }}
            >
              SEND OUTREACH & LOG TASK
            </Button>
          </div>
        )}
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
