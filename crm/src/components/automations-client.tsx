"use client";

import React, { useState, useTransition } from "react";
import { clsx } from "clsx";
import { ArrowRight, Play, Plus, ShieldAlert, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Modal, StatTile, Toast } from "@/components/ui/primitives";
import {
  createAutomationRuleAction,
  runAutomationDryRunAction,
  toggleAutomationRuleAction,
} from "@/app/actions/phase2-actions";
import { runAllActiveAutomationsCronPulseAction } from "@/app/actions/world-class-actions";

interface RuleItem {
  id: string;
  name: string;
  triggerKey: string;
  conditionLabel: string;
  actionChannel: string;
  messageTemplate: string;
  delayMinutes: number;
  maxPerMemberDays: number;
  quietStartHour: number;
  quietEndHour: number;
  isActive: boolean;
}

interface RunItem {
  id: string;
  ruleName: string;
  triggerKey: string;
  mode: string;
  matchedCount: number;
  dispatchedCount: number;
  skippedOptOutCount: number;
  skippedCapCount: number;
  skippedQuietHours: boolean;
  executedAt: string;
}

interface DryRunResultState {
  ruleName: string;
  mode: string;
  matchedCount: number;
  eligibleCount: number;
  dispatchedCount: number;
  skippedOptOutCount: number;
  skippedCapCount: number;
  inQuietHours: boolean;
  istHour: number;
  sampleMessages: Array<{ memberName: string; phone: string; rendered: string }>;
}

const TRIGGERS = [
  { key: "WELCOME_SERIES", label: "Day-1 Welcome Series" },
  { key: "EXPIRY_T7", label: "Expiry Reminder T-7" },
  { key: "EXPIRY_T3", label: "Expiry Reminder T-3" },
  { key: "EXPIRY_T0", label: "Expiry Alert T-0" },
  { key: "EXPIRY_T_PLUS_3", label: "Grace Follow-Up T+3" },
  { key: "PAYMENT_DUE", label: "Payment Due & Failed Auto-Dunning" },
  { key: "MISSED_WORKOUT", label: "Missed Workout Nudge (7+ Days)" },
  { key: "BIRTHDAY", label: "Birthday Gift Perk" },
  { key: "WINBACK_30D", label: "Win-Back After 30 Days" },
  { key: "FEEDBACK_5TH_VISIT", label: "5th Visit Milestone Feedback" },
  { key: "REFERRAL_THANKYOU", label: "Referral Thank-You Credit" },
];

export function AutomationsClient({
  rules,
  runs,
}: {
  rules: RuleItem[];
  runs: RunItem[];
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [dryPreview, setDryPreview] = useState<DryRunResultState | null>(null);
  const [testHourMode, setTestHourMode] = useState<"NOW" | "DAY_14" | "QUIET_22">("DAY_14");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Visual Rule Builder state
  const [name, setName] = useState("Trial Walkthrough No-Show Follow-Up");
  const [triggerKey, setTriggerKey] = useState("MISSED_WORKOUT");
  const [conditionLabel, setConditionLabel] = useState("No visit >= 7 days");
  const [actionChannel, setActionChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [maxPerMemberDays, setMaxPerMemberDays] = useState(7);
  const [quietStartHour, setQuietStartHour] = useState(21);
  const [quietEndHour, setQuietEndHour] = useState(8);
  const [messageTemplate, setMessageTemplate] = useState(
    "Hey {name}, missed seeing you at {branch}! Want us to save a quick 30-min coach reset this week?"
  );

  const selectedTestHour =
    testHourMode === "DAY_14" ? 14 : testHourMode === "QUIET_22" ? 22 : undefined;

  const runRule = (rule: RuleItem, mode: "DRY_RUN" | "LIVE") => {
    startTransition(async () => {
      const res = await runAutomationDryRunAction({
        ruleId: rule.id,
        mode,
        testHourIst: selectedTestHour,
      });
      if (!res.ok) {
        setToast({ msg: res.error, tone: "red" });
        return;
      }
      setDryPreview({
        ruleName: rule.name,
        mode: res.mode,
        matchedCount: res.matchedCount,
        eligibleCount: res.eligibleCount,
        dispatchedCount: res.dispatchedCount,
        skippedOptOutCount: res.skippedOptOutCount,
        skippedCapCount: res.skippedCapCount,
        inQuietHours: res.inQuietHours,
        istHour: res.istHour,
        sampleMessages: res.sampleMessages,
      });
      setToast({
        msg:
          mode === "DRY_RUN"
            ? `Dry-Run simulated: ${res.eligibleCount} eligible (${res.skippedCapCount} capped, ${res.skippedOptOutCount} opt-out).`
            : res.inQuietHours
            ? "Quiet hours active (21:00-08:00 IST) — live dispatch safely held."
            : `Live run sent ${res.dispatchedCount} messages.`,
        tone: res.inQuietHours ? "yellow" : "blue",
      });
    });
  };

  const runColumns: DataColumn<RunItem>[] = [
    { key: "rule", header: "Automation Rule", render: (r) => <span className="font-bold">{r.ruleName}</span> },
    {
      key: "mode",
      header: "Mode",
      render: (r) => (
        <span
          className={clsx(
            "px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase",
            r.mode === "DRY_RUN" ? "bg-[#EBC95B] text-[#151515]" : "bg-[#2B4BCC] text-[#FFFFFF]"
          )}
        >
          {r.mode}
        </span>
      ),
    },
    { key: "matched", header: "Matched", align: "right", render: (r) => <span className="font-tabular font-bold">{r.matchedCount}</span> },
    { key: "sent", header: "Dispatched", align: "right", render: (r) => <span className="font-tabular font-bold text-[#2B4BCC]">{r.dispatchedCount}</span> },
    { key: "cap", header: "Cap Skipped", align: "right", render: (r) => <span className="font-tabular">{r.skippedCapCount}</span> },
    { key: "opt", header: "Opt-Out Skipped", align: "right", render: (r) => <span className="font-tabular">{r.skippedOptOutCount}</span> },
    {
      key: "quiet",
      header: "Quiet Guard",
      render: (r) => (
        <span className={clsx("text-[12px] font-bold uppercase", r.skippedQuietHours ? "text-[#C8372B]" : "text-[var(--fg-grey)]")}>
          {r.skippedQuietHours ? "HELD (QUIET HOURS)" : "OK"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// VISUAL WORKFLOW ENGINE — CAP & QUIET HOURS"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">AUTOMATIONS.</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Clock simulation window"
            className="bauhaus-input w-auto"
            value={testHourMode}
            onChange={(e) => setTestHourMode(e.target.value as "NOW" | "DAY_14" | "QUIET_22")}
          >
            <option value="DAY_14">Simulate 14:00 IST (Open)</option>
            <option value="QUIET_22">Simulate 22:00 IST (Quiet Hours)</option>
            <option value="NOW">Live System Clock</option>
          </select>
          <Button
            variant="blue"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await runAllActiveAutomationsCronPulseAction();
                setToast({
                  msg: `Cron Pulse ran ${res.rulesExecuted} active rules -> ${res.totalDispatched} dispatches sent cleanly.`,
                  tone: "blue",
                });
              })
            }
          >
            <Play className="size-4" /> Run Cron Pulse
          </Button>
          <Button variant="primary" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-4" /> Build Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// ACTIVE RULES" value={rules.filter((r) => r.isActive).length} subtext={`${rules.length} total recipes`} accent="blue" />
        <StatTile label="// FREQUENCY CAP" value="7 DAYS" subtext="Default cooldown per member" accent="yellow" />
        <StatTile label="// QUIET HOURS GUARD" value="21:00–08:00" subtext="IST Do-Not-Disturb enforcement" accent="ink" />
        <StatTile label="// EXECUTION LOGS" value={runs.length} subtext="Dry-run + Live audit trail" accent="paper" />
      </div>

      {/* Live Dry-Run / Guard Output Panel */}
      {dryPreview && (
        <div className="bauhaus-card border-[3px] border-[#151515] p-5 bg-[var(--bg-surface)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--border-ink)] pb-3">
            <div>
              <p className="bauhaus-label text-[#2B4BCC]">{`// ${dryPreview.mode} RESULT — IST HOUR ${dryPreview.istHour}:00`}</p>
              <h2 className="font-headline text-[22px]">{dryPreview.ruleName}</h2>
            </div>
            {dryPreview.inQuietHours && (
              <span className="inline-flex items-center gap-1.5 bg-[#C8372B] text-[#FFFFFF] px-3 py-1 text-[12px] font-bold uppercase">
                <ShieldAlert className="size-4" /> QUIET HOURS ACTIVE (DISPATCH BLOCKED)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px] font-bold">
            <div className="border-2 border-[var(--border-ink)] p-3">MATCHED: <span className="font-headline text-[20px] block">{dryPreview.matchedCount}</span></div>
            <div className="border-2 border-[var(--border-ink)] p-3">ELIGIBLE: <span className="font-headline text-[20px] block text-[#2B4BCC]">{dryPreview.eligibleCount}</span></div>
            <div className="border-2 border-[var(--border-ink)] p-3">DISPATCHED: <span className="font-headline text-[20px] block">{dryPreview.dispatchedCount}</span></div>
            <div className="border-2 border-[var(--border-ink)] p-3">OPT-OUT SKIP: <span className="font-headline text-[20px] block text-[#C8372B]">{dryPreview.skippedOptOutCount}</span></div>
            <div className="border-2 border-[var(--border-ink)] p-3">CAP SKIP: <span className="font-headline text-[20px] block">{dryPreview.skippedCapCount}</span></div>
          </div>
          {dryPreview.sampleMessages.length > 0 && (
            <div className="space-y-2">
              <p className="bauhaus-label">{"// PREVIEW RENDERED MESSAGES"}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {dryPreview.sampleMessages.map((sm, idx) => (
                  <div key={idx} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3 text-[13px]">
                    <p className="font-bold">{sm.memberName} ({sm.phone})</p>
                    <p className="text-[var(--fg-grey)] mt-1">{sm.rendered}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Rule Flow Cards */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="bauhaus-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-headline text-[20px]">{rule.name}</h3>
                  <span
                    className={clsx(
                      "px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase",
                      rule.isActive ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#6F6B61] text-[#FFFFFF]"
                    )}
                  >
                    {rule.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--fg-grey)] mt-1">{rule.messageTemplate}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="yellow" disabled={pending} onClick={() => runRule(rule, "DRY_RUN")}>
                  <TestTube2 className="size-4" /> Dry-Run
                </Button>
                <Button variant="primary" disabled={pending || !rule.isActive} onClick={() => runRule(rule, "LIVE")}>
                  <Play className="size-4" /> Execute Now
                </Button>
                <Button
                  variant="tertiary"
                  disabled={pending}
                  onClick={() => startTransition(() => { void toggleAutomationRuleAction(rule.id); })}
                >
                  {rule.isActive ? "Pause" : "Enable"}
                </Button>
              </div>
            </div>

            {/* Bauhaus Visual Flow Nodes: Trigger -> Condition -> Delay -> Action -> Guards */}
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase">
              <div className="border-2 border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] px-3 py-1.5">
                TRIGGER: {rule.triggerKey}
              </div>
              <ArrowRight className="size-4 shrink-0" />
              <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-3 py-1.5">
                IF: {rule.conditionLabel}
              </div>
              <ArrowRight className="size-4 shrink-0" />
              <div className="border-2 border-[#151515] bg-[var(--bg-paper)] px-3 py-1.5">
                DELAY: {rule.delayMinutes}m
              </div>
              <ArrowRight className="size-4 shrink-0" />
              <div className="border-2 border-[#151515] bg-[#151515] text-[#FFFFFF] px-3 py-1.5">
                SEND {rule.actionChannel}
              </div>
              <ArrowRight className="size-4 shrink-0" />
              <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] px-3 py-1.5">
                CAP {rule.maxPerMemberDays}d · QUIET {rule.quietStartHour}:00–{rule.quietEndHour}:00
              </div>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        title="AUTOMATION RUN AUDIT LEDGER"
        rows={runs}
        columns={runColumns}
        rowKey={(r) => r.id}
      />

      {/* Visual Workflow Builder Modal */}
      <Modal open={builderOpen} onClose={() => setBuilderOpen(false)} eyebrow="VISUAL RULE BUILDER" title="New Automation Flow">
        <div className="space-y-4">
          <div>
            <label htmlFor="au-name" className="bauhaus-label block mb-1.5">{"// RULE NAME"}</label>
            <input id="au-name" className="bauhaus-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="au-trig" className="bauhaus-label block mb-1.5">{"// TRIGGER EVENT"}</label>
              <select id="au-trig" className="bauhaus-input" value={triggerKey} onChange={(e) => setTriggerKey(e.target.value)}>
                {TRIGGERS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="au-ch" className="bauhaus-label block mb-1.5">{"// ACTION CHANNEL"}</label>
              <select id="au-ch" className="bauhaus-input" value={actionChannel} onChange={(e) => setActionChannel(e.target.value as "WHATSAPP" | "SMS" | "EMAIL")}>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">EMAIL</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="au-cond" className="bauhaus-label block mb-1.5">{"// CONDITION RULE LABEL"}</label>
            <input id="au-cond" className="bauhaus-input" value={conditionLabel} onChange={(e) => setConditionLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="au-del" className="bauhaus-label block mb-1.5">{"// DELAY (M)"}</label>
              <input id="au-del" type="number" min={0} className="bauhaus-input" value={delayMinutes} onChange={(e) => setDelayMinutes(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="au-cap" className="bauhaus-label block mb-1.5">{"// CAP (DAYS)"}</label>
              <input id="au-cap" type="number" min={1} className="bauhaus-input" value={maxPerMemberDays} onChange={(e) => setMaxPerMemberDays(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="au-qs" className="bauhaus-label block mb-1.5">{"// QUIET START"}</label>
              <input id="au-qs" type="number" min={0} max={23} className="bauhaus-input" value={quietStartHour} onChange={(e) => setQuietStartHour(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="au-qe" className="bauhaus-label block mb-1.5">{"// QUIET END"}</label>
              <input id="au-qe" type="number" min={0} max={23} className="bauhaus-input" value={quietEndHour} onChange={(e) => setQuietEndHour(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label htmlFor="au-msg" className="bauhaus-label block mb-1.5">{"// PERSONALIZED TEMPLATE"}</label>
            <textarea id="au-msg" rows={3} className="bauhaus-input h-auto py-2" value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} />
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await createAutomationRuleAction({
                  name,
                  triggerKey,
                  conditionLabel,
                  actionChannel,
                  messageTemplate,
                  delayMinutes,
                  maxPerMemberDays,
                  quietStartHour,
                  quietEndHour,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setBuilderOpen(false);
                setToast({ msg: "Workflow rule created & activated.", tone: "blue" });
              });
            }}
          >
            SAVE AUTOMATION WORKFLOW
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
