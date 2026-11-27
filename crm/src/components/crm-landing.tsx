"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  Lock,
  MessageSquare,
  Package,
  Play,
  QrCode,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Users,
  Workflow,
} from "lucide-react";

const ROLE_DEMOS = [
  {
    role: "OWNER",
    title: "Owner (All Branches)",
    badge: "FULL FINANCE & ADMIN",
    description:
      "Multi-branch P&L, GSTR-1 invoices, RBAC permissions, DPDP exports, AI Copilot, and retention cohorts.",
    accent: "bg-[#C8372B] text-[#FFFFFF]",
    href: "/api/demo-login?role=OWNER",
  },
  {
    role: "MANAGER",
    title: "Branch Manager (BLR)",
    badge: "SINGLE-BRANCH OPS",
    description:
      "Scoped strictly to Indiranagar HQ: leads Kanban, broadcasts, automations, staff shifts & POS inventory.",
    accent: "bg-[#2B4BCC] text-[#FFFFFF]",
    href: "/api/demo-login?role=MANAGER",
  },
  {
    role: "FRONTDESK",
    title: "Front Desk Operator",
    badge: "QR GATE, POS & COLLECT",
    description:
      "Live QR turnstile overrides, split UPI/cash fee collection, retail supplement POS & day-end drawer close.",
    accent: "bg-[#EBC95B] text-[#151515]",
    href: "/api/demo-login?role=FRONTDESK",
  },
  {
    role: "TRAINER",
    title: "Head Coach (No Finance)",
    badge: "STRICT RBAC GUARDED",
    description:
      "Views assigned clients, classes, PT sessions, Indian diet plans & own commissions. Blocked from club billing & ROI.",
    accent: "bg-[#151515] text-[#EBC95B]",
    href: "/api/demo-login?role=TRAINER",
  },
  {
    role: "ACCOUNTANT",
    title: "Chartered Accountant",
    badge: "READ-ONLY FINANCE",
    description:
      "Audits GST invoices, dues aging, vendor expenses, Source ROI & exports CSV/GSTR tax registers without editing.",
    accent: "bg-[#2B4BCC] text-[#FFFFFF]",
    href: "/api/demo-login?role=ACCOUNTANT",
  },
  {
    role: "MEMBER",
    title: "Member PWA Portal",
    badge: "SELF-SERVICE PASS",
    description:
      "Digital QR gate pass, assigned workout + Indian diet plan, group class waitlists, GST invoices & freeze requests.",
    accent: "bg-[#EBC95B] text-[#151515]",
    href: "/api/demo-login?role=MEMBER",
  },
];

const SUITES = [
  {
    id: "core",
    step: "01 // CORE CRM",
    title: "Every check-in, rupee & renewal in one frame.",
    summary:
      "Built for Indian multi-branch clubs with integer-paise arithmetic, branch timezone accuracy, and immutable audit logs.",
    accent: "#C8372B",
    items: [
      { icon: Building2, name: "Multi-Branch Command (TODAY.)", detail: "Live check-ins, daily revenue, peak-hour heatmap, expiring queue & owner branch comparison." },
      { icon: Users, name: "Members 360° & AES Health Notes", detail: "Measurements, waivers, KYC docs, family/corporate groups, freeze/transfer & duplicate merge." },
      { icon: CreditCard, name: "GST Billing & Reconciliation", detail: "CGST/SGST vs IGST sequential invoices (SAC 999723), UPI/split part-pay, refunds & day-end cash close." },
      { icon: QrCode, name: "QR Access & Turnstile Gate", detail: "Instant member QR scan, expired-pass block modal requiring an audited staff override reason." },
    ],
  },
  {
    id: "growth",
    step: "02 // GROWTH ENGINE",
    title: "Convert enquiries faster. Stop preventable churn.",
    summary:
      "Unifies walk-in QR forms, Instagram/Google lead ROI tracking, consent-guarded WhatsApp broadcasts, and explainable churn prediction.",
    accent: "#2B4BCC",
    items: [
      { icon: Target, name: "7-Stage Lead Kanban & Source ROI", detail: "Duplicate check, follow-up tasks, 1-click Member conversion, printable QR standee & embeddable web form." },
      { icon: MessageSquare, name: "2-Way WhatsApp Inbox & Broadcasts", detail: "Template variable interpolation ({name}, {plan}, {due_amount}), opt-out enforcement & throttled sends." },
      { icon: Workflow, name: "Automations + Dry-Run & Quiet Hours", detail: "11 triggers (T-7/T-3 expiry, dunning, birthday, win-back) holding dispatches between 21:00–08:00 IST." },
      { icon: TrendingDown, name: "Explainable Churn & Loyalty Tiers", detail: "Visit-drop & silence risk score + M0–M5 retention cohorts + referral free-day extensions." },
    ],
  },
  {
    id: "ops",
    step: "03 // FLOOR OPERATIONS",
    title: "Studios, trainers, retail POS & maintenance dialed.",
    summary:
      "Run capacity-controlled group classes, slabbed PT payroll, supplement inventory, locker bays, and front-desk shift handovers.",
    accent: "#EBC95B",
    items: [
      { icon: CalendarDays, name: "Classes, Waitlists & NPS", detail: "Real-time seat caps, late-cancel cutoffs, auto-waitlist promotion, and member NPS scoring." },
      { icon: Sparkles, name: "Trainers & PT Commission Slabs", detail: "Coach availability hours, 1-on-1 PT logging, and automated retainer + tiered commission payouts." },
      { icon: Package, name: "Retail POS, POs, Lockers & Assets", detail: "GST checkout on supplements/apparel, supplier restock POs, locker grid & equipment maintenance tickets." },
      { icon: ShieldCheck, name: "Indian Diet Plans & Client App Sync", detail: "Veg, Egg, Non-Veg & Jain protocols synced over the REST member-sync API to the Customer App." },
    ],
  },
  {
    id: "admin",
    step: "04 // INTELLIGENCE & ADMIN",
    title: "CA-ready exports, AI Copilot & DPDP compliance.",
    summary:
      "Every report respects role boundaries, every AI suggestion pauses for human confirmation, and every member owns their data.",
    accent: "#151515",
    items: [
      { icon: BarChart3, name: "14 CSV Reports, GSTR-1 & 9 PM Digest", detail: "Daily collection, dues aging, outward GST register, POS summary & scheduled WhatsApp/CA digests." },
      { icon: Bot, name: "Grounded Org AI Copilot", detail: "Answers directly from scoped PostgreSQL aggregates with data citations and explicit [Approve] gates." },
      { icon: Workflow, name: "Gymdesk / Mindbody / CSV Importer", detail: "Row-level Dry-Run validator and clean tenant import pipeline before committing new members." },
      { icon: Lock, name: "RBAC, API Keys & DPDP Privacy", detail: "Role permissions matrix, scoped SHA-256 REST keys, webhooks, audit viewer, JSON export & PII erasure." },
    ],
  },
];

const PRICING = [
  {
    name: "Single Club",
    price: "₹4,999",
    cadence: "/ month",
    blurb: "Complete core CRM + QR gate + GST billing for 1 gym branch.",
    features: [
      "Up to 750 active members",
      "GST invoices (CGST/SGST/IGST)",
      "QR attendance scanner & member portal",
      "7-stage lead pipeline + web form",
      "Standard CSV exports",
    ],
    featured: false,
  },
  {
    name: "Multi-Branch Growth",
    price: "₹9,999",
    cadence: "/ month",
    blurb: "Full automation engine, AI Copilot, POS & trainer payroll.",
    features: [
      "Unlimited members & multi-branch switcher",
      "2-way WhatsApp inbox & quiet-hour automations",
      "Explainable churn prediction & cohort grid",
      "Classes, waitlists, PT slabs & Indian diet plans",
      "14 GSTR reports + AI Copilot approval desk",
    ],
    featured: true,
  },
  {
    name: "Enterprise Chain",
    price: "Custom",
    cadence: "per org",
    blurb: "Franchise isolation, biometric turnstile hooks & migration SLA.",
    features: [
      "Unlimited branches & franchise role scoping",
      "Dedicated PostgreSQL + S3 backup vault",
      "Turnstile / biometric hardware webhooks",
      "White-glove Gymdesk/Mindbody CSV migration",
      "DPDP data residency & custom SLA",
    ],
    featured: false,
  },
];

const FAQS = [
  {
    q: "How is FORGE CRM separated from the Forge Fitness Personal App?",
    a: "They run as completely separate applications. Athletes and everyday clients use the Personal Workout, Exercise (5,632+ catalog), & Nutrition App at localhost:3000 without any billing or B2B clutter. Owners, managers, front desk, trainers, and CAs run club operations inside FORGE CRM here on localhost:3001—with optional read-only plan sync tokens bridging coach protocols.",
  },
  {
    q: "What data is preloaded in the Owner Live Demo?",
    a: "The live PostgreSQL demo workspace includes Ironworks Athletics India with 2 branches (Indiranagar HQ & Bandra West), 600 seeded members, 12 plans, 6 trainers, 18 months of GST invoices and expenses, 40,000 floor check-ins, 300 pipeline leads, group classes, inventory SKUs, lockers, and automation runs.",
  },
  {
    q: "Can a Trainer see club revenue or invoice totals in CRM?",
    a: "Never. Server-side RBAC strips club finance, GST exports, ad-spend ROI, and other coaches' payroll cleanly from the React Server Component payload and returns 403 Forbidden on financial routes or AI financial queries.",
  },
  {
    q: "Can I start a brand-new empty gym workspace instead of using demo data?",
    a: "Yes. Click Start New Gym Setup (/onboarding) to register a fresh gym organization with zero demo data and designed onboarding EmptyStates—you can load demo fixtures later from Settings at any time.",
  },
];

export function CrmLandingClient({
  metrics,
}: {
  metrics: {
    members: number;
    branches: number;
    leads: number;
    checkIns: number;
    invoices: number;
  };
}) {
  const [activeSuite, setActiveSuite] = useState<string>("core");
  const currentSuite = SUITES.find((s) => s.id === activeSuite) ?? SUITES[0]!;

  return (
    <div className="min-h-screen bg-[#F6F1E4] text-[#151515]">
      {/* Sticky Swiss Bauhaus Header */}
      <header className="sticky top-0 z-50 border-b-[3px] border-[#151515] bg-[#151515] text-[#FFFFFF]">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center border-2 border-[#FFFFFF] bg-[#EBC95B] font-headline text-[20px] text-[#151515]">
              F
            </span>
            <div>
              <span className="font-headline text-[20px] tracking-tight text-[#FFFFFF]">FORGE CRM.</span>
              <span className="block text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
                OWNER &amp; MANAGEMENT PORTAL
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-[12px] font-bold uppercase tracking-[0.12em]">
            <a href="#roles" className="hover:text-[#EBC95B]">Role Demos</a>
            <a href="#suites" className="hover:text-[#EBC95B]">All 4 Phases</a>
            <a href="#pricing" className="hover:text-[#EBC95B]">Pricing</a>
            <a href="#faq" className="hover:text-[#EBC95B]">FAQ</a>
            <a
              href="http://localhost:3000"
              className="border border-[#FFFFFF]/35 px-3 py-1.5 text-[#EBC95B] hover:bg-[#EBC95B] hover:text-[#151515]"
            >
              Personal Exercise/Nutrition App →
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex min-h-[42px] items-center border-2 border-[#FFFFFF] px-3.5 text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#2B4BCC]"
            >
              Sign In
            </Link>
            <a
              href="/api/demo-login?role=OWNER"
              className="inline-flex min-h-[42px] items-center gap-2 border-2 border-[#FFFFFF] bg-[#C8372B] px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[#FFFFFF] hover:bg-[#EBC95B] hover:text-[#151515]"
            >
              <Play className="size-3.5 fill-current" /> Live Owner Demo
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* 1. CINEMATIC HERO */}
        <section className="border-b-[3px] border-[#151515] bg-[#151515] text-[#FFFFFF]">
          <div className="mx-auto max-w-[1360px] px-4 py-14 md:px-6 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 border-2 border-[#EBC95B] bg-[#222222] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
                <span className="size-2 bg-[#C8372B]" /> B2B GYM OPERATIONS &amp; REVENUE OS (SEPARATE FROM ATHLETE APP)
              </div>
              <h1 className="font-headline text-[44px] sm:text-[56px] lg:text-[64px] leading-[0.92] text-[#FFFFFF]">
                RUN EVERY BRANCH.
                <br />
                <span className="text-[#EBC95B]">KNOW EVERY RUPEE.</span>
              </h1>
              <p className="max-w-2xl text-[16px] md:text-[18px] text-[#F6F1E4]/85 leading-relaxed">
                A dedicated India-first operations platform for gym owners, branch managers, front desk, coaches &amp; CAs. Multi-branch GST billing, 7-stage lead sales, WhatsApp automations, churn prediction, classes, PT payroll, POS stock &amp; AI copilot—completely separate from customer workouts &amp; diet tracking.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="/api/demo-login?role=OWNER"
                  className="min-h-[56px] inline-flex items-center gap-2 border-2 border-[#FFFFFF] bg-[#C8372B] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-[#FFFFFF] hover:bg-[#EBC95B] hover:text-[#151515]"
                >
                  <Play className="size-4 fill-current" /> Enter Live Owner CRM Demo <ArrowRight className="size-4" />
                </a>
                <Link
                  href="/onboarding"
                  className="min-h-[56px] inline-flex items-center gap-2 border-2 border-[#FFFFFF] bg-[#222222] px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-[#FFFFFF] hover:bg-[#2B4BCC]"
                >
                  Start Empty Gym Setup
                </Link>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-[13px]">
                <a
                  href="http://localhost:3000/api/demo-login"
                  className="font-bold text-[#EBC95B] underline underline-offset-4 hover:text-[#FFFFFF]"
                >
                  Need Personal Exercises, Nutrition &amp; Client Demo? Open Separate App Demo →
                </a>
                <Link
                  href="/enquire/ironworks-india"
                  className="font-bold text-[#FFFFFF]/80 underline underline-offset-4 hover:text-[#EBC95B]"
                >
                  Test Public Walk-in Enquiry Form →
                </Link>
              </div>
            </div>

            {/* Live Database Proof Poster Block */}
            <div className="lg:col-span-5 bg-[#F6F1E4] text-[#151515] border-[3px] border-[#FFFFFF] p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#151515] pb-3">
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#C8372B]">
                  {"// LIVE POSTGRESQL SANDBOX"}
                </span>
                <span className="bg-[#2B4BCC] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                  IRONWORKS INDIA
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-[#151515] bg-[#FFFFFF] p-3">
                  <p className="text-[12px] font-bold uppercase text-[#6F6B61]">MEMBERS</p>
                  <p className="font-headline text-[32px] font-tabular mt-1">{metrics.members}</p>
                </div>
                <div className="border-2 border-[#151515] bg-[#EBC95B] p-3">
                  <p className="text-[12px] font-bold uppercase text-[#151515]">CHECK-INS</p>
                  <p className="font-headline text-[32px] font-tabular mt-1">{metrics.checkIns.toLocaleString("en-IN")}</p>
                </div>
                <div className="border-2 border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] p-3">
                  <p className="text-[12px] font-bold uppercase text-[#FFFFFF]/80">LEADS</p>
                  <p className="font-headline text-[32px] font-tabular mt-1">{metrics.leads}</p>
                </div>
                <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] p-3">
                  <p className="text-[12px] font-bold uppercase text-[#FFFFFF]/80">GST INVOICES</p>
                  <p className="font-headline text-[32px] font-tabular mt-1">{metrics.invoices.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="border-t-2 border-[#151515] pt-3 flex items-center justify-between text-[12px] font-bold uppercase">
                <span>{metrics.branches} MULTI-STATE BRANCHES (KA + MH)</span>
                <a href="/api/demo-login?role=OWNER" className="text-[#C8372B] hover:underline">
                  OPEN DASHBOARD →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 2. CREDENTIAL BAR */}
        <section className="border-b-[3px] border-[#151515] bg-[#EBC95B] text-[#151515]">
          <div className="mx-auto max-w-[1360px] px-4 py-4 md:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[12px] font-bold uppercase tracking-[0.1em]">
            <div>{"// INTEGER PAISE ACCOUNTING · 0 DRIFT"}</div>
            <div>{"// CGST + SGST + IGST · SAC 999723"}</div>
            <div>{"// AES-256-GCM HEALTH & KYC VAULT"}</div>
            <div>{"// STRICT SERVER RBAC + AUDIT LOG"}</div>
          </div>
        </section>

        {/* 3. INSTANT 1-CLICK ROLE-SCOPED LIVE DEMOS */}
        <section id="roles" className="mx-auto max-w-[1360px] px-4 py-14 md:px-6 space-y-8 scroll-mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[#151515] pb-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#C8372B] mb-1">
                {"// 1-CLICK LIVE PORTAL LAUNCHER"}
              </p>
              <h2 className="font-headline text-[32px] md:text-[44px]">
                TEST EVERY STAFF &amp; MEMBER ROLE LIVE.
              </h2>
            </div>
            <p className="max-w-md text-[14px] text-[#6F6B61]">
              Each button creates a verified PostgreSQL session and drops you straight into that role&apos;s exact branch &amp; RBAC scope—no password required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLE_DEMOS.map((item) => (
              <a
                key={item.role}
                href={item.href}
                className="group border-2 border-[#151515] bg-[#FFFFFF] flex flex-col justify-between transition-transform hover:-translate-y-0.5"
              >
                <div>
                  <div className={`border-b-2 border-[#151515] px-4 py-3 flex items-center justify-between ${item.accent}`}>
                    <span className="text-[12px] font-bold uppercase tracking-[0.1em]">{item.badge}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </div>
                  <div className="p-5 space-y-2">
                    <h3 className="font-headline text-[22px]">{item.title}</h3>
                    <p className="text-[14px] text-[#6F6B61]">{item.description}</p>
                  </div>
                </div>
                <div className="border-t-2 border-[#151515] bg-[#F6F1E4] px-5 py-3 flex items-center justify-between text-[12px] font-bold uppercase">
                  <span>Instant Sign-In</span>
                  <span className="text-[#C8372B]">Launch {item.role} →</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* 4. COMPLETE 4-PHASE PLATFORM INTERACTIVE SHOWCASE */}
        <section id="suites" className="border-y-[3px] border-[#151515] bg-[#FFFFFF] py-14 scroll-mt-16">
          <div className="mx-auto max-w-[1360px] px-4 md:px-6 space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#2B4BCC] mb-1">
                  {"// COMPLETE SAAS ARCHITECTURE"}
                </p>
                <h2 className="font-headline text-[32px] md:text-[44px]">
                  ALL FOUR MODULAR SUITES.
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUITES.map((suite) => (
                  <button
                    key={suite.id}
                    type="button"
                    onClick={() => setActiveSuite(suite.id)}
                    className={`min-h-[44px] border-2 border-[#151515] px-3.5 text-[12px] font-bold uppercase tracking-[0.08em] ${
                      activeSuite === suite.id
                        ? "bg-[#151515] text-[#FFFFFF]"
                        : "bg-[#F6F1E4] text-[#151515] hover:bg-[#EBC95B]"
                    }`}
                  >
                    {suite.step.split(" // ")[1]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 border-[3px] border-[#151515]">
              <div
                className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-[#151515]"
                style={{
                  backgroundColor: currentSuite.accent,
                  color: currentSuite.accent === "#EBC95B" ? "#151515" : "#FFFFFF",
                }}
              >
                <div className="space-y-4">
                  <span className="inline-block border border-current px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.12em]">
                    {currentSuite.step}
                  </span>
                  <h3 className="font-headline text-[32px] leading-[0.95]">{currentSuite.title}</h3>
                  <p className="text-[15px] opacity-90">{currentSuite.summary}</p>
                </div>
                <div className="pt-8">
                  <a
                    href="/api/demo-login?role=OWNER"
                    className="min-h-[48px] inline-flex items-center gap-2 border-2 border-current bg-[#FFFFFF] px-5 text-[13px] font-bold uppercase text-[#151515] hover:bg-[#151515] hover:text-[#FFFFFF]"
                  >
                    Inspect Live in CRM Demo <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>

              <div className="lg:col-span-7 bg-[#F6F1E4] grid grid-cols-1 sm:grid-cols-2 divide-y-2 sm:divide-y-0 sm:gap-[2px] sm:bg-[#151515]">
                {currentSuite.items.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <div key={mod.name} className="bg-[#F6F1E4] p-6 space-y-2">
                      <Icon className="size-6 text-[#C8372B]" />
                      <h4 className="font-headline text-[18px]">{mod.name}</h4>
                      <p className="text-[14px] text-[#6F6B61]">{mod.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 5. GYM OWNER PRICING */}
        <section id="pricing" className="mx-auto max-w-[1360px] px-4 py-14 md:px-6 space-y-8 scroll-mt-16">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#C8372B]">
              {"// TRANSPARENT CLUB PLANS"}
            </p>
            <h2 className="font-headline text-[32px] md:text-[44px]">PRICING FOR GYM OPERATORS.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`border-[3px] border-[#151515] p-6 flex flex-col justify-between ${
                  tier.featured ? "bg-[#151515] text-[#FFFFFF]" : "bg-[#FFFFFF] text-[#151515]"
                }`}
              >
                <div>
                  {tier.featured && (
                    <span className="inline-block bg-[#EBC95B] text-[#151515] px-2.5 py-0.5 text-[12px] font-bold uppercase mb-3">
                      MOST POPULAR
                    </span>
                  )}
                  <h3 className="font-headline text-[24px]">{tier.name}</h3>
                  <p className={`text-[14px] mt-1 ${tier.featured ? "text-[#F6F1E4]/80" : "text-[#6F6B61]"}`}>
                    {tier.blurb}
                  </p>
                  <div className="mt-5 flex items-baseline gap-2 border-y-2 border-current/25 py-4">
                    <span className="font-headline text-[36px] font-tabular">{tier.price}</span>
                    <span className="text-[12px] font-bold uppercase">{tier.cadence}</span>
                  </div>
                  <ul className="mt-5 space-y-2.5 text-[14px]">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className={`size-4 shrink-0 mt-0.5 ${tier.featured ? "text-[#EBC95B]" : "text-[#2B4BCC]"}`} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8">
                  <Link
                    href="/onboarding"
                    className={`min-h-[48px] w-full inline-flex items-center justify-center border-2 font-bold text-[13px] uppercase tracking-[0.08em] ${
                      tier.featured
                        ? "border-[#FFFFFF] bg-[#C8372B] text-[#FFFFFF] hover:bg-[#EBC95B] hover:text-[#151515]"
                        : "border-[#151515] bg-[#F6F1E4] text-[#151515] hover:bg-[#151515] hover:text-[#FFFFFF]"
                    }`}
                  >
                    Start With Empty Org
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. FAQ */}
        <section id="faq" className="border-t-[3px] border-[#151515] bg-[#FFFFFF] py-14 scroll-mt-16">
          <div className="mx-auto max-w-4xl px-4 md:px-6 space-y-6">
            <div className="text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#2B4BCC]">
                {"// ARCHITECTURE & BOUNDARIES"}
              </p>
              <h2 className="font-headline text-[32px] md:text-[44px] mt-1">FREQUENT QUESTIONS.</h2>
            </div>
            <div className="divide-y-2 divide-[#151515] border-[3px] border-[#151515] bg-[#F6F1E4]">
              {FAQS.map((item) => (
                <details key={item.q} className="p-5 group">
                  <summary className="cursor-pointer font-bold text-[16px] flex items-center justify-between gap-4">
                    <span>{item.q}</span>
                    <span className="border border-[#151515] bg-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold">+</span>
                  </summary>
                  <p className="mt-3 text-[14px] text-[#6F6B61] leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t-[3px] border-[#151515] bg-[#151515] text-[#FFFFFF] py-12">
        <div className="mx-auto max-w-[1360px] px-4 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <p className="font-headline text-[24px] text-[#EBC95B]">FORGE CRM.</p>
            <p className="text-[14px] text-[#F6F1E4]/80">
              Multi-tenant gym management, GST billing, retention automation, studios &amp; DPDP admin.
            </p>
          </div>
          <div className="space-y-2 text-[13px]">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">OWNER PORTAL LINKS</p>
            <div className="flex flex-col gap-1.5">
              <a href="/api/demo-login?role=OWNER" className="hover:text-[#EBC95B]">1-Click Live Owner Demo →</a>
              <Link href="/login" className="hover:text-[#EBC95B]">Staff &amp; Role Login →</Link>
              <Link href="/onboarding" className="hover:text-[#EBC95B]">Register New Club →</Link>
              <Link href="/enquire/ironworks-india" className="hover:text-[#EBC95B]">Public Walk-In Form →</Link>
            </div>
          </div>
          <div className="space-y-2 text-[13px]">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">SEPARATE CONSUMER APP</p>
            <div className="flex flex-col gap-1.5">
              <a href="http://localhost:3000" className="hover:text-[#EBC95B]">Forge Fitness App Landing →</a>
              <a href="http://localhost:3000/api/demo-login?next=/app/exercises" className="hover:text-[#EBC95B]">Live Exercises Library (5,632+) →</a>
              <a href="http://localhost:3000/api/demo-login?next=/app/nutrition" className="hover:text-[#EBC95B]">Live Nutrition &amp; IFCT Tracker →</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
