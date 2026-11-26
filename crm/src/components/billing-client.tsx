"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { hasPermission, type CrmRole } from "@/lib/rbac";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  memberCode: string;
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
  members: Array<{ id: string; fullName: string; memberCode: string; branchId: string }>;
  plans: Array<{ id: string; name: string; pricePaise: number; durationDays: number }>;
  webhooks: Array<{ id: string; provider: string; externalEventId: string; status: string; signatureValid: boolean; lastError: string | null }>;
  cashSessions: Array<{ id: string; branchCode: string; date: string; expectedPaise: number; countedPaise: number; variancePaise: number }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"invoices" | "dues" | "cash" | "expenses" | "webhooks">("invoices");
  const [sellOpen, setSellOpen] = useState(props.openSellOnMount && hasPermission(props.role, "billing:collect"));
  const [collectTarget, setCollectTarget] = useState<InvoiceRow | null>(null);
  const [collectRupees, setCollectRupees] = useState("");
  const [collectMethod, setCollectMethod] = useState<"UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT">("UPI");
  const [refundTarget, setRefundTarget] = useState<InvoiceRow | null>(null);
  const [refundRupees, setRefundRupees] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Quick Sell form
  const [saleMemberId, setSaleMemberId] = useState(props.members[0]?.id ?? "");
  const [salePlanId, setSalePlanId] = useState(props.plans[0]?.id ?? "");
  const [salePartialMode, setSalePartialMode] = useState<"FULL" | "PARTIAL">("PARTIAL");
  const [salePartialRupees, setSalePartialRupees] = useState("2500");
  const [saleMethod, setSaleMethod] = useState<"UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "SPLIT">("UPI");

  // Cash & Expenses state
  const [openingCashRupees, setOpeningCashRupees] = useState("2000");
  const [countedCashRupees, setCountedCashRupees] = useState("2000");
  const [expCategory, setExpCategory] = useState("Equipment Maintenance");
  const [expVendor, setExpVendor] = useState("Technogym Service");
  const [expDesc, setExpDesc] = useState("Cable replacement & rack calibration");
  const [expRupees, setExpRupees] = useState("4500");

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
    const paise = Math.round(Number(collectRupees || 0) * 100);
    startTransition(async () => {
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
      setToastMsg(`Collected payment! Remaining balance: ${formatMoney(res.balanceDuePaise, { currency: props.currency })}`);
      router.refresh();
    });
  };

  const handleIssueRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const paise = Math.round(Number(refundRupees || 0) * 100);
    startTransition(async () => {
      const res = await issueRefundAction({
        invoiceId: refundTarget.id,
        amountPaise: paise,
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
    const targetBranch = props.activeBranchId || props.branches[0]?.id;
    if (!targetBranch) return;
    startTransition(async () => {
      const res = await closeCashDrawerAction({
        branchId: targetBranch,
        openingCashPaise: Math.round(Number(openingCashRupees || 0) * 100),
        countedCashPaise: Math.round(Number(countedCashRupees || 0) * 100),
      });
      setToastMsg(
        `Day-End Cash Closed. Variance: ${formatMoney(res.variancePaise, { currency: props.currency })}`
      );
      router.refresh();
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBranch = props.activeBranchId || props.branches[0]?.id;
    if (!targetBranch) return;
    const amt = Math.round(Number(expRupees || 0) * 100);
    startTransition(async () => {
      await addExpenseAction({
        branchId: targetBranch,
        category: expCategory,
        vendorName: expVendor,
        description: expDesc,
        amountPaise: amt,
        gstPaise: Math.round(amt * 0.18),
      });
      setToastMsg("Recorded expense entry.");
      router.refresh();
    });
  };

  const invoiceColumns: DataColumn<InvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice #",
      render: (r) => (
        <Link href={`/app/billing/invoices/${r.id}`} className="font-bold underline hover:text-[#C8372B]">
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "member",
      header: "Member",
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
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "tax",
      header: "GST",
      align: "right",
      render: (r) =>
        r.igstPaise > 0
          ? `IGST ${formatMoney(r.igstPaise, { currency: props.currency })}`
          : `C+S ${formatMoney(r.cgstPaise + r.sgstPaise, { currency: props.currency })}`,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => <span className="font-bold">{formatMoney(r.totalPaise, { currency: props.currency })}</span>,
    },
    {
      key: "due",
      header: "Balance Due",
      align: "right",
      render: (r) => (
        <span className={r.balanceDuePaise > 0 ? "font-bold text-[#C8372B]" : "font-bold"}>
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
              variant="primary"
              onClick={() => {
                setCollectTarget(r);
                setCollectRupees((r.balanceDuePaise / 100).toFixed(0));
              }}
            >
              Collect
            </Button>
          )}
          {canRefund && r.paidPaise > 0 && r.status !== "REFUNDED" && (
            <Button
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
          <p className="bauhaus-label text-[#C8372B] mb-2">{`// GST INVOICES, DUES LEDGER, CASH & EXPENSES`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">BILLING &amp; LEDGER</h1>
        </div>
        {canCollect && (
          <Button variant="primary" onClick={() => setSellOpen(true)}>
            + Sell Plan / Collect Payment
          </Button>
        )}
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
          { id: "invoices", label: `GST Invoices (${props.invoices.length})` },
          { id: "dues", label: `Dues Aging (${duesRows.length})` },
          { id: "cash", label: "Day-End Cash Drawer" },
          { id: "expenses", label: `Expenses (${props.expenses.length})` },
          { id: "webhooks", label: `Webhook Inbox (${props.webhooks.length})` },
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

      {tab === "cash" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {canCloseCash && (
            <form onSubmit={handleCloseCash} className="lg:col-span-5 bauhaus-card p-5 space-y-4">
              <p className="bauhaus-label text-[#C8372B]">{`// CLOSE TODAY'S CASH REGISTER`}</p>
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
              <p className="bauhaus-label text-[#C8372B]">{`// LOG VENDOR EXPENSE`}</p>
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
            <p className="bauhaus-label text-[#EBC95B]">{`// RAZORPAY & STRIPE IDEMPOTENT WEBHOOK INBOX + DLQ`}</p>
          </div>
          {props.webhooks.map((w) => (
            <div key={w.id} className="p-4 flex flex-wrap justify-between gap-2 text-[14px]">
              <div>
                <p className="font-bold">{w.provider} · {w.externalEventId}</p>
                <p className="text-[12px] text-[var(--fg-grey)]">
                  Signature Valid: {String(w.signatureValid)} {w.lastError ? `· Error: ${w.lastError}` : ""}
                </p>
              </div>
              <StatusPill status={w.status} />
            </div>
          ))}
          {props.webhooks.length === 0 && (
            <p className="p-6 text-[14px] text-[var(--fg-grey)]">
              POST signed Razorpay/Stripe JSON payloads to <code className="font-bold">/api/webhooks/payments</code> to test idempotent capture &amp; DLQ handling.
            </p>
          )}
        </div>
      )}

      {/* Sell Plan & Partial Payment Drawer */}
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
          <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
            Generate GST Invoice &amp; Settle
          </Button>
        </form>
      </Drawer>

      {/* Collect Balance Modal */}
      <Modal open={Boolean(collectTarget)} onClose={() => setCollectTarget(null)} eyebrow="DUES SETTLEMENT" title={`Collect Balance (${collectTarget?.invoiceNumber ?? ""})`}>
        <form onSubmit={handleCollectPayment} className="space-y-4">
          <p className="text-[14px]">Remaining balance: <strong className="text-[#C8372B]">{formatMoney(collectTarget?.balanceDuePaise ?? 0)}</strong></p>
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
          <Button type="submit" variant="primary" fullWidth disabled={isPending}>Record Settlement</Button>
        </form>
      </Modal>

      {/* Issue Credit Note / Refund Modal */}
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
