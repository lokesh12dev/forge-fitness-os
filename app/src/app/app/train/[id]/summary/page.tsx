import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock, Dumbbell, Flame, Layers,
  MessageSquare, Sparkles, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace, nextPlanAfter, workoutDetail } from "@/lib/queries";
import { muscleColor, muscleLabel, computeLevelProgress } from "@/lib/engine";
import { Badge, ButtonLink, Stat } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { SummaryActions, type SharePR } from "@/components/summary-actions";
import { formatClock, formatDuration, formatVolume } from "@/lib/utils";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const detail = workoutDetail(ws, id);
  if (!detail) notFound();
  if (detail.workout.status !== "completed") redirect(`/app/train/${id}`);
  const workout = detail.workout;

  const prSets = detail.items.flatMap((i) => i.sets.filter((s) => s.isPR).map((s) => ({ ...s, exercise: i.exercise })));
  const sharePrs: SharePR[] = prSets.map((s) => ({
    id: s.id,
    exercise: s.exercise.name,
    value: Math.round(s.weightKg * (1 + s.reps / 30) * 10) / 10,
    previous: null,
    weight: s.weightKg,
    reps: s.reps,
  }));

  const muscleTotals = new Map<string, { volume: number; sets: number }>();
  for (const item of detail.items) {
    for (const s of item.sets) {
      const key = item.exercise.primaryMuscle;
      const cur = muscleTotals.get(key) ?? { volume: 0, sets: 0 };
      cur.volume += s.weightKg * s.reps;
      cur.sets += 1;
      muscleTotals.set(key, cur);
    }
  }
  const muscleRows = [...muscleTotals.entries()].sort((a, b) => b[1].volume - a[1].volume);
  const maxMuscle = Math.max(...muscleRows.map(([, v]) => v.volume), 1);
  const next = nextPlanAfter(ws, workout.name);
  const setCount = detail.items.reduce((a, i) => a + i.sets.length, 0);
  const avgRpe = setCount ? Math.round((detail.items.flatMap((i) => i.sets).reduce((a, s) => a + s.rpe, 0) / setCount) * 10) / 10 : 0;
  const topSet = detail.items.flatMap((i) => i.sets).sort((a, b) => b.weightKg * b.reps - a.weightKg * a.reps)[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-panel">
        <div className="pointer-events-none absolute -right-20 -top-32 size-[440px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.14),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-30 [mask-image:radial-gradient(circle_at_100%_0%,black,transparent_65%)]" />
        <div className="relative p-6 md:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="acid"><CheckCircle2 className="size-3" /> Session complete</Badge>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-dim">
              {new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 className="mt-3 font-display text-[34px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[52px]">{workout.name}</h1>
          <p className="mt-2 text-[12.5px] text-mist md:text-[13.5px]">{workout.focus}</p>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-4 md:gap-8">
            <Stat label="Volume" value={formatVolume(workout.totalVolume)} unit="kg" accent="#C9F73A" hint="Total work performed" />
            <Stat label="Duration" value={formatDuration(workout.durationSec)} unit="" hint={`${formatClock(workout.durationSec)} moving`} />
            <Stat label="Working sets" value={setCount} unit={`of ${detail.items.reduce((a, i) => a + i.targetSets, 0)}`} hint={`Avg RPE ${avgRpe || "—"}`} />
            <Stat label="Calories" value={workout.calories || Math.round((workout.durationSec / 3600) * user.weightKg * 6.5)} unit="kcal" hint="Estimated burn" accent="#FF6B35" />
          </div>

          {sharePrs.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber/20 bg-amber/[0.05] p-4">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-amber" />
                <p className="text-[12.5px] font-semibold text-amber">{sharePrs.length} new personal record{sharePrs.length > 1 ? "s" : ""} — {sharePrs.map((p) => p.exercise).join(", ")}</p>
              </div>
              <SummaryActions user={{ name: user.name, initials: user.initials }} prs={sharePrs} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/app/train" size="md" variant="secondary"><Dumbbell className="size-3.5" /> Back to training</ButtonLink>
            <ButtonLink href="/app/progress" size="md" variant="ghost"><TrendingUp className="size-3.5" /> View analytics</ButtonLink>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="p-5 md:p-6 lg:col-span-7">
          <CardHeader label="Set log" title="Every rep accounted for" action={<Badge tone="neutral">{detail.items.length} lifts</Badge>} />
          <div className="mt-4 space-y-3">
            {detail.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: muscleColor(item.exercise.primaryMuscle) }} />
                    <p className="truncate text-[12px] font-medium text-chalk/90">{item.exercise.name}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">{muscleLabel(item.exercise.primaryMuscle)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.sets.map((s) => (
                    <span key={s.id} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-numeric text-[10px] ${s.isPR ? "border-amber/30 bg-amber/10 text-amber" : "border-white/[0.07] bg-white/[0.03] text-mist"}`}>
                      {s.isPR && <Trophy className="size-2.5" />}
                      {s.weightKg}kg × {s.reps} <span className="text-dim">@{s.rpe}</span>
                    </span>
                  ))}
                  {!item.sets.length && <span className="text-[10.5px] text-dim">No sets logged</span>}
                </div>
              </div>
            ))}
          </div>

          {workout.notes && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="mb-1 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-dim"><MessageSquare className="size-3" /> Your notes</p>
              <p className="text-[11.5px] leading-relaxed text-mist">{workout.notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:col-span-5">
          <Card className="p-5 md:p-6">
            <CardHeader label="Stimulus map" title="Where the work landed" />
            <div className="mt-4 space-y-3">
              {muscleRows.map(([muscle, v]) => (
                <div key={muscle}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] text-chalk/80"><span className="size-1.5 rounded-full" style={{ background: muscleColor(muscle) }} />{muscleLabel(muscle)}</span>
                    <span className="font-numeric text-[9.5px] text-dim">{v.sets} sets · {formatVolume(v.volume)}kg</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (v.volume / maxMuscle) * 100)}%`, background: muscleColor(muscle) }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <CardHeader label="Next up" title={next?.name ?? "Recovery day"} action={<Badge tone="sky"><CalendarDays className="size-2.5" /> auto</Badge>} />
            <p className="mt-2 text-[11.5px] leading-relaxed text-mist">
              {next ? next.focus : "No session scheduled. Forge will suggest a recovery or accessory day based on your fatigue map."}
            </p>
            {topSet && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><Zap className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-dim">Top set</p>
                  <p className="text-[11.5px] font-medium text-chalk">{topSet.weightKg}kg × {topSet.reps} reps</p>
                </div>
                <span className="font-numeric text-[12px] text-acid">{Math.round(topSet.weightKg * (1 + topSet.reps / 30))}kg e1RM</span>
              </div>
            )}
            <div className="mt-4 flex items-center gap-1.5 text-[10.5px] text-dim">
              <Sparkles className="size-3 text-acid" /> Load auto-adjusted from tonight&apos;s RPE
            </div>
          </Card>

          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[radial-gradient(circle,rgba(255,107,53,0.16),transparent_70%)]" />
            <div className="flex items-center gap-2"><Flame className="size-4 text-flame" /><p className="text-[12px] font-semibold">{user.streak}-day streak extended</p></div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist">+{Math.round(workout.totalVolume / 60) + 60} XP · {computeLevelProgress(user.xp).progress}% • Level {computeLevelProgress(user.xp).level} · Ranked in the top 3% for consistency.</p>
            <Link href="/app/social" className="mt-3 flex items-center gap-1 text-[10.5px] text-flame hover:text-chalk">Share to your crew <ArrowRight className="size-3" /></Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
