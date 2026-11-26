import Link from "next/link";
import {
  Activity, ArrowUpRight, CalendarDays, ChevronRight, Clock, Dumbbell, Flame,
  HeartPulse, Moon, Play, Sparkles, Trophy, Users, Utensils, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  activeChallenge, currentProgramWeek, getWorkspace, leaderboard, nutritionTotals, recentPRs,
  todayPlan, weekVolumeSeries,
} from "@/lib/queries";
import { dateKey, weekdayName } from "@/lib/date";
import {
  adaptiveTargetWeight, adaptiveTargetWeightWithReason, estimateSessionMinutes, muscleLabel, proteinPlan, readinessBreakdown,
  readinessConfidence, readinessScore, readinessVerdict, recoveryMap,
} from "@/lib/engine";
import { Badge, ButtonLink, ProgressBar, Stat } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { LabeledTrendChart, MacroBar, Ring, Sparkline } from "@/components/charts";
import { VolumeChart } from "@/components/volume-chart";
import { BodyMap, RecoveryLegend } from "@/components/body-map";
import { ReadinessCheckInTrigger } from "@/components/readiness-checkin";
import { formatVolume } from "@/lib/utils";
import { startWorkout } from "@/app/actions";

export default async function DashboardPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const plan = todayPlan(ws);
  const totals = nutritionTotals(ws);
  const verdict = readinessVerdict(ws.readiness);
  const series = weekVolumeSeries(ws, 8);
  const thisWeek = series[series.length - 1]?.volume ?? 0;
  const lastWeek = series[series.length - 2]?.volume ?? 0;
  const delta = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
  const prs = recentPRs(ws, 3);
  const challenge = activeChallenge(ws);
  const board = leaderboard(ws);
  const myRank = board.findIndex((b) => b.isMe) + 1;

  const recovery = recoveryMap(
    ws.sets.map((s) => ({
      primaryMuscle: ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core",
      completedAt: s.completedAt,
      weightKg: s.weightKg,
      reps: s.reps,
    })),
  );
  const lowest = Object.entries(recovery)
    .filter(([, v]) => v.sets > 0)
    .sort((a, b) => a[1].recovery - b[1].recovery)[0];

  const planExercises = plan?.day.exercises ?? [];
  const estMin = estimateSessionMinutes(planExercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec, supersetGroup: e.supersetGroup })));
  const projected = planExercises.reduce((acc, item) => {
    const prev = ws.sets
      .filter((s) => s.exerciseId === item.exerciseId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    const weight = prev?.weightKg ?? (item.exercise.equipment === "bodyweight" ? 65 : 40);
    return acc + weight * ((item.repsMin + item.repsMax) / 2) * item.sets;
  }, 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date();
  const weekStart = new Date(today);
  const dow = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1;
  weekStart.setDate(weekStart.getDate() - dow);
  const completedDays = new Set(
    ws.completedWorkouts
      .filter((w) => new Date(w.startedAt) >= weekStart)
      .map((w) => dateKey(new Date(w.startedAt))),
  );
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const proteinLeft = Math.max(0, ws.targets.protein - totals.protein);
  const proteinIdeas = proteinPlan(proteinLeft);
  const progWeek = currentProgramWeek(ws);
  const breakdown = readinessBreakdown(ws.latestMetric ?? {});
  const confidence = readinessConfidence(ws.latestMetric ?? {});
  const readinessTrend = ws.metrics.slice(-7).map((m) => {
    const d = new Date(m.date);
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: readinessScore(m),
    };
  });

  const keyLifts = planExercises.slice(0, 3).map((item) => {
    const prev = ws.sets
      .filter((s) => s.exerciseId === item.exerciseId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    const rec = adaptiveTargetWeightWithReason(
      prev?.weightKg ?? 0,
      ws.readiness,
      item.rpeTarget,
      item.exercise.equipment,
      prev?.reps,
      item.repsMax,
    );
    return {
      ...item,
      prev,
      targetWeight: rec.targetWeight,
      rec,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="neutral">{weekdayName(today)}, {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Badge>
            <span className="label-mono text-dim">{progWeek.label}</span>
          </>
        }
        title={<>{greeting}, {user.name.split(" ")[0]}.</>}
        subtitle={
          <>
            Readiness is <span className="font-semibold text-chalk">{ws.readiness}</span>. {verdict.advice}
          </>
        }
        actions={
          <>
            <ButtonLink href="/app/coach" variant="secondary" size="md">
              <Zap className="size-3.5 text-acid" /> Ask coach
            </ButtonLink>
            <ButtonLink href="/app/nutrition" variant="outline" size="md">
              <Utensils className="size-3.5" /> Log food
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Today's session - Daily Command Center */}
        <Card className="relative p-5 md:p-6 xl:col-span-8">
          <div className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.12),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35] [mask-image:radial-gradient(circle_at_80%_0%,black,transparent_70%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <Badge tone="acid" dot>{ws.activeWorkout ? "Session live" : "Daily command center"}</Badge>
                  <span className="label-mono text-dim">{plan?.routine.name} · {progWeek.shortLabel}</span>
                </div>
                <h2 className="font-display text-[28px] font-bold leading-[0.95] tracking-[-0.045em] md:text-[34px]">
                  {ws.activeWorkout ? ws.activeWorkout.name : plan?.day.name ?? "Push A · Chest Bias"}
                </h2>
                <p className="mt-2 text-[12.5px] text-mist">{ws.activeWorkout ? ws.activeWorkout.focus : plan?.day.focus ?? "Chest · Shoulders · Triceps"}</p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-center">
                  <p className="font-numeric text-lg font-semibold leading-none">{planExercises.length || 5}</p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">exercises</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-center">
                  <p className="font-numeric text-lg font-semibold leading-none">{estMin}</p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">min</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-center">
                  <p className="font-numeric text-lg font-semibold leading-none text-acid">{formatVolume(projected)}</p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">kg est.</p>
                </div>
              </div>
            </div>

            {/* Key Compound Targets Spotlight */}
            <div className="mt-5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="label-mono text-mist">Target lifts today</span>
                <Link href="/app/train" className="font-mono text-[9px] uppercase tracking-wider text-acid hover:underline">
                  All {planExercises.length} lifts in Train →
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {keyLifts.map((lift, i) => (
                  <div key={lift.id} className="rounded-xl border border-white/[0.07] bg-black/25 p-3">
                    <div className="flex items-center justify-between font-mono text-[8px] text-dim">
                      <span>Lift 0{i + 1}</span>
                      <span className="uppercase text-dim">{lift.exercise.equipment}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-semibold text-chalk">{lift.exercise.name}</p>
                    <div className="mt-2.5 flex items-baseline justify-between border-t border-white/[0.06] pt-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-numeric text-base font-bold text-acid">
                            {lift.targetWeight > 0 ? `${lift.targetWeight} kg` : lift.exercise.equipment === "bodyweight" ? "Bodyweight" : "—"}
                          </p>
                          {lift.rec.factor === "high_readiness" && (
                            <span className="rounded bg-acid/15 px-1 py-0.5 font-mono text-[7px] font-bold text-acid">
                              +2.5% Primed
                            </span>
                          )}
                          {lift.rec.factor === "low_readiness" && (
                            <span className="rounded bg-flame/15 px-1 py-0.5 font-mono text-[7px] font-bold text-flame">
                              -5% Back-off
                            </span>
                          )}
                          {lift.rec.factor === "double_progression" && (
                            <span className="rounded bg-sky/15 px-1 py-0.5 font-mono text-[7px] font-bold text-sky">
                              +Plate
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[7.5px] uppercase tracking-wider text-dim">
                          target load · {lift.rec.factor === "no_history" ? "calibrate" : `why: ${lift.rec.reason.slice(0, 32)}…`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-numeric text-[12px] font-medium text-mist">{lift.sets} × {lift.repsMin}–{lift.repsMax}</p>
                        <p className="font-mono text-[7.5px] uppercase tracking-wider text-dim">target reps</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.06] pt-4">
              <div className="flex items-center gap-2 text-[11px] text-dim">
                <Sparkles className="size-3.5 text-acid shrink-0" />
                <span>
                  Load auto-regulated for readiness <strong className="font-numeric text-chalk">{ws.readiness}</strong> (RPE {plan?.day.exercises[0]?.rpeTarget ?? 8} target)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ButtonLink href="/app/train" variant="secondary" size="md" className="hidden sm:inline-flex">
                  View training hub <ChevronRight className="size-3.5" />
                </ButtonLink>
                {ws.activeWorkout ? (
                  <ButtonLink href={`/app/train/${ws.activeWorkout.id}`} size="lg" className="flex-1 sm:flex-none">
                    <Play className="size-4" /> Resume session
                  </ButtonLink>
                ) : (
                  <form action={startWorkout} className="flex-1 sm:flex-none">
                    <input type="hidden" name="dayId" value={plan?.day.id ?? ""} />
                    <button className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-acid px-6 text-[14px] font-semibold text-ink shadow-[0_8px_30px_-10px_rgba(201,247,58,0.55)] hover:bg-[#d8ff5e]">
                      <Play className="size-4" /> Start session
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Readiness - Complete Factor Breakdown & 7-Day Trend */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader
            label="Readiness"
            title="Daily physiological engine"
            action={
              <div className="flex items-center gap-1.5">
                <ReadinessCheckInTrigger
                  currentScore={ws.readiness}
                  hasCheckedInToday={ws.latestMetric?.date === dateKey(today)}
                  initialValues={{
                    sleepHours: ws.latestMetric?.sleepHours,
                    hrv: ws.latestMetric?.hrv,
                    restingHr: ws.latestMetric?.restingHr,
                    soreness: ws.latestMetric?.soreness,
                    weightKg: ws.latestMetric?.weightKg ?? user.weightKg,
                  }}
                />
                {confidence < 0.8 && <Badge tone="neutral">Est.</Badge>}
                <Badge tone={ws.readiness >= 85 ? "acid" : ws.readiness >= 70 ? "mint" : "amber"}>{verdict.label}</Badge>
              </div>
            }
          />
          <div className="mt-4 flex items-center gap-4">
            <Ring value={ws.readiness} size={106} stroke={8} color={ws.readiness >= 70 ? "#C9F73A" : "#FFD166"}>
              <div className="text-center">
                <p className="font-numeric text-[30px] font-bold leading-none tracking-[-0.05em]">{ws.readiness}</p>
                <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.16em] text-dim">of 100</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-1.5">
              {breakdown.factors.map((f) => (
                <div key={f.key} className="space-y-0.5">
                  <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-wider">
                    <span className="text-dim">{f.label}</span>
                    <span className={f.status === "optimal" ? "text-mint" : f.status === "fair" ? "text-mist" : "text-amber"}>
                      {f.value} <span className="text-dim">({f.pts}/{f.maxPts}pt)</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${f.pct}%`,
                        background: f.status === "optimal" ? "#C9F73A" : f.status === "fair" ? "#6EA8FF" : "#FFD166",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="text-[11px] leading-relaxed text-mist">{verdict.advice}</p>
            {confidence < 0.8 && (
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
                {Math.round(confidence * 100)}% of inputs logged · missing signals use population defaults
              </p>
            )}
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="mb-2 font-mono text-[8.5px] uppercase tracking-wider text-dim">7-day readiness trend</p>
            <LabeledTrendChart data={readinessTrend} height={42} color={ws.readiness >= 70 ? "#C9F73A" : "#FFD166"} />
          </div>
        </Card>

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 xl:col-span-12 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <Stat label="Streak" value={user.streak} unit="days" hint="Top 3% consistency" accent="#FF6B35" />
              <div className="grid size-8 place-items-center rounded-lg bg-flame/10 text-flame"><Flame className="size-4" /></div>
            </div>
            <div className="mt-3 flex gap-1">
              {days.map((d, i) => {
                const dayDate = new Date(weekStart);
                dayDate.setDate(dayDate.getDate() + i);
                const done = completedDays.has(dateKey(dayDate));
                const isToday = dateKey(dayDate) === dateKey(today);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className={`grid h-6 w-full place-items-center rounded-md text-[9px] font-mono ${done ? "bg-acid text-ink" : isToday ? "border border-acid/50 text-acid" : "bg-white/[0.04] text-dim"}`}>
                      {done ? "✓" : ""}
                    </div>
                    <span className="font-mono text-[8px] text-dim">{d}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <Stat label="This week" value={ws.weekWorkouts.length} unit={`/ ${ws.enrolledRoutine?.daysPerWeek ?? 5}`} hint="Sessions completed" />
              <div className="grid size-8 place-items-center rounded-lg bg-sky/10 text-sky"><CalendarDays className="size-4" /></div>
            </div>
            <div className="mt-4">
              <ProgressBar value={(ws.weekWorkouts.length / (ws.enrolledRoutine?.daysPerWeek ?? 5)) * 100} color="#6EA8FF" height={5} />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-dim">
                <span>{Math.max(0, (ws.enrolledRoutine?.daysPerWeek ?? 5) - ws.weekWorkouts.length)} left</span>
                <span>{Math.round(((ws.weekWorkouts.length) / (ws.enrolledRoutine?.daysPerWeek ?? 5)) * 100)}%</span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <Stat label="Volume" value={formatVolume(thisWeek)} unit="kg" hint={`${delta >= 0 ? "+" : ""}${delta}% vs last week`} accent={delta >= 0 ? "#C9F73A" : "#FF8FA3"} />
              <div className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><TrendingUpIcon /></div>
            </div>
            <Sparkline data={series.map((s) => s.volume)} height={34} className="mt-3" color="#C9F73A" />
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <Stat label="Protein" value={Math.round(totals.protein)} unit={`/ ${ws.targets.protein}g`} hint={proteinLeft > 0 ? `${Math.round(proteinLeft)}g left today` : "Target hit — nice"} accent="#7BE0AD" />
              <div className="grid size-8 place-items-center rounded-lg bg-mint/10 text-mint"><Utensils className="size-4" /></div>
            </div>
            <div className="mt-4">
              <ProgressBar value={(totals.protein / ws.targets.protein) * 100} color="#7BE0AD" height={5} />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-dim">
                <span>{Math.round(totals.calories)} kcal</span>
                <span>{ws.targets.calories - Math.round(totals.calories)} left</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Volume chart */}
        <Card className="p-5 md:p-6 xl:col-span-7">
          <CardHeader
            label="Training load"
            title="Volume is climbing"
            action={
              <div className="text-right">
                <p className="font-numeric text-[22px] font-semibold leading-none">{formatVolume(thisWeek)}<span className="ml-1 text-[10px] font-normal text-dim">kg</span></p>
                <p className={`mt-1 font-mono text-[9px] ${delta >= 0 ? "text-acid" : "text-rose"}`}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs last week</p>
              </div>
            }
          />
          <div className="mt-6">
            <VolumeChart data={series.map((s) => ({ label: s.label.split(" ")[1] ?? s.label, value: s.volume }))} height={148} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <div className="flex gap-5">
              <MiniStat label="Sessions" value={`${ws.weekWorkouts.length}`} />
              <MiniStat label="Avg / session" value={`${formatVolume(ws.weekWorkouts.length ? thisWeek / ws.weekWorkouts.length : 0)} kg`} />
              <MiniStat label="Sets" value={`${ws.weekSets.length}`} />
            </div>
            <Link href="/app/progress" className="hidden items-center gap-1 text-[11px] text-mist hover:text-chalk sm:flex">
              Full analytics <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>

        {/* Recovery */}
        <Card className="p-5 md:p-6 xl:col-span-5">
          <CardHeader
            label="Recovery map"
            title={lowest ? `${muscleLabel(lowest[0])} needs ${lowest[1].recovery < 50 ? "another day" : "a light day"}` : "Fresh and ready"}
            action={<Badge tone={lowest && lowest[1].recovery < 50 ? "flame" : "mint"}>{lowest ? `${lowest[1].recovery}%` : "100%"}</Badge>}
          />
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <BodyMap recovery={recovery} showDetailsCard={false} svgHeightClass="max-h-[195px]" className="shrink-0" />
            <div className="w-full min-w-0 flex-1">
              <RecoveryLegend recovery={recovery} limit={6} />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <p className="text-[11px] leading-relaxed text-mist">
              {lowest
                ? <>Prioritize <span className="font-medium text-chalk">{muscleLabel(lowest[0])}</span> today only if it&apos;s in the plan — otherwise let it recover. Your <span className="text-acid">chest</span> is primed for the top set.</>
                : "No recent training stress. You're fully recovered — a good day to push."}
            </p>
          </div>
        </Card>

        {/* Nutrition */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader
            label="Fuel"
            title="Today's macros"
            action={<Link href="/app/nutrition" className="text-[11px] text-mist hover:text-chalk">Open</Link>}
          />
          <div className="mt-5 flex items-center gap-4">
            <Ring value={(totals.calories / ws.targets.calories) * 100} size={86} stroke={7} color="#FF6B35">
              <div className="text-center">
                <p className="font-numeric text-lg font-bold leading-none">{Math.round(totals.calories)}</p>
                <p className="font-mono text-[7px] uppercase tracking-wider text-dim">kcal</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-2.5">
              <MacroBar label="Protein" value={totals.protein} target={ws.targets.protein} color="#7BE0AD" />
              <MacroBar label="Carbs" value={totals.carbs} target={ws.targets.carbs} color="#6EA8FF" />
              <MacroBar label="Fat" value={totals.fat} target={ws.targets.fat} color="#FFD166" />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-mint/15 bg-mint/[0.05] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-mint">{Math.round(proteinLeft)}g protein left</p>
              <Badge tone="mint">AI plan</Badge>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-mist">
              {proteinIdeas.length ? `${proteinIdeas[0].name} (${proteinIdeas[0].protein}g) + ${proteinIdeas[1]?.name ?? "a shake"} closes the gap in ${proteinIdeas.length} bites.` : "Protein target hit. Keep the rest of the day whole-food focused."}
            </p>
            <Link href="/app/nutrition" className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-mint hover:text-chalk">
              Generate meal <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>

        {/* PRs */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader
            label="Personal records"
            title="Recent bests"
            action={<Trophy className="size-4 text-amber" />}
          />
          <div className="mt-4 space-y-1">
            {prs.map((pr, i) => (
              <Link key={pr.id} href={`/app/exercises?q=${encodeURIComponent(pr.exercise?.name ?? "")}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.04]">
                <span className="grid size-7 place-items-center rounded-lg bg-amber/10 font-mono text-[10px] text-amber">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-chalk/90">{pr.exercise?.name ?? "Lift"}</p>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">e1RM · {new Date(pr.achievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <span className="font-numeric text-[13px] font-semibold text-chalk">{pr.value}<span className="ml-0.5 text-[9px] text-dim">kg</span></span>
              </Link>
            ))}
            {!prs.length && <p className="py-6 text-center text-[12px] text-mist">Log a working set to set your first PR.</p>}
          </div>
          <Link href="/app/progress" className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] py-2 text-[10.5px] text-mist hover:border-white/15 hover:text-chalk">
            All records <ChevronRight className="size-3" />
          </Link>
        </Card>

        {/* Challenge */}
        <Card className="relative p-5 md:p-6 xl:col-span-4">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[radial-gradient(circle,rgba(255,107,53,0.14),transparent_70%)]" />
          <CardHeader
            label="Live challenge"
            title={challenge?.title ?? "Squat Every Day"}
            action={<Badge tone="flame" dot>{challenge ? `${Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86_400_000))}d left` : "live"}</Badge>}
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-mist">{challenge?.description}</p>
          <div className="mt-5 flex items-center gap-4">
            <Ring value={challenge ? (challenge.progress / challenge.target) * 100 : 0} size={78} stroke={6} color="#FF6B35">
              <div className="text-center">
                <p className="font-numeric text-base font-bold leading-none">{Math.round(challenge?.progress ?? 0)}</p>
                <p className="font-mono text-[7px] text-dim">/ {Math.round(challenge?.target ?? 0)}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] text-mist"><Users className="size-3.5" /> {(challenge?.participants ?? 0).toLocaleString()} lifters</div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-mist"><Trophy className="size-3.5" /> You&apos;re #{myRank} in your crew this week</div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-mist"><Flame className="size-3.5 text-flame" /> {user.streak}-day streak banked</div>
            </div>
          </div>
          <ButtonLink href="/app/social" variant="secondary" size="sm" className="mt-4 w-full">
            View leaderboard <ArrowUpRight className="size-3.5" />
          </ButtonLink>
        </Card>
      </div>

      {/* Sticky Quick-Start Bar for Mobile (sits cleanly above bottom nav bar) */}
      <div className="fixed bottom-[64px] inset-x-0 z-40 border-t border-white/[0.08] bg-ink/95 px-4 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-chalk">
              {ws.activeWorkout ? ws.activeWorkout.name : plan?.day.name ?? "Today's workout"}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-acid">
              {estMin} min · {formatVolume(projected)} kg est.
            </p>
          </div>
          {ws.activeWorkout ? (
            <ButtonLink href={`/app/train/${ws.activeWorkout.id}`} size="sm" className="gap-1.5 shrink-0">
              <Play className="size-3.5" /> Resume
            </ButtonLink>
          ) : (
            <form action={startWorkout} className="shrink-0">
              <input type="hidden" name="dayId" value={plan?.day.id ?? ""} />
              <button className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-acid px-4 text-[12px] font-bold text-ink shadow-[0_4px_20px_-5px_rgba(201,247,58,0.55)]">
                <Play className="size-3.5" /> Start
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function Factor({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: "good" | "warn" }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-dim" />
      <span className="flex-1 text-[11px] text-mist">{label}</span>
      <span className={`font-numeric text-[11px] font-medium ${tone === "good" ? "text-chalk" : "text-amber"}`}>{value}</span>
      <span className={`size-1.5 rounded-full ${tone === "good" ? "bg-mint" : "bg-amber"}`} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">{label}</p>
      <p className="mt-0.5 font-numeric text-[12px] text-chalk">{value}</p>
    </div>
  );
}

function TrendingUpIcon() {
  return <Activity className="size-4" />;
}
