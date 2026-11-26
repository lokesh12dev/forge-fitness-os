import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Award, BarChart3, Battery, Brain, Camera,
  Check, ChevronRight, CircleDollarSign, Dumbbell, Flame, HeartPulse,
  Layers, MessageSquare, Mic, Minus, Play, ScanFace, ShieldCheck, Sparkles,
  Target, Timer, TrendingUp, Trophy, Users, Utensils, Wand2, Zap,
} from "lucide-react";
import { Badge, ButtonLink, Logo } from "@/components/ui";
import { Ring } from "@/components/charts";
import { BodyMap } from "@/components/body-map";
import { LandingDemo } from "@/components/landing-demo";
import { requireUser } from "@/lib/auth";
import { getWorkspace, programDays, todayPlan, nutritionTotals, lastSetFor } from "@/lib/queries";
import { readinessScore, readinessVerdict, computeLevelProgress, estimateSessionMinutes, recoveryMap, suggestedLoad } from "@/lib/engine";
import { formatVolume, clamp } from "@/lib/utils";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#intelligence", label: "Intelligence" },
  { href: "#principles", label: "Principles" },
  { href: "#pricing", label: "Pricing" },
];

const FEATURES = [
  {
    icon: Wand2,
    title: "A workout that rewrites itself",
    body: "Missed a rack? Only 25 minutes? Slept four hours? Forge re-plans the session in one tap — same stimulus, new constraints. No program broken, no guilt spiral.",
    span: "md:col-span-2",
    tone: "#C9F73A",
  },
  {
    icon: Mic,
    title: "Log like you talk",
    body: "“Bench 185 for eight, felt like a seven.” Voice or natural text becomes a fully structured set with RPE, e1RM and fatigue signal.",
    tone: "#6EA8FF",
  },
  {
    icon: ScanFace,
    title: "A camera squat-count pilot",
    body: "A side-view pose overlay counts squat-like bend-and-return cycles in your browser. Form scores, bar-path analysis and coaching cues are not live yet.",
    tone: "#B49CFF",
  },
  {
    icon: Camera,
    title: "Photo-to-macro",
    body: "Point at the plate. Regional and home food included — dal, jollof, shakshuka, bibimbap. Confirm, don't type.",
    tone: "#FFD166",
  },
  {
    icon: Utensils,
    title: "Protein-gap generator",
    body: "60g short at 9pm? It builds the smallest possible meal that closes the gap without blowing the day.",
    tone: "#7BE0AD",
  },
  {
    icon: HeartPulse,
    title: "A recovery map, not a guess",
    body: "Every set feeds a per-muscle fatigue model. Tomorrow's plan knows what's cooked before you do.",
    tone: "#FF6B35",
  },
  {
    icon: Trophy,
    title: "PR cards worth posting",
    body: "One tap turns a set into an Instagram-ready card with the number, the delta, and zero cringe.",
    tone: "#FFD166",
    span: "md:col-span-2",
  },
];

const COMPARISON = [
  { feature: "Adaptive workout engine", forge: true, tracker: false, coach: "partial", nutrition: false, social: false },
  { feature: "Equipment swaps mid-session", forge: true, tracker: false, coach: "partial", nutrition: false, social: false },
  { feature: "Voice / natural-language logging", forge: true, tracker: "partial", coach: false, nutrition: "partial", social: false },
  { feature: "Live camera squat rep-count pilot", forge: true, tracker: false, coach: false, nutrition: false, social: false },
  { feature: "Photo macro scanner", forge: true, tracker: false, coach: false, nutrition: true, social: false },
  { feature: "Muscle recovery heatmap", forge: true, tracker: "partial", coach: false, nutrition: false, social: false },
  { feature: "Live community + challenges", forge: true, tracker: "partial", coach: false, nutrition: false, social: "partial" },
  { feature: "PR share cards", forge: true, tracker: "partial", coach: false, nutrition: false, social: "partial" },
];

const PRODUCT_PRINCIPLES = [
  {
    title: "Adapt to the day",
    body: "Keep the training intent. Adjust for the equipment, time and readiness you actually have.",
    accent: "#FF6B35",
  },
  {
    title: "Separate signal from sample",
    body: "Live camera mode shows a pose overlay and a rough squat count. Example scores stay visibly labeled as examples.",
    accent: "#6EA8FF",
  },
  {
    title: "Explain the next step",
    body: "Show the inputs behind an adaptation so athletes can understand, question and override it.",
    accent: "#FFD166",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "The full tracker. No trial timer.",
    features: ["Unlimited workout logging", "Full exercise library", "Macro tracking", "PR cards", "Community feed"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$14",
    cadence: "/ month",
    blurb: "The adaptive engine, unlocked.",
    features: ["Adaptive program engine", "Equipment swaps + compression", "Squat rep-count pilot", "Photo-to-macro scanner", "Recovery heatmap", "AI coach with your data"],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Black",
    price: "$29",
    cadence: "/ month",
    blurb: "For people whose sport is the gym.",
    features: ["Everything in Pro", "Advanced periodization", "Strength standards + peaks", "Early access to pose pilots", "Coach sharing & client seats", "Early feature access"],
    cta: "Go Black",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Is Forge just another workout tracker?",
    a: "No. A tracker records what happened. Forge decides what should happen next — using your logged RPE, sleep, HRV, equipment, available time and recovery map. The log is an input, not the product.",
  },
  {
    q: "Do I have to follow your program?",
    a: "No. Follow one of Forge's programs, import a coach's plan, or build your own. The adaptive layer works on top of any structure, and you can always override a prescription.",
  },
  {
    q: "Does the camera upload my videos?",
    a: "Live camera frames are processed in your browser and this feature does not upload or save frames or landmarks. First use downloads MediaPipe runtime files from jsDelivr and the pose model from Hugging Face. MediaPipe documents usage/performance metrics sent to Google; its privacy notice says input media is not sent. The current pilot counts squat-like bend-and-return cycles; it does not produce a form score or coaching cues.",
  },
  {
    q: "What if I train at home with almost nothing?",
    a: "Tell Forge what you have. Every movement has same-pattern alternatives — a barbell squat becomes a dumbbell front squat, then a tempo air squat. You get the stimulus, not an error message.",
  },
  {
    q: "Can I use it with a coach or a physio?",
    a: "Black tier supports a read-only training view with a coach. Camera form reports and cue exports are not available yet; the live pose pilot is a rough rep counter and is not an assessment.",
  },
];

export default async function LandingPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const weekSetsCount = ws.weekSets.length;
  const weekVolume = ws.weekSets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const weeklySessions = ws.weekWorkouts.length;
  const totalUsers = ws.users.length;
  const totalSets = ws.sets.length;
  const totalVolume = ws.sets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const readiness = ws.readiness;
  const metric = ws.latestMetric;

  const routine = ws.enrolledRoutine;
  const plan = todayPlan(ws);

  const muscleRecovery = recoveryMap(ws.sets.map((s) => {
    const ex = ws.exerciseMap.get(s.exerciseId);
    return {
      primaryMuscle: ex?.primaryMuscle ?? "chest",
      completedAt: s.completedAt,
      weightKg: s.weightKg,
      reps: s.reps,
    };
  }));
  return (
    <div className="relative overflow-x-clip">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 grid-lines opacity-[0.16] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(201,247,58,0.09),transparent_65%)]" />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Logo size="md" />
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-[12px] font-medium text-mist transition-colors hover:text-chalk">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-3 py-2 text-[12px] font-medium text-mist transition-colors hover:text-chalk sm:block">
              Sign in
            </Link>
            <ButtonLink href="/login" size="sm" className="gap-1.5">
              Start free <ArrowUpRight className="size-3.5" />
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-14 md:px-6 md:pt-20 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-acid/20 bg-acid/[0.06] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-acid">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" />
                The adaptive training OS
              </div>
              <h1 className="mt-5 font-display text-[clamp(2.7rem,6.2vw,5.2rem)] font-extrabold leading-[0.92] tracking-[-0.055em] text-chalk">
                Your program
                <br />
                has been
                <br />
                <span className="relative inline-block text-acid">
                  guessing.
                  <svg viewBox="0 0 300 18" className="absolute -bottom-1 left-0 w-full" preserveAspectRatio="none" aria-hidden>
                    <path d="M2 12C60 4 120 2 180 6C230 9 270 12 298 8" fill="none" stroke="#C9F73A" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
                  </svg>
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-[14.5px] leading-relaxed text-mist md:text-[15.5px]">
                Forge is one system for training, fuel and recovery. It reads your readiness, rewrites the session around your equipment and time, then tells you exactly what to do next — set by set.
              </p>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <ButtonLink href="/login" size="xl" className="gap-2">
                  Start training free <ArrowRight className="size-4" />
                </ButtonLink>
                <a href="#intelligence" className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full border border-white/10 px-5 text-[13px] font-semibold text-chalk transition-colors hover:border-white/20 hover:bg-white/[0.03]">
                  <Play className="size-3.5 text-acid" /> See it adapt
                </a>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
                <span className="flex items-center gap-1.5"><Check className="size-3 text-acid" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Check className="size-3 text-acid" /> Free forever tier</span>
                <span className="flex items-center gap-1.5"><Check className="size-3 text-acid" /> Your data, exportable</span>
              </div>
            </div>

            {/* HERO VISUAL */}
            <div className="animate-scale-in relative mx-auto w-full max-w-[500px] lg:max-w-none">
              <div className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_60%_40%,rgba(201,247,58,0.10),transparent_65%)] blur-2xl" />
              <div className="relative rounded-[26px] border border-white/10 bg-panel/80 p-3 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)] backdrop-blur">
                <div className="rounded-[18px] border border-white/[0.06] bg-ink-2 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-dim">
                        {new Date().toLocaleDateString("en-US", { weekday: "long" })} · Week {routine?.weeks ?? 1}
                      </p>
                      <p className="mt-1 font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-chalk">
                        {plan?.day.name ?? "Push A"} · {plan?.day.focus ?? "Chest bias"}
                      </p>
                    </div>
                    <Badge tone="acid" dot>{readinessVerdict(ws.readiness).label}</Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <Ring value={ws.readiness} size={92} stroke={7}>
                      <div className="text-center">
                        <p className="font-numeric text-[24px] font-bold leading-none tracking-[-0.05em]">{ws.readiness}</p>
                        <p className="mt-1 font-mono text-[6.5px] uppercase tracking-[0.14em] text-dim">readiness</p>
                      </div>
                    </Ring>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {[
                        { label: "Sleep", value: metric?.sleepHours != null ? `${metric.sleepHours}h` : "—h", pct: metric?.sleepHours != null ? Math.round(clamp(metric.sleepHours / 9 * 100, 0, 100)) : 50, color: "#6EA8FF" },
                        { label: "HRV", value: metric?.hrv != null ? `${metric.hrv} ms` : "— ms", pct: metric?.hrv != null ? Math.round(clamp((metric.hrv - 40) / 80 * 100, 0, 100)) : 50, color: "#B49CFF" },
                        { label: "Protein", value: `${nutritionTotals(ws).protein} / ${ws.targets.protein}g`, pct: ws.targets.protein > 0 ? Math.round(clamp(nutritionTotals(ws).protein / ws.targets.protein * 100, 0, 100)) : 50, color: "#7BE0AD" },
                      ].map((row) => (
                        <div key={row.label}>
                          <div className="flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.08em]">
                            <span className="text-dim">{row.label}</span>
                            <span className="text-mist">{row.value}</span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                            <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-acid">
                        <Sparkles className="size-2.5" /> Coach adjusted
                      </span>
                      <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-dim">{plan?.day.exercises.length} lifts today</span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-mist">
                      {readinessVerdict(ws.readiness).advice}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    {(plan?.day.exercises ?? []).slice(0, 3).map((item) => {
                      const load = suggestedLoad(lastSetFor(ws, item.exerciseId), item.repsMin);
                      return (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[9.5px] text-chalk/85">{item.exercise.name}</span>
                        <span className="font-mono text-[7.5px] text-dim">{item.sets} × {item.repsMin}–{item.repsMax}</span>
                        <span className="font-numeric text-[9px] font-semibold text-mist">{load != null ? <>{load}<span className="text-[6.5px] font-normal text-dim">kg</span></> : <span className="text-dim">—</span>}</span>
                      </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-acid px-3 py-2.5">
                    <Play className="size-3.5 text-ink" />
                    <span className="text-[11px] font-bold text-ink">Start session</span>
                    <span className="ml-auto font-mono text-[7.5px] uppercase tracking-[0.1em] text-ink/60">{plan ? estimateSessionMinutes(plan.day.exercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec, supersetGroup: e.supersetGroup }))) : 45} min</span>
                  </div>
                </div>

                {/* floating cards */}
                {ws.prs.length > 0 && (
                  <div className="absolute -left-6 top-28 hidden w-[168px] -rotate-3 rounded-xl border border-white/10 bg-panel-3/95 p-2.5 shadow-2xl backdrop-blur md:block">
                    <p className="flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.12em] text-amber">
                      <Trophy className="size-2.5" /> New PR
                    </p>
                    <p className="mt-1 font-numeric text-[17px] font-bold leading-none tracking-[-0.04em] text-chalk">{ws.prs[0].value}<span className="ml-0.5 text-[8px] font-normal text-dim">kg</span></p>
                    <p className="mt-1 text-[8px] text-dim">{ws.exerciseMap.get(ws.prs[0].exerciseId)?.name ?? "e1RM"} · new best</p>
                  </div>
                )}
                <div className="absolute -bottom-5 -right-4 hidden rounded-xl border border-white/10 bg-panel-3/95 px-3 py-2.5 shadow-2xl backdrop-blur md:block">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-acid/10 text-acid"><Camera className="size-3.5" /></span>
                    <div>
                      <p className="font-mono text-[7px] uppercase tracking-[0.1em] text-dim">Form check</p>
                      <p className="text-[9px] font-semibold text-chalk">Available in app</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] md:mt-20 md:grid-cols-4">
            <div className="bg-ink px-5 py-4">
              <p className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-chalk">{totalSets.toLocaleString()}</p>
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-dim">sets logged</p>
            </div>
            <div className="bg-ink px-5 py-4">
              <p className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-chalk">{totalUsers}</p>
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[-0.14em] text-dim">users training</p>
            </div>
            <div className="bg-ink px-5 py-4">
              <p className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-chalk">{formatVolume(weekVolume)}<span className="ml-1 text-[10px] font-normal text-dim">kg</span></p>
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-dim">weekly volume</p>
            </div>
            <div className="bg-ink px-5 py-4">
              <p className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] text-chalk">{weeklySessions}</p>
              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-dim">sessions this week</p>
            </div>
          </div>
        </section>

        {/* MARQUEE / SOCIAL PROOF */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] py-4">
          <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-hidden px-4 md:px-6">
            <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.16em] text-dim">Built for the way you actually train</span>
            <div className="flex flex-1 gap-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
              <div className="flex shrink-0 animate-marquee gap-8">
                {["POWERLIFTING", "HYPERTROPHY", "HYROX", "CALISTHENICS", "CROSSFIT", "BODYBUILDING", "HOME GYM", "ENDURANCE", "POWERLIFTING", "HYPERTROPHY", "HYROX", "CALISTHENICS"].map((t, i) => (
                  <span key={`${t}-${i}`} className="whitespace-nowrap font-display text-[12px] font-bold uppercase tracking-[0.08em] text-dim/70">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="label-mono mb-4 text-acid">The stack problem</p>
            <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
              Six apps. Six subscriptions.
              <br />
              <span className="text-dim">Zero coherence.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[13.5px] leading-relaxed text-mist">
              One app counts reps. Another counts calories. A wearable scores your sleep. A camera app judges your squat. None of them talk to each other — so you become the integration layer at 9pm, tired, guessing.
            </p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Dumbbell, title: "The tracker", body: "Perfect record of what you did. Useless at telling you what to do next.", tone: "#6EA8FF" },
              { icon: Utensils, title: "The food logger", body: "Knows your macros. Doesn't know you squat tomorrow and need 190g protein tonight.", tone: "#7BE0AD" },
              { icon: HeartPulse, title: "The wearable", body: "Says recovery is 62%. Offers no opinion on whether to deload or send it.", tone: "#FF6B35" },
              { icon: Trophy, title: "The social app", body: "Great for dopamine. Doesn't care whether your program is actually working.", tone: "#FFD166" },
              { icon: Brain, title: "The AI chatbot", body: "Generates a plan from thin air, remembers nothing, adapts never.", tone: "#B49CFF" },
              { icon: BarChart3, title: "The spreadsheet", body: "Infinitely flexible. Also infinitely abandoned by week three.", tone: "#8B919C" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${card.tone}12`, color: card.tone }}>
                      <Icon className="size-4" />
                    </span>
                    <p className="text-[12px] font-semibold text-chalk">{card.title}</p>
                    <Minus className="ml-auto size-4 text-dim" />
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-dim">{card.body}</p>
                </div>
              );
            })}
          </div>
          <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-acid/20 bg-acid/[0.05] px-5 py-4 text-center">
            <Zap className="size-4 shrink-0 text-acid" />
            <p className="text-[12px] leading-relaxed text-mist">
              Forge replaces the stack with one loop: <span className="font-semibold text-chalk">sense → decide → adapt</span>.
            </p>
          </div>
        </section>

        {/* INTELLIGENCE / DEMO */}
        <section id="intelligence" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="label-mono mb-4 text-acid">Adaptive intelligence</p>
                <h2 className="max-w-2xl font-display text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
                  Change the input.
                  <br />
                  Watch the workout change.
                </h2>
                <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-mist">
                  This is the actual logic, not a mockup. Drag readiness, pick your time, take away the barbell. The prescription adapts like it does in the app.
                </p>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 font-mono text-[8px] uppercase tracking-[0.12em] text-dim lg:flex">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> Interactive
              </div>
            </div>
            <div className="mt-8">
              <LandingDemo />
            </div>
          </div>
        </section>

        {/* PRODUCT BENTO */}
        <section id="product" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-2xl">
            <p className="label-mono mb-4 text-acid">The product</p>
            <h2 className="font-display text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
              Everything the gym asks of you.
              <br />
              <span className="text-dim">One place to answer.</span>
            </h2>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.14] ${f.span ?? ""}`}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(circle, ${f.tone}18, transparent 70%)` }} />
                  <span className="grid size-9 place-items-center rounded-xl" style={{ background: `${f.tone}12`, color: f.tone }}>
                    <Icon className="size-4" />
                  </span>
                  <h3 className="mt-3.5 font-display text-[17px] font-bold tracking-[-0.02em] text-chalk">{f.title}</h3>
                  <p className="mt-1.5 max-w-md text-[11.5px] leading-relaxed text-dim">{f.body}</p>
                </div>
              );
            })}
          </div>

          {/* deep dive strip */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-6 md:p-8">
              <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.2] [mask-image:radial-gradient(circle_at_10%_10%,black,transparent_60%)]" />
              <div className="relative">
                <p className="label-mono mb-3">Recovery intelligence</p>
                <h3 className="max-w-md font-display text-[26px] font-bold leading-[1.02] tracking-[-0.04em] text-chalk">
                  Train the muscle that&apos;s ready.
                  <br />
                  <span className="text-acid">Protect the one that isn&apos;t.</span>
                </h3>
                <p className="mt-3 max-w-sm text-[11.5px] leading-relaxed text-dim">
                  Every set decays against a per-muscle recovery curve built from volume, intensity and your own recovery data. Tomorrow&apos;s plan respects it automatically.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { label: "Chest", pct: 41, color: "#FF6B35" },
                    { label: "Shoulders", pct: 35, color: "#FF6B35" },
                    { label: "Quads", pct: 91, color: "#C9F73A" },
                    { label: "Calves", pct: 95, color: "#C9F73A" },
                  ].map((m) => (
                    <span key={m.label} className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-mist">
                      <span className="size-1.5 rounded-full" style={{ background: m.color }} /> {m.label} {m.pct}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-panel p-4">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-[radial-gradient(ellipse_at_50%_100%,rgba(201,247,58,0.10),transparent_70%)]" />
              <div className="flex items-center justify-between px-1 pt-1">
                <p className="label-mono">Your map tonight</p>
                <span className="flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-acid"><span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> Live</span>
              </div>
              <div className="flex justify-center">
                <BodyMap recovery={muscleRecovery} />
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] py-20 md:py-24">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="text-center">
              <p className="label-mono mb-4 text-acid">Honest comparison</p>
              <h2 className="font-display text-[clamp(1.9rem,3.8vw,3rem)] font-extrabold leading-[1] tracking-[-0.05em]">
                The only app that closes the loop.
              </h2>
            </div>
            <div className="mt-8 overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[680px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-white/[0.08] text-left">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="px-4 py-3 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Capability</th>
                    <th className="px-3 py-3 text-center font-display text-[12px] font-bold text-acid">Forge</th>
                    <th className="px-3 py-3 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Hevy / Strong</th>
                    <th className="px-3 py-3 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Fitbod</th>
                    <th className="px-3 py-3 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-dim">MFP</th>
                    <th className="px-3 py-3 text-center font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Strava</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-t border-white/[0.06] bg-ink/40">
                      <td className="border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] text-mist">{row.feature}</td>
                      <td className="border-t border-white/[0.06] px-3 py-2.5 text-center">
                        <span className="inline-grid size-5 place-items-center rounded-full bg-acid/15 text-acid"><Check className="size-3" /></span>
                      </td>
                      {[row.tracker, row.coach, row.nutrition, row.social].map((v, i) => (
                        <td key={i} className="border-t border-white/[0.06] px-3 py-2.5 text-center">
                          {v === true ? (
                            <Check className="mx-auto size-3.5 text-mint/70" />
                          ) : v === "partial" ? (
                            <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">partial</span>
                          ) : (
                            <Minus className="mx-auto size-3.5 text-white/15" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
              Based on publicly available feature sets · November 2026
            </p>
          </div>
        </section>

        {/* PRODUCT PRINCIPLES */}
        <section id="principles" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-mono mb-4 text-acid">The product</p>
              <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
                Built around a better
                <br />
                training loop.
              </h2>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-mist">Product principles · not testimonials</span>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {PRODUCT_PRINCIPLES.map((principle) => (
              <article key={principle.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <span className="mb-4 block h-1 w-10 rounded-full" style={{ backgroundColor: principle.accent }} />
                <h3 className="font-display text-[17px] font-bold tracking-[-0.03em] text-chalk">{principle.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-mist">{principle.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Users, title: "Live check-ins", body: "See who's training now, how busy your gym is, and what they're hitting." },
              { icon: Flame, title: "Streaks that mean something", body: "Consistency scored against your own plan, not an arbitrary daily log." },
              { icon: Trophy, title: "Challenges with stakes", body: "Volume, protein, sessions — leaderboards that reset and keep you honest." },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <Icon className="mt-0.5 size-4 shrink-0 text-acid" />
                  <div>
                    <p className="text-[11px] font-semibold text-chalk">{c.title}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-dim">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="text-center">
              <p className="label-mono mb-4 text-acid">Pricing</p>
              <h2 className="font-display text-[clamp(2rem,4.2vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em]">
                Less than one month
                <br />
                of your old stack.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[12.5px] leading-relaxed text-mist">
                Cancel any time. Export everything. No “contact sales” maze.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {PRICING.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-5 ${
                    plan.highlight
                      ? "border-acid/35 bg-[linear-gradient(160deg,rgba(201,247,58,0.08),rgba(201,247,58,0.015))] shadow-[0_30px_80px_-40px_rgba(201,247,58,0.35)]"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-acid px-2.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-display text-[18px] font-bold tracking-[-0.02em] text-chalk">{plan.name}</p>
                    {plan.highlight && <Zap className="size-4 text-acid" />}
                  </div>
                  <p className="mt-1 text-[10.5px] text-dim">{plan.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-[38px] font-extrabold leading-none tracking-[-0.05em] text-chalk">{plan.price}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-dim">{plan.cadence}</span>
                  </div>
                  <div className="my-4 h-px bg-white/[0.07]" />
                  <ul className="flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[10.5px] leading-snug text-mist">
                        <Check className="mt-0.5 size-3 shrink-0 text-acid" /> {f}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink
                    href="/login"
                    variant={plan.highlight ? "primary" : "secondary"}
                    size="md"
                    className="mt-5 w-full"
                  >
                    {plan.cta}
                  </ButtonLink>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
              <ShieldCheck className="size-3 text-mint" /> 30-day money-back guarantee · cancel in two taps
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28">
          <div className="text-center">
            <p className="label-mono mb-4 text-acid">Questions</p>
            <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-[1] tracking-[-0.05em]">
              Straight answers.
            </h2>
          </div>
          <div className="mt-8 space-y-2">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors open:border-white/[0.12]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[12px] font-semibold text-chalk [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronRight className="size-3.5 shrink-0 text-dim transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2.5 max-w-lg text-[11px] leading-relaxed text-mist">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6 md:pb-24">
          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-panel p-8 text-center md:p-14">
            <div className="pointer-events-none absolute inset-0 grid-lines opacity-20 [mask-image:radial-gradient(circle_at_50%_100%,black,transparent_70%)]" />
            <div className="pointer-events-none absolute -bottom-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(201,247,58,0.16),transparent_65%)]" />
            <div className="relative">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-acid">Stop guessing</p>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-[clamp(2.1rem,5vw,4rem)] font-extrabold leading-[0.94] tracking-[-0.055em]">
                The best program is the one
                <br />
                that adjusts when life doesn&apos;t.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[12.5px] leading-relaxed text-mist">
                Import your last workout in 30 seconds. Forge builds the next one around the body you have today.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <ButtonLink href="/login" size="xl" className="gap-2">
                  Start training free <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/login" variant="dark" size="xl" className="gap-2">
                  <Dumbbell className="size-4" /> Try the demo athlete
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Logo size="md" />
              <p className="mt-3 max-w-xs text-[10.5px] leading-relaxed text-dim">
                The adaptive training OS. Built for people who show up — even when the plan, the gym, or the day doesn&apos;t.
              </p>
              <div className="mt-4 flex items-center gap-2">
                {[MessageSquare, Camera, Users].map((Icon, i) => (
                  <span key={i} className="grid size-7 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.02] text-dim transition-colors hover:text-chalk">
                    <Icon className="size-3.5" />
                  </span>
                ))}
              </div>
            </div>
            {[
              { title: "Product", links: ["Training", "Nutrition", "Form check", "Community", "Pricing"] },
              { title: "Company", links: ["About", "Manifesto", "Careers", "Press", "Contact"] },
              { title: "Resources", links: ["Exercise library", "Programs", "Changelog", "Privacy", "Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-dim">{col.title}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <span className="cursor-pointer text-[10.5px] text-mist transition-colors hover:text-chalk">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-5 sm:flex-row">
            <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">© 2026 Forge Labs · Show up. Level up.</p>
            {process.env.NODE_ENV === "development" && (
              <div className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">
                <span className="size-1.5 rounded-full bg-acid" /> All systems operational
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
