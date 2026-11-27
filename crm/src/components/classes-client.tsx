"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Calendar, Check, Plus, Star, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, Modal, SegmentedProgress, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import {
  bookMemberInClassAction,
  createClassSessionAction,
  submitNpsFeedbackAction,
  updateClassBookingStatusAction,
} from "@/app/actions/phase34-actions";

interface SessionItem {
  id: string;
  branchId: string;
  branchName: string;
  title: string;
  category: string;
  trainerName: string;
  studioRoom: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  cutoffMinutes: number;
  noShowFeePaise: number;
  bookings: Array<{
    id: string;
    memberName: string;
    memberCode: string;
    status: string;
    waitlistPos: number | null;
  }>;
}

interface FeedbackItem {
  id: string;
  memberName: string;
  memberCode: string;
  npsScore: number;
  category: string;
  comment: string;
  createdAt: string;
}

export function ClassesClient({
  canManage,
  currency,
  branches,
  classTypes,
  trainers,
  members,
  sessions,
  feedbacks,
}: {
  canManage: boolean;
  currency: string;
  branches: Array<{ id: string; name: string }>;
  classTypes: Array<{ id: string; name: string; category: string; defaultCapacity: number }>;
  trainers: Array<{ id: string; name: string }>;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  sessions: SessionItem[];
  feedbacks: FeedbackItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"SCHEDULE" | "NPS">("SCHEDULE");
  const [newOpen, setNewOpen] = useState(false);
  const [npsOpen, setNpsOpen] = useState(false);
  const [selectedBookMember, setSelectedBookMember] = useState(members[0]?.id ?? "");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // New class form
  const [clsBranchId, setClsBranchId] = useState(branches[0]?.id ?? "");
  const [clsTypeId, setClsTypeId] = useState(classTypes[0]?.id ?? "");
  const [clsTrainerId, setClsTrainerId] = useState(trainers[0]?.id ?? "");
  const [clsRoom, setClsRoom] = useState("Turf Bay A");
  const [clsCap, setClsCap] = useState(16);
  const [clsStarts, setClsStarts] = useState(() =>
    new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 16)
  );

  // NPS form
  const [npsMemberId, setNpsMemberId] = useState(members[0]?.id ?? "");
  const [npsScore, setNpsScore] = useState(9);
  const [npsCategory, setNpsCategory] = useState("CLASSES");
  const [npsComment, setNpsComment] = useState("");

  const stats = useMemo(() => {
    const booked = sessions.reduce(
      (acc, s) => acc + s.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length,
      0
    );
    const waitlisted = sessions.reduce(
      (acc, s) => acc + s.bookings.filter((b) => b.status === "WAITLISTED").length,
      0
    );
    const avgNps =
      feedbacks.length > 0
        ? (feedbacks.reduce((s, f) => s + f.npsScore, 0) / feedbacks.length).toFixed(1)
        : "9.0";
    return { booked, waitlisted, avgNps };
  }, [sessions, feedbacks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// STUDIO SCHEDULE, WAITLISTS & FEEDBACK"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">GROUP CLASSES.</h1>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" onClick={() => setNpsOpen(true)}>
              <Star className="size-4" /> Log Member NPS
            </Button>
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Schedule Class
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// SESSIONS LIVE" value={sessions.length} subtext="Upcoming studio slots" accent="blue" />
        <StatTile label="// SEATS BOOKED" value={stats.booked} subtext="Confirmed + checked-in spots" accent="ink" />
        <StatTile label="// WAITLIST QUEUE" value={stats.waitlisted} subtext="Auto-promotes on cancel" accent="yellow" />
        <StatTile label="// AVG CLUB NPS" value={stats.avgNps} subtext={`${feedbacks.length} rated member check-ins`} accent="red" />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["SCHEDULE", "NPS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "SCHEDULE" ? "TIMETABLE & BOOKINGS" : `MEMBER NPS FEEDBACK (${feedbacks.length})`}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bauhaus-label">{"// ROSTER & WAITLIST"}</span>
                    {canManage && (
                      <Button
                        variant={occupied.length >= s.capacity ? "yellow" : "primary"}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await bookMemberInClassAction({ sessionId: s.id, memberId: selectedBookMember });
                            if (!res.ok) {
                              setToast({ msg: res.error, tone: "red" });
                              return;
                            }
                            setToast({
                              msg: res.bookingStatus === "BOOKED" ? "Seat booked!" : `Added to waitlist #${res.waitlistPos}.`,
                              tone: "blue",
                            });
                            router.refresh();
                          });
                        }}
                      >
                        <UserPlus className="size-4" /> {occupied.length >= s.capacity ? "Join Waitlist" : "Book Member"}
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-[var(--border-ink)] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] max-h-48 overflow-y-auto">
                    {s.bookings.map((b) => (
                      <div key={b.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <div>
                          <span className="font-bold">{b.memberName}</span>{" "}
                          <span className="text-[12px] text-[var(--fg-grey)] font-tabular">({b.memberCode})</span>
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
                          <div className="flex items-center gap-1">
                            {b.status === "BOOKED" && (
                              <button
                                type="button"
                                onClick={() => startTransition(async () => {
                                  await updateClassBookingStatusAction({ bookingId: b.id, nextStatus: "CHECKED_IN" });
                                  router.refresh();
                                })}
                                className="border border-[#151515] bg-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold hover:bg-[#2B4BCC] hover:text-[#FFFFFF]"
                                title="Check In"
                              >
                                <Check className="size-3.5 inline" /> In
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startTransition(async () => {
                                const res = await updateClassBookingStatusAction({ bookingId: b.id, nextStatus: "CANCELLED" });
                                if (res.ok && res.promotedMemberName) {
                                  setToast({ msg: `Cancelled. Promoted ${res.promotedMemberName} from waitlist!`, tone: "blue" });
                                }
                                router.refresh();
                              })}
                              className="border border-[#151515] bg-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold text-[#C8372B] hover:bg-[#C8372B] hover:text-[#FFFFFF]"
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
                      {waitlist.length} waitlisted — auto-promotes immediately if a booked seat cancels.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
