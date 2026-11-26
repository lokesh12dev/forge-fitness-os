"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, Toast } from "@/components/ui/primitives";
import { QRCode } from "@/components/ui/qr-code";
import { formatMoney } from "@/lib/money";
import { collectInvoicePaymentAction, sendMemberOutreachAction } from "@/app/actions/crm-actions";

export function InvoicePrintClient(props: {
  canCollect: boolean;
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    currency: string;
    sacCode: string;
    placeOfSupplyState: string;
    branchStateCode: string;
    subtotalPaise: number;
    discountPaise: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    paidPaise: number;
    balanceDuePaise: number;
  };
  org: { name: string; gstin: string };
  branch: { name: string; address: string };
  member: { id: string; fullName: string; memberCode: string; phone: string; email: string };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    discountPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
  }>;
  payments: Array<{ id: string; method: string; amountPaise: number; paidAt: string }>;
}) {
  const router = useRouter();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const upiString = `upi://pay?pa=forgegym@icici&pn=${encodeURIComponent(props.org.name)}&tr=${encodeURIComponent(
    props.invoice.invoiceNumber
  )}&am=${(Math.max(0, props.invoice.balanceDuePaise) / 100).toFixed(2)}&cu=${props.invoice.currency}`;

  const handleSendReceipt = () => {
    startTransition(async () => {
      await sendMemberOutreachAction({
        memberId: props.member.id,
        channel: "WHATSAPP",
        body: `GST Tax Invoice ${props.invoice.invoiceNumber} (${formatMoney(props.invoice.totalPaise)}) from ${props.org.name}. Balance Due: ${formatMoney(props.invoice.balanceDuePaise)}.`,
      });
      setToastMsg("Dispatched WhatsApp GST receipt to member timeline.");
    });
  };

  const handlePayRemainder = () => {
    if (props.invoice.balanceDuePaise <= 0) return;
    startTransition(async () => {
      await collectInvoicePaymentAction({
        invoiceId: props.invoice.id,
        amountPaise: props.invoice.balanceDuePaise,
        method: "UPI",
      });
      setToastMsg("Balance collected via UPI!");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/billing" className="text-[13px] font-bold uppercase underline">
          ← Back to Billing Ledger
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="tertiary" onClick={handleSendReceipt} disabled={isPending}>
            <Send className="size-4" /> Send Receipt (WhatsApp)
          </Button>
          {props.canCollect && props.invoice.balanceDuePaise > 0 && (
            <Button variant="primary" onClick={handlePayRemainder} disabled={isPending}>
              Collect {formatMoney(props.invoice.balanceDuePaise)}
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Bauhaus Tax Invoice */}
      <div className="bg-[#FFFFFF] text-[#151515] border-[3px] border-[#151515] p-6 md:p-10 space-y-6">
        <div className="flex flex-wrap justify-between gap-6 border-b-[3px] border-[#151515] pb-6">
          <div>
            <p className="bauhaus-label text-[#C8372B] mb-2">{`// TAX INVOICE · INDIA GST`}</p>
            <h1 className="font-headline text-[32px] md:text-[40px]">{props.org.name}</h1>
            <p className="text-[14px] mt-1">{props.branch.name} — {props.branch.address}</p>
            <p className="text-[13px] font-bold mt-1 uppercase">
              GSTIN: {props.org.gstin} · SAC: {props.invoice.sacCode}
            </p>
          </div>
          <div className="text-left md:text-right space-y-1">
            <StatusPill status={props.invoice.status} />
            <p className="font-headline text-[24px] mt-2">{props.invoice.invoiceNumber}</p>
            <p className="text-[13px]">Issued: <strong>{props.invoice.issueDate}</strong></p>
            <p className="text-[13px]">Place of Supply: <strong>{props.invoice.placeOfSupplyState}</strong> (Branch: {props.invoice.branchStateCode})</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="bauhaus-label text-[#6F6B61] mb-1">BILLED TO MEMBER</p>
            <p className="font-bold text-[18px]">{props.member.fullName}</p>
            <p className="text-[14px]">{props.member.memberCode} · {props.member.phone}</p>
            {props.member.email && <p className="text-[13px] text-[#6F6B61]">{props.member.email}</p>}
          </div>
          {props.invoice.balanceDuePaise > 0 && (
            <QRCode value={upiString} size={112} label="UPI PAY QR" />
          )}
        </div>

        <div className="overflow-x-auto border-2 border-[#151515]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#151515] text-[#FFFFFF]">
              <tr>
                <th className="p-3 text-[12px] font-bold uppercase">Description (SAC {props.invoice.sacCode})</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Qty</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Rate</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Disc</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">CGST</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">SGST</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">IGST</th>
                <th className="p-3 text-[12px] font-bold uppercase text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#151515] font-tabular text-[14px]">
              {props.lines.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 font-bold">{l.description}</td>
                  <td className="p-3 text-right">{l.quantity}</td>
                  <td className="p-3 text-right">{formatMoney(l.unitPricePaise, { currency: props.invoice.currency })}</td>
                  <td className="p-3 text-right">{formatMoney(l.discountPaise, { currency: props.invoice.currency })}</td>
                  <td className="p-3 text-right">{formatMoney(l.cgstPaise, { currency: props.invoice.currency })}</td>
                  <td className="p-3 text-right">{formatMoney(l.sgstPaise, { currency: props.invoice.currency })}</td>
                  <td className="p-3 text-right">{formatMoney(l.igstPaise, { currency: props.invoice.currency })}</td>
                  <td className="p-3 text-right font-bold">{formatMoney(l.totalPaise, { currency: props.invoice.currency })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <p className="bauhaus-label text-[#6F6B61] mb-2">SETTLEMENT PAYMENTS</p>
            {props.payments.length > 0 ? (
              <div className="space-y-1.5 text-[13px] font-tabular">
                {props.payments.map((p) => (
                  <p key={p.id}>• {p.method} — <strong>{formatMoney(p.amountPaise)}</strong> ({p.paidAt})</p>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#6F6B61]">Awaiting settlement.</p>
            )}
          </div>

          <div className="border-2 border-[#151515] bg-[#F6F1E4] p-4 space-y-2 font-tabular text-[14px]">
            <div className="flex justify-between"><span>Taxable Value</span><strong>{formatMoney(props.invoice.taxablePaise)}</strong></div>
            <div className="flex justify-between"><span>CGST (9%)</span><span>{formatMoney(props.invoice.cgstPaise)}</span></div>
            <div className="flex justify-between"><span>SGST (9%)</span><span>{formatMoney(props.invoice.sgstPaise)}</span></div>
            <div className="flex justify-between"><span>IGST (18%)</span><span>{formatMoney(props.invoice.igstPaise)}</span></div>
            <div className="flex justify-between border-t-2 border-[#151515] pt-2 text-[18px] font-bold">
              <span>GRAND TOTAL</span><span>{formatMoney(props.invoice.totalPaise)}</span>
            </div>
            <div className="flex justify-between"><span>Paid</span><span>{formatMoney(props.invoice.paidPaise)}</span></div>
            <div className="flex justify-between text-[#C8372B] font-bold">
              <span>BALANCE DUE</span><span>{formatMoney(props.invoice.balanceDuePaise)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
