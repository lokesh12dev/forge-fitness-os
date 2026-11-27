"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  AlertTriangle,
  Calendar,
  Check,
  Code2,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  Shuffle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Drawer, FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { QRCode } from "@/components/ui/qr-code";
import { formatMoney } from "@/lib/money";
import type { LeadStageType, SourceRoiRow } from "@/lib/leads-math";
import { evaluateLeadSlaStatus } from "@/lib/world-class-engines";
import {
  addLeadTaskAction,
  assignLeadOwnerAction,
  convertLeadToMemberAction,
  createLeadAction,
  toggleLeadTaskAction,
  updateLeadStageAction,
} from "@/app/actions/phase2-actions";
import {
  bulkLeadStageMoveAction,
  roundRobinAssignLeadsAction,
  upsertAdSpendCampaignAction,
} from "@/app/actions/world-class-actions";

const STAGES: Array<{ id: LeadStageType; label: string; accent: string }> = [
  { id: "NEW", label: "NEW", accent: "bg-[#2B4BCC] text-[#FFFFFF]" },
  { id: "CONTACTED", label: "CONTACTED", accent: "bg-[#EBC95B] text-[#151515]" },
  { id: "TRIAL_BOOKED", label: "TRIAL BOOKED", accent: "bg-[#151515] text-[#EBC95B]" },
  { id: "TRIAL_DONE", label: "TRIAL DONE", accent: "bg-[#EBC95B] text-[#151515]" },
  { id: "NEGOTIATION", label: "NEGOTIATION", accent: "bg-[#2B4BCC] text-[#FFFFFF]" },
  { id: "WON", label: "WON", accent: "bg-[#151515] text-[#FFFFFF]" },
  { id: "LOST", label: "LOST", accent: "bg-[#C8372B] text-[#FFFFFF]" },
];

const SOURCES = ["Walk-in", "Instagram", "Google", "Referral", "Website", "WhatsApp", "Justdial"] as const;

export interface LeadTaskRow {
  id: string;
  title: string;
  dueAt: string;
  status: string;
}

export interface LeadRow {
  id: string;
  branchId: string;
  branchName: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  stage: LeadStageType;
  score: number;
  trialAt: string | null;
  lostReason: string | null;
  ownerId: string | null;
  ownerName: string;
  convertedMemberId: string | null;
  notes: string | null;
  stageChangedAt: string;
  createdAt: string;
  tasks: LeadTaskRow[];
}

export function LeadsClient({
  orgSlug,
  orgName,
  currency,
  canWrite,
  canViewRoi,
  branches,
  plans,
  staff,
  roiRows,
  leads,
}: {
  orgSlug: string;
  orgName: string;
  currency: string;
  canWrite: boolean;
  canViewRoi: boolean;
  branches: Array<{ id: string; name: string; code: string }>;
  plans: Array<{ id: string; name: string; pricePaise: number; durationDays: number }>;
  staff: Array<{ id: string; name: string }>;
  roiRows: SourceRoiRow[];
  leads: LeadRow[];
}) {
  const [tab, setTab] = useState<"KANBAN" | "TABLE" | "ROI" | "CAPTURE">("KANBAN");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({});
  const dragLeadRef = useRef<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStageType | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState<LeadStageType>("CONTACTED");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // New Lead modal state
  const [leadBranchId, setLeadBranchId] = useState(branches[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("Instagram");
  const [notes, setNotes] = useState("");
  const [trialAt, setTrialAt] = useState("");
  const [dupAlert, setDupAlert] = useState<string | null>(null);

  // Ad spend modal
  const [spendSource, setSpendSource] = useState<(typeof SOURCES)[number]>("Instagram");
  const [spendRupees, setSpendRupees] = useState("25000");

  // Drawer action states
  const [lostReasonInput, setLostReasonInput] = useState("Price / budget mismatch");
  const [trialInput, setTrialInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [convertPlanId, setConvertPlanId] = useState(plans[1]?.id ?? plans[0]?.id ?? "");
  const [collectNow, setCollectNow] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter !== "ALL" && l.source !== sourceFilter) return false;
      if (stageFilter !== "ALL" && l.stage !== stageFilter) return false;
      if (
        q &&
        !l.fullName.toLowerCase().includes(q) &&
        !l.phone.toLowerCase().includes(q) &&
        !(l.email ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [leads, query, sourceFilter, stageFilter]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const stats = useMemo(() => {
    const active = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST").length;
    const trials = leads.filter((l) => l.stage === "TRIAL_BOOKED").length;
    const won = leads.filter((l) => l.stage === "WON").length;
    const slaBreached = leads.filter(
      (l) => evaluateLeadSlaStatus({ stage: l.stage, stageChangedAt: new Date(l.stageChangedAt) }).breached
    ).length;
    const convRate = leads.length > 0 ? Math.round((won / leads.length) * 100) : 0;
    const topRoi = roiRows[0];
    return { active, trials, won, convRate, slaBreached, topRoi };
  }, [leads, roiRows]);

  const publicUrl = `/enquire/${orgSlug}`;
  const embedSnippet = `<iframe src="${publicUrl}?embed=1" width="100%" height="580" style="border:3px solid #151515"></iframe>`;

  const handleDropToStage = (targetStage: LeadStageType) => {
    setDragOverStage(null);
    const leadId = dragLeadRef.current;
    dragLeadRef.current = null;
    if (!leadId || !canWrite) return;
    const current = leads.find((l) => l.id === leadId);
    if (!current || current.stage === targetStage) return;

    startTransition(async () => {
      const res = await updateLeadStageAction({
        leadId,
        stage: targetStage,
        lostReason: targetStage === "LOST" ? lostReasonInput : undefined,
      });
      if (!res.ok) {
        setToast({ msg: res.error, tone: "red" });
        return;
      }
      setToast({ msg: `Moved ${current.fullName} → ${targetStage.replace("_", " ")}`, tone: "blue" });
    });
  };

  const handleCreateLead = (allowDuplicate: boolean) => {
    setDupAlert(null);
    startTransition(async () => {
      const res = await createLeadAction({
        branchId: leadBranchId,
        fullName,
        phone,
        email,
        source,
        stage: trialAt ? "TRIAL_BOOKED" : "NEW",
        trialAt: trialAt || undefined,
        notes,
        allowDuplicate,
      });
      if (!res.ok) {
        if ("duplicateWarning" in res && res.duplicateWarning) {
          setDupAlert(res.error);
          return;
        }
        setToast({ msg: res.error, tone: "red" });
        return;
      }
      setToast({ msg: `Lead ${fullName} added to pipeline.`, tone: "blue" });
      setNewOpen(false);
      setFullName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setTrialAt("");
      setDupAlert(null);
    });
  };

  const columns: DataColumn<LeadRow>[] = [
    {
      key: "name",
      header: "Lead",
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div>
          <p className="font-bold">{r.fullName}</p>
          <p className="text-[12px] text-[var(--fg-grey)] font-tabular">{r.phone}</p>
        </div>
      ),
    },
    { key: "source", header: "Source", sortValue: (r) => r.source, render: (r) => <span className="font-bold uppercase text-[12px]">{r.source}</span> },
    { key: "stage", header: "Stage", sortValue: (r) => r.stage, render: (r) => <span className="border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase">{r.stage.replace("_", " ")}</span> },
    {
      key: "sla",
      header: "SLA Guard",
      render: (r) => {
        const sla = evaluateLeadSlaStatus({ stage: r.stage, stageChangedAt: new Date(r.stageChangedAt) });
        return (
          <span className={clsx("text-[12px] font-bold uppercase", sla.breached ? "text-[#C8372B]" : "text-[var(--fg-grey)]")}>
            {sla.label}
          </span>
        );
      },
    },
    { key: "score", header: "Score", align: "right", sortValue: (r) => r.score, render: (r) => <span className="font-headline text-[18px] font-tabular">{r.score}</span> },
    { key: "owner", header: "Owner", sortValue: (r) => r.ownerName, render: (r) => <span>{r.ownerName}</span> },
    { key: "branch", header: "Branch", sortValue: (r) => r.branchName, render: (r) => <span>{r.branchName}</span> },
  ];

  const roiColumns: DataColumn<SourceRoiRow>[] = [
    { key: "source", header: "Channel", sortValue: (r) => r.source, render: (r) => <span className="font-bold uppercase">{r.source}</span> },
    { key: "leads", header: "Leads", align: "right", sortValue: (r) => r.leadsCount, render: (r) => <span className="font-tabular font-bold">{r.leadsCount}</span> },
    { key: "won", header: "Won", align: "right", sortValue: (r) => r.wonCount, render: (r) => <span className="font-tabular font-bold text-[#2B4BCC]">{r.wonCount}</span> },
    { key: "conv", header: "Conv %", align: "right", sortValue: (r) => r.conversionRatePct, render: (r) => <span className="font-tabular font-bold">{r.conversionRatePct}%</span> },
    { key: "spend", header: "Ad Spend", align: "right", sortValue: (r) => r.spendPaise, render: (r) => <span className="font-tabular">{formatMoney(r.spendPaise, { currency })}</span> },
    { key: "cpl", header: "Cost / Lead", align: "right", sortValue: (r) => r.costPerLeadPaise, render: (r) => <span className="font-tabular">{formatMoney(r.costPerLeadPaise, { currency })}</span> },
    { key: "rev", header: "Member Revenue", align: "right", sortValue: (r) => r.revenuePaise, render: (r) => <span className="font-tabular font-bold">{formatMoney(r.revenuePaise, { currency })}</span> },
    { key: "roi", header: "ROI", align: "right", sortValue: (r) => r.roiMultiplierPct, render: (r) => <span className="font-headline text-[16px] font-tabular text-[#C8372B]">{r.roiMultiplierPct}%</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// GROWTH ENGINE — DRAG-DROP PIPELINE & SLA"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">LEADS &amp; PIPELINE.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && branches[0] && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await roundRobinAssignLeadsAction(branches[0]!.id);
                  if (!res.ok) {
                    setToast({ msg: res.error, tone: "red" });
                    return;
                  }
                  setToast({ msg: `Round-Robin auto-assigned ${res.assignedCount} unassigned leads.`, tone: "blue" });
                })
              }
            >
              <Shuffle className="size-4" /> Round-Robin Assign
            </Button>
          )}
          <Button variant="tertiary" onClick={() => setQrOpen(true)}>
            <QrCode className="size-4" /> QR Poster
          </Button>
          <Link
            href={publicUrl}
            target="_blank"
            className="min-h-[48px] md:min-h-[40px] inline-flex items-center gap-2 border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-4 text-[13px] font-bold uppercase tracking-[0.08em] hover:bg-[#EBC95B] hover:text-[#151515]"
          >
            <ExternalLink className="size-4" /> Public Form
          </Link>
          {canWrite && (
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New Lead
            </Button>
          )}
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// ACTIVE PIPELINE" value={stats.active} subtext={`${stats.slaBreached} SLA breached`} accent="blue" />
        <StatTile label="// TRIALS SCHEDULED" value={stats.trials} subtext="Upcoming walkthroughs" accent="yellow" />
        <StatTile label="// WON CONVERSIONS" value={stats.won} subtext={`${stats.convRate}% funnel win rate`} accent="ink" />
        {canViewRoi && stats.topRoi ? (
          <StatTile
            label="// TOP ROI SOURCE"
            value={stats.topRoi.source.toUpperCase()}
            subtext={`${stats.topRoi.roiMultiplierPct}% ROI · ${stats.topRoi.conversionRatePct}% conv`}
            accent="red"
          />
        ) : (
          <StatTile label="// FUNNEL HEALTH" value={`${stats.convRate}%`} subtext="Pipeline conversion rate" accent="paper" />
        )}
      </div>

      {/* View Switcher & Filters */}
      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["KANBAN", "TABLE", ...(canViewRoi ? (["ROI"] as const) : []), "CAPTURE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "ROI" ? "SOURCE ROI" : t === "CAPTURE" ? "QR & EMBED" : t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lead name or phone..."
            aria-label="Search leads"
            className="bauhaus-input w-full sm:w-56"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by source"
            className="bauhaus-input w-auto"
          >
            <option value="ALL">ALL SOURCES</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label="Filter by stage"
            className="bauhaus-input w-auto"
          >
            <option value="ALL">ALL STAGES</option>
            {STAGES.map((st) => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>
        </div>
      </FilterBar>

      {/* Drag-and-Drop Kanban */}
      {tab === "KANBAN" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {STAGES.map((stage) => {
            const colLeads = filtered.filter((l) => l.stage === stage.id);
            const showAll = Boolean(expandedCols[stage.id]);
            const visibleLeads = showAll ? colLeads : colLeads.slice(0, 12);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage.id);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={() => handleDropToStage(stage.id)}
                className={clsx(
                  "bauhaus-card flex flex-col min-w-0 transition-colors",
                  dragOverStage === stage.id && "ring-4 ring-[#C8372B]"
                )}
              >
                <div className={clsx("border-b-2 border-[var(--border-ink)] px-3 py-2.5 flex items-center justify-between gap-2", stage.accent)}>
                  <span className="text-[12px] font-bold uppercase tracking-[0.08em] truncate">
                    {stage.label}
                  </span>
                  <span className="bg-[#FFFFFF] text-[#151515] border border-[#151515] px-1.5 py-0.5 text-[12px] font-tabular font-bold">
                    {colLeads.length}
                  </span>
                </div>
                <div className="p-2.5 space-y-2 max-h-[580px] overflow-y-auto">
                  {visibleLeads.map((lead) => {
                    const sla = evaluateLeadSlaStatus({
                      stage: lead.stage,
                      stageChangedAt: new Date(lead.stageChangedAt),
                    });
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        draggable={canWrite}
                        onDragStart={() => {
                          dragLeadRef.current = lead.id;
                        }}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="w-full text-left border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-2.5 hover:bg-[#EBC95B] hover:text-[#151515] space-y-1.5 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[14px] leading-tight break-words">{lead.fullName}</span>
                          <span className="bg-[#151515] text-[#EBC95B] px-1.5 py-0.5 text-[12px] font-tabular font-bold shrink-0">
                            {lead.score}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--fg-grey)] font-tabular">{lead.phone}</p>
                        {sla.breached && (
                          <p className="bg-[#C8372B] text-[#FFFFFF] px-1.5 py-0.5 text-[12px] font-bold uppercase inline-block">
                            {sla.label}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[12px]">
                          <span className="border border-[var(--border-ink)] px-1.5 font-bold uppercase">
                            {lead.source}
                          </span>
                          {lead.tasks.some((t) => t.status === "OPEN") && (
                            <span className="text-[#C8372B] font-bold uppercase">
                              {lead.tasks.filter((t) => t.status === "OPEN").length} TASK
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {colLeads.length > 12 && (
                    <button
                      type="button"
                      onClick={() => setExpandedCols((prev) => ({ ...prev, [stage.id]: !showAll }))}
                      className="w-full border border-[var(--border-ink)] bg-[var(--bg-surface)] py-1.5 text-[12px] font-bold uppercase hover:bg-[#151515] hover:text-[#FFFFFF]"
                    >
                      {showAll ? "Show top 12" : `Show all ${colLeads.length}`}
                    </button>
                  )}
                  {colLeads.length === 0 && (
                    <p className="text-[12px] text-[var(--fg-grey)] py-4 text-center uppercase font-bold">
                      Drop lead here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "TABLE" && (
        <DataTable
          title="SALES LEADS DIRECTORY"
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedLeadId(r.id)}
          selectable={canWrite}
          selectedKeys={selectedTableIds}
          onSelectionChange={setSelectedTableIds}
          bulkBar={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value as LeadStageType)}
                className="border-2 border-[#151515] bg-[#FFFFFF] text-[#151515] px-2 py-1 text-[12px] font-bold"
              >
                {STAGES.map((st) => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
              <Button
                density="dense"
                variant="primary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await bulkLeadStageMoveAction({ leadIds: selectedTableIds, stage: bulkStage });
                    if (res.ok) {
                      setSelectedTableIds([]);
                      setToast({ msg: `Moved ${res.moved} leads to ${bulkStage}.`, tone: "blue" });
                    }
                  })
                }
              >
                Bulk Move Stage
              </Button>
            </div>
          }
        />
      )}

      {tab === "ROI" && canViewRoi && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setSpendOpen(true)}>
              <Plus className="size-4" /> Log Channel Ad Spend
            </Button>
          </div>
          <DataTable
            title="CHANNEL COST & REVENUE ATTRIBUTION"
            rows={roiRows}
            columns={roiColumns}
            rowKey={(r) => r.source}
          />
        </div>
      )}

      {tab === "CAPTURE" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bauhaus-card p-6 space-y-4">
            <p className="bauhaus-label text-[#C8372B]">{"// PRINTABLE FRONT-DESK & POSTER QR"}</p>
            <h2 className="font-headline text-[24px]">Standee Walk-in QR Poster</h2>
            <p className="text-[14px] text-[var(--fg-grey)]">
              Place on reception standees, Instagram bio, and society elevator flyers. Directs straight into{" "}
              <code className="font-bold">{publicUrl}</code>.
            </p>
            <div className="border-2 border-[#151515] bg-[#FFFFFF] text-[#151515] p-5 flex flex-wrap items-center gap-6">
              <QRCode value={`http://localhost:3001${publicUrl}`} size={160} label={orgName} />
              <div className="space-y-2 max-w-xs">
                <p className="font-headline text-[22px] text-[#C8372B]">CLAIM FREE TRIAL.</p>
                <p className="text-[14px] font-bold">Scan with camera — takes 20 seconds.</p>
                <p className="text-[12px] uppercase tracking-[0.08em]">{orgName}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setQrOpen(true)}>
              <Printer className="size-4" /> Open Print Poster View
            </Button>
          </div>

          <div className="bauhaus-card p-6 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC]">{"// WEBSITE EMBED WIDGET"}</p>
            <h2 className="font-headline text-[24px]">Embeddable Iframe Snippet</h2>
            <p className="text-[14px] text-[var(--fg-grey)]">
              Drop onto your marketing landing page or link-in-bio page. Submissions automatically run duplicate checks.
            </p>
            <div className="border-2 border-[var(--border-ink)] bg-[#151515] text-[#EBC95B] p-4 font-mono text-[13px] break-all flex items-start gap-2">
              <Code2 className="size-4 shrink-0 mt-0.5" />
              <span>{embedSnippet}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="blue"
                onClick={() => {
                  navigator.clipboard?.writeText(embedSnippet);
                  setToast({ msg: "Embed snippet copied.", tone: "blue" });
                }}
              >
                Copy Embed HTML
              </Button>
              <Link
                href={publicUrl}
                target="_blank"
                className="min-h-[40px] inline-flex items-center gap-2 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-4 text-[13px] font-bold uppercase"
              >
                Test Form Live <ExternalLink className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Log Ad Spend Modal */}
      <Modal open={spendOpen} onClose={() => setSpendOpen(false)} eyebrow="MARKETING LEDGER" title="Log Monthly Ad Spend">
        <div className="space-y-4">
          <select
            className="bauhaus-input"
            value={spendSource}
            onChange={(e) => setSpendSource(e.target.value as (typeof SOURCES)[number])}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={spendRupees}
            onChange={(e) => setSpendRupees(e.target.value)}
            placeholder="Spend in INR"
            className="bauhaus-input font-tabular font-bold"
          />
          <Button
            variant="primary"
            fullWidth
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await upsertAdSpendCampaignAction({
                  branchId: leadBranchId || null,
                  source: spendSource,
                  monthYm: new Date().toISOString().slice(0, 7),
                  spendPaise: Math.round((Number(spendRupees) || 0) * 100),
                });
                setSpendOpen(false);
                setToast({ msg: `Logged ${spendSource} ad spend for ROI tracking.`, tone: "blue" });
              })
            }
          >
            Save Ad Spend Entry
          </Button>
        </div>
      </Modal>

      {/* New Lead Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} eyebrow="ADD PROSPECT" title="New Sales Lead">
        <div className="space-y-4">
          {dupAlert && (
            <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-4 space-y-2">
              <div className="flex items-start gap-2 font-bold text-[14px]">
                <AlertTriangle className="size-5 text-[#C8372B] shrink-0" />
                <span>{dupAlert}</span>
              </div>
              <Button variant="primary" onClick={() => handleCreateLead(true)} disabled={pending}>
                Create Separate Lead Anyway
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nl-branch" className="bauhaus-label block mb-1.5">{"// BRANCH"}</label>
              <select
                id="nl-branch"
                className="bauhaus-input"
                value={leadBranchId}
                onChange={(e) => setLeadBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nl-source" className="bauhaus-label block mb-1.5">{"// SOURCE"}</label>
              <select
                id="nl-source"
                className="bauhaus-input"
                value={source}
                onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nl-name" className="bauhaus-label block mb-1.5">{"// FULL NAME"}</label>
              <input id="nl-name" className="bauhaus-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Rohan Sharma" />
            </div>
            <div>
              <label htmlFor="nl-phone" className="bauhaus-label block mb-1.5">{"// PHONE NUMBER"}</label>
              <input id="nl-phone" className="bauhaus-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98450 11223" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nl-email" className="bauhaus-label block mb-1.5">{"// EMAIL"}</label>
              <input id="nl-email" type="email" className="bauhaus-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nl-trial" className="bauhaus-label block mb-1.5">{"// TRIAL TOUR SLOT"}</label>
              <input id="nl-trial" type="datetime-local" className="bauhaus-input" value={trialAt} onChange={(e) => setTrialAt(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="nl-notes" className="bauhaus-label block mb-1.5">{"// GOAL / NOTES"}</label>
            <input id="nl-notes" className="bauhaus-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interested in Strength Quarterly + morning coaching" />
          </div>

          <Button variant="primary" density="hero" fullWidth disabled={pending} onClick={() => handleCreateLead(false)}>
            {pending ? "SAVING LEAD..." : "SAVE TO PIPELINE"}
          </Button>
        </div>
      </Modal>

      {/* Print QR Poster Modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} eyebrow="PRINT POSTER" title="Bauhaus Lead Capture Standee">
        <div className="border-[3px] border-[#151515] bg-[#FFFFFF] text-[#151515] p-6 space-y-5">
          <div className="flex items-center justify-between border-b-2 border-[#151515] pb-3">
            <span className="font-headline text-[24px]">{orgName}</span>
            <span className="bg-[#C8372B] text-[#FFFFFF] px-2 py-1 text-[12px] font-bold uppercase">FREE TRIAL</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <QRCode value={`http://localhost:3001${publicUrl}`} size={200} />
            <div className="space-y-3">
              <h3 className="font-headline text-[32px] leading-none">TRAIN WITH US TODAY.</h3>
              <p className="text-[14px] font-bold">
                Scan to book your 1-day guest pass + baseline movement screening.
              </p>
              <p className="text-[12px] uppercase tracking-[0.1em] border-t-2 border-[#151515] pt-2">
                {publicUrl}
              </p>
            </div>
          </div>
          <div className="no-print flex justify-end gap-2 pt-2">
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="size-4" /> Print A4 Poster
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lead Detail Drawer */}
      <Drawer
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLeadId(null)}
        eyebrow={selectedLead ? `${selectedLead.source} · SCORE ${selectedLead.score}` : ""}
        title={selectedLead?.fullName ?? "Lead Detail"}
      >
        {selectedLead && (
          <div className="space-y-5">
            <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-tabular font-bold text-[15px]">{selectedLead.phone}</span>
                <span className="bg-[#151515] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                  {selectedLead.stage.replace("_", " ")}
                </span>
              </div>
              {selectedLead.email && <p className="text-[13px] text-[var(--fg-grey)]">{selectedLead.email}</p>}
              {selectedLead.notes && <p className="text-[13px] pt-1">{selectedLead.notes}</p>}
              {selectedLead.lostReason && (
                <p className="text-[13px] font-bold text-[#C8372B]">LOST REASON: {selectedLead.lostReason}</p>
              )}
              {selectedLead.convertedMemberId && (
                <Link
                  href={`/app/members/${selectedLead.convertedMemberId}`}
                  className="inline-flex items-center gap-1.5 bg-[#2B4BCC] text-[#FFFFFF] px-3 py-1.5 text-[12px] font-bold uppercase mt-1"
                >
                  Open Member Profile <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>

            {canWrite && (
              <>
                <div className="border-2 border-[var(--border-ink)] p-4 space-y-2">
                  <p className="bauhaus-label">{"// SALES OWNER"}</p>
                  <select
                    className="bauhaus-input"
                    value={selectedLead.ownerId ?? ""}
                    onChange={(e) => {
                      const nextOwner = e.target.value;
                      startTransition(async () => {
                        await assignLeadOwnerAction({ leadId: selectedLead.id, ownerId: nextOwner });
                        setToast({ msg: "Lead owner reassigned.", tone: "blue" });
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border-2 border-[var(--border-ink)] p-4 space-y-3">
                  <p className="bauhaus-label">{"// MOVE STAGE / BOOK TRIAL"}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STAGES.filter((s) => s.id !== "WON").map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await updateLeadStageAction({
                              leadId: selectedLead.id,
                              stage: st.id,
                              lostReason: st.id === "LOST" ? lostReasonInput : undefined,
                              trialAt: st.id === "TRIAL_BOOKED" && trialInput ? trialInput : undefined,
                            });
                            if (!res.ok) {
                              setToast({ msg: res.error, tone: "red" });
                              return;
                            }
                            setToast({ msg: `Moved to ${st.label}.`, tone: "ink" });
                          });
                        }}
                        className={clsx(
                          "min-h-[40px] border-2 border-[var(--border-ink)] px-2 text-[12px] font-bold uppercase",
                          selectedLead.stage === st.id ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)] hover:bg-[#EBC95B]"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <input
                      type="datetime-local"
                      aria-label="Trial booking date"
                      className="bauhaus-input"
                      value={trialInput}
                      onChange={(e) => setTrialInput(e.target.value)}
                    />
                    <input
                      type="text"
                      aria-label="Lost reason"
                      className="bauhaus-input"
                      placeholder="Lost reason (for LOST stage)"
                      value={lostReasonInput}
                      onChange={(e) => setLostReasonInput(e.target.value)}
                    />
                  </div>
                </div>

                {!selectedLead.convertedMemberId && (
                  <div className="border-[3px] border-[#151515] bg-[#EBC95B] text-[#151515] p-4 space-y-3">
                    <p className="text-[12px] font-bold uppercase tracking-[0.1em]">{"// 1-CLICK CONVERT TO MEMBER"}</p>
                    <select
                      aria-label="Membership Plan for Conversion"
                      className="bauhaus-input"
                      value={convertPlanId}
                      onChange={(e) => setConvertPlanId(e.target.value)}
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatMoney(p.pricePaise, { currency })} / {p.durationDays}d)
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-[13px] font-bold">
                      <input
                        type="checkbox"
                        checked={collectNow}
                        onChange={(e) => setCollectNow(e.target.checked)}
                        className="size-4"
                      />
                      Mark initial invoice PAID via UPI right now
                    </label>
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await convertLeadToMemberAction({
                            leadId: selectedLead.id,
                            planId: convertPlanId,
                            collectNow,
                          });
                          if (!res.ok) {
                            setToast({ msg: res.error, tone: "red" });
                            return;
                          }
                          setToast({ msg: `Converted to member ${res.memberCode ?? ""}!`, tone: "blue" });
                        });
                      }}
                    >
                      <UserPlus className="size-4" /> CONVERT &amp; CREATE MEMBER
                    </Button>
                  </div>
                )}

                <div className="border-2 border-[var(--border-ink)] p-4 space-y-3">
                  <p className="bauhaus-label">{"// FOLLOW-UP TASKS"}</p>
                  <div className="flex gap-2">
                    <input
                      className="bauhaus-input flex-1"
                      placeholder="Add call/WhatsApp follow-up..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await addLeadTaskAction({
                            leadId: selectedLead.id,
                            title: taskTitle,
                            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
                          });
                          if (!res.ok) {
                            setToast({ msg: res.error, tone: "red" });
                            return;
                          }
                          setTaskTitle("");
                        });
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="divide-y divide-[var(--border-ink)]">
                    {selectedLead.tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => startTransition(() => { void toggleLeadTaskAction(t.id); })}
                        className="w-full py-2 flex items-center justify-between gap-2 text-left text-[13px]"
                      >
                        <span className={clsx(t.status === "DONE" && "line-through text-[var(--fg-grey)]")}>
                          {t.title}
                        </span>
                        <span className="border border-[#151515] px-1.5 py-0.5 text-[12px] font-bold uppercase shrink-0">
                          {t.status === "DONE" ? <Check className="size-3.5 inline" /> : <Calendar className="size-3.5 inline" />} {t.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
