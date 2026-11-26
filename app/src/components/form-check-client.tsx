"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Camera, CameraOff, Check, CheckCircle2, ChevronRight,
  Loader2, Play, RotateCcw, Shield, Sparkles, Video,
} from "lucide-react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";
import { Button, IconButton, ProgressBar } from "@/components/ui";
import { createSquatCounter, measureSideLeg, updateSquatCounter, type PosePoint } from "@/lib/form-check/pose-metrics";
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

const POSE_BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [27, 31], [28, 30], [28, 32],
] as const;

const POSE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const POSE_MODEL_URL = "https://huggingface.co/litert-community/MediaPipe-PoseLandmarker-Lite/resolve/105f65fd3484e46a25fe517a3722932d4392083c/pose_landmarker_lite.task";

function drawPose(canvas: HTMLCanvasElement, landmarks: PosePoint[] | undefined) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  const point = (index: number) => landmarks[index];
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, canvas.width * 0.005);
  context.strokeStyle = "rgba(201,247,58,0.82)";
  context.fillStyle = "#C9F73A";

  for (const [aIndex, bIndex] of POSE_BONES) {
    const a = point(aIndex);
    const b = point(bIndex);
    if (!a || !b || (a.visibility ?? 0) < 0.4 || (b.visibility ?? 0) < 0.4) continue;
    context.beginPath();
    context.moveTo(a.x * canvas.width, a.y * canvas.height);
    context.lineTo(b.x * canvas.width, b.y * canvas.height);
    context.stroke();
  }

  for (const landmark of landmarks) {
    if ((landmark.visibility ?? 0) < 0.4) continue;
    context.beginPath();
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, Math.max(2.5, canvas.width * 0.006), 0, Math.PI * 2);
    context.fill();
  }
}

export function FormCheckStudio() {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [lift, setLift] = useState<LiftKey>("squat");
  const [status, setStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [poseVisibility, setPoseVisibility] = useState<number | null>(null);
  const [kneeAngle, setKneeAngle] = useState<number | null>(null);
  const [liveReps, setLiveReps] = useState(0);
  const [deepestAngle, setDeepestAngle] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cameraEpochRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastInferenceAtRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const liveActiveRef = useRef(false);
  const counterRef = useRef(createSquatCounter());
  const data = LIFTS[lift];

  const phase = status === "scanning" && mode === "demo" ? progress / 100 : status === "done" ? 0.86 : 0.12;
  const demoReps = status === "done" ? data.reps : Math.min(data.reps, Math.floor((progress / 100) * data.reps));

  function stopPoseLoop() {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    lastVideoTimeRef.current = -1;
    if (canvasRef.current) drawPose(canvasRef.current, undefined);
  }

  function stopCamera() {
    cameraEpochRef.current += 1;
    liveActiveRef.current = false;
    stopPoseLoop();
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setModelReady(false);
    setModelLoading(false);
    setPoseVisibility(null);
    setKneeAngle(null);
  }

  function startPoseLoop() {
    stopPoseLoop();
    const tick = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (video && canvas && landmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        if (now - lastInferenceAtRef.current >= 125 && video.currentTime !== lastVideoTimeRef.current) {
          lastInferenceAtRef.current = now;
          lastVideoTimeRef.current = video.currentTime;
          try {
            const timestamp = Math.max(video.currentTime * 1000, lastTimestampRef.current + 1);
            lastTimestampRef.current = timestamp;
            const result = landmarker.detectForVideo(video, timestamp);
            const landmarks = result.landmarks[0] as PosePoint[] | undefined;
            drawPose(canvas, landmarks);
            const measurement = landmarks ? measureSideLeg(landmarks, video.videoWidth / video.videoHeight) : null;
            setPoseVisibility(measurement?.visibility ?? null);
            setKneeAngle(measurement ? Math.round(measurement.angleDegrees) : null);

            if (measurement && liveActiveRef.current) {
              const update = updateSquatCounter(counterRef.current, measurement.angleDegrees, timestamp);
              counterRef.current = update.state;
              if (update.repCompleted) setLiveReps(update.state.reps);
              setDeepestAngle(update.state.deepestAngle === null ? null : Math.round(update.state.deepestAngle));
            }
          } catch {
            setPoseError("The local pose model could not process this frame. Try restarting the camera.");
            liveActiveRef.current = false;
            setStatus("idle");
            landmarker.close();
            landmarkerRef.current = null;
            setModelReady(false);
            return;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }

  async function enableCamera() {
    if (modelLoading) return;
    stopCamera();
    const requestId = cameraEpochRef.current;
    setMode("live");
    setLift("squat");
    setStatus("idle");
    setCameraError(null);
    setPoseError(null);
    setModelLoading(true);
    setProgress(0);
    counterRef.current = createSquatCounter();
    setLiveReps(0);
    setDeepestAngle(null);
    let cameraStarted = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not provide camera access.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (requestId !== cameraEpochRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (!videoRef.current) throw new Error("The camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      cameraStarted = true;

      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(POSE_WASM_URL);
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });

      if (requestId !== cameraEpochRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      setModelReady(true);
      startPoseLoop();
    } catch (error) {
      if (requestId !== cameraEpochRef.current) return;
      const message = error instanceof Error ? error.message : "The camera could not be started.";
      if (!cameraStarted) {
        setCameraError(message);
        stopCamera();
      } else {
        setPoseError("Camera is on, but the pose engine could not load. Check your connection and try again.");
      }
    } finally {
      if (requestId === cameraEpochRef.current) setModelLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "demo" || status !== "scanning") return;
    const timer = setInterval(() => {
      setProgress((value) => {
        const next = value + 1.4;
        if (next >= 100) {
          clearInterval(timer);
          setStatus("done");
          return 100;
        }
        return next;
      });
    }, 90);
    return () => clearInterval(timer);
  }, [mode, status]);

  useEffect(() => () => {
    cameraEpochRef.current += 1;
    liveActiveRef.current = false;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    landmarkerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function selectDemo() {
    stopCamera();
    setMode("demo");
    setStatus("idle");
    setProgress(0);
  }

  function startDemo() {
    stopCamera();
    setMode("demo");
    setProgress(0);
    setStatus("scanning");
  }

  function startLiveSet() {
    counterRef.current = createSquatCounter();
    setLiveReps(0);
    setDeepestAngle(null);
    liveActiveRef.current = true;
    setStatus("scanning");
  }

  function finishLiveSet() {
    liveActiveRef.current = false;
    setDeepestAngle(counterRef.current.deepestAngle === null ? null : Math.round(counterRef.current.deepestAngle));
    setStatus("done");
  }

  function reset() {
    liveActiveRef.current = false;
    setProgress(0);
    setLiveReps(0);
    setDeepestAngle(null);
    counterRef.current = createSquatCounter();
    setStatus("idle");
  }

  function changeLift(key: LiftKey) {
    if (mode === "live" && key !== "squat") return;
    setLift(key);
    setProgress(0);
    setStatus("idle");
  }

  const displayedReps = mode === "live" ? liveReps : demoReps;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="surface overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", status === "scanning" ? "animate-pulse-dot bg-flame" : status === "done" ? "bg-acid" : "bg-dim")} />
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-mist">
                {mode === "demo" ? status === "scanning" ? "Example animation · not your movement" : status === "done" ? "Illustrative sample report" : "Example mode" : status === "scanning" ? "Live squat rep counter" : status === "done" ? "Live count complete" : modelLoading ? "Loading local pose model…" : modelReady ? "Pose preview ready" : cameraOn ? "Camera preview · pose unavailable" : "Live camera mode"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(Object.keys(LIFTS) as LiftKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => changeLift(key)}
                  disabled={mode === "live" && key !== "squat"}
                  title={mode === "live" && key !== "squat" ? "Live counting is currently available for the back squat pilot only." : undefined}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                    lift === key ? "border-acid/30 bg-acid/10 text-acid" : "border-white/[0.07] text-dim hover:text-mist",
                  )}
                >
                  {LIFTS[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
            <div className="flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
              <button onClick={selectDemo} className={cn("rounded-full px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em]", mode === "demo" ? "bg-white/10 text-chalk" : "text-dim hover:text-mist")}>Example report</button>
              <button onClick={enableCamera} className={cn("rounded-full px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em]", mode === "live" ? "bg-acid/10 text-acid" : "text-dim hover:text-mist")}>Live camera</button>
            </div>
            {mode === "demo" && <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-amber">Illustrative data · not generated from camera</span>}
            {mode === "live" && <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-mint">Frames processed in browser · no video upload</span>}
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#080A0C] sm:aspect-[16/10]">
            {!cameraOn && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(201,247,58,0.07),transparent_55%)]" />
                <div className="absolute inset-0 grid-lines opacity-[0.18]" />
              </div>
            )}

            <video ref={videoRef} playsInline muted aria-hidden="true" className={cn("absolute inset-0 size-full -scale-x-100 object-cover", cameraOn ? "opacity-80" : "opacity-0")} />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full -scale-x-100 object-cover" aria-label="Live pose landmark overlay" />

            {mode === "demo" && <div className="absolute inset-0"><Skeleton phase={phase} lift={lift} /></div>}

            <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                <Video className="size-2.5 text-acid" /> {mode === "live" ? "Local camera · side view" : "Example movement"}
              </span>
              {mode === "live" && (
                <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                  <span className={cn("size-1.5 rounded-full", poseVisibility === null ? "bg-dim" : "bg-sky")} />
                  {poseVisibility === null ? "Lower-body landmarks not ready" : `Landmark visibility ${Math.round(poseVisibility * 100)}%`}
                </span>
              )}
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
              <span className="rounded-md border border-acid/20 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid backdrop-blur">
                {mode === "live" ? `${liveReps} reps` : `${displayedReps} / ${data.reps} sample reps`}
              </span>
              {mode === "live" && kneeAngle !== null && (
                <span className="rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                  Approx. 2D knee angle {kneeAngle}°
                </span>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0">
              <div className="flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10">
                <div>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">{mode === "live" ? "Live squat count" : "Sample rep count"}</p>
                  <p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.04em] text-chalk">
                    {displayedReps}
                    {mode === "demo" && <span className="ml-1 text-[10px] font-normal text-dim">of {data.reps}</span>}
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 sm:max-w-[220px]">
                  {status === "done" ? (
                    <div className="flex items-center justify-end gap-1.5 rounded-full border border-acid/25 bg-acid/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid">
                      <CheckCircle2 className="size-2.5" /> {mode === "live" ? "Count complete" : "Sample complete"}
                    </div>
                  ) : mode === "demo" ? <ProgressBar value={progress} color="#C9F73A" height={4} /> : (
                    <div className="flex justify-end font-mono text-[8px] uppercase tracking-[0.1em] text-dim">{status === "scanning" ? "Counting from pose" : "Ready when you are"}</div>
                  )}
                </div>
              </div>
            </div>

            {((mode === "demo" && status === "idle") || (mode === "live" && (!cameraOn || status !== "scanning"))) && (
              <div className="absolute inset-0 grid place-items-center bg-black/20">
                <div className="max-w-[290px] px-4 text-center">
                  {mode === "demo" ? (
                    <>
                      <button onClick={startDemo} className="group mx-auto grid size-16 place-items-center rounded-full border border-acid/40 bg-acid/15 text-acid backdrop-blur transition-all hover:scale-105 hover:bg-acid hover:text-ink"><Play className="ml-1 size-6 fill-current" /></button>
                      <p className="mt-3 font-display text-[15px] font-semibold text-chalk">Preview a sample report</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Uses illustrative example data</p>
                    </>
                  ) : !cameraOn ? (
                    <>
                      <button onClick={enableCamera} disabled={modelLoading} className="group mx-auto grid size-16 place-items-center rounded-full border border-acid/40 bg-acid/15 text-acid backdrop-blur transition-all hover:scale-105 hover:bg-acid hover:text-ink disabled:opacity-50"><Camera className="size-6" /></button>
                      <p className="mt-3 font-display text-[15px] font-semibold text-chalk">Enable camera and pose model</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Side-on · head and feet in frame</p>
                    </>
                  ) : modelReady ? (
                    <>
                      <button onClick={startLiveSet} disabled={poseVisibility === null} className="group mx-auto grid size-16 place-items-center rounded-full border border-acid/40 bg-acid/15 text-acid backdrop-blur transition-all hover:scale-105 hover:bg-acid hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"><Play className="ml-1 size-6 fill-current" /></button>
                      <p className="mt-3 font-display text-[15px] font-semibold text-chalk">{poseVisibility === null ? "Step back into full view" : status === "done" ? "Start another count" : "Start squat count"}</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">{poseVisibility === null ? "Keep hips, knees and ankles visible" : "Only counts a bend-and-return cycle"}</p>
                    </>
                  ) : modelLoading ? (
                    <>
                      <Loader2 className="mx-auto size-6 animate-spin text-acid" />
                      <p className="mt-3 font-display text-[15px] font-semibold text-chalk">Loading on-device pose model</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">First use needs an internet connection</p>
                    </>
                  ) : (
                    <>
                      <button onClick={enableCamera} className="group mx-auto grid size-16 place-items-center rounded-full border border-acid/40 bg-acid/15 text-acid backdrop-blur transition-all hover:scale-105 hover:bg-acid hover:text-ink"><RotateCcw className="size-6" /></button>
                      <p className="mt-3 font-display text-[15px] font-semibold text-chalk">Pose model unavailable</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">{poseError ?? "Reconnect to try again"}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {mode === "live" && status === "scanning" && (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-flame/25 bg-black/60 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-flame backdrop-blur">
                <span className="mr-1.5 inline-block size-1.5 animate-pulse-dot rounded-full bg-flame" />
                Live count · on-device
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <IconButton onClick={cameraOn ? stopCamera : enableCamera} aria-label={cameraOn ? "Disable camera" : "Enable camera"}>
                {cameraOn ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
              </IconButton>
              <span className="ml-1 hidden font-mono text-[8px] uppercase tracking-[0.1em] text-dim sm:inline">
                {mode === "live" ? cameraOn ? "Side view · stationary camera" : "Camera not connected" : "Example athlete · no camera input"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status === "done" && <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="size-3.5" /> Reset</Button>}
              <Button size="sm" onClick={mode === "demo" ? status === "scanning" ? () => setStatus("done") : startDemo : !cameraOn ? enableCamera : modelLoading ? undefined : !modelReady ? enableCamera : status === "scanning" ? finishLiveSet : startLiveSet} disabled={mode === "live" && (modelLoading || (modelReady && poseVisibility === null && status !== "scanning"))}>
                {mode === "demo" ? status === "scanning" ? <><Loader2 className="size-3.5 animate-spin" /> Finish example</> : status === "done" ? <><Play className="size-3.5" /> Replay example</> : <><Play className="size-3.5" /> Run example</> : !cameraOn ? <><Camera className="size-3.5" /> Enable camera</> : modelLoading ? <><Loader2 className="size-3.5 animate-spin" /> Loading pose model</> : !modelReady ? <><RotateCcw className="size-3.5" /> Retry pose setup</> : status === "scanning" ? <><Check className="size-3.5" /> Finish count</> : status === "done" ? <><Play className="size-3.5" /> Count another set</> : <><Play className="size-3.5" /> Start squat count</>}
              </Button>
            </div>
          </div>
        </div>

        {(cameraError || poseError) && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/[0.05] px-3 py-2 text-[10.5px] text-amber">
            <AlertTriangle className="size-3.5 shrink-0" /> {cameraError ?? poseError}
          </div>
        )}

        {mode === "live" && status === "done" && (
          <div className="animate-fade-up mt-4 surface rounded-2xl p-5">
            <p className="label-mono mb-1.5">Live session · squat rep count pilot</p>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div><p className="font-numeric text-4xl font-bold tracking-[-0.05em] text-chalk">{liveReps}</p><p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">counted reps</p></div>
              {deepestAngle !== null && <div><p className="font-numeric text-2xl font-bold tracking-[-0.04em] text-chalk">{deepestAngle}°</p><p className="font-mono text-[8px] uppercase tracking-[0.12em] text-dim">lowest observed 2D knee angle</p></div>}
            </div>
            <p className="mt-4 rounded-xl border border-amber/15 bg-amber/[0.04] px-3 py-2.5 text-[10px] leading-relaxed text-mist">This pilot reports a rough camera-based count only. It does not grade squat depth, load, bar path, safety, pain, or lifting technique. Camera angle, clothing, occlusion, and the pose model can affect the count.</p>
          </div>
        )}

        {mode === "demo" && status === "done" && (
          <div className="animate-fade-up mt-4 space-y-4">
            <div className="rounded-xl border border-amber/20 bg-amber/[0.06] px-4 py-3 text-[10px] leading-relaxed text-amber">
              <strong className="font-mono uppercase tracking-[0.1em]">Example output only.</strong> This sample report is not generated from your camera or movement.
            </div>
            <div className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative grid size-[72px] shrink-0 place-items-center">
                  <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90"><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" /><circle cx="40" cy="40" r="34" fill="none" stroke="#C9F73A" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(data.score / 100) * 213.6} 213.6`} /></svg>
                  <div className="text-center"><p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.05em] text-chalk">{data.score}</p><p className="font-mono text-[6.5px] uppercase tracking-[0.12em] text-dim">sample score</p></div>
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="label-mono mb-1.5">Illustrative movement report · {data.label}</p>
                  <h3 className="max-w-md font-display text-[19px] font-bold leading-[1.08] tracking-[-0.03em] text-chalk">{data.verdict}</h3>
                  <p className="mt-2 text-[10px] leading-relaxed text-dim">Every value and coaching note below is placeholder content for a proposed future experience.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {data.metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">{metric.label}</p><p className={cn("mt-1 font-numeric text-[15px] font-semibold", metric.ok ? "text-chalk" : "text-flame")}>{metric.value}</p><p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-dim">{metric.target}</p></div>)}
              </div>
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">Illustrative positive observations</p>
                <div className="flex flex-wrap gap-1.5">{data.wins.map((win) => <span key={win} className="flex items-center gap-1 rounded-full border border-mint/20 bg-mint/[0.06] px-2.5 py-1 text-[9.5px] text-mint"><Check className="size-2.5" /> {win}</span>)}</div>
              </div>
            </div>
            <div className="surface rounded-2xl p-5">
              <p className="label-mono mb-1.5">Example cue cards</p>
              <h3 className="font-display text-[19px] font-bold tracking-[-0.03em] text-chalk">A future coaching format</h3>
              <div className="mt-4 space-y-2">{data.issues.map((issue, index) => <div key={issue.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] font-numeric text-[11px] font-bold text-mist">{index + 1}</span><div className="min-w-0"><p className="text-[12px] font-semibold text-chalk">{issue.title}</p><p className="mt-1 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-mist"><ChevronRight className="mt-0.5 size-3 shrink-0 text-acid" />{issue.cue}</p></div></div></div>)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 xl:col-span-4">
        <div className="surface rounded-2xl p-5">
          <p className="label-mono mb-1.5">Camera setup</p>
          <h3 className="font-display text-[19px] font-bold tracking-[-0.03em] text-chalk">Give the counter a clean view</h3>
          <div className="mt-4 space-y-3">{[
            { n: "01", title: "Place it side-on", body: "Set the lens around hip height, square to your side. Keep the camera still." },
            { n: "02", title: "Fit your whole body", body: "Leave space around your head, hips, knees, and feet. Use even light and avoid backlighting." },
            { n: "03", title: "Count only", body: "The pilot overlays pose landmarks and counts a bend-and-return cycle. It does not grade form." },
          ].map((step) => <div key={step.n} className="flex gap-3"><span className="font-numeric text-[11px] font-bold text-acid/60">{step.n}</span><div><p className="text-[11px] font-semibold text-chalk/90">{step.title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-dim">{step.body}</p></div></div>)}</div>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2"><Shield className="size-4 text-mint" /><p className="text-[11.5px] font-semibold text-chalk">Camera frames stay in this browser</p></div>
          <p className="mt-2 text-[10px] leading-relaxed text-dim">Camera frames and landmarks are processed in this browser and are not uploaded or saved by this feature. First use downloads MediaPipe runtime files from jsDelivr and the pose model from Hugging Face. MediaPipe also documents usage/performance metrics sent to Google; its privacy notice says input media is not sent. <a className="text-mist underline underline-offset-2" href="https://developers.google.com/edge/mediapipe/solutions/privacy" target="_blank" rel="noreferrer">MediaPipe privacy notice</a>.</p>
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Inference capped near 8 frames/sec · device dependent</div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(140deg,rgba(201,247,58,0.07),rgba(255,107,53,0.05))] p-5">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-acid" /><p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">Pilot boundaries</p></div>
          <p className="mt-2 text-[11px] leading-relaxed text-mist">One 2D side view can miss rotation, load, bar path, and hidden joints. The angle shown is a rough image estimate. Do not use this counter to judge safety, pain, readiness, or technique.</p>
        </div>

        <div className="surface rounded-2xl p-5">
          <p className="label-mono mb-1.5">Supported today</p>
          <div className="space-y-2 text-[10px]">
            <div className="flex items-center justify-between"><span className="text-mist">Squat bend-and-return count</span><span className="font-mono uppercase tracking-[0.1em] text-mint">Live pilot</span></div>
            <div className="flex items-center justify-between"><span className="text-mist">Bench press · deadlift</span><span className="font-mono uppercase tracking-[0.1em] text-dim">Sample only</span></div>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-dim">The camera does not identify load or exercise variation. No barbell detection, form score, cue generation, or workout saving is connected yet.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
