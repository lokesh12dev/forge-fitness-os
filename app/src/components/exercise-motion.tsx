"use client";

import { useEffect, useState } from "react";
import { Camera, Pause, Play } from "lucide-react";
import { BODY_PATHS, INERT_SILHOUETTE_PARTS } from "@/lib/body-paths";
import { toBodyMapSlug } from "@/lib/opengym-catalog";
import { cn } from "@/lib/utils";

const BACK_FOCUS_SLUGS = new Set([
  "lats",
  "upper-back",
  "lower-back",
  "trapezius",
  "hamstring",
  "gluteal",
  "triceps",
  "calves",
]);

const PATTERN_CUE: Record<string, string> = {
  jump_box: "Explosive single-leg drive -> soft 2-foot box landing",
  horizontal_push: "Lower bar under control -> press through full chest drive",
  vertical_push: "Brace ribs down -> press vertically to stacked lockout",
  vertical_pull: "Depress scapulae -> pull elbows down toward ribs",
  horizontal_pull: "Retract shoulder blades -> row smoothly to lower chest",
  squat: "Break hips & knees together -> drive evenly out of the hole",
  hinge: "Push hips backward -> lock glutes & hamstrings at the top",
  lunge: "Descend under single-leg control -> drive through front heel",
  isolation_arm: "Lock upper arm position -> squeeze full contraction",
  isolation_shoulder: "Lead with elbows -> control tension through full arc",
  core: "Exhale and brace ribs down -> hold rigid spinal line",
  conditioning: "Rhythmic athletic drive -> maintain crisp posture",
  isolation_leg: "Full range muscular stretch -> smooth peak squeeze",
  isolation_chest: "Stretch pec fibers wide -> converge across midline",
};

const INERT_SET = new Set<string>(INERT_SILHOUETTE_PARTS as readonly string[]);

function buildEffectiveWeights(
  pattern: string,
  primaryMuscle?: string,
  secondaryMuscles?: string[],
  muscleWeights?: Record<string, number>,
): Record<string, number> {
  if (muscleWeights && Object.keys(muscleWeights).length > 0) return muscleWeights;
  const out: Record<string, number> = {};
  if (primaryMuscle) {
    for (const s of toBodyMapSlug(primaryMuscle)) out[s] = 1;
  }
  for (const sec of secondaryMuscles ?? []) {
    for (const s of toBodyMapSlug(sec)) {
      if (!out[s]) out[s] = 0.45;
    }
  }
  if (Object.keys(out).length === 0) {
    if (pattern === "jump_box" || pattern === "squat" || pattern === "lunge" || pattern === "isolation_leg") {
      out.quadriceps = 1;
      out.gluteal = 0.55;
      out.calves = 0.35;
    } else if (pattern === "hinge") {
      out.hamstring = 1;
      out.gluteal = 0.85;
      out["lower-back"] = 0.45;
    } else if (pattern === "horizontal_push" || pattern === "isolation_chest") {
      out.chest = 1;
      out.deltoids = 0.5;
      out.triceps = 0.45;
    } else if (pattern === "vertical_pull" || pattern === "horizontal_pull") {
      out.lats = 1;
      out["upper-back"] = 0.7;
      out.biceps = 0.4;
    } else if (pattern === "vertical_push" || pattern === "isolation_shoulder") {
      out.deltoids = 1;
      out.triceps = 0.45;
    } else if (pattern === "isolation_arm") {
      out.biceps = 0.9;
      out.triceps = 0.85;
    } else {
      out.abs = 1;
      out.obliques = 0.6;
    }
  }
  return out;
}

function chooseSide(weights: Record<string, number>, pattern: string): "front" | "back" {
  let backScore = 0;
  let frontScore = 0;
  for (const [slug, val] of Object.entries(weights)) {
    const score = val >= 0.85 ? val * 3 : val;
    if (BACK_FOCUS_SLUGS.has(slug)) backScore += score;
    else frontScore += score;
  }
  if (pattern === "hinge" || pattern === "vertical_pull" || pattern === "horizontal_pull") {
    backScore += 0.35;
  }
  return backScore > frontScore ? "back" : "front";
}

function motionTransform(pattern: string, phase: number): { tx: number; ty: number; sx: number; sy: number; rot: number; pulse: number } {
  const s = Math.sin(phase * Math.PI * 2); // -1 .. +1
  const c01 = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0 .. 1 .. 0 smoothly
  switch (pattern) {
    case "jump_box": {
      // Smooth single-leg crouch -> explosive diagonal arc onto box -> land
      const jumpArc = Math.sin(Math.min(1, c01 * 1.15) * Math.PI);
      const tx = c01 * 115;
      const ty = -jumpArc * 170 + (1 - c01) * 14;
      const sy = c01 < 0.15 ? 0.95 : 1 - jumpArc * 0.03;
      return { tx, ty, sx: 1, sy, rot: c01 * 4, pulse: 0.75 + jumpArc * 0.25 };
    }
    case "squat":
    case "lunge":
      return { tx: 0, ty: c01 * 90, sx: 1.02, sy: 1 - c01 * 0.12, rot: c01 * 2, pulse: 0.72 + c01 * 0.28 };
    case "hinge":
      return { tx: -c01 * 18, ty: c01 * 48, sx: 1, sy: 1 - c01 * 0.06, rot: -c01 * 8, pulse: 0.72 + c01 * 0.28 };
    case "vertical_pull":
      return { tx: 0, ty: -c01 * 72, sx: 1, sy: 1, rot: 0, pulse: 0.72 + c01 * 0.28 };
    case "horizontal_push":
    case "vertical_push":
    case "horizontal_pull":
    case "isolation_arm":
    case "isolation_shoulder":
      return { tx: 0, ty: -c01 * 18, sx: 1, sy: 1, rot: s * 1.5, pulse: 0.72 + c01 * 0.28 };
    default:
      return { tx: 0, ty: -c01 * 28, sx: 1, sy: 1 - c01 * 0.04, rot: s * 2, pulse: 0.75 + c01 * 0.25 };
  }
}

export function ExerciseMotionDemo({
  pattern,
  equipment = "barbell",
  primaryMuscle,
  secondaryMuscles,
  muscleWeights,
  name,
  customMedia,
  showingOwn = false,
  onToggleOwn,
  size = "sm",
  interactive = false,
  className,
}: {
  pattern: string;
  equipment?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  muscleWeights?: Record<string, number>;
  name?: string;
  customMedia?: { kind: "image" | "video"; dataUrl: string } | null;
  showingOwn?: boolean;
  onToggleOwn?: () => void;
  size?: "sm" | "lg";
  interactive?: boolean;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = (ts - start) / 2100; // smooth 2.1s rep cadence
      setPhase(elapsed % 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const weights = buildEffectiveWeights(pattern, primaryMuscle, secondaryMuscles, muscleWeights);
  const side = chooseSide(weights, pattern);
  const view = BODY_PATHS.male[side];
  const offsetX = side === "back" ? 718 : 0;
  const vbLeft = offsetX - 180;
  const vbWidth = 1090;
  const isJumpBox = pattern === "jump_box" || Boolean(name && /jump box|box jump|step[- ]up/i.test(name));
  const m = playing ? motionTransform(pattern, phase) : { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, pulse: 1 };
  const cue = PATTERN_CUE[pattern] ?? "Controlled eccentric -> peak muscle squeeze";

  if (customMedia && showingOwn) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-black/15 bg-black",
          size === "lg" ? "h-[245px] w-full sm:h-[268px]" : "size-12 rounded-xl",
          className,
        )}
      >
        {customMedia.kind === "video" ? (
          <video
            src={customMedia.dataUrl}
            autoPlay={size === "lg"}
            loop
            muted
            playsInline
            controls={size === "lg"}
            className="h-full w-full object-contain"
          />
        ) : (
          <img src={customMedia.dataUrl} alt={name ?? "Exercise demonstration"} className="h-full w-full object-contain" />
        )}
        {onToggleOwn && size === "lg" && (
          <button
            type="button"
            onClick={onToggleOwn}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black"
          >
            <Play className="size-3" /> Animation
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative select-none overflow-hidden border border-black/10 bg-[#F7F8FA]",
        size === "lg" ? "h-[245px] w-full rounded-2xl sm:h-[268px]" : "size-12 shrink-0 rounded-xl",
        className,
      )}
    >
      <svg
        viewBox={`${vbLeft} 75 ${vbWidth} 1315`}
        className="h-full w-full"
        aria-label={`${name ?? pattern} anatomical guide`}
      >
        <defs>
          <radialGradient id={`floor-${side}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#111827" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#111827" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ground Shadow Plane */}
        <ellipse
          cx={offsetX + 365}
          cy="1352"
          rx="185"
          ry="24"
          fill={`url(#floor-${side})`}
        />

        {/* Equipment Prop Layer: Jump Box */}
        {isJumpBox && (
          <g>
            <polygon
              points={`${offsetX + 610},1080 ${offsetX + 790},1035 ${offsetX + 865},1080 ${offsetX + 685},1125`}
              fill="#E5E7EB"
              stroke="#9CA3AF"
              strokeWidth="4"
            />
            <polygon
              points={`${offsetX + 610},1080 ${offsetX + 685},1125 ${offsetX + 685},1345 ${offsetX + 610},1298`}
              fill="#D1D5DB"
              stroke="#9CA3AF"
              strokeWidth="4"
            />
            <polygon
              points={`${offsetX + 685},1125 ${offsetX + 865},1080 ${offsetX + 865},1300 ${offsetX + 685},1345`}
              fill="#B3B9C4"
              stroke="#8B92A1"
              strokeWidth="4"
            />
          </g>
        )}

        {/* Equipment Prop Layer: Barbell / Bench / Pullup / Dumbbell */}
        {!isJumpBox && (equipment === "barbell" || equipment === "ez-bar" || pattern === "squat" || pattern === "hinge" || pattern === "horizontal_push") && (
          <g transform={`translate(0, ${playing ? Math.sin(phase * Math.PI * 2) * 32 : 0})`}>
            {pattern === "horizontal_push" && (
              <rect x={offsetX + 185} y="1010" width="360" height="44" rx="14" fill="#9CA3AF" stroke="#6B7280" strokeWidth="4" />
            )}
            <line
              x1={offsetX + 45}
              y1={pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420}
              x2={offsetX + 685}
              y2={pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420}
              stroke="#374151"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <rect x={offsetX + 35} y={(pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420) - 70} width="26" height="140" rx="6" fill="#1F2937" />
            <rect x={offsetX + 669} y={(pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420) - 70} width="26" height="140" rx="6" fill="#1F2937" />
            <rect x={offsetX + 70} y={(pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420) - 52} width="18" height="104" rx="5" fill="#4B5563" />
            <rect x={offsetX + 642} y={(pattern === "hinge" ? 730 : pattern === "squat" ? 315 : 420) - 52} width="18" height="104" rx="5" fill="#4B5563" />
          </g>
        )}

        {!isJumpBox && pattern === "vertical_pull" && (
          <g>
            <line x1={offsetX + 90} y1="115" x2={offsetX + 640} y2="115" stroke="#374151" strokeWidth="14" strokeLinecap="round" />
            <line x1={offsetX + 110} y1="115" x2={offsetX + 110} y2="1350" stroke="#CBD5E1" strokeWidth="10" />
            <line x1={offsetX + 620} y1="115" x2={offsetX + 620} y2="1350" stroke="#CBD5E1" strokeWidth="10" />
          </g>
        )}

        {/* Sculpted Anatomical Human Figure (MIT MuscleMap paths) */}
        <g
          transform={`translate(${m.tx}, ${m.ty}) rotate(${m.rot}, ${offsetX + 364}, 720) scale(${m.sx}, ${m.sy})`}
          style={{ transformOrigin: `${offsetX + 364}px 1340px` }}
        >
          {Object.entries(view.p).map(([slug, paths]) => {
            const isInert = INERT_SET.has(slug);
            const weight = weights[slug] ?? 0;
            const isPrimary = weight >= 0.7;
            const isSecondary = weight > 0 && weight < 0.7;

            let fill = "#D8DEE8";
            let stroke = "#64748B";
            let strokeWidth = 4;

            if (slug === "hair") {
              fill = "#3F4654";
              stroke = "#1F2937";
            } else if (isInert) {
              fill = "#E2E6EE";
              stroke = "#6B7280";
            } else if (isPrimary) {
              fill = "#D93025";
              stroke = "#7F1D1D";
              strokeWidth = 4.5;
            } else if (isSecondary) {
              fill = "#F06E5B";
              stroke = "#9A3412";
              strokeWidth = 4;
            }

            return (
              <g
                key={slug}
                style={{
                  opacity: isPrimary ? m.pulse : 1,
                }}
              >
                {paths.map((d, i) => (
                  <path
                    key={`${slug}-${i}`}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Own Media Flip Toggle if User Added Custom Photo/Video */}
      {customMedia && onToggleOwn && size === "lg" && (
        <button
          type="button"
          onClick={onToggleOwn}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/85"
        >
          <Camera className="size-3" /> Yours
        </button>
      )}

      {/* Exact Screenshot 1 "tap to play" / "Pause" control */}
      {interactive && size === "lg" && (
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
          <span className="hidden rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/95 backdrop-blur-sm sm:inline">
            {cue}
          </span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause movement animation" : "Tap to play movement animation"}
            className="pointer-events-auto ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#4B5058]/90 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-md backdrop-blur-sm transition hover:bg-black/85"
          >
            {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
            <span>{playing ? "Pause" : "tap to play"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
