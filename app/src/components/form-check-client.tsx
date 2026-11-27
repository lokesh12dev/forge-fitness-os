"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Camera, CameraOff, Check, CheckCircle2, ChevronRight,
  FlipHorizontal2, Gauge, History, Loader2, Play, RotateCcw, Shield, Sparkles,
  Square, Timer, Trash2, Upload, Video, Volume2, VolumeX, Zap,
} from "lucide-react";
import { Button, IconButton, ProgressBar } from "@/components/ui";
import {
  FormCheckTracker,
  generateSimulatedPoseFrame,
  LIFT_SPECS,
  POSE_CONNECTIONS,
  POSE_IDX,
  type CameraAngle,
  type FrameAnalysis,
  type LiftKey,
  type PoseLandmark,
  type SetAnalysisReport,
} from "@/lib/form-check/biomechanics";
import { cn } from "@/lib/utils";

type InputMode = "camera" | "video" | "simulator";

interface SavedFormCheckItem {
  id: string;
  workoutId: string | null;
  lift: LiftKey;
  angle: CameraAngle;
  mode: InputMode;
  reps: number;
  score: number;
  verdict: string;
  createdAt: number;
}

interface PoseLandmarkerInstance {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { landmarks?: PoseLandmark[][] };
  close?: () => void;
}

const ANGLES: CameraAngle[] = ["Side", "Front"];

function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  analysis: FrameAnalysis,
  lift: LiftKey,
  mirrored: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const mapX = (nx: number) => (mirrored ? (1 - nx) * w : nx * w);
  const mapY = (ny: number) => ny * h;

  const midfootPx = mapX(analysis.midfootX);
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = "rgba(201, 247, 58, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(midfootPx, h * 0.12);
  ctx.lineTo(midfootPx, h * 0.92);
  ctx.stroke();

  if (analysis.parallelLineY !== null) {
    const py = mapY(analysis.parallelLineY);
    ctx.strokeStyle = "rgba(110, 168, 255, 0.55)";
    ctx.beginPath();
    ctx.moveTo(w * 0.2, py);
    ctx.lineTo(w * 0.8, py);
    ctx.stroke();
    ctx.fillStyle = "#6EA8FF";
    ctx.font = "600 11px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText("PARALLEL", w * 0.21, py - 6);
  }
  ctx.restore();

  if (analysis.barPathPoints.length > 1) {
    ctx.save();
    ctx.beginPath();
    analysis.barPathPoints.forEach((pt, idx) => {
      const px = mapX(pt.x);
      const py = mapY(pt.y);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "rgba(123, 224, 173, 0.78)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  const lms = analysis.smoothedLandmarks;
  if (!lms.length) return;
  const faultSet = new Set(analysis.faultJoints);

  ctx.save();
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = lms[a];
    const lmB = lms[b];
    if (!lmA || !lmB) continue;
    if ((lmA.visibility ?? 1) < 0.35 || (lmB.visibility ?? 1) < 0.35) continue;

    const isFault = faultSet.has(a) || faultSet.has(b);
    ctx.strokeStyle = isFault ? "#FF6B35" : "#C9F73A";
    ctx.lineWidth = isFault ? 4.5 : 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mapX(lmA.x), mapY(lmA.y));
    ctx.lineTo(mapX(lmB.x), mapY(lmB.y));
    ctx.stroke();
  }

  const drawJoints = [
    POSE_IDX.NOSE,
    POSE_IDX.LEFT_SHOULDER,
    POSE_IDX.RIGHT_SHOULDER,
    POSE_IDX.LEFT_ELBOW,
    POSE_IDX.RIGHT_ELBOW,
    POSE_IDX.LEFT_WRIST,
    POSE_IDX.RIGHT_WRIST,
    POSE_IDX.LEFT_HIP,
    POSE_IDX.RIGHT_HIP,
    POSE_IDX.LEFT_KNEE,
    POSE_IDX.RIGHT_KNEE,
    POSE_IDX.LEFT_ANKLE,
    POSE_IDX.RIGHT_ANKLE,
  ];
  for (const idx of drawJoints) {
    const lm = lms[idx];
    if (!lm || (lm.visibility ?? 1) < 0.35) continue;
    const x = mapX(lm.x);
    const y = mapY(lm.y);
    const isFault = faultSet.has(idx);
    const isKey =
      idx === POSE_IDX.LEFT_HIP ||
      idx === POSE_IDX.RIGHT_HIP ||
      idx === POSE_IDX.LEFT_KNEE ||
      idx === POSE_IDX.RIGHT_KNEE;

    ctx.beginPath();
    ctx.arc(x, y, isKey ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0C0E12";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isFault ? "#FF6B35" : isKey ? "#C9F73A" : "#F2F3EE";
    ctx.stroke();
  }

  const anchorIdx =
    lift === "squat"
      ? POSE_IDX.LEFT_KNEE
      : lift === "deadlift"
        ? POSE_IDX.LEFT_HIP
        : POSE_IDX.LEFT_ELBOW;
  const anchor = lms[anchorIdx];
  if (anchor && (anchor.visibility ?? 1) >= 0.4) {
    const ax = mapX(anchor.x) + 12;
    const ay = mapY(anchor.y) - 10;
    const label = `${analysis.primaryAngleDeg}°`;
    ctx.fillStyle = "rgba(12, 14, 18, 0.85)";
    ctx.fillRect(ax - 4, ay - 13, 42, 18);
    ctx.strokeStyle = "rgba(201, 247, 58, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax - 4, ay - 13, 42, 18);
    ctx.fillStyle = "#F2F3EE";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(label, ax, ay);
  }

  ctx.restore();
}

export function FormCheckStudio() {
  const [lift, setLift] = useState<LiftKey>("squat");
  const [angle, setAngle] = useState<CameraAngle>("Side");
  const [mode, setMode] = useState<InputMode>("simulator");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState<"idle" | "tracking" | "done">("idle");
  const [modelState, setModelState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [liveFrame, setLiveFrame] = useState<FrameAnalysis | null>(null);
  const [fps, setFps] = useState(0);
  const [simProgress, setSimProgress] = useState(0);
  const [report, setReport] = useState<SetAnalysisReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedFormCheckItem[]>([]);
  const [activeWorkoutName, setActiveWorkoutName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerInstance | null>(null);
  const trackerRef = useRef<FormCheckTracker>(new FormCheckTracker("squat", "Side"));
  const rafRef = useRef<number | null>(null);
  const lastSpokenRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  const videoUrlRef = useRef<string | null>(null);

  const spec = LIFT_SPECS[lift];

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/form-check", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        activeWorkout?: { id: string; name: string } | null;
        sessions?: SavedFormCheckItem[];
      };
      setActiveWorkoutName(data.activeWorkout?.name ?? null);
      setHistory(data.sessions ?? []);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const speakCue = useCallback(
    (text: string | null) => {
      if (!voiceEnabled || !text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const now = Date.now();
      if (lastSpokenRef.current.text === text && now - lastSpokenRef.current.ts < 4000) return;
      if (now - lastSpokenRef.current.ts < 2500) return;
      lastSpokenRef.current = { text, ts: now };
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.05;
        utter.volume = 0.85;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [voiceEnabled],
  );

  const ensurePoseLandmarker = useCallback(async (): Promise<PoseLandmarkerInstance | null> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setModelState("loading");
    setModelError(null);
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      let instance: PoseLandmarkerInstance;
      try {
        instance = (await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })) as unknown as PoseLandmarkerInstance;
      } catch {
        instance = (await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })) as unknown as PoseLandmarkerInstance;
      }
      landmarkerRef.current = instance;
      setModelState("ready");
      return instance;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load on-device MediaPipe model.";
      setModelState("error");
      setModelError(msg);
      return null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
      videoRef.current.removeAttribute("src");
    }
  }, [stopLoop]);

  useEffect(() => {
    return () => {
      stopCameraStream();
      landmarkerRef.current?.close?.();
    };
  }, [stopCameraStream]);

  const startLiveVideoLoop = useCallback(
    (isMirrored: boolean, activeLift: LiftKey) => {
      stopLoop();
      let lastVideoTime = -1;
      let frameCount = 0;
      let fpsWindowStart = performance.now();

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const landmarker = landmarkerRef.current;

        if (!video || !canvas || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const now = performance.now();
        if (landmarker && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const res = landmarker.detectForVideo(video, now);
          const lms = res.landmarks?.[0];
          if (lms && lms.length >= 29) {
            const analysis = trackerRef.current.processFrame(lms, now);
            drawPoseOverlay(canvas, analysis, activeLift, isMirrored);
            setLiveFrame(analysis);
            if (analysis.activeCueSeverity === "fault") {
              speakCue(analysis.activeCue);
            }
          } else {
            const ctx2d = canvas.getContext("2d");
            ctx2d?.clearRect(0, 0, canvas.width, canvas.height);
          }

          frameCount++;
          if (now - fpsWindowStart >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - fpsWindowStart)));
            frameCount = 0;
            fpsWindowStart = now;
          }
        }

        if (video.ended) {
          const finalReport = trackerRef.current.finalizeSet();
          setReport(finalReport);
          setStatus("done");
          stopLoop();
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [speakCue, stopLoop],
  );

  async function enableCamera(targetFacing: "user" | "environment" = facingMode) {
    setCameraError(null);
    setReport(null);
    setSavedMsg(null);
    stopCameraStream();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API unavailable in this browser context. Use Video Upload or Interactive Simulator.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      setFacingMode(targetFacing);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const lm = await ensurePoseLandmarker();
      if (!lm) return;

      trackerRef.current.reset(lift, angle);
      setStatus("tracking");
      startLiveVideoLoop(targetFacing === "user", lift);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in browser settings, or upload a video clip."
          : "No accessible camera found on this device. You can upload a workout video or run the Interactive Simulator.";
      setCameraError(msg);
      setMode("simulator");
      setStatus("idle");
    }
  }

  async function handleVideoFileUpload(file: File | undefined) {
    if (!file) return;
    setCameraError(null);
    setReport(null);
    setSavedMsg(null);
    stopCameraStream();

    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setMode("video");

    const video = videoRef.current;
    if (video) {
      video.src = url;
      video.loop = false;
      await video.play();
    }

    const lm = await ensurePoseLandmarker();
    if (!lm) return;

    trackerRef.current.reset(lift, angle);
    setStatus("tracking");
    startLiveVideoLoop(false, lift);
  }

  function startSimulator() {
    stopCameraStream();
    setCameraError(null);
    setReport(null);
    setSavedMsg(null);
    setMode("simulator");
    trackerRef.current.reset(lift, angle);
    setSimProgress(0);
    setStatus("tracking");

    const totalReps = 4;
    const totalFrames = totalReps * 40;
    let frameIdx = 0;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 640;
      canvas.height = 400;
    }

    const simStart = performance.now();
    const tickSim = () => {
      if (frameIdx > totalFrames) {
        const finalReport = trackerRef.current.finalizeSet();
        setReport(finalReport);
        setStatus("done");
        return;
      }

      const repPhase = (frameIdx % 40) / 40;
      const lms = generateSimulatedPoseFrame(lift, repPhase);
      const analysis = trackerRef.current.processFrame(lms, simStart + frameIdx * 45);
      if (canvasRef.current) {
        drawPoseOverlay(canvasRef.current, analysis, lift, false);
      }
      setLiveFrame(analysis);
      setSimProgress(Math.round((frameIdx / totalFrames) * 100));
      setFps(30);
      frameIdx++;
      rafRef.current = requestAnimationFrame(tickSim);
    };

    rafRef.current = requestAnimationFrame(tickSim);
  }

  function finishSetNow() {
    stopLoop();
    const finalReport = trackerRef.current.finalizeSet();
    setReport(finalReport);
    setStatus("done");
    if (mode === "video" && videoRef.current) {
      videoRef.current.pause();
    }
  }

  function resetStudio() {
    stopLoop();
    trackerRef.current.reset(lift, angle);
    setLiveFrame(null);
    setReport(null);
    setSimProgress(0);
    setSavedMsg(null);
    setStatus("idle");
    if (canvasRef.current) {
      const ctx2d = canvasRef.current.getContext("2d");
      ctx2d?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  function switchLift(nextLift: LiftKey) {
    setLift(nextLift);
    resetStudio();
    if (mode === "camera" && streamRef.current) {
      trackerRef.current.reset(nextLift, angle);
      setStatus("tracking");
      startLiveVideoLoop(facingMode === "user", nextLift);
    }
  }

  function switchAngle(nextAngle: CameraAngle) {
    setAngle(nextAngle);
    trackerRef.current.reset(lift, nextAngle);
    setReport(null);
    if (mode === "camera" && streamRef.current) {
      setStatus("tracking");
      startLiveVideoLoop(facingMode === "user", lift);
    }
  }

  async function saveToSession(attachWorkout: boolean) {
    if (!report) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/form-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lift: report.lift,
          angle: report.angle,
          mode,
          reps: report.reps,
          score: report.score,
          verdict: report.verdict,
          metrics: report.metrics,
          issues: report.issues,
          repBreakdown: report.repBreakdown,
          attachToActiveWorkout: attachWorkout,
        }),
      });
      const data = (await res.json()) as { ok: boolean; attachedWorkoutName?: string; error?: string };
      if (!res.ok || !data.ok) {
        setSavedMsg(data.error || "Failed to save form check.");
        return;
      }
      setSavedMsg(
        data.attachedWorkoutName
          ? `Saved & attached to active workout "${data.attachedWorkoutName}".`
          : "Saved to Form Check history & AI Coach memory.",
      );
      await fetchHistory();
    } finally {
      setSaving(false);
    }
  }

  async function deleteHistoryItem(id: string) {
    const res = await fetch(`/api/form-check?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setHistory((prev) => prev.filter((item) => item.id !== id));
    }
  }

  const repsCount = status === "done" && report ? report.reps : liveFrame?.repsCompleted ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* MAIN STAGE */}
      <div className="xl:col-span-8 space-y-4">
        <div className="surface overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  status === "tracking"
                    ? "animate-pulse-dot bg-flame"
                    : status === "done"
                      ? "bg-acid"
                      : "bg-dim",
                )}
              />
              <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-mist">
                {modelState === "loading"
                  ? "Loading MediaPipe Pose AI…"
                  : status === "tracking"
                    ? mode === "camera"
                      ? "Live Camera · Tracking 33 Joints"
                      : mode === "video"
                        ? "Analyzing Video Clip"
                        : "Interactive Simulator"
                    : status === "done"
                      ? "Set Report Ready"
                      : "Select Camera, Video, or Simulator"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(LIFT_SPECS) as LiftKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchLift(key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors",
                    lift === key
                      ? "border-acid/40 bg-acid/12 text-acid"
                      : "border-white/[0.07] text-dim hover:text-mist",
                  )}
                >
                  {LIFT_SPECS[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#080A0C] sm:aspect-[16/10]">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "absolute inset-0 size-full object-cover",
                mode === "camera" && facingMode === "user" && "-scale-x-100",
                mode === "simulator" ? "hidden" : "block",
              )}
            />

            {mode === "simulator" && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(201,247,58,0.08),transparent_58%)]" />
                <div className="absolute inset-0 grid-lines opacity-[0.2]" />
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />

            <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                <Video className="size-2.5 text-acid" /> {angle} · {fps || 30} fps ·{" "}
                {mode === "camera" ? "Live Cam" : mode === "video" ? "Clip" : "Simulator"}
              </span>
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-mist backdrop-blur">
                <Gauge className="size-2.5 text-sky" />{" "}
                {liveFrame ? liveFrame.framingMessage : "On-device MediaPipe 33-landmark"}
              </span>
            </div>

            <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
              <span className="rounded-md border border-acid/25 bg-black/60 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-acid backdrop-blur">
                {repsCount} {repsCount === 1 ? "rep" : "reps"}
              </span>
              {liveFrame && status === "tracking" && (
                <span className="rounded-md border border-white/10 bg-black/60 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-chalk backdrop-blur">
                  {liveFrame.phase} · {liveFrame.primaryAngleDeg}° · Torso {liveFrame.torsoLeanDeg}°
                </span>
              )}
            </div>

            {status === "tracking" && liveFrame?.activeCue && (
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border px-3.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] backdrop-blur",
                  liveFrame.activeCueSeverity === "fault"
                    ? "border-flame/40 bg-flame/20 text-flame"
                    : liveFrame.activeCueSeverity === "warn"
                      ? "border-amber/40 bg-amber/20 text-amber"
                      : "border-mint/40 bg-mint/15 text-mint",
                )}
              >
                {liveFrame.activeCue}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0">
              <div className="flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10">
                <div>
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">
                    {spec.label} · Rep counter
                  </p>
                  <p className="font-numeric text-[24px] font-bold leading-none tracking-[-0.04em] text-chalk">
                    {repsCount}
                    <span className="ml-1.5 text-[10px] font-normal text-dim">
                      {status === "tracking" ? "live" : "completed"}
                    </span>
                  </p>
                </div>
                <div className="min-w-[140px] flex-1 sm:max-w-[240px]">
                  {status === "done" ? (
                    <div className="flex items-center justify-end gap-1.5 rounded-full border border-acid/25 bg-acid/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid">
                      <CheckCircle2 className="size-2.5" /> Biomechanical report ready
                    </div>
                  ) : mode === "simulator" && status === "tracking" ? (
                    <ProgressBar value={simProgress} color="#C9F73A" height={4} />
                  ) : (
                    <p className="text-right font-mono text-[8px] uppercase tracking-[0.1em] text-mist">
                      {spec.setupTip}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button size="md" onClick={() => void enableCamera(facingMode)}>
                      <Camera className="size-4" /> Open Live Camera
                    </Button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-chalk transition hover:border-acid/40 hover:text-acid">
                      <Upload className="size-3.5" /> Upload Video
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => void handleVideoFileUpload(e.target.files?.[0])}
                      />
                    </label>
                    <Button variant="secondary" size="md" onClick={startSimulator}>
                      <Play className="size-3.5" /> Run Simulator
                    </Button>
                  </div>
                  <p className="max-w-md text-[11px] text-mist">
                    {spec.setupTip} Video stays 100% on-device.
                  </p>
                </div>
              </div>
            )}

            {modelState === "loading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 rounded-full border border-acid/30 bg-[#101216] px-4 py-2 text-xs text-acid">
                  <Loader2 className="size-4 animate-spin" /> Initializing on-device MediaPipe Pose AI…
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <IconButton
                onClick={() => {
                  if (mode === "camera" && streamRef.current) {
                    stopCameraStream();
                    setMode("simulator");
                    resetStudio();
                  } else {
                    void enableCamera(facingMode);
                  }
                }}
                aria-label={mode === "camera" ? "Stop camera" : "Open camera"}
              >
                {mode === "camera" && streamRef.current ? (
                  <CameraOff className="size-4" />
                ) : (
                  <Camera className="size-4" />
                )}
              </IconButton>

              {mode === "camera" && streamRef.current && (
                <IconButton
                  onClick={() => void enableCamera(facingMode === "user" ? "environment" : "user")}
                  aria-label="Flip camera"
                >
                  <FlipHorizontal2 className="size-4" />
                </IconButton>
              )}

              <IconButton
                onClick={() => setVoiceEnabled((v) => !v)}
                aria-label={voiceEnabled ? "Mute voice cues" : "Enable voice cues"}
              >
                {voiceEnabled ? <Volume2 className="size-4 text-acid" /> : <VolumeX className="size-4" />}
              </IconButton>

              <div className="flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5">
                {ANGLES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => switchAngle(a)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors",
                      angle === a ? "bg-white/10 text-chalk" : "text-dim hover:text-mist",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status !== "idle" && (
                <Button variant="ghost" size="sm" onClick={resetStudio}>
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
              )}
              {status === "tracking" ? (
                <Button size="sm" onClick={finishSetNow}>
                  <Square className="size-3 fill-current" /> Finish & Score Set
                </Button>
              ) : (
                <Button size="sm" onClick={() => (mode === "camera" ? void enableCamera(facingMode) : startSimulator())}>
                  <Play className="size-3.5" /> {status === "done" ? "Analyze Another" : "Start Analysis"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {(cameraError || modelError) && (
          <div className="flex items-center gap-2 rounded-xl border border-amber/25 bg-amber/[0.06] px-3.5 py-2.5 text-xs text-amber">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{cameraError ?? modelError}</span>
          </div>
        )}

        {status === "done" && report && (
          <div className="animate-fade-up space-y-4">
            <div className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative grid size-[74px] place-items-center">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke={report.score >= 85 ? "#C9F73A" : report.score >= 70 ? "#FFD166" : "#FF6B35"}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={`${(report.score / 100) * 213.6} 213.6`}
                      />
                    </svg>
                    <div className="text-center">
                      <p className="font-numeric text-[22px] font-bold leading-none tracking-[-0.05em] text-chalk">
                        {report.score}
                      </p>
                      <p className="font-mono text-[6.5px] uppercase tracking-[0.12em] text-dim">score</p>
                    </div>
                  </div>
                  <div>
                    <p className="label-mono mb-1">
                      {LIFT_SPECS[report.lift].label} · {report.angle} view · {mode}
                    </p>
                    <h3 className="max-w-md font-display text-[19px] font-bold leading-[1.12] tracking-[-0.03em] text-chalk">
                      {report.verdict}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist">
                        {report.reps} reps tracked
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist">
                        {report.issues.length} cues
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  size="md"
                  disabled={saving}
                  onClick={() => void saveToSession(Boolean(activeWorkoutName))}
                >
                  {saving ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
                  ) : activeWorkoutName ? (
                    <><Sparkles className="size-3.5" /> Attach to {activeWorkoutName}</>
                  ) : (
                    <><Check className="size-3.5" /> Save Form Check</>
                  )}
                </Button>
              </div>

              {savedMsg && (
                <p className="mt-3 rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-xs text-mint">
                  {savedMsg}
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {report.metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">{m.label}</p>
                    <p className={cn("mt-1 font-numeric text-[15px] font-semibold", m.ok ? "text-chalk" : "text-flame")}>
                      {m.value}
                    </p>
                    <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-dim">{m.target}</p>
                  </div>
                ))}
              </div>

              {report.repBreakdown.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">
                    Rep-by-Rep Telemetry
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {report.repBreakdown.map((rep) => (
                      <div key={rep.repNumber} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-semibold text-chalk">Rep {rep.repNumber}</span>
                          <span className={cn("font-mono text-[9px] font-bold", rep.formScore >= 85 ? "text-acid" : "text-amber")}>
                            {rep.formScore}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[8px] text-mist">
                          Min {rep.minAngleDeg}° · Drift {rep.barDriftCm}cm
                        </p>
                        <p className="font-mono text-[7.5px] text-dim">
                          {(rep.eccentricMs / 1000).toFixed(1)}s ↓ / {(rep.concentricMs / 1000).toFixed(1)}s ↑
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.wins.length > 0 && (
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                  <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.12em] text-dim">What worked</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.wins.map((w) => (
                      <span key={w} className="flex items-center gap-1 rounded-full border border-mint/20 bg-mint/[0.06] px-2.5 py-1 text-[9.5px] text-mint">
                        <Check className="size-2.5" /> {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {report.issues.length > 0 && (
              <div className="surface rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-mono mb-1">Biomechanical Fix List</p>
                    <h3 className="font-display text-[18px] font-bold tracking-[-0.03em] text-chalk">
                      Priority Cues Detected
                    </h3>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Timestamped</span>
                </div>
                <div className="mt-3 space-y-2">
                  {report.issues.map((issue, i) => (
                    <div key={`${issue.title}-${i}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg font-numeric text-[11px] font-bold",
                            issue.severity === "high"
                              ? "bg-flame/10 text-flame"
                              : "bg-amber/10 text-amber",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12px] font-semibold text-chalk">{issue.title}</p>
                            <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">@ {issue.at}</span>
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
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-4 text-acid" />
                <h3 className="font-display text-base font-bold text-chalk">Recent Form Checks</h3>
              </div>
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
                Saved to SQLite
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {history.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-chalk">
                        {LIFT_SPECS[item.lift]?.label ?? item.lift}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[8px] uppercase text-mist">
                        {item.reps} reps · {item.mode}
                      </span>
                      <span className="font-mono text-[8px] text-dim" suppressHydrationWarning>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-mist">{item.verdict}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={cn("font-numeric text-base font-bold", item.score >= 85 ? "text-acid" : "text-amber")}>
                      {item.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteHistoryItem(item.id)}
                      aria-label="Delete form check"
                      className="text-dim hover:text-flame"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT RAIL */}
      <div className="space-y-4 xl:col-span-4">
        <div className="surface rounded-2xl p-5">
          <p className="label-mono mb-1.5">Live Biomechanics</p>
          <h3 className="font-display text-[19px] font-bold tracking-[-0.03em] text-chalk">
            Real 33-Joint Computer Vision
          </h3>
          <div className="mt-4 space-y-3">
            {[
              { n: "01", title: "Open Camera or Upload Clip", body: "Runs MediaPipe PoseLandmarker locally via WebGL/WASM at ~30fps." },
              { n: "02", title: "Real Joint Angle Tracking", body: "Measures knee flexion, hip hinge, torso lean, knee valgus & bar drift in cm." },
              { n: "03", title: "Save & Sync to Coach", body: "Attach sets to your active workout and feed top cues into Coach memory." },
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
              <p className="label-mono mb-1.5">Scoring Rubric</p>
              <h3 className="font-display text-[17px] font-bold tracking-[-0.03em] text-chalk">
                {report ? `Live Score: ${report.score}/100` : "Measured Breakdown"}
              </h3>
            </div>
            <Activity className="size-4 text-sky" />
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { label: "Range & Depth (35%)", value: report?.rubric.range ?? 0 },
              { label: "Bar / Joint Path (25%)", value: report?.rubric.path ?? 0 },
              { label: "Tempo Control (20%)", value: report?.rubric.tempo ?? 0 },
              { label: "Symmetry & Alignment (20%)", value: report?.rubric.symmetry ?? 0 },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] text-mist">{row.label}</span>
                  <span className="font-numeric text-[9.5px] text-dim">{report ? row.value : "—"}</span>
                </div>
                <ProgressBar value={row.value} color={row.value >= 85 ? "#C9F73A" : "#FFD166"} height={3} />
              </div>
            ))}
          </div>
        </div>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-mint" />
            <p className="text-[11.5px] font-semibold text-chalk">100% On-Device Privacy</p>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-dim">
            MediaPipe WASM + model weights run directly inside your browser. Video frames never leave your device — only numeric scores and cues are saved.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
            <Timer className="size-3 text-sky" />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
              Bundled local WASM · zero external upload
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(140deg,rgba(201,247,58,0.07),rgba(255,107,53,0.05))] p-5">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-acid" />
            <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">Framing Tip</p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mist">
            {spec.setupTip}
          </p>
        </div>
      </div>
    </div>
  );
}
