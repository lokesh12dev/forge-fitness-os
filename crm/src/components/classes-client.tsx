"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Ban, Calendar, CalendarRange, Check, Grid, Plus, Star, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, Modal, SegmentedProgress, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { generateStudioSpotCodes } from "@/lib/world-class-engines";
import {
  bookMemberInClassAction,
  createClassSessionAction,
  submitNpsFeedbackAction,
  updateClassBookingStatusAction,
} from "@/app/actions/phase34-actions";
import {
  bookClassWithSpotAction,
  createRecurringClassSeriesAction,
  upsertClassTypeWithGridAction,
} from "@/app/actions/world-class-actions";

interface SessionRow {
  id: string;
  branchId: string;
  branchName: string;
  title: string;
  category: string;
  studioRoom: string;
  trainerName: string;
  startsAt: string;
  capacity: number;
  cutoffMinutes: number;
  noShowFeePaise: number;
  layoutRows: number;
  layoutCols: number;
  layoutPrefix: string;
  bookings: Array<{
    id: string;
    memberName: string;
    memberCode: string;
    status: string;
    waitlistPos: number | null;
    spotCode: string | null;
  }>;
}

export function ClassesClient({
  currency,
  canManage,
  branches,
  classTypes,
  trainers,
  members,
  sessions,
  feedbacks,
}: {
  currency: string;
  canManage: boolean;
  branches: Array<{ id: string; name: string }>;
  classTypes: Array<{
    id: string;
    name: string;
    category: string;
    defaultDurationMin: number;
    defaultCapacity: number;
    noShowFeePaise: number;
    cutoffMinutes: number;
    layoutRows: number;
    layoutCols: number;
    layoutPrefix: string;
  }>;
  trainers: Array<{ id: string; name: string }>;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  sessions: SessionRow[];
  feedbacks: Array<{
    id: string;
    memberName: string;
    memberCode: string;
    npsScore: number;
    category: string;
    comment: string;
    createdAt: string;
  }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"SCHEDULE" | "FORMATS" | "NPS">("SCHEDULE");
  const [newOpen, setNewOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [npsOpen, setNpsOpen] = useState(false);
  const [selectedBookMember, setSelectedBookMember] = useState(members[0]?.id ?? "");
  const [selectedSpotBySession, setSelectedSpotBySession] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Single Class form
  const [clsBranchId, setClsBranchId] = useState(branches[0]?.id ?? "");
  const [clsTypeId, setClsTypeId] = useState(classTypes[0]?.id ?? "");
  const [clsTrainerId, setClsTrainerId] = useState(trainers[0]?.id ?? "");
  const [clsRoom, setClsRoom] = useState("Turf Bay A");
  const [clsCap, setClsCap] = useState(classTypes[0]?.defaultCapacity ?? 16);
  const [clsStarts, setClsStarts] = useState(() =>
    new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 16)
  );

  // Recurring Series form
  const [serWeeks, setSerWeeks] = useState(4);
  const [serDays, setSerDays] = useState<number[]>([1, 3, 5]); // Mon/Wed/Fri

  // Studio ClassType + Grid Builder form
  const [fmtName, setFmtName] = useState("Forge Cycle Peloton Pod");
  const [fmtCat, setFmtCat] = useState("CARDIO");
  const [fmtDur, setFmtDur] = useState(45);
  const [fmtRows, setFmtRows] = useState(4);
  const [fmtCols, setFmtCols] = useState(5);
  const [fmtPrefix, setFmtPrefix] = useState("B");
  const [fmtNoShowRupees, setFmtNoShowRupees] = useState(250);
  const [fmtCutoff, setFmtCutoff] = useState(120);

  // NPS form
  const [npsMemberId, setNpsMemberId] = useState(members[0]?.id ?? "");
  const [npsScore, setNpsScore] = useState(9);
  const [npsCategory, setNpsCategory] = useState("CLASSES");
  const [npsComment, setNpsComment] = useState("");

  const stats = useMemo(() => {
    const bookedTotal = sessions.reduce(
      (s, x) => s + x.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length,
      0
    );
    const waitlistTotal = sessions.reduce(
      (s, x) => s + x.bookings.filter((b) => b.status === "WAITLISTED").length,
      0
    );
    const promoters = feedbacks.filter((f) => f.npsScore >= 9).length;
    const detractors = feedbacks.filter((f) => f.npsScore <= 6).length;
    const nps = feedbacks.length > 0 ? Math.round(((promoters - detractors) / feedbacks.length) * 100) : 78;
    return { bookedTotal, waitlistTotal, nps };
  }, [sessions, feedbacks]);

  const toggleDay = (d: number) => {
    setSerDays((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort()
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// STUDIO SPOT MAPS, RECURRING TIMETABLE & WAITLIST ENGINE"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">CLASSES &amp; NPS.</h1>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" onClick={() => setNpsOpen(true)}>
              <Star className="size-4" /> Log Feedback
            </Button>
            <Button variant="secondary" onClick={() => setFormatOpen(true)}>
              <Grid className="size-4" /> + Studio Format Map
            </Button>
            <Button variant="blue" onClick={() => setSeriesOpen(true)}>
              <CalendarRange className="size-4" /> Recurring Series
            </Button>
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Schedule Class
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// UPCOMING SESSIONS" value={sessions.length} subtext="Published across active branches" accent="blue" />
        <StatTile label="// BOOKED SPOTS" value={stats.bookedTotal} subtext="Spot/bike reservations & check-ins" accent="ink" />
        <StatTile label="// AUTO-WAITLISTED" value={stats.waitlistTotal} subtext="FIFO + WhatsApp auto-promotion" accent="yellow" />
        <StatTile label="// CLUB NPS SCORE" value={`+${stats.nps}`} subtext={`${feedbacks.length} scored member reviews`} accent="red" />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["SCHEDULE", "FORMATS", "NPS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "SCHEDULE"
                ? `CLASS ROSTERS (${sessions.length})`
                : t === "FORMATS"
                  ? `STUDIO LAYOUT MAPS (${classTypes.length})`
                  : `NPS FEEDBACK (${feedbacks.length})`}
            </button>
          ))}
        </div>
        {canManage && members.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="bauhaus-label text-[var(--fg-grey)]">QUICK BOOK MEMBER:</span>
            <select
              aria-label="Member to book in class"
              className="bauhaus-input w-auto"
              value={selectedBookMember}
              onChange={(e) => setSelectedBookMember(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>
              ))}
            </select>
          </div>
        )}
      </FilterBar>

      {tab === "SCHEDULE" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const occupied = s.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN");
            const waitlist = s.bookings.filter((b) => b.status === "WAITLISTED");
            const hasGrid = s.layoutRows > 0 && s.layoutCols > 0;
            const spotCodes = hasGrid ? generateStudioSpotCodes(s.layoutRows, s.layoutCols, s.layoutPrefix) : [];
            const takenSpotMap = new Map(
              occupied.filter((b) => b.spotCode).map((b) => [b.spotCode!, b.memberCode])
            );
            const activeSpot = selectedSpotBySession[s.id] ?? "";

            return (
              <div key={s.id} className="bauhaus-card p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="bauhaus-label text-[#2B4BCC]">{`// ${s.category} · ${s.branchName} · ${s.studioRoom}`}</p>
                    <h2 className="font-headline text-[22px] mt-1">{s.title}</h2>
                    <p className="text-[12px] font-bold text-[var(--fg-grey)] mt-0.5">
                      <Calendar className="size-3.5 inline mr-1" />
                      {new Date(s.startsAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                      {" · "}COACH: {s.trainerName} · CUTOFF {s.cutoffMinutes}M (NO-SHOW {formatMoney(s.noShowFeePaise, { currency })})
                    </p>
                  </div>
                  <span className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] px-2.5 py-1 text-[12px] font-tabular font-bold">
                    {occupied.length}/{s.capacity} SEATS
                  </span>
                </div>

                <SegmentedProgress value={occupied.length} max={s.capacity} color={occupied.length >= s.capacity ? "red" : "blue"} />

                {/* Interactive Studio Spot / Bike Map */}
                {hasGrid && (
                  <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[12px] font-bold">
                      <span className="bauhaus-label">{"// STUDIO FLOOR SPOT MAP"} ({s.layoutRows}×{s.layoutCols})</span>
                      {activeSpot && <span className="text-[#2B4BCC]">SELECTED: {activeSpot}</span>}
                    </div>
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.min(6, s.layoutCols)}, minmax(0, 1fr))` }}
                    >
                      {spotCodes.map((code) => {
                        const holder = takenSpotMap.get(code);
                        const selected = activeSpot === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            disabled={Boolean(holder)}
                            onClick={() =>
                              setSelectedSpotBySession((prev) => ({
                                ...prev,
                                [s.id]: prev[s.id] === code ? "" : code,
                              }))
                            }
                            className={clsx(
                              "min-h-[34px] border border-[#151515] px-1 text-[12px] font-mono font-bold",
                              holder
                                ? "bg-[#151515] text-[#FFFFFF] opacity-80 cursor-not-allowed"
                                : selected
                                  ? "bg-[#2B4BCC] text-[#FFFFFF]"
                                  : "bg-[var(--bg-surface)] hover:bg-[#EBC95B]"
                            )}
                            title={holder ? `Reserved by ${holder}` : `Pick spot ${code}`}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bauhaus-label">{"// ROSTER & WAITLIST"}</span>
                    {canManage && (
                      <Button
                        variant={occupied.length >= s.capacity ? "yellow" : "primary"}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            if (hasGrid && activeSpot) {
                              const res = await bookClassWithSpotAction({
                                sessionId: s.id,
                                memberId: selectedBookMember,
                                spotCode: activeSpot,
                              });
                              if (!res.ok) {
                                setToast({ msg: res.error, tone: "red" });
                                return;
                              }
                              setSelectedSpotBySession((p) => ({ ...p, [s.id]: "" }));
                              setToast({ msg: `Booked spot ${res.spotCode ?? "assigned"} (${res.status})!`, tone: "blue" });
                            } else {
                              const res = await bookMemberInClassAction({ sessionId: s.id, memberId: selectedBookMember });
                              if (!res.ok) {
                                setToast({ msg: res.error, tone: "red" });
                                return;
                              }
                              setToast({
                                msg: res.bookingStatus === "BOOKED" ? "Seat booked!" : `Added to waitlist #${res.waitlistPos}.`,
                                tone: "blue",
                              });
                            }
                            router.refresh();
                          });
                        }}
                      >
                        <UserPlus className="size-4" />{" "}
                        {occupied.length >= s.capacity
                          ? "Join Waitlist"
                          : activeSpot
                            ? `Book Spot ${activeSpot}`
                            : "Book Member"}
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-[var(--border-ink)] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] max-h-48 overflow-y-auto">
                    {s.bookings.map((b) => (
                      <div key={b.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <div>
                          <span className="font-bold">{b.memberName}</span>{" "}
                          <span className="text-[12px] text-[var(--fg-grey)] font-tabular">({b.memberCode})</span>
                          {b.spotCode && (
                            <span className="ml-2 border border-[#151515] bg-[#151515] text-[#FFFFFF] px-1.5 py-0.5 text-[12px] font-mono font-bold">
                              {b.spotCode}
                            </span>
                          )}
                          {b.status === "WAITLISTED" && (
                            <span className="ml-2 bg-[#EBC95B] text-[#151515] px-1.5 py-0.5 text-[12px] font-bold">
                              WAIT #{b.waitlistPos}
                            </span>
                          )}
                          {b.status === "CHECKED_IN" && (
                            <span className="ml-2 bg-[#2B4BCC] text-[#FFFFFF] px-1.5 py-0.5 text-[12px] font-bold">CHECKED IN</span>
                          )}
                          {b.status === "NO_SHOW" && (
                            <span className="ml-2 bg-[#C8372B] text-[#FFFFFF] px-1.5 py-0.5 text-[12px] font-bold">NO SHOW</span>
                          )}
                        </div>
                        {canManage && b.status !== "CANCELLED" && (
                          <div className="flex flex-wrap items-center gap-1">
                            {b.status === "BOOKED" && (
                              <>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => startTransition(async () => {
                                    await updateClassBookingStatusAction({ bookingId: b.id, nextStatus: "CHECKED_IN" });
                                    router.refresh();
                                  })}
                                  className="min-h-[30px] border border-[var(--border-ink)] bg-[var(--bg-surface)] text-[var(--fg-ink)] px-2 py-0.5 text-[12px] font-bold hover:bg-[#2B4BCC] hover:text-[#FFFFFF]"
                                  title="Check In"
                                >
                                  <Check className="size-3.5 inline" /> In
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => startTransition(async () => {
                                    const res = await updateClassBookingStatusAction({ bookingId: b.id, nextStatus: "NO_SHOW" });
                                    if (res.ok) {
                                      setToast({
                                        msg: res.noShowInvoicedPaise > 0
                                          ? `Marked NO_SHOW & invoiced penalty ${formatMoney(res.noShowInvoicedPaise, { currency })}!`
                                          : "Marked NO_SHOW.",
                                        tone: "red",
                                      });
                                    }
                                    router.refresh();
                                  })}
                                  className="min-h-[30px] border border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-0.5 text-[12px] font-bold text-[#C8372B] hover:bg-[#EBC95B] hover:text-[#151515]"
                                  title="Mark No-Show (+fee)"
                                >
                                  <Ban className="size-3.5 inline" /> No-Show
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => startTransition(async () => {
                                const res = await updateClassBookingStatusAction({ bookingId: b.id, nextStatus: "CANCELLED" });
                                if (res.ok && res.promotedMemberName) {
                                  setToast({ msg: `Cancelled. Promoted ${res.promotedMemberName} (+WhatsApp notified)!`, tone: "blue" });
                                }
                                router.refresh();
                              })}
                              className="min-h-[30px] border border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-0.5 text-[12px] font-bold text-[#C8372B] hover:bg-[#C8372B] hover:text-[#FFFFFF]"
                              title="Cancel Booking"
                            >
                              <X className="size-3.5 inline" /> Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {s.bookings.length === 0 && (
                      <p className="p-3 text-[12px] text-[var(--fg-grey)] uppercase font-bold">No bookings yet</p>
                    )}
                  </div>
                  {waitlist.length > 0 && (
                    <p className="text-[12px] font-bold text-[#C8372B] uppercase">
                      {waitlist.length} waitlisted — FIFO auto-promotes &amp; WhatsApps on cancel.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "FORMATS" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classTypes.map((ct) => (
            <div key={ct.id} className="bauhaus-card p-5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="bauhaus-label text-[#2B4BCC]">{`// ${ct.category}`}</span>
                <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold">
                  {ct.defaultDurationMin} MIN · CAP {ct.defaultCapacity}
                </span>
              </div>
              <h2 className="font-headline text-[22px]">{ct.name}</h2>
              <p className="text-[13px] text-[var(--fg-grey)]">
                Spot Layout: {ct.layoutRows > 0 ? `${ct.layoutRows}×${ct.layoutCols} (${ct.layoutPrefix}1..)` : "Open Floor (No Fixed Spots)"}
              </p>
              <p className="text-[12px] font-bold text-[#C8372B]">
                No-Show Fee: {formatMoney(ct.noShowFeePaise, { currency })} · Cutoff: {ct.cutoffMinutes}m
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "NPS" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feedbacks.map((f) => (
            <div key={f.id} className="bauhaus-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bauhaus-label text-[#2B4BCC]">{`// ${f.category}`}</span>
                <span
                  className={clsx(
                    "px-2 py-0.5 border border-[#151515] font-headline text-[16px]",
                    f.npsScore >= 9 ? "bg-[#2B4BCC] text-[#FFFFFF]" : f.npsScore >= 7 ? "bg-[#EBC95B] text-[#151515]" : "bg-[#C8372B] text-[#FFFFFF]"
                  )}
                >
                  {f.npsScore}/10
                </span>
              </div>
              <p className="text-[14px] font-bold">{f.memberName} ({f.memberCode})</p>
              <p className="text-[13px] text-[var(--fg-grey)]">{f.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Class Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} eyebrow="STUDIO TIMETABLE" title="Schedule Group Class">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cls-br" className="bauhaus-label block mb-1.5">{"// BRANCH"}</label>
              <select id="cls-br" className="bauhaus-input" value={clsBranchId} onChange={(e) => setClsBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cls-tp" className="bauhaus-label block mb-1.5">{"// FORMAT"}</label>
              <select id="cls-tp" className="bauhaus-input" value={clsTypeId} onChange={(e) => setClsTypeId(e.target.value)}>
                {classTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cls-tr" className="bauhaus-label block mb-1.5">{"// LEAD TRAINER"}</label>
              <select id="cls-tr" className="bauhaus-input" value={clsTrainerId} onChange={(e) => setClsTrainerId(e.target.value)}>
                {trainers.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cls-st" className="bauhaus-label block mb-1.5">{"// START TIME"}</label>
              <input id="cls-st" type="datetime-local" className="bauhaus-input" value={clsStarts} onChange={(e) => setClsStarts(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cls-rm" className="bauhaus-label block mb-1.5">{"// STUDIO ROOM"}</label>
              <input id="cls-rm" className="bauhaus-input" value={clsRoom} onChange={(e) => setClsRoom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="cls-cap" className="bauhaus-label block mb-1.5">{"// CAPACITY"}</label>
              <input id="cls-cap" type="number" min={1} className="bauhaus-input" value={clsCap} onChange={(e) => setClsCap(Number(e.target.value))} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await createClassSessionAction({
                  branchId: clsBranchId,
                  classTypeId: clsTypeId,
                  trainerId: clsTrainerId,
                  startsAt: clsStarts,
                  studioRoom: clsRoom,
                  capacity: clsCap,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setNewOpen(false);
                setToast({ msg: "Class added to studio timetable.", tone: "blue" });
                router.refresh();
              });
            }}
          >
            PUBLISH CLASS SESSION
          </Button>
        </div>
      </Modal>

      {/* Recurring Series Modal */}
      <Modal open={seriesOpen} onClose={() => setSeriesOpen(false)} eyebrow="MULTI-WEEK TIMETABLE" title="Create Recurring Class Series">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ser-br" className="bauhaus-label block mb-1">{"// BRANCH"}</label>
              <select id="ser-br" className="bauhaus-input" value={clsBranchId} onChange={(e) => setClsBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ser-tp" className="bauhaus-label block mb-1">{"// CLASS FORMAT"}</label>
              <select id="ser-tp" className="bauhaus-input" value={clsTypeId} onChange={(e) => setClsTypeId(e.target.value)}>
                {classTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ser-tr" className="bauhaus-label block mb-1">{"// COACH"}</label>
              <select id="ser-tr" className="bauhaus-input" value={clsTrainerId} onChange={(e) => setClsTrainerId(e.target.value)}>
                {trainers.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ser-wk" className="bauhaus-label block mb-1">{"// WEEKS"}</label>
              <input id="ser-wk" type="number" min={1} max={12} className="bauhaus-input" value={serWeeks} onChange={(e) => setSerWeeks(Number(e.target.value) || 4)} />
            </div>
            <div>
              <label htmlFor="ser-st" className="bauhaus-label block mb-1">{"// TIME SLOT"}</label>
              <input id="ser-st" type="datetime-local" className="bauhaus-input" value={clsStarts} onChange={(e) => setClsStarts(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="bauhaus-label mb-1.5">{"// DAYS OF WEEK"}</p>
            <div className="flex flex-wrap gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((lbl, idx) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={clsx(
                    "min-h-[38px] border-2 border-[#151515] px-3 text-[12px] font-bold uppercase",
                    serDays.includes(idx) ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[var(--bg-paper)]"
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              const res = await createRecurringClassSeriesAction({
                branchId: clsBranchId,
                classTypeId: clsTypeId,
                trainerId: clsTrainerId,
                firstStartsAt: clsStarts,
                studioRoom: clsRoom,
                weeksCount: serWeeks,
                daysOfWeek: serDays,
              });
              if (!res.ok) {
                setToast({ msg: res.error, tone: "red" });
                return;
              }
              setSeriesOpen(false);
              setToast({ msg: `Published ${res.createdCount} recurring studio sessions!`, tone: "blue" });
              router.refresh();
            })}
          >
            GENERATE RECURRING SESSIONS
          </Button>
        </div>
      </Modal>

      {/* Studio Format + Grid Map Builder Modal */}
      <Modal open={formatOpen} onClose={() => setFormatOpen(false)} eyebrow="CLASS FORMAT & SPOT GRID" title="Upsert ClassType & Spot Layout">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fmt-nm" className="bauhaus-label block mb-1">{"// FORMAT NAME"}</label>
              <input id="fmt-nm" className="bauhaus-input" value={fmtName} onChange={(e) => setFmtName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fmt-ct" className="bauhaus-label block mb-1">{"// CATEGORY"}</label>
              <input id="fmt-ct" className="bauhaus-input" value={fmtCat} onChange={(e) => setFmtCat(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label htmlFor="fmt-r" className="bauhaus-label block mb-1">{"// ROWS"}</label>
              <input id="fmt-r" type="number" min={0} max={10} className="bauhaus-input" value={fmtRows} onChange={(e) => setFmtRows(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="fmt-c" className="bauhaus-label block mb-1">{"// COLS"}</label>
              <input id="fmt-c" type="number" min={0} max={10} className="bauhaus-input" value={fmtCols} onChange={(e) => setFmtCols(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="fmt-px" className="bauhaus-label block mb-1">{"// PREFIX"}</label>
              <input id="fmt-px" className="bauhaus-input font-mono" value={fmtPrefix} onChange={(e) => setFmtPrefix(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fmt-dur" className="bauhaus-label block mb-1">{"// MINS"}</label>
              <input id="fmt-dur" type="number" min={20} className="bauhaus-input" value={fmtDur} onChange={(e) => setFmtDur(Number(e.target.value) || 45)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fmt-fee" className="bauhaus-label block mb-1">{"// NO-SHOW FEE (₹)"}</label>
              <input id="fmt-fee" type="number" min={0} className="bauhaus-input" value={fmtNoShowRupees} onChange={(e) => setFmtNoShowRupees(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="fmt-cut" className="bauhaus-label block mb-1">{"// CANCEL CUTOFF (M)"}</label>
              <input id="fmt-cut" type="number" min={15} className="bauhaus-input" value={fmtCutoff} onChange={(e) => setFmtCutoff(Number(e.target.value) || 60)} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              await upsertClassTypeWithGridAction({
                name: fmtName,
                category: fmtCat,
                defaultDurationMin: fmtDur,
                defaultCapacity: Math.max(1, fmtRows * fmtCols || 16),
                noShowFeePaise: fmtNoShowRupees * 100,
                cutoffMinutes: fmtCutoff,
                layoutRows: fmtRows,
                layoutCols: fmtCols,
                layoutPrefix: fmtPrefix,
              });
              setFormatOpen(false);
              setToast({ msg: `Studio format ${fmtName} saved (${fmtRows}×${fmtCols} spot map)!`, tone: "blue" });
              router.refresh();
            })}
          >
            SAVE CLASS FORMAT &amp; SPOT GRID
          </Button>
        </div>
      </Modal>

      {/* Log NPS Modal */}
      <Modal open={npsOpen} onClose={() => setNpsOpen(false)} eyebrow="MEMBER SENTIMENT" title="Record Class / Club NPS">
        <div className="space-y-4">
          <div>
            <label htmlFor="nps-mem" className="bauhaus-label block mb-1.5">{"// MEMBER"}</label>
            <select id="nps-mem" className="bauhaus-input" value={npsMemberId} onChange={(e) => setNpsMemberId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="nps-sc" className="bauhaus-label block mb-1.5">{"// NPS SCORE (0-10)"}</label>
              <input id="nps-sc" type="number" min={0} max={10} className="bauhaus-input" value={npsScore} onChange={(e) => setNpsScore(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="nps-cat" className="bauhaus-label block mb-1.5">{"// CATEGORY"}</label>
              <select id="nps-cat" className="bauhaus-input" value={npsCategory} onChange={(e) => setNpsCategory(e.target.value)}>
                <option value="CLASSES">CLASSES</option>
                <option value="COACHES">COACHES</option>
                <option value="EQUIPMENT">EQUIPMENT</option>
                <option value="CLEANLINESS">CLEANLINESS</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="nps-cmt" className="bauhaus-label block mb-1.5">{"// COMMENT"}</label>
            <input id="nps-cmt" className="bauhaus-input" value={npsComment} onChange={(e) => setNpsComment(e.target.value)} placeholder="Feedback on session pacing or floor coach..." />
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await submitNpsFeedbackAction({
                  branchId: branches[0]?.id ?? "",
                  memberId: npsMemberId,
                  npsScore,
                  category: npsCategory,
                  comment: npsComment,
                });
                setNpsOpen(false);
                setNpsComment("");
                setToast({ msg: "Member NPS score recorded.", tone: "blue" });
                router.refresh();
              });
            }}
          >
            SAVE FEEDBACK
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
