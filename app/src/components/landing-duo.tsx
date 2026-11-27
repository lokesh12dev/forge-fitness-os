"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Play } from "lucide-react";

const HERO_FRAMES = 48;
const HERO_BASE = "/landing/duo/unfold_";

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * 1. Scroll-driven 48-frame unfold hero ("Unfold your workout.")
 * Mirrors the exact canvas frame loader, geometry centering/scaling,
 * headline fade/lift, final-frame crossfade, and posture captions.
 */
export function DuoFoldHero() {
  const heroRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalImgRef = useRef<HTMLImageElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [isStatic, setIsStatic] = useState(false);
  const [activeCap, setActiveCap] = useState<"" | "closed" | "book" | "open">("");

  useEffect(() => {
    const hero = heroRef.current;
    const text = textRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const finalImg = finalImgRef.current;
    const hint = hintRef.current;
    if (!hero || !text || !stage || !canvas || !finalImg || !hint) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (reduce || !ctx) {
      setIsStatic(true);
      return;
    }

    let cancelled = false;
    let cleanupScroll: (() => void) | null = null;

    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      if (probe.width > 0) {
        cleanupScroll = startAnimation(hero, text, stage, canvas, ctx, finalImg, hint);
      } else {
        setIsStatic(true);
      }
    };
    probe.onerror = () => {
      if (!cancelled) setIsStatic(true);
    };
    probe.src = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

    function startAnimation(
      heroEl: HTMLElement,
      textEl: HTMLDivElement,
      stageEl: HTMLDivElement,
      canvasEl: HTMLCanvasElement,
      context: CanvasRenderingContext2D,
      finalEl: HTMLImageElement,
      hintEl: HTMLDivElement,
    ) {
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(window.innerWidth, 1200) * dpr > 1000 ? 1500 : 820;
      const frames: Array<HTMLImageElement | undefined> = [];
      let want = 0;
      let shown = -1;

      const frameUrl = (i: number) =>
        `${HERO_BASE}${i === HERO_FRAMES ? "final" : i < 10 ? `0${i}` : `${i}`}-${size}.webp`;

      const nearest = (i: number) => {
        for (let d = 0; d < HERO_FRAMES; d++) {
          if (frames[i - d]) return i - d;
          if (frames[i + d]) return i + d;
        }
        return -1;
      };

      const draw = (force = false) => {
        const i = nearest(want);
        if (i < 0 || (i === shown && !force)) return;
        const im = frames[i];
        if (!im) return;
        shown = i;
        context.clearRect(0, 0, canvasEl.width, canvasEl.height);
        context.drawImage(im, 0, 0, canvasEl.width, canvasEl.height);
      };

      const order: number[] = [0, HERO_FRAMES - 1];
      for (let k = 6; k < HERO_FRAMES - 1; k += 6) order.push(k);
      for (let k = 3; k < HERO_FRAMES - 1; k += 3) if (!order.includes(k)) order.push(k);
      for (let k = 1; k < HERO_FRAMES - 1; k++) if (!order.includes(k)) order.push(k);

      let cursor = 0;
      const pump = () => {
        if (cancelled || cursor >= order.length) return;
        const i = order[cursor++];
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          if (cancelled) return;
          frames[i] = im;
          if (i === 0 && (canvasEl.width !== im.naturalWidth || canvasEl.height !== im.naturalHeight)) {
            canvasEl.width = im.naturalWidth;
            canvasEl.height = im.naturalHeight;
          }
          draw(i === 0);
          pump();
        };
        im.onerror = pump;
        im.src = frameUrl(i);
      };
      pump();
      pump();
      pump();

      const geo = { ty: 0, s: 1 };
      const measure = () => {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const top = stageEl.offsetTop;
        const h = stageEl.offsetHeight;
        const w = stageEl.offsetWidth;
        if (!h || !w) return;
        const centre = vh * 0.52;
        geo.ty = centre - (top + h / 2);
        geo.s = Math.min(1.9, (vh * 0.82) / h, (vw * 0.96) / w);
        if (geo.s < 1) geo.s = 1;
      };

      let ticking = false;
      const update = () => {
        ticking = false;
        if (cancelled) return;
        const vh = window.innerHeight;
        const rect = heroEl.getBoundingClientRect();
        const runway = heroEl.offsetHeight - vh;
        const p = runway > 0 ? clamp01(-rect.top / runway) : 1;

        const kt = smoothstep(0, 0.08, p);
        const k = smoothstep(0.04, 0.3, p);
        textEl.style.opacity = String(1 - kt);
        textEl.style.transform = `translateY(${(-36 * kt).toFixed(1)}px)`;
        textEl.style.pointerEvents = kt > 0.5 ? "none" : "";
        stageEl.style.transform = `translate3d(0,${(geo.ty * k).toFixed(1)}px,0) scale(${(1 + (geo.s - 1) * k).toFixed(4)})`;

        const f = clamp01((p - 0.12) / 0.74);
        want = Math.round(f * (HERO_FRAMES - 1));
        draw();

        finalEl.style.opacity = String(clamp01((p - 0.88) / 0.09));

        let cap: "" | "closed" | "book" | "open" =
          f < 0.14 ? "closed" : f > 0.3 && f < 0.72 ? "book" : f > 0.9 ? "open" : "";
        if (p < 0.04) cap = "";
        setActiveCap((prev) => (prev === cap ? prev : cap));
        hintEl.style.opacity = String(1 - smoothstep(0, 0.06, p));
      };

      const tick = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      };

      const onResize = () => {
        measure();
        tick();
      };
      const onLoad = () => {
        measure();
        tick();
      };

      window.addEventListener("scroll", tick, { passive: true });
      window.addEventListener("resize", onResize);
      window.addEventListener("load", onLoad);
      measure();
      update();
      const t1 = window.setTimeout(onLoad, 350);
      const t2 = window.setTimeout(onLoad, 1200);

      return () => {
        window.removeEventListener("scroll", tick);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("load", onLoad);
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    return () => {
      cancelled = true;
      cleanupScroll?.();
    };
  }, []);

  return (
    <section ref={heroRef} className={`duo-hero${isStatic ? " is-static" : ""}`} id="unfold">
      <div className="duo-hero__sticky">
        <div ref={textRef} className="duo-hero__text">
          <span className="section-label">Adaptive Display</span>
          <h1>Unfold your workout.</h1>
          <p>
            Forge Fitness has an interface designed for every posture. Closed, opened like a book, completely flat, resting on a surface, or standing on its own.
          </p>
          <div className="duo-hero__ctas">
            <Link href="/login" className="landing-btn landing-btn--primary landing-btn--large">
              Start Training Free <ArrowRight className="size-4" />
            </Link>
            <a href="/api/demo-login" className="landing-btn landing-btn--secondary landing-btn--large">
              <Play className="size-4 text-acid" /> Try Live Demo
            </a>
          </div>
        </div>

        <div
          ref={stageRef}
          className="duo-hero__stage"
          role="img"
          aria-label="Foldable phone opening from closed to fully opened, with Forge Fitness adapting from the cover display to two pages and then to one large canvas"
        >
          <div className="duo-hero__stage-inner">
            <canvas ref={canvasRef} className="duo-hero__canvas" width={1500} height={1154} aria-hidden="true" />
            <picture>
              <source srcSet="/landing/duo/unfold_final-1500.webp" type="image/webp" />
              <img
                ref={finalImgRef}
                className="duo-hero__final"
                src="/landing/duo/unfold_final-1500.png"
                alt="Forge Fitness running on a fully unfolded large canvas"
                width={1500}
                height={1154}
                decoding="async"
              />
            </picture>
          </div>
        </div>

        <div className="duo-hero__caps" aria-hidden="true">
          <span className={`duo-hero__cap${activeCap === "closed" ? " is-on" : ""}`}>
            Closed<small>The cover display, in one hand</small>
          </span>
          <span className={`duo-hero__cap${activeCap === "book" ? " is-on" : ""}`}>
            Book Style<small>Two pages, nothing across the fold</small>
          </span>
          <span className={`duo-hero__cap${activeCap === "open" ? " is-on" : ""}`}>
            Fully Opened<small>One large canvas</small>
          </span>
        </div>

        <div ref={hintRef} className="duo-hero__hint" aria-hidden="true">
          <div className="duo-hero__hint-inner">
            <span>Scroll to unfold</span>
            <ChevronDown className="size-4" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 2. Five Postures Line-Up ("One app. Five postures.")
 * Deals out from center when scrolled into view.
 */
const POSTURES = [
  {
    key: "closed",
    title: "Closed",
    subtitle: "In one hand.",
    desktopWebp: "/landing/duo/posture-closed.webp",
    desktopPng: "/landing/duo/posture-closed.png",
    mobileWebp: "/landing/duo/posture-closed-m.webp",
    mobilePng: "/landing/duo/posture-closed-m.png",
    alt: "Closed cover display showing Forge Fitness routines",
    dx: 2,
    d: 2,
    i: 0,
  },
  {
    key: "book",
    title: "Book Style",
    subtitle: "Two pages.",
    desktopWebp: "/landing/duo/posture-book-style.webp",
    desktopPng: "/landing/duo/posture-book-style.png",
    mobileWebp: "/landing/duo/posture-book-style-m.webp",
    mobilePng: "/landing/duo/posture-book-style-m.png",
    alt: "Book style posture showing Forge Fitness split across two pages",
    dx: 1,
    d: 1,
    i: 1,
  },
  {
    key: "open",
    title: "Fully Opened",
    subtitle: "One large canvas.",
    desktopWebp: "/landing/duo/posture-fully-opened.webp",
    desktopPng: "/landing/duo/posture-fully-opened.png",
    mobileWebp: "/landing/duo/posture-fully-opened-m.webp",
    mobilePng: "/landing/duo/posture-fully-opened-m.png",
    alt: "Fully opened posture showing Forge Fitness on one large canvas",
    dx: 0,
    d: 0,
    i: 2,
  },
  {
    key: "seated",
    title: "Seated",
    subtitle: "A tiny laptop.",
    desktopWebp: "/landing/duo/posture-seated.webp",
    desktopPng: "/landing/duo/posture-seated.png",
    mobileWebp: "/landing/duo/posture-seated-m.webp",
    mobilePng: "/landing/duo/posture-seated-m.png",
    alt: "Seated half-folded posture running a Forge Fitness HIIT timer",
    dx: -1,
    d: 1,
    i: 3,
  },
  {
    key: "tent",
    title: "Tent",
    subtitle: "Stands on its own.",
    desktopWebp: "/landing/duo/posture-tent.webp",
    desktopPng: "/landing/duo/posture-tent.png",
    mobileWebp: "/landing/duo/posture-tent-m.webp",
    mobilePng: "/landing/duo/posture-tent-m.png",
    alt: "Tent posture standing on its own with Forge Fitness HIIT view",
    dx: -2,
    d: 2,
    i: 4,
  },
];

export function DuoPosturesLineup() {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (!("IntersectionObserver" in window)) {
      setIsIn(true);
      return;
    }

    const checkVisible = () => {
      const rect = row.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.88 && rect.bottom >= 0) {
        setIsIn(true);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsIn(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(row);
    checkVisible();
    window.addEventListener("scroll", checkVisible, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", checkVisible);
    };
  }, []);

  return (
    <section className="duo-lineup" id="five-postures">
      <div className="landing-container">
        <div className="duo-lineup__intro reveal-fade">
          <span className="section-label">Five postures</span>
          <h2 className="landing-h2">One app. Five postures.</h2>
          <p className="landing-lead">
            A foldable isn&apos;t one screen. Forge Fitness follows along as you move from one posture to the next. Same app, same data, same workout—rearranged around how you train.
          </p>
        </div>
      </div>
      <div ref={rowRef} className={`duo-lineup__row${isIn ? " is-in" : ""}`} role="list">
        {POSTURES.map((p) => (
          <figure
            key={p.key}
            className="duo-lineup__item"
            role="listitem"
            style={{ "--dx": p.dx, "--d": p.d, "--i": p.i } as CSSProperties}
          >
            <div className="duo-lineup__media">
              <picture>
                <source media="(max-width: 768px)" srcSet={p.mobileWebp} type="image/webp" />
                <source media="(max-width: 768px)" srcSet={p.mobilePng} />
                <source srcSet={p.desktopWebp} type="image/webp" />
                <img src={p.desktopPng} alt={p.alt} width={1457} height={1225} loading="eager" decoding="async" />
              </picture>
            </div>
            <figcaption>
              <strong>{p.title}</strong>
              <span>{p.subtitle}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * 3. Closed and Book Style split tiles with auto-cycling screens & progress dots
 */
interface CycleSlide {
  webp: string;
  png: string;
  alt: string;
  caption: string;
  label: string;
  w: number;
  h: number;
}

const CLOSED_SLIDES: CycleSlide[] = [
  {
    webp: "/landing/releases/83/routines-closed-1.webp",
    png: "/landing/releases/83/routines-closed-1.png",
    alt: "Forge Fitness routines on the cover display with side navigation",
    caption: "Check what is up next",
    label: "Show what is up next",
    w: 1292,
    h: 1788,
  },
  {
    webp: "/landing/releases/83/routines-closed-2.webp",
    png: "/landing/releases/83/routines-closed-2.png",
    alt: "Routine exercises overview on the cover display",
    caption: "Open a routine",
    label: "Show a routine",
    w: 1292,
    h: 1788,
  },
  {
    webp: "/landing/releases/83/routines-closed-3.webp",
    png: "/landing/releases/83/routines-closed-3.png",
    alt: "Exercise sets and Start Workout Session button on the cover display",
    caption: "Review every exercise and start your session",
    label: "Show an exercise",
    w: 1292,
    h: 1788,
  },
];

const BOOK_SLIDES: CycleSlide[] = [
  {
    webp: "/landing/releases/83/routines-book-1.webp",
    png: "/landing/releases/83/routines-book-1.png",
    alt: "Book Style layout with summary and active session on the left, routines on the right",
    caption: "Your summary and your session on the left. What is up next on the right.",
    label: "Show the summary and what is up next",
    w: 2237,
    h: 1793,
  },
  {
    webp: "/landing/releases/83/routines-book-2.webp",
    png: "/landing/releases/83/routines-book-2.png",
    alt: "Book Style layout with routine on the left page and selected exercise on the right",
    caption: "The routine stays on the left. The exercise opens on the right.",
    label: "Show a routine and an exercise",
    w: 2237,
    h: 1793,
  },
];

function CycleTile({
  variant,
  label,
  title,
  description,
  slides,
  intervalMs,
}: {
  variant: "closed" | "book";
  label: string;
  title: string;
  description: string;
  slides: CycleSlide[];
  intervalMs: number;
}) {
  const tileRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setVisible(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !visible || document.hidden) {
      setPaused(true);
      return;
    }
    setPaused(false);
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
      setCycleKey((k) => k + 1);
    }, intervalMs);

    const onVis = () => {
      if (document.hidden) setPaused(true);
      else if (visible) setPaused(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [visible, intervalMs, slides.length, cycleKey]);

  const selectSlide = (idx: number) => {
    setActive(idx);
    setCycleKey((k) => k + 1);
  };

  return (
    <article
      ref={tileRef}
      className={`duo-tile duo-tile--${variant} reveal-fade${paused ? " is-paused" : ""}`}
      style={{ "--dur": `${intervalMs}ms` } as CSSProperties}
    >
      <div className="duo-tile__text">
        <span className="section-label">{label}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="duo-tile__media">
        <div className="duo-cycle">
          {slides.map((s, idx) => (
            <picture key={s.webp} className={`duo-cycle__shot${idx === active ? " is-on" : ""}`}>
              <source srcSet={s.webp} type="image/webp" />
              <img src={s.png} alt={s.alt} width={s.w} height={s.h} loading="eager" decoding="async" />
            </picture>
          ))}
        </div>
      </div>
      <div className="duo-tile__foot">
        <p className="duo-cycle__caps">
          {slides.map((s, idx) => (
            <span key={s.caption} className={idx === active ? "is-on" : ""}>
              {s.caption}
            </span>
          ))}
        </p>
        <div className="duo-cycle__dots">
          {slides.map((s, idx) => (
            <button
              key={`${idx}-${idx === active ? cycleKey : "idle"}`}
              type="button"
              className={idx === active ? "is-on" : ""}
              aria-label={s.label}
              onClick={() => selectSlide(idx)}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function DuoSplitTiles() {
  return (
    <section className="duo-tiles" id="closed-and-book-style">
      <div className="duo-tiles__grid">
        <CycleTile
          variant="closed"
          label="Closed"
          title="Closed, every pixel counts."
          description="We moved Forge Fitness navigation out of the way. The tab bar and primary actions sit along the side of the cover display, giving your workout every pixel. Check what is up next, open a routine, review every exercise, and start your session one-handed."
          slides={CLOSED_SLIDES}
          intervalMs={3400}
        />
        <CycleTile
          variant="book"
          label="Book Style"
          title="Two pages. Nothing across the fold."
          description="Your summary and active session take the left page. What is up next and your routines take the right. Open a routine and the pages follow you: the routine stays on the left, while the exercise you pick opens on the right with its muscle map, sets, and progress."
          slides={BOOK_SLIDES}
          intervalMs={4200}
        />
      </div>
    </section>
  );
}

/**
 * 4. Fully Opened 7-step camera zoom & spotlight ("One large canvas.")
 * Preserves exact SR display coordinates, STEPS, P0/P1/P2/MOVE, and viewport clamping.
 */
const CANVAS_SR = [0.02318, 0.03603, 0.95099, 0.9321, 0.057];
const CANVAS_BASE = "/landing/duo/canvas-";
const CANVAS_ALT: Record<string, string> = {
  r1: "Forge Fitness routines on a fully opened canvas, with summary and active session in the narrower column and upcoming workouts in the wider one",
  r2: "Active workout on a fully opened canvas, with the routine on the left, exercise on the right, and live session telemetry along the side",
  h1: "Forge Fitness history on a fully opened canvas, with the calendar and goals next to logged workouts",
  h2: "Forge Fitness history with the calendar switched to a weekly workout chart beside logged sessions",
  h3: "Workout summary on a fully opened canvas, with metrics on one side and volume charts on the other",
  h4: "Muscle recovery view on a fully opened canvas, with the full body map beside the muscle and exercise breakdown",
};

interface ZoomStep {
  shot: string;
  focus?: [number, number, number, number];
  zoom?: number;
  tag: string;
  text: string;
}

const ZOOM_STEPS: ZoomStep[] = [
  {
    shot: "r1",
    tag: "Routines",
    text: "Forge Fitness uses the whole display, with a narrower column for context and a wider one for detail.",
  },
  {
    shot: "r2",
    focus: [0.914, 0.525, 0.072, 0.46],
    zoom: 1.45,
    tag: "During a workout",
    text: "Your session never leaves the screen. The side rail becomes a live view of your workout with elapsed time, calories, and heart rate.",
  },
  {
    shot: "r2",
    focus: [0.574, 0.886, 0.224, 0.104],
    zoom: 1.45,
    tag: "Smart Action Button",
    text: "The Smart Action Button always shows your next step.",
  },
  {
    shot: "h1",
    tag: "History",
    text: "Your calendar, goals, and every logged workout side by side—fitting far more context on screen at once.",
  },
  {
    shot: "h2",
    focus: [0.012, 0.135, 0.382, 0.44],
    zoom: 1.3,
    tag: "Charts",
    text: "One tap switches the calendar to a weekly view of your workouts, while your logged sessions stay right where they are.",
  },
  {
    shot: "h3",
    tag: "Workout Summary",
    text: "Numbers on one side. Charts on the other. Every metric and comparison next to charts that finally have room to breathe.",
  },
  {
    shot: "h4",
    tag: "Muscles",
    text: "The full body map stays put while the list of muscles and the exercises behind each one scrolls beside it.",
  },
];

export function DuoCanvasZoom() {
  const secRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slot0Ref = useRef<HTMLDivElement>(null);
  const slot1Ref = useRef<HTMLDivElement>(null);
  const img0Ref = useRef<HTMLImageElement>(null);
  const img1Ref = useRef<HTMLImageElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const [isStatic, setIsStatic] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const sec = secRef.current;
    const sticky = stickyRef.current;
    const head = headRef.current;
    const stage = stageRef.current;
    const slot0 = slot0Ref.current;
    const slot1 = slot1Ref.current;
    const img0 = img0Ref.current;
    const img1 = img1Ref.current;
    const screen = screenRef.current;
    const dim = dimRef.current;
    if (!sec || !sticky || !head || !stage || !slot0 || !slot1 || !img0 || !img1 || !screen || !dim) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIsStatic(true);
      return;
    }

    let cancelled = false;
    let cleanupZoom: (() => void) | null = null;

    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      if (probe.width > 0) {
        cleanupZoom = initZoom(sec, sticky, head, stage, [slot0, slot1], [img0, img1], screen, dim);
      } else {
        setIsStatic(true);
      }
    };
    probe.onerror = () => {
      if (!cancelled) setIsStatic(true);
    };
    probe.src = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

    function initZoom(
      secEl: HTMLElement,
      stickyEl: HTMLDivElement,
      headEl: HTMLDivElement,
      stageEl: HTMLDivElement,
      slots: [HTMLDivElement, HTMLDivElement],
      imgs: [HTMLImageElement, HTMLImageElement],
      screenEl: HTMLDivElement,
      dimEl: HTMLDivElement,
    ) {
      const P0 = 0.05;
      const P1 = 0.17;
      const P2 = 0.95;
      const N = ZOOM_STEPS.length;
      const STEP = (P2 - P1) / N;
      const MOVE = 0.34;

      const dpr = window.devicePixelRatio || 1;
      const need = Math.min(window.innerWidth * 0.94, window.innerHeight * 0.72 * 1.42) * 1.45 * dpr;
      const size = need > 1500 ? 3200 : 1600;
      const url = (shot: string) => `${CANVAS_BASE}${shot}-${size}.webp`;

      const snap = (el: HTMLElement) => {
        el.classList.add("no-trans");
        void el.offsetWidth;
        el.classList.remove("no-trans");
      };

      const cache: Record<string, HTMLImageElement> = {};
      const preload = (shot: string, cb?: () => void) => {
        let im = cache[shot];
        if (!im) {
          im = cache[shot] = new Image();
          im.decoding = "async";
          im.src = url(shot);
        }
        if (im.complete && im.naturalWidth) {
          cb?.();
          return;
        }
        if (cb) {
          im.addEventListener("load", cb, { once: true });
          im.addEventListener("error", cb, { once: true });
        }
      };

      imgs[0].src = url("r1");
      const queue = ["r2", "h1", "h2", "h3", "h4"];
      const pump = () => {
        if (!cancelled && queue.length) {
          const nextShot = queue.shift();
          if (nextShot) preload(nextShot, pump);
        }
      };

      let nearIo: IntersectionObserver | null = null;
      if ("IntersectionObserver" in window) {
        nearIo = new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) {
              nearIo?.disconnect();
              pump();
            }
          },
          { rootMargin: "120% 0px" },
        );
        nearIo.observe(secEl);
      } else {
        pump();
      }

      let front = 0;
      let current = "r1";
      let token = 0;
      let pendingOff: number | null = null;

      const showShot = (shot: string) => {
        if (shot === current) return;
        current = shot;
        const my = ++token;
        preload(shot, () => {
          if (cancelled || my !== token) return;
          const inIdx = 1 - front;
          const inSlot = slots[inIdx];
          const outSlot = slots[front];
          const im = imgs[inIdx];
          if (pendingOff !== null) {
            window.clearTimeout(pendingOff);
            pendingOff = null;
            snap(outSlot);
            inSlot.classList.remove("is-under");
            inSlot.classList.add("is-off");
          }
          im.alt = CANVAS_ALT[shot] || "";
          im.src = url(shot);
          const go = () => {
            if (cancelled || my !== token) return;
            inSlot.classList.remove("is-off", "is-under");
            inSlot.classList.add("no-trans");
            inSlot.style.opacity = "0";
            void inSlot.offsetWidth;
            inSlot.classList.remove("no-trans");
            inSlot.style.opacity = "";
            inSlot.classList.add("is-on");
            outSlot.classList.remove("is-on");
            outSlot.classList.add("is-under");
            front = inIdx;
            pendingOff = window.setTimeout(() => {
              pendingOff = null;
              outSlot.classList.remove("is-under");
              outSlot.classList.add("is-off");
            }, 650);
          };
          if (im.decode) im.decode().then(go, go);
          else go();
        });
      };

      interface Keyframe {
        s: number;
        x: number;
        y: number;
      }
      interface Geo {
        vw: number;
        vh: number;
        W: number;
        H: number;
        x: number;
        y: number;
        cx: number;
        cy: number;
        sw: number;
        sh: number;
        keys: Keyframe[];
      }

      let geo: Geo | null = null;
      let curStep = -2;
      const REST: Keyframe = { s: 1, x: 0, y: 0 };

      const keyFor = (g: Omit<Geo, "keys">, st: ZoomStep, ov: number): Keyframe => {
        const vw = g.vw;
        const vh = g.vh;
        const targetX = vw / 2;
        const targetY = vh * 0.43;
        let tx: number;
        let ty: number;
        let s: number;
        if (!st.focus) {
          s = ov;
          tx = targetX - (g.x + g.cx);
          ty = targetY - (g.y + g.cy);
        } else {
          const f = st.focus;
          s = ov * (st.zoom || 1.4);
          const fx = (CANVAS_SR[0] + (f[0] + f[2] / 2) * CANVAS_SR[2]) * g.W;
          const fy = (CANVAS_SR[1] + (f[1] + f[3] / 2) * CANVAS_SR[3]) * g.H;
          tx = targetX - (g.x + g.cx) - (fx - g.cx) * s;
          ty = targetY - (g.y + g.cy) - (fy - g.cy) * s;
        }
        const left = g.x + g.cx + (CANVAS_SR[0] * g.W - g.cx) * s + tx;
        const right = left + g.sw * s;
        const top = g.y + g.cy + (CANVAS_SR[1] * g.H - g.cy) * s + ty;
        const bottom = top + g.sh * s;
        if (right - left >= vw * 0.94) {
          if (left > vw * 0.03) tx -= left - vw * 0.03;
          else if (right < vw * 0.97) tx += vw * 0.97 - right;
        }
        if (bottom - top >= vh * 0.7) {
          if (top > vh * 0.08) ty -= top - vh * 0.08;
          else if (bottom < vh * 0.78) ty += vh * 0.78 - bottom;
        }
        return { s, x: tx, y: ty };
      };

      const measure = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const prev = stageEl.style.transform;
        stageEl.style.transform = "none";
        const r = stageEl.getBoundingClientRect();
        const sr = stickyEl.getBoundingClientRect();
        stageEl.style.transform = prev;
        if (!r.width || !r.height) return;

        const base: Omit<Geo, "keys"> = {
          vw,
          vh,
          W: r.width,
          H: r.height,
          x: r.left - sr.left,
          y: r.top - sr.top,
          cx: (CANVAS_SR[0] + CANVAS_SR[2] / 2) * r.width,
          cy: (CANVAS_SR[1] + CANVAS_SR[3] / 2) * r.height,
          sw: CANVAS_SR[2] * r.width,
          sh: CANVAS_SR[3] * r.height,
        };
        stageEl.style.transformOrigin = `${base.cx.toFixed(2)}px ${base.cy.toFixed(2)}px`;
        screenEl.style.left = `${CANVAS_SR[0] * 100}%`;
        screenEl.style.top = `${CANVAS_SR[1] * 100}%`;
        screenEl.style.width = `${CANVAS_SR[2] * 100}%`;
        screenEl.style.height = `${CANVAS_SR[3] * 100}%`;
        screenEl.style.borderRadius = `${(CANVAS_SR[4] * base.W).toFixed(2)}px`;
        const ov = Math.max(1, Math.min((vw * 0.94) / base.sw, (vh * 0.7) / base.sh));
        geo = { ...base, keys: ZOOM_STEPS.map((st) => keyFor(base, st, ov)) };
      };

      const lerp = (a: Keyframe, b: Keyframe, t: number): Keyframe => ({
        s: a.s + (b.s - a.s) * t,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });

      const camera = (p: number): Keyframe => {
        if (!geo) return REST;
        if (p <= P0) return REST;
        if (p < P1) return lerp(REST, geo.keys[0], smoothstep(P0, P1, p));
        const t = (p - P1) / STEP;
        let k = Math.floor(t);
        if (k >= N) k = N - 1;
        if (k <= 0) return geo.keys[0];
        let u = clamp01((t - k) / MOVE);
        u = u * u * (3 - 2 * u);
        return lerp(geo.keys[k - 1], geo.keys[k], u);
      };

      const stepAt = (p: number) => {
        if (p < P1 - 0.01) return -1;
        const k = Math.floor((p - P1) / STEP);
        return k < 0 ? 0 : k >= N ? N - 1 : k;
      };

      const setStep = (k: number) => {
        if (k === curStep) return;
        curStep = k;
        const st = ZOOM_STEPS[k < 0 ? 0 : k];
        showShot(st.shot);
        setActiveStep(k);
        if (k >= 0 && st.focus) {
          const f = st.focus;
          const wasOn = dimEl.classList.contains("is-on");
          if (!wasOn) dimEl.classList.add("no-trans");
          dimEl.style.left = `${f[0] * 100}%`;
          dimEl.style.top = `${f[1] * 100}%`;
          dimEl.style.width = `${f[2] * 100}%`;
          dimEl.style.height = `${f[3] * 100}%`;
          if (!wasOn) {
            void dimEl.offsetWidth;
            dimEl.classList.remove("no-trans");
          }
          dimEl.classList.add("is-on");
        } else {
          dimEl.classList.remove("is-on");
        }
      };

      let ticking = false;
      const update = () => {
        ticking = false;
        if (cancelled) return;
        if (!geo) measure();
        const vh = window.innerHeight;
        const rect = secEl.getBoundingClientRect();
        const runway = secEl.offsetHeight - vh;
        const p = runway > 0 ? clamp01(-rect.top / runway) : 1;
        const k = smoothstep(0.02, 0.11, p);
        headEl.style.opacity = String(1 - k);
        headEl.style.transform = `translateY(${(-30 * k).toFixed(1)}px)`;
        const c = camera(p);
        stageEl.style.transform = `translate3d(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px,0) scale(${c.s.toFixed(4)})`;
        setStep(stepAt(p));
      };

      const tick = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      };

      let rt: number | undefined;
      const onResize = () => {
        window.clearTimeout(rt);
        rt = window.setTimeout(() => {
          measure();
          tick();
        }, 120);
      };
      const onLoad = () => {
        measure();
        tick();
      };

      window.addEventListener("scroll", tick, { passive: true });
      window.addEventListener("resize", onResize);
      window.addEventListener("load", onLoad);
      measure();
      update();
      const t1 = window.setTimeout(onLoad, 350);
      const t2 = window.setTimeout(onLoad, 1200);

      return () => {
        nearIo?.disconnect();
        if (pendingOff !== null) window.clearTimeout(pendingOff);
        window.clearTimeout(rt);
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.removeEventListener("scroll", tick);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("load", onLoad);
      };
    }

    return () => {
      cancelled = true;
      cleanupZoom?.();
    };
  }, []);

  return (
    <section
      ref={secRef}
      className={`duo-zoom${isStatic ? " is-static" : ""}${activeStep >= 0 ? " is-live" : ""}`}
      id="one-large-canvas"
    >
      <div ref={stickyRef} className="duo-zoom__sticky">
        <div ref={headRef} className="duo-zoom__head">
          <span className="section-label">Fully Opened</span>
          <h2 className="landing-h2">One large canvas.</h2>
          <p className="landing-lead">
            Completely flat, Forge Fitness stops treating the display as two pages and starts treating it as one large canvas.
          </p>
        </div>

        <div ref={stageRef} className="duo-zoom__stage">
          <div className="duo-zoom__device">
            <div ref={slot0Ref} className="duo-zoom__slot is-on">
              <img
                ref={img0Ref}
                src="/landing/duo/canvas-r1-1600.webp"
                alt={CANVAS_ALT.r1}
                width={1600}
                height={1147}
                loading="eager"
                decoding="async"
              />
            </div>
            <div ref={slot1Ref} className="duo-zoom__slot is-off" aria-hidden="true">
              <img
                ref={img1Ref}
                src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                alt=""
                width={1600}
                height={1147}
                decoding="async"
              />
            </div>
            <div ref={screenRef} className="duo-zoom__screen" aria-hidden="true">
              <div ref={dimRef} className="duo-zoom__dim" />
            </div>
          </div>
        </div>

        <div className="duo-zoom__caps">
          {ZOOM_STEPS.map((st, idx) => (
            <div key={st.tag} className={`duo-zoom__cap${activeStep === idx ? " is-on" : ""}`}>
              <span className="duo-zoom__tag">{st.tag}</span>
              <p>{st.text}</p>
            </div>
          ))}
        </div>

        <div className={`duo-zoom__dots${activeStep >= 0 ? " is-on" : ""}`} aria-hidden="true">
          {ZOOM_STEPS.map((st, idx) => (
            <span key={st.tag} className={activeStep === idx ? "is-on" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * 5. HIIT Seated + Closed + Fully Opened + Tent auto-playing video stages + Statement + Film
 */
function DuoVideoStage({
  posterWebp,
  posterPng,
  mp4Src,
  alt,
  width,
  height,
}: {
  posterWebp: string;
  posterPng: string;
  mp4Src: string;
  alt: string;
  width: number;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    v.muted = true;

    let loaded = false;
    let userPaused = false;
    let token = 0;

    const revealOnFrame = () => {
      const my = ++token;
      const show = () => {
        if (my === token) setLive(true);
      };
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void })
        .requestVideoFrameCallback;
      if (typeof rvfc === "function") {
        rvfc.call(v, show);
      } else {
        const onTime = () => {
          if (my !== token) {
            v.removeEventListener("timeupdate", onTime);
            return;
          }
          if (v.currentTime > 0) {
            v.removeEventListener("timeupdate", onTime);
            show();
          }
        };
        v.addEventListener("timeupdate", onTime);
      }
    };

    const loadAndPlay = () => {
      if (!loaded) {
        loaded = true;
        v.src = mp4Src;
        revealOnFrame();
      }
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    const onClick = () => {
      if (v.paused) {
        userPaused = false;
        loadAndPlay();
      } else {
        userPaused = true;
        v.pause();
      }
    };
    v.addEventListener("click", onClick);

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window && !reduce) {
      io = new IntersectionObserver(
        (entries) => {
          const en = entries[0];
          if (!en) return;
          if (en.isIntersecting && en.intersectionRatio >= 0.4) {
            if (!userPaused) loadAndPlay();
          } else if (!v.paused) {
            v.pause();
          }
        },
        { threshold: [0, 0.4] },
      );
      io.observe(v);
    }

    return () => {
      io?.disconnect();
      v.removeEventListener("click", onClick);
    };
  }, [mp4Src]);

  return (
    <div className="duo-stage">
      <picture>
        <source srcSet={posterWebp} type="image/webp" />
        <img src={posterPng} alt={alt} width={width} height={height} loading="eager" decoding="async" />
      </picture>
      <video
        ref={videoRef}
        className={`duo-video${live ? " is-live" : ""}`}
        muted
        loop
        playsInline
        preload="none"
        width={width}
        height={height}
        aria-label={alt}
      />
    </div>
  );
}

export function DuoHiitShowcase() {
  return (
    <>
      <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)", paddingBottom: "clamp(40px, 5vw, 72px)" }}>
        <div className="landing-container">
          <div data-scrub="left" className="cinematic-feature__header scrub-left">
            <span className="section-label">HIIT</span>
            <h2 className="landing-h2">Fold it halfway. Set it on the floor.</h2>
          </div>
          <div data-scrub="right" className="cinematic-feature__body scrub-right">
            <p className="landing-lead">
              HIIT is different. You are moving, usually on the floor, a few steps away from your phone. Seated, it becomes a tiny laptop: the exercise and countdown on top, and a live heart rate chart, calories, zone breakdown, and controls below.
            </p>
          </div>
          <div data-scrub="clip" className="duo-media duo-media--seated scrub-clip" style={{ marginTop: "clamp(32px, 4vw, 56px)" }}>
            <DuoVideoStage
              posterWebp="/landing/releases/83/hiit-seated-poster.webp"
              posterPng="/landing/releases/83/hiit-seated-poster.png"
              mp4Src="/landing/releases/83/hiit-seated-dark.mp4"
              alt="Forge Fitness HIIT workout on a half-folded device resting on a surface"
              width={1280}
              height={1240}
            />
          </div>
        </div>
      </section>

      <section className="duo-hiit">
        <div data-scrub="converge" className="duo-hiit__grid scrub-converge">
          <div className="duo-hiit__item duo-hiit__item--closed">
            <DuoVideoStage
              posterWebp="/landing/releases/83/hiit-closed-poster.webp"
              posterPng="/landing/releases/83/hiit-closed-poster.png"
              mp4Src="/landing/releases/83/hiit-closed-dark.mp4"
              alt="Forge Fitness HIIT workout on the cover display"
              width={900}
              height={1240}
            />
            <h3>Closed</h3>
            <p>The exercise on top, a large countdown below, and your heart rate, calories, and controls along the side.</p>
          </div>
          <div className="duo-hiit__item">
            <DuoVideoStage
              posterWebp="/landing/releases/83/hiit-open-poster.webp"
              posterPng="/landing/releases/83/hiit-open-poster.png"
              mp4Src="/landing/releases/83/hiit-open-dark.mp4"
              alt="Forge Fitness HIIT workout on a fully opened display"
              width={1720}
              height={1240}
            />
            <h3>Fully Opened</h3>
            <p>Open it and everything scales up. The exercise takes one side, the countdown takes the other.</p>
          </div>
          <div className="duo-hiit__item">
            <DuoVideoStage
              posterWebp="/landing/releases/83/hiit-tent-poster.webp"
              posterPng="/landing/releases/83/hiit-tent-poster.png"
              mp4Src="/landing/releases/83/hiit-tent-dark.mp4"
              alt="Forge Fitness HIIT workout standing in tent posture"
              width={1560}
              height={1080}
            />
            <h3>Tent</h3>
            <p>No stand. No tripod. No leaning your phone against a water bottle.</p>
          </div>
        </div>
      </section>

      <section className="duo-statement">
        <div className="landing-container">
          <div data-scrub="statement" className="duo-statement__content scrub-statement">
            <span className="section-label">Interface</span>
            <h2>
              One interface.<br />
              <span className="scrub-statement__glow">Not five.</span>
            </h2>
            <p className="landing-lead">
              None of this is a separate app, or a special mode you need to turn on. It builds on Forge Fitness&apos;s Resizable UI foundation—the same architecture that adapts across phone, foldable, tablet, desktop, and watch.
            </p>
          </div>
        </div>
      </section>

      <section className="cinematic-feature" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="landing-container">
          <div data-scrub="up" className="cinematic-feature__header scrub-up">
            <span className="section-label">Showcase</span>
            <h2 className="landing-h2">Forge Fitness in every posture, in motion.</h2>
          </div>
          <div data-scrub="clip" className="duo-film scrub-clip" style={{ maxWidth: 1100, margin: "0 auto" }}>
            <video
              controls
              playsInline
              preload="none"
              width={1920}
              height={1080}
              poster="/landing/releases/83/iphone-duo-showcase-poster.jpg"
              aria-label="Forge Fitness multi-posture showcase video"
            >
              <source src="/landing/releases/83/iphone-duo-showcase.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>
    </>
  );
}
