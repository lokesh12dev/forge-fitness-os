"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Camera, CameraOff, Check, CheckCircle2, ChevronRight, Gauge,
  Loader2, Play, RotateCcw, Shield, Sparkles, Timer, Video, Zap,
} from "lucide-react";
import { Button, IconButton, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ───────────────────────────── DATA ───────────────────────────── */

type LiftKey = "squat" | "bench" | "deadlift";

const LIFTS: Record<LiftKey, {
  label: string;
  short: string;
  reps: number;
  score: number;
  verdict: string;
  metrics: { label: string; value: string; target: string; ok: boolean }[];
  issues: { title: string; cue: string; severity: "high" | "medium" | "low"; at: string }[];
  wins: string[];
}> = {
  squat: {
    label: "Back squat",
    short: "SQ",
    reps: 8,
    score: 87,
    verdict: "Strong set. Depth is competition-legal on 7 of 8 reps.",
    metrics: [
      { label: "Depth", value: "92%", target: "hip < knee", ok: true },
      { label: "Torso angle", value: "38°", target: "30–45°", ok: true },
      { label: "Knee tracking", value: "8° valgus", target: "< 5°", ok: false },
      { label: "Tempo", value: "2.1 / 0.4 / 1.2", target: "controlled", ok: true },
    ],
    issues: [
      { title: "Left knee drifts inward on the ascent", cue: "Screw both feet into the floor and push the floor apart. Cue: “knees over pinkies.”", severity: "high", at: "0:18" },
      { title: "Butt wink at the bottom", cue: "You're chasing 2cm of depth past your available range. Stop at parallel, brace harder.", severity: "medium", at: "0:06" },
      { title: "Bar drifts 3cm forward out of the hole", cue: "Keep pressure through the midfoot. Think: chest rises with the bar, not before it.", severity: "low", at: "0:09" },
    ],
    wins: ["Depth consistent across all 8 reps", "Bar path within 3cm of vertical", "No tempo collapse on the last rep"],
  },
  bench: {
    label: "Bench press",
    short: "BP",
    reps: 6,
    score: 91,
    verdict: "Clean, repeatable bar path. Elbows are flaring slightly on the last rep.",
    metrics: [
      { label: "Bar path", value: "2.1cm", target: "< 3cm", ok: true },
      { label: "Elbow angle", value: "58°", target: "45–60°", ok: true },
      { label: "Touch point", value: "Sternal", target: "nipple line", ok: true },
      { label: "Lockout", value: "0.8s", target: "stable", ok: true },
    ],
    issues: [
      { title: "Elbows flare on rep 6", cue: "Keep the elbow under the bar longer. Cue: “bend the bar” through the whole press.", severity: "medium", at: "0:22" },
      { title: "Left foot loses contact at lockout", cue: "Drive through the whole foot. Leg drive should continue into the bar, not stop at the chest.", severity: "low", at: "0:14" },
    ],
    wins: ["Touch point identical on 6/6 reps", "Bar path within 2cm of vertical", "No shoulder shrug at lockout"],
  },
  deadlift: {
    label: "Deadlift",
    short: "DL",
    reps: 5,
    score: 84,
    verdict: "Solid pull. Hips shoot early on the third rep, which costs you lockout speed.",
    metrics: [
      { label: "Bar path", value: "4.4cm", target: "< 4cm", ok: false },
      { label: "Hip rise", value: "Early", target: "together", ok: false },
      { label: "Lockout", value: "Complete", target: "hips through", ok: true },
      { label: "Tempo", value: "1.4s up", target: "smooth", ok: true },
    ],
    issues: [
      { title: "Hips shoot before the bar breaks the floor", cue: "Set the lats, then push the floor away instead of pulling the bar. Keep the chest over the bar longer.", severity: "high", at: "0:12" },
      { title: "Bar swings 4cm away at the knee", cue: "Pull the slack out, then drag the bar up the shins. Cue: “bar to skin.”", severity: "medium", at: "0:08" },
    ],
    wins: ["Lockout complete on every rep", "No lower-back rounding at the start", "Consistent setup routine"],
  },
};

const ANGLES = ["Side", "Front"] as const;

/* ───────────────────────────── SKELETON ───────────────────────────── */

function Skeleton({ phase, lift }: { phase: number; lift: LiftKey }) {
  const d = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const squat = lift === "squat";
  const deadlift = lift === "deadlift";

  const hip = squat
    ? { x: 252 + d * 4, y: 195 + d * 66 }
    : deadlift
      ? { x: 246 + d * 6, y: 196 + d * 12 }
      : { x: 236, y: 208 };
  const shoulder = squat
    ? { x: 266 + d * 13, y: hip.y - 78 + d * 3 }
    : { x: 248 + d * 5, y: 144 + d * 8 };
  const head = { x: shoulder.x + 5, y: shoulder.y - 30 };
  const knee = squat
    ? { x: 262 + d * 34, y: 286 + d * 6 }
    : deadlift
      ? { x: 254 + d * 4, y: 280 + d * 4 }
      : { x: 254, y: 282 };
  const ankle = { x: 254, y: 352 };
  const elbow = squat
    ? { x: shoulder.x - 2, y: shoulder.y + 34 }
    : deadlift
      ? { x: shoulder.x - 3, y: shoulder.y + 44 + d * 2 }
      : { x: shoulder.x - 6, y: shoulder.y + 20 };
  const wrist = deadlift
    ? { x: 262, y: 302 + d * 2 }
    : squat
      ? { x: shoulder.x + 20, y: shoulder.y + 2 }
      : { x: shoulder.x + 18, y: shoulder.y + 6 };
  const barY = deadlift ? wrist.y : squat ? shoulder.y - 4 : elbow.y - 6;

  const joints = [
    { p: head, r: 12, accent: false },
    { p: shoulder, r: 5.5, accent: true },
    { p: elbow, r: 4.5, accent: false },
    { p: wrist, r: 4, accent: false },
    { p: hip, r: 5.5, accent: true },
    { p: knee, r: 5, accent: true },
    { p: ankle, r: 4, accent: false },
  ];

  return (
    <svg viewBox="0 0 520 400" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="floor-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9F73A" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#C9F73A" stopOpacity="0" />
        </linearGradient>
        <filter id="joint-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* floor */}
      <line x1="40" y1="356" x2="480" y2="356" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <rect x="40" y="356" width="440" height="44" fill="url(#floor-glow)" />

      {/* alignment guides */}
      <line x1={ankle.x} y1="70" x2={ankle.x} y2="352" stroke="rgba(201,247,58,0.16)" strokeDasharray="3 7" />
      <line x1={wrist.x} y1="70" x2={wrist.x} y2="352" stroke="rgba(255,255,255,0.10)" strokeDasharray="2 8" />
      <text x={ankle.x + 8} y="86" fill="rgba(201,247,58,0.55)" fontSize="9" fontFamily="monospace">MIDFOOT</text>

      {/* bar */}
      <line x1={barY === wrist.y ? 150 : 130} y1={barY} x2={barY === wrist.y ? 370 : 410} y2={barY} stroke="#F2F3EE" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      {barY !== wrist.y && (
        <>
          <rect x="118" y={barY - 13} width="13" height="26" rx="2" fill="#5C626D" opacity="0.7" />
          <rect x="389" y={barY - 13} width="13" height="26" rx="2" fill="#5C626D" opacity="0.7" />
        </>
      )}

      {/* body */}
      <polyline
        points={`${head.x},${head.y} ${shoulder.x},${shoulder.y} ${hip.x},${hip.y} ${knee.x},${knee.y} ${ankle.x},${ankle.y}`}
        fill="none"
        stroke="#C9F73A"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#joint-glow)"
      />
      <polyline
        points={`${shoulder.x},${shoulder.y} ${elbow.x},${elbow.y} ${wrist.x},${wrist.y}`}
        fill="none"
        stroke="rgba(201,247,58,0.72)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`${hip.x},${hip.y} ${hip.x - 4},${knee.y + 58} ${ankle.x - 2},${ankle.y}`}
        fill="none"
        stroke="rgba(201,247,58,0.4)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {joints.map((j, i) => (
        <g key={i}>
          <circle cx={j.p.x} cy={j.p.y} r={j.r + 4} fill={j.accent ? "rgba(201,247,58,0.12)" : "rgba(255,255,255,0.05)"} />
          <circle cx={j.p.x} cy={j.p.y} r={j.r} fill="#0C0E12" stroke={j.accent ? "#C9F73A" : "#F2F3EE"} strokeWidth="2" />
        </g>
      ))}

      {/* depth marker */}
      {squat && (
        <g opacity="0.7">
          <line x1="330" y1="262" x2="440" y2="262" stroke="#6EA8FF" strokeDasharray="2 4" />
          <text x="334" y="255" fill="#6EA8FF" fontSize="9" fontFamily="monospace">PARALLEL</text>
          <line x1={hip.x + 18} y1={hip.y} x2="330" y2={hip.y} stroke="rgba(255,255,255,0.2)" strokeDasharray="1 4" />
        </g>
      )}

      {/* angle arc at knee */}
      <text x={knee.x + 14} y={knee.y - 8} fill="#F2F3EE" fontSize="9" fontFamily="monospace" opacity="0.8">
        {Math.round(90 + d * 35)}°
      </text>
    </svg>
  );
}

/* ───────────────────────────── STUDIO ───────────────────────────── */

export function FormCheckStudio() {
  const [lift, setLift] = useState<LiftKey>("squat");
  const [angle, setAngle] = useState<(typeof ANGLES)[number]>("Side");
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [saved, setSaved] = useState(false);
  const data = LIFTS[lift];

  const phase = status === "scanning" ? progress / 100 : status === "done" ? 0.86 : 0.12;
  const reps = status === "done" ? data.reps : Math.min(data.reps, Math.floor((progress / 100) * data.reps));
  const score = status === "done" ? data.score : Math.min(data.score, Math.round((progress / 100) * data.score));

  async function enableCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("Camera permission denied — running the demo analysis instead.");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  useEffect(() => {
    if (status !== "scanning") return;
    setSaved(false);
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p + 1.4;
        if (next >= 100) {
          clearInterval(t);
          setStatus("done");
          return 100;
        }
        return next;
      });
    }, 90);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => stopCamera(), []);

  function start() {
    setProgress(0);
    setSaved(false);
    setStatus("scanning");
  }

  function reset() {
    setProgress(0);
    setStatus("idle");
    setSaved(false);
  }

  function changeLift(key: LiftKey) {
    setLift(key);
    setProgress(0);
    setStatus("idle");
    setSaved(false);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* STAGE */}
      <div className="xl:col-span-8">
        <div className="surface overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", status === "scanning" ? "animate-pulse-dot bg-flame" : status === "done" ? "bg-acid" : "bg-dim")} />
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-mist">
                {status === "scanning" ? "Analyzing movement…" : status === "done" ? "Set analyzed" : "Camera ready"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {LIFTS && (Object.keys(LIFTS) as LiftKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => changeLift(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors",
                    lift === key ? "border-acid/30 bg-acid/10 text-acid" : "border-white/[0.07] text-dim hover:text-mist",
                  )}
                >
                  {LIFTS[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#080A0C] sm:aspect-[16/10]">
            {/* background */}
            {cameraOn ? (
              <video ref={videoRef} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(201,247,58,0.07),transparent_55%)]" />
                <div className="absolute inset-0 grid-lines opacity-[0.18]" />
              </div>
            )}

            {/* skeleton + HUD */}
            <div className="absolute inset-0">
              <Skeleton phase={phase} lift={lift} />
            </div>

            {/* corner HUD */}
            <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                <Video className="size-2.5 text-acid" /> {angle} view · 30 fps
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                <Gauge className="size-2.5 text-sky" /> Pose confidence 97%
              </span>
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
              <span className="rounded-md border border-acid/20 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid backdrop-blur">
                {reps} / {data.reps} reps
              </span>
              {cameraOn && (
                <span className="rounded-md border border-flame/25 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-flame backdrop-blur">
                  ● Recording
                </span>
              )}
            </div>

            {/* progress */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
                <div>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">Rep counter</p>
                  <p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.04em] text-chalk">
                    {reps}
                    <span className="ml-1 text-[10px] font-normal text-dim">of {data.reps}</span>
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 sm:max-w-[220px]">
                  {status === "done" ? (
                    <div className="flex items-center justify-end gap-1.5 rounded-full border border-acid/25 bg-acid/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid">
                      <CheckCircle2 className="size-2.5" /> Analysis complete
                    </div>
                  ) : (
                    <ProgressBar value={progress} color="#C9F73A" height={4} />
                  )}
                </div>
              </div>
            </div>

            {/* center CTA */}
            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center bg-black/20">
                <div className="text-center">
                  <button
                    onClick={start}
                    className="group mx-auto grid size-16 place-items-center rounded-full border border-acid/40 bg-acid/15 text-acid backdrop-blur transition-all hover:scale-105 hover:bg-acid hover:text-ink"
                  >
                    <Play className="ml-1 size-6 fill-current" />
                  </button>
                  <p className="mt-3 font-display text-[15px] font-semibold text-chalk">Analyze a set</p>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Demo runs without a camera</p>
                </div>
              </div>
            )}
            {status === "scanning" && (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-flame/25 bg-black/60 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-flame backdrop-blur">
                <span className="mr-1.5 inline-block size-1.5 animate-pulse-dot rounded-full bg-flame" />
                Tracking 17 joints
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <IconButton onClick={cameraOn ? stopCamera : enableCamera} aria-label={cameraOn ? "Disable camera" : "Enable camera"}>
                {cameraOn ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
              </IconButton>
              <div className="flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
                {ANGLES.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAngle(a)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors",
                      angle === a ? "bg-white/10 text-chalk" : "text-dim hover:text-mist",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <span className="ml-1 hidden font-mono text-[8px] uppercase tracking-[0.1em] text-dim sm:inline">
                {cameraOn ? "Live camera + pose overlay" : "Demo athlete"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status === "done" && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
              )}
              <Button
                size="sm"
                onClick={status === "scanning" ? () => setStatus("done") : start}
                disabled={false}
              >
                {status === "scanning" ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Finish early</>
                ) : status === "done" ? (
                  <><Play className="size-3.5" /> Analyze another</>
                ) : (
                  <><Camera className="size-3.5" /> Start analysis</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {cameraError && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[10.5px] text-amber">
            <AlertTriangle className="size-3.5 shrink-0" /> {cameraError}
          </div>
        )}

        {/* RESULTS */}
        {status === "done" && (
          <div className="animate-fade-up mt-4 space-y-4">
            <div className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative grid size-[72px] place-items-center">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                      <circle
                        cx="40" cy="40" r="34" fill="none" stroke="#C9F73A" strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${(data.score / 100) * 213.6} 213.6`}
                      />
                    </svg>
                    <div className="text-center">
                      <p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.05em] text-chalk">{data.score}</p>
                      <p className="font-mono text-[6.5px] uppercase tracking-[0.12em] text-dim">score</p>
                    </div>
                  </div>
                  <div>
                    <p className="label-mono mb-1.5">Movement report · {data.label}</p>
                    <h3 className="max-w-md font-display text-[19px] font-bold leading-[1.08] tracking-[-0.03em] text-chalk">
                      {data.verdict}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist">
                        {data.reps} reps · {angle.toLowerCase()} view
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist">
                        {data.issues.length} cues
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="md"
                  variant={saved ? "secondary" : "primary"}
                  onClick={() => setSaved(true)}
                  disabled={saved}
                >
                  {saved ? <><Check className="size-3.5" /> Saved to session</> : <><Sparkles className="size-3.5" /> Attach to workout</>}
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {data.metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">{m.label}</p>
                    <p className={cn("mt-1 font-numeric text-[15px] font-semibold", m.ok ? "text-chalk" : "text-flame")}>{m.value}</p>
                    <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-dim">{m.target}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">What was good</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.wins.map((w) => (
                    <span key={w} className="flex items-center gap-1 rounded-full border border-mint/20 bg-mint/[0.06] px-2.5 py-1 text-[9.5px] text-mint">
                      <Check className="size-2.5" /> {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-mono mb-1.5">Fix list</p>
                  <h3 className="font-display text-[19px] font-bold tracking-[-0.03em] text-chalk">Three cues, in priority order</h3>
                </div>
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Timestamps inside set</span>
              </div>
              <div className="mt-4 space-y-2">
                {data.issues.map((issue, i) => (
                  <div key={issue.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg font-numeric text-[11px] font-bold",
                        issue.severity === "high" ? "bg-flame/10 text-flame" : issue.severity === "medium" ? "bg-amber/10 text-amber" : "bg-white/[0.05] text-mist",
                      )}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-semibold text-chalk">{issue.title}</p>
                          <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">@ {issue.at}</span>
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 font-mono text-[6.5px] uppercase tracking-[0.1em]",
                            issue.severity === "high" ? "bg-flame/10 text-flame" : issue.severity === "medium" ? "bg-amber/10 text-amber" : "bg-white/[0.05] text-dim",
                          )}>
                            {issue.severity}
                          </span>
                        </div>
                        <p className="mt-1 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-mist">
                          <ChevronRight className="mt-0.5 size-3 shrink-0 text-acid" />
                          {issue.cue}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-acid/15 bg-acid/[0.04] px-3 py-2.5 text-[10.5px] text-mist">
                <Sparkles className="size-3.5 shrink-0 text-acid" />
                Coach has attached these cues to your next {data.label.toLowerCase()} session. You&apos;ll see one at a time on the live screen.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RAIL */}
      <div className="space-y-4 xl:col-span-4">
        <div className="surface rounded-2xl p-5">
          <p className="label-mono mb-1.5">How it works</p>
          <h3 className="font-display text-[19px] font-bold tracking-[-0.03em] text-chalk">Your camera becomes a coach</h3>
          <div className="mt-4 space-y-3">
            {[
              { n: "01", title: "Frame the set", body: "Prop your phone at hip height, side-on. Full body in frame." },
              { n: "02", title: "Lift normally", body: "17-joint pose tracking runs on-device at 30fps. No upload." },
              { n: "03", title: "Get one cue", body: "The highest-leverage fix surfaces mid-set, not in a report nobody reads." },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <span className="font-numeric text-[11px] font-bold text-acid/60">{s.n}</span>
                <div>
                  <p className="text-[11px] font-semibold text-chalk/90">{s.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-dim">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-mono mb-1.5">Scoring rubric</p>
              <h3 className="font-display text-[17px] font-bold tracking-[-0.03em] text-chalk">What 87 means</h3>
            </div>
            <Gauge className="size-4 text-sky" />
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { label: "Depth + range", value: 92 },
              { label: "Bar / joint path", value: 88 },
              { label: "Tempo control", value: 90 },
              { label: "Symmetry", value: 78 },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] text-mist">{row.label}</span>
                  <span className="font-numeric text-[9.5px] text-dim">{row.value}</span>
                </div>
                <ProgressBar value={row.value} color={row.value >= 85 ? "#C9F73A" : "#FFD166"} height={3} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[9.5px] leading-relaxed text-dim">
            Scores compare your movement against a biomechanical model, not against other athletes. A 78 in symmetry is a signal, not a judgment.
          </p>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-mint" />
            <p className="text-[11.5px] font-semibold text-chalk">Private by architecture</p>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-dim">
            Video never leaves your device. Only joint coordinates and the resulting cues are stored, and you can delete them any time.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <Timer className="size-3 text-sky" />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Avg analysis 8.4s · on-device</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(140deg,rgba(201,247,58,0.07),rgba(255,107,53,0.05))] p-5">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-acid" />
            <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">Pro tip</p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mist">
            Film one set per lift per week from the same angle. The score matters less than the trend — and the trend is what Coach programs against.
          </p>
        </div>
      </div>
    </div>
  );
}
