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

  if (/plateau|stall|stuck|progress/.test(m)) {
    return `Plateau detected on primary strength curves. When bar load stalls for 3+ consecutive sessions at high exertion (RPE ≥ 8), the neuromuscular system has saturated under the current rep protocol.\n\n**Three proven strategies to break the stall:**\n1. **Micro-Loading (+0.5–1.0kg):** Standard 2.5kg jumps increase load by 3-5%, exceeding adaptive capacity. Use 0.5kg micro-plates to maintain progression momentum.\n2. **Periodized Rep Shift:** If you stalled at 5×5, shift to 3×8 at 85% load for 3 weeks to accumulate myofibrillar hypertrophy, then return to heavy 5s.\n3. **10% Back-Off Reset:** Drop load 10% for one week, prioritize explosive concentric bar speed, and climb back up over 3 weeks.`;
  }

  if (/deload|rest week|light week|taper/.test(m)) {
    return `A scheduled **deload week** clears central nervous system (CNS) fatigue while preventing systemic overtraining:\n\n**The FORGE Deload Protocol:**\n- **Intensity:** Keep working weights at 65–70% of 1RM (drop load 15–20%).\n- **Volume:** Cut total working sets in half (e.g. 2 sets instead of 4).\n- **RPE:** Cap all sets strictly at RPE 6–7. Zero sets to failure.\n- **Restoration:** Increase sleep by 30–60 minutes, keep daily protein at 2.0g/kg to repair connective tissues.\n\nYou will return next week with refreshed joint health and heightened insulin sensitivity for new hypertrophy gains.`;
  }

  if (/crowded|busy|taken|occupied|rack|bench full/.test(m)) {
    return `Gym packed and barbell stations taken? Tap **Crowded Gym Mode** on your active session to auto-swap barbell lifts without losing stimulus:\n\n- **Barbell Bench Press** → Heavy Dumbbell Bench Press (deeper pec stretch, zero rack required)\n- **Barbell Back Squat** → Dumbbell Bulgarian Split Squat (+2 reps, eliminates spinal compression)\n- **Barbell Deadlift** → Dumbbell Romanian Deadlift (intense hamstring & glute tension)\n- **Barbell Row** → One-Arm Dumbbell Row (unilateral lat isolation with bench support)`;
  }

  if (/missed|skip|reschedule|couldn't make it/.test(m)) {
    return `Missed a workout? Never panic or double-book grueling two-a-days. FORGE offers three smart rebalancing strategies:\n\n1. **Rolling Slide (Recommended):** Shifts remaining days forward by 1 calendar day so your scheduled split is completed in order without dropping sets.\n2. **Antagonist Superset Merge:** Merges the key compound lifts of the missed session with your next workout using opposing supersets (45 min total).\n3. **Forgive & Advance:** Skips the missed day cleanly, advances the macrocycle wave, and adds 1 bonus set to that muscle group next week.`;
  }

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
