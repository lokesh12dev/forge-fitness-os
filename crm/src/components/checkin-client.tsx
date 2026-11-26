"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrCode, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SegmentedProgress,
  StatTile,
  StatusPill,
  Toast,
} from "@/components/ui/primitives";
import { performCheckInAction } from "@/app/actions/crm-actions";

export function CheckInDeskClient(props: {
  branchId: string;
  branches: Array<{ id: string; name: string; code: string }>;
  todayCount: number;
  turnstileConfigured: boolean;
  quickTokens: Array<{ label: string; fullName: string; qrToken: string; memberCode: string }>;
  recentLogs: Array<{
    id: string;
    memberId: string;
    fullName: string;
    memberCode: string;
    branchCode: string;
    visitedAt: string;
    method: string;
    result: string;
    overrideReason: string | null;
  }>;
  absentees: Array<{
    id: string;
    memberCode: string;
    fullName: string;
    phone: string;
    branchCode: string;
    status: string;
    bucket: string;
    daysAway: number;
  }>;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(props.branchId);
  const [tokenOrQuery, setTokenOrQuery] = useState(props.quickTokens[0]?.qrToken ?? "");
  const [method, setMethod] = useState<"QR" | "MANUAL" | "PHONE">("QR");
  const [overrideReason, setOverrideReason] = useState("");
  const [absenteeFilter, setAbsenteeFilter] = useState<"ALL" | "7d+" | "14d+" | "30d+">("ALL");
  const [scanResult, setScanResult] = useState<{
    allowed: boolean;
    result: string;
    reason: string;
    memberName?: string;
    memberId?: string;
    turnstileDevice?: string;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitScan = (overrideStr?: string) => {
    if (!tokenOrQuery.trim()) return;
    startTransition(async () => {
      const res = await performCheckInAction({
        queryOrToken: tokenOrQuery,
        branchId,
        method,
        overrideReason: overrideStr,
      });
      if (!res.ok) {
        setScanResult({
          allowed: false,
          result: "NOT_FOUND",
          reason: res.error,
        });
        return;
      }
      setScanResult({
        allowed: res.allowed,
        result: res.result,
        reason: res.reason,
        memberName: res.member.fullName,
        memberId: res.member.id,
        turnstileDevice: "turnstileDevice" in res ? res.turnstileDevice : undefined,
      });
      setToastMsg(res.allowed ? `Gate opened for ${res.member.fullName}` : `Gate held: ${res.member.fullName}`);
      if (res.allowed) setOverrideReason("");
      router.refresh();
    });
  };

  const filteredAbsentees =
    absenteeFilter === "ALL"
      ? props.absentees
      : props.absentees.filter((a) => a.bucket === absenteeFilter);

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-2">{`// QR ACCESS TERMINAL, FLOOR LIVE COUNT & ABSENTEES`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">ATTENDANCE &amp; GATE</h1>
        </div>

        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[13px] font-bold uppercase"
          aria-label="Check-in Desk Branch"
        >
          {props.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
          ))}
        </select>
      </div>

      {/* KPI & Live Floor Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <StatTile
            label="// TODAY'S FLOOR CHECK-INS"
            value={props.todayCount}
            subtext={`Turnstile Adapter: ${props.turnstileConfigured ? "LIVE HARDWARE" : "MOCK RELAY"}`}
            accent="blue"
          />
        </div>
        <div className="lg:col-span-8 bauhaus-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="bauhaus-label">{`// LIVE FLOOR OCCUPANCY ESTIMATE`}</span>
            <span className="font-tabular font-bold text-[15px]">{Math.min(120, Math.round(props.todayCount * 0.45))} / 120 ON FLOOR</span>
          </div>
          <SegmentedProgress
            value={Math.min(120, Math.round(props.todayCount * 0.45))}
            max={120}
            segments={12}
            color={props.todayCount > 180 ? "red" : "blue"}
          />
          <p className="text-[12px] text-[var(--fg-grey)]">
            Biometric/turnstile hardware uses an adapter hook; expired or frozen passes automatically hold the gate unless a staff override reason is logged.
          </p>
        </div>
      </div>

      {/* Scanner Panel & Check-in Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bauhaus-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="bauhaus-label text-[#C8372B] flex items-center gap-1.5">
              <QrCode className="size-4" /> Front-Desk Scanner
            </span>
            <div className="flex border-2 border-[var(--border-ink)]">
              {(["QR", "PHONE", "MANUAL"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`min-h-[36px] px-2.5 text-[12px] font-bold uppercase ${
                    method === m ? "bg-[#151515] text-[#FFFFFF]" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitScan();
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={tokenOrQuery}
              onChange={(e) => setTokenOrQuery(e.target.value)}
              placeholder="Scan QR token, FM-1001, phone or name..."
              className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[15px] font-bold"
            />
            <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
              {isPending ? "Checking Gate..." : "Scan & Validate Pass →"}
            </Button>
          </form>

          {/* Quick Demo Preset Tokens */}
          <div>
            <p className="bauhaus-label text-[var(--fg-grey)] mb-1.5">{`// TEST PASS TOKENS`}</p>
            <div className="flex flex-wrap gap-1.5">
              {props.quickTokens.map((t) => (
                <button
                  key={t.memberCode}
                  type="button"
                  onClick={() => setTokenOrQuery(t.qrToken)}
                  className="border border-[var(--border-ink)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-[12px] font-bold hover:bg-[#EBC95B] hover:text-[#151515]"
                >
                  {t.label}: {t.memberCode}
                </button>
              ))}
            </div>
          </div>

          {/* Access Decision Box */}
          {scanResult && (
            <div
              className={`border-2 border-[#151515] p-4 space-y-3 ${
                scanResult.allowed ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#C8372B] text-[#FFFFFF]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-headline text-[20px]">
                  {scanResult.allowed ? "GATE OPENED" : "GATE BLOCKED"}
                </span>
                <span className="border border-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                  {scanResult.result}
                </span>
              </div>
              {scanResult.memberName && (
                <p className="font-bold text-[15px]">
                  Member:{" "}
                  {scanResult.memberId ? (
                    <Link href={`/app/members/${scanResult.memberId}`} className="underline">
                      {scanResult.memberName}
                    </Link>
                  ) : (
                    scanResult.memberName
                  )}
                </p>
              )}
              <p className="text-[14px]">{scanResult.reason}</p>
              {scanResult.turnstileDevice && (
                <p className="text-[12px] uppercase font-bold">Relay triggered: {scanResult.turnstileDevice}</p>
              )}

              {!scanResult.allowed && (scanResult.result === "BLOCKED_EXPIRED" || scanResult.result === "BLOCKED_FROZEN") && (
                <div className="border-t-2 border-[#FFFFFF]/30 pt-3 space-y-2 bg-[#151515] p-3">
                  <label className="bauhaus-label text-[#EBC95B] flex items-center gap-1">
                    <ShieldAlert className="size-4" /> Audited Staff Override Reason
                  </label>
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Owner approved 1-day renewal grace"
                    className="w-full min-h-[44px] border-2 border-[#FFFFFF] bg-[#222222] text-[#FFFFFF] px-3 text-[13px]"
                  />
                  <Button
                    type="button"
                    variant="yellow"
                    fullWidth
                    disabled={overrideReason.trim().length < 4 || isPending}
                    onClick={() => submitScan(overrideReason)}
                  >
                    Log Audit Reason &amp; Open Gate
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Check-in Stream */}
        <div className="lg:col-span-7 bauhaus-card">
          <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4">
            <p className="bauhaus-label">{`// LIVE CHECK-IN & OVERRIDE LEDGER`}</p>
          </div>
          <div className="divide-y-2 divide-[var(--border-ink)] max-h-[540px] overflow-y-auto">
            {props.recentLogs.map((row) => (
              <div key={row.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <div>
                  <Link href={`/app/members/${row.memberId}`} className="font-bold hover:underline">
                    {row.fullName}
                  </Link>
                  <p className="text-[12px] text-[var(--fg-grey)]">
                    {row.memberCode} · {row.branchCode} · {row.method} · {row.visitedAt}
                  </p>
                  {row.overrideReason && (
                    <p className="text-[12px] font-bold text-[#C8372B]">Override: {row.overrideReason}</p>
                  )}
                </div>
                <StatusPill status={row.result} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Absentee Cohort (7d / 14d / 30d+) */}
      <div className="bauhaus-card">
        <div className="border-b-2 border-[var(--border-ink)] bg-[#EBC95B] text-[#151515] p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="bauhaus-label">{`// RETENTION WATCH`}</p>
            <h2 className="font-headline text-[22px] mt-1">Absentee Members (No Visit 7+ Days)</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "7d+", "14d+", "30d+"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setAbsenteeFilter(b)}
                className={`min-h-[36px] border-2 border-[#151515] px-3 text-[12px] font-bold uppercase ${
                  absenteeFilter === b ? "bg-[#151515] text-[#FFFFFF]" : "bg-[#FFFFFF]"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y-2 divide-[var(--border-ink)]">
          {filteredAbsentees.map((a) => (
            <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-2 text-[14px]">
              <div>
                <Link href={`/app/members/${a.id}`} className="font-bold underline">
                  {a.fullName}
                </Link>
                <p className="text-[12px] text-[var(--fg-grey)]">
                  {a.memberCode} · {a.phone} · {a.branchCode} · <strong>{a.daysAway}d silent</strong>
                </p>
              </div>
              <StatusPill status={a.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
