"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, MessageSquare, Plus, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { interpolateTemplateVars, type SegmentKey } from "@/lib/segments";
import {
  approveTemplateMockAction,
  assignInboxThreadAction,
  createTemplateAction,
  launchBroadcastCampaignAction,
  markInboxThreadReadAction,
  sendInboxReplyAction,
  simulateInboundMemberReplyAction,
} from "@/app/actions/phase2-actions";

interface ThreadItem {
  id: string;
  contactName: string;
  contactPhone: string;
  channel: string;
  branchName: string;
  assignedToId: string | null;
  assignedToName: string;
  unreadCount: number;
  lastPreview: string;
  lastMessageAt: string;
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    status: string;
    senderName: string;
    createdAt: string;
  }>;
}

interface TemplateItem {
  id: string;
  code: string;
  name: string;
  channel: "WHATSAPP" | "SMS" | "EMAIL" | string;
  body: string;
  variables: string[];
  approvalStatus: string;
}

interface CampaignItem {
  id: string;
  name: string;
  segmentKey: string;
  channel: string;
  throttlePerMin: number;
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  blockedOptOutCount: number;
  scheduledAt: string;
}

const SEGMENTS: Array<{ key: SegmentKey; label: string }> = [
  { key: "EXPIRING", label: "Expiring <= 7d" },
  { key: "INACTIVE", label: "Inactive >= 14d" },
  { key: "UNPAID", label: "Unpaid / Dues" },
  { key: "PT_CLIENTS", label: "PT Pack Clients" },
  { key: "BIRTHDAY", label: "Birthday Today" },
  { key: "NEW_JOINERS", label: "New Joiners <= 14d" },
];

export function InboxClient({
  canWriteInbox,
  canBroadcast,
  activeBranchId,
  staff,
  segmentCounts,
  consentSummary,
  threads,
  templates,
  campaigns,
}: {
  canWriteInbox: boolean;
  canBroadcast: boolean;
  activeBranchId: string | null;
  staff: Array<{ id: string; name: string }>;
  segmentCounts: Record<SegmentKey, { matched: number; eligible: number; optedOut: number }>;
  consentSummary: { totalOptedIn: number; totalOptedOut: number };
  threads: ThreadItem[];
  templates: TemplateItem[];
  campaigns: CampaignItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"INBOX" | "BROADCAST" | "TEMPLATES">("INBOX");
  const [selectedThreadId, setSelectedThreadId] = useState<string>(threads[0]?.id ?? "");
  const [replyText, setReplyText] = useState("");
  const [simInboundText, setSimInboundText] = useState("Hi, can I pay my renewal via UPI QR right now?");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Broadcast builder state
  const [campName, setCampName] = useState("Weekend Renewal & Slot Reminder");
  const [segmentKey, setSegmentKey] = useState<SegmentKey>("EXPIRING");
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [throttle, setThrottle] = useState(45);
  const [campBody, setCampBody] = useState(
    templates[1]?.body ?? "Hi {name}, your {plan} at {branch} expires on {expiry}. Renew now to save ₹500."
  );

  // New Template modal state
  const [tplOpen, setTplOpen] = useState(false);
  const [tplCode, setTplCode] = useState("TRIAL_FOLLOWUP_1");
  const [tplName, setTplName] = useState("Post-Trial 24h Follow-Up");
  const [tplChannel, setTplChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [tplBody, setTplBody] = useState(
    "Hey {name}, loved having you at {branch}! Lock in {plan} before {expiry} for ₹500 joining fee waiver."
  );

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId]
  );

  const segStat = segmentCounts[segmentKey];
  const unreadTotal = threads.reduce((acc, t) => acc + t.unreadCount, 0);

  const campaignColumns: DataColumn<CampaignItem>[] = [
    { key: "name", header: "Campaign", render: (r) => <span className="font-bold">{r.name}</span> },
    { key: "seg", header: "Segment", render: (r) => <span className="border border-[#151515] px-1.5 py-0.5 text-[12px] font-bold uppercase">{r.segmentKey}</span> },
    { key: "ch", header: "Channel", render: (r) => <span className="text-[12px] font-bold uppercase">{r.channel}</span> },
    { key: "sent", header: "Sent / Deliv", align: "right", render: (r) => <span className="font-tabular font-bold">{r.sentCount} / {r.deliveredCount}</span> },
    { key: "read", header: "Read / Reply", align: "right", render: (r) => <span className="font-tabular font-bold text-[#2B4BCC]">{r.readCount} / {r.repliedCount}</span> },
    { key: "optout", header: "Opt-Out Skipped", align: "right", render: (r) => <span className="font-tabular font-bold text-[#C8372B]">{r.blockedOptOutCount}</span> },
    { key: "thr", header: "Throttle", align: "right", render: (r) => <span className="font-tabular">{r.throttlePerMin}/m</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// GROWTH ENGINE — MESSAGING & CONSENT"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">COMMUNICATION CENTER.</h1>
        </div>
        {canWriteInbox && (
          <Button variant="secondary" onClick={() => setTplOpen(true)}>
            <Plus className="size-4" /> New Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// UNREAD WHATSAPP" value={unreadTotal} subtext={`${threads.length} active threads`} accent="red" />
        <StatTile label="// APPROVED TEMPLATES" value={templates.filter((t) => t.approvalStatus === "APPROVED").length} subtext={`${templates.length} total templates`} accent="blue" />
        <StatTile label="// WHATSAPP OPTED-IN" value={consentSummary.totalOptedIn} subtext={`${consentSummary.totalOptedOut} opted out (DPDP guarded)`} accent="ink" />
        <StatTile label="// BROADCASTS RUN" value={campaigns.length} subtext="Throttled multi-channel dispatches" accent="yellow" />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["INBOX", "BROADCAST", "TEMPLATES"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[44px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "INBOX" ? "2-WAY INBOX" : t === "BROADCAST" ? "BROADCAST CAMPAIGNS" : "TEMPLATES & APPROVALS"}
            </button>
          ))}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--fg-grey)]">
          ADAPTER: MOCK WHATSAPP CLOUD + SMS GUARD
        </span>
      </FilterBar>

      {/* 2-Way WhatsApp Inbox */}
      {tab === "INBOX" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bauhaus-card divide-y-2 divide-[var(--border-ink)] max-h-[640px] overflow-y-auto">
            <div className="p-3 bg-[var(--bg-muted)]">
              <p className="bauhaus-label">{"// MEMBER THREADS"}</p>
            </div>
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedThreadId(t.id);
                  if (t.unreadCount > 0) {
                    startTransition(async () => {
                      await markInboxThreadReadAction(t.id);
                      router.refresh();
                    });
                  }
                }}
                className={clsx(
                  "w-full text-left p-3.5 space-y-1 transition-colors",
                  selectedThread?.id === t.id ? "bg-[#EBC95B] text-[#151515]" : "hover:bg-[var(--bg-muted)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[14px] truncate">{t.contactName}</span>
                  {t.unreadCount > 0 && (
                    <span className="bg-[#C8372B] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-tabular font-bold shrink-0">
                      {t.unreadCount} NEW
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-tabular opacity-80">{t.contactPhone} · {t.branchName}</p>
                <p className="text-[13px] truncate">{t.lastPreview}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bauhaus-card flex flex-col">
            {selectedThread ? (
              <>
                <div className="border-b-2 border-[var(--border-ink)] p-4 flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)]">
                  <div>
                    <p className="bauhaus-label text-[#2B4BCC]">{`// ${selectedThread.channel} · ${selectedThread.branchName}`}</p>
                    <h2 className="font-headline text-[22px]">{selectedThread.contactName}</h2>
                    <p className="text-[12px] font-tabular text-[var(--fg-grey)]">{selectedThread.contactPhone}</p>
                  </div>
                  {canWriteInbox && (
                    <select
                      aria-label="Assign conversation owner"
                      className="bauhaus-input w-auto"
                      value={selectedThread.assignedToId ?? ""}
                      onChange={(e) => {
                        const nextStaff = e.target.value;
                        startTransition(async () => {
                          await assignInboxThreadAction({
                            threadId: selectedThread.id,
                            assignedToId: nextStaff,
                          });
                          setToast({ msg: "Thread assignment saved.", tone: "blue" });
                        });
                      }}
                    >
                      <option value="">Unassigned</option>
                      {staff.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="p-4 space-y-3 flex-1 max-h-[380px] overflow-y-auto bg-[var(--bg-paper)]">
                  {selectedThread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={clsx(
                        "max-w-[85%] border-2 border-[#151515] p-3 space-y-1",
                        m.direction === "INBOUND"
                          ? "bg-[var(--bg-surface)] mr-auto"
                          : "bg-[#151515] text-[#FFFFFF] ml-auto"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 text-[12px] font-bold uppercase opacity-80">
                        <span>{m.senderName}</span>
                        <span>{m.status}</span>
                      </div>
                      <p className="text-[14px]">{m.body}</p>
                    </div>
                  ))}
                </div>

                {canWriteInbox && (
                  <div className="border-t-2 border-[var(--border-ink)] p-4 space-y-3 bg-[var(--bg-surface)]">
                    <div className="flex flex-wrap gap-1.5">
                      {templates.filter((tp) => tp.approvalStatus === "APPROVED").slice(0, 3).map((tp) => (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() =>
                            setReplyText(
                              interpolateTemplateVars(tp.body, {
                                name: selectedThread.contactName,
                                plan: "Strength Quarterly",
                                expiry: "05 Dec 2026",
                                dueAmountPaise: 150000,
                                branch: selectedThread.branchName,
                              })
                            )
                          }
                          className="border border-[var(--border-ink)] bg-[var(--bg-paper)] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#EBC95B]"
                        >
                          Insert: {tp.code}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        className="bauhaus-input flex-1"
                        placeholder="Write WhatsApp reply..."
                        aria-label="WhatsApp reply body"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <Button
                        variant="primary"
                        disabled={pending || !replyText.trim()}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await sendInboxReplyAction({
                              threadId: selectedThread.id,
                              body: replyText,
                            });
                            if (!res.ok) {
                              setToast({ msg: res.error, tone: "red" });
                              return;
                            }
                            setReplyText("");
                            setToast({ msg: "Reply delivered to thread.", tone: "blue" });
                            router.refresh();
                          });
                        }}
                      >
                        <Send className="size-4" /> Send Reply
                      </Button>
                    </div>

                    <div className="border-t border-[var(--border-ink)]/25 pt-2 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        className="bauhaus-input flex-1"
                        aria-label="Simulate inbound WhatsApp text"
                        value={simInboundText}
                        onChange={(e) => setSimInboundText(e.target.value)}
                      />
                      <Button
                        variant="tertiary"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await simulateInboundMemberReplyAction({
                              threadId: selectedThread.id,
                              body: simInboundText,
                            });
                            setToast({ msg: "Simulated inbound member WhatsApp.", tone: "yellow" });
                            router.refresh();
                          });
                        }}
                      >
                        <MessageSquare className="size-4" /> Simulate Inbound
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-[14px] text-[var(--fg-grey)]">No conversations selected.</div>
            )}
          </div>
        </div>
      )}

      {/* Broadcast Campaigns */}
      {tab === "BROADCAST" && (
        <div className="space-y-6">
          {canBroadcast && (
            <div className="bauhaus-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="bauhaus-label text-[#C8372B]">{"// TARGETED CAMPAIGN COMPOSER"}</p>
                  <h2 className="font-headline text-[24px]">Launch Segmented Broadcast</h2>
                </div>
                <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-3 py-1.5 text-[12px] font-bold uppercase">
                  MATCHED: {segStat.matched} · ELIGIBLE OPT-IN: {segStat.eligible} · OPTED-OUT BLOCKED: {segStat.optedOut}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="bc-name" className="bauhaus-label block mb-1.5">{"// CAMPAIGN NAME"}</label>
                  <input id="bc-name" className="bauhaus-input" value={campName} onChange={(e) => setCampName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="bc-seg" className="bauhaus-label block mb-1.5">{"// AUDIENCE SEGMENT"}</label>
                  <select
                    id="bc-seg"
                    className="bauhaus-input"
                    value={segmentKey}
                    onChange={(e) => setSegmentKey(e.target.value as SegmentKey)}
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bc-ch" className="bauhaus-label block mb-1.5">{"// CHANNEL"}</label>
                  <select id="bc-ch" className="bauhaus-input" value={channel} onChange={(e) => setChannel(e.target.value as "WHATSAPP" | "SMS" | "EMAIL")}>
                    <option value="WHATSAPP">WHATSAPP</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">EMAIL</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bc-thr" className="bauhaus-label block mb-1.5">{"// THROTTLE (MSGS/MIN)"}</label>
                  <input
                    id="bc-thr"
                    type="number"
                    min={5}
                    max={120}
                    className="bauhaus-input"
                    value={throttle}
                    onChange={(e) => setThrottle(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bc-body" className="bauhaus-label block mb-1.5">
                  {"// MESSAGE BODY ({name}, {plan}, {expiry}, {due_amount}, {branch})"}
                </label>
                <textarea
                  id="bc-body"
                  rows={2}
                  className="bauhaus-input h-auto py-2"
                  value={campBody}
                  onChange={(e) => setCampBody(e.target.value)}
                />
              </div>

              <Button
                variant="primary"
                density="hero"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await launchBroadcastCampaignAction({
                      name: campName,
                      segmentKey,
                      channel,
                      body: campBody,
                      throttlePerMin: throttle,
                      branchId: activeBranchId,
                    });
                    if (!res.ok) {
                      setToast({ msg: res.error, tone: "red" });
                      return;
                    }
                    setToast({
                      msg: `Dispatched to ${res.sentCount} opted-in members (${res.optedOutCount} opted-out blocked).`,
                      tone: "blue",
                    });
                    router.refresh();
                  });
                }}
              >
                DISPATCH CAMPAIGN NOW ({segStat.eligible} RECIPIENTS)
              </Button>
            </div>
          )}

          <DataTable
            title="BROADCAST DELIVERY, READ & OPT-OUT REPORT"
            rows={campaigns}
            columns={campaignColumns}
            rowKey={(r) => r.id}
          />
        </div>
      )}

      {/* Templates & Meta Approval */}
      {tab === "TEMPLATES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tp) => (
            <div key={tp.id} className="bauhaus-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="bauhaus-label text-[var(--fg-grey)]">{`// ${tp.channel} · ${tp.code}`}</span>
                  <h3 className="font-headline text-[20px] mt-1">{tp.name}</h3>
                </div>
                <span
                  className={clsx(
                    "px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase",
                    tp.approvalStatus === "APPROVED"
                      ? "bg-[#2B4BCC] text-[#FFFFFF]"
                      : "bg-[#EBC95B] text-[#151515]"
                  )}
                >
                  {tp.approvalStatus.replace("_", " ")}
                </span>
              </div>
              <p className="text-[14px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3">
                {tp.body}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {tp.variables.map((v) => (
                    <span key={v} className="bg-[#151515] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-mono">
                      {v}
                    </span>
                  ))}
                </div>
                {tp.approvalStatus !== "APPROVED" && canWriteInbox && (
                  <Button
                    variant="yellow"
                    disabled={pending}
                    onClick={() => startTransition(async () => {
                      const res = await approveTemplateMockAction(tp.id);
                      if (res.ok) {
                        setToast({ msg: `Template ${tp.code} approved for dispatch!`, tone: "blue" });
                        router.refresh();
                      }
                    })}
                  >
                    <Check className="size-4" /> Approve Template
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Template Modal */}
      <Modal open={tplOpen} onClose={() => setTplOpen(false)} eyebrow="TEMPLATE STUDIO" title="Create Message Template">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tpl-code" className="bauhaus-label block mb-1.5">{"// CODE"}</label>
              <input id="tpl-code" className="bauhaus-input" value={tplCode} onChange={(e) => setTplCode(e.target.value)} />
            </div>
            <div>
              <label htmlFor="tpl-ch" className="bauhaus-label block mb-1.5">{"// CHANNEL"}</label>
              <select id="tpl-ch" className="bauhaus-input" value={tplChannel} onChange={(e) => setTplChannel(e.target.value as "WHATSAPP" | "SMS" | "EMAIL")}>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="SMS">SMS</option>
                <option value="EMAIL">EMAIL</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="tpl-name" className="bauhaus-label block mb-1.5">{"// DISPLAY NAME"}</label>
            <input id="tpl-name" className="bauhaus-input" value={tplName} onChange={(e) => setTplName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="tpl-body" className="bauhaus-label block mb-1.5">{"// TEMPLATE BODY"}</label>
            <textarea id="tpl-body" rows={3} className="bauhaus-input h-auto py-2" value={tplBody} onChange={(e) => setTplBody(e.target.value)} />
          </div>
          <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-3 text-[13px]">
            <p className="font-bold uppercase text-[12px] mb-1">{"// LIVE VARIABLE PREVIEW"}</p>
            <p>
              {interpolateTemplateVars(tplBody, {
                name: "Aarav Sharma",
                plan: "Strength Quarterly",
                expiry: "30 Nov 2026",
                dueAmountPaise: 150000,
                branch: "Indiranagar HQ",
              })}
            </p>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await createTemplateAction({
                  code: tplCode,
                  name: tplName,
                  channel: tplChannel,
                  body: tplBody,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setTplOpen(false);
                setToast({ msg: "Template saved.", tone: "blue" });
              });
            }}
          >
            <ShieldCheck className="size-4" /> SAVE TEMPLATE
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
