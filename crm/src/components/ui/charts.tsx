"use client";

import React, { useState } from "react";
import { clsx } from "clsx";

/* ─────────────────────────── THICK LINE + SQUARE POINT CHART ─────────────────────────── */

export interface TrendPoint {
  label: string;
  revenuePaise: number;
  activeMembers: number;
}

export function RevenueAndMembersChart({
  data,
  formatY,
}: {
  data: TrendPoint[];
  formatY: (paise: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(data.length > 0 ? data.length - 1 : null);
  const w = 720;
  const h = 250;
  const padL = 68;
  const padR = 54;
  const padT = 22;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxRev = Math.max(...data.map((d) => d.revenuePaise), 100);
  const maxMem = Math.max(...data.map((d) => d.activeMembers), 10);

  const xFor = (i: number) =>
    data.length <= 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
  const yRevFor = (val: number) => padT + innerH - (val / maxRev) * innerH;
  const yMemFor = (val: number) => padT + innerH - (val / maxMem) * innerH;

  const revPolyline = data.map((d, i) => `${xFor(i).toFixed(1)},${yRevFor(d.revenuePaise).toFixed(1)}`).join(" ");
  const memPolyline = data.map((d, i) => `${xFor(i).toFixed(1)},${yMemFor(d.activeMembers).toFixed(1)}`).join(" ");
  const focused = hoverIdx !== null ? data[hoverIdx] : undefined;

  return (
    <div className="bauhaus-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="bauhaus-label text-[var(--fg-grey)]">{`// 18-MONTH FINANCIAL & ROSTER TRAJECTORY`}</p>
          <h3 className="font-headline text-[20px] mt-1">Revenue vs Active Members</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px] font-bold uppercase tracking-[0.08em]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 bg-[#C8372B] border border-[#151515]" /> Revenue (Left Axis)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 bg-[#2B4BCC] border border-[#151515]" /> Active Members (Right)
          </span>
        </div>
      </div>

      {focused && (
        <div className="mb-3 border-2 border-[var(--border-ink)] bg-[var(--bg-muted)] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[13px] font-tabular font-bold">
          <span>MONTH: {focused.label}</span>
          <span className="text-[#C8372B]">REVENUE: {formatY(focused.revenuePaise)}</span>
          <span className="text-[#2B4BCC]">ACTIVE MEMBERS: {focused.activeMembers}</span>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px] h-auto" role="img" aria-label="Revenue and Active Members 18-month trend chart">
          {/* Y-gridlines & labeled ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + innerH - t * innerH;
            const revVal = Math.round(maxRev * t);
            const memVal = Math.round(maxMem * t);
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border-ink)" strokeWidth={t === 0 ? 2 : 1} strokeOpacity={t === 0 ? 1 : 0.25} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="12" fontWeight="700" fill="currentColor">
                  {formatY(revVal)}
                </text>
                <text x={w - padR + 8} y={y + 4} textAnchor="start" fontSize="12" fontWeight="700" fill="#2B4BCC">
                  {memVal}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--border-ink)" strokeWidth="2" />
          <line x1={w - padR} y1={padT} x2={w - padR} y2={padT + innerH} stroke="var(--border-ink)" strokeWidth="2" />

          {/* Thick flat lines */}
          {data.length > 1 && (
            <>
              <polyline fill="none" stroke="#C8372B" strokeWidth="3.5" points={revPolyline} />
              <polyline fill="none" stroke="#2B4BCC" strokeWidth="3" strokeDasharray="8 4" points={memPolyline} />
            </>
          )}

          {/* Square data points & X-axis labels */}
          {data.map((d, i) => {
            const x = xFor(i);
            const yR = yRevFor(d.revenuePaise);
            const yM = yMemFor(d.activeMembers);
            const isSelected = hoverIdx === i;
            return (
              <g key={d.label} onMouseEnter={() => setHoverIdx(i)} onClick={() => setHoverIdx(i)} className="cursor-pointer">
                {i % 2 === 0 || isSelected ? (
                  <text x={x} y={h - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">
                    {d.label}
                  </text>
                ) : null}
                <rect x={x - (isSelected ? 5 : 4)} y={yR - (isSelected ? 5 : 4)} width={isSelected ? 10 : 8} height={isSelected ? 10 : 8} fill="#C8372B" stroke="#151515" strokeWidth="1.5" />
                <rect x={x - 3.5} y={yM - 3.5} width="7" height="7" fill="#2B4BCC" stroke="#151515" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ─────────────────────────── DAY × HOUR PEAK HEATMAP ─────────────────────────── */

export interface HeatmapMatrix {
  days: string[]; // Mon..Sun
  hours: number[]; // 6..21
  counts: number[][]; // counts[dayIdx][hourIdx]
}

export function PeakHoursHeatmap({ matrix }: { matrix: HeatmapMatrix }) {
  const maxVal = Math.max(...matrix.counts.flat(), 1);
  const [selected, setSelected] = useState<{ d: number; h: number } | null>(null);

  return (
    <div className="bauhaus-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="bauhaus-label text-[var(--fg-grey)]">{`// FLOOR CONGESTION (DAY × HOUR IST)`}</p>
          <h3 className="font-headline text-[20px] mt-1">Peak Hours Heatmap</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold uppercase">
          <span className="inline-flex items-center gap-1"><span className="size-3 border border-[#151515] bg-[var(--bg-muted)]" /> Quiet</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 border border-[#151515] bg-[#EBC95B]" /> Moderate</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 border border-[#151515] bg-[#2B4BCC]" /> Busy</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 border border-[#151515] bg-[#C8372B]" /> Peak</span>
        </div>
      </div>

      {selected && (
        <div className="mb-3 border-2 border-[var(--border-ink)] bg-[#EBC95B] text-[#151515] px-3 py-2 text-[13px] font-bold uppercase font-tabular">
          {matrix.days[selected.d]} · {matrix.hours[selected.h]}:00 IST — {matrix.counts[selected.d]?.[selected.h] ?? 0} CHECK-INS LOGGED
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <table className="w-full border-collapse min-w-[520px]">
          <thead>
            <tr>
              <th className="text-left text-[12px] font-bold uppercase py-1 pr-2">DAY</th>
              {matrix.hours.map((hr) => (
                <th key={hr} className="text-center text-[12px] font-tabular font-bold py-1">
                  {hr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.days.map((day, dIdx) => (
              <tr key={day}>
                <td className="text-[12px] font-bold uppercase py-1 pr-2 whitespace-nowrap">{day}</td>
                {matrix.hours.map((hr, hIdx) => {
                  const val = matrix.counts[dIdx]?.[hIdx] ?? 0;
                  const ratio = val / maxVal;
                  const cellColor =
                    ratio >= 0.72
                      ? "bg-[#C8372B] text-[#FFFFFF]"
                      : ratio >= 0.45
                      ? "bg-[#2B4BCC] text-[#FFFFFF]"
                      : ratio >= 0.2
                      ? "bg-[#EBC95B] text-[#151515]"
                      : "bg-[var(--bg-muted)] text-[var(--fg-grey)]";
                  return (
                    <td key={hr} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => setSelected({ d: dIdx, h: hIdx })}
                        className={clsx(
                          "w-full h-7 border border-[var(--border-ink)] text-[12px] font-tabular font-bold",
                          cellColor
                        )}
                        title={`${day} ${hr}:00 — ${val} check-ins`}
                      >
                        {val > 0 ? val : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
