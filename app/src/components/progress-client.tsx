"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Award, Share2, TrendingDown, TrendingUp } from "lucide-react";
import { PRCard } from "@/components/pr-card";
import { cn } from "@/lib/utils";

/* ───────────────────────────── TYPES ───────────────────────────── */

export type WeekPoint = { label: string; volume: number; sessions: number; start: number };
export type BodyPoint = {
  date: string;
  label: string;
  weight: number | null;
  bodyFat: number | null;
  sleep: number | null;
  hrv: number | null;
  restingHr: number | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/* ───────────────────────────── AREA TREND ───────────────────────────── */

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function AreaTrend({
  data,
  color,
  unit,
  format = fmt,
  height = 220,
}: {
  data: { label: string; value: number }[];
  color: string;
  unit?: string;
  format?: (n: number) => string;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const W = 800;
  const H = 250;
  const pad = { l: 10, r: 10, t: 18, b: 30 };
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const pts = data.map((d, i) => ({
    x: pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r),
    y: pad.t + (1 - (d.value - min) / range) * (H - pad.t - pad.b),
  }));
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1].x},${H - pad.b} L${pts[0].x},${H - pad.b} Z` : "";
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => pad.t + t * (H - pad.t - pad.b));
  const labelEvery = data.length > 9 ? 2 : 1;
  const activeIndex = hover;
  const active = activeIndex !== null ? pts[activeIndex] : null;

  function move(clientX: number) {
    if (!boxRef.current || !data.length) return;
    const rect = boxRef.current.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHover(Math.round(rel * (data.length - 1)));
  }

  return (
    <div ref={boxRef} className="relative w-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="size-full"
        preserveAspectRatio="none"
        onMouseMove={(e) => move(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => move(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`pg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((y, i) => (
          <line key={i} x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="rgba(255,255,255,0.055)" strokeDasharray={i === grid.length - 1 ? undefined : "3 5"} />
        ))}
        {area && <path d={area} fill={`url(#pg-${uid})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === activeIndex ? 5 : i === pts.length - 1 ? 3.6 : 1.8}
            fill={i === activeIndex || i === pts.length - 1 ? color : "#0C0E12"}
            stroke={color}
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {active && <line x1={active.x} x2={active.x} y1={pad.t} y2={H - pad.b} stroke={`${color}66`} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>

      {/* x labels */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1">
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <span key={i} className={cn("font-mono text-[8px] uppercase tracking-[0.06em]", i === data.length - 1 ? "text-chalk" : "text-dim")}>
              {d.label}
            </span>
          ) : null,
        )}
      </div>

      {/* y labels */}
      <div className="pointer-events-none absolute left-0 top-0 flex h-[calc(100%-30px)] flex-col justify-between py-0.5">
        <span className="font-mono text-[8px] text-dim">{format(max)}{unit}</span>
        <span className="font-mono text-[8px] text-dim">{format(min)}{unit}</span>
      </div>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-panel-3 px-2.5 py-1.5 shadow-2xl"
          style={{ left: `${(pts[hover].x / W) * 100}%`, top: 0 }}
        >
          <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">{data[hover].label}</p>
          <p className="mt-0.5 whitespace-nowrap font-numeric text-[11px] font-semibold" style={{ color }}>
            {format(data[hover].value)}{unit}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── PERFORMANCE PANEL ───────────────────────────── */

export function PerformancePanel({ weeks }: { weeks: WeekPoint[] }) {
  const [metric, setMetric] = useState<"volume" | "sessions">("volume");
  const [period, setPeriod] = useState<8 | 12>(8);

  const data = useMemo(() => weeks.slice(-period), [weeks, period]);
  const key = metric === "volume" ? "volume" : "sessions";
  const series = data.map((w) => ({
    label: w.label,
    value: key === "volume" ? w.volume : w.sessions,
  }));
  const total = series.reduce((a, d) => a + d.value, 0);
  const avg = series.length ? total / series.length : 0;
  const best = series.reduce((a, d) => (d.value > a.value ? d : a), series[0] ?? { label: "—", value: 0 });
  const last = series[series.length - 1]?.value ?? 0;
  const prev = series[series.length - 2]?.value ?? 0;
  const delta = prev ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;
  const unit = metric === "volume" ? "kg" : "";
  const color = metric === "volume" ? "#C9F73A" : "#6EA8FF";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
          {(
            [
              { key: "volume", label: "Volume" },
              { key: "sessions", label: "Sessions" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMetric(tab.key)}
              className={cn(
                "rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
                metric === tab.key ? "bg-white/10 text-chalk" : "text-dim hover:text-mist",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
          {([8, 12] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
                period === p ? "bg-white/10 text-chalk" : "text-dim hover:text-mist",
              )}
            >
              {p}w
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-1.5">{metric === "volume" ? "Total tonnage" : "Sessions logged"}</p>
          <p className="font-numeric text-[32px] font-bold leading-none tracking-[-0.05em] text-chalk">
            {fmt(total)}<span className="ml-1.5 text-[12px] font-normal text-dim">{unit || "sessions"}</span>
          </p>
        </div>
        <div className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 font-numeric text-[10px]",
          delta >= 0 ? "border-acid/25 bg-acid/10 text-acid" : "border-flame/25 bg-flame/10 text-flame")}>
          {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {delta >= 0 ? "+" : ""}{delta}% wk/wk
        </div>
      </div>

      <div className="mt-4">
        <AreaTrend data={series} color={color} unit={unit} format={(n) => (metric === "volume" ? `${Math.round(n / 1000)}k` : String(n))} height={218} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4">
        <div>
          <p className="label-mono mb-1">Weekly avg</p>
          <p className="font-numeric text-[15px] font-semibold">{fmt(avg)}<span className="ml-1 text-[9px] font-normal text-dim">{unit}</span></p>
        </div>
        <div>
          <p className="label-mono mb-1">Best week</p>
          <p className="font-numeric text-[15px] font-semibold text-acid">{fmt(best.value)}<span className="ml-1 text-[9px] font-normal text-dim">{unit}</span></p>
        </div>
        <div>
          <p className="label-mono mb-1">Avg / session</p>
          <p className="font-numeric text-[15px] font-semibold">
            {fmt(series.reduce((a, w, i) => a + (w.value || 0) / Math.max(1, data[i]?.sessions ?? 1), 0) / Math.max(1, series.length))}
            <span className="ml-1 text-[9px] font-normal text-dim">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── BODY TRENDS ───────────────────────────── */

const BODY_METRICS = [
  { key: "weight", label: "Weight", unit: "kg", color: "#C9F73A", decimals: 1 },
  { key: "bodyFat", label: "Body fat", unit: "%", color: "#FFB86B", decimals: 1 },
  { key: "sleep", label: "Sleep", unit: "h", color: "#6EA8FF", decimals: 1 },
  { key: "hrv", label: "HRV", unit: "ms", color: "#B49CFF", decimals: 0 },
  { key: "restingHr", label: "Resting HR", unit: "bpm", color: "#FF6B35", decimals: 0 },
] as const;

export function BodyTrends({ points }: { points: BodyPoint[] }) {
  const [metric, setMetric] = useState<(typeof BODY_METRICS)[number]["key"]>("weight");
  const cfg = BODY_METRICS.find((m) => m.key === metric)!;
  const series = useMemo(
    () =>
      points
        .map((p) => ({ label: p.label, value: p[metric] }))
        .filter((p): p is { label: string; value: number } => p.value !== null),
    [points, metric],
  );
  const last = series[series.length - 1]?.value ?? 0;
  const first = series[0]?.value ?? 0;
  const change = Math.round((last - first) * 10) / 10;
  const goodDown = metric === "weight" || metric === "bodyFat" || metric === "restingHr";

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {BODY_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors",
              metric === m.key ? "border-white/15 bg-white/10 text-chalk" : "border-white/[0.07] text-dim hover:text-mist",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="label-mono mb-1">{cfg.label} · today</p>
          <p className="font-numeric text-[30px] font-bold leading-none tracking-[-0.05em]" style={{ color: cfg.color }}>
            {last.toFixed(cfg.decimals)}<span className="ml-1 text-[11px] font-normal text-dim">{cfg.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="label-mono mb-1">12-week change</p>
          <p className={cn("font-numeric text-[13px] font-semibold", change === 0 ? "text-mist" : (change < 0) === goodDown ? "text-acid" : "text-flame")}>
            {change > 0 ? "+" : ""}{change.toFixed(cfg.decimals)} {cfg.unit}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <AreaTrend
          data={series}
          color={cfg.color}
          unit={cfg.unit}
          format={(n) => (cfg.decimals ? n.toFixed(1) : String(Math.round(n)))}
          height={170}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────── SHARE LIFT ───────────────────────────── */

export function ShareLiftButton({
  user,
  exercise,
  value,
  weight,
  reps,
  previous,
}: {
  user: { name: string; initials: string };
  exercise: string;
  value: number;
  weight: number;
  reps: number;
  previous: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist transition-colors hover:border-acid/40 hover:text-acid"
      >
        <Share2 className="size-3" /> Share
      </button>
      <PRCard
        open={open}
        onClose={() => setOpen(false)}
        user={user}
        exercise={exercise}
        value={value}
        previous={previous}
        weight={weight}
        reps={reps}
      />
    </>
  );
}

/* ───────────────────────────── LEVEL BADGE ───────────────────────────── */

export function LevelChip({ level }: { level: string }) {
  const tone =
    level === "Elite" ? "text-acid border-acid/25 bg-acid/10" :
    level === "Advanced" ? "text-mint border-mint/25 bg-mint/10" :
    level === "Intermediate" ? "text-sky border-sky/25 bg-sky/10" :
    "text-mist border-white/12 bg-white/[0.04]";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em]", tone)}>
      <Award className="size-2.5" /> {level}
    </span>
  );
}
