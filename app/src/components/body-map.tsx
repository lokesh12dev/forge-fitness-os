"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, Dumbbell, Sparkles, X, Zap } from "lucide-react";

export function recoveryColor(pct: number) {
  if (pct >= 80) return "#C9F73A"; // Acid green: primed
  if (pct >= 60) return "#7BE0AD"; // Mint: ready
  if (pct >= 40) return "#FFD166"; // Amber: moderate
  return "#FF6B35"; // Flame: fatigued
}

type Recovery = Record<string, { recovery: number; sets: number; lastTrained: number | null }>;

const MUSCLE_METADATA: Record<
  string,
  {
    name: string;
    scientific: string;
    recommended: string[];
    role: string;
  }
> = {
  chest: {
    name: "Chest",
    scientific: "Pectoralis Major & Minor",
    recommended: ["Barbell Bench Press", "Incline Dumbbell Press", "Dips", "Cable Flyes"],
    role: "Horizontal pushing & shoulder adduction",
  },
  back: {
    name: "Upper Back",
    scientific: "Rhomboids & Trapezius",
    recommended: ["Barbell Row", "Chest-Supported Row", "Face Pulls"],
    role: "Scapular retraction & posture control",
  },
  lats: {
    name: "Lats",
    scientific: "Latissimus Dorsi",
    recommended: ["Pull-ups", "Lat Pulldown", "Single-Arm DB Row"],
    role: "Vertical pulling & shoulder extension",
  },
  shoulders: {
    name: "Shoulders",
    scientific: "Deltoids (Anterior, Lateral, Posterior)",
    recommended: ["Overhead Press", "Lateral Raises", "Rear Delt Flyes"],
    role: "Shoulder abduction & overhead pressing",
  },
  biceps: {
    name: "Biceps",
    scientific: "Biceps Brachii & Brachialis",
    recommended: ["Incline Dumbbell Curl", "Barbell Curl", "Hammer Curls"],
    role: "Elbow flexion & forearm supination",
  },
  triceps: {
    name: "Triceps",
    scientific: "Triceps Brachii (3 Heads)",
    recommended: ["Close-Grip Bench", "Skull Crushers", "Cable Pushdowns"],
    role: "Elbow extension & lockout strength",
  },
  quads: {
    name: "Quads",
    scientific: "Quadriceps Femoris",
    recommended: ["Barbell Back Squat", "Leg Press", "Bulgarian Split Squat"],
    role: "Knee extension & squat drive",
  },
  hamstrings: {
    name: "Hamstrings",
    scientific: "Biceps Femoris & Semitendinosus",
    recommended: ["Romanian Deadlift", "Seated Leg Curl", "Glute Ham Raise"],
    role: "Hip extension & knee flexion",
  },
  glutes: {
    name: "Glutes",
    scientific: "Gluteus Maximus & Medius",
    recommended: ["Barbell Hip Thrust", "Deadlift", "Walking Lunges"],
    role: "Hip extension, abduction, & stabilization",
  },
  calves: {
    name: "Calves",
    scientific: "Gastrocnemius & Soleus",
    recommended: ["Standing Calf Raise", "Seated Calf Raise"],
    role: "Plantarflexion & ankle stability",
  },
  core: {
    name: "Core / Abs",
    scientific: "Rectus Abdominis & Obliques",
    recommended: ["Hanging Leg Raise", "Ab Wheel Rollout", "Cable Woodchop"],
    role: "Anti-extension, anti-rotation, & spinal stiffness",
  },
  forearms: {
    name: "Forearms",
    scientific: "Brachioradialis & Wrist Flexors",
    recommended: ["Farmer's Walks", "Wrist Curls", "Dead Hangs"],
    role: "Grip strength & wrist flexion",
  },
};

export function BodyMap({
  recovery,
  className,
  onSelectMuscle,
}: {
  recovery: Recovery;
  className?: string;
  onSelectMuscle?: (muscleKey: string) => void;
}) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<string | null>(null);

  const get = (k: string) => recovery[k]?.recovery ?? 100;
  const fill = (k: string) => recoveryColor(get(k));
  const opacity = (k: string) => (recovery[k]?.sets ? 0.9 : 0.35);

  const handleSelect = (key: string) => {
    const next = selected === key ? null : key;
    setSelected(next);
    if (onSelectMuscle && next) onSelectMuscle(next);
  };

  const base = "#14181E";
  const line = "rgba(255,255,255,0.12)";

  const selectedData = selected ? recovery[selected] : null;
  const selectedMeta = selected ? MUSCLE_METADATA[selected] : null;

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Front / Back Toggle */}
      <div className="mb-3 flex rounded-full border border-white/8 bg-white/[0.03] p-0.5">
        {(["front", "back"] as const).map((s) => (
          <button
            key={s}
            type="button"
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

      {/* SVG Interactive Map */}
      <div className="relative">
        <svg
          viewBox="0 0 140 268"
          className="h-[248px] w-auto select-none"
          aria-label={`${side} muscle recovery map`}
        >
          {/* Base Skeleton */}
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

          {/* Interactive Muscle Layers */}
          {side === "front" ? (
            <g>
              {/* Chest */}
              <g
                onClick={() => handleSelect("chest")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("chest")}
                opacity={selected === "chest" ? 1 : opacity("chest")}
                stroke={selected === "chest" ? "#FFFFFF" : fill("chest")}
                strokeWidth={selected === "chest" ? 2 : 1}
              >
                <path d="M53 55C58 49 68 49 69 57L69 72C62 77 55 73 52 66Z"><title>Chest</title></path>
                <path d="M87 55C82 49 72 49 71 57L71 72C78 77 85 73 88 66Z"><title>Chest</title></path>
              </g>

              {/* Core */}
              <g
                onClick={() => handleSelect("core")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("core")}
                opacity={selected === "core" ? 1 : opacity("core")}
                stroke={selected === "core" ? "#FFFFFF" : fill("core")}
                strokeWidth={selected === "core" ? 2 : 1}
              >
                <rect x="60" y="77" width="20" height="45" rx="6"><title>Core</title></rect>
                <path d="M54 80C51 91 51 102 54 113L58 110L58 83Z"><title>Core</title></path>
                <path d="M86 80C89 91 89 102 86 113L82 110L82 83Z"><title>Core</title></path>
              </g>
              <g stroke="#060708" strokeOpacity="0.45" strokeWidth="1" pointerEvents="none">
                <path d="M60 89H80M60 100H80M60 111H80M70 78V121" />
              </g>

              {/* Shoulders */}
              <g
                onClick={() => handleSelect("shoulders")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("shoulders")}
                opacity={selected === "shoulders" ? 1 : opacity("shoulders")}
                stroke={selected === "shoulders" ? "#FFFFFF" : fill("shoulders")}
                strokeWidth={selected === "shoulders" ? 2 : 1}
              >
                <circle cx="44" cy="53" r="8"><title>Shoulders</title></circle>
                <circle cx="96" cy="53" r="8"><title>Shoulders</title></circle>
              </g>

              {/* Biceps */}
              <g
                onClick={() => handleSelect("biceps")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("biceps")}
                opacity={selected === "biceps" ? 1 : opacity("biceps")}
                stroke={selected === "biceps" ? "#FFFFFF" : fill("biceps")}
                strokeWidth={selected === "biceps" ? 2 : 1}
              >
                <ellipse cx="37" cy="76" rx="5" ry="12"><title>Biceps</title></ellipse>
                <ellipse cx="103" cy="76" rx="5" ry="12"><title>Biceps</title></ellipse>
              </g>

              {/* Forearms */}
              <g
                onClick={() => handleSelect("forearms")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("forearms")}
                opacity={selected === "forearms" ? 1 : opacity("forearms")}
                stroke={selected === "forearms" ? "#FFFFFF" : fill("forearms")}
                strokeWidth={selected === "forearms" ? 2 : 1}
              >
                <ellipse cx="34" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
                <ellipse cx="106" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
              </g>

              {/* Quads */}
              <g
                onClick={() => handleSelect("quads")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("quads")}
                opacity={selected === "quads" ? 1 : opacity("quads")}
                stroke={selected === "quads" ? "#FFFFFF" : fill("quads")}
                strokeWidth={selected === "quads" ? 2 : 1}
              >
                <path d="M55 171L67 171L66 207L55 207Z"><title>Quads</title></path>
                <path d="M73 171L85 171L85 207L74 207Z"><title>Quads</title></path>
              </g>

              {/* Calves */}
              <g
                onClick={() => handleSelect("calves")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("calves")}
                opacity={selected === "calves" ? 1 : opacity("calves")}
                stroke={selected === "calves" ? "#FFFFFF" : fill("calves")}
                strokeWidth={selected === "calves" ? 2 : 1}
              >
                <ellipse cx="60" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
                <ellipse cx="80" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
              </g>

              {/* Lats */}
              <g
                onClick={() => handleSelect("lats")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("lats")}
                opacity={selected === "lats" ? 1 : opacity("lats") * 0.7}
                stroke={selected === "lats" ? "#FFFFFF" : fill("lats")}
                strokeWidth={selected === "lats" ? 2 : 1}
              >
                <path d="M44 66C46 80 48 92 51 104L54 100L53 70Z"><title>Lats</title></path>
                <path d="M96 66C94 80 92 92 89 104L86 100L87 70Z"><title>Lats</title></path>
              </g>
            </g>
          ) : (
            <g>
              {/* Back */}
              <g
                onClick={() => handleSelect("back")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("back")}
                opacity={selected === "back" ? 1 : opacity("back")}
                stroke={selected === "back" ? "#FFFFFF" : fill("back")}
                strokeWidth={selected === "back" ? 2 : 1}
              >
                <path d="M52 48C60 42 80 42 88 48L94 82C92 100 84 110 70 114C56 110 48 100 46 82Z"><title>Back</title></path>
              </g>
              <g stroke="#060708" strokeOpacity="0.4" strokeWidth="1" pointerEvents="none">
                <path d="M70 46V112M55 62C62 66 78 66 85 62M54 78C62 82 78 82 86 78" />
              </g>

              {/* Lats */}
              <g
                onClick={() => handleSelect("lats")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("lats")}
                opacity={selected === "lats" ? 1 : opacity("lats")}
                stroke={selected === "lats" ? "#FFFFFF" : fill("lats")}
                strokeWidth={selected === "lats" ? 2 : 1}
              >
                <path d="M47 66C48 84 52 98 60 108L64 100C58 90 55 78 54 64Z"><title>Lats</title></path>
                <path d="M93 66C92 84 88 98 80 108L76 100C82 90 85 78 86 64Z"><title>Lats</title></path>
              </g>

              {/* Rear Delts */}
              <g
                onClick={() => handleSelect("shoulders")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("shoulders")}
                opacity={selected === "shoulders" ? 1 : opacity("shoulders")}
                stroke={selected === "shoulders" ? "#FFFFFF" : fill("shoulders")}
                strokeWidth={selected === "shoulders" ? 2 : 1}
              >
                <circle cx="44" cy="53" r="8"><title>Rear delts</title></circle>
                <circle cx="96" cy="53" r="8"><title>Rear delts</title></circle>
              </g>

              {/* Triceps */}
              <g
                onClick={() => handleSelect("triceps")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("triceps")}
                opacity={selected === "triceps" ? 1 : opacity("triceps")}
                stroke={selected === "triceps" ? "#FFFFFF" : fill("triceps")}
                strokeWidth={selected === "triceps" ? 2 : 1}
              >
                <ellipse cx="37" cy="76" rx="5" ry="12"><title>Triceps</title></ellipse>
                <ellipse cx="103" cy="76" rx="5" ry="12"><title>Triceps</title></ellipse>
              </g>

              {/* Forearms */}
              <g
                onClick={() => handleSelect("forearms")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("forearms")}
                opacity={selected === "forearms" ? 1 : opacity("forearms")}
                stroke={selected === "forearms" ? "#FFFFFF" : fill("forearms")}
                strokeWidth={selected === "forearms" ? 2 : 1}
              >
                <ellipse cx="34" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
                <ellipse cx="106" cy="112" rx="4" ry="12"><title>Forearms</title></ellipse>
              </g>

              {/* Glutes */}
              <g
                onClick={() => handleSelect("glutes")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("glutes")}
                opacity={selected === "glutes" ? 1 : opacity("glutes")}
                stroke={selected === "glutes" ? "#FFFFFF" : fill("glutes")}
                strokeWidth={selected === "glutes" ? 2 : 1}
              >
                <path d="M54 142C58 136 68 136 70 144L70 160C63 164 55 160 52 152Z"><title>Glutes</title></path>
                <path d="M86 142C82 136 72 136 70 144L70 160C77 164 85 160 88 152Z"><title>Glutes</title></path>
              </g>

              {/* Hamstrings */}
              <g
                onClick={() => handleSelect("hamstrings")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("hamstrings")}
                opacity={selected === "hamstrings" ? 1 : opacity("hamstrings")}
                stroke={selected === "hamstrings" ? "#FFFFFF" : fill("hamstrings")}
                strokeWidth={selected === "hamstrings" ? 2 : 1}
              >
                <path d="M55 171L67 171L66 207L55 207Z"><title>Hamstrings</title></path>
                <path d="M73 171L85 171L85 207L74 207Z"><title>Hamstrings</title></path>
              </g>

              {/* Calves */}
              <g
                onClick={() => handleSelect("calves")}
                className="cursor-pointer transition-all hover:opacity-100"
                fill={fill("calves")}
                opacity={selected === "calves" ? 1 : opacity("calves")}
                stroke={selected === "calves" ? "#FFFFFF" : fill("calves")}
                strokeWidth={selected === "calves" ? 2 : 1}
              >
                <ellipse cx="60" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
                <ellipse cx="80" cy="234" rx="4.5" ry="13"><title>Calves</title></ellipse>
              </g>
            </g>
          )}
        </svg>

        <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-wider text-dim">
          Tap any muscle for recovery details
        </p>
      </div>

      {/* Tap-for-Detail Slide-up / Modal Card (B5) */}
      {selected && selectedMeta && selectedData && (
        <div className="animate-fade-up mt-3 w-full rounded-2xl border border-white/10 bg-panel/90 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: recoveryColor(selectedData.recovery) }}
                />
                <h4 className="text-[13px] font-bold text-chalk">{selectedMeta.name}</h4>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wider"
                  style={{
                    background: `${recoveryColor(selectedData.recovery)}15`,
                    color: recoveryColor(selectedData.recovery),
                  }}
                >
                  {selectedData.recovery}% recovered
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[8px] text-dim">{selectedMeta.scientific}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="grid size-6 place-items-center rounded-full border border-white/10 text-dim hover:text-chalk"
              aria-label="Close detail"
            >
              <X className="size-3" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
              <p className="font-numeric text-base font-semibold text-chalk">{selectedData.sets}</p>
              <p className="font-mono text-[7.5px] uppercase tracking-wider text-dim">
                8-day sets logged
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
              <p className="font-numeric text-base font-semibold text-chalk">
                {selectedData.lastTrained !== null ? `${selectedData.lastTrained}d ago` : "Fresh"}
              </p>
              <p className="font-mono text-[7.5px] uppercase tracking-wider text-dim">Last trained</p>
            </div>
          </div>

          <div className="mt-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-acid" />
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-chalk">
                Training Verdict
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-mist">
              {selectedData.recovery >= 80
                ? "Optimal to push top sets and PR attempts today."
                : selectedData.recovery >= 60
                  ? "Sufficiently recovered. Train as programmed with standard rest."
                  : "Elevated muscular fatigue. Recommended to avoid heavy compounds until tomorrow."}
            </p>
          </div>

          <div className="mt-2.5">
            <span className="font-mono text-[8px] uppercase tracking-wider text-dim">
              Key exercises in library:
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {selectedMeta.recommended.map((ex) => (
                <span
                  key={ex}
                  className="rounded-md border border-white/[0.06] bg-black/30 px-2 py-0.5 text-[9.5px] text-chalk/90"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecoveryLegend({
  recovery,
  limit = 6,
  onSelect,
}: {
  recovery: Recovery;
  limit?: number;
  onSelect?: (muscleKey: string) => void;
}) {
  const rows = Object.entries(recovery)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.recovery - b.recovery)
    .slice(0, limit);

  const labels: Record<string, string> = {
    chest: "Chest",
    back: "Back",
    lats: "Lats",
    shoulders: "Shoulders",
    biceps: "Biceps",
    triceps: "Triceps",
    quads: "Quads",
    hamstrings: "Hamstrings",
    glutes: "Glutes",
    calves: "Calves",
    core: "Core",
    forearms: "Forearms",
  };

  return (
    <div className="w-full space-y-2.5">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onSelect && onSelect(r.key)}
          className="group w-full text-left transition-colors"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-chalk/80 group-hover:text-acid">
              {labels[r.key] ?? r.key}
            </span>
            <span className="font-numeric text-[10px]" style={{ color: recoveryColor(r.recovery) }}>
              {r.recovery}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${r.recovery}%`, background: recoveryColor(r.recovery) }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
