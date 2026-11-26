import Link from "next/link";
import {
  ArrowRight, CalendarDays, ChevronRight, Clock, Dumbbell, Flame,
  History, Play, Sparkles, Timer, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  currentProgramWeek, getWorkspace, personalRecordFor, previousSets, programDays,
  todayPlan, weeklyScheduleStatus, weekVolumeSeries,
} from "@/lib/queries";
import {
  adaptiveTargetWeight, computeLevelProgress, estimateSessionMinutes, muscleLabel,
} from "@/lib/engine";
import { Badge, ButtonLink, ProgressBar } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { formatVolume, titleCase, cn } from "@/lib/utils";
import { relativeTime } from "@/lib/date";
import { startWorkout } from "@/app/actions";

export default async function TrainPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const plan = todayPlan(ws);
  const routine = ws.enrolledRoutine;
  const days = routine ? programDays(ws, routine.id) : [];
  const series = weekVolumeSeries(ws, 6);
  const recent = ws.completedWorkouts.slice(0, 6);
  const progWeek = currentProgramWeek(ws);
  const schedule = weeklyScheduleStatus(ws);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Adaptive engine on</Badge>
            <span className="label-mono text-dim">{routine?.name ?? "Hypertrophy Forge"} · {progWeek.label}</span>
          </>
        }
        title="Train"
        subtitle="Your plan, re-written in real time around your equipment, energy, and the minutes you actually have."
        actions={
          <>
            <ButtonLink href="/app/programs" variant="secondary" size="md">
              <CalendarDays className="size-3.5" /> Programs
            </ButtonLink>
            <ButtonLink href="/app/exercises" variant="outline" size="md">
              <Dumbbell className="size-3.5" /> Library
            </ButtonLink>
          </>
        }
      />

      {ws.activeWorkout && (
        <Card className="mb-4 border-acid/25 bg-acid/[0.04] p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-acid/15 text-acid">
                <span className="absolute inset-0 animate-ping rounded-full bg-acid/10" />
                <Dumbbell className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-chalk">A session is live · {ws.activeWorkout.name}</p>
                <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist">
                  {ws.activeWorkout.totalSets} sets · {formatVolume(ws.activeWorkout.totalVolume)} kg · started {relativeTime(new Date(ws.activeWorkout.startedAt))}
                </p>
              </div>
            </div>
            <ButtonLink href={`/app/train/${ws.activeWorkout.id}`} size="md" className="w-full sm:w-auto">
              Resume <ArrowRight className="size-3.5" />
            </ButtonLink>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Today */}
        <Card className="relative p-5 md:p-6 xl:col-span-8">
          <div className="pointer-events-none absolute -right-20 -top-24 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.10),transparent_65%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone="acid">{plan?.isToday ? "Today" : "Next up"}</Badge>
                  <Badge tone="neutral"><Clock className="size-2.5" /> ~{plan ? estimateSessionMinutes(plan.day.exercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec, supersetGroup: e.supersetGroup }))) : 52} min</Badge>
                  <Badge tone="mint">RPE {plan?.day.exercises[0]?.rpeTarget ?? 8}</Badge>
                </div>
                <h2 className="font-display text-[30px] font-bold leading-[0.95] tracking-[-0.045em] md:text-[38px]">{plan?.day.name ?? "Push A"}</h2>
                <p className="mt-2 text-[12.5px] text-mist md:text-[13px]">{plan?.day.focus ?? "Chest · Shoulders · Triceps"} · {progWeek.label}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="label-mono">Day</p>
                <p className="font-numeric text-4xl font-bold leading-none text-chalk/90">{(plan?.dayIndex ?? 0) + 1}<span className="text-lg text-dim">/{days.length || 5}</span></p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto no-scrollbar rounded-2xl border border-white/[0.07] bg-black/20">
              <div className="min-w-[500px] grid grid-cols-[auto_1.2fr_auto_auto_auto_auto] items-center gap-3 border-b border-white/[0.06] px-3.5 py-2.5">
                <span className="label-mono">#</span>
                <span className="label-mono">Exercise</span>
                <span className="label-mono text-right">Target</span>
                <span className="label-mono text-center">Sets × Reps</span>
                <span className="label-mono text-right">Last best</span>
                <span className="label-mono text-right">Rest</span>
              </div>
              {(plan?.day.exercises ?? []).map((item, i) => {
                const prev = previousSets(ws, item.exerciseId, new Date());
                const target = adaptiveTargetWeight(prev.weight, ws.readiness, item.rpeTarget, item.exercise.equipment);
                const pr = personalRecordFor(ws, item.exerciseId);
                const hasPr = pr != null && pr.value > 0;
                return (
                  <div key={item.id} className="min-w-[500px] grid grid-cols-[auto_1.2fr_auto_auto_auto_auto] items-center gap-3 border-b border-white/[0.04] px-3.5 py-3 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <span className="grid size-6 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] font-mono text-[9.5px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[12.5px] font-medium text-chalk/90">{item.exercise.name}</p>
                        {hasPr && (
                          <span className="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[7.5px] text-amber flex items-center gap-0.5 shrink-0">
                            <Trophy className="size-2" /> PR
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">{muscleLabel(item.exercise.primaryMuscle)} · {item.exercise.equipment}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-numeric text-[13px] font-bold text-acid">
                        {target > 0 ? `${target} kg` : item.exercise.equipment === "bodyweight" ? "BW" : "—"}
                      </p>
                      <p className="font-mono text-[7.5px] uppercase tracking-wider text-dim">adaptive</p>
                    </div>
                    <div className="text-center font-numeric text-[11.5px] text-mist">
                      {item.sets} × {item.repsMin}–{item.repsMax}
                    </div>
                    <div className="text-right font-mono text-[9px] text-dim">
                      {prev.weight > 0 ? `${prev.weight}kg × ${prev.reps}` : "New lift"}
                    </div>
                    <span className="text-right font-mono text-[9.5px] text-dim">{item.restSec}s</span>
                  </div>
                );
              })}
              {!plan?.day.exercises.length && (
                <div className="px-4 py-8 text-center text-[12px] text-mist">No exercises in this day yet. Start a free session.</div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[11px] text-dim">
                <Sparkles className="size-3.5 text-acid" />
                Auto-regulated from readiness <span className="font-numeric text-chalk">{ws.readiness}</span> and last session RPE
              </div>
              <div className="flex gap-2">
                <form action={startWorkout}>
                  <input type="hidden" name="dayId" value={plan?.day.id ?? ""} />
                  <button className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-acid px-6 text-[14px] font-semibold text-ink shadow-[0_8px_30px_-10px_rgba(201,247,58,0.55)] hover:bg-[#d8ff5e]">
                    <Play className="size-4" /> {ws.activeWorkout ? "Start another" : "Start session"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Card>

        {/* Week + volume */}
        <div className="grid gap-4 xl:col-span-4">
          <Card className="p-5">
            <CardHeader label="This week" title={`${ws.weekWorkouts.length} of ${routine?.daysPerWeek ?? 5} sessions`} action={<Badge tone="mint">{Math.round((ws.weekWorkouts.length / (routine?.daysPerWeek ?? 5)) * 100)}%</Badge>} />
            <div className="mt-4 space-y-2">
              {schedule.map((item, i) => {
                const d = item.day;
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      item.isNext
                        ? "border-acid/30 bg-acid/[0.06]"
                        : item.isDone
                        ? "border-mint/20 bg-mint/[0.02]"
                        : item.isSkipped
                        ? "border-amber/20 bg-amber/[0.02]"
                        : "border-white/[0.06] bg-white/[0.02]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[9px] font-mono",
                        item.isDone
                          ? "bg-mint/20 text-mint font-bold"
                          : item.isNext
                          ? "bg-acid text-ink font-bold"
                          : item.isSkipped
                          ? "border border-amber/40 text-amber font-semibold"
                          : "border border-white/10 text-dim",
                      )}
                    >
                      {item.isDone ? "✓" : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-chalk/90">{d.name}</p>
                      <p className="truncate font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">{d.focus}</p>
                    </div>
                    {item.isDone && <Badge tone="mint">Done</Badge>}
                    {item.isNext && <Badge tone="acid">Next</Badge>}
                    {item.isSkipped && <Badge tone="amber">Skipped</Badge>}
                    {item.isUpcoming && <span className="font-mono text-[8.5px] text-dim">{d.exercises.length} ex</span>}
                  </div>
                );
              })}
            </div>
            <Link href="/app/programs" className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-white/[0.06] py-2 text-[10.5px] text-mist hover:text-chalk">
              Full program <ChevronRight className="size-3" />
            </Link>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-mono mb-1.5">{series.length}-week volume</p>
                <p className="font-numeric text-2xl font-semibold">{formatVolume(series[series.length - 1]?.volume ?? 0)}<span className="ml-1 text-[10px] font-normal text-dim">kg</span></p>
              </div>
              <span className="grid size-9 place-items-center rounded-xl bg-acid/10 text-acid"><TrendingUp className="size-4" /></span>
            </div>
            <div className="mt-3 flex h-14 items-end gap-1.5">
              {series.map((s, i) => {
                const max = Math.max(...series.map((x) => x.volume), 1);
                return <div key={s.label} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(6, (s.volume / max) * 100)}%`, background: i === series.length - 1 ? "#C9F73A" : "rgba(255,255,255,0.12)" }} />;
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-dim"><Flame className="size-3 text-flame" /> {user.streak}-day streak · {computeLevelProgress(user.xp).progress}% • {user.xp.toLocaleString()} XP</div>
          </Card>
        </div>

        {/* Quick sessions */}
        <Card className="p-5 md:p-6 xl:col-span-12">
          <CardHeader
            label="How much time do you have?"
            title="Forge compresses the session, not the results"
            action={<Badge tone="grape"><Timer className="size-2.5" /> time-aware</Badge>}
          />
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { min: 15, label: "Express", desc: "Supersets, 2 lifts, zero fluff", tone: "#FF6B35", day: plan?.day.id },
              { min: 25, label: "Efficient", desc: "Keep every set, cut rest", tone: "#FFD166", day: plan?.day.id },
              { min: 45, label: "Standard", desc: "The full prescription", tone: "#C9F73A", day: plan?.day.id },
              { min: 70, label: "Deep work", desc: "Add accessory volume", tone: "#7BE0AD", day: plan?.day.id },
            ].map((q) => (
              <div key={q.min} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-bold tracking-[-0.04em]" style={{ color: q.tone }}>{q.min}<span className="text-[11px] font-normal text-dim"> min</span></p>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">{q.label}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-mist">{q.desc}</p>
                <form action={startWorkout} className="mt-3">
                  <input type="hidden" name="dayId" value={q.day ?? ""} />
                  <button className="press flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 text-[10.5px] font-medium text-mist hover:border-white/15 hover:text-chalk">
                    <Play className="size-3" /> Use this
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        {/* History */}
        <Card className="p-5 md:p-6 xl:col-span-8">
          <CardHeader label="History" title="Recent sessions" action={<Link href="/app/progress" className="flex items-center gap-1 text-[11px] text-mist hover:text-chalk">Analytics <ArrowRight className="size-3" /></Link>} />
          <div className="mt-3">
            {recent.map((w) => (
              <Link key={w.id} href={`/app/train/${w.id}/summary`} className="group flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0">
                <span className="grid size-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-dim group-hover:text-acid"><History className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-chalk/90">{w.name}</p>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">{relativeTime(new Date(w.startedAt))} · {w.totalSets} sets · {w.durationSec ? `${Math.round(w.durationSec / 60)}m` : "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-numeric text-[12.5px] font-medium">{formatVolume(w.totalVolume)}<span className="ml-0.5 text-[9px] text-dim">kg</span></p>
                  <p className="font-mono text-[8.5px] text-dim">RPE {w.readiness}</p>
                </div>
                <ChevronRight className="size-3.5 text-dim" />
              </Link>
            ))}
            {!recent.length && <p className="py-8 text-center text-[12px] text-mist">No sessions logged yet. Your first one starts above.</p>}
          </div>
        </Card>

        <Card className="p-5 md:p-6 xl:col-span-4">
          <CardHeader label="Equipment" title="Your available kit" action={<Link href="/app/settings" className="text-[11px] text-mist hover:text-chalk">Edit</Link>} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(user.equipment ?? []).map((e) => (
              <span key={e} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-mist">{titleCase(e)}</span>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-sky/15 bg-sky/[0.05] p-3">
            <p className="text-[11px] font-medium text-sky">Crowded rack? Tap swap mid-set.</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-mist">Forge ranks same-pattern alternatives instantly and preserves your logged volume.</p>
          </div>
          <div className="mt-4">
            <p className="label-mono mb-2">Weekly consistency</p>
            <ProgressBar value={(ws.weekWorkouts.length / (routine?.daysPerWeek ?? 5)) * 100} color="#C9F73A" height={5} />
          </div>
        </Card>
      </div>

      {/* Sticky start bar (mobile) - positioned cleanly above bottom navigation */}
      {plan?.day.id && (
        <div className="fixed bottom-[64px] left-0 right-0 z-40 border-t border-white/[0.08] bg-ink/95 px-4 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-2xl md:hidden">
          <form action={startWorkout} className="mx-auto max-w-md">
            <input type="hidden" name="dayId" value={plan.day.id} />
            <button className="press flex w-full items-center justify-center gap-2 rounded-full bg-acid py-3 text-[14px] font-bold text-ink shadow-[0_8px_30px_-10px_rgba(201,247,58,0.55)] hover:bg-[#d8ff5e]">
              <Play className="size-4" /> Start {plan.day.name?.split(" · ")[0] ?? "session"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
