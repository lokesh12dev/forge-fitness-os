import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock, Dumbbell, Flame, Layers, Play, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace, programDays, weekVolumeSeries } from "@/lib/queries";
import { estimateSessionMinutes, muscleColor } from "@/lib/engine";
import { Badge, ButtonLink, ProgressBar } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { ProgramCard, type ProgramItem } from "@/components/program-card";
import { formatVolume } from "@/lib/utils";
import { startWorkout } from "@/app/actions";

export default async function ProgramsPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const enrolled = ws.enrolledRoutine;
  const currentDays = enrolled ? programDays(ws, enrolled.id) : [];

  const items: ProgramItem[] = ws.routines.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    description: r.description,
    goal: r.goal,
    level: r.level,
    daysPerWeek: r.daysPerWeek,
    weeks: r.weeks,
    accent: r.accent,
    enrolled: r.enrolled,
    rating: r.rating,
    members: r.members,
    days: programDays(ws, r.id).map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({
        id: e.id, name: e.exercise.name, sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax,
        restSec: e.restSec, primaryMuscle: e.exercise.primaryMuscle, equipment: e.exercise.equipment,
      })),
    })),
  }));

  const series = weekVolumeSeries(ws, 6);
  const totalWeeks = enrolled?.weeks ?? 8;
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil(ws.completedWorkouts.length / Math.max(1, enrolled?.daysPerWeek ?? 5))));
  const remaining = items.filter((p) => !p.enrolled);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid"><Layers className="size-2.5" /> Program engine</Badge>
            <span className="label-mono text-dim">Week {currentWeek} of {totalWeeks}</span>
          </>
        }
        title="Programs"
        subtitle="Structured progression with autoregulation built in. Every set adapts to your recovery — the split stays, the load moves."
        actions={
          <ButtonLink href="/app/train" size="md"><Play className="size-3.5" /> Train now</ButtonLink>
        }
      />

      {enrolled && (
        <Card className="relative mb-5 overflow-hidden p-5 md:p-7">
          <div className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full" style={{ background: `radial-gradient(circle, ${enrolled.accent}16, transparent 65%)` }} />
          <div className="relative">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="acid" dot>Active plan</Badge>
                  <Badge tone="neutral">{enrolled.level}</Badge>
                  <Badge tone="neutral">{enrolled.goal}</Badge>
                </div>
                <h2 className="mt-3 font-display text-[32px] font-bold leading-[0.94] tracking-[-0.05em] md:text-[44px]">{enrolled.name}</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-mist md:text-[13.5px]">{enrolled.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                  <div><p className="label-mono">Sessions</p><p className="mt-1 font-numeric text-lg">{ws.completedWorkouts.length}</p></div>
                  <div><p className="label-mono">Volume</p><p className="mt-1 font-numeric text-lg">{formatVolume(ws.completedWorkouts.reduce((a, w) => a + w.totalVolume, 0))}kg</p></div>
                  <div><p className="label-mono">Adherence</p><p className="mt-1 font-numeric text-lg text-acid">{Math.min(100, Math.round((ws.weekWorkouts.length / enrolled.daysPerWeek) * 100))}%</p></div>
                  <div><p className="label-mono">Streak</p><p className="mt-1 font-numeric text-lg text-flame">{user.streak}d</p></div>
                </div>
              </div>
              <div className="w-full shrink-0 rounded-2xl border border-white/[0.07] bg-black/25 p-4 md:w-[290px]">
                <div className="flex items-center justify-between">
                  <p className="label-mono">Macrocycle</p>
                  <span className="font-mono text-[9px] text-dim">W{currentWeek}/{totalWeeks}</span>
                </div>
                <div className="mt-2"><ProgressBar value={(currentWeek / totalWeeks) * 100} color={enrolled.accent} height={6} /></div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {Array.from({ length: totalWeeks }).map((_, i) => (
                    <div key={i} className={`h-6 rounded-[4px] ${i < currentWeek ? "bg-acid/70" : i === currentWeek ? "border border-acid/50" : "bg-white/[0.05]"}`} />
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-dim">Week {currentWeek + 1 <= totalWeeks ? currentWeek + 1 : totalWeeks} adds 2.5% load on compounds if all sets hit RPE ≤ 8.</p>
                <Link href="/app/progress" className="mt-2 inline-flex items-center gap-1 text-[10px] text-mist hover:text-chalk">See progression <ArrowRight className="size-2.5" /></Link>
              </div>
            </div>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {currentDays.map((day, i) => {
                const done = ws.completedWorkouts.some((w) => w.name === day.name && new Date(w.startedAt) >= new Date(Date.now() - 7 * 86400000));
                const min = estimateSessionMinutes(day.exercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec, supersetGroup: e.supersetGroup })));
                return (
                  <div key={day.id} className={`group relative overflow-hidden rounded-xl border p-3.5 ${done ? "border-mint/15 bg-mint/[0.03]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Day {i + 1}</p>
                        <p className="mt-1 font-display text-[16px] font-bold leading-tight tracking-[-0.02em]">{day.name}</p>
                      </div>
                      {done ? <span className="grid size-6 place-items-center rounded-full bg-mint/15 text-mint"><Check className="size-3" /></span> : <span className="grid size-6 place-items-center rounded-full border border-white/10 font-mono text-[8px] text-dim">{day.exercises.length}</span>}
                    </div>
                    <p className="mt-1 text-[10px] text-mist">{day.focus}</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                      <Clock className="size-2.5" /> {min} min
                      <span>·</span>
                      {day.exercises.reduce((a, e) => a + e.sets, 0)} sets
                    </div>
                    <div className="mt-2 flex gap-0.5">
                      {day.exercises.slice(0, 8).map((e) => (
                        <span key={e.id} className="h-1 flex-1 rounded-full" style={{ background: `${muscleColor(e.exercise.primaryMuscle)}90` }} />
                      ))}
                    </div>
                    <form action={startWorkout} className="mt-3">
                      <input type="hidden" name="dayId" value={day.id} />
                      <button className={`press flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10.5px] font-medium ${done ? "border border-white/[0.08] text-mist hover:text-chalk" : "bg-white/[0.06] text-chalk hover:bg-acid hover:text-ink"}`}>
                        <Play className="size-2.5" /> {done ? "Repeat session" : "Start"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="label-mono mb-1">Explore</p>
              <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">More ways to train</h2>
            </div>
            <span className="font-mono text-[9px] text-dim">{remaining.length} plans</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => <ProgramCard key={p.id} program={p} />)}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card className="p-5">
            <CardHeader label="Progression" title="6-week volume" action={<Badge tone="mint">+{Math.max(0, Math.round((((series[series.length - 1]?.volume ?? 0) - (series[0]?.volume ?? 0)) / Math.max(1, series[0]?.volume ?? 1)) * 100))}%</Badge>} />
            <div className="mt-4 flex h-24 items-end gap-1.5">
              {series.map((s, i) => {
                const max = Math.max(...series.map((x) => x.volume), 1);
                return <div key={s.label} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(6, (s.volume / max) * 100)}%`, background: i === series.length - 1 ? "#C9F73A" : "rgba(255,255,255,0.12)" }} />;
              })}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-dim">Each finished week feeds the progression model. Missed reps and high RPE pull the next week back automatically.</p>
          </Card>

          <Card className="p-5">
            <CardHeader label="Why this works" title="Autoregulation, explained" />
            <div className="mt-3 space-y-3">
              {[
                { icon: Sparkles, title: "RPE-driven load", body: "Every set you rate recalibrates the next. No more guessing if 5×5 is too much." },
                { icon: CalendarDays, title: "Readiness gating", body: "Sleep, HRV, and soreness set today's intensity ceiling before you touch a bar." },
                { icon: Trophy, title: "PR-safe progression", body: "Compounds add 2.5% only when the preceding sets are clean and below RPE 8." },
              ].map((f) => (
                <div key={f.title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-acid/10 text-acid"><f.icon className="size-3.5" /></span>
                  <div>
                    <p className="text-[11.5px] font-medium text-chalk">{f.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-mist">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader label="Not sure?" title="Let the coach choose" />
            <p className="mt-2 text-[11px] leading-relaxed text-mist">Tell it your goal, days per week, and equipment. It builds a split and enrolls you in under a minute.</p>
            <Link href="/app/coach" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-acid py-2.5 text-[11.5px] font-semibold text-ink">
              <Sparkles className="size-3.5" /> Build my program
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
