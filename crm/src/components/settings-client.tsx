"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Download, Key, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, StatTile, Toast } from "@/components/ui/primitives";
import type { ParsedImportRow } from "@/lib/reports-ai";
import {
  createApiKeyAction,
  createWebhookSubscriptionAction,
  executeDpdpComplianceAction,
  revokeApiKeyAction,
  runMigrationImportAction,
} from "@/app/actions/phase34-actions";

const SAMPLE_MIGRATION_CSV = `fullName,phone,email,status
Aditi Deshpande,+91 98451 60111,aditi.mig@mail.in,ACTIVE
Prashant Iyer,+91 98451 60112,prashant.mig@mail.in,ACTIVE
Bad Row,12,broken,ACTIVE`;

export function SettingsClient({
  org,
  branches,
  holidays,
  apiKeys,
  webhookSubs,
  importJobs,
  dpdpJobs,
  auditLogs,
  members,
  gatewayStatus,
}: {
  org: { name: string; slug: string; gstin: string | null; currency: string; invoicePrefix: string; defaultGstBps: number };
  branches: Array<{ id: string; name: string; code: string; stateCode: string; address: string; invoiceSeriesPrefix: string; nextInvoiceSeq: number }>;
  holidays: Array<{ id: string; branchName: string; title: string; date: string }>;
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; revokedAt: string | null }>;
  webhookSubs: Array<{ id: string; targetUrl: string; events: string[]; secretPreview: string; isActive: boolean }>;
  importJobs: Array<{ id: string; sourcePlatform: string; mode: string; totalRows: number; validRows: number; errorRows: number; createdAt: string }>;
  dpdpJobs: Array<{ id: string; memberName: string; memberCode: string; kind: string; status: string; createdAt: string }>;
  auditLogs: Array<{ id: string; timestamp: string; actorName: string; actorRole: string; action: string; resourceType: string; resourceId: string }>;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  gatewayStatus: { razorpayConfigured: boolean; stripeConfigured: boolean; whatsappConfigured: boolean; smsConfigured: boolean; s3Configured: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"BRANCHES" | "RBAC" | "IMPORTER" | "API" | "DPDP">("BRANCHES");
  const [csvText, setCsvText] = useState(SAMPLE_MIGRATION_CSV);
  const [sourcePlatform, setSourcePlatform] = useState<"CSV" | "GYMDESK" | "MINDBODY" | "HEVY">("GYMDESK");
  const [importBranchId, setImportBranchId] = useState(branches[0]?.id ?? "");
  const [dryRows, setDryRows] = useState<ParsedImportRow[] | null>(null);

  const [newKeyName, setNewKeyName] = useState("Mobile Turnstile Bridge Key");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [whUrl, setWhUrl] = useState("https://example.internal/forge-events");

  const [dpdpMemberId, setDpdpMemberId] = useState(members[members.length - 1]?.id ?? "");
  const [dpdpExportPreview, setDpdpExportPreview] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const auditCols: DataColumn<(typeof auditLogs)[number]>[] = [
    { key: "ts", header: "IST Timestamp", render: (r) => <span className="text-[12px] font-tabular">{r.timestamp}</span> },
    { key: "actor", header: "Actor", render: (r) => <span className="font-bold">{r.actorName} ({r.actorRole})</span> },
    { key: "act", header: "Action", render: (r) => <span className="border border-[#151515] px-2 py-0.5 text-[12px] font-bold">{r.action}</span> },
    { key: "res", header: "Resource", render: (r) => <span className="text-[12px] font-mono">{r.resourceType} · {r.resourceId}</span> },
  ];

  const rbacRows = [
    { area: "Org Setup, GSTIN, API Keys & DPDP", owner: "ALL", mgr: "—", fd: "—", tr: "—", acc: "—", mem: "—" },
    { area: "GST Billing, Refunds & Cash Close", owner: "ALL", mgr: "OWN-B", fd: "COLLECT", tr: "403 BLOCK", acc: "READ ONLY", mem: "OWN INV" },
    { area: "Leads Pipeline & Source ROI", owner: "ALL", mgr: "OWN-B", fd: "NO ROI", tr: "OWN TRIALS", acc: "ROI (RO)", mem: "PUBLIC" },
    { area: "Automations & Quiet-Hour Rules", owner: "ALL", mgr: "OWN-B", fd: "—", tr: "403 BLOCK", acc: "—", mem: "OPT-OUT" },
    { area: "Workouts, Indian Diet & Health Notes", owner: "ALL", mgr: "OWN-B", fd: "WAIVER", tr: "OWN-C", acc: "—", mem: "VIEW" },
    { area: "14 CSV/PDF Reports & AI Copilot", owner: "ALL", mgr: "OWN-B", fd: "OPS ONLY", tr: "NO FINANCE", acc: "FINANCE", mem: "SELF" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// ADMIN, RBAC, MIGRATION IMPORTER, KEYS & DPDP"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">SYSTEM ADMIN.</h1>
        </div>
        <span className="border-2 border-[#151515] bg-[#151515] text-[#EBC95B] px-3 py-1.5 text-[12px] font-bold uppercase">
          GSTIN: {org.gstin ?? "UNREGISTERED"} · SLUG: {org.slug}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// ACTIVE BRANCHES" value={branches.length} subtext={`Default GST ${(org.defaultGstBps / 100).toFixed(0)}%`} accent="blue" />
        <StatTile label="// API KEYS ACTIVE" value={apiKeys.filter((k) => !k.revokedAt).length} subtext={`${webhookSubs.length} outbound webhooks`} accent="ink" />
        <StatTile label="// IMPORT RUNS" value={importJobs.length} subtext="CSV / Gymdesk / Mindbody / Hevy" accent="yellow" />
        <StatTile label="// DPDP REQUESTS" value={dpdpJobs.length} subtext="Export & Right-to-Erasure logs" accent="red" />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["BRANCHES", "RBAC", "IMPORTER", "API", "DPDP"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "BRANCHES" ? "BRANCHES & KEYS" : t === "RBAC" ? "RBAC MATRIX" : t === "IMPORTER" ? "CSV / GYMDESK IMPORT" : t === "API" ? "API & WEBHOOKS" : "AUDIT & DPDP"}
            </button>
          ))}
        </div>
      </FilterBar>

      {tab === "BRANCHES" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label text-[#2B4BCC]">{"// REGISTERED BRANCHES & INVOICE SERIES"}</p>
            {branches.map((b) => (
              <div key={b.id} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3.5 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{b.name} ({b.code})</span>
                  <span className="font-mono text-[#C8372B]">{b.invoiceSeriesPrefix}-{b.nextInvoiceSeq}</span>
                </div>
                <p className="text-[12px] text-[var(--fg-grey)]">{b.address} · State: {b.stateCode}</p>
              </div>
            ))}
            <p className="bauhaus-label pt-2">{"// BRANCH HOLIDAYS"}</p>
            {holidays.map((h) => (
              <div key={h.id} className="text-[13px] flex justify-between border-b border-[var(--border-ink)]/25 py-1">
                <span>{h.title} ({h.branchName})</span>
                <span className="font-tabular font-bold">{h.date}</span>
              </div>
            ))}
          </div>

          <div className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label text-[#C8372B]">{"// PAYMENT & MESSAGING PROVIDER ADAPTERS"}</p>
            {[
              { name: "Razorpay (UPI / Mandates)", ok: gatewayStatus.razorpayConfigured },
              { name: "Stripe Adapter", ok: gatewayStatus.stripeConfigured },
              { name: "Meta WhatsApp Cloud API", ok: gatewayStatus.whatsappConfigured },
              { name: "SMS OTP Provider", ok: gatewayStatus.smsConfigured },
              { name: "S3 / MinIO Document Store", ok: gatewayStatus.s3Configured },
            ].map((gw) => (
              <div key={gw.name} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3 flex items-center justify-between text-[13px] font-bold">
                <span>{gw.name}</span>
                <span className={clsx("px-2 py-0.5 border border-[#151515] text-[12px]", gw.ok ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#EBC95B] text-[#151515]")}>
                  {gw.ok ? "LIVE KEYS SET" : "MOCK ADAPTER ACTIVE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "RBAC" && (
        <div className="bauhaus-card p-5 overflow-x-auto">
          <p className="bauhaus-label text-[#2B4BCC] mb-3">{"// SERVER-ENFORCED ROLE × RESOURCE ACCESS MATRIX"}</p>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-[#151515] text-[#FFFFFF] text-[12px] uppercase">
                <th className="p-2.5 text-left">Capability</th>
                <th className="p-2.5">OWNER</th>
                <th className="p-2.5">MANAGER</th>
                <th className="p-2.5">FRONTDESK</th>
                <th className="p-2.5">TRAINER</th>
                <th className="p-2.5">ACCOUNTANT</th>
                <th className="p-2.5">MEMBER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-ink)]">
              {rbacRows.map((row) => (
                <tr key={row.area}>
                  <td className="p-2.5 font-bold">{row.area}</td>
                  <td className="p-2.5 text-center">{row.owner}</td>
                  <td className="p-2.5 text-center">{row.mgr}</td>
                  <td className="p-2.5 text-center">{row.fd}</td>
                  <td className="p-2.5 text-center font-bold text-[#C8372B]">{row.tr}</td>
                  <td className="p-2.5 text-center">{row.acc}</td>
                  <td className="p-2.5 text-center">{row.mem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "IMPORTER" && (
        <div className="space-y-4">
          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC]">{"// GYMDESK / MINDBODY / HEVY / CSV MEMBER IMPORTER"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select aria-label="Import source platform" className="bauhaus-input" value={sourcePlatform} onChange={(e) => setSourcePlatform(e.target.value as "CSV" | "GYMDESK" | "MINDBODY" | "HEVY")}>
                <option value="GYMDESK">GYMDESK EXPORT</option>
                <option value="MINDBODY">MINDBODY CSV</option>
                <option value="HEVY">HEVY COACH EXPORT</option>
                <option value="CSV">STANDARD FORGE CSV</option>
              </select>
              <select aria-label="Import destination branch" className="bauhaus-input" value={importBranchId} onChange={(e) => setImportBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <textarea
              aria-label="Migration CSV data"
              rows={5}
              className="bauhaus-input h-auto py-2 font-mono text-[13px]"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="yellow"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await runMigrationImportAction({
                    branchId: importBranchId,
                    sourcePlatform,
                    mode: "DRY_RUN",
                    csvText,
                  });
                  if (res.ok) {
                    setDryRows(res.rows);
                    setToast({ msg: `Dry-Run validated: ${res.validCount} valid, ${res.errorCount} rejected rows.`, tone: "yellow" });
                  }
                  router.refresh();
                })}
              >
                <UploadCloud className="size-4" /> Validate Dry-Run
              </Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await runMigrationImportAction({
                    branchId: importBranchId,
                    sourcePlatform,
                    mode: "COMMITTED",
                    csvText,
                  });
                  if (res.ok) {
                    setDryRows(res.rows);
                    setToast({ msg: `Imported ${res.validCount} valid members from ${sourcePlatform}!`, tone: "blue" });
                  }
                  router.refresh();
                })}
              >
                Commit Valid Rows
              </Button>
            </div>

            {dryRows && (
              <div className="border-2 border-[var(--border-ink)] divide-y divide-[var(--border-ink)] text-[13px]">
                {dryRows.map((r) => (
                  <div key={r.rowNum} className="p-2.5 flex items-center justify-between gap-2">
                    <span>Row #{r.rowNum}: <strong>{r.fullName || "(empty)"}</strong> · {r.phone}</span>
                    <span className={clsx("px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase", r.valid ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#C8372B] text-[#FFFFFF]")}>
                      {r.valid ? "VALID" : r.error}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "API" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC]">{"// SCOPED REST API KEYS"}</p>
            <div className="flex gap-2">
              <input className="bauhaus-input flex-1" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await createApiKeyAction({ name: newKeyName, scopes: ["members:sync", "workouts:read"] });
                  if (res.ok) {
                    setRevealedKey(res.rawKey);
                    setToast({ msg: "API key minted. Copy secret now!", tone: "blue" });
                  }
                  router.refresh();
                })}
              >
                <Key className="size-4" /> Issue Key
              </Button>
            </div>
            {revealedKey && (
              <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-3 font-mono text-[13px] break-all">
                NEW SECRET (SHOWN ONCE): {revealedKey}
              </div>
            )}
            <div className="divide-y divide-[var(--border-ink)]">
              {apiKeys.map((k) => (
                <div key={k.id} className="py-2.5 flex items-center justify-between gap-2 text-[13px]">
                  <div>
                    <p className="font-bold">{k.name} ({k.keyPrefix}...)</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">{k.scopes.join(", ")}</p>
                  </div>
                  {k.revokedAt ? (
                    <span className="text-[12px] font-bold text-[#C8372B]">REVOKED</span>
                  ) : (
                    <Button variant="tertiary" onClick={() => startTransition(async () => { await revokeApiKeyAction(k.id); router.refresh(); })}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#C8372B]">{"// OUTBOUND WEBHOOK SUBSCRIPTIONS"}</p>
            <div className="flex gap-2">
              <input className="bauhaus-input flex-1" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} />
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  await createWebhookSubscriptionAction({ targetUrl: whUrl, event: "member.renewed" });
                  setToast({ msg: "Webhook endpoint registered.", tone: "blue" });
                  router.refresh();
                })}
              >
                Add Endpoint
              </Button>
            </div>
            <div className="divide-y divide-[var(--border-ink)] text-[13px]">
              {webhookSubs.map((w) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold break-all">{w.targetUrl}</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">{w.events.join(", ")} · {w.secretPreview}</p>
                  </div>
                  <span className="bg-[#2B4BCC] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold">ACTIVE</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "DPDP" && (
        <div className="space-y-6">
          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#C8372B]">{"// INDIA DPDP ACT 2023 & GDPR EXPORT / RIGHT TO ERASURE"}</p>
            <div className="flex flex-wrap items-center gap-3">
              <select aria-label="Member for DPDP action" className="bauhaus-input w-auto" value={dpdpMemberId} onChange={(e) => setDpdpMemberId(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>)}
              </select>
              <Button
                variant="blue"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await executeDpdpComplianceAction({ memberId: dpdpMemberId, kind: "DPDP_EXPORT" });
                  if (res.ok) {
                    setDpdpExportPreview(res.exportPreview ?? null);
                    setToast({ msg: "DPDP JSON export package generated & audited.", tone: "blue" });
                  }
                  router.refresh();
                })}
              >
                <Download className="size-4" /> Export Member Data (JSON)
              </Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await executeDpdpComplianceAction({ memberId: dpdpMemberId, kind: "DPDP_ERASURE" });
                  if (res.ok) {
                    setToast({ msg: "PII anonymized under DPDP Right-to-Erasure (GST ledger retained).", tone: "red" });
                  }
                  router.refresh();
                })}
              >
                <Trash2 className="size-4" /> Anonymize Member PII
              </Button>
            </div>
            {dpdpExportPreview && (
              <pre className="border-2 border-[#151515] bg-[#151515] text-[#EBC95B] p-3 text-[12px] font-mono overflow-x-auto">
                {dpdpExportPreview}
              </pre>
            )}
            {dpdpJobs.length > 0 && (
              <div className="text-[12px] space-y-1">
                {dpdpJobs.map((j) => (
                  <div key={j.id} className="font-bold">
                    <ShieldAlert className="size-3.5 inline mr-1 text-[#C8372B]" />
                    {j.kind} — {j.memberName} ({j.memberCode}) → {j.status}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DataTable title="IMMUTABLE COMPLIANCE AUDIT TRAIL" rows={auditLogs} columns={auditCols} rowKey={(r) => r.id} />
        </div>
      )}

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
