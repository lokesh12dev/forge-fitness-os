import Link from "next/link";
import {
  ArrowUpRight, BarChart3, CalendarDays, ChevronRight, Clock, Dumbbell,
  Flame, Layers, Sparkles, Target, Trophy, TrendingUp, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace, muscleVolume, recentPRs, weekVolumeSeries } from "@/lib/queries";
import { dateKey } from "@/lib/date";
import { e1rm, muscleColor, muscleLabel, readinessVerdict, recoveryMap, strengthStanding } from "@/lib/engine";
import { Badge, ButtonLink, ProgressBar, Stat } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { BodyMap, RecoveryLegend, recoveryColor } from "@/components/body-map";
import { BodyTrends, LevelChip, PerformancePanel, ShareLiftButton, BadgeShowcase, ExportDataTrigger } from "@/components/progress-client";
import { evaluateBadges } from "@/lib/gamification";
import { formatDuration, formatVolume } from "@/lib/utils";

const LIFTS = [
  { slug: "bench-press", label: "Bench press" },
  { slug: "back-squat", label: "Back squat" },
  { slug: "deadlift", label: "Deadlift" },
  { slug: "overhead-press", label: "Overhead press" },
];

export default async function ProgressPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const weeks = weekVolumeSeries(ws, 12).map((w) => ({
    label: w.label,
    volume: w.volume,
    sessions: w.sessions,
    start: w.start.getTime(),
  }));

  const recoveryRows = ws.sets.map((s) => ({
    primaryMuscle: ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core",
    completedAt: s.completedAt,
    weightKg: s.weightKg,
    reps: s.reps,
  }));
  const recovery = recoveryMap(recoveryRows);
  const verdict = readinessVerdict(ws.readiness);

  const vol28Start = Date.now() - 28 * 86_400_000;
  const sets28 = ws.sets.filter((s) => new Date(s.completedAt).getTime() >= vol28Start);
  const volume28 = sets28.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const sessions28 = ws.completedWorkouts.filter((w) => new Date(w.startedAt).getTime() >= vol28Start).length;
  const avgSession = sessions28 ? Math.round(volume28 / sessions28) : 0;
  const totalVolume = ws.completedWorkouts.reduce((a, w) => a + w.totalVolume, 0);

  const muscleTotals = muscleVolume(ws, 28);
  const muscleMax = Math.max(...Object.values(muscleTotals), 1);
  const topMuscles = Object.entries(muscleTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const bodyPoints = ws.metrics.slice(-84).map((m) => ({
    date: m.date,
    label: new Date(`${m.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weight: m.weightKg,
    bodyFat: m.bodyFat,
    sleep: m.sleepHours,
    hrv: m.hrv,
    restingHr: m.restingHr,
  }));
  const latest = ws.latestMetric;

  const lifts = LIFTS.map(({ slug, label }) => {
    const exercise = ws.exercises.find((e) => e.slug === slug);
    if (!exercise) return null;
    const pr = ws.prs
      .filter((p) => p.exerciseId === exercise.id && p.type === "e1rm")
      .sort((a, b) => b.value - a.value)[0];
    if (!pr) return null;
    const standing = strengthStanding(slug, pr.value, user.weightKg, user.sex);
    const priorBest = ws.sets
      .filter((s) => s.exerciseId === exercise.id && new Date(s.completedAt) < new Date(pr.achievedAt))
      .reduce((best, s) => Math.max(best, e1rm(s.weightKg, s.reps)), 0);
    const previous = priorBest > 0 && priorBest < pr.value ? Math.round(priorBest * 10) / 10 : null;
    const weight = Math.round(pr.value / (1 + pr.reps / 30) / 2.5) * 2.5;
    return {
      slug,
      label,
      exercise,
      pr,
      standing,
      previous,
      weight,
      share: (
        <ShareLiftButton
          user={{ name: user.name, initials: user.initials }}
          exercise={exercise.name}
          value={pr.value}
          previous={previous}
          weight={weight}
          reps={pr.reps}
        />
      ),
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  const volumeByDate = new Map<string, number>();
  for (const w of ws.completedWorkouts) {
    const key = dateKey(new Date(w.startedAt));
    volumeByDate.set(key, (volumeByDate.get(key) ?? 0) + w.totalVolume);
  }
  const maxDay = Math.max(...volumeByDate.values(), 1);
  const calendar = Array.from({ length: 70 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (69 - i));
    const key = dateKey(d);
    const volume = volumeByDate.get(key) ?? 0;
    return { key, date: d, volume, intensity: volume ? 0.25 + (volume / maxDay) * 0.75 : 0 };
  });

  const latestPRs = recentPRs(ws, 4);
  const prCount = new Set(ws.prs.map((p) => p.exerciseId)).size;
  const adherenceBase = (ws.enrolledRoutine?.daysPerWeek ?? 4) * 4;
  const adherence = Math.min(100, Math.round((sessions28 / Math.max(1, adherenceBase)) * 100));
  const weekChange = (() => {
    const last = weeks[weeks.length - 1]?.volume ?? 0;
    const prev = weeks[weeks.length - 2]?.volume ?? 0;
    if (!prev) return 0;
    return Math.round(((last - prev) / prev) * 100);
  })();

  const badges = evaluateBadges({
    benchMaxKg: lifts.find((l) => l.slug === "bench-press")?.pr.value ?? 80,
    squatMaxKg: lifts.find((l) => l.slug === "back-squat")?.pr.value ?? 120,
    bodyweightKg: user.weightKg,
    streakDays: user.streak,
    totalVolumeKg: totalVolume,
    completedWorkoutsCount: ws.completedWorkouts.length,
    proteinHitDays: ws.nutrition.filter((n) => n.protein >= ws.targets.protein * 0.9).length,
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Level {user.level}</Badge>
            <Badge tone="flame"><Flame className="size-2.5" /> {user.streak}-day streak</Badge>
            <span className="label-mono text-dim">Last 12 weeks</span>
          </>
        }
        title="Progress."
        subtitle={`${user.name.split(" ")[0]}, the scale lies and the mirror delays. The numbers below don't. Volume is climbing, ${lifts[0]?.label.toLowerCase() ?? "your lifts"} is moving, and recovery says ${verdict.label.toLowerCase()} — trust the trend.`}
        actions={
          <>
            <ExportDataTrigger
              dataSummary={{
                workoutCount: ws.completedWorkouts.length,
                setsCount: ws.sets.length,
                nutritionDaysCount: ws.nutrition.length,
              }}
            />
            <ButtonLink href="/app/form-check" variant="secondary" size="md">
              <Sparkles className="size-3.5" /> Form check
            </ButtonLink>
            <ButtonLink href="/app/train" size="md">
              <Dumbbell className="size-3.5" /> Train now
            </ButtonLink>
          </>
        }
      />

      {/* HERO */}
      <Card className="relative p-5 md:p-7">
        <div className="pointer-events-none absolute -right-24 -top-32 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.10),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-20 [mask-image:radial-gradient(circle_at_80%_0%,black,transparent_62%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1.4fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><TrendingUp className="size-4" /></span>
              <p className="label-mono">Trajectory report</p>
            </div>
            <p className="mt-4 font-display text-[24px] font-bold leading-[1.04] tracking-[-0.04em] text-chalk md:text-[28px]">
              {weekChange >= 0 ? "You're building." : "You're consolidating."}{" "}
              <span className={weekChange >= 0 ? "text-acid" : "text-amber"}>
                {weekChange >= 0 ? "+" : ""}{weekChange}%
              </span>{" "}
              week over week.
            </p>
            <p className="mt-2 max-w-md text-[12px] leading-relaxed text-mist">
              28-day adherence is {adherence}% of your {ws.enrolledRoutine?.daysPerWeek ?? 4}-day split.
              {sessions28 > 0
                ? ` You moved ${formatVolume(volume28)} across ${sessions28} sessions — ${formatVolume(avgSession)} per session.`
                : " Start a session to put the trend in motion."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist">
                {readinessDot(ws.readiness)} readiness {ws.readiness}
              </span>
              {lifts.slice(0, 2).map((l) => l.standing && (
                <span key={l.slug} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist">
                  {l.label} · {l.standing.level}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label="28-day volume" value={formatVolume(volume28)} hint={`${sets28.length} working sets`} />
            <Stat label="Sessions" value={sessions28} unit={`/ ${adherenceBase}`} hint={`${adherence}% adherence`} accent="#C9F73A" />
            <Stat label="Lifetime volume" value={formatVolume(totalVolume)} hint={`${ws.completedWorkouts.length} workouts`} />
            <Stat label="PRs" value={prCount} unit="lifts" hint="estimated 1RM" accent="#FFD166" />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* PERFORMANCE */}
        <Card className="p-5 md:p-6 xl:col-span-8">
          <CardHeader
            label="Load progression"
            title="The work you've done"
            action={
              <Badge tone="neutral">
                <BarChart3 className="size-2.5" /> {weeks.reduce((a, w) => a + w.sessions, 0)} sessions / 12w
              </Badge>
            }
          />
          <div className="mt-5">
            <PerformancePanel weeks={weeks} />
          </div>
        </Card>

        {/* RECOVERY */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader
            label="Recovery heatmap"
            title="What's ready to train"
            action={<Badge tone={ws.readiness >= 80 ? "acid" : ws.readiness >= 65 ? "mint" : "amber"}>{verdict.label}</Badge>}
          />
          <div className="mt-4">
            <BodyMap recovery={recovery} />
          </div>
          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <p className="label-mono mb-3">Most fatigued</p>
            <RecoveryLegend recovery={recovery} limit={4} />
          </div>
          <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-[10.5px] leading-relaxed text-dim">
            <Sparkles className="mr-1.5 inline size-3 text-acid" />
            {verdict.advice} Forge auto-adjusts tomorrow's loads from this map.
          </p>
        </Card>

        {/* STRENGTH STANDARDS */}
        <Card className="p-5 md:p-6 xl:col-span-8">
          <CardHeader
            label="Strength standards"
            title="Where your lifts rank"
            action={<Badge tone="neutral"><Trophy className="size-2.5" /> {lifts.length} benchmark lifts</Badge>}
          />
          <div className="mt-5 space-y-3">
            {lifts.map((lift) => (
              <div key={lift.slug} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12.5px] font-semibold text-chalk">{lift.exercise.name}</p>
                      {lift.standing && <LevelChip level={lift.standing.level} />}
                    </div>
                    <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
                      {lift.pr.reps}-rep best · {lift.standing ? `${lift.standing.ratio}× bodyweight` : "bodyweight ratio"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.04em] text-chalk">
                        {Math.round(lift.pr.value)}<span className="ml-0.5 text-[9px] font-normal text-dim">kg</span>
                      </p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">est. 1RM</p>
                    </div>
                    {lift.share}
                  </div>
                </div>
                {lift.standing && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-acid/50 to-acid transition-[width] duration-700" style={{ width: `${lift.standing.pct}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                      {lift.standing.nextRatio
                        ? `${lift.standing.toNextKg}kg to ${lift.standing.nextLevel}`
                        : "Top level"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-2.5">
            <span className="text-[10.5px] text-dim">Benchmarks use bodyweight-relative strength standards for {user.sex === "female" ? "women" : "men"}.</span>
            <Link href="/app/exercises" className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-acid">
              All lifts <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </Card>

        {/* BODY TRENDS */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader
            label="Body metrics"
            title="Recomposition signal"
            action={<Badge tone="sky"><Target className="size-2.5" /> 84 days</Badge>}
          />
          <div className="mt-4">
            <BodyTrends points={bodyPoints} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4">
            <div>
              <p className="label-mono mb-1">Sleep</p>
              <p className="font-numeric text-sm font-semibold">{latest?.sleepHours?.toFixed(1) ?? "—"}<span className="ml-0.5 text-[9px] font-normal text-dim">h</span></p>
            </div>
            <div>
              <p className="label-mono mb-1">HRV</p>
              <p className="font-numeric text-sm font-semibold text-grape">{latest?.hrv ?? "—"}<span className="ml-0.5 text-[9px] font-normal text-dim">ms</span></p>
            </div>
            <div>
              <p className="label-mono mb-1">Resting HR</p>
              <p className="font-numeric text-sm font-semibold text-flame">{latest?.restingHr ?? "—"}</p>
            </div>
          </div>
        </Card>

        {/* MUSCLE VOLUME + CALENDAR */}
        <Card className="p-5 md:p-6 xl:col-span-5">
          <CardHeader
            label="Volume distribution"
            title="28-day muscle balance"
            action={<Badge tone="neutral"><Layers className="size-2.5" /> sets × load</Badge>}
          />
          <div className="mt-4 space-y-2.5">
            {topMuscles.map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-chalk/80">
                    <span className="size-1.5 rounded-full" style={{ background: muscleColor(key) }} />
                    {muscleLabel(key)}
                  </span>
                  <span className="font-numeric text-[10px] text-mist">{formatVolume(value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / muscleMax) * 100)}%`, background: muscleColor(key) }} />
                </div>
              </div>
            ))}
            {!topMuscles.length && <p className="py-6 text-center text-[11px] text-dim">Log a workout to map your muscle balance.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <span className="text-[10px] text-dim">Weak point detected</span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-amber">
              {weakPoint(muscleTotals)}
            </span>
          </div>
        </Card>

        {/* CALENDAR */}
        <Card className="p-5 md:p-6 xl:col-span-7">
          <CardHeader
            label="Consistency"
            title="Last 70 days"
            action={<Badge tone="acid"><CalendarDays className="size-2.5" /> {calendar.filter((d) => d.volume > 0).length} active days</Badge>}
          />
          <div className="mt-5 overflow-x-auto no-scrollbar">
            <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ minWidth: 350 }}>
              {calendar.map((day) => (
                <div
                  key={day.key}
                  title={`${day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${day.volume ? formatVolume(day.volume) : "rest"}`}
                  className="aspect-square w-full min-w-[9px] rounded-[3px] border border-white/[0.05]"
                  style={{
                    background: day.volume
                      ? `rgba(201,247,58,${0.18 + day.intensity * 0.62})`
                      : "rgba(255,255,255,0.025)",
                    boxShadow: day.key === dateKey() ? "0 0 0 1px #F2F3EE" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
              <span>Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <span key={v} className="size-2.5 rounded-[2px]" style={{ background: v ? `rgba(201,247,58,${0.18 + v * 0.62})` : "rgba(255,255,255,0.03)" }} />
              ))}
              <span>More</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
              <span className="flex items-center gap-1"><Flame className="size-2.5 text-flame" /> {user.streak}-day streak</span>
              <span className="flex items-center gap-1"><Clock className="size-2.5 text-sky" /> {ws.completedWorkouts.reduce((a, w) => a + w.durationSec, 0) / 3600 | 0}h trained</span>
            </div>
          </div>
        </Card>

        {/* RECENT PRS */}
        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader label="PR wall" title="Recent records" action={<Trophy className="size-4 text-amber" />} />
          <div className="mt-4 space-y-2">
            {latestPRs.map((pr) => (
              <div key={pr.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber/10 text-amber"><Trophy className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-chalk/90">{pr.exercise?.name ?? "Lift"}</p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">
                    {new Date(pr.achievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {pr.reps} reps
                  </p>
                </div>
                <span className="font-numeric text-[12px] font-semibold text-amber">{Math.round(pr.value)}kg</span>
              </div>
            ))}
            {!latestPRs.length && <p className="py-6 text-center text-[11px] text-dim">No PRs yet. Log a heavy set.</p>}
          </div>
          <div className="mt-4 rounded-xl border border-acid/15 bg-acid/[0.04] p-3">
            <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-acid"><Zap className="size-3" /> Next milestone</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist">
              {lifts[0]?.standing
                ? `${lifts[0].standing.toNextKg}kg on your ${lifts[0].label.toLowerCase()} unlocks ${lifts[0].standing.nextLevel}. That's roughly ${Math.max(2, Math.round(lifts[0].standing.toNextKg / 2.5))} micro-loads.`
                : "Add a benchmark lift to unlock your next strength milestone."}
            </p>
          </div>
        </Card>

        {/* ACHIEVEMENTS & BADGES (G1) */}
        <Card className="p-5 md:p-6 xl:col-span-12">
          <CardHeader
            label="Gamification & Milestones (G1)"
            title="Verified Achievement Badges"
            action={<Badge tone="amber"><Trophy className="size-2.5" /> Server-authoritative</Badge>}
          />
          <div className="mt-4">
            <BadgeShowcase badges={badges} />
          </div>
        </Card>

        {/* HISTORY */}
        <Card className="p-5 md:p-6 xl:col-span-12">
          <CardHeader
            label="Session history"
            title="Every session, on the record"
            action={<ButtonLink href="/app/train" variant="secondary" size="sm">Start a session <ArrowUpRight className="size-3" /></ButtonLink>}
          />
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
            {ws.completedWorkouts.slice(0, 6).map((w) => {
              const setCount = ws.sets.filter((s) => s.workoutId === w.id).length;
              const prs = ws.prs.filter((p) => p.workoutId === w.id).length;
              return (
                <Link
                  key={w.id}
                  href={`/app/train/${w.id}/summary`}
                  className="group flex items-center gap-3 border-b border-white/[0.05] bg-white/[0.015] px-3.5 py-3 transition-colors last:border-0 hover:bg-white/[0.04]"
                >
                  <span className="hidden w-20 shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-dim sm:block">
                    {new Date(w.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-acid">
                    <Dumbbell className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-chalk/90">{w.name}</p>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-dim">
                      {w.focus} · {setCount} sets · {formatDuration(w.durationSec)}
                      {w.compressed ? " · compressed" : ""}
                    </p>
                  </div>
                  {prs > 0 && <Badge tone="amber" className="hidden sm:inline-flex"><Trophy className="size-2.5" /> {prs} PR</Badge>}
                  <div className="w-20 text-right">
                    <p className="font-numeric text-[11.5px] text-chalk">{formatVolume(w.totalVolume)}</p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">volume</p>
                  </div>
                  <ChevronRight className="size-3.5 shrink-0 text-dim transition-colors group-hover:text-acid" />
                </Link>
              );
            })}
            {!ws.completedWorkouts.length && (
              <p className="py-10 text-center text-[11px] text-dim">Finish your first workout to start the record.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function readinessDot(score: number) {
  return `${score}`;
}

function weakPoint(totals: Record<string, number>) {
  const entries = Object.entries(totals);
  if (!entries.length) return "No data";
  const lowest = entries.sort((a, b) => a[1] - b[1])[0];
  return muscleLabel(lowest[0]);
}
