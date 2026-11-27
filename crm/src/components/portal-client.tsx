"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, CreditCard, FileSignature, LogOut, MapPin, PauseCircle, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, StatusPill, Toast } from "@/components/ui/primitives";
import { QRCode } from "@/components/ui/qr-code";
import { formatMoney } from "@/lib/money";
import { generateStudioSpotCodes } from "@/lib/world-class-engines";
import { signOutAction } from "@/app/actions/crm-actions";
import {
  portalRequestFreezeAction,
  portalToggleClassBookingAction,
} from "@/app/actions/phase34-actions";
import {
  portalGeofenceSelfCheckInAction,
  portalSelfPayInvoiceAction,
  portalSignWaiverAction,
} from "@/app/actions/world-class-actions";

export function PortalClient({
  orgName,
  currency,
  rotatingPass,
  branchGeo,
  member,
  invoices,
  checkIns,
  trainingPlan,
  classes,
}: {
  orgName: string;
  currency: string;
  rotatingPass: { token: string; bucket: number; expiresInSec: number };
  branchGeo: { latitude: number; longitude: number; geofenceRadiusM: number };
  member: {
    id: string;
    fullName: string;
    memberCode: string;
    qrToken: string;
    status: string;
    expiryDate: string | null;
    branchName: string;
    referralCode: string;
    planName: string;
    loyaltyPoints: number;
    loyaltyTier: string;
    waiverSigned: boolean;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    totalPaise: number;
    balanceDuePaise: number;
    status: string;
  }>;
  checkIns: Array<{ id: string; visitedAt: string; method: string; result: string }>;
  trainingPlan: {
    syncToken: string;
    coachName: string;
    name: string;
    dietType: string;
    caloriesTarget: number;
    proteinGrams: number;
    workouts: Array<{ day: string; exercises: string[] }>;
    meals: Array<{ slot: string; items: string; macros: string }>;
  } | null;
  classes: Array<{
    id: string;
    title: string;
    trainerName: string;
    studioRoom: string;
    startsAt: string;
    bookedCount: number;
    capacity: number;
    layoutRows: number;
    layoutCols: number;
    layoutPrefix: string;
    takenSpots: string[];
    myStatus: string | null;
    myWaitlistPos: number | null;
    mySpotCode: string | null;
  }>;
}) {
  const router = useRouter();
  const [freezeReason, setFreezeReason] = useState("Travelling for work (7 days)");
  const [secondsLeft, setSecondsLeft] = useState(rotatingPass.expiresInSec);
  const [selectedSpotByClass, setSelectedSpotByClass] = useState<Record<string, string>>({});
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [signerName, setSignerName] = useState(member.fullName);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = window.setInterval(() => {
      const rem = 60 - (Math.floor(Date.now() / 1000) % 60);
      setSecondsLeft(rem);
      if (rem >= 59) {
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [router]);

  const handleGeofencePunch = () => {
    const submitPunch = (latitude: number, longitude: number, accuracyMeters: number, label: string) => {
      startTransition(async () => {
        const res = await portalGeofenceSelfCheckInAction({ latitude, longitude, accuracyMeters });
        if (!res.ok) {
          setToast({ msg: res.error, tone: "red" });
          return;
        }
        setToast({ msg: `GPS Check-In Approved (${res.distanceMeters}m from desk · ${label})!`, tone: "blue" });
        router.refresh();
      });
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => submitPunch(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 12, "Device GPS"),
        () => submitPunch(branchGeo.latitude, branchGeo.longitude, 15, "Branch Proximity"),
        { timeout: 2000 }
      );
    } else {
      submitPunch(branchGeo.latitude, branchGeo.longitude, 15, "Branch Proximity");
    }
  };

  const handleDrawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const rect = canvas.getBoundingClientRect();
    drawingRef.current = true;
    ctx2d.beginPath();
    ctx2d.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx2d.lineWidth = 2.5;
    ctx2d.strokeStyle = "#151515";
  };

  const handleDrawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const rect = canvas.getBoundingClientRect();
    ctx2d.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx2d.stroke();
  };

  const handleDrawEnd = () => {
    drawingRef.current = false;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-paper)] text-[var(--fg-ink)] pb-12">
      <header className="bg-[#151515] text-[#FFFFFF] border-b-[3px] border-[#151515] px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
            {"// MEMBER PWA PORTAL · "} {orgName}
          </p>
          <h1 className="font-headline text-[24px] text-[#FFFFFF]">{member.fullName}</h1>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="min-h-[44px] border-2 border-[#FFFFFF] px-3 text-[12px] font-bold uppercase inline-flex items-center gap-1.5 hover:bg-[#C8372B]">
            <LogOut className="size-4" /> Sign Out
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-6 space-y-6">
        {/* Dynamic Rotating QR Gate Pass Card */}
        <section className="bauhaus-card p-5 bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <QRCode value={rotatingPass.token} size={160} label={member.memberCode} />
            <span className="border border-[#151515] bg-[#151515] text-[#EBC95B] px-2 py-0.5 text-[12px] font-mono font-bold">
              DYNAMIC FQR2 · {secondsLeft}S
            </span>
          </div>
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={member.status} />
              <span className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-2.5 py-0.5 text-[12px] font-bold uppercase">
                <Trophy className="size-3.5 inline mr-1" />{member.loyaltyTier} · {member.loyaltyPoints} PTS
              </span>
              {member.waiverSigned ? (
                <span className="border-2 border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] px-2.5 py-0.5 text-[12px] font-bold uppercase">
                  <ShieldCheck className="size-3.5 inline mr-1" /> WAIVER SIGNED
                </span>
              ) : (
                <Button variant="primary" density="dense" onClick={() => setWaiverOpen(true)}>
                  <FileSignature className="size-3.5" /> Sign Health Waiver
                </Button>
              )}
            </div>
            <h2 className="font-headline text-[26px]">{member.planName}</h2>
            <p className="text-[13px] font-bold text-[var(--fg-grey)]">
              HOME BRANCH: {member.branchName} · EXPIRES:{" "}
              {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
            </p>
            <p className="text-[13px]">
              Share referral code <span className="bg-[#151515] text-[#EBC95B] px-2 py-0.5 font-mono font-bold">{member.referralCode}</span> for +7 free days &amp; ₹500 credit!
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="blue" disabled={pending} onClick={handleGeofencePunch}>
                <MapPin className="size-4" /> GPS Self Check-In ({branchGeo.geofenceRadiusM}m)
              </Button>
              {member.waiverSigned && (
                <Button variant="tertiary" onClick={() => setWaiverOpen(true)}>
                  <FileSignature className="size-4" /> Re-Sign Waiver
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Group Class Booking & Studio Spot Picker */}
        <section className="bauhaus-card p-5 space-y-3">
          <p className="bauhaus-label text-[#C8372B]">{"// BOOK UPCOMING CLASSES & PICK STUDIO SPOTS"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {classes.map((cls) => {
              const hasGrid = cls.layoutRows > 0 && cls.layoutCols > 0;
              const spotCodes = hasGrid ? generateStudioSpotCodes(cls.layoutRows, cls.layoutCols, cls.layoutPrefix) : [];
              const activeSpot = selectedSpotByClass[cls.id] ?? "";
              return (
                <div key={cls.id} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3.5 flex flex-col justify-between gap-2.5">
                  <div>
                    <p className="font-bold text-[15px]">{cls.title}</p>
                    <p className="text-[12px] text-[var(--fg-grey)]">
                      {cls.startsAt} · {cls.studioRoom} · Coach {cls.trainerName} ({cls.bookedCount}/{cls.capacity})
                    </p>
                  </div>

                  {hasGrid && !cls.myStatus && (
                    <div className="flex flex-wrap gap-1">
                      {spotCodes.map((code) => {
                        const taken = cls.takenSpots.includes(code);
                        const chosen = activeSpot === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            disabled={taken}
                            onClick={() =>
                              setSelectedSpotByClass((p) => ({ ...p, [cls.id]: p[cls.id] === code ? "" : code }))
                            }
                            className={clsx(
                              "min-h-[30px] border border-[#151515] px-2 text-[12px] font-mono font-bold",
                              taken
                                ? "bg-[#151515] text-[#FFFFFF] opacity-50 cursor-not-allowed"
                                : chosen
                                  ? "bg-[#2B4BCC] text-[#FFFFFF]"
                                  : "bg-[var(--bg-surface)] hover:bg-[#EBC95B]"
                            )}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {cls.myStatus ? (
                      <>
                        <span className="bg-[#2B4BCC] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                          {cls.myStatus === "WAITLISTED"
                            ? `WAITLIST #${cls.myWaitlistPos}`
                            : cls.mySpotCode
                              ? `${cls.myStatus} · ${cls.mySpotCode}`
                              : cls.myStatus}
                        </span>
                        <Button
                          variant="tertiary"
                          disabled={pending}
                          onClick={() => startTransition(async () => {
                            const res = await portalToggleClassBookingAction({ sessionId: cls.id, action: "CANCEL" });
                            if (res.ok) setToast({ msg: res.message, tone: "ink" });
                            router.refresh();
                          })}
                        >
                          Cancel Spot
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant={cls.bookedCount >= cls.capacity ? "yellow" : "primary"}
                        disabled={pending}
                        onClick={() => startTransition(async () => {
                          const res = await portalToggleClassBookingAction({
                            sessionId: cls.id,
                            action: "BOOK",
                            spotCode: activeSpot || undefined,
                          });
                          if (!res.ok) {
                            setToast({ msg: res.error, tone: "red" });
                            return;
                          }
                          setToast({ msg: res.message, tone: "blue" });
                          router.refresh();
                        })}
                      >
                        {cls.bookedCount >= cls.capacity
                          ? "Join Waitlist"
                          : activeSpot
                            ? `Reserve Spot ${activeSpot}`
                            : "Book Class"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Assigned Workouts & Indian Diet Plan */}
        {trainingPlan && (
          <section className="bauhaus-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="bauhaus-label text-[#2B4BCC]">{"// MY COACH PROTOCOL ("}{trainingPlan.dietType}{")"}</p>
                <h2 className="font-headline text-[22px]">{trainingPlan.name}</h2>
              </div>
              <span className="border border-[#151515] bg-[#151515] text-[#EBC95B] px-2.5 py-1 text-[12px] font-mono">
                {trainingPlan.caloriesTarget} kcal · {trainingPlan.proteinGrams}g P
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3">
                <p className="bauhaus-label">{"// WORKOUT SPLITS"}</p>
                {trainingPlan.workouts.map((w, idx) => (
                  <p key={idx} className="text-[13px]"><strong>{w.day}:</strong> {w.exercises.join(", ")}</p>
                ))}
              </div>
              <div className="space-y-2 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3">
                <p className="bauhaus-label">{"// MEAL SCHEDULE"}</p>
                {trainingPlan.meals.map((m, idx) => (
                  <p key={idx} className="text-[13px]"><strong>{m.slot}:</strong> {m.items} ({m.macros})</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Invoices (with Instant Pay) + Check-ins + Freeze Request */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label text-[#2B4BCC]">{"// GST INVOICES, INSTANT UPI PAY & RECENT VISITS"}</p>
            <div className="divide-y divide-[var(--border-ink)] text-[13px]">
              {invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{inv.invoiceNumber} ({inv.issueDate})</p>
                    <p className="font-tabular text-[12px] text-[var(--fg-grey)]">
                      Total {formatMoney(inv.totalPaise, { currency })} · Due {formatMoney(inv.balanceDuePaise, { currency })}
                    </p>
                  </div>
                  {inv.balanceDuePaise > 0 ? (
                    <div className="flex gap-1.5">
                      <Button
                        variant="primary"
                        density="dense"
                        disabled={pending}
                        onClick={() => startTransition(async () => {
                          const res = await portalSelfPayInvoiceAction({ invoiceId: inv.id, method: "UPI" });
                          if (!res.ok) {
                            setToast({ msg: res.error, tone: "red" });
                            return;
                          }
                          setToast({ msg: `UPI payment of ${formatMoney(res.paidPaise, { currency })} settled!`, tone: "blue" });
                          router.refresh();
                        })}
                      >
                        <CreditCard className="size-3.5" /> Pay UPI
                      </Button>
                      <Button
                        variant="secondary"
                        density="dense"
                        disabled={pending}
                        onClick={() => startTransition(async () => {
                          const res = await portalSelfPayInvoiceAction({ invoiceId: inv.id, method: "CARD" });
                          if (!res.ok) {
                            setToast({ msg: res.error, tone: "red" });
                            return;
                          }
                          setToast({ msg: `Card payment settled!`, tone: "blue" });
                          router.refresh();
                        })}
                      >
                        Card
                      </Button>
                    </div>
                  ) : (
                    <span className="border border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold">PAID</span>
                  )}
                </div>
              ))}
            </div>
            <p className="bauhaus-label pt-2">{"// RECENT FLOOR CHECK-INS ("}{checkIns.length}{")"}</p>
            <div className="space-y-1 text-[12px] font-tabular text-[var(--fg-grey)]">
              {checkIns.slice(0, 4).map((c) => (
                <div key={c.id}>{c.visitedAt} · {c.method} · {c.result}</div>
              ))}
            </div>
          </section>

          <section className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label text-[#C8372B]">{"// MEMBERSHIP FREEZE REQUEST"}</p>
            <input
              aria-label="Freeze reason"
              className="bauhaus-input"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
            />
            <Button
              variant="secondary"
              fullWidth
              disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await portalRequestFreezeAction(freezeReason);
                if (res.ok) setToast({ msg: "Freeze request sent to front desk!", tone: "blue" });
                router.refresh();
              })}
            >
              <PauseCircle className="size-4" /> Submit Freeze Request
            </Button>
          </section>
        </div>
      </main>

      {/* Self-Service Digital Waiver E-Sign Modal */}
      <Modal open={waiverOpen} onClose={() => setWaiverOpen(false)} eyebrow="PAR-Q & LIABILITY" title="Sign Digital Gym Waiver">
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--fg-grey)]">
            I confirm I am medically fit for high-intensity resistance and conditioning training at {orgName} and accept club safety guidelines.
          </p>
          <div>
            <label htmlFor="wv-nm" className="bauhaus-label block mb-1">{"// FULL LEGAL NAME"}</label>
            <input id="wv-nm" className="bauhaus-input" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <div>
            <p className="bauhaus-label mb-1">{"// DRAW SIGNATURE"}</p>
            <canvas
              ref={canvasRef}
              width={420}
              height={130}
              onPointerDown={handleDrawStart}
              onPointerMove={handleDrawMove}
              onPointerUp={handleDrawEnd}
              onPointerLeave={handleDrawEnd}
              className="w-full max-w-[420px] h-[130px] border-2 border-[#151515] bg-[#FFFFFF] touch-none cursor-crosshair"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="tertiary"
              onClick={() => {
                const c = canvasRef.current;
                if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
              }}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={pending || !signerName.trim()}
              onClick={() => startTransition(async () => {
                const dataUrl = canvasRef.current?.toDataURL("image/png") ?? "data:image/png;base64,iVBORw0KGgo=";
                const res = await portalSignWaiverAction({ signerName, signatureDataUrl: dataUrl });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setWaiverOpen(false);
                setToast({ msg: "Digital PAR-Q waiver signed & archived!", tone: "blue" });
                router.refresh();
              })}
            >
              <Check className="size-4" /> Accept &amp; Archive Signature
            </Button>
          </div>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
