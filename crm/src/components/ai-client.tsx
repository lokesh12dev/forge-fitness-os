"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Ban, Check, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile, Toast } from "@/components/ui/primitives";
import {
  approveAiDraftAction,
  askOrgAiAssistantAction,
} from "@/app/actions/phase34-actions";
import { dismissAiDraftAction } from "@/app/actions/world-class-actions";

interface AiLogRow {
  id: string;
  prompt: string;
  response: string;
  citations: Array<{ source: string; metric: string }>;
  draftAction: {
    type: "CREATE_TASK" | "DRAFT_WHATSAPP";
    title: string;
    payloadText: string;
  } | null;
  approvalStatus: string;
  tokensUsed: number;
  createdAt: string;
}

const PRESET_PROMPTS = [
  "What is today's collection and overdue INR status?",
  "Who needs urgent churn save outreach right now?",
  "Check open leads pipeline and low-stock inventory alerts",
  "Summarize renewal urgency over the next 7 days and draft retention nudge",
];

export function AiClient({
  role,
  canAccessFinance,
  orgName,
  logs,
}: {
  role: string;
  canAccessFinance: boolean;
  orgName: string;
  logs: AiLogRow[];
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(
    canAccessFinance ? PRESET_PROMPTS[0]! : PRESET_PROMPTS[1]!
  );
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAsk = (text: string) => {
    startTransition(async () => {
      const res = await askOrgAiAssistantAction(text);
      if (!res.ok) {
        setToast({ msg: res.error, tone: "red" });
        return;
      }
      setToast({ msg: "Grounded answer generated with DB citations.", tone: "blue" });
      router.refresh();
    });
  };

  const totalTokens = logs.reduce((s, l) => s + l.tokensUsed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// TOOL-GROUNDED ORG INTELLIGENCE + APPROVAL GATE"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">ORG AI COPILOT.</h1>
        </div>
        <span className="border-2 border-[var(--border-ink)] bg-[#151515] text-[#EBC95B] px-3 py-1.5 text-[12px] font-bold uppercase">
          <ShieldCheck className="size-4 inline mr-1" /> RBAC SCOPED ({role}) · TENANT: {orgName}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="// GROUNDED QUERIES" value={logs.length} subtext="Every answer backed by DB tool reads" accent="blue" />
        <StatTile label="// HUMAN APPROVALS" value={logs.filter((l) => l.approvalStatus === "APPROVED").length} subtext="Drafts only run on staff click" accent="yellow" />
        <StatTile label="// TOKEN BUDGET USED" value={totalTokens} subtext="Scoped per org workspace" accent="ink" />
      </div>

      {/* Prompt Composer */}
      <div className="bauhaus-card p-5 space-y-4">
        <p className="bauhaus-label text-[#2B4BCC]">{"// ASK ABOUT LIVE OPERATIONS OR DRAFT AN ACTION"}</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPrompt(p);
                handleAsk(p);
              }}
              className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 py-1.5 text-[12px] font-bold hover:bg-[#EBC95B] text-left"
            >
              <Sparkles className="size-3.5 inline mr-1" /> {p}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            aria-label="AI Copilot Question"
            className="bauhaus-input flex-1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about overdue dues, churn risk members, or low stock..."
          />
          <Button variant="primary" disabled={pending || !prompt.trim()} onClick={() => handleAsk(prompt)}>
            <Send className="size-4" /> Ask Scoped Copilot
          </Button>
        </div>
      </div>

      {/* Response & Human Approval Stream */}
      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="bauhaus-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--border-ink)]/25 pb-2">
              <p className="font-bold text-[15px]">Q: {log.prompt}</p>
              <span className="text-[12px] font-tabular text-[var(--fg-grey)]">{log.tokensUsed} tokens</span>
            </div>

            <p className="text-[15px] leading-relaxed">{log.response}</p>

            {/* Grounded Tool Citations */}
            <div className="flex flex-wrap gap-2">
              {log.citations.map((c, idx) => (
                <span key={idx} className="border border-[#151515] bg-[var(--bg-paper)] px-2.5 py-1 text-[12px] font-bold">
                  SOURCE: {c.source} → <span className="text-[#2B4BCC]">{c.metric}</span>
                </span>
              ))}
            </div>

            {/* Human-Approval Draft Card */}
            {log.draftAction && (
              <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <p className="text-[12px] font-bold uppercase tracking-[0.1em]">
                    {"// DRAFTED ACTION ("}{log.draftAction.type}{")"}
                  </p>
                  <p className="font-bold text-[14px]">{log.draftAction.title}</p>
                  <p className="text-[13px] opacity-90">{log.draftAction.payloadText}</p>
                </div>
                {log.approvalStatus === "APPROVED" ? (
                  <span className="bg-[#2B4BCC] text-[#FFFFFF] px-3 py-1.5 border border-[#151515] text-[12px] font-bold uppercase">
                    <Check className="size-3.5 inline mr-1" /> APPROVED &amp; EXECUTED
                  </span>
                ) : log.approvalStatus === "DISMISSED" ? (
                  <span className="bg-[#151515] text-[#FFFFFF] px-3 py-1.5 border border-[#151515] text-[12px] font-bold uppercase">
                    <Ban className="size-3.5 inline mr-1" /> DISMISSED
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        const res = await approveAiDraftAction(log.id);
                        if (!res.ok) {
                          setToast({ msg: res.error, tone: "red" });
                          return;
                        }
                        setToast({ msg: clsx("Draft action approved & logged:", log.draftAction?.title), tone: "blue" });
                        router.refresh();
                      })}
                    >
                      Approve &amp; Execute
                    </Button>
                    <Button
                      variant="tertiary"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        const res = await dismissAiDraftAction(log.id);
                        if (res.ok) {
                          setToast({ msg: "AI draft dismissed.", tone: "ink" });
                          router.refresh();
                        }
                      })}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
