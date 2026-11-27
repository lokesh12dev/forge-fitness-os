"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, PauseCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, Toast } from "@/components/ui/primitives";
import { QRCode } from "@/components/ui/qr-code";
import { formatMoney } from "@/lib/money";
import { signOutAction } from "@/app/actions/crm-actions";
import {
  portalRequestFreezeAction,
  portalToggleClassBookingAction,
} from "@/app/actions/phase34-actions";

export function PortalClient({
  orgName,
  currency,
  member,
  invoices,
  checkIns,
  trainingPlan,
  classes,
}: {
  orgName: string;
  currency: string;
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
    myStatus: string | null;
    myWaitlistPos: number | null;
  }>;
}) {
  const router = useRouter();
  const [freezeReason, setFreezeReason] = useState("Travelling for work (7 days)");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

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
        {/* QR Gate Pass Card */}
        <section className="bauhaus-card p-5 bg-[var(--bg-surface)] flex flex-col sm:flex-row items-center gap-6">
          <QRCode value={member.qrToken} size={160} label={member.memberCode} />
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={member.status} />
              <span className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-2.5 py-0.5 text-[12px] font-bold uppercase">
                <Trophy className="size-3.5 inline mr-1" />{member.loyaltyTier} · {member.loyaltyPoints} PTS
              </span>
            </div>
            <h2 className="font-headline text-[26px]">{member.planName}</h2>
            <p className="text-[13px] font-bold text-[var(--fg-grey)]">
              HOME BRANCH: {member.branchName} · EXPIRES:{" "}
              {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
            </p>
            <p className="text-[13px]">
              Share referral code <span className="bg-[#151515] text-[#EBC95B] px-2 py-0.5 font-mono font-bold">{member.referralCode}</span> for +7 free days &amp; ₹500 credit!
            </p>
          </div>
        </section>

        {/* Group Class Booking & Auto-Waitlist */}
        <section className="bauhaus-card p-5 space-y-3">
          <p className="bauhaus-label text-[#C8372B]">{"// BOOK UPCOMING CLASSES"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {classes.map((cls) => (
              <div key={cls.id} className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3.5 flex flex-col justify-between gap-2">
                <div>
                  <p className="font-bold text-[15px]">{cls.title}</p>
                  <p className="text-[12px] text-[var(--fg-grey)]">
                    {cls.startsAt} · {cls.studioRoom} · Coach {cls.trainerName} ({cls.bookedCount}/{cls.capacity})
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  {cls.myStatus ? (
                    <>
                      <span className="bg-[#2B4BCC] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                        {cls.myStatus === "WAITLISTED" ? `WAITLIST #${cls.myWaitlistPos}` : cls.myStatus}
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
                        const res = await portalToggleClassBookingAction({ sessionId: cls.id, action: "BOOK" });
                        if (res.ok) setToast({ msg: res.message, tone: "blue" });
                        router.refresh();
                      })}
                    >
                      {cls.bookedCount >= cls.capacity ? "Join Waitlist" : "Book Class"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
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

        {/* Invoices + Check-ins + Freeze Request */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bauhaus-card p-5 space-y-3">
            <p className="bauhaus-label text-[#2B4BCC]">{"// GST INVOICES & RECENT VISITS"}</p>
            <div className="divide-y divide-[var(--border-ink)] text-[13px]">
              {invoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="py-2 flex items-center justify-between">
                  <span className="font-bold">{inv.invoiceNumber} ({inv.issueDate})</span>
                  <span className="font-tabular font-bold">{formatMoney(inv.totalPaise, { currency })} · {inv.status}</span>
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

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
