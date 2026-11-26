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

  if (/weekly|check-in|checkin|audit|summary|review/.test(m)) {
    const lowest = [...ctx.recovery].sort((a, b) => a.recovery - b.recovery)[0];
    const proteinPct = Math.round((ctx.proteinConsumed / Math.max(1, ctx.proteinTarget)) * 100);
    const topPr = ctx.prs[0];
    return `**Weekly Check-In Audit · ${ctx.name}**\n\n- **Consistency & Streak:** ${ctx.streak}-day active streak on **${ctx.programName}**. Last session: ${ctx.lastWorkout ? `${ctx.lastWorkout.name} (${fmt(ctx.lastWorkout.volume)}kg total tonnage)` : "ready for first log"}.\n- **CNS & Sleep Recovery:** Readiness **${ctx.readiness}/100** (${ctx.sleep}h sleep, HRV ${ctx.hrv}ms). ${lowest ? `Lowest muscle readiness: **${lowest.label}** at ${lowest.recovery}%.` : ""}\n- **Nutrition Compliance:** ${fmt(ctx.caloriesConsumed)} / ${fmt(ctx.caloriesTarget)} kcal · **${proteinPct}%** of protein floor hit (${fmt(ctx.proteinConsumed)}g / ${ctx.proteinTarget}g).\n${topPr ? `- **Lead Strength Marker:** ${topPr.exercise} e1RM at **${topPr.value}kg**.\n` : ""}\n**Next Week Prescription:** ${ctx.readiness >= 75 ? "Push +2.5kg progressive overload on primary compounds and maintain sleep above 7.5h." : "Hold working weights steady, cap sets at RPE 7.5, and add 45 min nightly sleep before ramping volume."}`;
  }

  if (/form|technique|bar path|depth|pose|video/.test(m)) {
    return `**Biomechanics & Form Check Protocol:**\nOpen **AI Form Check** (/app/form-check) to inspect joint angles and barbell path stability.\n\n**Top Technical Cues for ${ctx.planName}:**\n1. **Setup & Bracing:** Create 360° intra-abdominal pressure before un-racking; stack ribcage over pelvis.\n2. **Eccentric Control:** Use a crisp 2–3 second lowering phase to maximize mechanical tension without momentum.\n3. **Bar Path Audit:** Keep vertical alignment over mid-foot on squats/pulls and stack elbows 45° beneath wrists on presses.\n\nRecord 3 working reps from a 45° front-side angle and upload in **Form Check** for real-time joint symmetry scoring.`;
  }

  if (/shoulder|rotator|impingement|knee|patella|lower back|lumbar|elbow|wrist|pain|hurt|ache|tweak/.test(m)) {
    if (/shoulder|rotator|impingement/.test(m)) {
      return `**Soreness-Aware Load Regulation · Shoulder Protection**\nReadiness is **${ctx.readiness}/100**. Do not grind through anterior shoulder pinch.\n\n**Auto-Regulated Swaps for Today:**\n1. **Barbell Bench Press** → Neutral-Grip Dumbbell Floor Press (limits terminal shoulder extension, caps RPE at 7.5)\n2. **Overhead Barbell Press** → Landmine Single-Arm Press (scapular-plane path, zero impingement)\n3. **Dip / Upright Row** → Cable Face Pulls + Sidelying External Rotation (2×15 activation)\n\nDrop working load 15% today and pause 1 second at bottom range to rebuild tendon tolerance.`;
    }
    if (/knee|patella|quad tendon/.test(m)) {
      return `**Soreness-Aware Load Regulation · Knee Joint Care**\nReadiness is **${ctx.readiness}/100**. Shifting stress from patellar tendon shear toward hip musculature:\n\n**Auto-Regulated Swaps for Today:**\n1. **High-Bar Back Squat** → Tempo Box Squat or Spanish Squat Isometric (controlled shin verticality)\n2. **Leg Extension / Jumping Lunges** → Barbell Romanian Deadlift or Hip Thrust (posterior-chain dominant)\n3. **Warm-up Protocol:** 3 minutes retrograde treadmill walk + 2×45s wall-sit analgesic hold.\n\nKeep RPE ≤ 7.5 on knee-flexion patterns today.`;
    }
    if (/back|lumbar|spine|disc/.test(m)) {
      return `**Soreness-Aware Load Regulation · Lumbar Relief**\nReadiness is **${ctx.readiness}/100**. Removing axial spinal compression while preserving stimulus:\n\n**Auto-Regulated Swaps for Today:**\n1. **Conventional Deadlift** → Chest-Supported Row + 45° Back Extension (zero shear load)\n2. **Barbell Back Squat** → Belt Squat or Leg Press with neutral pelvis\n3. **Stability Reset:** McGill Big-3 (Bird-Dog, Side Plank, Curl-up) prior to working sets.\n\nTrim bilateral axial loads by 20% and switch to unilateral dumbbell variations.`;
    }
    return `**Soreness-Aware Load Regulation** (Readiness **${ctx.readiness}/100**):\nJoint discomfort requires immediate movement pattern modification rather than pushing through failure:\n- Drop working intensity by **12–15%** and switch from fixed barbell paths to neutral-grip dumbbells or cables.\n- Cap exertion at **RPE 7** (3 reps in reserve) and slow eccentrics to 3 seconds.\n- Use the **Swap** drawer on your active session to pick a joint-friendly match.`;
  }

  if (/time|short|busy|quick|15|20|25|30|40|minutes|crunch/.test(m)) {
    const minsMatch = m.match(/\b(15|20|25|30|40)\b/);
    const targetMins = minsMatch ? Number(minsMatch[1]) : 25;
    const exercises = ctx.planExercises.length
      ? ctx.planExercises
      : ["Barbell Bench Press", "Barbell Row", "Overhead Press", "Lateral Raise"];
    const first = exercises[0] ?? "Primary Compound";
    const second = exercises[1] ?? "Antagonist Pull";
    const third = exercises[2] ?? "Accessory Isolations";

    return `**Time-Crunch Adaptive Plan · ${targetMins} Minutes (${ctx.planName})**\nWe can compress **${ctx.planName}** without losing effective hypertrophy stimulus by pairing antagonists and trimming rest:\n\n1. **0:00–03:00 · Ramp Warm-Up:** 2 quick progressive ramp sets (50% × 6, 75% × 3) on **${first}**.\n2. **03:00–${targetMins <= 20 ? "13:00" : "18:00"} · Superset Block A:** Pair **${first}** (3×6–8 @ RPE 8) immediately with **${second}** (3×8–10). Rest **45s** between rounds.\n3. **${targetMins <= 20 ? "13:00" : "18:00"}–${targetMins}:00 · Myo-Rep Density Finisher:** Perform 1 activation set of **${third}** (12–15 reps) + 3 mini-sets of 4 reps with 15s breaths.\n\nTap **Compress** on the active workout screen to restructure rest timers live.`;
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

  if (/sore|tired|recover|sleep|fatigue/.test(m)) {
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
