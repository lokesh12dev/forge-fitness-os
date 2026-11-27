"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity, ArrowDown, ArrowUp, ArrowUpRight, Calendar, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Dumbbell, Flame, Moon,
  Play, Plus, QrCode, RefreshCw, Scale, Settings, Snowflake, Sparkles, Target,
  Trophy, Users, Utensils, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLAN_STATE,
  computeWeekTally,
  getScheduledRoutinesForDate,
  loadPlanState,
  savePlanState,
  type PlanRoutine,
  type PlanScheduleState,
} from "@/lib/plan-store";
import { computeRoutineMuscleLoad } from "@/lib/opengym-catalog";
import { quickLogWeight, startRoutineWorkout } from "@/app/actions";
import { DualMiniBodyMap } from "@/components/body-map";
import { ReadinessCheckInModal } from "@/components/readiness-checkin";

export type HomeClientProps = {
  userName: string;
  userInitials: string;
  todayIso: string;
  todayHeaderLabel: string;
  monthLabel: string;
  activeWorkout: {
    id: string;
    name: string;
    focus: string;
    startedAt: string;
    totalVolume: number;
    totalSets: number;
  } | null;
  completedDateIsos: string[];
  monthlyWorkoutsDone: number;
  monthlyPrsDone: number;
  monthlyUniqueExercisesDone: number;
  weightKg: number;
  weightDelta: number | null;
  weightPoints: { date: string; value: number }[];
  streakDays: number;
  totalWorkouts: number;
  readiness: number;
  readinessAdvice: string;
  sleepHours: number;
  hrv: number;
  restingHr: number;
  soreness: number;
  recoveryHintTitle: string;
  recoveryHintSub: string;
  caloriesConsumed: number;
  caloriesTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
};

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getWeekdayMon0(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const raw = dt.getUTCDay();
  return raw === 0 ? 6 : raw - 1;
}

function getRawWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function HomeClient(props: HomeClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<PlanScheduleState>(DEFAULT_PLAN_STATE);
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals & card toggles
  const [overrideIso, setOverrideIso] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState(String(props.weightKg));
  const [challengesFolded, setChallengesFolded] = useState(false);
  const [challengesHidden, setChallengesHidden] = useState(false);

  useEffect(() => {
    setPlan(loadPlanState());
  }, []);

  const updatePlan = (fn: (prev: PlanScheduleState) => PlanScheduleState) => {
    setPlan((prev) => {
      const next = fn(prev);
      savePlanState(next);
      return next;
    });
  };

  const completedSet = useMemo(() => new Set(props.completedDateIsos), [props.completedDateIsos]);

  const weekDays = useMemo(() => {
    const monOffset = getWeekdayMon0(props.todayIso);
    const mondayIso = addDaysIso(props.todayIso, -monOffset + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDaysIso(mondayIso, i);
      const rawDow = getRawWeekday(iso);
      const dayNum = Number(iso.split("-")[2]);
      const rs = getScheduledRoutinesForDate(plan, iso, rawDow);
      return {
        iso,
        rawDow,
        dayLabel: DAYS_SHORT[rawDow],
        dayNum,
        isToday: iso === props.todayIso,
        done: completedSet.has(iso),
        planned: rs.length > 0,
        routines: rs,
      };
    });
  }, [props.todayIso, weekOffset, plan, completedSet]);

  const weekRangeLabel = useMemo(() => {
    if (weekOffset === 0) return "This week";
    const first = weekDays[0]?.iso.slice(5);
    const last = weekDays[6]?.iso.slice(5);
    return `${first} – ${last}`;
  }, [weekOffset, weekDays]);

  const tally = useMemo(
    () =>
      computeWeekTally(
        plan,
        weekDays.map((w) => ({ iso: w.iso, weekday: w.rawDow })),
        completedSet,
      ),
    [plan, weekDays, completedSet],
  );

  const todayRawDow = getRawWeekday(props.todayIso);
  const todayRoutines = useMemo(
    () => getScheduledRoutinesForDate(plan, props.todayIso, todayRawDow),
    [plan, props.todayIso, todayRawDow],
  );
  const doneToday = completedSet.has(props.todayIso);
  const todayLoad = useMemo(
    () => computeRoutineMuscleLoad(todayRoutines.flatMap((r) => r.slots.map((s) => s.exerciseId))),
    [todayRoutines],
  );

  const handleStartToday = () => {
    if (props.activeWorkout) {
      router.push(`/app/train/${props.activeWorkout.id}`);
      return;
    }
    if (!todayRoutines.length) {
      setPickerOpen(true);
      return;
    }
    handleLaunchRoutines(todayRoutines);
  };

  const handleLaunchRoutines = (routines: PlanRoutine[]) => {
    startTransition(async () => {
      const res = await startRoutineWorkout({
        name: routines.map((r) => r.name).join(" + ") || "Freestyle Workout",
        focus: routines[0]?.folder ?? "Strength",
        routineId: routines[0]?.id,
        slots: routines.flatMap((r) => r.slots),
      });
      if (res.ok) router.push(`/app/train/${res.workoutId}`);
    });
  };

  const handleLaunchFreestyle = () => {
    startTransition(async () => {
      const res = await startRoutineWorkout({
        name: "Freestyle Workout",
        focus: "Full Body",
        slots: [
          { exerciseId: "ex-bench-press", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { exerciseId: "ex-barbell-row", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { exerciseId: "ex-back-squat", sets: 3, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8 },
        ],
      });
      if (res.ok) router.push(`/app/train/${res.workoutId}`);
    });
  };

  const handleSaveWeight = () => {
    const val = Number(weightInput);
    if (!Number.isFinite(val) || val < 30 || val > 250) return;
    startTransition(async () => {
      const res = await quickLogWeight(val);
      if (res.ok) {
        setWeightModalOpen(false);
        router.refresh();
      }
    });
  };

  const challenges = [
    {
      id: "workouts",
      title: "13 workouts this month",
      value: props.monthlyWorkoutsDone,
      target: 13,
      unit: "",
      icon: Dumbbell,
    },
    {
      id: "prs",
      title: "Hit 12 new PRs",
      value: props.monthlyPrsDone,
      target: 12,
      unit: "",
      icon: Trophy,
    },
    {
      id: "explore",
      title: "Try 3 new exercises",
      value: props.monthlyUniqueExercisesDone,
      target: 3,
      unit: "",
      icon: Sparkles,
    },
  ];
  const challengesDoneCount = challenges.filter((c) => c.value >= c.target).length;
  const weekStreak = Math.max(1, Math.floor(props.streakDays / 3));

  // Build crisp SVG sparkline for Body Weight
  const bwSvgPath = useMemo(() => {
    const pts = props.weightPoints.slice(-14);
    if (pts.length < 2) return "";
    const vals = pts.map((p) => p.value);
    const min = Math.min(...vals) - 0.5;
    const max = Math.max(...vals) + 0.5;
    const range = max - min || 1;
    return pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * 280;
        const y = 52 - ((p.value - min) / range) * 44;
        return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [props.weightPoints]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header matching openGym/#/home */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] sm:text-[32px] font-semibold leading-tight tracking-tight text-chalk">
            FORGE
          </h1>
          <p className="mt-0.5 truncate text-[13.5px] sm:text-[14.5px] text-mist">{props.todayHeaderLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setCheckinModalOpen(true)}
            className="press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-panel-2 px-3 py-1.5 text-[12.5px] font-medium text-chalk hover:bg-panel-3 sm:px-3.5 sm:py-2 sm:text-[13px]"
          >
            <Activity className="size-3.5 text-acid" />
            <span>Readiness {props.readiness}</span>
          </button>
          <Link
            href="/app/settings"
            aria-label="Settings"
            className="press grid size-9 shrink-0 place-items-center rounded-full bg-panel-2 text-mist hover:text-chalk"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>

      {/* HERO CARD 1: This Week Calendar + Today Workout (Direct openGym Home layout) */}
      <div className="rounded-[22px] border border-white/[0.08] bg-panel p-4 sm:p-5">
        {/* < This week > */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Previous week"
            className="grid size-8 place-items-center rounded-full text-mist hover:bg-panel-2 hover:text-chalk"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-[13.5px] font-medium text-mist">{weekRangeLabel}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Next week"
            className="grid size-8 place-items-center rounded-full text-mist hover:bg-panel-2 hover:text-chalk"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* 7-day Calendar Strip */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setOverrideIso(d.iso)}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-[12px] text-mist">{d.dayLabel}</span>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full font-numeric text-[14.5px] font-semibold transition-colors",
                  d.isToday ? "bg-acid text-ink" : "text-chalk",
                )}
              >
                {d.dayNum}
              </span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  d.done ? "bg-mint" : d.planned ? "bg-mist/60" : "bg-transparent",
                )}
              />
            </button>
          ))}
        </div>

        <p className="mt-2 text-center text-[12.5px] text-mist">
          {tally.left > 0
            ? `${tally.left} of ${tally.planned} left this week`
            : "All done this week. Nice."}
        </p>

        {/* Embedded Today Session Card matching screenshot */}
        <div
          onClick={handleStartToday}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleStartToday()}
          className="press mt-3.5 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-panel-2 px-3.5 py-3 hover:border-white/15"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                props.activeWorkout
                  ? "bg-flame text-ink"
                  : doneToday
                    ? "bg-panel-3 text-mint"
                    : todayRoutines.length
                      ? "bg-acid text-ink"
                      : "bg-panel-3 text-mist",
              )}
            >
              {props.activeWorkout ? (
                <Play className="ml-0.5 size-4.5 fill-current" />
              ) : doneToday ? (
                <CheckCircle2 className="size-5" />
              ) : todayRoutines.length ? (
                <Dumbbell className="size-4.5" />
              ) : (
                <Moon className="size-4.5" />
              )}
            </span>

            <div className="min-w-0">
              <p className="text-[12px] text-mist">Today</p>
              <p className="truncate text-[16px] font-semibold text-chalk">
                {props.activeWorkout
                  ? `${props.activeWorkout.name} (in progress)`
                  : doneToday
                    ? "Session completed"
                    : todayRoutines.length
                      ? todayRoutines.map((r) => r.name).join(" + ")
                      : "Rest day"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {!props.activeWorkout && !doneToday && todayRoutines.length > 0 && (
              <DualMiniBodyMap load={todayLoad} heightClass="h-9" />
            )}
            <span
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-[13px] font-semibold",
                props.activeWorkout
                  ? "bg-flame/20 text-flame"
                  : doneToday
                    ? "bg-mint/18 text-mint"
                    : todayRoutines.length
                      ? "bg-acid text-ink"
                      : "bg-panel-3 text-chalk",
              )}
            >
              {props.activeWorkout ? "Resume" : doneToday ? "Done" : todayRoutines.length ? "Start" : "Plan"}
            </span>
          </div>
        </div>

        {/* Choose a different workout link */}
        {!props.activeWorkout && (
          <div className="mt-2.5 flex justify-center">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium text-mist hover:text-chalk"
            >
              <RefreshCw className="size-3.5" />
              Choose a different workout
            </button>
          </div>
        )}
      </div>

      {/* CARD 2: Smart Recovery & Readiness Hint */}
      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/[0.08] bg-panel px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-acid text-ink">
            <Sparkles className="size-4.5" />
          </span>
          <div>
            <p className="text-[12px] text-mist">Recovery</p>
            <p className="text-[15.5px] font-semibold leading-snug text-chalk">{props.recoveryHintTitle}</p>
            <p className="mt-0.5 text-[13px] text-mist">{props.recoveryHintSub}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCheckinModalOpen(true)}
          className="shrink-0 rounded-full bg-panel-2 px-3 py-1.5 text-[12px] font-medium text-mist hover:text-chalk"
        >
          Check in
        </button>
      </div>

      {/* CARD 3: This month's challenges (Exact screenshot layout) */}
      {!challengesHidden && (
        <div className="rounded-[22px] border border-white/[0.08] bg-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-flame text-ink">
                <Target className="size-4.5" />
              </span>
              <div>
                <p className="text-[12.5px] text-mist">
                  {props.monthLabel} · {challengesDoneCount} of {challenges.length} done
                </p>
                <h2 className="text-[17px] font-semibold text-chalk">This month&apos;s challenges</h2>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setChallengesFolded((v) => !v)}
                aria-label="Collapse challenges"
                className="grid size-7 place-items-center rounded-full text-mist hover:bg-panel-2"
              >
                {challengesFolded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setChallengesHidden(true)}
                aria-label="Hide challenges"
                className="grid size-7 place-items-center rounded-full text-mist hover:bg-panel-2"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {!challengesFolded && (
            <div className="mt-4 space-y-3.5">
              {challenges.map((c) => {
                const Icon = c.icon;
                const done = c.value >= c.target;
                const pct = Math.min(100, Math.round((c.value / c.target) * 100));
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full",
                        done ? "bg-mint/18 text-mint" : "bg-panel-2 text-mist",
                      )}
                    >
                      {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                        <span className="truncate font-medium text-chalk">{c.title}</span>
                        <span className={cn("font-numeric text-[13px] font-medium", done ? "text-mint" : "text-mist")}>
                          {done ? `✓ ${c.value} / ${c.target}` : `${c.value} / ${c.target}`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
                        <div
                          className={cn("h-full rounded-full transition-all", done ? "bg-mint" : "bg-flame")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CARD 4: At the gym · Check in (Direct screenshot row) */}
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setQrModalOpen(true)}
          className="press flex items-center justify-between rounded-[22px] border border-white/[0.08] bg-panel p-4 text-left hover:bg-panel-2"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky text-white">
              <QrCode className="size-5" />
            </span>
            <div>
              <p className="text-[12px] text-mist">At the gym</p>
              <p className="text-[16px] font-semibold text-chalk">Check in</p>
            </div>
          </div>
          <ChevronRight className="size-4.5 text-dim" />
        </button>

        {/* Week streak + Freezes */}
        <Link
          href="/app/progress"
          className="press flex items-center justify-between rounded-[22px] border border-white/[0.08] bg-panel p-4 hover:bg-panel-2"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-flame/16 text-flame">
              <Flame className="size-5" />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-chalk">{weekStreak} week streak</p>
              <p className="flex items-center gap-1.5 text-[12.5px] text-mist">
                <span>{tally.done}/{Math.max(1, tally.planned)} this week · {props.totalWorkouts} total</span>
                <span className="inline-flex items-center text-sky">
                  <Snowflake className="size-3.5" />
                  <Snowflake className="size-3.5" />
                </span>
              </p>
            </div>
          </div>
          <ChevronRight className="size-4.5 text-dim" />
        </Link>
      </div>

      {/* CARD 5: Body Weight quick tracker (+ Log) */}
      <div className="rounded-[22px] border border-white/[0.08] bg-panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-400/20 text-teal-300">
              <Scale className="size-4.5" />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-chalk">Body weight</p>
              <div className="flex items-baseline gap-2">
                <span className="font-numeric text-[24px] font-semibold text-chalk">{props.weightKg.toFixed(1)} kg</span>
                {props.weightDelta !== null && props.weightDelta !== 0 && (
                  <span className={cn("inline-flex items-center gap-0.5 font-numeric text-[12.5px] font-medium", props.weightDelta < 0 ? "text-mint" : "text-flame")}>
                    {props.weightDelta < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                    {Math.abs(props.weightDelta).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setWeightInput(String(props.weightKg));
              setWeightModalOpen(true);
            }}
            className="press inline-flex items-center gap-1 rounded-full bg-panel-2 px-3.5 py-1.5 text-[13px] font-medium text-chalk hover:bg-panel-3"
          >
            <Plus className="size-3.5" /> Log
          </button>
        </div>

        {bwSvgPath && (
          <div className="mt-3">
            <svg viewBox="0 0 280 56" className="h-14 w-full overflow-visible">
              <path d={bwSvgPath} fill="none" stroke="#30d158" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Clean Unified Suite Tiles (OpenNutriTracker, advice.fit, laragym/gymsmart, Social) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/nutrition" className="rounded-[20px] border border-white/[0.07] bg-panel p-4 hover:bg-panel-2">
          <div className="flex items-center justify-between text-mist">
            <span className="text-[12px]">Nutrition</span>
            <Utensils className="size-4 text-acid" />
          </div>
          <p className="mt-1.5 font-numeric text-[18px] font-semibold text-chalk">{props.proteinConsumed} / {props.proteinTarget}g</p>
          <p className="text-[12px] text-mist">{props.caloriesConsumed} / {props.caloriesTarget} kcal</p>
        </Link>

        <Link href="/app/coach" className="rounded-[20px] border border-white/[0.07] bg-panel p-4 hover:bg-panel-2">
          <div className="flex items-center justify-between text-mist">
            <span className="text-[12px]">AI Coach</span>
            <Sparkles className="size-4 text-acid" />
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-chalk">Adaptive Check-in</p>
          <p className="truncate text-[12px] text-mist">{props.readinessAdvice}</p>
        </Link>

        <Link href="/app/gym" className="rounded-[20px] border border-white/[0.07] bg-panel p-4 hover:bg-panel-2">
          <div className="flex items-center justify-between text-mist">
            <span className="text-[12px]">Gym Floor</span>
            <QrCode className="size-4 text-sky" />
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-chalk">QR Check-in & Ops</p>
          <p className="text-[12px] text-mist">Turnstile & renewals</p>
        </Link>

        <Link href="/app/trainer" className="rounded-[20px] border border-white/[0.07] bg-panel p-4 hover:bg-panel-2">
          <div className="flex items-center justify-between text-mist">
            <span className="text-[12px]">Trainer Portal</span>
            <Users className="size-4 text-mint" />
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-chalk">Athletes & Cohorts</p>
          <p className="text-[12px] text-mist">Batch prescribe & compare</p>
        </Link>
      </div>

      {/* Day Override Modal when tapping any day on the weekly strip */}
      {overrideIso && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-chalk">Schedule for {overrideIso}</h3>
                <p className="text-[12.5px] text-mist">Override just this day without changing your weekly routine.</p>
              </div>
              <button type="button" onClick={() => setOverrideIso(null)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[55vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  updatePlan((p) => ({ ...p, dayOverrides: { ...p.dayOverrides, [overrideIso]: "rest" } }));
                  setOverrideIso(null);
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 p-3 text-left hover:bg-panel-3"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-panel text-mist"><Moon className="size-4" /></span>
                <span className="text-[14.5px] font-medium text-chalk">Take a rest day</span>
              </button>
              {plan.routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    updatePlan((p) => ({ ...p, dayOverrides: { ...p.dayOverrides, [overrideIso]: [r.id] } }));
                    setOverrideIso(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 p-3 text-left hover:bg-panel-3"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-panel text-acid"><Dumbbell className="size-4" /></span>
                  <div className="flex-1">
                    <p className="text-[14.5px] font-medium text-chalk">{r.name}</p>
                    <p className="text-[12px] text-mist">{r.slots.length} exercises</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Choose a Different Workout Sheet */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Start a workout</h3>
              <button type="button" onClick={() => setPickerOpen(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPickerOpen(false);
                  handleLaunchFreestyle();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-acid/30 bg-acid/10 p-3.5 text-left"
              >
                <div>
                  <p className="text-[15px] font-semibold text-chalk">Freestyle workout</p>
                  <p className="text-[12px] text-mist">Open empty logger & add any movements</p>
                </div>
                <Play className="size-4 fill-current text-acid" />
              </button>
              {plan.routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPickerOpen(false);
                    handleLaunchRoutines([r]);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-panel-2 p-3.5 text-left hover:bg-panel-3"
                >
                  <div>
                    <p className="text-[15px] font-medium text-chalk">{r.name}</p>
                    <p className="text-[12px] text-mist">{r.slots.length} exercises · {r.folder}</p>
                  </div>
                  <Play className="size-4 text-acid" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Log Weight Modal */}
      {weightModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Log body weight</h3>
              <button type="button" onClick={() => setWeightModalOpen(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="flex-1 rounded-2xl bg-panel-2 px-4 py-3 font-numeric text-2xl font-semibold text-chalk focus:outline-none"
              />
              <span className="text-lg font-medium text-mist">kg</span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={handleSaveWeight}
              className="press mt-4 w-full rounded-full bg-acid py-2.5 text-[14px] font-semibold text-ink disabled:opacity-60"
            >
              Save weigh-in
            </button>
          </div>
        </div>
      )}

      {/* Quick QR Check-In Pass Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-panel p-6 text-center sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Gym Check-in Pass</h3>
              <button type="button" onClick={() => setQrModalOpen(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mx-auto mt-5 flex size-44 flex-col items-center justify-center rounded-2xl bg-white p-3 text-ink">
              <QrCode className="size-28 stroke-[1.5]" />
              <span className="mt-1 font-mono text-[11px] font-bold">FRG-1001 · ACTIVE</span>
            </div>
            <p className="mt-3 text-[13px] text-mist">Scan at the gym turnstile for instant check-in.</p>
            <Link
              href="/app/gym"
              onClick={() => setQrModalOpen(false)}
              className="press mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-sky py-2.5 text-[13.5px] font-semibold text-white"
            >
              Open Gym Turnstile Simulator
            </Link>
          </div>
        </div>
      )}

      <ReadinessCheckInModal
        isOpen={checkinModalOpen}
        onClose={() => setCheckinModalOpen(false)}
        initialValues={{
          sleepHours: props.sleepHours,
          hrv: props.hrv,
          restingHr: props.restingHr,
          soreness: props.soreness,
          weightKg: props.weightKg,
        }}
      />
    </div>
  );
}
