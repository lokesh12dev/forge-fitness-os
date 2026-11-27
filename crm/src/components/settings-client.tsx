"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Download, Key, Plus, Send, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
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
import {
  createCustomFieldDefAction,
  deleteBranchHolidayAction,
  inviteOrUpdateStaffMemberAction,
  testOutboundWebhookDeliveryAction,
  toggleCustomFieldDefAction,
  updateOrgProfileSettingsAction,
  upsertBranchHolidayAction,
  upsertBranchWithGeoAction,
} from "@/app/actions/world-class-actions";
import type { CrmRole } from "@/lib/rbac";

const SAMPLE_MIGRATION_CSV = `fullName,phone,email,status
Aditi Deshpande,+91 98451 60111,aditi.mig@mail.in,ACTIVE
Prashant Iyer,+91 98451 60112,prashant.mig@mail.in,ACTIVE
Bad Row,12,broken,ACTIVE`;

export function SettingsClient({
  org,
  branches,
  holidays,
  staffRoster,
  customFields,
  apiKeys,
  webhookSubs,
  webhookDeliveries,
  importJobs,
  dpdpJobs,
  auditLogs,
  members,
  gatewayStatus,
}: {
  org: {
    name: string;
    slug: string;
    gstin: string | null;
    legalStateCode: string;
    upiVpa: string;
    currency: string;
    invoicePrefix: string;
    defaultGstBps: number;
  };
  branches: Array<{
    id: string;
    name: string;
    code: string;
    stateCode: string;
    address: string;
    invoiceSeriesPrefix: string;
    nextInvoiceSeq: number;
    latitude: number | null;
    longitude: number | null;
    geofenceRadiusM: number;
  }>;
  holidays: Array<{ id: string; branchName: string; title: string; date: string }>;
  staffRoster: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    branchId: string;
    branchNames: string;
  }>;
  customFields: Array<{
    id: string;
    entityType: string;
    fieldKey: string;
    label: string;
    fieldType: string;
    options: string[];
    required: boolean;
    isActive: boolean;
  }>;
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; revokedAt: string | null }>;
  webhookSubs: Array<{ id: string; targetUrl: string; events: string[]; secretPreview: string; isActive: boolean }>;
  webhookDeliveries: Array<{
    id: string;
    event: string;
    statusCode: number | null;
    status: string;
    errorText: string | null;
    deliveredAt: string;
  }>;
  importJobs: Array<{ id: string; sourcePlatform: string; mode: string; totalRows: number; validRows: number; errorRows: number; createdAt: string }>;
  dpdpJobs: Array<{ id: string; memberName: string; memberCode: string; kind: string; status: string; createdAt: string }>;
  auditLogs: Array<{ id: string; timestamp: string; actorName: string; actorRole: string; action: string; resourceType: string; resourceId: string }>;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  gatewayStatus: { razorpayConfigured: boolean; stripeConfigured: boolean; whatsappConfigured: boolean; smsConfigured: boolean; s3Configured: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"BRANCHES" | "RBAC" | "FIELDS" | "IMPORTER" | "API" | "DPDP">("BRANCHES");

  // Org Settings state
  const [orgName, setOrgName] = useState(org.name);
  const [orgGstin, setOrgGstin] = useState(org.gstin ?? "");
  const [orgState, setOrgState] = useState(org.legalStateCode);
  const [orgUpi, setOrgUpi] = useState(org.upiVpa);
  const [orgPrefix, setOrgPrefix] = useState(org.invoicePrefix);
  const [orgGstBps, setOrgGstBps] = useState(org.defaultGstBps);

  // Branch Upsert Geo state + switcher
  const [selectedBranchEdit, setSelectedBranchEdit] = useState(branches[0]?.code ?? "__NEW__");
  const [brName, setBrName] = useState(branches[0]?.name ?? "Indiranagar HQ");
  const [brCode, setBrCode] = useState(branches[0]?.code ?? "BLR-IND");
  const [brAddr, setBrAddr] = useState(branches[0]?.address ?? "");
  const [brState, setBrState] = useState(branches[0]?.stateCode ?? "KA");
  const [brLat, setBrLat] = useState(branches[0]?.latitude ?? 12.9716);
  const [brLng, setBrLng] = useState(branches[0]?.longitude ?? 77.6412);
  const [brRadius, setBrRadius] = useState(branches[0]?.geofenceRadiusM ?? 150);

  // Branch Holiday CRUD state
  const [holBranchId, setHolBranchId] = useState(branches[0]?.id ?? "");
  const [holTitle, setHolTitle] = useState("Independence Day");
  const [holDate, setHolDate] = useState("2027-08-15");

  // Staff Invite / Edit state
  const [stName, setStName] = useState("");
  const [stEmail, setStEmail] = useState("");
  const [stPhone, setStPhone] = useState("+91 98450 22000");
  const [stRole, setStRole] = useState<CrmRole>("FRONTDESK");
  const [stBranchId, setStBranchId] = useState(branches[0]?.id ?? "");

  // Custom Field Builder state
  const [cfEntity, setCfEntity] = useState<"MEMBER" | "LEAD">("MEMBER");
  const [cfLabel, setCfLabel] = useState("Corporate Sponsor Tier");
  const [cfType, setCfType] = useState<"TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE">("SELECT");
  const [cfOptions, setCfOptions] = useState("Gold,Silver,Startup-Pass");
  const [cfReq, setCfReq] = useState(false);

  // Importer & API/DPDP state
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

  const handleSelectBranchForEdit = (code: string) => {
    setSelectedBranchEdit(code);
    if (code === "__NEW__") {
      setBrName("");
      setBrCode("");
      setBrAddr("");
      setBrState(orgState || "KA");
      setBrLat(12.9716);
      setBrLng(77.6412);
      setBrRadius(150);
      return;
    }
    const found = branches.find((b) => b.code === code);
    if (found) {
      setBrName(found.name);
      setBrCode(found.code);
      setBrAddr(found.address);
      setBrState(found.stateCode);
      setBrLat(found.latitude ?? 12.9716);
      setBrLng(found.longitude ?? 77.6412);
      setBrRadius(found.geofenceRadiusM);
    }
  };

  const auditCols: DataColumn<(typeof auditLogs)[number]>[] = [
    { key: "ts", header: "IST Timestamp", render: (r) => <span className="text-[12px] font-tabular">{r.timestamp}</span> },
    { key: "actor", header: "Actor", render: (r) => <span className="font-bold">{r.actorName} ({r.actorRole})</span> },
    { key: "act", header: "Action", render: (r) => <span className="border border-[var(--border-ink)] px-2 py-0.5 text-[12px] font-bold">{r.action}</span> },
    { key: "res", header: "Resource", render: (r) => <span className="text-[12px] font-mono">{r.resourceType} · {r.resourceId}</span> },
  ];

  const staffCols: DataColumn<(typeof staffRoster)[number]>[] = [
    { key: "nm", header: "Name", render: (r) => <div><p className="font-bold">{r.name}</p><p className="text-[12px] text-[var(--fg-grey)]">{r.email}</p></div> },
    { key: "rl", header: "Role", render: (r) => <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold">{r.role}</span> },
    { key: "br", header: "Branch Scope", render: (r) => <span className="text-[13px]">{r.branchNames}</span> },
    { key: "ph", header: "Phone", render: (r) => <span className="text-[12px] font-tabular">{r.phone ?? "—"}</span> },
    {
      key: "ed",
      header: "Action",
      render: (r) => (
        <Button
          variant="tertiary"
          density="dense"
          onClick={() => {
            setStName(r.name);
            setStEmail(r.email);
            setStPhone(r.phone ?? "");
            setStRole(r.role as CrmRole);
            if (r.branchId) setStBranchId(r.branchId);
            setToast({ msg: `Loaded ${r.name} into role form above.`, tone: "ink" });
          }}
        >
          Edit Role
        </Button>
      ),
    },
  ];

  const rbacRows = [
    { area: "Org Setup, GSTIN, API Keys & DPDP", owner: "ALL", mgr: "—", fd: "—", tr: "—", acc: "—", mem: "—" },
    { area: "GST Billing, Refunds & Cash Close", owner: "ALL", mgr: "OWN-B", fd: "COLLECT", tr: "403 BLOCK", acc: "READ ONLY", mem: "OWN INV" },
    { area: "Leads Pipeline & Source ROI", owner: "ALL", mgr: "OWN-B", fd: "NO ROI", tr: "OWN TRIALS", acc: "ROI (RO)", mem: "PUBLIC" },
    { area: "Automations & Quiet-Hour Rules", owner: "ALL", mgr: "OWN-B", fd: "—", tr: "403 BLOCK", acc: "—", mem: "OPT-OUT" },
    { area: "Workouts, Indian Diet & Health Notes", owner: "ALL", mgr: "OWN-B", fd: "WAIVER", tr: "OWN-C", acc: "—", mem: "VIEW" },
    { area: "15 CSV/JSON/PDF Reports & AI Copilot", owner: "ALL", mgr: "OWN-B", fd: "OPS ONLY", tr: "NO FINANCE", acc: "FINANCE", mem: "SELF" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// ADMIN, ORG TAX, CUSTOM FIELDS, RBAC, WEBHOOKS & DPDP"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">SYSTEM ADMIN.</h1>
        </div>
        <span className="border-2 border-[#151515] bg-[#151515] text-[#EBC95B] px-3 py-1.5 text-[12px] font-bold uppercase">
          GSTIN: {org.gstin ?? "UNREGISTERED"} · VPA: {org.upiVpa}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// ACTIVE BRANCHES" value={branches.length} subtext={`Default GST ${(org.defaultGstBps / 100).toFixed(0)}%`} accent="blue" />
        <StatTile label="// CUSTOM SCHEMA" value={customFields.filter((c) => c.isActive).length} subtext="Member & Lead dynamic fields" accent="ink" />
        <StatTile label="// API KEYS & WEBHOOKS" value={apiKeys.filter((k) => !k.revokedAt).length} subtext={`${webhookSubs.length} HMAC endpoints`} accent="yellow" />
        <StatTile label="// DPDP REQUESTS" value={dpdpJobs.length} subtext="Export & Right-to-Erasure logs" accent="red" />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["BRANCHES", "RBAC", "FIELDS", "IMPORTER", "API", "DPDP"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "BRANCHES"
                ? "ORG & BRANCH GEO"
                : t === "RBAC"
                  ? "STAFF & RBAC"
                  : t === "FIELDS"
                    ? "CUSTOM FIELDS"
                    : t === "IMPORTER"
                      ? "CSV IMPORT"
                      : t === "API"
                        ? "API & WEBHOOKS"
                        : "AUDIT & DPDP"}
            </button>
          ))}
        </div>
      </FilterBar>

      {tab === "BRANCHES" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Org Tax & UPI Settings Editor */}
            <div className="bauhaus-card p-5 space-y-3">
              <p className="bauhaus-label text-[#2B4BCC]">{"// ORGANIZATION PROFILE, GSTIN & UPI COLLECTOR"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="org-nm" className="bauhaus-label block mb-1">{"// ORG NAME"}</label>
                  <input id="org-nm" className="bauhaus-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="org-upi" className="bauhaus-label block mb-1">{"// COLLECTOR UPI VPA"}</label>
                  <input id="org-upi" className="bauhaus-input font-mono" value={orgUpi} onChange={(e) => setOrgUpi(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="col-span-2">
                  <label htmlFor="org-gst" className="bauhaus-label block mb-1">{"// GSTIN"}</label>
                  <input id="org-gst" className="bauhaus-input font-mono" value={orgGstin} onChange={(e) => setOrgGstin(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="org-st" className="bauhaus-label block mb-1">{"// STATE"}</label>
                  <input id="org-st" className="bauhaus-input font-mono" value={orgState} onChange={(e) => setOrgState(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="org-pf" className="bauhaus-label block mb-1">{"// INV PREFIX"}</label>
                  <input id="org-pf" className="bauhaus-input font-mono" value={orgPrefix} onChange={(e) => setOrgPrefix(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="org-bps" className="bauhaus-label block mb-1">{"// GST BPS"}</label>
                  <input id="org-bps" type="number" className="bauhaus-input" value={orgGstBps} onChange={(e) => setOrgGstBps(Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    await updateOrgProfileSettingsAction({
                      name: orgName,
                      gstin: orgGstin,
                      legalStateCode: orgState,
                      upiVpa: orgUpi,
                      invoicePrefix: orgPrefix,
                      defaultGstBps: orgGstBps,
                    });
                    setToast({ msg: `Organization tax & UPI (${orgUpi}) settings saved!`, tone: "blue" });
                    router.refresh();
                  })}
                >
                  Save Org Profile &amp; UPI VPA
                </Button>
                <a
                  href={`/enquire/${org.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] font-bold uppercase underline underline-offset-4 text-[#2B4BCC] hover:text-[#C8372B]"
                >
                  Open Walk-In Enquiry Page →
                </a>
              </div>
            </div>

            {/* Branch Upsert + GPS Geofence Editor */}
            <div className="bauhaus-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="bauhaus-label text-[#C8372B]">{"// ADD / UPDATE BRANCH & GPS GEOFENCE"}</p>
                <select
                  aria-label="Select branch to edit"
                  className="bauhaus-input w-auto text-[12px]"
                  value={selectedBranchEdit}
                  onChange={(e) => handleSelectBranchForEdit(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.code}>Edit: {b.name} ({b.code})</option>
                  ))}
                  <option value="__NEW__">+ Create New Branch</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="br-nm" className="bauhaus-label block mb-1">{"// BRANCH NAME"}</label>
                  <input id="br-nm" className="bauhaus-input" value={brName} onChange={(e) => setBrName(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="br-cd" className="bauhaus-label block mb-1">{"// CODE (UPSERT KEY)"}</label>
                  <input id="br-cd" className="bauhaus-input font-mono" value={brCode} onChange={(e) => setBrCode(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="br-ad" className="bauhaus-label block mb-1">{"// STREET ADDRESS"}</label>
                <input id="br-ad" className="bauhaus-input" value={brAddr} onChange={(e) => setBrAddr(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label htmlFor="br-st" className="bauhaus-label block mb-1">{"// STATE"}</label>
                  <input id="br-st" className="bauhaus-input font-mono" value={brState} onChange={(e) => setBrState(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="br-lt" className="bauhaus-label block mb-1">{"// LATITUDE"}</label>
                  <input id="br-lt" type="number" step="0.0001" className="bauhaus-input" value={brLat} onChange={(e) => setBrLat(Number(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="br-ln" className="bauhaus-label block mb-1">{"// LONGITUDE"}</label>
                  <input id="br-ln" type="number" step="0.0001" className="bauhaus-input" value={brLng} onChange={(e) => setBrLng(Number(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="br-rd" className="bauhaus-label block mb-1">{"// RADIUS (M)"}</label>
                  <input id="br-rd" type="number" className="bauhaus-input" value={brRadius} onChange={(e) => setBrRadius(Number(e.target.value) || 75)} />
                </div>
              </div>
              <Button
                variant="secondary"
                disabled={pending || !brName.trim() || !brCode.trim()}
                onClick={() => startTransition(async () => {
                  await upsertBranchWithGeoAction({
                    name: brName,
                    code: brCode,
                    address: brAddr,
                    stateCode: brState,
                    latitude: brLat,
                    longitude: brLng,
                    geofenceRadiusM: brRadius,
                  });
                  setToast({ msg: `Branch ${brCode} GPS & geofence saved!`, tone: "blue" });
                  router.refresh();
                })}
              >
                Save Branch &amp; Geofence
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bauhaus-card p-5 space-y-3">
              <p className="bauhaus-label text-[#2B4BCC]">{"// REGISTERED BRANCHES & INVOICE SERIES"}</p>
              {branches.map((b) => (
                <div key={b.id} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3.5 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>{b.name} ({b.code})</span>
                    <span className="font-mono text-[#C8372B]">{b.invoiceSeriesPrefix}-{b.nextInvoiceSeq}</span>
                  </div>
                  <p className="text-[12px] text-[var(--fg-grey)]">
                    {b.address} · State: {b.stateCode} · Geo: {b.latitude ?? "—"}, {b.longitude ?? "—"} ({b.geofenceRadiusM}m)
                  </p>
                </div>
              ))}
              <p className="bauhaus-label pt-2">{"// BRANCH HOLIDAYS (CRUD)"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select aria-label="Holiday branch" className="bauhaus-input text-[12px]" value={holBranchId} onChange={(e) => setHolBranchId(e.target.value)}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                </select>
                <input aria-label="Holiday title" className="bauhaus-input text-[12px]" placeholder="Holiday Name" value={holTitle} onChange={(e) => setHolTitle(e.target.value)} />
                <input aria-label="Holiday date" type="date" className="bauhaus-input text-[12px]" value={holDate} onChange={(e) => setHolDate(e.target.value)} />
                <Button
                  variant="primary"
                  density="dense"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const res = await upsertBranchHolidayAction({ branchId: holBranchId, title: holTitle, date: holDate });
                    if (!res.ok) {
                      setToast({ msg: res.error, tone: "red" });
                      return;
                    }
                    setToast({ msg: `Added holiday: ${holTitle} (${holDate}).`, tone: "blue" });
                    router.refresh();
                  })}
                >
                  + Holiday
                </Button>
              </div>
              {holidays.map((h) => (
                <div key={h.id} className="text-[13px] flex items-center justify-between border-b border-[var(--border-ink)]/25 py-1.5 gap-2">
                  <span>{h.title} ({h.branchName})</span>
                  <div className="flex items-center gap-2">
                    <span className="font-tabular font-bold">{h.date}</span>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Delete holiday ${h.title}`}
                      onClick={() => startTransition(async () => {
                        await deleteBranchHolidayAction(h.id);
                        setToast({ msg: `Removed holiday ${h.title}.`, tone: "ink" });
                        router.refresh();
                      })}
                      className="border border-[var(--border-ink)] bg-[var(--bg-surface)] text-[#C8372B] p-1 hover:bg-[#C8372B] hover:text-[#FFFFFF]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
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
        </div>
      )}

      {tab === "RBAC" && (
        <div className="space-y-6">
          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#C8372B]">{"// INVITE / REASSIGN STAFF ROLE & BRANCH"}</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input aria-label="Staff Full Name" className="bauhaus-input" placeholder="Full Name" value={stName} onChange={(e) => setStName(e.target.value)} />
              <input aria-label="Staff Email" className="bauhaus-input" placeholder="staff@ironworks.in" value={stEmail} onChange={(e) => setStEmail(e.target.value)} />
              <input aria-label="Staff Phone" className="bauhaus-input" placeholder="+91 ..." value={stPhone} onChange={(e) => setStPhone(e.target.value)} />
              <select aria-label="Staff Role" className="bauhaus-input" value={stRole} onChange={(e) => setStRole(e.target.value as CrmRole)}>
                <option value="OWNER">OWNER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="FRONTDESK">FRONTDESK</option>
                <option value="TRAINER">TRAINER</option>
                <option value="ACCOUNTANT">ACCOUNTANT</option>
              </select>
              <select aria-label="Staff Branch" className="bauhaus-input" value={stBranchId} onChange={(e) => setStBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Button
              variant="primary"
              disabled={pending || !stName.trim() || !stEmail.trim()}
              onClick={() => startTransition(async () => {
                await inviteOrUpdateStaffMemberAction({
                  name: stName,
                  email: stEmail,
                  phone: stPhone,
                  role: stRole,
                  branchId: stBranchId,
                });
                setStName("");
                setStEmail("");
                setToast({ msg: `Staff user saved as ${stRole}!`, tone: "blue" });
                router.refresh();
              })}
            >
              <Plus className="size-4" /> Invite / Update Staff Role
            </Button>
          </div>

          <DataTable title="ACTIVE ORG STAFF & ROLES" rows={staffRoster} columns={staffCols} rowKey={(r) => r.id} />

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
        </div>
      )}

      {tab === "FIELDS" && (
        <div className="space-y-6">
          <div className="bauhaus-card p-5 space-y-4">
            <p className="bauhaus-label text-[#2B4BCC]">{"// TWENTY-STYLE CUSTOM FIELD SCHEMA BUILDER (MEMBERS & LEADS)"}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select aria-label="Target Entity" className="bauhaus-input" value={cfEntity} onChange={(e) => setCfEntity(e.target.value as "MEMBER" | "LEAD")}>
                <option value="MEMBER">MEMBER PROFILE</option>
                <option value="LEAD">LEAD PIPELINE</option>
              </select>
              <input aria-label="Custom Field Label" className="bauhaus-input" value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} placeholder="Field Label" />
              <select aria-label="Field Type" className="bauhaus-input" value={cfType} onChange={(e) => setCfType(e.target.value as "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "DATE")}>
                <option value="TEXT">TEXT</option>
                <option value="NUMBER">NUMBER</option>
                <option value="SELECT">SELECT DROPDOWN</option>
                <option value="BOOLEAN">CHECKBOX</option>
                <option value="DATE">DATE</option>
              </select>
              <input
                aria-label="Select Options CSV"
                className="bauhaus-input"
                value={cfOptions}
                onChange={(e) => setCfOptions(e.target.value)}
                disabled={cfType !== "SELECT"}
                placeholder="Option 1, Option 2..."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] font-bold">
                <input type="checkbox" checked={cfReq} onChange={(e) => setCfReq(e.target.checked)} />
                Required on intake form
              </label>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const res = await createCustomFieldDefAction({
                    entityType: cfEntity,
                    label: cfLabel,
                    fieldType: cfType,
                    optionsCsv: cfOptions,
                    required: cfReq,
                  });
                  if (!res.ok) {
                    setToast({ msg: res.error, tone: "red" });
                    return;
                  }
                  setToast({ msg: `Custom field "${cfLabel}" saved on ${cfEntity}!`, tone: "blue" });
                  router.refresh();
                })}
              >
                <Plus className="size-4" /> Save Custom Field
              </Button>
            </div>
          </div>

          <div className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label">{"// DEFINED CUSTOM FIELDS ("}{customFields.length}{")"}</p>
            {customFields.length === 0 ? (
              <p className="text-[13px] text-[var(--fg-grey)]">No custom fields defined yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border-ink)] text-[13px]">
                {customFields.map((cf) => (
                  <div key={cf.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-1.5 py-0.5 text-[12px] font-bold mr-2">{cf.entityType}</span>
                      <span className="font-bold">{cf.label}</span>
                      <span className="ml-2 font-mono text-[12px] text-[var(--fg-grey)]">{cf.fieldKey} · {cf.fieldType}{cf.options.length > 0 ? ` (${cf.options.join("/")})` : ""}</span>
                    </div>
                    <Button
                      variant={cf.isActive ? "secondary" : "tertiary"}
                      density="dense"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        await toggleCustomFieldDefAction(cf.id);
                        router.refresh();
                      })}
                    >
                      {cf.isActive ? "ACTIVE (DISABLE)" : "DISABLED (ENABLE)"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "IMPORTER" && (
        <div className="space-y-4">
          <div className="bauhaus-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="bauhaus-label text-[#2B4BCC]">{"// GYMDESK / MINDBODY / HEVY / CSV MEMBER IMPORTER"}</p>
              <span className="text-[12px] font-bold text-[var(--fg-grey)]">PREVIOUS IMPORTS: {importJobs.length}</span>
            </div>
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
        <div className="space-y-6">
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
              <p className="bauhaus-label text-[#C8372B]">{"// OUTBOUND HMAC WEBHOOK SUBSCRIPTIONS"}</p>
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
                  <div key={w.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold break-all">{w.targetUrl}</p>
                      <p className="text-[12px] text-[var(--fg-grey)]">{w.events.join(", ")} · {w.secretPreview}</p>
                    </div>
                    <Button
                      variant="yellow"
                      density="dense"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        const res = await testOutboundWebhookDeliveryAction(w.id);
                        if (res.ok) {
                          setToast({
                            msg: `Signed test webhook -> ${res.status} (HTTP ${res.statusCode}, sig ${res.signature}...)`,
                            tone: res.status === "DELIVERED" ? "blue" : "red",
                          });
                        }
                        router.refresh();
                      })}
                    >
                      <Send className="size-3.5" /> Test Signed Ping
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bauhaus-card p-5 space-y-2">
            <p className="bauhaus-label text-[#2B4BCC]">{"// OUTBOUND SIGNED WEBHOOK DELIVERY LOG"}</p>
            {webhookDeliveries.length === 0 ? (
              <p className="text-[13px] text-[var(--fg-grey)]">No webhook deliveries fired yet — click &ldquo;Test Signed Ping&rdquo; above.</p>
            ) : (
              <div className="divide-y divide-[var(--border-ink)] text-[13px]">
                {webhookDeliveries.map((d) => (
                  <div key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold mr-2">{d.event}</span>
                      <span className="text-[12px] text-[var(--fg-grey)] font-tabular">{d.deliveredAt}</span>
                      {d.errorText && <span className="ml-2 text-[12px] text-[#C8372B]">{d.errorText}</span>}
                    </div>
                    <span className={clsx("border border-[#151515] px-2 py-0.5 text-[12px] font-bold", d.status === "DELIVERED" ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#C8372B] text-[#FFFFFF]")}>
                      {d.status} ({d.statusCode ?? 0})
                    </span>
                  </div>
                ))}
              </div>
            )}
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
