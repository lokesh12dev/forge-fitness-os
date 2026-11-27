import Link from "next/link";
import {
  Activity, ArrowRight, Check, Dumbbell, Play, ShieldCheck, Star,
} from "lucide-react";
import "./landing.css";
import { Logo } from "@/components/ui";
import { LandingNavbar, LandingRevealObserver, ScrollChapterHud, StatementBreatherShowcase, StickyShowcase, WatchSpinShowcase, type ShowcaseSlide } from "@/components/landing-showcase";
import {
  DuoCanvasZoom,
  DuoFoldHero,
  DuoHiitShowcase,
  DuoPosturesLineup,
  DuoSplitTiles,
} from "@/components/landing-duo";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { FULL_EXERCISE_CATALOG } from "@/lib/opengym-catalog";

const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    id: "ai",
    label: "Adaptive Intelligence",
    title: "It already knows what's next",
    description:
      "Tell Forge Fitness your goals, equipment, and schedule. It builds your workout from your readiness, sleep, and HRV—then adjusts weights, reps, and exercises after every logged set.",
    webpSrc: "/landing/smarttrainer.webp",
    fallbackSrc: "/landing/smarttrainer.png",
    alt: "Forge Fitness adaptive workout prescription interface",
    width: 1217,
    height: 1010,
  },
  {
    id: "exercises",
    label: "Exercise Library",
    title: `${FULL_EXERCISE_CATALOG.length.toLocaleString()}+ exercises. Zero guesswork.`,
    description:
      "Every movement includes anatomical muscle maps, step-by-step instructions, skill ladders, and same-pattern swaps. Pair it with on-device 17-joint camera form analysis.",
    webpSrc: "/landing/exercises.webp",
    fallbackSrc: "/landing/exercises.png",
    alt: "Forge Fitness exercise library with anatomical muscle highlights",
    width: 1082,
    height: 787,
  },
  {
    id: "progress",
    label: "Progress & Fuel",
    title: "See exactly how far you've come",
    description:
      "Volume lifted, e1RM trends, personal records, muscle recovery heatmaps, and IOM 2005 nutrition targets with a protein-gap generator—all in charts that actually make sense.",
    webpSrc: "/landing/trackyourprogress.webp",
    fallbackSrc: "/landing/trackyourprogress.png",
    alt: "Forge Fitness progress tracking with volume and personal records",
    width: 1044,
    height: 1175,
  },
];

const TESTIMONIALS = [
  {
    title: "Stopped Program-Hopping",
    quote:
      "The first training OS that changes the plan when sleep or gym equipment changes instead of just counting what I did.",
    name: "Maya Chen",
    role: "51kg class powerlifter",
    initials: "MC",
    accent: "#FF6B35",
  },
  {
    title: "Stronger & Pain-Free",
    quote:
      "The on-device form check caught my left knee caving mid-set. Six weeks later my squat is 12kg heavier and my knees feel rock solid.",
    name: "Jordan Blake",
    role: "Hybrid athlete · 42 yrs",
    initials: "JB",
    accent: "#6EA8FF",
  },
  {
    title: "Coaches & Athletes Together",
    quote:
      "Between the protein-gap generator and the Trainer Roster portal, I manage my own prep and 200+ client check-ins in one place.",
    name: "Marcus Webb",
    role: "S&C coach · 200+ athletes",
    initials: "MW",
    accent: "#FFD166",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Full workout & macro logger with zero trial timer.",
    features: [
      "Unlimited workout & set logging",
      "5,632+ exercise catalog & skill ladders",
      "Macro & water tracking + IFCT foods",
      "Canvas PR share cards",
      "Community feed & challenges",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$14",
    cadence: "/ month",
    blurb: "The full adaptive engine, unlocked.",
    features: [
      "Readiness & RPE autoregulation",
      "Time-crunch compression & swaps",
      "On-device 17-joint camera form check",
      "Photo-to-macro + protein-gap generator",
      "Per-muscle recovery body map",
      "Data-grounded Forge Coach",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Black",
    price: "$29",
    cadence: "/ month",
    blurb: "For serious lifters, coaches & gym operators.",
    features: [
      "Everything in Pro",
      "Trainer Roster & client check-in portal",
      "Gym Operations & QR attendance desk",
      "Advanced periodization & strength standards",
      "Priority form analysis & CSV export",
    ],
    cta: "Go Black",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "What is Forge Fitness?",
    a: "Forge Fitness is a local-first, adaptive training OS that unifies workout logging, periodized programming, nutrition tracking, per-muscle recovery, on-device form intelligence, and coaching/gym portals in one coherent system.",
  },
  {
    q: "How does Forge Fitness adapt my workouts in real time?",
    a: "Instead of static templates, Forge's deterministic engine evaluates your sleep, HRV, soreness, logged RPE, available time, and equipment. It adjusts target loads, compresses sessions into supersets when you're short on time, and swaps movements within the same biomechanical pattern if a rack is taken.",
  },
  {
    q: "Does the camera form check upload my workout videos?",
    a: "No. Pose estimation runs locally on your device. Only joint coordinates, depth/bar-path metrics, and a single actionable coaching cue are stored—your video never leaves your device.",
  },
  {
    q: "How does Forge handle nutrition and late-night macro gaps?",
    a: "Forge implements IOM 2005 EER/TDEE equations, WHO BMI classifications, 2024 Compendium MET burn, and regional Indian (IFCT) plus global food databases. When you're short on protein at 9pm, the protein-gap generator builds the smallest meal that closes the target without blowing calories.",
  },
  {
    q: "Can coaches and gym owners use Forge Fitness?",
    a: "Yes. Beyond the athlete OS, Forge includes a dedicated Trainer Roster portal for managing client programs and check-ins, plus a Gym Operations portal with QR attendance, member management, and occupancy tracking.",
  },
];

export default async function LandingPage() {
  let totalSets = 0;
  try {
    const user = await requireUser();
    const ws = await getWorkspace(user.id);
    totalSets = ws.sets.length;
  } catch {
    totalSets = 0;
  }

  return (
    <div className="forge-landing">
      <LandingRevealObserver />
      <ScrollChapterHud />
      <a className="skip-link" href="#main">Skip to content</a>

      <LandingNavbar />

      <main id="main">
        {/* 1. HERO — Badge + Title + CTA + Full iPhone Hero Showcase */}
        <section className="hero">
          <div className="landing-container flex flex-col items-center">
            <h1 className="landing-h1 hero__title" style={{ marginBottom: 16 }}>
              Forge Fitness
            </h1>
            <p
              className="font-display font-bold tracking-tight text-chalk"
              style={{
                fontSize: "clamp(1.75rem, 3.8vw, 3rem)",
                lineHeight: 1.1,
                marginBottom: 20,
              }}
            >
              Walk in. Know exactly <span className="text-acid">what to do.</span>
            </p>
            <p className="landing-lead hero__subtitle">
              Forge Fitness builds workouts around your goals, equipment, and schedule, then adapts as you get stronger—unifying training, fuel, and recovery.
            </p>
            <div className="hero__cta-group">
              <a href="/api/demo-login" className="landing-btn landing-btn--primary landing-btn--large">
                <Play className="size-4 fill-current" /> Personal App Demo <ArrowRight className="size-4" />
              </a>
              <a
                href="http://localhost:3001"
                className="landing-btn landing-btn--secondary landing-btn--large"
              >
                Owner CRM Portal Demo <ArrowRight className="size-4 text-acid" />
              </a>
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
              Two separate systems · Personal Training &amp; Nutrition App vs Dedicated Gym Management CRM
            </p>
            <div className="hero__image">
              <picture>
                <source srcSet="/landing/hero.webp" type="image/webp" />
                <img
                  src="/landing/hero.png"
                  alt="Forge Fitness interface showing adaptive workout plans"
                  width={1850}
                  height={1150}
                  fetchPriority="high"
                  style={{ maxWidth: 900, margin: "0 auto" }}
                />
              </picture>
            </div>
          </div>
        </section>

        {/* 2. CREDENTIAL BAR */}
        <section data-scrub="up" className="credential-bar scrub-up">
          <div className="landing-container">
            <div className="credential-bar__inner">
              <div className="credential-bar__item">
                <Dumbbell className="size-5" />
                {FULL_EXERCISE_CATALOG.length.toLocaleString()}+ Exercises & Skill Ladders
              </div>
              <div className="credential-bar__divider" />
              <div className="credential-bar__item">
                <Activity className="size-5" />
                Deterministic Adaptive Engine
              </div>
              <div className="credential-bar__divider" />
              <div className="credential-bar__item">
                <ShieldCheck className="size-5" />
                Local-First Privacy
              </div>
            </div>
          </div>
        </section>

        {/* 3. STICKY SHOWCASE — Pinned iPhone Screens + Scrolling Text */}
        <StickyShowcase items={SHOWCASE_SLIDES} />

        {/* 4. CREATE FROM SCRATCH — 4-Phone Routine Builder Showcase */}
        <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="left" className="cinematic-feature__header scrub-left">
              <span className="section-label">Your Routines</span>
              <h2 className="landing-h2">Build it your way. Track everything.</h2>
            </div>
            <div data-scrub="right" className="cinematic-feature__body scrub-right">
              <p className="landing-lead">
                Create routines from scratch, pick your exercises, dial in your sets, reps, and weight—or paste raw workout text and let Forge structure it with full progress tracking and analytics.
              </p>
            </div>
            <div data-scrub="clip" className="cinematic-feature__image scrub-clip">
              <picture>
                <source srcSet="/landing/create-from-scratch.webp" type="image/webp" />
                <img
                  src="/landing/create-from-scratch.png"
                  alt="Create custom routines from scratch in Forge Fitness"
                  width={2342}
                  height={1500}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </section>

        {/* 5. ALTERNATIVE EXERCISES — 5-Phone Instant Swap Showcase */}
        <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="right" className="cinematic-feature__header scrub-right">
              <span className="section-label">Flexibility</span>
              <h2 className="landing-h2">Machine taken? Swap instantly.</h2>
            </div>
            <div data-scrub="left" className="cinematic-feature__body scrub-left">
              <p className="landing-lead">
                Forge suggests same-pattern alternatives based on your exact muscle groups and available equipment. Swap mid-workout with a single tap while keeping your base program intact.
              </p>
            </div>
            <div data-scrub="right" className="cinematic-feature__image scrub-right">
              <picture>
                <source srcSet="/landing/releases/74/alt-exercises-1.webp" type="image/webp" />
                <img
                  src="/landing/releases/74/alt-exercises-1.png"
                  alt="Alternative exercise swaps mid-workout in Forge Fitness"
                  width={6590}
                  height={2656}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </section>

        {/* 6. TWO COMPLETELY SEPARATE LIVE DEMOS (Personal Client App vs Owner Management CRM) */}
        <section id="demo" className="demo-section scroll-mt-20">
          <div className="landing-container">
            <div data-scrub="up" className="mb-8 text-center scrub-up">
              <span className="section-label">Separate Live Experiences</span>
              <h2 className="landing-h2 mt-2">Two apps. Zero clutter between them.</h2>
              <p className="landing-lead mx-auto mt-3 max-w-2xl">
                Customers and athletes train inside the personal Workout, Exercise &amp; Nutrition app. Gym owners, front desk, coaches, and accountants operate inside the dedicated FORGE CRM management portal.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Demo 1: Personal Client / Exercise & Nutrition App */}
              <div data-scrub="left" className="scrub-left flex flex-col justify-between overflow-hidden rounded-3xl border border-acid/30 bg-[linear-gradient(145deg,rgba(201,247,58,0.09),rgba(17,18,21,0.96)_60%)] p-8">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-acid/25 bg-acid/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-acid">
                    <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> Demo 1 · Personal &amp; Client App
                  </div>
                  <h3 className="landing-h2" style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)" }}>
                    Workouts, Exercises &amp; Nutrition OS
                  </h3>
                  <p className="landing-lead mt-3" style={{ fontSize: "0.98rem" }}>
                    Built purely for everyday lifters, clients, and personal training. Includes 5,632+ exercises, IFCT Indian foods, IOM macro targets, photo scanner, camera form check, and personal PR stats.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <a href="/api/demo-login?next=/app/exercises" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-acid/60 hover:text-acid">
                      Exercises (5,632+) →
                    </a>
                    <a href="/api/demo-login?next=/app/nutrition" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-acid/60 hover:text-acid">
                      Nutrition &amp; IFCT →
                    </a>
                    <a href="/api/demo-login?next=/app/train" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-acid/60 hover:text-acid">
                      Live Workout Player →
                    </a>
                    <a href="/api/demo-login?next=/app/form-check" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-acid/60 hover:text-acid">
                      Camera Form Check →
                    </a>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="/api/demo-login" className="landing-btn landing-btn--primary landing-btn--large">
                    Launch Personal App Demo <ArrowRight className="size-4" />
                  </a>
                  <Link href="/login" className="landing-btn landing-btn--secondary landing-btn--large">
                    Sign In
                  </Link>
                </div>
              </div>

              {/* Demo 2: Separate FORGE CRM Owner & Management Portal */}
              <div data-scrub="right" className="scrub-right flex flex-col justify-between overflow-hidden rounded-3xl border border-white/15 bg-[#121318] p-8">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-chalk">
                    <span className="size-1.5 rounded-full bg-[#FF6B35]" /> Demo 2 · Owner &amp; Staff CRM Portal
                  </div>
                  <h3 className="landing-h2" style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)" }}>
                    FORGE CRM Operations &amp; Revenue Portal
                  </h3>
                  <p className="landing-lead mt-3" style={{ fontSize: "0.98rem" }}>
                    Completely separate multi-branch management SaaS for gym owners, branch managers, front desk, trainers &amp; CAs. Includes GST billing, 600 seeded members, leads Kanban, WhatsApp automations &amp; 14 GSTR reports.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <a href="http://localhost:3001/api/demo-login?role=OWNER" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-[#FF6B35] hover:text-[#FF6B35]">
                      Owner Demo →
                    </a>
                    <a href="http://localhost:3001/api/demo-login?role=MANAGER" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-[#FF6B35] hover:text-[#FF6B35]">
                      Manager →
                    </a>
                    <a href="http://localhost:3001/api/demo-login?role=TRAINER" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-[#FF6B35] hover:text-[#FF6B35]">
                      Trainer Scope →
                    </a>
                    <a href="http://localhost:3001/api/demo-login?role=MEMBER" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-chalk hover:border-[#FF6B35] hover:text-[#FF6B35]">
                      Member PWA →
                    </a>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="http://localhost:3001" className="landing-btn landing-btn--primary landing-btn--large">
                    Open Owner CRM Landing <ArrowRight className="size-4" />
                  </a>
                  <a href="http://localhost:3001/api/demo-login?role=OWNER" className="landing-btn landing-btn--secondary landing-btn--large">
                    Instant Owner Login
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. SMARTWATCH SHOWCASE — Scroll-Driven High-Speed Spin */}
        <WatchSpinShowcase />

        {/* 8. HEART RATE ZONES — 3D Perspective Tilted Dual Screens */}
        <section id="analytics" className="cinematic-feature scroll-mt-20" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="up" className="cinematic-feature__header scrub-up">
              <span className="section-label">Heart Rate & Conditioning</span>
              <h2 className="landing-h2">See every beat. In color.</h2>
            </div>
            <div data-scrub="up" className="cinematic-feature__body scrub-up">
              <p className="landing-lead">
                Color-coded heart rate zones appear in real time alongside your strength sets, powered by Forge&apos;s cardio engine and 2024 Compendium MET burn calculations.
              </p>
            </div>
            <div className="heart-rate-3d">
              <div
                data-scrub="3d-left"
                className="scrub-3d-left"
                style={{
                  flex: "0 1 400px",
                  filter: "drop-shadow(24px 24px 48px rgba(0,0,0,0.6))",
                  zIndex: 2,
                }}
              >
                <picture>
                  <source srcSet="/landing/releases/73/heart-rate-zones-1.webp" type="image/webp" />
                  <img
                    src="/landing/releases/73/heart-rate-zones-1.png"
                    alt="Heart rate zones breakdown with time and BPM ranges"
                    width={1179}
                    height={960}
                    loading="eager"
                    decoding="async"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  />
                </picture>
              </div>
              <div
                data-scrub="3d-right"
                className="scrub-3d-right"
                style={{
                  flex: "0 1 400px",
                  filter: "drop-shadow(-24px 24px 48px rgba(0,0,0,0.6))",
                  zIndex: 1,
                }}
              >
                <picture>
                  <source srcSet="/landing/releases/73/heart-rate-zones-2.webp" type="image/webp" />
                  <img
                    src="/landing/releases/73/heart-rate-zones-2.png"
                    alt="Heart rate chart with color-coded zones during workout"
                    width={1179}
                    height={786}
                    loading="eager"
                    decoding="async"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  />
                </picture>
              </div>
            </div>
          </div>
        </section>

        {/* 9. AUDIO & VOICE COACHING — Elevated Background */}
        <section className="feature-section" style={{ background: "#0d0d0d", marginTop: 40 }}>
          <div className="landing-container">
            <div className="feature-grid">
              <div data-scrub="left" className="feature-grid__image scrub-left">
                <picture>
                  <source srcSet="/landing/releases/76/audio-1.webp" type="image/webp" />
                  <img
                    src="/landing/releases/76/audio-1.png"
                    alt="Hands-free audio cues and voice logging in Forge Fitness"
                    width={1350}
                    height={1477}
                    loading="eager"
                    decoding="async"
                  />
                </picture>
              </div>
              <div data-scrub="right" className="scrub-right">
                <span className="section-label">Hands-Free</span>
                <h2 className="landing-h2 section-title">
                  Eyes on the bar,<br />not the screen.
                </h2>
                <p className="section-text">
                  Listen to form cues hands-free and log sets by speaking naturally—say “Bench 185 for 8 at RPE 7” and Forge records weight, reps, RPE, and e1RM automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 10. DATA CARDS — Charts, Vs Previous, Training Load */}
        <section className="feature-cards">
          <div className="landing-container">
            <div data-scrub="up" className="feature-cards__header scrub-up">
              <span className="section-label">Your Data</span>
              <h2 className="landing-h2">Every angle. Every insight.</h2>
            </div>
            <div data-scrub="converge" className="feature-cards__grid scrub-converge">
              <div className="feature-card">
                <div className="feature-card__image">
                  <picture>
                    <source srcSet="/landing/releases/78/charts.webp" type="image/webp" />
                    <img
                      src="/landing/releases/78/charts.png"
                      alt="Flexible time range charts in Forge Fitness"
                      width={4889}
                      height={1533}
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Charts</span>
                  <h3>Any range. Any metric.</h3>
                  <p>Track e1RM progression, weekly tonnage, and body metrics across custom windows with zero clutter.</p>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-card__image">
                  <picture>
                    <source srcSet="/landing/releases/74/vs-previous.webp" type="image/webp" />
                    <img
                      src="/landing/releases/74/vs-previous.jpg"
                      alt="Vs Previous real-time exercise comparison in Forge Fitness"
                      width={3500}
                      height={2656}
                      loading="eager"
                      decoding="async"
                      style={{ transform: "scale(1.12)" }}
                    />
                  </picture>
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Real-Time</span>
                  <h3>Vs. your last session</h3>
                  <p>See previous-set ghosts inline while you lift, with automatic PR detection and plate math built in.</p>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-card__image flex items-center justify-center p-6">
                  <img
                    src="/landing/releases/79/training-load.gif"
                    alt="Training load breathing indicator in Forge Fitness"
                    width={651}
                    height={1080}
                    loading="eager"
                    decoding="async"
                    style={{ maxHeight: 300, width: "auto", objectFit: "contain" }}
                  />
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Effort</span>
                  <h3>Rate the burn</h3>
                  <p>Log session RPE and soreness to feed Forge&apos;s per-muscle fatigue decay and readiness model.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 11. GOALS & STRETCHES */}
        <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="left" className="cinematic-feature__header scrub-left">
              <span className="section-label">Goals & Consistency</span>
              <h2 className="landing-h2">Set it. Chase it.<br />Crush it.</h2>
            </div>
            <div data-scrub="clip" className="cinematic-feature__image scrub-clip">
              <picture>
                <source srcSet="/landing/releases/76/goals-1.webp" type="image/webp" />
                <img
                  src="/landing/releases/76/goals-1.png"
                  alt="Custom workout goals and streak tracking in Forge Fitness"
                  width={5500}
                  height={2710}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
            <div data-scrub="right" className="cinematic-feature__body scrub-right">
              <p className="landing-lead">
                Define weekly training targets, earn XP and streaks that respect deloads, and share canvas-rendered PR cards in one tap.
              </p>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="landing-container">
            <div className="feature-grid feature-grid--reverse">
              <div data-scrub="right" className="feature-grid__image scrub-right">
                <picture>
                  <source srcSet="/landing/releases/79/stretch.webp" type="image/webp" />
                  <img
                    src="/landing/releases/79/stretch.png"
                    alt="Targeted warm-up and cool-down stretch suggestions"
                    width={4044}
                    height={2717}
                    loading="eager"
                    decoding="async"
                  />
                </picture>
              </div>
              <div data-scrub="left" className="scrub-left">
                <span className="section-label">Recovery</span>
                <h2 className="landing-h2 section-title">
                  Warm up right.<br />Cool down smart.
                </h2>
                <p className="section-text">
                  Forge pairs every session with targeted warm-up and recovery work matched to the exact muscles you&apos;re training today.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 12. IMPORT ROUTINES FROM TEXT */}
        <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="left" className="cinematic-feature__header scrub-left">
              <span className="section-label">Smart Import</span>
              <h2 className="landing-h2">Paste any routine. Start training.</h2>
            </div>
            <div data-scrub="right" className="cinematic-feature__body scrub-right">
              <p className="landing-lead">
                Copy any workout from a coach, a note, or the web and paste it into Forge Fitness. It parses sets, reps, and rest times automatically and adapts them to your available equipment.
              </p>
            </div>
            <div data-scrub="scale" className="cinematic-feature__image scrub-scale">
              <picture>
                <source srcSet="/landing/releases/77/import-routines.webp" type="image/webp" />
                <img
                  src="/landing/releases/77/import-routines.png"
                  alt="Import routines from text in Forge Fitness"
                  width={2000}
                  height={1338}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </section>

        {/* 13. EQUIPMENT LISTS — Multi-Gym Adaptation */}
        <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="right" className="cinematic-feature__header scrub-right">
              <span className="section-label">Your Gym, Your Rules</span>
              <h2 className="landing-h2">Train anywhere.<br />Forge adapts.</h2>
            </div>
            <div data-scrub="left" className="cinematic-feature__body scrub-left">
              <p className="landing-lead">
                Switch between commercial gym, home rack, dumbbells only, or hotel room. Forge adapts every movement and plate breakdown to what&apos;s in front of you.
              </p>
            </div>
            <div data-scrub="clip" className="cinematic-feature__image scrub-clip">
              <picture>
                <source srcSet="/landing/releases/74/equipment-lists.webp" type="image/webp" />
                <img
                  src="/landing/releases/74/equipment-lists.png"
                  alt="Multiple equipment configurations in Forge Fitness"
                  width={5300}
                  height={2656}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>
        </section>

        {/* STATEMENT BREATHER — Kinetic Word Illumination & Live Telemetry */}
        <StatementBreatherShowcase />

        {/* ECOSYSTEM CARDS — Sync, Import, Share */}
        <section className="feature-cards" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="landing-container">
            <div data-scrub="up" className="feature-cards__header scrub-up">
              <span className="section-label">Works With Everything</span>
              <h2 className="landing-h2">Your workouts. Everywhere.</h2>
            </div>
            <div data-scrub="converge" className="feature-cards__grid scrub-converge">
              <div className="feature-card">
                <div className="feature-card__image">
                  <picture>
                    <source srcSet="/landing/releases/78/strava.webp" type="image/webp" />
                    <img
                      src="/landing/releases/78/strava.png"
                      alt="Activity sync in Forge Fitness"
                      width={4762}
                      height={2717}
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Connected Sync</span>
                  <h3>Wearables & activity sync</h3>
                  <p>Pull sleep, HRV, and resting heart rate from your wearable to power Forge&apos;s daily readiness score.</p>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-card__image">
                  <picture>
                    <source srcSet="/landing/releases/78/third-party.webp" type="image/webp" />
                    <img
                      src="/landing/releases/78/third-party.png"
                      alt="Workout history import in Forge Fitness"
                      width={5878}
                      height={2717}
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Import & Export</span>
                  <h3>Bring your workouts along</h3>
                  <p>Import CSV logs from legacy trackers and absorb every past set into your e1RM curves and recovery map.</p>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-card__image">
                  <picture>
                    <source srcSet="/landing/releases/78/sharing.webp" type="image/webp" />
                    <img
                      src="/landing/releases/78/sharing.png"
                      alt="Workout and PR share cards in Forge Fitness"
                      width={3800}
                      height={2717}
                      loading="eager"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="feature-card__content">
                  <span className="section-label">Share</span>
                  <h3>Show off your work</h3>
                  <p>Turn any PR or completed session into a clean canvas-rendered card ready to share in one tap.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PERSISTENT LIVE ACTIVITIES — Full-bleed */}
        <section style={{ padding: "clamp(80px, 10vw, 140px) 0 0", overflow: "hidden" }}>
          <div className="landing-container" style={{ textAlign: "center", maxWidth: 700, marginBottom: "clamp(48px, 6vw, 80px)" }}>
            <div data-scrub="up" className="scrub-up">
              <span className="section-label">Live Session Player</span>
              <h2 className="landing-h2" style={{ marginTop: 16 }}>Your Lock Screen becomes your gym partner.</h2>
              <p className="landing-lead" style={{ marginTop: 20 }}>
                Persistent rest timers, next-set prescriptions, and one-tap completion keep your workout front and center so you never lose focus between sets.
              </p>
            </div>
          </div>
          <div data-scrub="scale" className="scrub-scale" style={{ maxWidth: "var(--container-cinematic)", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
            <picture>
              <source srcSet="/landing/releases/77/live-activities.webp" type="image/webp" />
              <img
                src="/landing/releases/77/live-activities.png"
                alt="Live workout session player in Forge Fitness"
                width={2000}
                height={1338}
                loading="eager"
                decoding="async"
                style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", margin: "0 auto" }}
              />
            </picture>
          </div>
        </section>

        {/* 13. MULTI-POSTURE & FOLDABLE SHOWCASE (Unfold, 5 Postures, Split Tiles, 7-Step Canvas Zoom, HIIT & Film) */}
        <DuoFoldHero />
        <DuoPosturesLineup />
        <DuoSplitTiles />
        <DuoCanvasZoom />
        <DuoHiitShowcase />

        {/* 14. ALL PLATFORMS */}
        <section className="platforms">
          <div style={{ maxWidth: "var(--container-cinematic)", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
            <div data-scrub="pitch" className="scrub-pitch">
              <picture>
                <source srcSet="/landing/allplatforms.webp" type="image/webp" />
                <img
                  src="/landing/allplatforms.png"
                  alt="Forge Fitness across phone, tablet, desktop, and watch"
                  width={1855}
                  height={1132}
                  loading="eager"
                  decoding="async"
                  style={{ margin: "0 auto" }}
                />
              </picture>
            </div>
          </div>
          <div className="landing-container">
            <div data-scrub="up" className="scrub-up" style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
              <h2 className="landing-h2 text-center" style={{ marginBottom: 16 }}>Your Personal Training OS. Everywhere.</h2>
              <p className="landing-lead text-center mx-auto max-w-xl">
                Phone, foldable canvas, watch timer, and desktop stats—dedicated cleanly to your workouts, exercise library, and nutrition.
              </p>
            </div>
          </div>
        </section>

        {/* 14. STATS */}
        <section className="stats">
          <div className="landing-container">
            <div data-scrub="converge" className="stats__grid scrub-converge">
              <div>
                <div className="stats__number" data-count-to={FULL_EXERCISE_CATALOG.length} data-count-suffix="+">{FULL_EXERCISE_CATALOG.length.toLocaleString()}+</div>
                <div className="stats__label">Exercises in Catalog</div>
              </div>
              <div>
                <div className="stats__number" data-count-to={totalSets}>{totalSets.toLocaleString()}</div>
                <div className="stats__label">Sets Logged in Demo DB</div>
              </div>
              <div>
                <div className="stats__number" data-count-to={100} data-count-suffix="%">100%</div>
                <div className="stats__label">Local-First & Inspectable</div>
              </div>
            </div>
          </div>
        </section>

        {/* 15. TESTIMONIALS */}
        <section className="testimonials">
          <div className="landing-container">
            <div data-scrub="up" className="scrub-up mb-12 text-center">
              <span className="section-label">Built for Consistency</span>
              <h2 className="landing-h2">Athletes & coaches on Forge</h2>
            </div>
            <div data-scrub="converge" className="testimonials__grid scrub-converge">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="testimonial-card">
                  <div className="testimonial-card__stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-[#FFD700] text-[#FFD700]" />
                    ))}
                  </div>
                  <h3 className="testimonial-card__title">{t.title}</h3>
                  <p className="testimonial-card__text">“{t.quote}”</p>
                  <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-4">
                    <span
                      className="grid size-8 place-items-center rounded-full text-[10px] font-bold"
                      style={{ background: `${t.accent}20`, color: t.accent }}
                    >
                      {t.initials}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-chalk">{t.name}</p>
                      <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 16. PRICING */}
        <section id="pricing" className="scroll-mt-20 border-t border-white/[0.08] bg-[#0a0a0a] py-24">
          <div className="landing-container">
            <div data-scrub="up" className="scrub-up text-center">
              <span className="section-label">Pricing</span>
              <h2 className="landing-h2">Simple, transparent tiers</h2>
              <p className="landing-lead mx-auto mt-3 max-w-md">
                Start free forever, or unlock the full adaptive engine and coaching portals.
              </p>
            </div>
            <div data-scrub="converge" className="scrub-converge mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
              {PRICING.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    tier.highlight
                      ? "border-acid/40 bg-[linear-gradient(160deg,rgba(201,247,58,0.08),rgba(201,247,58,0.015))]"
                      : "border-white/[0.08] bg-[#111215]"
                  }`}
                >
                  {tier.highlight && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-acid px-2.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-ink">
                      Most popular
                    </span>
                  )}
                  <p className="font-display text-xl font-bold text-chalk">{tier.name}</p>
                  <p className="mt-1 text-xs text-mist">{tier.blurb}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold text-chalk">{tier.price}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">{tier.cadence}</span>
                  </div>
                  <div className="my-5 h-px bg-white/[0.07]" />
                  <ul className="flex-1 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-mist">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-acid" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`mt-6 landing-btn w-full ${tier.highlight ? "landing-btn--primary" : "landing-btn--secondary"}`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 17. FAQ */}
        <section id="faq" className="faq-section scroll-mt-20">
          <div className="landing-container">
            <div data-scrub="up" className="scrub-up">
              <h2 className="landing-h2 mb-12 text-center">Frequently asked questions</h2>
            </div>
            <div data-scrub="faq" className="faq-list scrub-faq">
              {FAQS.map((faq) => (
                <details key={faq.q} className="faq-item">
                  <summary className="faq-item__question">{faq.q}</summary>
                  <div className="faq-item__answer">
                    <p>{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 18. FINAL CTA */}
        <section className="cta-section">
          <div className="landing-container">
            <div data-scrub="scale" className="scrub-scale">
              <h2 className="landing-h2 mb-5">
                Your next workout<br />is waiting
              </h2>
              <p className="landing-lead mx-auto mb-9 max-w-lg">
                Launch the Personal &amp; Client Exercise/Nutrition Demo right here—or switch over to the separate Owner &amp; Staff CRM Portal.
              </p>
              <div className="hero__cta-group">
                <a href="/api/demo-login" className="landing-btn landing-btn--primary landing-btn--large">
                  Personal App Live Demo <ArrowRight className="size-4" />
                </a>
                <a href="http://localhost:3001" className="landing-btn landing-btn--secondary landing-btn--large">
                  Owner CRM Portal Demo →
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer__grid">
            <div>
              <Logo size="md" href="/" />
              <p className="landing-footer__brand-text">
                Forge Fitness — the local-first adaptive training OS. Built for athletes, coaches, and gyms.
              </p>
            </div>
            <div>
              <h3 className="landing-footer__heading">Product</h3>
              <ul className="landing-footer__links">
                <li><a href="#features">Adaptive Engine</a></li>
                <li><a href="/api/demo-login">Live Demo</a></li>
                <li><Link href="/app/exercises">Exercise Library</Link></li>
                <li><Link href="/app/nutrition">Nutrition OS</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="landing-footer__heading">Separate Live Demos</h3>
              <ul className="landing-footer__links">
                <li><a href="/api/demo-login">Personal App Demo</a></li>
                <li><a href="/api/demo-login?next=/app/exercises">Exercises &amp; Workouts</a></li>
                <li><a href="/api/demo-login?next=/app/nutrition">Nutrition &amp; IFCT</a></li>
                <li><a href="http://localhost:3001">Owner CRM Portal →</a></li>
              </ul>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <p className="landing-footer__copyright">&copy; 2026 Forge Fitness. Show up. Level up.</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
              Local-First · SQLite + Next.js 16
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
