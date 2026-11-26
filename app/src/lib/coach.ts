import { proteinPlan } from "./engine";

export type CoachContext = {
  name: string;
  readiness: number;
  sleep: number;
  hrv: number;
  proteinTarget: number;
  proteinConsumed: number;
  caloriesTarget: number;
  caloriesConsumed: number;
  planName: string;
  planFocus: string;
  planExercises: string[];
  programName: string;
  lastWorkout: { name: string; daysAgo: number; volume: number } | null;
  prs: { exercise: string; value: number }[];
  recovery: { label: string; recovery: number }[];
  streak: number;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function coachReply(message: string, ctx: CoachContext): string {
  const m = message.toLowerCase();
  const path = ctx.planExercises.slice(0, 3).join(", ");

  if (/protein|macro|eat|meal|nutrition|food/.test(m)) {
    const remaining = Math.max(0, Math.round(ctx.proteinTarget - ctx.proteinConsumed));
    const plan = proteinPlan(remaining);
    if (remaining <= 0) {
      return `You've already hit ${fmt(ctx.proteinConsumed)}g of protein — target cleared. Keep calories in range and prioritize whole foods for the rest of the day. Hydrate: 500ml now, then 1.5L before bed.`;
    }
    return `You have **${remaining}g of protein left** today (${fmt(ctx.proteinConsumed)}g / ${ctx.proteinTarget}g). The fastest path:\n\n${plan.map((p, i) => `${i + 1}. ${p.name} — ${p.serving} · ${p.protein}g protein, ${p.calories} kcal`).join("\n")}\n\nThat closes the gap without blowing your ${fmt(ctx.caloriesTarget - ctx.caloriesConsumed)} remaining kcal. Log it by photo or say "add ${plan[0]?.name ?? "whey"}" and I'll handle it.`;
  }

  if (/bench|squat|deadlift|press|pr|strong/.test(m)) {
    const lift = ctx.prs.find((p) => m.includes(p.exercise.toLowerCase().split(" ").slice(-1)[0])) ?? ctx.prs[0];
    if (!lift) return `No PRs logged yet. Start with a top set at RPE 8 and I'll calculate your e1RM from it. Your first milestone: a bodyweight bench press.`;
    return `Your best estimated 1RM on **${lift.exercise}** is **${lift.value}kg**. At readiness ${ctx.readiness}, today is a ${ctx.readiness >= 80 ? "green light for a top set" : "technique day, not a PR day"}. ${ctx.readiness >= 80 ? "Warm up in 5 steps, then take 90% of your e1RM for 3–5 reps at RPE 8. If bar speed is crisp, add 2.5kg." : "Stay at 85% for clean triples and bank the volume."} Do not test a true 1RM more than once every 8–10 weeks.`;
  }

  if (/time|short|busy|quick|25|30|minutes/.test(m)) {
    return `We can compress **${ctx.planName}** without losing volume. I'll pair ${path} into supersets, cut rest to ~45s, and keep every working set. That lands around 25–28 minutes. Tap **Compress session** on the workout screen — I'll restructure it live. Warm up with 2 quick ramp sets per first lift; skip generic cardio.`;
  }

  if (/sore|tired|recover|sleep|fatigue|hurt/.test(m)) {
    const lowest = [...ctx.recovery].sort((a, b) => a.recovery - b.recovery)[0];
    return `Readiness is **${ctx.readiness}/100** — sleep ${ctx.sleep}h, HRV ${ctx.hrv}ms. ${lowest ? `${lowest.label} is your least-recovered group at ${lowest.recovery}%.` : ""} ${
      ctx.readiness < 60
        ? "I'd swap the heavy top set for 2×8 at 70%, keep the accessory volume, and add 10 minutes of zone-2. Recovery is training too."
        : "You're clear to train. Keep the top set at RPE 8, not 10, and take the full rest on compounds. If a joint hurts (not muscle soreness), stop that movement — we'll swap it."
    }`;
  }

  if (/program|routine|plan|next/.test(m)) {
    return `You're on **${ctx.programName}**. Next session is **${ctx.planName}** — ${ctx.planFocus}. Main work: ${path}. Your last completed session was ${ctx.lastWorkout ? `${ctx.lastWorkout.name}, ${ctx.lastWorkout.daysAgo === 0 ? "today" : `${ctx.lastWorkout.daysAgo} days ago`}, ${fmt(ctx.lastWorkout.volume)}kg moved` : "not logged yet"}. Streak: ${ctx.streak} days. Start the session from your dashboard and I'll auto-regulate the loading as you log RPE.`;
  }

  return `Here's your snapshot: readiness **${ctx.readiness}**, ${ctx.streak}-day streak, ${fmt(ctx.caloriesConsumed)}/${fmt(ctx.caloriesTarget)} kcal and ${fmt(ctx.proteinConsumed)}/${ctx.proteinTarget}g protein so far.\n\nToday: **${ctx.planName}** (${ctx.planFocus}). ${ctx.readiness >= 75 ? "Train as planned — top set RPE 8." : "Trim intensity 5–8% and keep quality high."}\n\nTwo things that would move the needle most:\n1. ${ctx.proteinTarget - ctx.proteinConsumed > 0 ? `Close the ${Math.round(ctx.proteinTarget - ctx.proteinConsumed)}g protein gap before 9pm.` : "Protein is handled — focus on sleep tonight."}\n2. ${ctx.readiness < 70 ? "Get to bed 45 minutes earlier; sleep is your biggest lever right now." : "Log every working set today — the adaptive engine gets sharper with each RPE."}\n\nAsk me about a lift, your recovery, or say "I only have 25 minutes."`;
}
