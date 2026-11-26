"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AttendanceCalendar,
  Avatar,
  Drawer,
  Modal,
  StatusPill,
  Timeline,
  Toast,
} from "@/components/ui/primitives";
import { QRCode } from "@/components/ui/qr-code";
import { formatMoney } from "@/lib/money";
import { aggregateGstInvoice } from "@/lib/gst";
import {
  addMemberMeasurementAction,
  addMemberNoteAction,
  collectInvoicePaymentAction,
  freezeMemberSubscriptionAction,
  sellPlanAndInvoiceAction,
  sendMemberOutreachAction,
  unfreezeMemberAction,
  upgradeMemberPlanProratedAction,
} from "@/app/actions/crm-actions";
import { hasPermission, type CrmRole } from "@/lib/rbac";

type TabId =
  | "overview"
  | "membership"
  | "payments"
  | "attendance"
  | "measurements"
  | "workouts"
  | "comms"
  | "documents";

export function MemberProfileClient(props: {
  role: CrmRole;
  currency: string;
  showFinance: boolean;
  member: {
    id: string;
    memberCode: string;
    qrToken: string;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    stateCode: string;
    emergencyName: string;
    emergencyPhone: string;
    goals: string;
    healthNotes: string;
    status: string;
    expiryDate: string | null;
    branchName: string;
    branchCode: string;
    groupLabel: string | null;
    trainerName: string;
    referralCode: string;
    tags: string[];
  };
  subscriptions: Array<{
    id: string;
    planId: string;
    planName: string;
    status: string;
    startDate: string;
    endDate: string;
    basePricePaise: number;
    maxFreezeDays: number;
    freezeDaysUsed: number;
    sessionsRemaining: number | null;
    autoRenew: boolean;
  }>;
  freezes: Array<{ id: string; startDate: string; endDate: string; daysCount: number; reason: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; issueDate: string; status: string; totalPaise: number; paidPaise: number; balanceDuePaise: number }>;
  checkInDays: number[];
  recentCheckIns: Array<{ id: string; visitedAt: string; method: string; result: string; overrideReason: string | null }>;
  measurements: Array<{ id: string; date: string; weightKg: string; bodyFatPct: string; waistCm: string; notes: string }>;
  documents: Array<{ id: string; kind: string; title: string; signedAt: string | null; signedIp: string | null; kycLast4: string | null }>;
  consents: Array<{ id: string; channel: string; granted: boolean; source: string }>;
  notes: Array<{ id: string; kind: string; authorName: string; body: string; createdAt: string }>;
  comms: Array<{ id: string; channel: string; status: string; body: string; createdAt: string }>;
  catalogPlans: Array<{ id: string; name: string; pricePaise: number; joiningFeePaise: number; durationDays: number; gstRateBps: number }>;
  catalogAddons: Array<{ id: string; name: string; pricePaise: number }>;
  promoCodes: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [sellOpen, setSellOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sell plan checkout state
  const [selectedPlanId, setSelectedPlanId] = useState(props.catalogPlans[0]?.id ?? "");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMode, setPaymentMode] = useState<"FULL" | "PARTIAL" | "DEFER">("FULL");
  const [partialRupees, setPartialRupees] = useState("2000");
  const [payMethod, setPayMethod] = useState<"UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT">("UPI");

  // Freeze state
  const [freezeDays, setFreezeDays] = useState(7);
  const [freezeReason, setFreezeReason] = useState("Outstation work travel");

  // Upgrade state
  const [upgradePlanId, setUpgradePlanId] = useState(props.catalogPlans[2]?.id ?? props.catalogPlans[0]?.id ?? "");

  // Measurement & Notes & Outreach forms
  const [weightKg, setWeightKg] = useState("74.0");
  const [bodyFatPct, setBodyFatPct] = useState("18.0");
  const [waistCm, setWaistCm] = useState("81.0");
  const [noteBody, setNoteBody] = useState("");
  const [msgChannel, setMsgChannel] = useState<"WHATSAPP" | "SMS" | "EMAIL">("WHATSAPP");
  const [msgBody, setMsgBody] = useState(
    `Hi ${props.member.fullName.split(" ")[0]}, your Ironworks pass (${props.member.memberCode}) renewal window is open.`
  );

  const canCollect = hasPermission(props.role, "billing:collect");
  const canFreeze = hasPermission(props.role, "members:freeze");

  const chosenPlan = props.catalogPlans.find((p) => p.id === selectedPlanId) ?? props.catalogPlans[0];
  const sellPreview = useMemo(() => {
    if (!chosenPlan) return { totalPaise: 0, cgstPaise: 0, sgstPaise: 0 };
    const chosenAddons = props.catalogAddons.filter((a) => selectedAddonIds.includes(a.id));
    return aggregateGstInvoice(
      [
        { description: chosenPlan.name, unitPricePaise: chosenPlan.pricePaise, quantity: 1, gstRateBps: chosenPlan.gstRateBps },
        ...chosenAddons.map((a) => ({ description: a.name, unitPricePaise: a.pricePaise, quantity: 1, gstRateBps: chosenPlan.gstRateBps })),
      ],
      props.member.stateCode,
      props.member.stateCode
    );
  }, [chosenPlan, props.catalogAddons, selectedAddonIds, props.member.stateCode]);

  const handleSellPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenPlan) return;
    const payNowPaise =
      paymentMode === "FULL"
        ? sellPreview.totalPaise
        : paymentMode === "PARTIAL"
        ? Math.min(sellPreview.totalPaise, Math.max(100, Math.round(Number(partialRupees || 0) * 100)))
        : 0;

    startTransition(async () => {
      const res = await sellPlanAndInvoiceAction({
        memberId: props.member.id,
        planId: chosenPlan.id,
        addonIds: selectedAddonIds,
        promoCode: promoCode.trim() || undefined,
        includeJoiningFee: false,
        payNowPaise,
        paymentMethod: payMethod,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setSellOpen(false);
      setToastMsg(`Generated GST Invoice ${res.invoiceNumber}. Opening invoice view...`);
      router.push(`/app/billing/invoices/${res.invoiceId}`);
      router.refresh();
    });
  };

  const handleFreeze = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await freezeMemberSubscriptionAction({
        memberId: props.member.id,
        freezeDays,
        reason: freezeReason,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setFreezeOpen(false);
      setToastMsg(`Membership frozen (+${freezeDays}d). New expiry: ${res.newExpiry}`);
      router.refresh();
    });
  };

  const handleUnfreeze = () => {
    startTransition(async () => {
      await unfreezeMemberAction(props.member.id);
      setToastMsg("Membership unfrozen -> ACTIVE.");
      router.refresh();
    });
  };

  const handleUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await upgradeMemberPlanProratedAction({
        memberId: props.member.id,
        targetPlanId: upgradePlanId,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setUpgradeOpen(false);
      setToastMsg(`Pro-rated upgrade applied. Credit applied cleanly!`);
      router.refresh();
    });
  };

  const handleSettleBalance = (invoiceId: string, balanceDuePaise: number) => {
    startTransition(async () => {
      const res = await collectInvoicePaymentAction({
        invoiceId,
        amountPaise: balanceDuePaise,
        method: "UPI",
      });
      if (res.ok) {
        setToastMsg("Invoice settled via UPI!");
        router.refresh();
      }
    });
  };

  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await addMemberMeasurementAction({
        memberId: props.member.id,
        weightKg: Number(weightKg),
        bodyFatPct: Number(bodyFatPct),
        waistCm: Number(waistCm),
      });
      setToastMsg("Saved body measurement entry.");
      router.refresh();
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    startTransition(async () => {
      await addMemberNoteAction({ memberId: props.member.id, kind: "NOTE", body: noteBody });
      setNoteBody("");
      setToastMsg("Note appended to timeline.");
      router.refresh();
    });
  };

  const handleSendOutreach = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await sendMemberOutreachAction({
        memberId: props.member.id,
        channel: msgChannel,
        body: msgBody,
      });
      setToastMsg(
        res.status === "BLOCKED_OPT_OUT"
          ? "Blocked: member opted out of this channel."
          : `Outreach ${res.status} logged in timeline.`
      );
      router.refresh();
    });
  };

  const tabs: Array<{ id: TabId; label: string; show: boolean }> = [
    { id: "overview", label: "Overview", show: true },
    { id: "membership", label: "Membership", show: true },
    { id: "payments", label: "Payments & GST", show: props.showFinance },
    { id: "attendance", label: "Attendance", show: true },
    { id: "measurements", label: "Measurements", show: true },
    { id: "workouts", label: "Workouts & Diet", show: true },
    { id: "comms", label: "Comms Timeline", show: true },
    { id: "documents", label: "Docs & Notes", show: true },
  ];

  const timelineEntries = [
    ...props.comms.map((c) => ({
      id: c.id,
      timestamp: c.createdAt,
      badge: `${c.channel} · ${c.status}`,
      title: `${c.channel} Dispatch`,
      body: c.body,
      tone: "blue" as const,
    })),
    ...props.notes.map((n) => ({
      id: n.id,
      timestamp: n.createdAt,
      badge: `${n.kind} · ${n.authorName}`,
      title: "Staff Note",
      body: n.body,
      tone: "yellow" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      {/* Header Poster Band */}
      <div className="bauhaus-card p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={props.member.fullName} size={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="bauhaus-label text-[#C8372B]">{`// ${props.member.memberCode}`}</span>
              <StatusPill status={props.member.status} />
              {props.member.groupLabel && (
                <span className="border border-[var(--border-ink)] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase">
                  {props.member.groupLabel}
                </span>
              )}
            </div>
            <h1 className="font-headline text-[32px] md:text-[44px]">{props.member.fullName}</h1>
            <p className="text-[14px] text-[var(--fg-grey)] mt-1">
              {props.member.phone} · {props.member.branchName} · Expiry: <strong>{props.member.expiryDate ?? "None"}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCollect && (
            <Button variant="primary" onClick={() => setSellOpen(true)}>
              Sell / Renew Plan
            </Button>
          )}
          {canCollect && props.subscriptions.length > 0 && (
            <Button variant="blue" onClick={() => setUpgradeOpen(true)}>
              Pro-Rated Upgrade
            </Button>
          )}
          {canFreeze &&
            (props.member.status === "FROZEN" ? (
              <Button variant="yellow" onClick={handleUnfreeze} disabled={isPending}>
                Unfreeze Member
              </Button>
            ) : (
              <Button variant="tertiary" onClick={() => setFreezeOpen(true)}>
                Freeze Pass
              </Button>
            ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[48px] px-4 text-[12px] font-bold uppercase tracking-[0.08em] border-r-2 border-b-2 md:border-b-0 border-[var(--border-ink)] ${
                tab === t.id ? "bg-[#151515] text-[#FFFFFF]" : "hover:bg-[#EBC95B] hover:text-[#151515]"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC]">{`// PROFILE DETAILS & HEALTH DECLARATION`}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
              <div>
                <p className="bauhaus-label text-[var(--fg-grey)]">Email</p>
                <p className="font-bold mt-1">{props.member.email || "--"}</p>
              </div>
              <div>
                <p className="bauhaus-label text-[var(--fg-grey)]">Assigned Coach</p>
                <p className="font-bold mt-1">{props.member.trainerName}</p>
              </div>
              <div>
                <p className="bauhaus-label text-[var(--fg-grey)]">Emergency Contact</p>
                <p className="font-bold mt-1">{props.member.emergencyName} · {props.member.emergencyPhone}</p>
              </div>
              <div>
                <p className="bauhaus-label text-[var(--fg-grey)]">Address / State</p>
                <p className="font-bold mt-1">{props.member.address} ({props.member.stateCode})</p>
              </div>
              <div className="sm:col-span-2">
                <p className="bauhaus-label text-[var(--fg-grey)]">Goals</p>
                <p className="font-bold mt-1">{props.member.goals}</p>
              </div>
              <div className="sm:col-span-2 border-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-3">
                <p className="bauhaus-label text-[#C8372B] mb-1">
                  {`// DECRYPTED HEALTH NOTES (AES-256-GCM · DPDP CONSENTED)`}
                </p>
                <p className="text-[14px] font-medium">{props.member.healthNotes || "None recorded."}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bauhaus-card p-5 space-y-4">
            <QRCode value={props.member.qrToken} label={`// QR ACCESS TOKEN: ${props.member.memberCode}`} />
            <div className="border-t-2 border-[var(--border-ink)] pt-3">
              <p className="bauhaus-label text-[var(--fg-grey)]">Referral Link Code</p>
              <p className="font-headline text-[24px] mt-1">{props.member.referralCode}</p>
            </div>
            <div>
              <p className="bauhaus-label text-[var(--fg-grey)] mb-1">Consent Preferences</p>
              <div className="flex flex-wrap gap-1.5">
                {props.consents.map((c) => (
                  <span key={c.id} className="border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase bg-[var(--bg-paper)]">
                    {c.channel}: {c.granted ? "OPT-IN" : "OPT-OUT"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "membership" && (
        <div className="space-y-4">
          <div className="bauhaus-card">
            <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4">
              <p className="bauhaus-label">{`// SUBSCRIPTION HISTORY (${props.subscriptions.length})`}</p>
            </div>
            <div className="divide-y-2 divide-[var(--border-ink)]">
              {props.subscriptions.map((s) => (
                <div key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-[15px]">{s.planName}</p>
                    <p className="text-[13px] text-[var(--fg-grey)] font-tabular">
                      {s.startDate} → {s.endDate} · Freeze used {s.freezeDaysUsed}/{s.maxFreezeDays}d
                      {s.sessionsRemaining !== null ? ` · ${s.sessionsRemaining} credits left` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-tabular font-bold">{formatMoney(s.basePricePaise, { currency: props.currency })}</span>
                    <StatusPill status={s.status} />
                  </div>
                </div>
              ))}
              {props.subscriptions.length === 0 && (
                <p className="p-6 text-[14px] text-[var(--fg-grey)]">No plans sold yet. Use &ldquo;Sell / Renew Plan&rdquo; above.</p>
              )}
            </div>
          </div>

          {props.freezes.length > 0 && (
            <div className="bauhaus-card p-4">
              <p className="bauhaus-label mb-2">{`// FREEZE LOG`}</p>
              <div className="space-y-2">
                {props.freezes.map((f) => (
                  <div key={f.id} className="border border-[var(--border-ink)] p-3 text-[13px]">
                    <strong>{f.daysCount} days</strong> ({f.startDate} → {f.endDate}) — {f.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "payments" && props.showFinance && (
        <div className="bauhaus-card overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#151515] text-[#FFFFFF]">
              <tr>
                <th className="p-3 text-[12px] font-bold uppercase">Invoice #</th>
                <th className="p-3 text-[12px] font-bold uppercase">Issue Date</th>
                <th className="p-3 text-[12px] font-bold uppercase">Status</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Total</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Due</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[var(--border-ink)]">
              {props.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-3 font-bold">
                    <Link href={`/app/billing/invoices/${inv.id}`} className="underline hover:text-[#C8372B]">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="p-3 text-[13px]">{inv.issueDate}</td>
                  <td className="p-3"><StatusPill status={inv.status} /></td>
                  <td className="p-3 text-right font-tabular font-bold">{formatMoney(inv.totalPaise, { currency: props.currency })}</td>
                  <td className="p-3 text-right font-tabular font-bold text-[#C8372B]">
                    {formatMoney(inv.balanceDuePaise, { currency: props.currency })}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/app/billing/invoices/${inv.id}`}
                        className="border border-[#151515] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#EBC95B]"
                      >
                        GST PDF
                      </Link>
                      {canCollect && inv.balanceDuePaise > 0 && (
                        <Button
                          variant="primary"
                          onClick={() => handleSettleBalance(inv.id, inv.balanceDuePaise)}
                          disabled={isPending}
                        >
                          Collect Due
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "attendance" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AttendanceCalendar visitedDayKeys={props.checkInDays} monthLabel="LAST 30 DAYS VISITS" />
          <div className="bauhaus-card p-4 space-y-2">
            <p className="bauhaus-label">{`// RECENT SCAN LOG`}</p>
            {props.recentCheckIns.map((c) => (
              <div key={c.id} className="border border-[var(--border-ink)] p-3 flex items-center justify-between gap-2 text-[13px]">
                <div>
                  <p className="font-bold">{c.visitedAt}</p>
                  {c.overrideReason && <p className="text-[12px] text-[#C8372B]">Override: {c.overrideReason}</p>}
                </div>
                <StatusPill status={c.result} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "measurements" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form onSubmit={handleAddMeasurement} className="lg:col-span-4 bauhaus-card p-4 space-y-3">
            <p className="bauhaus-label text-[#2B4BCC]">{`// LOG BODY METRICS`}</p>
            <div>
              <label className="bauhaus-label block mb-1">Weight (kg)</label>
              <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Body Fat (%)</label>
              <input value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Waist (cm)</label>
              <input value={waistCm} onChange={(e) => setWaistCm(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <Button type="submit" variant="secondary" fullWidth disabled={isPending}>Save Measurement</Button>
          </form>

          <div className="lg:col-span-8 bauhaus-card divide-y-2 divide-[var(--border-ink)]">
            {props.measurements.map((m) => (
              <div key={m.id} className="p-4 flex flex-wrap justify-between gap-2 text-[14px] font-tabular">
                <span className="font-bold">{m.date}</span>
                <span>Weight: <strong>{m.weightKg} kg</strong></span>
                <span>BF%: <strong>{m.bodyFatPct}%</strong></span>
                <span>Waist: <strong>{m.waistCm} cm</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "workouts" && (
        <div className="bauhaus-card p-6 space-y-3">
          <p className="bauhaus-label text-[#2B4BCC]">{`// WORKOUT & DIET COACHING`}</p>
          <h3 className="font-headline text-[24px]">Assigned Program Bridge Ready</h3>
          <p className="text-[14px] text-[var(--fg-grey)]">
            Assigned Trainer: <strong>{props.member.trainerName}</strong>. Full PPL/Upper-Lower/Indian Diet templates and FORGE Member App synchronization unlock in Phase 3.
          </p>
        </div>
      )}

      {tab === "comms" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleSendOutreach} className="bauhaus-card p-4 space-y-3">
              <p className="bauhaus-label text-[#C8372B]">{`// SEND OUTREACH (CONSENT-GUARDED)`}</p>
              <select
                value={msgChannel}
                onChange={(e) => setMsgChannel(e.target.value as "WHATSAPP" | "SMS" | "EMAIL")}
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold"
              >
                <option value="WHATSAPP">WhatsApp Business Cloud</option>
                <option value="SMS">SMS Gateway</option>
                <option value="EMAIL">Transactional Email</option>
              </select>
              <textarea
                rows={3}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                className="w-full border-2 border-[var(--border-ink)] p-3 text-[14px]"
              />
              <Button type="submit" variant="primary" fullWidth disabled={isPending}>
                Dispatch Message
              </Button>
            </form>

            <form onSubmit={handleAddNote} className="bauhaus-card p-4 space-y-3">
              <p className="bauhaus-label">{`// LOG INTERNAL NOTE`}</p>
              <textarea
                rows={2}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Call outcome, injury caution, or follow-up plan..."
                className="w-full border-2 border-[var(--border-ink)] p-3 text-[14px]"
              />
              <Button type="submit" variant="secondary" fullWidth disabled={isPending}>Save Note</Button>
            </form>
          </div>

          <div className="lg:col-span-7">
            <Timeline entries={timelineEntries} />
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="bauhaus-card p-5 space-y-4">
          <p className="bauhaus-label">{`// E-SIGNED WAIVERS, KYC & TAGS`}</p>
          <div className="flex flex-wrap gap-2">
            {props.member.tags.map((tag) => (
              <span key={tag} className="bg-[#EBC95B] text-[#151515] border border-[#151515] px-2.5 py-1 text-[12px] font-bold uppercase">
                #{tag}
              </span>
            ))}
          </div>
          <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)]">
            {props.documents.map((d) => (
              <div key={d.id} className="p-4 flex flex-wrap justify-between gap-2 text-[14px]">
                <div>
                  <p className="font-bold">{d.title}</p>
                  <p className="text-[12px] text-[var(--fg-grey)]">
                    Kind: {d.kind} {d.signedAt ? `· Signed ${d.signedAt} (${d.signedIp})` : ""} {d.kycLast4 ? `· Masked ID: XXXX${d.kycLast4}` : ""}
                  </p>
                </div>
                <StatusPill status="PAID" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sell / Renew Plan Drawer */}
      <Drawer open={sellOpen} onClose={() => setSellOpen(false)} eyebrow="GST CHECKOUT" title="Sell / Renew Plan">
        <form onSubmit={handleSellPlan} className="space-y-4">
          <div>
            <label className="bauhaus-label block mb-1">Membership Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold"
            >
              {props.catalogPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.durationDays}d) — {formatMoney(p.pricePaise, { currency: props.currency })}
                </option>
              ))}
            </select>
          </div>

          {props.catalogAddons.length > 0 && (
            <div>
              <label className="bauhaus-label block mb-1.5">Optional Add-Ons</label>
              <div className="space-y-1.5">
                {props.catalogAddons.map((a) => {
                  const checked = selectedAddonIds.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center justify-between border border-[var(--border-ink)] p-2.5 text-[13px] cursor-pointer">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedAddonIds((prev) =>
                              checked ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                            )
                          }
                          className="size-4 accent-[#C8372B]"
                        />
                        {a.name}
                      </span>
                      <span className="font-tabular font-bold">+{formatMoney(a.pricePaise, { currency: props.currency })}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="bauhaus-label block mb-1">Promo / Referral Code</label>
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder={`Available: ${props.promoCodes.join(", ")}`}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] uppercase"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["FULL", "PARTIAL", "DEFER"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMode(m)}
                className={`min-h-[44px] border-2 border-[var(--border-ink)] text-[12px] font-bold uppercase ${
                  paymentMode === m ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)]"
                }`}
              >
                {m === "FULL" ? "Full Pay" : m === "PARTIAL" ? "Part Pay" : "Pay Later"}
              </button>
            ))}
          </div>

          {paymentMode === "PARTIAL" && (
            <div>
              <label className="bauhaus-label block mb-1">Collect Now (INR)</label>
              <input
                type="number"
                min={1}
                value={partialRupees}
                onChange={(e) => setPartialRupees(e.target.value)}
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-tabular font-bold"
              />
            </div>
          )}

          <div>
            <label className="bauhaus-label block mb-1">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT")}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold"
            >
              <option value="UPI">UPI QR / Intent (Razorpay)</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="CASH">Front Desk Cash</option>
              <option value="BANK_TRANSFER">NEFT / IMPS Bank Transfer</option>
              <option value="SPLIT">Split Payment (UPI + Cash)</option>
            </select>
          </div>

          <div className="border-2 border-[var(--border-ink)] bg-[#EBC95B] text-[#151515] p-4 space-y-1 text-[14px]">
            <p className="bauhaus-label">GST Invoice Total (Incl. 18% GST)</p>
            <p className="font-headline text-[32px] font-tabular">{formatMoney(sellPreview.totalPaise, { currency: props.currency })}</p>
            <p className="text-[12px] font-bold">
              CGST: {formatMoney(sellPreview.cgstPaise)} · SGST: {formatMoney(sellPreview.sgstPaise)}
            </p>
          </div>

          <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
            {isPending ? "Generating Invoice..." : "Generate GST Invoice & Collect →"}
          </Button>
        </form>
      </Drawer>

      {/* Freeze Modal */}
      <Modal open={freezeOpen} onClose={() => setFreezeOpen(false)} eyebrow="POLICY MATH" title="Freeze Membership">
        <form onSubmit={handleFreeze} className="space-y-4">
          <div>
            <label className="bauhaus-label block mb-1">Freeze Duration (Days)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={freezeDays}
              onChange={(e) => setFreezeDays(Number(e.target.value))}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]"
            />
          </div>
          <div>
            <label className="bauhaus-label block mb-1">Freeze Reason</label>
            <input
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]"
            />
          </div>
          <Button type="submit" variant="primary" fullWidth disabled={isPending}>
            Approve Freeze &amp; Extend Expiry
          </Button>
        </form>
      </Modal>

      {/* Upgrade Modal */}
      <Modal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} eyebrow="PRO-RATED" title="Upgrade Plan">
        <form onSubmit={handleUpgrade} className="space-y-4">
          <div>
            <label className="bauhaus-label block mb-1">Target Plan</label>
            <select
              value={upgradePlanId}
              onChange={(e) => setUpgradePlanId(e.target.value)}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold"
            >
              {props.catalogPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.pricePaise, { currency: props.currency })}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="blue" fullWidth disabled={isPending}>
            Apply Unused-Days Credit &amp; Upgrade
          </Button>
        </form>
      </Modal>
    </div>
  );
}
