"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck,
  Dumbbell, Eye, Loader2, MoreHorizontal, Pencil, SlidersHorizontal, Sparkles, Trophy, X, Zap,
} from "lucide-react";
import { sendCoachMessage } from "@/app/actions";
import {
  CATALOG_BY_ID,
  OPENGYM_CURATED_ROUTINES,
  OPENGYM_STARTER_PLANS,
  type CuratedTemplateRoutine,
} from "@/lib/opengym-catalog";
import {
  DEFAULT_PLAN_STATE,
  applyCuratedTemplateToPlan,
  loadPlanState,
  savePlanState,
  type PlanScheduleState,
} from "@/lib/plan-store";
import { cn, titleCase } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: number;
};

export interface CoachContextSnapshot {
  sessionsCount: number;
  setsCount: number;
  readiness: number;
  goal: string;
  experience: string;
  equipment: string[];
  lastWorkout: {
    id: string;
    name: string;
    focus: string;
    dateLabel: string;
    durationMin: number;
    totalVolume: number;
    setCount: number;
    prsCount: number;
    bestLifts: Array<{ name: string; weightKg: number; reps: number; e1rm: number }>;
  } | null;
  bodyPartSets: Array<{ part: string; sets: number }>;
}

interface CoachIntakeAnswers {
  goal: string;
  experience: string;
  daysPerWeek: number;
  sessionMin: number;
}

type LocalCardItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "plan"; template: CuratedTemplateRoutine; iteration: number }
  | { id: string; kind: "review"; suggestions: Array<{ id: string; title: string; before: string; after: string; why: string; accepted: boolean }> }
  | { id: string; kind: "debrief" };

const INTAKE_KEY = "forge_coach_intake_v1";
const COACH_SEES_KEY = "forge_coach_sees_v1";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-chalk">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function RichText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 pl-1">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-acid" />
            <span><Inline text={item} /></span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (numbered) {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-1 leading-relaxed">
          <span className="mr-1.5 font-mono text-[10px] text-acid">{numbered[1]}.</span>
          <Inline text={numbered[2]} />
        </p>,
      );
    } else if (bullet) {
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-1 leading-relaxed first:mt-0 last:mb-0">
          <Inline text={line} />
        </p>,
      );
    }
  }
  flush();

  return <div className="text-[13.5px] leading-relaxed text-chalk/90">{blocks}</div>;
}

export function CoachChat({
  initialMessages,
  user,
  context,
}: {
  initialMessages: ChatMessage[];
  user: { name: string; initials: string; accent: string };
  context: CoachContextSnapshot;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [localCards, setLocalCards] = useState<LocalCardItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Plan & Coach Intake state
  const [planState, setPlanState] = useState<PlanScheduleState>(DEFAULT_PLAN_STATE);
  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});
  const [importedPlanId, setImportedPlanId] = useState<string | null>(null);
  const [intake, setIntake] = useState<CoachIntakeAnswers>({
    goal: context.goal === "strength" ? "Get stronger" : "Build muscle",
    experience: context.experience === "beginner" ? "Starting out" : "Training regularly",
    daysPerWeek: 4,
    sessionMin: 60,
  });

  // Modals matching Coach ... Menu, Improve a routine, Edit answers, What Coach sees
  const [showMenu, setShowMenu] = useState(false);
  const [showPickRoutine, setShowPickRoutine] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showSeesModal, setShowSeesModal] = useState(false);
  const [seesPrefs, setSeesPrefs] = useState({
    bodyweight: true,
    recovery: true,
    nutrition: true,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const signature = initialMessages.map((m) => m.id).join("|");

  useEffect(() => {
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const ps = loadPlanState();
    setPlanState(ps);
    if (ps.activeProgrammeId) setImportedPlanId(ps.activeProgrammeId);
    try {
      const savedIntake = localStorage.getItem(INTAKE_KEY);
      if (savedIntake) setIntake(JSON.parse(savedIntake) as CoachIntakeAnswers);
      const savedSees = localStorage.getItem(COACH_SEES_KEY);
      if (savedSees) setSeesPrefs(JSON.parse(savedSees) as typeof seesPrefs);
    } catch {}
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, localCards, busy]);

  const activeTemplate = useMemo<CuratedTemplateRoutine>(() => {
    const all = [...OPENGYM_STARTER_PLANS, ...OPENGYM_CURATED_ROUTINES];
    const match = all.find(
      (p) =>
        (intake.goal.toLowerCase().includes("strong") ? p.goal === "strength" : p.goal === "hypertrophy") &&
        p.daysPerWeek <= Math.max(3, intake.daysPerWeek),
    );
    return match ?? OPENGYM_STARTER_PLANS[0];
  }, [intake]);

  function saveIntakeAnswers(next: CoachIntakeAnswers) {
    setIntake(next);
    try {
      localStorage.setItem(INTAKE_KEY, JSON.stringify(next));
    } catch {}
  }

  function handleImportPlan(template: CuratedTemplateRoutine) {
    const next = applyCuratedTemplateToPlan(planState, template);
    savePlanState(next);
    setPlanState(next);
    setImportedPlanId(template.id);
  }

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: localId, role: "user", content: value, createdAt: Date.now() },
    ]);
    setInput("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("content", value);
      await sendCoachMessage(fd);
      router.refresh();
    } finally {
      setBusy(false);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }

  function triggerReviewTraining() {
    const idBase = Date.now();
    setLocalCards((prev) => [
      ...prev,
      { id: `u-${idBase}`, kind: "user", text: "Have a look at my training and tell me what you would change." },
      {
        id: `rev-${idBase}`,
        kind: "review",
        suggestions: [
          {
            id: "sg-1",
            title: "Upper back balancing pull ratio",
            before: "2 weekly row slots",
            after: "3 weekly pull / face-pull slots",
            why: "Balances pressing volume from Bench & Overhead Press for healthier shoulders.",
            accepted: true,
          },
          {
            id: "sg-2",
            title: "Double progression target window",
            before: "Fixed 3×10",
            after: "3×8–12 RPE 8",
            why: `Readiness is ${context.readiness}/100 — clean rep ceiling lets you progress load once hitting 12s.`,
            accepted: true,
          },
        ],
      },
    ]);
  }

  function triggerLastWorkoutDebrief() {
    const idBase = Date.now();
    const lw = context.lastWorkout;
    setLocalCards((prev) => [
      ...prev,
      {
        id: `u-${idBase}`,
        kind: "user",
        text: lw ? `How did my ${lw.name} session go?` : "How did my last workout go?",
      },
      { id: `deb-${idBase}`, kind: "debrief" },
    ]);
  }

  function triggerNewPlan() {
    const idBase = Date.now();
    const pool = [...OPENGYM_STARTER_PLANS, ...OPENGYM_CURATED_ROUTINES];
    const nextT = pool[(pool.findIndex((p) => p.id === activeTemplate.id) + 1) % pool.length];
    setLocalCards((prev) => [
      ...prev,
      { id: `u-${idBase}`, kind: "user", text: "Build me a fresh plan from my answers." },
      { id: `pln-${idBase}`, kind: "plan", template: nextT, iteration: 2 },
    ]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const isMainPlanImported = importedPlanId === activeTemplate.id || planState.activeProgrammeId === activeTemplate.id;

  return (
    <div className="surface flex h-[min(78vh,760px)] min-h-[540px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0F12]">
      {/* Exact OpenGym Screenshot 3 Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#131417] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/app/programs"
            aria-label="Back to Plan"
            className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-chalk hover:bg-white/[0.12]"
          >
            <ChevronLeft className="size-4.5" />
          </Link>
          <span className="grid size-10 place-items-center rounded-full bg-[#A7EE2D] text-[#0C0F06] shadow-[0_0_24px_-6px_rgba(167,238,45,0.6)]">
            <Sparkles className="size-5 fill-current" />
          </span>
          <div>
            <p className="font-display text-[17px] font-bold leading-tight text-chalk">Coach</p>
            <p className={cn("text-[12px]", busy ? "text-[#A7EE2D]" : "text-mist")}>
              {busy ? "thinking…" : "here when you need it"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/form-check"
            className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-mist hover:text-chalk sm:inline-flex"
          >
            Form check
          </Link>
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            aria-label="Coach options menu"
            className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-chalk hover:bg-white/[0.12]"
          >
            <MoreHorizontal className="size-4.5" />
          </button>
        </div>
      </div>

      {/* Chat Thread */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {/* Opening Coach Greeting */}
        <div className="max-w-[88%] sm:max-w-[78%]">
          <div className="rounded-2xl rounded-tl-md bg-[#1C1E22] px-4 py-3 text-[13.5px] leading-relaxed text-chalk/95">
            Hi, I&apos;m your Coach. I build your plan from your answers and adjust it from what you actually log. Nothing changes until you say so.
          </div>
        </div>

        {/* Bright Lime-Green Intake Summary Bubble (Exact Screenshot 3 Match) */}
        <div className="flex justify-end">
          <div className="max-w-[84%] sm:max-w-[68%]">
            <div className="rounded-2xl rounded-tr-md bg-[#A7EE2D] px-4 py-3 text-[13.5px] leading-relaxed text-[#0C0F06]">
              <p className="font-medium">Here is what I am working with:</p>
              <ul className="mt-1 space-y-0.5 pl-1 font-medium">
                <li>• {intake.goal}</li>
                <li>• {intake.experience}</li>
                <li>• {intake.daysPerWeek} days a week</li>
                <li>• {intake.sessionMin} min per session</li>
              </ul>
            </div>
            <p className="mt-1 text-right font-mono text-[10px] text-dim">{user.name.split(" ")[0]} · Profile</p>
          </div>
        </div>

        {/* Confirmation Bubble */}
        <div className="max-w-[88%] sm:max-w-[78%]">
          <div className="rounded-2xl rounded-tl-md bg-[#1C1E22] px-4 py-3 text-[13.5px] leading-relaxed text-chalk/95">
            {isMainPlanImported
              ? `Imported! ${activeTemplate.sessions.length} routines are in your plan and your week is set. See you at the next session.`
              : `Built your ${activeTemplate.name} plan (${activeTemplate.sessions.length} sessions/week). Inspect below or import straight into your schedule.`}
          </div>
        </div>

        {/* Embedded Interactive PLAN Card (Screenshot 3 Match) */}
        <PlanProposalCard
          template={activeTemplate}
          imported={isMainPlanImported}
          expanded={Boolean(expandedPlanIds.initial)}
          onToggleExpand={() => setExpandedPlanIds((p) => ({ ...p, initial: !p.initial }))}
          onImport={() => handleImportPlan(activeTemplate)}
        />

        {/* Persisted SQLite Conversation */}
        {messages.map((m) => {
          const isCoach = m.role === "coach";
          return (
            <div key={m.id} className={cn("flex", !isCoach && "justify-end")}>
              <div className={cn("max-w-[88%] sm:max-w-[78%]", !isCoach && "text-right")}>
                <div
                  className={cn(
                    "inline-block rounded-2xl px-4 py-3 text-left",
                    isCoach
                      ? "rounded-tl-md bg-[#1C1E22] text-chalk/95"
                      : "rounded-tr-md bg-[#A7EE2D] text-[#0C0F06] font-medium",
                  )}
                >
                  {isCoach ? (
                    <RichText content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.content}</p>
                  )}
                </div>
                <p className="mt-1 font-mono text-[10px] text-dim" suppressHydrationWarning>
                  {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </p>
              </div>
            </div>
          );
        })}

        {/* Local Interactive Action Cards (Review, Debrief, Fresh Plan) */}
        {localCards.map((item) => {
          if (item.kind === "user") {
            return (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[#A7EE2D] px-4 py-3 text-[13.5px] font-medium text-[#0C0F06]">
                  {item.text}
                </div>
              </div>
            );
          }
          if (item.kind === "plan") {
            const imp = importedPlanId === item.template.id || planState.activeProgrammeId === item.template.id;
            return (
              <PlanProposalCard
                key={item.id}
                template={item.template}
                imported={imp}
                iteration={item.iteration}
                expanded={Boolean(expandedPlanIds[item.id])}
                onToggleExpand={() => setExpandedPlanIds((p) => ({ ...p, [item.id]: !p[item.id] }))}
                onImport={() => handleImportPlan(item.template)}
              />
            );
          }
          if (item.kind === "debrief") {
            const lw = context.lastWorkout;
            return (
              <div key={item.id} className="w-full rounded-2xl border border-white/[0.08] bg-[#181A1E] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#A7EE2D]">Workout debrief</span>
                    <h4 className="mt-0.5 font-display text-lg font-bold text-chalk">
                      {lw ? `${lw.name} · ${lw.dateLabel}` : "No completed session yet"}
                    </h4>
                  </div>
                  <span className="rounded-full bg-[#3A6B35]/65 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#C8F5BA]">
                    Readiness {context.readiness}/100
                  </span>
                </div>
                {lw ? (
                  <>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { l: "Sets", v: String(lw.setCount) },
                        { l: "Min", v: String(lw.durationMin) },
                        { l: "Vol (kg)", v: lw.totalVolume.toLocaleString("en-US") },
                        { l: "PRs", v: String(lw.prsCount) },
                      ].map((t) => (
                        <div key={t.l} className="rounded-xl bg-white/[0.03] p-2">
                          <p className="font-display text-base font-bold text-chalk">{t.v}</p>
                          <p className="font-mono text-[9.5px] text-dim">{t.l}</p>
                        </div>
                      ))}
                    </div>
                    {lw.bestLifts.length > 0 && (
                      <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-mist">Best set · Estimated 1RM</p>
                        {lw.bestLifts.map((lift) => (
                          <div key={lift.name} className="flex items-center justify-between text-xs">
                            <span className="text-chalk">{lift.name} <span className="text-dim">{lift.weightKg}×{lift.reps}</span></span>
                            <span className="rounded-md bg-[#A7EE2D]/15 px-2 py-0.5 font-numeric font-semibold text-[#A7EE2D]">
                              {lift.e1rm} kg
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-mist">Log your first completed workout and I&apos;ll break down volume, pace, and PR deltas here.</p>
                )}
              </div>
            );
          }

          const maxBp = Math.max(1, ...context.bodyPartSets.map((b) => b.sets));
          return (
            <div key={item.id} className="w-full rounded-2xl border border-white/[0.08] bg-[#181A1E] p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#A7EE2D]">Training review</span>
                  <h4 className="font-display text-lg font-bold text-chalk">
                    Based on {context.sessionsCount} sessions &amp; {context.setsCount} logged sets
                  </h4>
                </div>
              </div>

              {context.bodyPartSets.length > 0 && (
                <div className="space-y-1.5 rounded-xl bg-white/[0.02] p-3">
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-mist">Work sets by muscle group</p>
                  {context.bodyPartSets.map((b) => (
                    <div key={b.part} className="flex items-center gap-2.5 text-xs">
                      <span className="w-24 truncate text-mist">{titleCase(b.part)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-[#A7EE2D]" style={{ width: `${Math.max(6, Math.round((b.sets / maxBp) * 100))}%` }} />
                      </div>
                      <span className="w-8 text-right font-numeric text-chalk">{b.sets}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {item.suggestions.map((sg) => (
                  <div key={sg.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div>
                      <p className="text-xs font-semibold text-chalk">{sg.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-mist">{sg.before}</span>
                        <span className="text-dim">→</span>
                        <span className="rounded bg-[#A7EE2D]/15 px-1.5 py-0.5 text-[#A7EE2D]">{sg.after}</span>
                      </p>
                      <p className="mt-1.5 text-[11.5px] text-mist">{sg.why}</p>
                    </div>
                    <CheckCircle2 className="size-4 shrink-0 text-[#A7EE2D]" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="max-w-[60%]">
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-[#1C1E22] px-4 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-[#A7EE2D] [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[#A7EE2D] [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[#A7EE2D]" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Quick Chips + Pill Composer (Screenshot 3 Match) */}
      <div className="border-t border-white/[0.06] bg-[#131417] px-3.5 pb-3.5 pt-3">
        <div className="mb-2.5 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={triggerReviewTraining}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1E22] px-3 py-1.5 text-[12px] font-medium text-chalk transition hover:border-[#A7EE2D]/50 hover:text-[#A7EE2D]"
          >
            <Sparkles className="size-3.5 text-mist" /> Review my training
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={triggerLastWorkoutDebrief}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1E22] px-3 py-1.5 text-[12px] font-medium text-chalk transition hover:border-[#A7EE2D]/50 hover:text-[#A7EE2D]"
          >
            <CheckCircle2 className="size-3.5 text-mist" /> Last workout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPickRoutine(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-[#1C1E22] px-3 py-1.5 text-[12px] font-medium text-chalk transition hover:border-[#A7EE2D]/50 hover:text-[#A7EE2D]"
          >
            <Pencil className="size-3.5 text-mist" /> Improve a routine
          </button>
        </div>

        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/[0.10] bg-[#1B1D21] px-4 py-2 focus-within:border-[#A7EE2D]/50">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={800}
              placeholder="Message the Coach…"
              className="max-h-24 min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-[13.5px] leading-snug text-chalk placeholder:text-dim focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#A7EE2D]/30 text-[#A7EE2D] transition-all hover:bg-[#A7EE2D] hover:text-[#0C0F06] disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
      </div>

      {/* Coach ... Options Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <button className="absolute inset-0" onClick={() => setShowMenu(false)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md space-y-2 rounded-3xl border border-white/12 bg-panel p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-chalk">Coach</h3>
              <button onClick={() => setShowMenu(false)} className="rounded-full bg-panel-2 p-1.5 text-mist"><X className="size-4" /></button>
            </div>
            {[
              { title: "Ask for a review", sub: "What would the Coach change after your last sessions?", icon: Sparkles, fn: () => { setShowMenu(false); triggerReviewTraining(); } },
              { title: "Review my last workout", sub: "What went well, what to watch, what to do next time", icon: CheckCircle2, fn: () => { setShowMenu(false); triggerLastWorkoutDebrief(); } },
              { title: "Improve a routine", sub: "Pick one; the Coach refines order, sets, and progression", icon: Pencil, fn: () => { setShowMenu(false); setShowPickRoutine(true); } },
              { title: "Start a new plan", sub: "Generate a fresh split from your answers", icon: ClipboardCheck, fn: () => { setShowMenu(false); triggerNewPlan(); } },
              { title: "Edit my answers", sub: "Goal, days per week, session duration, limits", icon: SlidersHorizontal, fn: () => { setShowMenu(false); setShowIntakeModal(true); } },
              { title: "What the Coach sees", sub: "Control which body/recovery/nutrition data is shared", icon: Eye, fn: () => { setShowMenu(false); setShowSeesModal(true); } },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.title}
                  type="button"
                  onClick={row.fn}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-panel-2 p-3 text-left transition hover:border-[#A7EE2D]/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[#A7EE2D]">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-chalk">{row.title}</p>
                    <p className="truncate text-[11px] text-dim">{row.sub}</p>
                  </div>
                  <ChevronRight className="size-4 text-dim" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pick Routine to Improve Modal */}
      {showPickRoutine && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <button className="absolute inset-0" onClick={() => setShowPickRoutine(false)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md space-y-2.5 rounded-3xl border border-white/12 bg-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-chalk">Improve which routine?</h3>
              <button onClick={() => setShowPickRoutine(false)} className="rounded-full bg-panel-2 p-1.5 text-mist"><X className="size-4" /></button>
            </div>
            {planState.routines.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setShowPickRoutine(false);
                  void send(`Focus only on my routine "${r.name}". Improve exercise choice, order, sets and rep ranges.`);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-panel-2 p-3 text-left hover:border-[#A7EE2D]/40"
              >
                <div>
                  <p className="text-sm font-semibold text-chalk">{r.name}</p>
                  <p className="text-xs text-mist">{r.slots.length} exercises</p>
                </div>
                <ChevronRight className="size-4 text-dim" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Coach Intake Answers Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <button className="absolute inset-0" onClick={() => setShowIntakeModal(false)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-white/12 bg-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-chalk">Coach Intake Profile</h3>
              <button onClick={() => setShowIntakeModal(false)} className="rounded-full bg-panel-2 p-1.5 text-mist"><X className="size-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="mb-1.5 font-mono uppercase text-dim">Primary Goal</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Build muscle", "Get stronger", "Lose fat", "Athletic power"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => saveIntakeAnswers({ ...intake, goal: g })}
                      className={cn("rounded-xl border px-3 py-2 font-medium", intake.goal === g ? "border-[#A7EE2D] bg-[#A7EE2D]/15 text-[#A7EE2D]" : "border-white/10 bg-panel-2 text-mist")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono uppercase text-dim">Days / week</label>
                  <input
                    type="number"
                    min="2"
                    max="7"
                    value={intake.daysPerWeek}
                    onChange={(e) => saveIntakeAnswers({ ...intake, daysPerWeek: Math.max(2, Math.min(7, Number(e.target.value) || 4)) })}
                    className="h-9 w-full rounded-xl border border-white/10 bg-panel-2 px-3 font-numeric text-chalk"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono uppercase text-dim">Minutes / session</label>
                  <input
                    type="number"
                    min="20"
                    max="150"
                    step="5"
                    value={intake.sessionMin}
                    onChange={(e) => saveIntakeAnswers({ ...intake, sessionMin: Math.max(20, Math.min(150, Number(e.target.value) || 60)) })}
                    className="h-9 w-full rounded-xl border border-white/10 bg-panel-2 px-3 font-numeric text-chalk"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIntakeModal(false)}
              className="w-full rounded-full bg-[#A7EE2D] py-2.5 text-sm font-semibold text-[#0C0F06]"
            >
              Update Coach answers
            </button>
          </div>
        </div>
      )}

      {/* What the Coach Sees Modal */}
      {showSeesModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <button className="absolute inset-0" onClick={() => setShowSeesModal(false)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md space-y-3 rounded-3xl border border-white/12 bg-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-chalk">What the Coach sees</h3>
              <button onClick={() => setShowSeesModal(false)} className="rounded-full bg-panel-2 p-1.5 text-mist"><X className="size-4" /></button>
            </div>
            <p className="text-xs text-mist">Always shared: your planned routines, logged sets &amp; PRs, and equipment list.</p>
            {(
              [
                { k: "bodyweight", label: "Bodyweight & measurements" },
                { k: "recovery", label: "Sleep, HRV & readiness scores" },
                { k: "nutrition", label: "Calorie & protein targets" },
              ] as const
            ).map((opt) => (
              <label key={opt.k} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-panel-2 px-3.5 py-2.5 text-xs text-chalk">
                <span>{opt.label}</span>
                <input
                  type="checkbox"
                  checked={seesPrefs[opt.k]}
                  onChange={() => {
                    const next = { ...seesPrefs, [opt.k]: !seesPrefs[opt.k] };
                    setSeesPrefs(next);
                    try { localStorage.setItem(COACH_SEES_KEY, JSON.stringify(next)); } catch {}
                  }}
                  className="size-4 accent-[#A7EE2D]"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── EMBEDDED PLAN CARD (Screenshot 3) ───────────────────── */

function PlanProposalCard({
  template,
  imported,
  iteration,
  expanded,
  onToggleExpand,
  onImport,
}: {
  template: CuratedTemplateRoutine;
  imported: boolean;
  iteration?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onImport: () => void;
}) {
  const [routineTab, setRoutineTab] = useState(0);
  const daysSet = useMemo(() => new Set(template.sessions.map((s) => s.weekday ?? 1)), [template.sessions]);
  const r = template.sessions[Math.min(routineTab, template.sessions.length - 1)];

  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-[#1C1E22] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
            {iteration && iteration > 1 ? `REVISION ${iteration}` : "PLAN"}
          </span>
          <h3 className="mt-0.5 font-display text-lg font-bold text-chalk">
            {template.name || "Coach plan"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onImport}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold transition",
            imported
              ? "bg-[#3A6B35]/70 text-[#C8F5BA]"
              : "bg-[#A7EE2D] text-[#0C0F06] hover:brightness-110",
          )}
        >
          {imported ? "Imported" : "Import plan"}
        </button>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-mist">
        {template.description}
      </p>

      <button
        type="button"
        onClick={onToggleExpand}
        className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#A7EE2D] hover:underline"
      >
        {expanded ? "Hide details" : "Show everything"} <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.07] pt-3">
          {/* Week day strip Mo..Su */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
            {[
              { d: 1, l: "Mo" },
              { d: 2, l: "Tu" },
              { d: 3, l: "We" },
              { d: 4, l: "Th" },
              { d: 5, l: "Fr" },
              { d: 6, l: "Sa" },
              { d: 0, l: "Su" },
            ].map((day) => (
              <div
                key={day.l}
                className={cn(
                  "rounded-lg py-1 font-semibold",
                  daysSet.has(day.d) ? "bg-[#A7EE2D]/18 text-[#A7EE2D]" : "bg-white/[0.03] text-dim",
                )}
              >
                {day.l}
              </div>
            ))}
          </div>

          {/* Routine tabs */}
          {template.sessions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {template.sessions.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setRoutineTab(idx)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                    routineTab === idx ? "bg-[#A7EE2D] text-[#0C0F06]" : "bg-white/[0.05] text-mist",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {r && (
            <div className="space-y-1.5 rounded-xl bg-white/[0.02] p-3">
              {r.exercises.map((slot, idx) => (
                <div key={`${slot.exerciseId}-${idx}`} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-chalk">
                    {CATALOG_BY_ID.get(slot.exerciseId)?.name ?? titleCase(slot.exerciseId.replace(/^ex-|^og-/, "").replace(/-/g, " "))}
                  </span>
                  <span className="font-mono text-[11px] text-mist">
                    {slot.sets}×{slot.repsMin === slot.repsMax ? slot.repsMin : `${slot.repsMin}–${slot.repsMax}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
