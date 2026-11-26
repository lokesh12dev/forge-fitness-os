"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function recoveryColor(pct: number) {
  if (pct >= 80) return "#C9F73A";
  if (pct >= 60) return "#7BE0AD";
  if (pct >= 40) return "#FFD166";
  return "#FF6B35";
}

type Recovery = Record<string, { recovery: number; sets: number; lastTrained: number | null }>;

export function BodyMap({ recovery, className }: { recovery: Recovery; className?: string }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const get = (k: string) => recovery[k]?.recovery ?? 100;
  const fill = (k: string) => recoveryColor(get(k));
  const opacity = (k: string) => (recovery[k]?.sets ? 0.9 : 0.25);

  const base = "#14181E";
  const line = "rgba(255,255,255,0.12)";

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="mb-3 flex rounded-full border border-white/8 bg-white/[0.03] p-0.5">
        {(["front", "back"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
              side === s ? "bg-white/10 text-chalk" : "text-dim hover:text-mist",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 140 268" className="h-[248px] w-auto" aria-label={`${side} muscle recovery map`}>
        <g fill={base} stroke={line} strokeWidth="1">
          <circle cx="70" cy="21" r="13" />
          <rect x="64" y="32" width="12" height="9" rx="3" />
          <path d="M50 42C60 37 80 37 90 42L98 78C100 96 94 108 88 118L88 138L52 138L52 118C46 108 40 96 42 78Z" />
          <path d="M52 138L88 138L92 158L84 168L56 168L48 158Z" />
          <circle cx="44" cy="51" r="10" />
          <circle cx="96" cy="51" r="10" />
          <path d="M36 56C30 69 29 83 31 96L39 98C42 85 42 69 43 57Z" />
          <path d="M104 56C110 69 111 83 109 96L101 98C98 85 98 69 97 57Z" />
          <path d="M31 97L39 99L36 128L29 126Z" />
          <path d="M109 97L101 99L104 128L111 126Z" />
          <circle cx="32" cy="132" r="4.5" />
          <circle cx="108" cy="132" r="4.5" />
          <path d="M53 168L68 168L66 211L54 211Z" />
          <path d="M72 168L87 168L86 211L74 211Z" />
          <circle cx="60" cy="215" r="4" />
          <circle cx="80" cy="215" r="4" />
          <path d="M54 219L66 219L65 251L55 251Z" />
          <path d="M74 219L86 219L85 251L75 251Z" />
          <rect x="51" y="253" width="18" height="7" rx="3" />
          <rect x="71" y="253" width="18" height="7" rx="3" />
        </g>

        {side === "front" ? (
          <g>
            <g fill={fill("chest")} opacity={opacity("chest")} stroke={fill("chest")} strokeOpacity="0.6">
              <path d="M53 55C58 49 68 49 69 57L69 72C62 77 55 73 52 66Z"><title>Chest</title></path>
              <path d="M87 55C82 49 72 49 71 57L71 72C78 77 85 73 88 66Z"><title>Chest</title></path>
            </g>
            <g fill={fill("core")} opacity={opacity("core")} stroke={fill("core")} strokeOpacity="0.5">
              <rect x="60" y="77" width="20" height="45" rx="6"><title>Core</title></rect>
              <path d="M54 80C51 91 51 102 54 113L58 110L58 83Z"><title>Core</title></path>
              <path d="M86 80C89 91 89 102 86 113L82 110L82 83Z"><title>Core</title></path>
            </g>
            <g stroke="#060708" strokeOpacity="0.45" strokeWidth="1">
              <path d="M60 89H80M60 100H80M60 111H80M70 78V121" />
            </g>
            <g fill={fill("shoulders")} opacity={opacity("shoulders")} stroke={fill("shoulders")} strokeOpacity="0.5">
              <circle cx="44" cy="53" r="8"><title>Shoulders</title></circle>
              <circle cx="96" cy="53" r="8"><title>Shoulders</title></circle>
            </g>
            <g fill={fill("biceps")} opacity={opacity("biceps")} stroke={fill("biceps")} strokeOpacity="0.5">
              <ellipse cx="37" cy="76" rx="5" ry="12"><title>Biceps</title></ellipse>
              <ellipse cx="103" cy="76" rx="5" ry="12"><title>Biceps</title></ellipse>
            </g>
            <g fill={fill("forearms")} opacity={opacity("forearms")} stroke={fill("forearms")} strokeOpacity="0.5">
              <ellipse cx="34" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
              <ellipse cx="106" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
            </g>
            <g fill={fill("quads")} opacity={opacity("quads")} stroke={fill("quads")} strokeOpacity="0.5">
              <path d="M55 171L67 171L66 207L55 207Z"><title>Quads</title></path>
              <path d="M73 171L85 171L85 207L74 207Z"><title>Quads</title></path>
            </g>
            <g fill={fill("calves")} opacity={opacity("calves")} stroke={fill("calves")} strokeOpacity="0.5">
              <ellipse cx="60" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
              <ellipse cx="80" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
            </g>
            <g fill={fill("lats")} opacity={opacity("lats") * 0.7} stroke={fill("lats")} strokeOpacity="0.4">
              <path d="M44 66C46 80 48 92 51 104L54 100L53 70Z"><title>Lats</title></path>
              <path d="M96 66C94 80 92 92 89 104L86 100L87 70Z"><title>Lats</title></path>
            </g>
          </g>
        ) : (
          <g>
            <g fill={fill("back")} opacity={opacity("back")} stroke={fill("back")} strokeOpacity="0.5">
              <path d="M52 48C60 42 80 42 88 48L94 82C92 100 84 110 70 114C56 110 48 100 46 82Z"><title>Back</title></path>
            </g>
            <g stroke="#060708" strokeOpacity="0.4" strokeWidth="1">
              <path d="M70 46V112M55 62C62 66 78 66 85 62M54 78C62 82 78 82 86 78" />
            </g>
            <g fill={fill("lats")} opacity={opacity("lats")} stroke={fill("lats")} strokeOpacity="0.5">
              <path d="M47 66C48 84 52 98 60 108L64 100C58 90 55 78 54 64Z"><title>Lats</title></path>
              <path d="M93 66C92 84 88 98 80 108L76 100C82 90 85 78 86 64Z"><title>Lats</title></path>
            </g>
            <g fill={fill("shoulders")} opacity={opacity("shoulders")} stroke={fill("shoulders")} strokeOpacity="0.5">
              <circle cx="44" cy="53" r="8"><title>Rear delts</title></circle>
              <circle cx="96" cy="53" r="8"><title>Rear delts</title></circle>
            </g>
            <g fill={fill("triceps")} opacity={opacity("triceps")} stroke={fill("triceps")} strokeOpacity="0.5">
              <ellipse cx="37" cy="76" rx="5" ry="12"><title>Triceps</title></ellipse>
              <ellipse cx="103" cy="76" rx="5" ry="12"><title>Triceps</title></ellipse>
            </g>
            <g fill={fill("forearms")} opacity={opacity("forearms")} stroke={fill("forearms")} strokeOpacity="0.5">
              <ellipse cx="34" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
              <ellipse cx="106" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
            </g>
            <g fill={fill("glutes")} opacity={opacity("glutes")} stroke={fill("glutes")} strokeOpacity="0.5">
              <path d="M54 142C58 136 68 136 70 144L70 160C63 164 55 160 52 152Z"><title>Glutes</title></path>
              <path d="M86 142C82 136 72 136 70 144L70 160C77 164 85 160 88 152Z"><title>Glutes</title></path>
            </g>
            <g fill={fill("hamstrings")} opacity={opacity("hamstrings")} stroke={fill("hamstrings")} strokeOpacity="0.5">
              <path d="M55 171L67 171L66 207L55 207Z"><title>Hamstrings</title></path>
              <path d="M73 171L85 171L85 207L74 207Z"><title>Hamstrings</title></path>
            </g>
            <g fill={fill("calves")} opacity={opacity("calves")} stroke={fill("calves")} strokeOpacity="0.5">
              <ellipse cx="60" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
              <ellipse cx="80" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

export function RecoveryLegend({ recovery, limit = 6 }: { recovery: Recovery; limit?: number }) {
  const rows = Object.entries(recovery)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.recovery - b.recovery)
    .slice(0, limit);
  const labels: Record<string, string> = {
    chest: "Chest", back: "Back", lats: "Lats", shoulders: "Shoulders", biceps: "Biceps",
    triceps: "Triceps", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes",
    calves: "Calves", core: "Core", forearms: "Forearms",
  };
  return (
    <div className="w-full space-y-2.5">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-chalk/80">{labels[r.key] ?? r.key}</span>
            <span className="font-numeric text-[10px]" style={{ color: recoveryColor(r.recovery) }}>
              {r.recovery}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${r.recovery}%`, background: recoveryColor(r.recovery) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
