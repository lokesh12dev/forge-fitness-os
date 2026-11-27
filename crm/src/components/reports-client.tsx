"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, Send, Plus, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import type { ReportCatalogEntry } from "@/lib/reports-ai";
import {
  createScheduledReportAction,
  sendDailyOwnerSummaryDigestAction,
} from "@/app/actions/phase34-actions";

export function ReportsClient({
  currency,
  canExport,
  showFinance,
  activeCount,
  posTotalPaise,
  gstr,
  catalog,
  recentInvoices,
  scheduledReports,
}: {
  currency: string;
  canExport: boolean;
  showFinance: boolean;
  activeCount: number;
  posTotalPaise: number;
  gstr: {
    invoiceCount: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
  } | null;
  catalog: ReportCatalogEntry[];
  recentInvoices: Array<{
    invoiceNumber: string;
    sacCode: string;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    status: string;
  }>;
  scheduledReports: Array<{ id: string; name: string; reportType: string; cadence: string; recipient: string }>;
}) {
  const router = useRouter();
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedName, setSchedName] = useState("Weekly CA Tax & Collection Digest");
  const [schedType, setSchedType] = useState(catalog[0]?.key ?? "MEMBER_DIRECTORY");
  const [schedCadence, setSchedCadence] = useState<"DAILY_9PM" | "WEEKLY_MON" | "MONTHLY_1ST">("WEEKLY_MON");
  const [schedRecip, setSchedRecip] = useState("accountant@ironworks.in");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const dateQs = `${fromDate ? `&from=${encodeURIComponent(fromDate)}` : ""}${toDate ? `&to=${encodeURIComponent(toDate)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// INTELLIGENCE, GSTR TAX PACKS & SCHEDULES"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">REPORTS &amp; EXPORTS.</h1>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="yellow"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await sendDailyOwnerSummaryDigestAction();
                if (res.ok) setToast({ msg: `9 PM WhatsApp Summary Sent: ${res.summary}`, tone: "blue" });
              })}
            >
              <Send className="size-4" /> Send 9 PM Owner Pulse
            </Button>
            <Button variant="primary" onClick={() => setSchedOpen(true)}>
              <Plus className="size-4" /> Schedule Digest
            </Button>
          </div>
        )}
      </div>

      {/* GSTR Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// AVAILABLE REPORTS" value={catalog.length} subtext="Role-scoped export library" accent="blue" />
        <StatTile label="// ACTIVE MEMBERS" value={activeCount} subtext="Scoped branch roster" accent="ink" />
        {showFinance && gstr ? (
          <>
            <StatTile label="// GSTR-1 TAXABLE BASE" value={formatMoney(gstr.taxablePaise, { currency })} subtext={`${gstr.invoiceCount} SAC 999723 invoices`} accent="yellow" />
            <StatTile label="// TOTAL GST (CGST/SGST/IGST)" value={formatMoney(gstr.cgstPaise + gstr.sgstPaise + gstr.igstPaise, { currency })} subtext={`POS Retail: ${formatMoney(posTotalPaise, { currency })}`} accent="red" />
          </>
        ) : (
          <StatTile label="// FINANCE GATED" value="RBAC" subtext="Financial tax sheets hidden for role" accent="paper" />
        )}
      </div>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          <span className="bauhaus-label">{"// IST EXPORT DATE WINDOW"}</span>
          <input type="date" aria-label="From date" className="bauhaus-input w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span className="text-[12px] font-bold">TO</span>
          <input type="date" aria-label="To date" className="bauhaus-input w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {canExport && showFinance && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/export/reports?type=GSTR1_REGISTER&format=json${dateQs}`}
              className="min-h-[40px] inline-flex items-center gap-1.5 border-2 border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] px-3 text-[12px] font-bold uppercase hover:bg-[#151515]"
            >
              <FileJson className="size-4" /> GSTR-1 JSON
            </a>
            <a
              href={`/api/export/reports?type=GSTR3B_SUMMARY&format=json${dateQs}`}
              className="min-h-[40px] inline-flex items-center gap-1.5 border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-3 text-[12px] font-bold uppercase hover:bg-[#151515] hover:text-[#FFFFFF]"
            >
              <FileJson className="size-4" /> GSTR-3B JSON
            </a>
          </div>
        )}
      </FilterBar>

      {/* 14+ Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalog.map((r) => (
          <div key={r.key} className="bauhaus-card p-5 flex flex-col justify-between gap-4">
            <div>
              <span className="bauhaus-label text-[#C8372B]">{`// ${r.category}`}</span>
              <h2 className="font-headline text-[20px] mt-1">{r.title}</h2>
              <p className="text-[13px] text-[var(--fg-grey)] mt-1">{r.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canExport ? (
                <a
                  href={`/api/export/reports?type=${encodeURIComponent(r.key)}${dateQs}`}
                  className="min-h-[40px] inline-flex items-center gap-1.5 border-2 border-[#151515] bg-[#151515] text-[#FFFFFF] px-3 text-[12px] font-bold uppercase hover:bg-[#2B4BCC]"
                >
                  <Download className="size-4" /> Export CSV
                </a>
              ) : (
                <span className="text-[12px] font-bold text-[var(--fg-grey)] uppercase">View Only</span>
              )}
              <Button variant="tertiary" onClick={() => window.print()}>
                <Printer className="size-4" /> Print PDF
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* GSTR Register Preview */}
      {showFinance && recentInvoices.length > 0 && (
        <div className="bauhaus-card p-5 space-y-3 overflow-x-auto">
          <p className="bauhaus-label text-[#2B4BCC]">{"// GSTR-1 OUTWARD TAX BREAKUP PREVIEW"}</p>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)]">
                <th className="p-2 text-left">Invoice #</th>
                <th className="p-2 text-left">SAC</th>
                <th className="p-2 text-right">Taxable</th>
                <th className="p-2 text-right">CGST</th>
                <th className="p-2 text-right">SGST</th>
                <th className="p-2 text-right">IGST</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-ink)]">
              {recentInvoices.slice(0, 8).map((inv) => (
                <tr key={inv.invoiceNumber}>
                  <td className="p-2 font-bold">{inv.invoiceNumber}</td>
                  <td className="p-2 font-mono">{inv.sacCode}</td>
                  <td className="p-2 text-right font-tabular">{formatMoney(inv.taxablePaise, { currency })}</td>
                  <td className="p-2 text-right font-tabular">{formatMoney(inv.cgstPaise, { currency })}</td>
                  <td className="p-2 text-right font-tabular">{formatMoney(inv.sgstPaise, { currency })}</td>
                  <td className="p-2 text-right font-tabular">{formatMoney(inv.igstPaise, { currency })}</td>
                  <td className="p-2 text-right font-tabular font-bold">{formatMoney(inv.totalPaise, { currency })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scheduled Digests */}
      {scheduledReports.length > 0 && (
        <div className="bauhaus-card p-5 space-y-2">
          <p className="bauhaus-label">{"// ACTIVE SCHEDULED DIGESTS"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scheduledReports.map((s) => (
              <div key={s.id} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3 flex items-center justify-between gap-2 text-[13px]">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-[12px] text-[var(--fg-grey)]">{s.reportType} → {s.recipient}</p>
                </div>
                <span className="bg-[#EBC95B] text-[#151515] px-2 py-0.5 border border-[#151515] text-[12px] font-bold">{s.cadence}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={schedOpen} onClose={() => setSchedOpen(false)} eyebrow="AUTO DIGESTS" title="Schedule WhatsApp / Email Report">
        <div className="space-y-4">
          <div>
            <label htmlFor="sc-nm" className="bauhaus-label block mb-1.5">{"// DIGEST NAME"}</label>
            <input id="sc-nm" className="bauhaus-input" value={schedName} onChange={(e) => setSchedName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sc-tp" className="bauhaus-label block mb-1.5">{"// REPORT"}</label>
              <select id="sc-tp" className="bauhaus-input" value={schedType} onChange={(e) => setSchedType(e.target.value)}>
                {catalog.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sc-cd" className="bauhaus-label block mb-1.5">{"// CADENCE"}</label>
              <select id="sc-cd" className="bauhaus-input" value={schedCadence} onChange={(e) => setSchedCadence(e.target.value as "DAILY_9PM" | "WEEKLY_MON" | "MONTHLY_1ST")}>
                <option value="DAILY_9PM">DAILY AT 9 PM IST</option>
                <option value="WEEKLY_MON">WEEKLY MONDAY</option>
                <option value="MONTHLY_1ST">MONTHLY 1ST (CA)</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="sc-rc" className="bauhaus-label block mb-1.5">{"// RECIPIENT PHONE / EMAIL"}</label>
            <input id="sc-rc" className="bauhaus-input" value={schedRecip} onChange={(e) => setSchedRecip(e.target.value)} />
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              await createScheduledReportAction({
                name: schedName,
                reportType: schedType,
                cadence: schedCadence,
                recipient: schedRecip,
              });
              setSchedOpen(false);
              setToast({ msg: "Scheduled report activated.", tone: "blue" });
              router.refresh();
            })}
          >
            SAVE SCHEDULED REPORT
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
