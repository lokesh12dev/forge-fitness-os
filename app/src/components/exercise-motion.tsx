"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Original Kinematic Biomechanical Movement Visualizer
 *
 * Draws clean, looping 2-phase skeletal & equipment motion paths matched
 * to movement patterns (horizontal push, vertical push, squat, hinge, pull, core, etc.)
 * without reusing any third-party proprietary video or image assets.
 */

type RigPose = {
  head: [number, number];
  shoulder: [number, number];
  elbow: [number, number];
  hand: [number, number];
  hip: [number, number];
  knee: [number, number];
  foot: [number, number];
  bar?: [number, number, number, number]; // x1,y1,x2,y2
  bench?: boolean;
};

type PatternPoses = { a: RigPose; b: RigPose; cue: string };

const PATTERN_POSES: Record<string, PatternPoses> = {
  horizontal_push: {
    cue: "Lower to chest -> drive up",
    a: { head: [26, 60], shoulder: [38, 62], elbow: [38, 44], hand: [40, 26], hip: [66, 64], knee: [86, 64], foot: [90, 82], bar: [30, 24, 52, 24], bench: true },
    b: { head: [26, 60], shoulder: [38, 62], elbow: [46, 66], hand: [40, 52], hip: [66, 64], knee: [86, 64], foot: [90, 82], bar: [30, 50, 52, 50], bench: true },
  },
  vertical_push: {
    cue: "Press vertically to lockout",
    a: { head: [48, 22], shoulder: [48, 34], elbow: [36, 40], hand: [46, 32], hip: [48, 58], knee: [48, 74], foot: [48, 90], bar: [34, 30, 62, 30] },
    b: { head: [48, 22], shoulder: [48, 34], elbow: [44, 21], hand: [48, 11], hip: [48, 58], knee: [48, 74], foot: [48, 90], bar: [34, 10, 62, 10] },
  },
  vertical_pull: {
    cue: "Pull elbows to ribs",
    a: { head: [50, 38], shoulder: [50, 48], elbow: [46, 30], hand: [48, 14], hip: [50, 68], knee: [48, 82], foot: [48, 94], bar: [28, 12, 72, 12] },
    b: { head: [50, 18], shoulder: [50, 28], elbow: [36, 38], hand: [48, 14], hip: [50, 50], knee: [48, 66], foot: [48, 80], bar: [28, 12, 72, 12] },
  },
  horizontal_pull: {
    cue: "Row toward lower ribs",
    a: { head: [30, 34], shoulder: [40, 42], elbow: [40, 58], hand: [40, 74], hip: [64, 52], knee: [66, 72], foot: [68, 90], bar: [28, 76, 52, 76] },
    b: { head: [30, 34], shoulder: [40, 42], elbow: [56, 38], hand: [44, 52], hip: [64, 52], knee: [66, 72], foot: [68, 90], bar: [32, 54, 56, 54] },
  },
  squat: {
    cue: "Break hips & knees -> drive",
    a: { head: [48, 16], shoulder: [48, 28], elbow: [44, 34], hand: [46, 26], hip: [50, 54], knee: [48, 72], foot: [48, 90], bar: [34, 24, 62, 24] },
    b: { head: [44, 38], shoulder: [46, 48], elbow: [42, 54], hand: [44, 46], hip: [62, 66], knee: [38, 68], foot: [48, 90], bar: [32, 44, 60, 44] },
  },
  hinge: {
    cue: "Push hips back -> snap tall",
    a: { head: [48, 18], shoulder: [48, 30], elbow: [48, 44], hand: [48, 56], hip: [50, 52], knee: [48, 72], foot: [48, 90], bar: [34, 58, 62, 58] },
    b: { head: [30, 40], shoulder: [40, 46], elbow: [40, 62], hand: [40, 76], hip: [68, 52], knee: [62, 72], foot: [58, 90], bar: [26, 78, 54, 78] },
  },
  lunge: {
    cue: "Split stance descent -> drive up",
    a: { head: [48, 18], shoulder: [48, 30], elbow: [48, 42], hand: [48, 52], hip: [48, 54], knee: [46, 72], foot: [46, 90] },
    b: { head: [48, 34], shoulder: [48, 44], elbow: [48, 54], hand: [48, 62], hip: [48, 66], knee: [32, 70], foot: [32, 90] },
  },
  isolation_arm: {
    cue: "Pin upper arm -> full flex",
    a: { head: [46, 18], shoulder: [46, 30], elbow: [46, 48], hand: [50, 62], hip: [46, 56], knee: [46, 74], foot: [46, 90] },
    b: { head: [46, 18], shoulder: [46, 30], elbow: [46, 48], hand: [56, 32], hip: [46, 56], knee: [46, 74], foot: [46, 90] },
  },
  isolation_shoulder: {
    cue: "Sweep wide to shoulder height",
    a: { head: [50, 18], shoulder: [50, 30], elbow: [44, 46], hand: [42, 60], hip: [50, 56], knee: [50, 74], foot: [50, 90] },
    b: { head: [50, 18], shoulder: [50, 30], elbow: [32, 30], hand: [18, 30], hip: [50, 56], knee: [50, 74], foot: [50, 90] },
  },
  core: {
    cue: "Brace ribs down -> hold line",
    a: { head: [22, 68], shoulder: [32, 68], elbow: [32, 82], hand: [40, 82], hip: [56, 68], knee: [72, 74], foot: [86, 82] },
    b: { head: [22, 62], shoulder: [34, 62], elbow: [32, 82], hand: [40, 82], hip: [56, 58], knee: [72, 70], foot: [86, 82] },
  },
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpPose(a: RigPose, b: RigPose, t: number): RigPose {
  const pt = (p1: [number, number], p2: [number, number]): [number, number] => [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
  return {
    head: pt(a.head, b.head),
    shoulder: pt(a.shoulder, b.shoulder),
    elbow: pt(a.elbow, b.elbow),
    hand: pt(a.hand, b.hand),
    hip: pt(a.hip, b.hip),
    knee: pt(a.knee, b.knee),
    foot: pt(a.foot, b.foot),
    bar: a.bar && b.bar ? [lerp(a.bar[0], b.bar[0], t), lerp(a.bar[1], b.bar[1], t), lerp(a.bar[2], b.bar[2], t), lerp(a.bar[3], b.bar[3], t)] : undefined,
    bench: a.bench,
  };
}

export function ExerciseMotionDemo({
  pattern,
  equipment,
  size = "sm",
  accent = "#C9F73A",
  interactive = false,
}: {
  pattern: string;
  equipment?: string;
  size?: "sm" | "lg";
  accent?: string;
  interactive?: boolean;
}) {
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      const t = 0.5 - 0.5 * Math.cos((frame * Math.PI) / 14);
      setPhase(t);
    }, size === "sm" ? 110 : 75);
    return () => clearInterval(id);
  }, [playing, size]);

  const spec = PATTERN_POSES[pattern] ?? PATTERN_POSES.horizontal_push;
  const pose = interpPose(spec.a, spec.b, phase);
  const strokeWidth = size === "sm" ? 4.2 : 3.4;

  const svgContent = (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      {/* Subtle floor / reference line */}
      <line x1="12" y1="90" x2="88" y2="90" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Bench if horizontal press */}
      {pose.bench && (
        <line x1="22" y1="68" x2="74" y2="68" stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" strokeLinecap="round" />
      )}

      {/* Barbell / rig bar */}
      {pose.bar && (
        <g>
          <line x1={pose.bar[0]} y1={pose.bar[1]} x2={pose.bar[2]} y2={pose.bar[3]} stroke={accent} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
          <circle cx={pose.bar[0]} cy={pose.bar[1]} r={3.5} fill={accent} />
          <circle cx={pose.bar[2]} cy={pose.bar[3]} r={3.5} fill={accent} />
        </g>
      )}

      {/* Lower body chain */}
      <line x1={pose.hip[0]} y1={pose.hip[1]} x2={pose.knee[0]} y2={pose.knee[1]} stroke="rgba(242,243,238,0.85)" strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={pose.knee[0]} y1={pose.knee[1]} x2={pose.foot[0]} y2={pose.foot[1]} stroke="rgba(242,243,238,0.7)" strokeWidth={strokeWidth} strokeLinecap="round" />

      {/* Torso */}
      <line x1={pose.shoulder[0]} y1={pose.shoulder[1]} x2={pose.hip[0]} y2={pose.hip[1]} stroke="rgba(242,243,238,0.95)" strokeWidth={strokeWidth + 0.5} strokeLinecap="round" />

      {/* Arm chain highlighted */}
      <line x1={pose.shoulder[0]} y1={pose.shoulder[1]} x2={pose.elbow[0]} y2={pose.elbow[1]} stroke={accent} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1={pose.elbow[0]} y1={pose.elbow[1]} x2={pose.hand[0]} y2={pose.hand[1]} stroke={accent} strokeWidth={strokeWidth} strokeLinecap="round" />

      {/* Head + joints */}
      <circle cx={pose.head[0]} cy={pose.head[1]} r={size === "sm" ? 5.2 : 4.6} fill="rgba(242,243,238,0.9)" />
      {!pose.bar && equipment !== "bodyweight" && (
        <circle cx={pose.hand[0]} cy={pose.hand[1]} r={3.4} fill={accent} />
      )}
    </svg>
  );

  if (size === "sm") {
    return (
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-1")}>
        {svgContent}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141416] p-4">
      <div className="h-44 w-44">{svgContent}</div>
      <div className="mt-2 flex w-full items-center justify-between gap-2 border-t border-white/[0.07] pt-2.5 text-[11px] text-mist">
        <span>{spec.cue}</span>
        {interactive && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-chalk hover:bg-white/[0.12]"
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
    </div>
  );
}
