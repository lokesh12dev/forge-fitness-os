"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Gift, RefreshCw, Search, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  Modal,
  StatTile,
  StatusPill,
  Toast,
} from "@/components/ui/primitives";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { formatMoney } from "@/lib/money";
import {
  addExpenseAction,
  closeCashDrawerAction,
  collectInvoicePaymentAction,
  issueRefundAction,
  sellPlanAndInvoiceAction,
} from "@/app/actions/crm-actions";
import {
  collectSplitTenderInvoiceAction,
  createAutopayMandateAction,
  createCorporateOrFamilyGroupAction,
  issueGiftCardVoucherAction,
  replayWebhookEventAction,
  runDunningRetryCycleAction,
  toggleAutopayMandateStatusAction,
} from "@/app/actions/world-class-actions";
import { hasPermission, type CrmRole } from "@/lib/rbac";
import { requiresManagerOtpForDiscount, verifyManagerApprovalOtp } from "@/lib/privacy-guard";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  memberWalletPaise: number;
  branchCode: string;
  issueDate: string;
  agingBucket: string;
  status: string;
  totalPaise: number;
  paidPaise: number;
  balanceDuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export function BillingClient(props: {
  orgId: string;
  role: CrmRole;
  currency: string;
  activeBranchId: string;
  branches: Array<{ id: string; name: string; code: string }>;
  openSellOnMount: boolean;
  initialQuery: string;
  summary: {
    monthCollectedPaise: number;
    openDuesPaise: number;
    openDuesCount: number;
    monthRefundsPaise: number;
    monthExpensesPaise: number;
  };
  invoices: InvoiceRow[];
  expenses: Array<{
    id: string;
    branchCode: string;
    category: string;
    vendorName: string;
    description: string;
    amountPaise: number;
    gstPaise: number;
    incurredOn: string;
  }>;
  members: Array<{ id: string; fullName: string; memberCode: string; branchId: string; walletBalancePaise: number }>;
  plans: Array<{ id: string; name: string; pricePaise: number; durationDays: number }>;
  webhooks: Array<{ id: string; provider: string; externalEventId: string; status: string; signatureValid: boolean; lastError: string | null }>;
  cashSessions: Array<{ id: string; branchCode: string; date: string; expectedPaise: number; countedPaise: number; variancePaise: number }>;
  giftCards: Array<{ id: string; code: string; initialPaise: number; balancePaise: number; recipientName: string; status: string }>;
  mandates: Array<{
    id: string;
    memberName: string;
    memberCode: string;
    planName: string;
    provider: string;
    mandateRef: string;
    maxAmountPaise: number;
    nextChargeDate: string;
    status: string;
  }>;
  dunningAttempts: Array<{
    id: string;
    invoiceNumber: string;
    memberName: string;
    attemptNo: number;
    status: string;
    balanceDuePaise: number;
    scheduledAt: string;
  }>;
  memberGroups: Array<{
    id: string;
    name: string;
    type: string;
    companyName: string | null;
    corporateGstin: string | null;
    seatLimit: number;
    memberCount: number;
  }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"invoices" | "dues" | "mandates" | "corporate_gift" | "cash" | "expenses" | "webhooks">("invoices");
  const [searchQ, setSearchQ] = useState(props.initialQuery);
  const [sellOpen, setSellOpen] = useState(props.openSellOnMount && hasPermission(props.role, "billing:collect"));
  const [collectTarget, setCollectTarget] = useState<InvoiceRow | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [collectRupees, setCollectRupees] = useState("");
  const [collectMethod, setCollectMethod] = useState<"UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT">("UPI");
  const [splitUpiRupees, setSplitUpiRupees] = useState("1000");
  const [splitCashRupees, setSplitCashRupees] = useState("1000");
  const [splitGiftCode, setSplitGiftCode] = useState("");
  const [collectWaiveRupees, setCollectWaiveRupees] = useState("0");
  const [collectManagerOtp, setCollectManagerOtp] = useState("");

  const [refundTarget, setRefundTarget] = useState<InvoiceRow | null>(null);
  const [refundRupees, setRefundRupees] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Quick Sell form
  const [saleMemberId, setSaleMemberId] = useState(props.members[0]?.id ?? "");
  const [salePlanId, setSalePlanId] = useState(props.plans[0]?.id ?? "");
  const [salePartialMode, setSalePartialMode] = useState<"FULL" | "PARTIAL">("PARTIAL");
  const [salePartialRupees, setSalePartialRupees] = useState("2500");
  const [saleMethod, setSaleMethod] = useState<"UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT">("UPI");
  const [saleDiscountPct, setSaleDiscountPct] = useState(0);
  const [managerOtp, setManagerOtp] = useState("");

  // Cash & Expenses
  const [openingCashRupees, setOpeningCashRupees] = useState("2000");
  const [countedCashRupees, setCountedCashRupees] = useState("2000");
  const [expCategory, setExpCategory] = useState("Equipment Maintenance");
  const [expVendor, setExpVendor] = useState("Technogym Service");
  const [expDesc, setExpDesc] = useState("Cable replacement & rack calibration");
  const [expRupees, setExpRupees] = useState("4500");

  // Gift card, Corporate, Mandate modals
  const [gcRupees, setGcRupees] = useState("5000");
  const [gcRecipient, setGcRecipient] = useState("Arjun Kapoor");
  const [grpName, setGrpName] = useState("Razorpay Wellness Team");
  const [grpType, setGrpType] = useState<"CORPORATE" | "FAMILY" | "COUPLE">("CORPORATE");
  const [grpCompany, setGrpCompany] = useState("Razorpay Software Pvt Ltd");
  const [grpGstin, setGrpGstin] = useState("29AACCR1234F1Z2");
  const [grpSeats, setGrpSeats] = useState(10);
  const [mdtMemberId, setMdtMemberId] = useState(props.members[0]?.id ?? "");
  const [mdtProvider, setMdtProvider] = useState<"RAZORPAY" | "STRIPE">("RAZORPAY");

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCollect = hasPermission(props.role, "billing:collect");
  const canRefund = hasPermission(props.role, "billing:refund");
  const canCloseCash = hasPermission(props.role, "billing:cash_close");
  const canWriteExpense = hasPermission(props.role, "expenses:write");

  const selectedPlan = props.plans.find((p) => p.id === salePlanId) ?? props.plans[0];
  const approxGrossPaise = selectedPlan ? Math.round(selectedPlan.pricePaise * 1.18) : 0;

  const handleSellPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleMemberId || !salePlanId) return;
    if (requiresManagerOtpForDiscount(saleDiscountPct)) {
      const check = verifyManagerApprovalOtp(managerOtp);
      if (!check.valid) {
        setToastMsg(check.reason + " (Demo OTP: 482910)");
        return;
      }
    }
    const payNow =
      salePartialMode === "FULL"
        ? approxGrossPaise
        : Math.max(0, Math.round(Number(salePartialRupees || 0) * 100));

    startTransition(async () => {
      const res = await sellPlanAndInvoiceAction({
        memberId: saleMemberId,
        planId: salePlanId,
        addonIds: [],
        includeJoiningFee: false,
        payNowPaise: payNow,
        paymentMethod: saleMethod,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setSellOpen(false);
      setToastMsg(`Issued GST invoice ${res.invoiceNumber}!`);
      router.push(`/app/billing/invoices/${res.invoiceId}`);
      router.refresh();
    });
  };

  const handleCollectPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectTarget) return;

    startTransition(async () => {
      if (splitMode) {
        const upiP = Math.round((Number(splitUpiRupees) || 0) * 100);
        const cashP = Math.round((Number(splitCashRupees) || 0) * 100);
        const waiveP = Math.round((Number(collectWaiveRupees) || 0) * 100);
        const res = await collectSplitTenderInvoiceAction({
          invoiceId: collectTarget.id,
          parts: [
            ...(upiP > 0 ? [{ method: "UPI" as const, amountPaise: upiP }] : []),
            ...(cashP > 0 ? [{ method: "CASH" as const, amountPaise: cashP }] : []),
          ],
          giftCardCode: splitGiftCode.trim() || undefined,
          discountWaivePaise: waiveP,
          managerOtp: collectManagerOtp,
        });
        if (!res.ok) {
          setToastMsg(res.error);
          return;
        }
        setCollectTarget(null);
        setToastMsg("Split-tender payment captured cleanly.");
        router.refresh();
        return;
      }

      const paise = Math.round(Number(collectRupees || 0) * 100);
      const res = await collectInvoicePaymentAction({
        invoiceId: collectTarget.id,
        amountPaise: paise,
        method: collectMethod,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setCollectTarget(null);
      setToastMsg("Captured payment & updated GST ledger.");
      router.refresh();
    });
  };

  const handleIssueRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    startTransition(async () => {
      const res = await issueRefundAction({
        invoiceId: refundTarget.id,
        amountPaise: Math.round(Number(refundRupees || 0) * 100),
        reason: refundReason,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setRefundTarget(null);
      setToastMsg(`Issued Credit Note ${res.creditNoteNumber}.`);
      router.refresh();
    });
  };

  const handleCloseCash = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await closeCashDrawerAction({
        branchId: props.activeBranchId,
        openingCashPaise: Math.round(Number(openingCashRupees || 0) * 100),
        countedCashPaise: Math.round(Number(countedCashRupees || 0) * 100),
      });
      setToastMsg(
        `Drawer closed: Variance ${formatMoney(res.variancePaise, { currency: props.currency })}`
      );
      router.refresh();
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await addExpenseAction({
        branchId: props.activeBranchId,
        category: expCategory,
        vendorName: expVendor,
        description: expDesc,
        amountPaise: Math.round(Number(expRupees || 0) * 100),
        gstPaise: Math.round(Number(expRupees || 0) * 18),
      });
      setToastMsg("Recorded expense entry.");
      router.refresh();
    });
  };

  const invoiceColumns: DataColumn<InvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice #",
      sortValue: (r) => r.invoiceNumber,
      render: (r) => (
        <Link href={`/app/billing/invoices/${r.id}`} className="font-bold underline hover:text-[#C8372B]">
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "member",
      header: "Member",
      sortValue: (r) => r.memberName,
      render: (r) => (
        <div>
          <Link href={`/app/members/${r.memberId}`} className="font-bold hover:underline">
            {r.memberName}
          </Link>
          <p className="text-[12px] text-[var(--fg-grey)]">{r.memberCode} · {r.branchCode}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "aging",
      header: "Aging",
      defaultVisible: tab === "dues",
      render: (r) => (
        <span className="text-[12px] font-bold uppercase text-[#C8372B]">{r.agingBucket}</span>
      ),
    },
    {
      key: "gst",
      header: "CGST + SGST / IGST",
      defaultVisible: false,
      align: "right",
      render: (r) =>
        r.igstPaise > 0
          ? `IGST ${formatMoney(r.igstPaise)}`
          : `${formatMoney(r.cgstPaise)} + ${formatMoney(r.sgstPaise)}`,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (r) => r.totalPaise,
      render: (r) => <span className="font-bold">{formatMoney(r.totalPaise, { currency: props.currency })}</span>,
    },
    {
      key: "balance",
      header: "Balance Due",
      align: "right",
      sortValue: (r) => r.balanceDuePaise,
      render: (r) => (
        <span className={r.balanceDuePaise > 0 ? "font-bold text-[#C8372B]" : "text-[var(--fg-grey)]"}>
          {formatMoney(r.balanceDuePaise, { currency: props.currency })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className="inline-flex flex-wrap justify-end gap-1.5">
          <Link
            href={`/app/billing/invoices/${r.id}`}
            className="border border-[#151515] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#EBC95B]"
          >
            GST PDF
          </Link>
          {canCollect && r.balanceDuePaise > 0 && (
            <Button
              density="dense"
              variant="primary"
              onClick={() => {
                setCollectTarget(r);
                setSplitMode(false);
                setCollectRupees((r.balanceDuePaise / 100).toFixed(0));
                const half = Math.round(r.balanceDuePaise / 200);
                setSplitUpiRupees(String(half));
                setSplitCashRupees(String(Math.max(0, Math.round(r.balanceDuePaise / 100) - half)));
              }}
            >
              Collect
            </Button>
          )}
          {canRefund && r.paidPaise > 0 && r.status !== "REFUNDED" && (
            <Button
              density="dense"
              variant="tertiary"
              onClick={() => {
                setRefundTarget(r);
                setRefundRupees((r.paidPaise / 100).toFixed(0));
              }}
            >
              Refund
            </Button>
          )}
        </div>
      ),
    },
  ];

  const duesRows = props.invoices.filter((i) => i.balanceDuePaise > 0);
  const displayedRows = tab === "dues" ? duesRows : props.invoices;

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-2">{`// GST INVOICES, SPLIT-TENDER, CORPORATE B2B, AUTOPAY & DUNNING`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">BILLING &amp; LEDGER</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/app/billing${searchQ.trim() ? `?q=${encodeURIComponent(searchQ.trim())}` : ""}`);
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-grey)]" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search INV # or member..."
                className="min-h-[42px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] pl-9 pr-3 text-[13px]"
              />
            </div>
            <Button type="submit" variant="tertiary">Find</Button>
          </form>
          {canCollect && (
            <Button variant="primary" onClick={() => setSellOpen(true)}>
              + Sell Plan / Collect Payment
            </Button>
          )}
        </div>
      </div>

      {/* Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="// MONTH COLLECTED"
          value={formatMoney(props.summary.monthCollectedPaise, { currency: props.currency, compact: true })}
          subtext="Verified captured settlements"
          accent="blue"
        />
        <StatTile
          label="// DUES LEDGER BALANCE"
          value={formatMoney(props.summary.openDuesPaise, { currency: props.currency, compact: true })}
          subtext={`${props.summary.openDuesCount} partial/unpaid invoices`}
          accent="red"
        />
        <StatTile
          label="// MONTH EXPENSES"
          value={formatMoney(props.summary.monthExpensesPaise, { currency: props.currency, compact: true })}
          subtext="Rent, power, AMC, inventory"
          accent="yellow"
        />
        <StatTile
          label="// CREDIT NOTES / REFUNDS"
          value={formatMoney(props.summary.monthRefundsPaise, { currency: props.currency })}
          subtext="Audited credit notes this month"
          accent="paper"
        />
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
        {[
          { id: "invoices", label: `Invoices (${props.invoices.length})` },
          { id: "dues", label: `Dues Aging (${duesRows.length})` },
          { id: "mandates", label: `Autopay & Dunning (${props.dunningAttempts.length})` },
          { id: "corporate_gift", label: `Gift Cards & B2B (${props.giftCards.length + props.memberGroups.length})` },
          { id: "cash", label: "Cash Drawer" },
          { id: "expenses", label: `Expenses (${props.expenses.length})` },
          { id: "webhooks", label: `Webhooks (${props.webhooks.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`min-h-[48px] px-4 text-[12px] font-bold uppercase tracking-[0.08em] border-r-2 border-b-2 md:border-b-0 border-[var(--border-ink)] ${
              tab === t.id ? "bg-[#151515] text-[#FFFFFF]" : "hover:bg-[#EBC95B] hover:text-[#151515]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "invoices" || tab === "dues") && (
        <DataTable
          title={tab === "dues" ? "PART-PAYMENT DUES LEDGER" : "BRANCH GST INVOICES"}
          rows={displayedRows}
          columns={invoiceColumns}
          rowKey={(r) => r.id}
          exportHref={`/api/export/invoices${props.activeBranchId ? `?branchId=${encodeURIComponent(props.activeBranchId)}` : ""}`}
        />
      )}

      {tab === "mandates" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 bauhaus-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="bauhaus-label text-[#2B4BCC]">{`// AUTOPAY E-MANDATES (UPI / STRIPE)`}</p>
              {canCollect && (
                <div className="flex gap-1.5">
                  <select value={mdtMemberId} onChange={(e) => setMdtMemberId(e.target.value)} className="border-2 border-[var(--border-ink)] px-2 py-1 text-[12px] max-w-[150px]">
                    {props.members.slice(0, 40).map((m) => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>
                  <select value={mdtProvider} onChange={(e) => setMdtProvider(e.target.value as "RAZORPAY" | "STRIPE")} className="border-2 border-[var(--border-ink)] px-2 py-1 text-[12px]">
                    <option value="RAZORPAY">Razorpay UPI</option>
                    <option value="STRIPE">Stripe</option>
                  </select>
                  <Button
                    density="dense"
                    variant="blue"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await createAutopayMandateAction({
                          memberId: mdtMemberId,
                          provider: mdtProvider,
                          maxAmountPaise: 1500000,
                        });
                        setToastMsg(res.ok ? "e-Mandate registered." : res.error);
                        router.refresh();
                      })
                    }
                  >
                    + Mandate
                  </Button>
                </div>
              )}
            </div>
            <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)]">
              {props.mandates.map((m) => (
                <div key={m.id} className="p-3 flex items-center justify-between gap-2 text-[13px]">
                  <div>
                    <p className="font-bold">{m.memberName} ({m.memberCode})</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">
                      {m.provider} · {m.mandateRef} · Cap {formatMoney(m.maxAmountPaise)} · Next {m.nextChargeDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={m.status === "ACTIVE" ? "ACTIVE" : "FROZEN"} />
                    {canCollect && (
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await toggleAutopayMandateStatusAction(m.id);
                            router.refresh();
                          })
                        }
                        className="border border-[var(--border-ink)] px-2 py-1 text-[12px] font-bold uppercase"
                      >
                        Toggle
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {props.mandates.length === 0 && <p className="p-4 text-[13px] text-[var(--fg-grey)]">No active e-Mandates yet.</p>}
            </div>
          </div>

          <div className="lg:col-span-6 bauhaus-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="bauhaus-label text-[#C8372B]">{`// FAILED PAYMENT DUNNING CASCADE`}</p>
              {canCollect && (
                <Button
                  density="dense"
                  variant="primary"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await runDunningRetryCycleAction();
                      setToastMsg(`Dunning executed: ${res.processed} queued -> ${res.notified} WhatsApp links sent, ${res.recovered} settled.`);
                      router.refresh();
                    })
                  }
                >
                  <RefreshCw className="size-3.5" /> Run Retry Cycle
                </Button>
              )}
            </div>
            <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)]">
              {props.dunningAttempts.map((d) => (
                <div key={d.id} className="p-3 flex items-center justify-between gap-2 text-[13px]">
                  <div>
                    <p className="font-bold">{d.invoiceNumber} · {d.memberName}</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">
                      Attempt #{d.attemptNo} · Due {formatMoney(d.balanceDuePaise)} · {d.scheduledAt}
                    </p>
                  </div>
                  <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase">
                    {d.status}
                  </span>
                </div>
              ))}
              {props.dunningAttempts.length === 0 && (
                <p className="p-4 text-[13px] text-[var(--fg-grey)]">Zero failed-payment dunning retries queued.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "corporate_gift" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC] flex items-center gap-1.5">
              <Gift className="size-4" /> ISSUE &amp; TRACK GIFT CARDS
            </p>
            {canCollect && (
              <div className="grid grid-cols-3 gap-2">
                <input value={gcRecipient} onChange={(e) => setGcRecipient(e.target.value)} placeholder="Recipient Name" className="bauhaus-input" />
                <input type="number" value={gcRupees} onChange={(e) => setGcRupees(e.target.value)} placeholder="INR" className="bauhaus-input font-tabular font-bold" />
                <Button
                  variant="primary"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await issueGiftCardVoucherAction({
                        branchId: props.activeBranchId,
                        amountPaise: Math.round((Number(gcRupees) || 0) * 100),
                        recipientName: gcRecipient,
                        validDays: 365,
                      });
                      setToastMsg(`Issued Gift Card ${res.voucher.code}!`);
                      router.refresh();
                    })
                  }
                >
                  Issue Gift Card
                </Button>
              </div>
            )}
            <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)]">
              {props.giftCards.map((g) => (
                <div key={g.id} className="p-3 flex items-center justify-between text-[13px]">
                  <div>
                    <p className="font-mono font-bold text-[#2B4BCC]">{g.code}</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">For {g.recipientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-tabular">{formatMoney(g.balancePaise)} / {formatMoney(g.initialPaise)}</p>
                    <span className="text-[12px] font-bold uppercase">{g.status}</span>
                  </div>
                </div>
              ))}
              {props.giftCards.length === 0 && <p className="p-4 text-[13px] text-[var(--fg-grey)]">No gift card vouchers issued yet.</p>}
            </div>
          </div>

          <div className="lg:col-span-6 bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#C8372B] flex items-center gap-1.5">
              <Building2 className="size-4" /> CORPORATE B2B &amp; FAMILY GROUPS (GSTIN)
            </p>
            {canCollect && (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <input value={grpName} onChange={(e) => setGrpName(e.target.value)} placeholder="Group Name" className="bauhaus-input" />
                <input value={grpCompany} onChange={(e) => setGrpCompany(e.target.value)} placeholder="Legal Company" className="bauhaus-input" />
                <select value={grpType} onChange={(e) => setGrpType(e.target.value as typeof grpType)} className="bauhaus-input">
                  <option value="CORPORATE">CORPORATE</option>
                  <option value="FAMILY">FAMILY</option>
                  <option value="COUPLE">COUPLE</option>
                </select>
                <input value={grpGstin} onChange={(e) => setGrpGstin(e.target.value.toUpperCase())} placeholder="Buyer GSTIN" className="bauhaus-input uppercase font-mono" />
                <input type="number" min={2} value={grpSeats} onChange={(e) => setGrpSeats(Number(e.target.value) || 2)} placeholder="Seats" className="bauhaus-input font-tabular" />
                <Button
                  variant="blue"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await createCorporateOrFamilyGroupAction({
                        branchId: props.activeBranchId,
                        type: grpType,
                        name: grpName,
                        companyName: grpCompany,
                        corporateGstin: grpGstin,
                        seatLimit: grpSeats,
                        memberIds: props.members.slice(0, 2).map((m) => m.id),
                      });
                      setToastMsg(`Created ${grpType} group with GSTIN ${grpGstin}.`);
                      router.refresh();
                    })
                  }
                >
                  + Add B2B
                </Button>
              </div>
            )}
            <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)]">
              {props.memberGroups.map((g) => (
                <div key={g.id} className="p-3 flex items-center justify-between text-[13px]">
                  <div>
                    <p className="font-bold">{g.name} ({g.type})</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">
                      {g.companyName ? `${g.companyName} · ` : ""}GSTIN: {g.corporateGstin ?? "B2C"}
                    </p>
                  </div>
                  <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold font-tabular">
                    {g.memberCount}/{g.seatLimit} SEATS
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "cash" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canCloseCash && (
            <form onSubmit={handleCloseCash} className="lg:col-span-5 bauhaus-card p-5 space-y-4">
              <p className="bauhaus-label text-[#C8372B]">{`// CLOSE TODAY'S CASH REGISTER (IST · INCLUDES REFUNDS & POS)`}</p>
              <div>
                <label className="bauhaus-label block mb-1">Opening Till Cash (INR)</label>
                <input type="number" value={openingCashRupees} onChange={(e) => setOpeningCashRupees(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              </div>
              <div>
                <label className="bauhaus-label block mb-1">Physical Counted Cash (INR)</label>
                <input type="number" value={countedCashRupees} onChange={(e) => setCountedCashRupees(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              </div>
              <Button type="submit" variant="primary" fullWidth disabled={isPending}>Submit Cash Closing</Button>
            </form>
          )}
          <div className="lg:col-span-7 bauhaus-card divide-y-2 divide-[var(--border-ink)]">
            <div className="p-4 bg-[var(--bg-muted)]">
              <p className="bauhaus-label">{`// RECENT RECONCILIATION HISTORY`}</p>
            </div>
            {props.cashSessions.map((c) => (
              <div key={c.id} className="p-4 flex flex-wrap justify-between gap-2 text-[14px] font-tabular">
                <span className="font-bold">{c.date} ({c.branchCode})</span>
                <span>Expected: {formatMoney(c.expectedPaise, { currency: props.currency })}</span>
                <span>Counted: {formatMoney(c.countedPaise, { currency: props.currency })}</span>
                <span className={c.variancePaise === 0 ? "font-bold text-[#2B4BCC]" : "font-bold text-[#C8372B]"}>
                  Var: {formatMoney(c.variancePaise, { currency: props.currency })}
                </span>
              </div>
            ))}
            {props.cashSessions.length === 0 && (
              <p className="p-6 text-[14px] text-[var(--fg-grey)]">No register closings submitted yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canWriteExpense && (
            <form onSubmit={handleAddExpense} className="lg:col-span-4 bauhaus-card p-5 space-y-3">
              <p className="bauhaus-label text-[#C8372B]">{`// LOG VENDOR EXPENSE (GSTR-3B ITC)`}</p>
              <input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} placeholder="Category" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              <input value={expVendor} onChange={(e) => setExpVendor(e.target.value)} placeholder="Vendor Name" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Description" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              <input type="number" value={expRupees} onChange={(e) => setExpRupees(e.target.value)} placeholder="Amount (INR)" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
              <Button type="submit" variant="primary" fullWidth disabled={isPending}>Record Expense</Button>
            </form>
          )}
          <div className="lg:col-span-8 bauhaus-card divide-y-2 divide-[var(--border-ink)]">
            {props.expenses.map((ex) => (
              <div key={ex.id} className="p-4 flex flex-wrap justify-between gap-2 text-[14px]">
                <div>
                  <p className="font-bold">{ex.vendorName} · {ex.category}</p>
                  <p className="text-[12px] text-[var(--fg-grey)]">{ex.description} ({ex.incurredOn} · {ex.branchCode})</p>
                </div>
                <span className="font-tabular font-bold text-[#C8372B]">
                  {formatMoney(ex.amountPaise, { currency: props.currency })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "webhooks" && (
        <div className="bauhaus-card divide-y-2 divide-[var(--border-ink)]">
          <div className="p-4 bg-[#151515] text-[#FFFFFF]">
            <p className="bauhaus-label text-[#EBC95B]">{`// RAZORPAY & STRIPE IDEMPOTENT WEBHOOK INBOX + DLQ REPLAY`}</p>
          </div>
          {props.webhooks.map((w) => (
            <div key={w.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-[14px]">
              <div>
                <p className="font-bold">{w.provider} · {w.externalEventId}</p>
                <p className="text-[12px] text-[var(--fg-grey)]">
                  Signature Valid: {String(w.signatureValid)} {w.lastError ? `· Error: ${w.lastError}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={w.status} />
                {canCollect && w.status !== "PROCESSED" && (
                  <Button
                    density="dense"
                    variant="yellow"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await replayWebhookEventAction(w.id);
                        setToastMsg(`Replayed webhook ${w.externalEventId}.`);
                        router.refresh();
                      })
                    }
                  >
                    Replay DLQ
                  </Button>
                )}
              </div>
            </div>
          ))}
          {props.webhooks.length === 0 && (
            <p className="p-6 text-[14px] text-[var(--fg-grey)]">
              POST signed Razorpay/Stripe JSON payloads to <code className="font-bold">/api/webhooks/payments</code> to test idempotent capture &amp; DLQ replay.
            </p>
          )}
        </div>
      )}

      {/* Sell Plan Drawer */}
      <Drawer open={sellOpen} onClose={() => setSellOpen(false)} eyebrow="NEW GST INVOICE" title="Sell Plan / Collect">
        <form onSubmit={handleSellPlan} className="space-y-4">
          <div>
            <label className="bauhaus-label block mb-1">Select Member</label>
            <select value={saleMemberId} onChange={(e) => setSaleMemberId(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold">
              {props.members.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="bauhaus-label block mb-1">Select Plan</label>
            <select value={salePlanId} onChange={(e) => setSalePlanId(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold">
              {props.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatMoney(p.pricePaise, { currency: props.currency })} (+18% GST)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSalePartialMode("FULL")} className={`min-h-[44px] border-2 border-[var(--border-ink)] text-[12px] font-bold uppercase ${salePartialMode === "FULL" ? "bg-[#151515] text-[#FFFFFF]" : ""}`}>
              Full Pay ({formatMoney(approxGrossPaise)})
            </button>
            <button type="button" onClick={() => setSalePartialMode("PARTIAL")} className={`min-h-[44px] border-2 border-[var(--border-ink)] text-[12px] font-bold uppercase ${salePartialMode === "PARTIAL" ? "bg-[#151515] text-[#FFFFFF]" : ""}`}>
              Part-Payment + Dues
            </button>
          </div>
          {salePartialMode === "PARTIAL" && (
            <div>
              <label className="bauhaus-label block mb-1">Amount Paid Now (INR)</label>
              <input type="number" min={1} value={salePartialRupees} onChange={(e) => setSalePartialRupees(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px] font-tabular font-bold" />
            </div>
          )}
          <div>
            <label className="bauhaus-label block mb-1">Payment Method</label>
            <select value={saleMethod} onChange={(e) => setSaleMethod(e.target.value as typeof saleMethod)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold">
              <option value="UPI">UPI QR (Razorpay)</option>
              <option value="CARD">Card POS</option>
              <option value="CASH">Cash Drawer</option>
              <option value="BANK_TRANSFER">Bank NEFT</option>
              <option value="SPLIT">Split Payment</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="bauhaus-label block">
              Discount %
              <input type="number" min={0} max={50} value={saleDiscountPct} onChange={(e) => setSaleDiscountPct(Number(e.target.value) || 0)} className="mt-1 w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px] font-tabular font-bold" />
            </label>
            {requiresManagerOtpForDiscount(saleDiscountPct) && (
              <label className="bauhaus-label block text-[#C8372B]">
                Manager OTP *
                <input type="text" maxLength={6} placeholder="482910" value={managerOtp} onChange={(e) => setManagerOtp(e.target.value)} className="mt-1 w-full min-h-[44px] border-2 border-[#C8372B] px-3 text-[14px] font-mono font-bold" />
              </label>
            )}
          </div>
          <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
            Generate GST Invoice &amp; Settle
          </Button>
        </form>
      </Drawer>

      {/* Collect Balance Modal with Single + Split-Tender & Gift Card Redemption */}
      <Modal open={Boolean(collectTarget)} onClose={() => setCollectTarget(null)} eyebrow="DUES & SPLIT TENDER" title={`Collect Balance (${collectTarget?.invoiceNumber ?? ""})`}>
        <form onSubmit={handleCollectPayment} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px]">Remaining due: <strong className="text-[#C8372B]">{formatMoney(collectTarget?.balanceDuePaise ?? 0)}</strong></p>
            <button
              type="button"
              onClick={() => setSplitMode((v) => !v)}
              className="border-2 border-[var(--border-ink)] px-2.5 py-1 text-[12px] font-bold uppercase bg-[#EBC95B] text-[#151515]"
            >
              <Split className="size-3.5 inline mr-1" />
              {splitMode ? "Switch to Single Method" : "Split-Tender / Gift Card"}
            </button>
          </div>

          {splitMode ? (
            <div className="space-y-3 border-2 border-[var(--border-ink)] p-3 bg-[var(--bg-paper)]">
              <div className="grid grid-cols-2 gap-2">
                <label className="bauhaus-label block">
                  UPI (INR)
                  <input type="number" min={0} value={splitUpiRupees} onChange={(e) => setSplitUpiRupees(e.target.value)} className="mt-1 bauhaus-input font-tabular font-bold" />
                </label>
                <label className="bauhaus-label block">
                  Cash (INR)
                  <input type="number" min={0} value={splitCashRupees} onChange={(e) => setSplitCashRupees(e.target.value)} className="mt-1 bauhaus-input font-tabular font-bold" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="bauhaus-label block">
                  Gift Card Code
                  <input value={splitGiftCode} onChange={(e) => setSplitGiftCode(e.target.value.toUpperCase())} placeholder="FG-XXXX-XXXX" className="mt-1 bauhaus-input uppercase font-mono" />
                </label>
                <label className="bauhaus-label block">
                  Discount Waiver (INR)
                  <input type="number" min={0} value={collectWaiveRupees} onChange={(e) => setCollectWaiveRupees(e.target.value)} className="mt-1 bauhaus-input" />
                </label>
              </div>
              {Number(collectWaiveRupees || 0) * 100 > (collectTarget?.totalPaise ?? 0) * 0.15 && (
                <label className="bauhaus-label block text-[#C8372B]">
                  Manager OTP (&gt;15% waiver · demo 482910)
                  <input value={collectManagerOtp} onChange={(e) => setCollectManagerOtp(e.target.value)} placeholder="482910" className="mt-1 bauhaus-input font-mono border-[#C8372B]" />
                </label>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="bauhaus-label block mb-1">Payment Amount (INR)</label>
                <input type="number" min={1} value={collectRupees} onChange={(e) => setCollectRupees(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px] font-tabular font-bold" />
              </div>
              <div>
                <label className="bauhaus-label block mb-1">Method</label>
                <select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value as typeof collectMethod)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold">
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="SPLIT">Split</option>
                </select>
              </div>
            </>
          )}
          <Button type="submit" variant="primary" fullWidth disabled={isPending}>Record Settlement</Button>
        </form>
      </Modal>

      {/* Refund Modal */}
      <Modal open={Boolean(refundTarget)} onClose={() => setRefundTarget(null)} eyebrow="AUDIT LOGGED REFUND" title={`Credit Note (${refundTarget?.invoiceNumber ?? ""})`}>
        <form onSubmit={handleIssueRefund} className="space-y-4">
          <div>
            <label className="bauhaus-label block mb-1">Refund Amount (INR)</label>
            <input type="number" min={1} value={refundRupees} onChange={(e) => setRefundRupees(e.target.value)} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
          </div>
          <div>
            <label className="bauhaus-label block mb-1">Reason *</label>
            <input required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Medical relocation / duplicate swipe" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
          </div>
          <Button type="submit" variant="primary" fullWidth disabled={isPending}>Issue Credit Note</Button>
        </form>
      </Modal>
    </div>
  );
}
