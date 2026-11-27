/**
 * On-Device Biomechanical Pose Analysis Engine
 * Works with real 33-landmark MediaPipe Pose frames (0..1 normalized coordinates)
 * and synthetic simulator frames through the exact same state machine.
 */

export type LiftKey = "squat" | "deadlift" | "bench" | "ohp" | "pushup" | "row";
export type CameraAngle = "Side" | "Front";
export type RepPhase = "ready" | "descending" | "bottom" | "ascending";

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export const POSE_IDX = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT: 31,
  RIGHT_FOOT: 32,
} as const;

export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [POSE_IDX.LEFT_SHOULDER, POSE_IDX.RIGHT_SHOULDER],
  [POSE_IDX.LEFT_SHOULDER, POSE_IDX.LEFT_ELBOW],
  [POSE_IDX.LEFT_ELBOW, POSE_IDX.LEFT_WRIST],
  [POSE_IDX.RIGHT_SHOULDER, POSE_IDX.RIGHT_ELBOW],
  [POSE_IDX.RIGHT_ELBOW, POSE_IDX.RIGHT_WRIST],
  [POSE_IDX.LEFT_SHOULDER, POSE_IDX.LEFT_HIP],
  [POSE_IDX.RIGHT_SHOULDER, POSE_IDX.RIGHT_HIP],
  [POSE_IDX.LEFT_HIP, POSE_IDX.RIGHT_HIP],
  [POSE_IDX.LEFT_HIP, POSE_IDX.LEFT_KNEE],
  [POSE_IDX.LEFT_KNEE, POSE_IDX.LEFT_ANKLE],
  [POSE_IDX.RIGHT_HIP, POSE_IDX.RIGHT_KNEE],
  [POSE_IDX.RIGHT_KNEE, POSE_IDX.RIGHT_ANKLE],
  [POSE_IDX.LEFT_ANKLE, POSE_IDX.LEFT_FOOT],
  [POSE_IDX.RIGHT_ANKLE, POSE_IDX.RIGHT_FOOT],
];

export interface LiftSpec {
  key: LiftKey;
  label: string;
  short: string;
  setupTip: string;
  primaryJointLabel: string;
  targetRomLabel: string;
}

export const LIFT_SPECS: Record<LiftKey, LiftSpec> = {
  squat: {
    key: "squat",
    label: "Back Squat",
    short: "SQ",
    setupTip: "Place camera hip-height, 2–3m away (Side for depth & bar path, Front for knee valgus).",
    primaryJointLabel: "Knee flexion",
    targetRomLabel: "Hip crease <= knee",
  },
  deadlift: {
    key: "deadlift",
    label: "Deadlift",
    short: "DL",
    setupTip: "Side-on 45° or 90° at hip height so shins, hips, and shoulders stay in frame.",
    primaryJointLabel: "Hip hinge",
    targetRomLabel: "Full hip lockout",
  },
  bench: {
    key: "bench",
    label: "Bench Press",
    short: "BP",
    setupTip: "Side-on at bench height to track bar path, or head/foot angle for elbow symmetry.",
    primaryJointLabel: "Elbow flexion",
    targetRomLabel: "90° bottom -> lockout",
  },
  ohp: {
    key: "ohp",
    label: "Overhead Press",
    short: "OHP",
    setupTip: "Side-on full body so bar stack over midfoot and torso lean are visible.",
    primaryJointLabel: "Elbow lockout",
    targetRomLabel: "Stacked over shoulders",
  },
  pushup: {
    key: "pushup",
    label: "Push-Up",
    short: "PU",
    setupTip: "Side-on at floor level, 2m away, keeping shoulders, hips, and ankles in frame.",
    primaryJointLabel: "Elbow + plank",
    targetRomLabel: "Chest low, rigid plank",
  },
  row: {
    key: "row",
    label: "Bent-Over Row",
    short: "ROW",
    setupTip: "Side-on at hip height to monitor back angle stability and elbow pull height.",
    primaryJointLabel: "Elbow pull",
    targetRomLabel: "Minimal torso swing",
  },
};

export function calculateAngleDeg(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag1 = Math.hypot(abx, aby);
  const mag2 = Math.hypot(cbx, cby);
  if (mag1 < 1e-6 || mag2 < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

export function calculateTorsoLeanDeg(shoulder: PoseLandmark, hip: PoseLandmark): number {
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.max(1e-5, Math.abs(hip.y - shoulder.y));
  return Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
}

export function calculateKneeValgusDeg(
  hip: PoseLandmark,
  knee: PoseLandmark,
  ankle: PoseLandmark,
  side: "left" | "right",
): number {
  const expectedX = (hip.x + ankle.x) / 2;
  const rawDx = knee.x - expectedX;
  const inwardDx = side === "left" ? Math.max(0, rawDx) : Math.max(0, -rawDx);
  const legLen = Math.max(0.05, Math.hypot(hip.x - ankle.x, hip.y - ankle.y));
  const deg = Math.round((Math.atan2(inwardDx, legLen * 0.5) * 180) / Math.PI);
  return Math.min(35, Math.max(0, deg));
}

export function smoothLandmarks(
  prev: PoseLandmark[] | null,
  next: PoseLandmark[],
  alpha = 0.45,
): PoseLandmark[] {
  if (!prev || prev.length !== next.length) {
    return next.map((lm) => ({ ...lm }));
  }
  return next.map((lm, i) => ({
    x: prev[i].x * (1 - alpha) + lm.x * alpha,
    y: prev[i].y * (1 - alpha) + lm.y * alpha,
    z: lm.z !== undefined && prev[i].z !== undefined ? prev[i].z! * (1 - alpha) + lm.z * alpha : lm.z,
    visibility: lm.visibility,
  }));
}

export function chooseBestSide(landmarks: PoseLandmark[]): "left" | "right" {
  const leftVis =
    ((landmarks[POSE_IDX.LEFT_SHOULDER]?.visibility ?? 1) +
      (landmarks[POSE_IDX.LEFT_HIP]?.visibility ?? 1) +
      (landmarks[POSE_IDX.LEFT_KNEE]?.visibility ?? 1) +
      (landmarks[POSE_IDX.LEFT_ANKLE]?.visibility ?? 1)) /
    4;
  const rightVis =
    ((landmarks[POSE_IDX.RIGHT_SHOULDER]?.visibility ?? 1) +
      (landmarks[POSE_IDX.RIGHT_HIP]?.visibility ?? 1) +
      (landmarks[POSE_IDX.RIGHT_KNEE]?.visibility ?? 1) +
      (landmarks[POSE_IDX.RIGHT_ANKLE]?.visibility ?? 1)) /
    4;
  return leftVis >= rightVis ? "left" : "right";
}

export interface RepRecord {
  repNumber: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  peakTorsoLeanDeg: number;
  valgusDeg: number;
  barDriftCm: number;
  eccentricMs: number;
  concentricMs: number;
  depthOk: boolean;
  formScore: number;
  cues: string[];
  timestampMs: number;
}

export interface FormMetric {
  label: string;
  value: string;
  target: string;
  ok: boolean;
}

export interface FormIssue {
  title: string;
  cue: string;
  severity: "high" | "medium" | "low";
  at: string;
}

export interface SetAnalysisReport {
  lift: LiftKey;
  angle: CameraAngle;
  reps: number;
  score: number;
  rubric: {
    range: number;
    path: number;
    tempo: number;
    symmetry: number;
  };
  verdict: string;
  metrics: FormMetric[];
  issues: FormIssue[];
  wins: string[];
  repBreakdown: RepRecord[];
}

export interface FrameAnalysis {
  smoothedLandmarks: PoseLandmark[];
  bodyVisible: boolean;
  confidencePct: number;
  framingMessage: string;
  phase: RepPhase;
  primaryAngleDeg: number;
  torsoLeanDeg: number;
  repsCompleted: number;
  activeCue: string | null;
  activeCueSeverity: "ok" | "warn" | "fault";
  barPathPoints: Array<{ x: number; y: number }>;
  parallelLineY: number | null;
  midfootX: number;
  faultJoints: number[];
}

function formatTs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export class FormCheckTracker {
  private lift: LiftKey;
  private angle: CameraAngle;
  private prevSmoothed: PoseLandmark[] | null = null;
  private phase: RepPhase = "ready";
  private startMs: number | null = null;
  private phaseEnteredMs = 0;
  private minAngleInRep = 180;
  private maxAngleInRep = 0;
  private peakTorsoInRep = 0;
  private peakValgusInRep = 0;
  private minPlankInRep = 180;
  private repWristXs: number[] = [];
  private eccentricStartMs = 0;
  private bottomStartMs = 0;
  private concentricStartMs = 0;
  private barPathPoints: Array<{ x: number; y: number }> = [];
  private reps: RepRecord[] = [];
  private lastCue: string | null = null;
  private lastCueSeverity: "ok" | "warn" | "fault" = "ok";

  constructor(lift: LiftKey, angle: CameraAngle = "Side") {
    this.lift = lift;
    this.angle = angle;
  }

  reset(lift?: LiftKey, angle?: CameraAngle) {
    if (lift) this.lift = lift;
    if (angle) this.angle = angle;
    this.prevSmoothed = null;
    this.phase = "ready";
    this.startMs = null;
    this.phaseEnteredMs = 0;
    this.minAngleInRep = 180;
    this.maxAngleInRep = 0;
    this.peakTorsoInRep = 0;
    this.peakValgusInRep = 0;
    this.minPlankInRep = 180;
    this.repWristXs = [];
    this.barPathPoints = [];
    this.reps = [];
    this.lastCue = null;
    this.lastCueSeverity = "ok";
  }

  getReps(): RepRecord[] {
    return this.reps;
  }

  processFrame(rawLandmarks: PoseLandmark[], timestampMs: number): FrameAnalysis {
    if (this.startMs === null) {
      this.startMs = timestampMs;
      this.phaseEnteredMs = timestampMs;
    }

    const lms = smoothLandmarks(this.prevSmoothed, rawLandmarks, 0.45);
    this.prevSmoothed = lms;

    const side = chooseBestSide(lms);
    const sIdx = side === "left" ? POSE_IDX.LEFT_SHOULDER : POSE_IDX.RIGHT_SHOULDER;
    const eIdx = side === "left" ? POSE_IDX.LEFT_ELBOW : POSE_IDX.RIGHT_ELBOW;
    const wIdx = side === "left" ? POSE_IDX.LEFT_WRIST : POSE_IDX.RIGHT_WRIST;
    const hIdx = side === "left" ? POSE_IDX.LEFT_HIP : POSE_IDX.RIGHT_HIP;
    const kIdx = side === "left" ? POSE_IDX.LEFT_KNEE : POSE_IDX.RIGHT_KNEE;
    const aIdx = side === "left" ? POSE_IDX.LEFT_ANKLE : POSE_IDX.RIGHT_ANKLE;

    const shoulder = lms[sIdx];
    const elbow = lms[eIdx];
    const wrist = lms[wIdx];
    const hip = lms[hIdx];
    const knee = lms[kIdx];
    const ankle = lms[aIdx];

    const keyJoints = [shoulder, elbow, wrist, hip, knee, ankle].filter(Boolean);
    const avgVis =
      keyJoints.length > 0
        ? keyJoints.reduce((acc, j) => acc + (j.visibility ?? 0.95), 0) / keyJoints.length
        : 0;
    const confidencePct = Math.round(Math.min(99, Math.max(0, avgVis * 100)));

    const upperBodyOnly = this.lift === "bench";
    const required = upperBodyOnly ? [shoulder, elbow, wrist] : [shoulder, hip, knee, ankle];
    const bodyVisible = required.every((j) => j && (j.visibility ?? 0.95) >= 0.4);

    if (!bodyVisible || lms.length < 29) {
      return {
        smoothedLandmarks: lms,
        bodyVisible: false,
        confidencePct,
        framingMessage: upperBodyOnly
          ? "Position camera so shoulders, elbows & wrists are clearly visible."
          : "Step back slightly — keep shoulders, hips, knees & ankles in frame.",
        phase: this.phase,
        primaryAngleDeg: 180,
        torsoLeanDeg: 0,
        repsCompleted: this.reps.length,
        activeCue: "Frame full body to start rep tracking",
        activeCueSeverity: "warn",
        barPathPoints: this.barPathPoints,
        parallelLineY: null,
        midfootX: ankle?.x ?? 0.5,
        faultJoints: [],
      };
    }

    const kneeDeg = calculateAngleDeg(hip, knee, ankle);
    const hipDeg = calculateAngleDeg(shoulder, hip, knee);
    const elbowDeg = calculateAngleDeg(shoulder, elbow, wrist);
    const torsoLeanDeg = calculateTorsoLeanDeg(shoulder, hip);
    const plankDeg = calculateAngleDeg(shoulder, hip, ankle);

    const valgusLeft = calculateKneeValgusDeg(
      lms[POSE_IDX.LEFT_HIP],
      lms[POSE_IDX.LEFT_KNEE],
      lms[POSE_IDX.LEFT_ANKLE],
      "left",
    );
    const valgusRight = calculateKneeValgusDeg(
      lms[POSE_IDX.RIGHT_HIP],
      lms[POSE_IDX.RIGHT_KNEE],
      lms[POSE_IDX.RIGHT_ANKLE],
      "right",
    );
    const valgusDeg = this.angle === "Front" ? Math.max(valgusLeft, valgusRight) : Math.round((valgusLeft + valgusRight) / 4);

    // Primary tracking metric per lift
    const primaryAngleDeg =
      this.lift === "squat"
        ? kneeDeg
        : this.lift === "deadlift"
          ? hipDeg
          : elbowDeg;

    // Bar/wrist position for path tracing
    const barPt =
      this.lift === "squat"
        ? { x: shoulder.x, y: shoulder.y }
        : { x: wrist.x, y: wrist.y };
    this.barPathPoints.push(barPt);
    if (this.barPathPoints.length > 90) this.barPathPoints.shift();

    // Estimate cm drift using shoulder-to-hip torso length (~50cm) as scale reference
    const torsoPx = Math.max(0.12, Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y));
    const pxToCm = 50 / torsoPx;

    const faultJoints: number[] = [];
    let liveCue: string | null = this.lastCue;
    let liveSeverity: "ok" | "warn" | "fault" = this.lastCueSeverity;

    // Live fault checks
    if (this.lift === "squat") {
      if (valgusDeg > 10 && this.angle === "Front") {
        faultJoints.push(POSE_IDX.LEFT_KNEE, POSE_IDX.RIGHT_KNEE);
        liveCue = "Knees tracking inward — push knees out over pinkies";
        liveSeverity = "fault";
      } else if (torsoLeanDeg > 48) {
        faultJoints.push(sIdx, hIdx);
        liveCue = "Excessive forward lean — keep chest proud over midfoot";
        liveSeverity = "warn";
      } else if (hip.y >= knee.y - 0.015 && this.phase !== "ready") {
        liveCue = "Competition depth hit — drive up through midfoot";
        liveSeverity = "ok";
      }
    } else if (this.lift === "pushup" && plankDeg < 158) {
      faultJoints.push(hIdx);
      liveCue = "Hips sagging — squeeze glutes & brace ribs to pelvis";
      liveSeverity = "fault";
    } else if (this.lift === "ohp" && torsoLeanDeg > 18) {
      faultJoints.push(hIdx);
      liveCue = "Ribs flaring — squeeze glutes and stack bar over midfoot";
      liveSeverity = "warn";
    }

    // Rep state machine with lift-specific thresholds
    // Note: "inverted" lifts (OHP/Row) start extended/hanging and peak at lockout or top pull
    if (this.lift === "deadlift") {
      // Deadlift starts at bottom (hipDeg < 120), ascends to lockout (> 164), returns down
      if (this.phase === "ready" && primaryAngleDeg < 128) {
        this.phase = "ascending";
        this.concentricStartMs = timestampMs;
        this.maxAngleInRep = primaryAngleDeg;
        this.minAngleInRep = primaryAngleDeg;
        this.peakTorsoInRep = torsoLeanDeg;
        this.repWristXs = [barPt.x];
      } else if (this.phase === "ascending") {
        this.maxAngleInRep = Math.max(this.maxAngleInRep, primaryAngleDeg);
        this.peakTorsoInRep = Math.max(this.peakTorsoInRep, torsoLeanDeg);
        this.repWristXs.push(barPt.x);
        if (primaryAngleDeg >= 164) {
          this.phase = "bottom"; // lockout reached
          this.bottomStartMs = timestampMs;
          liveCue = "Clean lockout — control the descent";
          liveSeverity = "ok";
        }
      } else if (this.phase === "bottom") {
        if (primaryAngleDeg < 150) {
          this.phase = "descending";
          this.eccentricStartMs = timestampMs;
        }
      } else if (this.phase === "descending") {
        this.minAngleInRep = Math.min(this.minAngleInRep, primaryAngleDeg);
        this.repWristXs.push(barPt.x);
        if (primaryAngleDeg <= 125 || timestampMs - this.eccentricStartMs > 2500) {
          this.commitRep(timestampMs, pxToCm, true);
          this.phase = "ready";
        }
      }
    } else if (this.lift === "ohp") {
      // OHP starts at rack (elbow < 105), presses overhead (> 162), lowers back
      if (this.phase === "ready" && primaryAngleDeg < 110) {
        this.phase = "ascending";
        this.concentricStartMs = timestampMs;
        this.maxAngleInRep = primaryAngleDeg;
        this.minAngleInRep = primaryAngleDeg;
        this.peakTorsoInRep = torsoLeanDeg;
        this.repWristXs = [barPt.x];
      } else if (this.phase === "ascending") {
        this.maxAngleInRep = Math.max(this.maxAngleInRep, primaryAngleDeg);
        this.peakTorsoInRep = Math.max(this.peakTorsoInRep, torsoLeanDeg);
        this.repWristXs.push(barPt.x);
        if (primaryAngleDeg >= 162) {
          this.phase = "bottom";
          liveCue = "Full overhead lockout — lower under control";
          liveSeverity = "ok";
        }
      } else if (this.phase === "bottom" && primaryAngleDeg < 145) {
        this.phase = "descending";
        this.eccentricStartMs = timestampMs;
      } else if (this.phase === "descending" && primaryAngleDeg <= 105) {
        this.commitRep(timestampMs, pxToCm, this.maxAngleInRep >= 162);
        this.phase = "ready";
      }
    } else if (this.lift === "row") {
      // Row starts with arms extended (> 150), pulls to chest (< 98), lowers back
      if (this.phase === "ready" && primaryAngleDeg < 142) {
        this.phase = "ascending";
        this.concentricStartMs = timestampMs;
        this.minAngleInRep = primaryAngleDeg;
        this.maxAngleInRep = primaryAngleDeg;
        this.peakTorsoInRep = torsoLeanDeg;
        this.repWristXs = [barPt.x];
      } else if (this.phase === "ascending") {
        this.minAngleInRep = Math.min(this.minAngleInRep, primaryAngleDeg);
        this.peakTorsoInRep = Math.max(this.peakTorsoInRep, torsoLeanDeg);
        this.repWristXs.push(barPt.x);
        if (primaryAngleDeg <= 100) {
          this.phase = "bottom";
          liveCue = "Peak squeeze at torso — control lowering";
          liveSeverity = "ok";
        }
      } else if (this.phase === "bottom" && primaryAngleDeg > 115) {
        this.phase = "descending";
        this.eccentricStartMs = timestampMs;
      } else if (this.phase === "descending" && primaryAngleDeg >= 148) {
        this.commitRep(timestampMs, pxToCm, this.minAngleInRep <= 102);
        this.phase = "ready";
      }
    } else {
      // Squat, Bench, Push-Up: start extended (> 152), descend to bottom (< 105), ascend back (> 152)
      if (this.phase === "ready" && primaryAngleDeg < 148) {
        this.phase = "descending";
        this.eccentricStartMs = timestampMs;
        this.minAngleInRep = primaryAngleDeg;
        this.maxAngleInRep = primaryAngleDeg;
        this.peakTorsoInRep = torsoLeanDeg;
        this.peakValgusInRep = valgusDeg;
        this.minPlankInRep = plankDeg;
        this.repWristXs = [barPt.x];
      } else if (this.phase === "descending") {
        this.minAngleInRep = Math.min(this.minAngleInRep, primaryAngleDeg);
        this.peakTorsoInRep = Math.max(this.peakTorsoInRep, torsoLeanDeg);
        this.peakValgusInRep = Math.max(this.peakValgusInRep, valgusDeg);
        this.minPlankInRep = Math.min(this.minPlankInRep, plankDeg);
        this.repWristXs.push(barPt.x);

        if (primaryAngleDeg <= 112) {
          this.phase = "bottom";
          this.bottomStartMs = timestampMs;
        }
      } else if (this.phase === "bottom") {
        this.minAngleInRep = Math.min(this.minAngleInRep, primaryAngleDeg);
        this.peakTorsoInRep = Math.max(this.peakTorsoInRep, torsoLeanDeg);
        this.peakValgusInRep = Math.max(this.peakValgusInRep, valgusDeg);
        this.minPlankInRep = Math.min(this.minPlankInRep, plankDeg);
        this.repWristXs.push(barPt.x);

        if (primaryAngleDeg > this.minAngleInRep + 10) {
          this.phase = "ascending";
          this.concentricStartMs = timestampMs;
        }
      } else if (this.phase === "ascending") {
        this.maxAngleInRep = Math.max(this.maxAngleInRep, primaryAngleDeg);
        this.peakValgusInRep = Math.max(this.peakValgusInRep, valgusDeg);
        this.minPlankInRep = Math.min(this.minPlankInRep, plankDeg);
        this.repWristXs.push(barPt.x);

        if (primaryAngleDeg >= 152) {
          const depthOk =
            this.lift === "squat"
              ? this.minAngleInRep <= 102 || hip.y >= knee.y - 0.02
              : this.minAngleInRep <= 100;
          this.commitRep(timestampMs, pxToCm, depthOk);
          this.phase = "ready";
        }
      }
    }

    this.lastCue = liveCue;
    this.lastCueSeverity = liveSeverity;

    return {
      smoothedLandmarks: lms,
      bodyVisible: true,
      confidencePct,
      framingMessage: `Full body locked · ${confidencePct}% confidence`,
      phase: this.phase,
      primaryAngleDeg,
      torsoLeanDeg,
      repsCompleted: this.reps.length,
      activeCue: liveCue,
      activeCueSeverity: liveSeverity,
      barPathPoints: [...this.barPathPoints],
      parallelLineY: this.lift === "squat" ? knee.y : null,
      midfootX: ankle.x,
      faultJoints,
    };
  }

  private commitRep(timestampMs: number, pxToCm: number, depthOk: boolean) {
    const minX = this.repWristXs.length ? Math.min(...this.repWristXs) : 0;
    const maxX = this.repWristXs.length ? Math.max(...this.repWristXs) : 0;
    const barDriftCm = Math.round((maxX - minX) * pxToCm * 10) / 10;

    const eccentricMs = Math.max(400, (this.bottomStartMs || timestampMs) - (this.eccentricStartMs || timestampMs - 1000));
    const concentricMs = Math.max(350, timestampMs - (this.concentricStartMs || timestampMs - 800));

    let score = 96;
    const cues: string[] = [];

    if (!depthOk) {
      score -= 14;
      cues.push(
        this.lift === "squat"
          ? "Shallow rep — descend until hip crease meets knee level."
          : "Shortened range of motion — hit full bottom/lockout position.",
      );
    }
    if (this.lift === "squat" && this.peakValgusInRep > 9) {
      score -= 10;
      cues.push("Knee valgus detected — cue 'knees out over pinkies' on ascent.");
    }
    if (this.lift === "squat" && this.peakTorsoInRep > 46) {
      score -= 6;
      cues.push("Torso pitched forward — keep ribs stacked over pelvis.");
    }
    if (this.lift === "pushup" && this.minPlankInRep < 158) {
      score -= 12;
      cues.push("Hip sag in plank — squeeze glutes and brace abs.");
    }
    if (barDriftCm > 4.5) {
      score -= 7;
      cues.push(`Bar path drifted ${barDriftCm}cm horizontally — keep weight over midfoot.`);
    }
    if (eccentricMs < 750) {
      score -= 5;
      cues.push("Rushed eccentric — aim for a controlled 1.5–2s lowering phase.");
    }

    const clampedScore = Math.max(52, Math.min(99, Math.round(score)));
    this.reps.push({
      repNumber: this.reps.length + 1,
      minAngleDeg: this.minAngleInRep,
      maxAngleDeg: this.maxAngleInRep,
      peakTorsoLeanDeg: this.peakTorsoInRep,
      valgusDeg: this.peakValgusInRep,
      barDriftCm,
      eccentricMs,
      concentricMs,
      depthOk,
      formScore: clampedScore,
      cues,
      timestampMs: timestampMs - (this.startMs ?? timestampMs),
    });
  }

  finalizeSet(): SetAnalysisReport {
    const count = this.reps.length;
    if (count === 0) {
      return {
        lift: this.lift,
        angle: this.angle,
        reps: 0,
        score: 0,
        rubric: { range: 0, path: 0, tempo: 0, symmetry: 0 },
        verdict: "No full reps detected yet. Perform at least 1 complete rep in frame.",
        metrics: [
          { label: "Reps tracked", value: "0", target: ">= 1 rep", ok: false },
          { label: "View", value: this.angle, target: "Side / Front", ok: true },
        ],
        issues: [
          {
            title: "No complete repetition captured",
            cue: "Ensure your full body stays inside the frame through both the lowering and lifting phases.",
            severity: "medium",
            at: "0:00",
          },
        ],
        wins: [],
        repBreakdown: [],
      };
    }

    const depthRate = Math.round((this.reps.filter((r) => r.depthOk).length / count) * 100);
    const avgDrift = Math.round((this.reps.reduce((s, r) => s + r.barDriftCm, 0) / count) * 10) / 10;
    const avgTorso = Math.round(this.reps.reduce((s, r) => s + r.peakTorsoLeanDeg, 0) / count);
    const maxValgus = Math.max(...this.reps.map((r) => r.valgusDeg));
    const avgEccSec = Math.round((this.reps.reduce((s, r) => s + r.eccentricMs, 0) / count / 1000) * 10) / 10;
    const avgConSec = Math.round((this.reps.reduce((s, r) => s + r.concentricMs, 0) / count / 1000) * 10) / 10;

    const rangeScore = Math.max(55, Math.min(99, depthRate));
    const pathScore = Math.max(55, Math.min(99, Math.round(100 - Math.max(0, avgDrift - 1.5) * 6)));
    const tempoScore = Math.max(60, Math.min(98, avgEccSec >= 1.0 ? 92 : 76));
    const symmetryScore = Math.max(55, Math.min(98, Math.round(100 - maxValgus * 1.8)));
    const overallScore = Math.round(
      rangeScore * 0.35 + pathScore * 0.25 + tempoScore * 0.2 + symmetryScore * 0.2,
    );

    const issuesMap = new Map<string, FormIssue>();
    for (const rep of this.reps) {
      for (const cue of rep.cues) {
        if (!issuesMap.has(cue)) {
          issuesMap.set(cue, {
            title: `Rep ${rep.repNumber} biomechanical flag`,
            cue,
            severity: cue.includes("Shallow") || cue.includes("valgus") || cue.includes("sag") ? "high" : "medium",
            at: formatTs(rep.timestampMs),
          });
        }
      }
    }

    const wins: string[] = [];
    if (depthRate >= 85) wins.push(`Consistent ROM on ${this.reps.filter((r) => r.depthOk).length}/${count} reps`);
    if (avgDrift <= 3.5) wins.push(`Tight vertical path (${avgDrift} cm avg drift)`);
    if (avgEccSec >= 1.0) wins.push(`Controlled ${avgEccSec}s eccentric tempo`);
    if (maxValgus <= 8) wins.push("Stable knee/joint alignment under load");
    if (wins.length === 0) wins.push(`Completed ${count} tracked reps cleanly`);

    const verdict =
      overallScore >= 90
        ? `Sharp ${LIFT_SPECS[this.lift].label} execution across ${count} reps — mechanics are locked in.`
        : overallScore >= 78
          ? `Solid ${count}-rep set (${overallScore}/100). Clean up the top cue below to unlock even smoother reps.`
          : `${count} reps tracked (${overallScore}/100). Focus on the primary mechanical fix before adding load.`;

    return {
      lift: this.lift,
      angle: this.angle,
      reps: count,
      score: overallScore,
      rubric: {
        range: rangeScore,
        path: pathScore,
        tempo: tempoScore,
        symmetry: symmetryScore,
      },
      verdict,
      metrics: [
        { label: "ROM / Depth", value: `${depthRate}%`, target: "100% full ROM", ok: depthRate >= 80 },
        { label: "Bar / Wrist Path", value: `${avgDrift} cm`, target: "< 4.0 cm", ok: avgDrift <= 4.0 },
        { label: "Torso Angle", value: `${avgTorso}°`, target: this.lift === "ohp" ? "< 18°" : "stable", ok: this.lift === "ohp" ? avgTorso <= 18 : avgTorso <= 48 },
        { label: "Tempo (Ecc/Con)", value: `${avgEccSec}s / ${avgConSec}s`, target: "controlled", ok: avgEccSec >= 0.9 },
      ],
      issues: [...issuesMap.values()].slice(0, 4),
      wins,
      repBreakdown: [...this.reps],
    };
  }
}

/**
 * Generates an anatomically coherent 33-landmark pose frame (0..1)
 * for Interactive Simulator mode so it runs through the exact same FormCheckTracker.
 */
export function generateSimulatedPoseFrame(lift: LiftKey, repPhase01: number): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.96 }));
  const d = (1 - Math.cos(repPhase01 * Math.PI * 2)) / 2; // 0 -> 1 -> 0

  let hip = { x: 0.48, y: 0.50 };
  let shoulder = { x: 0.50, y: 0.30 };
  let knee = { x: 0.50, y: 0.70 };
  const ankle = { x: 0.49, y: 0.88 };
  let elbow = { x: 0.49, y: 0.39 };
  let wrist = { x: 0.53, y: 0.30 };

  if (lift === "squat") {
    hip = { x: 0.46 - d * 0.03, y: 0.50 + d * 0.20 };
    shoulder = { x: 0.50 + d * 0.03, y: hip.y - 0.19 + d * 0.02 };
    knee = { x: 0.51 + d * 0.09, y: 0.69 + d * 0.01 };
    elbow = { x: shoulder.x - 0.01, y: shoulder.y + 0.08 };
    wrist = { x: shoulder.x + 0.03, y: shoulder.y - 0.01 };
  } else if (lift === "deadlift") {
    // d=0 bottom, d=1 lockout
    hip = { x: 0.43 + d * 0.06, y: 0.56 - d * 0.07 };
    shoulder = { x: 0.53 - d * 0.03, y: 0.44 - d * 0.15 };
    knee = { x: 0.51 - d * 0.02, y: 0.70 };
    elbow = { x: shoulder.x, y: shoulder.y + 0.12 };
    wrist = { x: 0.51, y: elbow.y + 0.11 };
  } else if (lift === "bench") {
    shoulder = { x: 0.44, y: 0.54 };
    hip = { x: 0.62, y: 0.56 };
    knee = { x: 0.76, y: 0.58 };
    elbow = { x: 0.44 - d * 0.11, y: 0.44 + d * 0.14 };
    wrist = { x: 0.45, y: 0.30 + d * 0.16 };
  } else if (lift === "ohp") {
    shoulder = { x: 0.50, y: 0.34 };
    hip = { x: 0.49, y: 0.54 };
    knee = { x: 0.49, y: 0.72 };
    elbow = { x: 0.52 - d * 0.02, y: 0.44 - d * 0.22 };
    wrist = { x: 0.51, y: 0.34 - d * 0.24 };
  } else if (lift === "pushup") {
    shoulder = { x: 0.34, y: 0.64 + d * 0.12 };
    hip = { x: 0.54, y: 0.68 + d * 0.06 };
    knee = { x: 0.70, y: 0.71 + d * 0.03 };
    elbow = { x: 0.33 - d * 0.10, y: 0.75 + d * 0.04 };
    wrist = { x: 0.34, y: 0.86 };
  } else if (lift === "row") {
    hip = { x: 0.44, y: 0.52 };
    shoulder = { x: 0.56, y: 0.42 };
    knee = { x: 0.49, y: 0.71 };
    elbow = { x: 0.56 - d * 0.12, y: 0.55 - d * 0.12 };
    wrist = { x: 0.56 - d * 0.03, y: 0.68 - d * 0.16 };
  }

  const setPair = (lIdx: number, rIdx: number, pt: { x: number; y: number }, xOff = 0.01) => {
    lms[lIdx] = { x: pt.x - xOff, y: pt.y, visibility: 0.97 };
    lms[rIdx] = { x: pt.x + xOff, y: pt.y, visibility: 0.95 };
  };

  lms[POSE_IDX.NOSE] = { x: shoulder.x + 0.01, y: shoulder.y - 0.07, visibility: 0.97 };
  setPair(POSE_IDX.LEFT_SHOULDER, POSE_IDX.RIGHT_SHOULDER, shoulder);
  setPair(POSE_IDX.LEFT_ELBOW, POSE_IDX.RIGHT_ELBOW, elbow);
  setPair(POSE_IDX.LEFT_WRIST, POSE_IDX.RIGHT_WRIST, wrist);
  setPair(POSE_IDX.LEFT_HIP, POSE_IDX.RIGHT_HIP, hip);
  setPair(POSE_IDX.LEFT_KNEE, POSE_IDX.RIGHT_KNEE, knee);
  setPair(POSE_IDX.LEFT_ANKLE, POSE_IDX.RIGHT_ANKLE, ankle);
  setPair(POSE_IDX.LEFT_FOOT, POSE_IDX.RIGHT_FOOT, { x: ankle.x + 0.03, y: ankle.y + 0.01 });

  return lms;
}
