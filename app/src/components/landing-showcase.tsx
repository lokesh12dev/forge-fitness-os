"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/ui";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Two Demos" },
  { href: "http://localhost:3001", label: "Owner CRM" },
  { href: "#watch", label: "Watch" },
  { href: "#unfold", label: "Foldable" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 860 && menuOpen) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  return (
    <>
      <nav className={`landing-navbar${scrolled ? " scrolled" : ""}`} id="navbar" aria-label="Primary">
        <div className="landing-container">
          <div className="landing-navbar__inner">
            <Logo size="md" href="/" />
            <ul className="landing-navbar__links">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
            <div className="landing-navbar__actions">
              <Link href="/login" className="landing-navbar__signin">
                Sign in
              </Link>
              <Link href="/login" className="landing-navbar__cta">
                Start Free <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <button
              ref={toggleRef}
              type="button"
              className={`landing-navbar__toggle${menuOpen ? " active" : ""}`}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              aria-controls="mobileNav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </nav>

      <nav
        id="mobileNav"
        className={`landing-mobile-nav${menuOpen ? " active" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        {NAV_LINKS.map((item) => (
          <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
            {item.label}
          </a>
        ))}
        <Link href="/login" onClick={() => setMenuOpen(false)}>
          Sign in
        </Link>
        <Link href="/login" className="landing-btn landing-btn--primary" onClick={() => setMenuOpen(false)}>
          Start Free
        </Link>
      </nav>
    </>
  );
}

export function LandingRevealObserver() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectors =
      ".forge-landing .reveal, .forge-landing .reveal-left, .forge-landing .reveal-right, .forge-landing .reveal-scale, .forge-landing .reveal-fade, .forge-landing .reveal-scale-up, .forge-landing .reveal-clip, .forge-landing .stagger-children";
    const els = Array.from(document.querySelectorAll<HTMLElement>(selectors));
    const scrubEls = Array.from(document.querySelectorAll<HTMLElement>(".forge-landing [data-scrub]"));
    const countEls = Array.from(document.querySelectorAll<HTMLElement>(".forge-landing [data-count-to]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!("IntersectionObserver" in window) || reduced) {
      els.forEach((el) => el.classList.add("visible"));
      scrubEls.forEach((el) => {
        el.style.setProperty("--p", "1");
        el.classList.add("is-settled");
      });
      if (progressRef.current) progressRef.current.style.transform = "scaleX(0)";
      return;
    }

    // 1. One-shot IntersectionObserver for reveal-* & stagger-children
    const revealVisibleInViewport = () => {
      const vh = window.innerHeight || 900;
      els.forEach((el) => {
        if (el.classList.contains("visible")) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= vh * 0.94 && rect.bottom >= -40) {
          el.classList.add("visible");
        }
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.04, rootMargin: "0px 0px 30px 0px" },
    );

    els.forEach((el) => observer.observe(el));
    revealVisibleInViewport();

    // 2. Animated stat counters when scrolled into view
    const animateCounter = (el: HTMLElement) => {
      const target = Number(el.dataset.countTo || "0");
      const suffix = el.dataset.countSuffix || "";
      if (!Number.isFinite(target) || target <= 0) return;
      const duration = 1100;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = Math.round(target * eased);
        el.textContent = `${val.toLocaleString()}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target as HTMLElement);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 },
    );
    countEls.forEach((el) => countObserver.observe(el));

    // 3. Continuous damped scroll-scrub-to-stop engine (--p: 0 -> 1 and locks)
    type ScrubItem = {
      el: HTMLElement;
      current: number;
      target: number;
      locked: boolean;
      startRatio: number;
      endRatio: number;
    };
    const itemMap = new Map<HTMLElement, ScrubItem>();
    const state: ScrubItem[] = [];

    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

    const syncScrubElements = (snapImmediate = false) => {
      const vh = window.innerHeight || 900;
      const found = document.querySelectorAll<HTMLElement>(".forge-landing [data-scrub]");
      found.forEach((el) => {
        if (!itemMap.has(el)) {
          const item: ScrubItem = {
            el,
            current: 0,
            target: 0,
            locked: false,
            startRatio: Number(el.dataset.scrubStart || "1.08"),
            endRatio: Number(el.dataset.scrubEnd || "0.58"),
          };
          if (snapImmediate) {
            const rect = el.getBoundingClientRect();
            const startY = vh * item.startRatio;
            const endY = vh * item.endRatio;
            const raw = clamp01((startY - rect.top) / Math.max(1, startY - endY));
            item.target = raw;
            item.current = raw;
            if (raw >= 0.996) {
              item.current = 1;
              item.target = 1;
              item.locked = true;
              el.classList.add("is-settled");
            }
            el.style.setProperty("--p", item.current.toFixed(4));
          }
          itemMap.set(el, item);
          state.push(item);
        }
      });
    };

    let rafId = 0;
    let running = false;

    const measureScroll = () => {
      syncScrubElements(false);
      const vh = window.innerHeight || 900;
      const docHeight = document.documentElement.scrollHeight - vh;
      if (progressRef.current && docHeight > 0) {
        const globalP = clamp01(window.scrollY / docHeight);
        progressRef.current.style.transform = `scaleX(${globalP.toFixed(4)})`;
      }

      for (const item of state) {
        if (item.locked) continue;
        const rect = item.el.getBoundingClientRect();
        const startY = vh * item.startRatio;
        const endY = vh * item.endRatio;
        const raw = clamp01((startY - rect.top) / Math.max(1, startY - endY));
        if (raw > item.target) {
          item.target = raw;
        }
      }
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      let needsMore = false;
      for (const item of state) {
        if (item.locked) continue;
        const diff = item.target - item.current;
        if (Math.abs(diff) > 0.002) {
          item.current += diff * 0.16;
          needsMore = true;
        } else {
          item.current = item.target;
        }
        if (item.current >= 0.994 && item.target >= 0.994) {
          item.current = 1;
          item.locked = true;
          item.el.classList.add("is-settled");
        }
        item.el.style.setProperty("--p", item.current.toFixed(4));
      }

      if (needsMore) {
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const onScroll = () => {
      revealVisibleInViewport();
      measureScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measureScroll, { passive: true });
    syncScrubElements(true);
    measureScroll();
    const mountTimer = window.setTimeout(() => {
      syncScrubElements(true);
      measureScroll();
    }, 150);

    return () => {
      observer.disconnect();
      countObserver.disconnect();
      window.clearTimeout(mountTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measureScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return <div ref={progressRef} className="landing-scroll-progress" aria-hidden="true" />;
}

export interface ShowcaseSlide {
  id: string;
  label: string;
  title: string;
  description: string;
  webpSrc: string;
  fallbackSrc: string;
  alt: string;
  width: number;
  height: number;
}

export function StickyShowcase({ items }: { items: ShowcaseSlide[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "ai");
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const updateActiveByCenter = () => {
      if (window.innerWidth <= 1280) return;
      const mid = window.innerHeight * 0.5;
      let bestId = items[0]?.id ?? "ai";
      let bestDist = Infinity;

      blockRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = items[idx]?.id ?? bestId;
        }
      });

      setActiveId(bestId);
    };

    updateActiveByCenter();
    window.addEventListener("scroll", updateActiveByCenter, { passive: true });
    window.addEventListener("resize", updateActiveByCenter, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActiveByCenter);
      window.removeEventListener("resize", updateActiveByCenter);
    };
  }, [items]);

  return (
    <section className="sticky-showcase" id="features">
      <div className="sticky-showcase__grid">
        <div className="sticky-showcase__media">
          {items.map((item) => (
            <div
              key={item.id}
              className={`sticky-showcase__image${activeId === item.id ? " active" : ""}`}
              data-showcase={item.id}
            >
              <picture>
                <source srcSet={item.webpSrc} type="image/webp" />
                <img
                  src={item.fallbackSrc}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  decoding="async"
                />
              </picture>
            </div>
          ))}
        </div>

        <div className="sticky-showcase__content">
          {items.map((item, idx) => (
            <div
              key={item.id}
              ref={(el) => {
                blockRefs.current[idx] = el;
              }}
              data-trigger={item.id}
              data-scrub="right"
              className="sticky-showcase__block scrub-right"
            >
              <div className="sticky-showcase__block-image">
                <picture>
                  <source srcSet={item.webpSrc} type="image/webp" />
                  <img
                    src={item.fallbackSrc}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                    decoding="async"
                  />
                </picture>
              </div>
              <span className="section-label">{item.label}</span>
              <h2 className="landing-h2 section-title">{item.title}</h2>
              <p className="section-text">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const WATCH_ORBIT_PHASES = [
  { id: "sets", label: "01 · Live Set Logging" },
  { id: "hr", label: "02 · Heart Rate Zones" },
  { id: "rest", label: "03 · Smart Rest Timers" },
];

export function WatchSpinShowcase() {
  const secRef = useRef<HTMLElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<SVGSVGElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const sec = secRef.current;
    const spin = spinRef.current;
    const dial = dialRef.current;
    const arc = arcRef.current;
    const glow = glowRef.current;
    const hint = hintRef.current;
    if (!sec || !spin || !dial || !arc || !glow) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const CIRCUMFERENCE = 2 * Math.PI * 232;
    arc.style.strokeDasharray = `${CIRCUMFERENCE}`;

    if (reduce) {
      arc.style.strokeDashoffset = "0";
      return;
    }

    let rafId = 0;
    let prevY = window.scrollY;
    let targetAngle = 0;
    let currentAngle = 0;
    let targetProgress = 0;
    let currentProgress = 0;
    let velImpulse = 0;
    let lastPhase = 0;

    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

    const readScroll = () => {
      const y = window.scrollY;
      const dy = y - prevY;
      prevY = y;

      const vh = window.innerHeight || 900;
      const rect = sec.getBoundingClientRect();
      const runway = sec.offsetHeight - vh;

      if (runway > 0) {
        const p = clamp01(-rect.top / runway);
        targetProgress = p;
        // Blend linear + sine ease for a medium, poised 360° full-circle orbit
        const blended = p * 0.4 + easeInOutSine(p) * 0.6;
        targetAngle = blended * 360;

        if (rect.bottom > 0 && rect.top < vh) {
          velImpulse = Math.max(-1.6, Math.min(1.6, velImpulse + dy * 0.035));
        }
      } else {
        const p = clamp01((vh - rect.top) / (vh + rect.height));
        targetProgress = p;
        targetAngle = easeInOutSine(p) * 360;
      }
    };

    const tick = () => {
      // Smooth medium-damped spring tracking
      currentAngle += (targetAngle - currentAngle) * 0.095 + velImpulse;
      velImpulse *= 0.88;
      if (Math.abs(velImpulse) < 0.005) velImpulse = 0;

      currentProgress += (targetProgress - currentProgress) * 0.12;

      // Entry scale-in (0 -> 0.18), mid-orbit lift, clean upright settle (0.85 -> 1)
      const entryScale = 0.88 + 0.12 * clamp01(currentProgress / 0.18);
      const midBoost = Math.sin(currentProgress * Math.PI) * 0.035;
      const tiltX = Math.sin(currentProgress * Math.PI) * 5;
      const scale = entryScale + midBoost;

      spin.style.transform = `perspective(1200px) rotateX(${tiltX.toFixed(2)}deg) rotateZ(${currentAngle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;

      // Counter-rotating precision chronograph bezel
      const counterAngle = -currentAngle * 0.35;
      dial.style.transform = `rotate(${counterAngle.toFixed(2)}deg) scale(${(0.95 + currentProgress * 0.05).toFixed(4)})`;

      // Progress ring sweep around the circle
      const offset = CIRCUMFERENCE * (1 - clamp01(currentProgress));
      arc.style.strokeDashoffset = offset.toFixed(2);

      // Subtle breathing glow tied to orbit & gentle scroll velocity
      const velGlow = Math.min(0.22, Math.abs(velImpulse) * 0.12);
      const orbitGlow = 0.18 + Math.sin(currentProgress * Math.PI) * 0.24 + velGlow;
      glow.style.opacity = orbitGlow.toFixed(3);

      // Fade out scroll hint once user starts orbiting
      if (hint) {
        hint.style.opacity = String(clamp01(1 - currentProgress / 0.09).toFixed(3));
      }

      // Update active phase pill
      const nextPhase = currentProgress < 0.35 ? 0 : currentProgress < 0.72 ? 1 : 2;
      if (nextPhase !== lastPhase) {
        lastPhase = nextPhase;
        setActivePhase(nextPhase);
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", readScroll, { passive: true });
    readScroll();
    currentProgress = targetProgress;
    currentAngle = targetAngle;
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", readScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section ref={secRef} id="watch" className="viewport-section scroll-mt-20">
      <div className="viewport-section__sticky">
        <div className="viewport-section__content">
          <div className="viewport-section__image reveal-scale-up relative flex items-center justify-center">
            {/* Ambient radial glow */}
            <div
              ref={glowRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-auto size-[82%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(201,247,58,0.24) 0%, rgba(201,247,58,0.06) 46%, transparent 72%)",
                opacity: 0.2,
              }}
            />

            {/* Counter-rotating precision bezel + progress ring */}
            <svg
              ref={dialRef}
              viewBox="0 0 500 500"
              aria-hidden="true"
              className="viewport-section__dial pointer-events-none"
            >
              <circle
                cx="250"
                cy="250"
                r="238"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              <circle
                cx="250"
                cy="250"
                r="232"
                fill="none"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1.5"
                strokeDasharray="2 10"
              />
              <circle
                ref={arcRef}
                cx="250"
                cy="250"
                r="232"
                fill="none"
                stroke="#c9f73a"
                strokeWidth="2"
                strokeLinecap="round"
                transform="rotate(-90 250 250)"
                style={{ opacity: 0.65 }}
              />
            </svg>

            {/* Orbiting watch cluster */}
            <div
              ref={spinRef}
              className="viewport-section__orbit"
              style={{
                transformOrigin: "50% 50%",
                willChange: "transform",
              }}
            >
              <picture>
                <source srcSet="/landing/applewatchtransparent.webp" type="image/webp" />
                <img
                  src="/landing/applewatchtransparent.png"
                  alt="Forge Fitness wrist companion interface"
                  width={1400}
                  height={1670}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
          </div>

          <span className="section-label reveal-fade">Wrist Companion</span>
          <h2 className="landing-h2 section-title reveal-fade">Train untethered.</h2>
          <p className="section-text reveal-fade mx-auto text-center">
            Log sets, run rest timers, track heart rate zones, and follow adaptive prescriptions right from your wrist—without reaching for your phone between sets.
          </p>

          <div className="viewport-section__phases" aria-label="Watch orbit highlights">
            {WATCH_ORBIT_PHASES.map((phase, idx) => (
              <span
                key={phase.id}
                className={`viewport-section__phase${activePhase === idx ? " is-active" : ""}`}
              >
                {phase.label}
              </span>
            ))}
          </div>
        </div>

        <div ref={hintRef} className="viewport-section__hint" aria-hidden="true">
          <span>Scroll to orbit</span>
        </div>
      </div>
    </section>
  );
}

const STATEMENT_WORDS = [
  { text: "Forge", accent: false, line: 1 },
  { text: "Fitness", accent: false, line: 1 },
  { text: "doesn't", accent: false, line: 1 },
  { text: "guess.", accent: false, line: 1 },
  { text: "Every", accent: true, line: 2 },
  { text: "input", accent: true, line: 2 },
  { text: "changes", accent: false, line: 2 },
  { text: "the", accent: false, line: 2 },
  { text: "prescription.", accent: false, line: 2 },
];

const TELEMETRY_INPUTS = [
  { side: "left", label: "SLEEP", value: "7h 48m", at: 0.14 },
  { side: "left", label: "HRV", value: "+14 ms", at: 0.28 },
  { side: "left", label: "SORENESS", value: "Low · 2/10", at: 0.42 },
  { side: "right", label: "RPE", value: "7.5 Target", at: 0.2 },
  { side: "right", label: "EQUIPMENT", value: "Rack Taken → Swap", at: 0.36 },
  { side: "right", label: "TIME", value: "35m Compress", at: 0.5 },
];

export function StatementBreatherShowcase() {
  const secRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sec = secRef.current;
    if (!sec) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    let rafId = 0;
    let current = 0;
    let target = 0;

    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

    const measure = () => {
      const vh = window.innerHeight || 900;
      const rect = sec.getBoundingClientRect();
      const runway = sec.offsetHeight - vh;
      if (runway > 0) {
        target = clamp01(-rect.top / runway);
      } else {
        target = clamp01((vh * 0.85 - rect.top) / (vh * 0.6));
      }
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const tick = () => {
      rafId = 0;
      const diff = target - current;
      if (Math.abs(diff) > 0.002) {
        current += diff * 0.14;
        setProgress(current);
        rafId = requestAnimationFrame(tick);
      } else if (current !== target) {
        current = target;
        setProgress(current);
      }
    };

    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    measure();

    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const leftInputs = TELEMETRY_INPUTS.filter((t) => t.side === "left");
  const rightInputs = TELEMETRY_INPUTS.filter((t) => t.side === "right");

  return (
    <section ref={secRef} className="statement-engine" aria-label="Deterministic Adaptive Engine">
      <div className="statement-engine__sticky">
        <div className="statement-engine__grid-bg" aria-hidden="true" />
        <div
          className="statement-engine__glow"
          aria-hidden="true"
          style={{ opacity: 0.25 + progress * 0.55, transform: `translate(-50%, -50%) scale(${0.88 + progress * 0.22})` }}
        />

        <div className="statement-engine__stage">
          <div className="statement-engine__side statement-engine__side--left" aria-hidden="true">
            {leftInputs.map((item) => {
              const active = progress >= item.at;
              return (
                <div key={item.label} className={`statement-engine__pill${active ? " is-on" : ""}`}>
                  <span className="statement-engine__dot" />
                  <span className="statement-engine__pill-label">{item.label}</span>
                  <span className="statement-engine__pill-val">{item.value}</span>
                </div>
              );
            })}
          </div>

          <div className="statement-engine__center">
            <span className="section-label" style={{ opacity: 0.45 + progress * 0.55 }}>
              Deterministic Engine
            </span>
            <h2 className="statement-engine__headline">
              <span className="statement-engine__line">
                {STATEMENT_WORDS.filter((w) => w.line === 1).map((w, idx) => {
                  const lit = progress >= 0.06 + idx * 0.07;
                  return (
                    <span
                      key={`${w.text}-${idx}`}
                      className={`statement-engine__word statement-engine__word--muted${lit ? " is-lit" : ""}`}
                    >
                      {w.text}{" "}
                    </span>
                  );
                })}
              </span>
              <span className="statement-engine__line">
                {STATEMENT_WORDS.filter((w) => w.line === 2).map((w, idx) => {
                  const lit = progress >= 0.34 + idx * 0.08;
                  return (
                    <span
                      key={`${w.text}-${idx}`}
                      className={`statement-engine__word${w.accent ? " statement-engine__word--acid" : ""}${lit ? " is-lit" : ""}`}
                    >
                      {w.text}{" "}
                    </span>
                  );
                })}
              </span>
            </h2>

            <div className={`statement-engine__output${progress >= 0.72 ? " is-on" : ""}`}>
              <span className="statement-engine__output-dot" />
              <span>PRESCRIPTION LIVE · BENCH 185 × 8 @ RPE 7 · +2.5% PROGRESSION</span>
            </div>
          </div>

          <div className="statement-engine__side statement-engine__side--right" aria-hidden="true">
            {rightInputs.map((item) => {
              const active = progress >= item.at;
              return (
                <div key={item.label} className={`statement-engine__pill statement-engine__pill--right${active ? " is-on" : ""}`}>
                  <span className="statement-engine__dot" />
                  <span className="statement-engine__pill-label">{item.label}</span>
                  <span className="statement-engine__pill-val">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const CHAPTERS = [
  { id: "features", label: "Features" },
  { id: "demo", label: "Demos" },
  { id: "watch", label: "Watch" },
  { id: "analytics", label: "Analytics" },
  { id: "unfold", label: "Foldable" },
  { id: "pricing", label: "Pricing" },
];

export function ScrollChapterHud() {
  const [activeId, setActiveId] = useState("features");

  useEffect(() => {
    const update = () => {
      const mid = window.innerHeight * 0.45;
      let current = CHAPTERS[0].id;
      for (const ch of CHAPTERS) {
        const el = document.getElementById(ch.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid) current = ch.id;
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <aside className="landing-chapter-hud" aria-label="Page sections">
      {CHAPTERS.map((ch) => (
        <a
          key={ch.id}
          href={`#${ch.id}`}
          className={`landing-chapter-hud__item${activeId === ch.id ? " is-active" : ""}`}
        >
          <span className="landing-chapter-hud__label">{ch.label}</span>
          <span className="landing-chapter-hud__dot" />
        </a>
      ))}
    </aside>
  );
}
