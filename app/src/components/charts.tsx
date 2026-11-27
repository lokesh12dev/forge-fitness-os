"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── RING ─────────────────────────── */

export function Ring({
  value,
  size = 120,
  stroke = 9,
  color = "#C9F73A",
  track = "rgba(255,255,255,0.08)",
  children,
  className,
  rounded = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
  rounded?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap={rounded ? "round" : "butt"}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ─────────────────────────── SPARKLINE ─────────────────────────── */

export function Sparkline({
  data,
  height = 64,
  color = "#C9F73A",
  className,
  strokeWidth = 2,
  fill = true,
  showDot = false,
}: {
  data: number[];
  height?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
  showDot?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const w = 200;
  const h = height;
  const pad = 4;
  if (!data.length) return <div className={className} style={{ height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#sg-${uid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {showDot && (
        <circle cx={last[0]} cy={last[1]} r="3.4" fill={color} stroke="#0C0E12" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/* ─────────────────────────── LABELED TREND CHART ─────────────────────────── */

export function LabeledTrendChart({
  data,
  height = 56,
  color = "#C9F73A",
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  if (!data.length) return <div className={className} style={{ height }} />;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 240;
  const h = height;
  const padX = 8;
  const padY = 8;

  const pts = data.map((d, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * (w - padX * 2);
    const y = h - padY - ((d.value - min) / range) * (h - padY * 2);
    return [x, y, d] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-wider text-dim">
        <span>Min {Math.round(min)}</span>
        <span className="text-mist font-semibold">Today {Math.round(last[2].value)}</span>
        <span>Peak {Math.round(max)}</span>
      </div>
      <div className="relative overflow-hidden rounded-lg bg-white/[0.02] p-1">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`ltc-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#ltc-${uid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r="4" fill={color} stroke="#0C0E12" strokeWidth="2" />
        </svg>
      </div>
      <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-dim">
        <span>{data[0]?.label ?? "7d ago"}</span>
        <span>{data[Math.floor(data.length / 2)]?.label ?? ""}</span>
        <span className="text-acid font-medium">{data[data.length - 1]?.label ?? "Today"}</span>
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 140,
  color = "#C9F73A",
  format,
  className,
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
  className?: string;
  highlightLast?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const active = highlightLast && i === data.length - 1;
          const pct = Math.max(3, (d.value / max) * 100);
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col justify-end gap-2">
              <div className="relative w-full overflow-hidden rounded-t-[5px]" style={{ height: `${pct}%`, background: active ? color : "rgba(255,255,255,0.10)" }}>
                {active && <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-white/25" />}
              </div>
              <span className={cn("text-center font-mono text-[8.5px] uppercase tracking-[0.08em]", active ? "text-chalk" : "text-dim")}>
                {d.label}
              </span>
              <span className="pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-panel-3 px-1.5 py-0.5 font-mono text-[9px] text-chalk opacity-0 transition-opacity group-hover:opacity-100">
                {format ? format(d.value) : d.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── MACRO BAR ─────────────────────────── */

export function MacroBar({
  label,
  value,
  target,
  color,
  unit = "g",
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-mono">{label}</span>
        <span className="font-numeric text-[11px] text-mist">
          <span className="text-chalk">{Math.round(value)}</span> / {target}
          {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
