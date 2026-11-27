"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, LogOut, MapPin, Monitor, QrCode, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
import { evaluateGeofenceCheckIn, type GeofenceVerdict } from "@/lib/geofence";
import { Button } from "@/components/ui/button";
import {
  Modal,
  SegmentedProgress,
  StatTile,
  StatusPill,
  Toast,
} from "@/components/ui/primitives";
import { checkOutMemberAction, performCheckInAction } from "@/app/actions/crm-actions";
import {
  queueRemoteDoorUnlockAction,
  registerAccessDeviceAction,
  testGeofenceCheckInAction,
} from "@/app/actions/world-class-actions";

export function CheckInDeskClient(props: {
  branchId: string;
  branches: Array<{ id: string; name: string; code: string }>;
  todayCount: number;
  onFloorCount: number;
  turnstileConfigured: boolean;
  quickTokens: Array<{ label: string; fullName: string; qrToken: string; memberCode: string }>;
  recentLogs: Array<{
    id: string;
    memberId: string;
    fullName: string;
    memberCode: string;
    branchCode: string;
    visitedAt: string;
    checkedOut: boolean;
    method: string;
    result: string;
    overrideReason: string | null;
    distanceMeters: number | null;
  }>;
  devices: Array<{
    id: string;
    branchCode: string;
    serialNumber: string;
    name: string;
    vendor: string;
    mode: string;
    status: string;
    lastHeartbeat: string;
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
  const [kioskMode, setKioskMode] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [devSn, setDevSn] = useState("ZKTECO-BLR-01");
  const [devName, setDevName] = useState("SpeedFace V5L Turnstile");
  const [devVendor, setDevVendor] = useState<"ESSL" | "ZKTECO" | "GENERIC_TURNSTILE">("ZKTECO");

  const [geoRadiusM, setGeoRadiusM] = useState(50);
  const [geoVerdict, setGeoVerdict] = useState<GeofenceVerdict | null>(() =>
    evaluateGeofenceCheckIn({
      branchLat: 12.9716,
      branchLng: 77.6412,
      radiusMeters: 50,
      deviceLat: 12.9717,
      deviceLng: 77.6412,
      accuracyMeters: 14,
    })
  );
  const [antiPassback, setAntiPassback] = useState(true);
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

  const simulateAdmsHardwarePunch = () => {
    const dev = props.devices[0];
    const sampleCode = props.quickTokens[0]?.memberCode ?? "FM-1001";
    if (!dev) {
      setToastMsg("Register an eSSL/ZKTeco ADMS device first.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/iclock/cdata?SN=${encodeURIComponent(dev.serialNumber)}&table=ATTLOG`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: `${sampleCode}\t${new Date().toISOString().slice(0, 19).replace("T", " ")}\t1\t15\t0`,
      });
      const text = await res.text();
      setToastMsg(`ADMS Cloud Push [${dev.serialNumber}] -> ${text}`);
      router.refresh();
    });
  };

  const filteredAbsentees =
    absenteeFilter === "ALL"
      ? props.absentees
      : props.absentees.filter((a) => a.bucket === absenteeFilter);

  if (kioskMode) {
    return (
      <div className="min-h-[82vh] border-[4px] border-[#151515] bg-[#151515] text-[#FFFFFF] p-6 md:p-10 flex flex-col justify-between gap-6">
        <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#FFFFFF]/25 pb-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">SELF-SERVICE CHECK-IN KIOSK</p>
            <h1 className="font-headline text-[36px] md:text-[56px]">SCAN YOUR QR PASS.</h1>
          </div>
          <Button variant="yellow" onClick={() => setKioskMode(false)}>Exit Kiosk Mode</Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitScan();
          }}
          className="max-w-xl mx-auto w-full space-y-4"
        >
          <input
            value={tokenOrQuery}
            onChange={(e) => setTokenOrQuery(e.target.value)}
            placeholder="Scan dynamic QR (FQR2:...) or enter Member Code / Phone"
            className="w-full min-h-[60px] border-4 border-[#EBC95B] bg-[#FFFFFF] text-[#151515] px-4 text-[20px] font-bold"
          />
          <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
            {isPending ? "VALIDATING..." : "CHECK IN NOW →"}
          </Button>
          {scanResult && (
            <div className={`border-4 border-[#FFFFFF] p-6 ${scanResult.allowed ? "bg-[#2B4BCC]" : "bg-[#C8372B]"}`}>
              <p className="font-headline text-[28px]">{scanResult.allowed ? "WELCOME! GATE OPEN." : "SEE FRONT DESK"}</p>
              <p className="text-[16px] font-bold mt-1">{scanResult.memberName ?? ""} — {scanResult.reason}</p>
            </div>
          )}
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {props.quickTokens.slice(0, 2).map((t) => (
            <button
              key={t.memberCode}
              type="button"
              onClick={() => setTokenOrQuery(t.qrToken)}
              className="border-2 border-[#FFFFFF] px-3 py-1.5 text-[12px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
            >
              Tap Demo: {t.memberCode} ({t.label})
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-2">{`// QR, BIOMETRIC ADMS HARDWARE, GPS GEOFENCE & LIVE OCCUPANCY`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">ATTENDANCE &amp; GATE</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="yellow" onClick={() => setKioskMode(true)}>
            <Monitor className="size-4" /> Self Check-In Kiosk
          </Button>
          <Button variant="tertiary" onClick={() => setDeviceModalOpen(true)}>
            <Cpu className="size-4" /> Register Biometric
          </Button>
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
      </div>

      {/* Real DB Live Floor Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <StatTile
            label="// TODAY'S VERIFIED CHECK-INS"
            value={props.todayCount}
            subtext={`Live Active Devices: ${props.devices.length} · Turnstile: ${props.turnstileConfigured ? "READY" : "MOCK"}`}
            accent="blue"
          />
        </div>
        <div className="lg:col-span-8 bauhaus-card p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="bauhaus-label">{`// LIVE FLOOR OCCUPANCY (REAL DB CHECKED_OUT_AT IS NULL)`}</span>
            <span className="font-tabular font-bold text-[15px]">{props.onFloorCount} / 120 ON FLOOR</span>
          </div>
          <SegmentedProgress
            value={Math.min(120, props.onFloorCount)}
            max={120}
            segments={12}
            color={props.onFloorCount > 95 ? "red" : "blue"}
          />
          <p className="text-[12px] text-[var(--fg-grey)]">
            Supports rotating anti-screenshot QR (`FQR2:...`), eSSL/ZKTeco ADMS `/api/iclock/cdata`, GPS geofence radius checks, and audited exit check-outs.
          </p>
        </div>
      </div>

      {/* Scanner Panel & Check-in Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-4">
          <div className="bauhaus-card p-5 space-y-4">
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
                placeholder="Scan QR / FQR2, FM-1001, phone or name..."
                className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[15px] font-bold"
              />
              <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
                {isPending ? "Checking Gate..." : "Scan & Validate Pass →"}
              </Button>
            </form>

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

          {/* Wired Geofence & Biometric ADMS Control Box */}
          <div className="bauhaus-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="bauhaus-label text-[#2B4BCC] flex items-center gap-1">
                <MapPin className="size-4" /> GEOFENCE &amp; BIOMETRIC ADMS HARDWARE
              </p>
              <button
                type="button"
                onClick={() => setAntiPassback((v) => !v)}
                className={`border border-[var(--border-ink)] px-2 py-0.5 text-[12px] font-bold uppercase ${antiPassback ? "bg-[#EBC95B] text-[#151515]" : "bg-[var(--bg-surface)] text-[var(--fg-ink)]"}`}
              >
                <ShieldCheck className="size-3 inline mr-1" /> Anti-Passback: {antiPassback ? "ON" : "OFF"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <input
                type="number"
                value={geoRadiusM}
                onChange={(e) => {
                  const r = Number(e.target.value) || 50;
                  setGeoRadiusM(r);
                  setGeoVerdict(
                    evaluateGeofenceCheckIn({
                      branchLat: 12.9716,
                      branchLng: 77.6412,
                      radiusMeters: r,
                      deviceLat: 12.9717,
                      deviceLng: 77.6412,
                      accuracyMeters: 14,
                    })
                  );
                }}
                className="w-20 border-2 border-[var(--border-ink)] px-2 py-1 font-bold"
              />
              <span>m limit · {geoVerdict?.label}</span>
              <Button
                density="dense"
                variant="blue"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await testGeofenceCheckInAction({
                      branchId,
                      memberQuery: tokenOrQuery || "FM-1001",
                      deviceLat: 12.9717,
                      deviceLng: 77.6412,
                      accuracyMeters: 12,
                    });
                    setToastMsg(res.ok ? `Geofence check-in logged (${res.verdict.distanceMeters}m) for ${res.memberName}` : res.error);
                    router.refresh();
                  })
                }
              >
                Punch via GPS
              </Button>
            </div>

            <div className="border-t-2 border-[var(--border-ink)] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bauhaus-label">REGISTERED BIOMETRIC TERMINALS ({props.devices.length})</span>
                <Button density="dense" variant="secondary" disabled={isPending} onClick={simulateAdmsHardwarePunch}>
                  Test ADMS Punch
                </Button>
              </div>
              {props.devices.map((d) => (
                <div key={d.id} className="border border-[var(--border-ink)] bg-[var(--bg-paper)] p-2.5 flex items-center justify-between gap-2 text-[12px]">
                  <div>
                    <p className="font-bold">{d.name} ({d.vendor})</p>
                    <p className="text-[var(--fg-grey)]">SN: {d.serialNumber} · {d.branchCode} · Heartbeat: {d.lastHeartbeat}</p>
                  </div>
                  <Button
                    density="dense"
                    variant="yellow"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await queueRemoteDoorUnlockAction(d.id);
                        setToastMsg(`Queued AC_UNLOCK relay command for ${res.serialNumber}.`);
                      })
                    }
                  >
                    <Unlock className="size-3.5" /> Unlock
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Check-in Stream with Check-Out Action */}
        <div className="lg:col-span-7 bauhaus-card">
          <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4">
            <p className="bauhaus-label">{`// LIVE CHECK-IN, FLOOR CHECK-OUT & HARDWARE AUDIT STREAM`}</p>
          </div>
          <div className="divide-y-2 divide-[var(--border-ink)] max-h-[640px] overflow-y-auto">
            {props.recentLogs.map((row) => (
              <div key={row.id} className="p-3.5 flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <div>
                  <Link href={`/app/members/${row.memberId}`} className="font-bold hover:underline">
                    {row.fullName}
                  </Link>
                  <p className="text-[12px] text-[var(--fg-grey)]">
                    {row.memberCode} · {row.branchCode} · {row.method} · {row.visitedAt}
                    {typeof row.distanceMeters === "number" ? ` · GPS ${row.distanceMeters}m` : ""}
                  </p>
                  {row.overrideReason && (
                    <p className="text-[12px] font-bold text-[#C8372B]">Override: {row.overrideReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={row.result} />
                  {!row.checkedOut && (row.result === "ALLOWED" || row.result === "OVERRIDE_ALLOWED") ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await checkOutMemberAction(row.id);
                          setToastMsg(`${row.fullName} checked out of floor.`);
                          router.refresh();
                        })
                      }
                      className="border border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
                    >
                      <LogOut className="size-3 inline mr-1" /> Exit
                    </button>
                  ) : row.checkedOut ? (
                    <span className="text-[12px] font-bold uppercase text-[var(--fg-grey)]">EXITED</span>
                  ) : null}
                </div>
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
                className={`min-h-[36px] border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase ${
                  absenteeFilter === b ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)] text-[var(--fg-ink)]"
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

      {/* Register Biometric Device Modal */}
      <Modal open={deviceModalOpen} onClose={() => setDeviceModalOpen(false)} eyebrow="ADMS / TURNSTILE" title="Register Access Device">
        <div className="space-y-4">
          <input value={devName} onChange={(e) => setDevName(e.target.value)} placeholder="Device Name" className="bauhaus-input" />
          <div className="grid grid-cols-2 gap-2">
            <input value={devSn} onChange={(e) => setDevSn(e.target.value.toUpperCase())} placeholder="Serial Number" className="bauhaus-input uppercase font-mono" />
            <select value={devVendor} onChange={(e) => setDevVendor(e.target.value as typeof devVendor)} className="bauhaus-input">
              <option value="ESSL">eSSL Biometric (ADMS)</option>
              <option value="ZKTECO">ZKTeco SpeedFace (ADMS)</option>
              <option value="GENERIC_TURNSTILE">Generic HTTP Relay</option>
            </select>
          </div>
          <p className="text-[12px] text-[var(--fg-grey)]">
            Point device ADMS Cloud Server setting to <code className="font-bold">/api/iclock/cdata</code>.
          </p>
          <Button
            variant="primary"
            fullWidth
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await registerAccessDeviceAction({
                  branchId,
                  serialNumber: devSn,
                  name: devName,
                  vendor: devVendor,
                });
                setDeviceModalOpen(false);
                setToastMsg(`Registered hardware terminal ${devSn}.`);
                router.refresh();
              })
            }
          >
            Save Hardware Terminal
          </Button>
        </div>
      </Modal>
    </div>
  );
}
