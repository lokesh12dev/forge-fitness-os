import {
  Activity, Brain, Dumbbell, Flame, HeartPulse, Moon, Salad, Sparkles,
  Target, Utensils, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace, nutritionTotals } from "@/lib/queries";
import { e1rm, readinessVerdict, recoveryMap } from "@/lib/engine";
import { Badge, ProgressBar } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { CoachChat, type ChatMessage, type CoachContextSnapshot } from "@/components/coach-client";
import { AiHubPanels } from "@/components/ai/ai-hub-panels";

export default async function CoachPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const messages: ChatMessage[] = ws.coach.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.createdAt).getTime(),
  }));

  const verdict = readinessVerdict(ws.readiness);
  const metric = ws.latestMetric;
  const totals = nutritionTotals(ws);
  const proteinLeft = Math.max(0, ws.targets.protein - totals.protein);
  const calorieLeft = Math.max(0, ws.targets.calories - totals.calories);

  const recovery = recoveryMap(
    ws.sets.map((s) => ({
      primaryMuscle: ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core",
      completedAt: s.completedAt,
      weightKg: s.weightKg,
      reps: s.reps,
    })),
  );
  const weakest = Object.entries(recovery)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.recovery - b.recovery)[0];

  const nextDay = (() => {
    const routine = ws.enrolledRoutine;
    if (!routine) return null;
    const days = ws.routineDays.filter((d) => d.routineId === routine.id).sort((a, b) => a.dayIndex - b.dayIndex);
    if (!days.length) return null;
    const done = ws.weekWorkouts.length;
    return days[done % days.length];
  })();

  const sessionCount = ws.completedWorkouts.length;
  const adherence = ws.enrolledRoutine
    ? Math.min(100, Math.round((ws.weekWorkouts.length / Math.max(1, ws.enrolledRoutine.daysPerWeek)) * 100))
    : 0;

  const latestWorkout = ws.completedWorkouts[0] ?? null;
  const latestWorkoutSets = latestWorkout
    ? ws.sets.filter((s) => s.workoutId === latestWorkout.id)
    : [];
  const bestByEx = new Map<string, { name: string; weightKg: number; reps: number; e1rm: number }>();
  for (const s of latestWorkoutSets) {
    const exName = ws.exerciseMap.get(s.exerciseId)?.name ?? "Lift";
    const score = e1rm(s.weightKg, s.reps);
    const prev = bestByEx.get(s.exerciseId);
    if (!prev || score > prev.e1rm) {
      bestByEx.set(s.exerciseId, {
        name: exName,
        weightKg: s.weightKg,
        reps: s.reps,
        e1rm: Math.round(score * 10) / 10,
      });
    }
  }

  const bpCounts = new Map<string, number>();
  for (const s of ws.sets) {
    const pm = ws.exerciseMap.get(s.exerciseId)?.primaryMuscle ?? "core";
    bpCounts.set(pm, (bpCounts.get(pm) ?? 0) + 1);
  }

  const coachContext: CoachContextSnapshot = {
    sessionsCount: sessionCount,
    setsCount: ws.sets.length,
    readiness: ws.readiness,
    goal: user.goal || "Build muscle",
    experience: user.experience || "Training regularly",
    equipment: Array.isArray(user.equipment) ? user.equipment : ["barbell", "dumbbell", "bodyweight"],
    lastWorkout: latestWorkout
      ? {
          id: latestWorkout.id,
          name: latestWorkout.name,
          focus: latestWorkout.focus,
          dateLabel: new Date(latestWorkout.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          durationMin: Math.max(15, Math.round(latestWorkout.durationSec / 60)),
          totalVolume: Math.round(latestWorkout.totalVolume),
          setCount: latestWorkoutSets.length,
          prsCount: ws.prs.filter((p) => p.workoutId === latestWorkout.id).length,
          bestLifts: [...bestByEx.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, 5),
        }
      : null,
    bodyPartSets: [...bpCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([part, sets]) => ({ part, sets })),
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Coach online</Badge>
            <Badge tone="grape"><Brain className="size-2.5" /> Adaptive engine</Badge>
            <span className="label-mono text-dim">Knows your last {sessionCount} sessions</span>
          </>
        }
        title="Your corner."
        subtitle="Not a chatbot with a pump-up quote. Coach builds your plan from your answers and adjusts it from what you actually log — nothing changes until you say so."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <CoachChat
            initialMessages={messages}
            user={{ name: user.name, initials: user.initials, accent: user.accent }}
            context={coachContext}
          />
        </div>

        <div className="space-y-4 xl:col-span-4">
          {/* COACH PROFILE */}
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.12),transparent_65%)]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-acid/10 font-display text-base font-bold text-acid">
                  FX
                </span>
                <div>
                  <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-chalk">Forge Coach</p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Strength · Nutrition · Recovery</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Evidence-based", "Auto-regulating", "24/7"].map((t) => (
                  <span key={t} className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
                <div>
                  <p className="label-mono mb-1">Sessions</p>
                  <p className="font-numeric text-sm font-semibold text-chalk">{sessionCount}</p>
                </div>
                <div>
                  <p className="label-mono mb-1">Sets read</p>
                  <p className="font-numeric text-sm font-semibold text-chalk">{ws.sets.length}</p>
                </div>
                <div>
                  <p className="label-mono mb-1">Adherence</p>
                  <p className="font-numeric text-sm font-semibold text-acid">{adherence}%</p>
                </div>
              </div>
            </div>
          </Card>

          {/* LIVE CONTEXT */}
          <Card className="p-5">
            <CardHeader
              label="Live context"
              title="What I'm seeing"
              action={<Badge tone={ws.readiness >= 80 ? "acid" : ws.readiness >= 65 ? "mint" : "amber"}>{verdict.label}</Badge>}
            />
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-acid/10 text-acid"><Activity className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-medium text-chalk">Readiness</p>
                    <p className="font-numeric text-[10px] text-acid">{ws.readiness}/100</p>
                  </div>
                  <div className="mt-1.5"><ProgressBar value={ws.readiness} color="#C9F73A" height={3} /></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim"><Moon className="size-2.5 text-sky" /> Sleep</p>
                  <p className="mt-1 font-numeric text-[13px] font-semibold text-chalk">
                    {metric?.sleepHours?.toFixed(1) ?? "—"}<span className="ml-0.5 text-[8px] font-normal text-dim">h</span>
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <p className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim"><HeartPulse className="size-2.5 text-grape" /> HRV</p>
                  <p className="mt-1 font-numeric text-[13px] font-semibold text-chalk">
                    {metric?.hrv ?? "—"}<span className="ml-0.5 text-[8px] font-normal text-dim">ms</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-mint/10 text-mint"><Salad className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-medium text-chalk">Protein remaining</p>
                    <p className="font-numeric text-[10px] text-mint">{proteinLeft}g</p>
                  </div>
                  <div className="mt-1.5"><ProgressBar value={(totals.protein / Math.max(1, ws.targets.protein)) * 100} color="#7BE0AD" height={3} /></div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-flame/10 text-flame"><Flame className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-medium text-chalk">Least recovered</p>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-flame">
                      {weakest ? `${weakest.recovery}%` : "—"}
                    </p>
                  </div>
                  <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
                    {weakest ? weakest.key.replace(/_/g, " ") : "No sets logged"}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* NEXT SESSION */}
          <Card className="p-5">
            <CardHeader label="The plan" title="Next session" action={<Dumbbell className="size-4 text-acid" />} />
            {nextDay ? (
              <>
                <p className="mt-3 font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-chalk">{nextDay.name}</p>
                <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">{nextDay.focus}</p>
                <div className="mt-3 space-y-1.5">
                  {ws.routineExercises
                    .filter((re) => re.routineDayId === nextDay.id)
                    .sort((a, b) => a.position - b.position)
                    .slice(0, 4)
                    .map((re) => {
                      const ex = ws.exerciseMap.get(re.exerciseId);
                      return (
                        <div key={re.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                          <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">{re.sets}×{re.repsMin}–{re.repsMax}</span>
                          <span className="min-w-0 flex-1 truncate text-[10.5px] text-chalk/85">{ex?.name ?? "Exercise"}</span>
                          <span className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-dim">{ex?.equipment}</span>
                        </div>
                      );
                    })}
                </div>
                <a
                  href={`/app/train?day=${nextDay.id}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-acid px-3 py-2 text-[11px] font-semibold text-ink transition-colors hover:bg-acid-deep"
                >
                  <Zap className="size-3.5" /> Start with coach
                </a>
              </>
            ) : (
              <p className="mt-4 text-[11px] leading-relaxed text-dim">Enroll in a program and the coach will lay out your next session here.</p>
            )}
          </Card>

          {/* CAPABILITIES */}
          <Card className="p-5">
            <CardHeader label="Under the hood" title="What I factor in" action={<Sparkles className="size-4 text-grape" />} />
            <div className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-dim">
              {[
                { icon: Moon, title: "Sleep + HRV", body: "Readiness blends last night's recovery with 7-day load." },
                { icon: Dumbbell, title: "Set-by-set RPE", body: "Every logged set recalibrates next session's loads." },
                { icon: Utensils, title: "Macro gap", body: "Protein and calorie gaps become food, not generic advice." },
                { icon: Target, title: "Strength standards", body: "Prescriptions target your next bodyweight-relative tier." },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.title} className="flex gap-2.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-white/[0.04] text-mist">
                      <Icon className="size-3" />
                    </span>
                    <div>
                      <p className="text-[10.5px] font-semibold text-chalk/85">{row.title}</p>
                      <p className="text-[10px] text-dim">{row.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-2.5 text-[9.5px] leading-relaxed text-dim">
              {calorieLeft} kcal left today. {proteinLeft > 0 ? `Close the ${proteinLeft}g protein gap before bed.` : "Protein is handled — get to sleep."}
            </div>
          </Card>
        </div>
      </div>

      <AiHubPanels />
    </>
  );
}
