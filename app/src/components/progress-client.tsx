"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Award, Camera, Check, ChevronRight, Download, FileJson, FileSpreadsheet,
  Lock, Ruler, Share2, Shield, Sparkles, TrendingDown, TrendingUp, Trophy, X, Zap,
} from "lucide-react";
import { PRCard } from "@/components/pr-card";
import { type BadgeDefinition } from "@/lib/gamification";
import { calculateWeightMovingAverage } from "@/lib/nutrition-engine";
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
  const [period, setPeriod] = useState<4 | 8 | 12 | 24>(12);

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
          {(
            [
              { p: 4, label: "4w (1M)" },
              { p: 8, label: "8w (2M)" },
              { p: 12, label: "12w (3M)" },
              { p: 24, label: "24w (6M)" },
            ] as const
          ).map((item) => (
            <button
              key={item.p}
              onClick={() => setPeriod(item.p)}
              className={cn(
                "rounded-full px-2.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors",
                period === item.p ? "bg-acid/20 text-acid font-bold" : "text-dim hover:text-mist",
              )}
            >
              {item.label}
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

  // Compute 7-day moving average for weight smoothing (E2)
  const smoothedWeightData = useMemo(() => {
    const raw = points
      .filter((p) => p.weight !== null)
      .map((p) => ({ date: p.date, weightKg: p.weight! }));
    return calculateWeightMovingAverage(raw, 7);
  }, [points]);

  const series = useMemo(() => {
    if (metric === "weight" && smoothedWeightData.length) {
      return smoothedWeightData.map((d) => ({
        label: d.date.slice(5),
        value: d.movingAvgKg,
      }));
    }
    return points
      .map((p) => ({ label: p.label, value: p[metric] }))
      .filter((p): p is { label: string; value: number } => p.value !== null);
  }, [points, metric, smoothedWeightData]);

  const last = series[series.length - 1]?.value ?? 0;
  const first = series[0]?.value ?? 0;
  const change = Math.round((last - first) * 10) / 10;
  const goodDown = metric === "weight" || metric === "bodyFat" || metric === "restingHr";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {metric === "weight" && (
          <span className="rounded bg-acid/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-acid font-bold">
            7-Day Smoothed Avg
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="label-mono mb-1">{cfg.label} · {metric === "weight" ? "7d trend" : "today"}</p>
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

/* ───────────────────────────── BADGES GRID (G1) ───────────────────────────── */

export function BadgeShowcase({ badges }: { badges: BadgeDefinition[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div>
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Unlocked Achievements</span>
          <p className="font-numeric text-base font-bold text-chalk">
            {unlockedCount} of {badges.length} Unlocked
          </p>
        </div>
        <span className="rounded-full bg-amber/15 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber font-semibold">
          +{badges.filter((b) => b.unlocked).reduce((a, b) => a + b.xpReward, 0)} XP Earned
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {badges.map((b) => (
          <div
            key={b.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-3.5 transition-all",
              b.unlocked
                ? "border-amber/30 bg-amber/[0.04]"
                : "border-white/[0.07] bg-white/[0.015] opacity-70",
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{b.icon}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider font-bold",
                  b.unlocked ? "bg-amber/20 text-amber" : "bg-white/10 text-dim",
                )}
              >
                +{b.xpReward} XP
              </span>
            </div>

            <h4 className="mt-2 text-[12.5px] font-bold text-chalk">{b.name}</h4>
            <p className="mt-0.5 text-[10.5px] text-mist line-clamp-2">{b.description}</p>

            <div className="mt-3">
              <div className="flex items-center justify-between font-mono text-[8px] text-dim mb-1">
                <span>Progress</span>
                <span className={b.unlocked ? "text-amber font-bold" : "text-dim"}>
                  {b.currentValueLabel} / {b.targetValueLabel}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${b.progressPercent}%`,
                    background: b.unlocked ? "#FFD166" : "rgba(255,255,255,0.25)",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── DATA EXPORT MODAL (E3, I3) ───────────────────────────── */

export function DataExportModal({
  open,
  onClose,
  dataSummary,
}: {
  open: boolean;
  onClose: () => void;
  dataSummary: {
    workoutCount: number;
    setsCount: number;
    nutritionDaysCount: number;
  };
}) {
  if (!open) return null;

  function triggerDownload(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const csvContent =
      "Timestamp,Type,Event,Value,Unit\n" +
      `${new Date().toISOString()},Export,WorkoutsExported,${dataSummary.workoutCount},sessions\n` +
      `${new Date().toISOString()},Export,SetsExported,${dataSummary.setsCount},sets\n` +
      `${new Date().toISOString()},Export,NutritionDaysExported,${dataSummary.nutritionDaysCount},days\n`;
    triggerDownload(csvContent, `forge_training_export_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
  }

  function exportJSON() {
    const jsonContent = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        summary: dataSummary,
        application: "FORGE Fitness OS",
      },
      null,
      2,
    );
    triggerDownload(jsonContent, `forge_training_export_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="animate-scale-in relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-panel p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-acid font-bold">
              Data Sovereignty (E3, I3)
            </span>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-0.5">
              Export Training & Nutrition
            </h3>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-[11.5px] text-mist">
          Download your complete historical records. You own your training data in open, unencumbered formats forever.
        </p>

        <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-3 space-y-2 text-[11px] font-mono text-dim">
          <div className="flex justify-between">
            <span>Workouts:</span>
            <span className="text-chalk font-bold">{dataSummary.workoutCount} sessions</span>
          </div>
          <div className="flex justify-between">
            <span>Working sets:</span>
            <span className="text-chalk font-bold">{dataSummary.setsCount} sets</span>
          </div>
          <div className="flex justify-between">
            <span>Nutrition logs:</span>
            <span className="text-chalk font-bold">{dataSummary.nutritionDaysCount} logged items</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={exportCSV}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-acid text-ink font-semibold text-[12px]"
          >
            <FileSpreadsheet className="size-4" /> Download CSV
          </button>
          <button
            type="button"
            onClick={exportJSON}
            className="press flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-chalk font-semibold text-[12px] hover:bg-white/[0.08]"
          >
            <FileJson className="size-4" /> Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportDataTrigger({
  dataSummary,
}: {
  dataSummary: {
    workoutCount: number;
    setsCount: number;
    nutritionDaysCount: number;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[11.5px] font-medium text-mist hover:text-chalk"
      >
        <Download className="size-3.5 text-acid" /> Export data
      </button>
      <DataExportModal open={open} onClose={() => setOpen(false)} dataSummary={dataSummary} />
    </>
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

/* ───────────────────────────── ANTHROPOMETRIC BODY MEASUREMENTS (wger) ───────────────────────────── */

export type BodyMeasurementSite = {
  key: string;
  label: string;
  current: number;
  baseline: number;
  unit: string;
  targetDirection: "up" | "down";
};

const INITIAL_SITES: BodyMeasurementSite[] = [
  { key: "chest", label: "Chest (Mid-Sternum)", current: 104, baseline: 102, unit: "cm", targetDirection: "up" },
  { key: "arms", label: "Arms / Biceps (Flexed)", current: 39.2, baseline: 38, unit: "cm", targetDirection: "up" },
  { key: "waist", label: "Waist (Navel)", current: 81.5, baseline: 84.5, unit: "cm", targetDirection: "down" },
  { key: "hips", label: "Hips (Gluteal Apex)", current: 98, baseline: 97.5, unit: "cm", targetDirection: "up" },
  { key: "thighs", label: "Thighs (Mid-Femur)", current: 61.2, baseline: 59.8, unit: "cm", targetDirection: "up" },
  { key: "calves", label: "Calves (Max Girth)", current: 38.5, baseline: 38.0, unit: "cm", targetDirection: "up" },
  { key: "neck", label: "Neck (Thyroid Cartilage)", current: 39.0, baseline: 38.8, unit: "cm", targetDirection: "up" },
  { key: "bodyFat", label: "Body Fat (Caliper 3-Site)", current: 13.8, baseline: 15.6, unit: "%", targetDirection: "down" },
];

export function AnthropometricMeasurementsCard() {
  const [sites, setSites] = useState<BodyMeasurementSite[]>(INITIAL_SITES);
  const [measureUnit, setMeasureUnit] = useState<"cm" | "in">("cm");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>(() =>
    INITIAL_SITES.reduce((acc, s) => ({ ...acc, [s.key]: String(s.current) }), {})
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("forge_measure_unit");
      if (saved === "cm" || saved === "in") {
        setMeasureUnit(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const formatMetric = (val: number, baseUnit: string) => {
    if (baseUnit !== "cm" || measureUnit === "cm") return val;
    return Math.round((val / 2.54) * 10) / 10;
  };

  const displayUnit = (baseUnit: string) => (baseUnit === "cm" ? measureUnit : baseUnit);

  const toggleMeasureUnit = (unit: "cm" | "in") => {
    setMeasureUnit(unit);
    try {
      localStorage.setItem("forge_measure_unit", unit);
    } catch {
      /* ignore */
    }
    setEditValues(
      sites.reduce((acc, s) => ({ ...acc, [s.key]: String(s.unit === "cm" && unit === "in" ? Math.round((s.current / 2.54) * 10) / 10 : s.current) }), {})
    );
  };

  const handleOpenModal = () => {
    setEditValues(
      sites.reduce(
        (acc, s) => ({ ...acc, [s.key]: String(formatMetric(s.current, s.unit)) }),
        {}
      )
    );
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSites((prev) =>
      prev.map((s) => {
        const entered = Number(editValues[s.key]);
        if (!entered) return s;
        const normalizedCm = s.unit === "cm" && measureUnit === "in" ? Math.round(entered * 2.54 * 10) / 10 : entered;
        return { ...s, current: normalizedCm };
      })
    );
    setIsModalOpen(false);
    setToast("Tape measurements updated successfully!");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-panel/75 p-5 md:p-6 shadow-xl backdrop-blur-md">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-acid/30 bg-ink-2/95 px-4 py-3 shadow-2xl">
          <Check className="size-4 text-acid" />
          <span className="text-[12px] font-medium text-chalk">{toast}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-acid/15 text-acid">
              <Ruler className="size-3.5" />
            </span>
            <h3 className="font-display text-base font-bold text-chalk">
              Anthropometric Tape Tracker
            </h3>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-dim">
              wger Spec
            </span>
          </div>
          <p className="mt-1 text-[11px] text-mist">
            Circumference metrics taken at standard anatomical landmarks. Tracks true muscular hypertrophy versus visceral reduction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-black/30 p-0.5">
            {(["cm", "in"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => toggleMeasureUnit(u)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase transition-colors",
                  measureUnit === u ? "bg-acid text-ink font-bold" : "text-dim hover:text-mist"
                )}
              >
                {u}
              </button>
            ))}
          </div>
          <button
            onClick={handleOpenModal}
            className="press inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-mist hover:border-acid/40 hover:text-chalk transition-colors"
          >
            <Ruler className="size-3 text-acid" /> Log New Tape Measure
          </button>
        </div>
      </div>

      {/* Grid of Measurements */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {sites.map((site) => {
          const curVal = formatMetric(site.current, site.unit);
          const baseVal = formatMetric(site.baseline, site.unit);
          const unitLbl = displayUnit(site.unit);
          const delta = Math.round((curVal - baseVal) * 10) / 10;
          const isGoodDirection =
            site.targetDirection === "up" ? delta >= 0 : delta <= 0;
          return (
            <div
              key={site.key}
              className="rounded-2xl border border-white/[0.06] bg-black/25 p-3.5 transition-all hover:border-white/12"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
                  {site.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold",
                    isGoodDirection
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-flame/15 text-flame"
                  )}
                >
                  {delta > 0 ? `+${delta}` : delta} {unitLbl}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <p className="font-numeric text-xl font-extrabold text-chalk">
                  {curVal} <span className="text-xs font-normal text-dim">{unitLbl}</span>
                </p>
                <span className="font-mono text-[9px] text-dim">
                  30d ago: {baseVal} {unitLbl}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Logging Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-panel-2 p-5 shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Ruler className="size-4 text-acid" />
                <h4 className="font-display text-sm font-bold text-chalk">Record Body Tape Measures</h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="grid size-6 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                {sites.map((s) => (
                  <div key={s.key}>
                    <label className="block font-mono text-[8.5px] uppercase tracking-wider text-dim mb-1">
                      {s.label.split("(")[0].trim()} ({displayUnit(s.unit)})
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={editValues[s.key] ?? ""}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 font-numeric text-xs text-chalk focus:border-acid focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] text-mist hover:text-chalk"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-acid px-5 py-2 font-mono text-[11px] font-bold text-ink hover:bg-[#d8ff5e]"
                >
                  Save Tape Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
