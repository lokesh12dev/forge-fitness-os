import { describe, expect, it } from "vitest";
import {
  calculateAngleDeg,
  calculateKneeValgusDeg,
  calculateTorsoLeanDeg,
  FormCheckTracker,
  generateSimulatedPoseFrame,
  POSE_IDX,
  smoothLandmarks,
} from "./biomechanics";

describe("Form Check Biomechanics Engine", () => {
  it("computes joint angles, torso lean, and knee valgus accurately", () => {
    expect(calculateAngleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(90);
    expect(calculateAngleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBe(180);
    expect(calculateTorsoLeanDeg({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 })).toBe(0);
    expect(
      calculateKneeValgusDeg(
        { x: 0.4, y: 0.4 },
        { x: 0.49, y: 0.65 }, // left knee collapses inward toward midline
        { x: 0.4, y: 0.9 },
        "left",
      ),
    ).toBeGreaterThan(8);
  });

  it("smooths noisy landmarks without losing shape", () => {
    const a = [{ x: 0.5, y: 0.5, visibility: 0.9 }];
    const b = [{ x: 0.7, y: 0.5, visibility: 0.9 }];
    const smoothed = smoothLandmarks(a, b, 0.5);
    expect(smoothed[0].x).toBeCloseTo(0.6, 5);
  });

  it("counts real squat reps and scores ROM, path, and tempo", () => {
    const tracker = new FormCheckTracker("squat", "Side");
    let ts = 0;

    // Simulate 3 complete squat reps at 30fps
    for (let rep = 0; rep < 3; rep++) {
      for (let step = 0; step <= 40; step++) {
        const phase = step / 40;
        const lms = generateSimulatedPoseFrame("squat", phase);
        tracker.processFrame(lms, ts);
        ts += 50; // 20fps
      }
    }

    const report = tracker.finalizeSet();
    expect(report.reps).toBe(3);
    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.repBreakdown).toHaveLength(3);
    expect(report.metrics.length).toBeGreaterThanOrEqual(4);
  });

  it("detects deadlift, bench, ohp, pushup, and row reps cleanly", () => {
    for (const lift of ["deadlift", "bench", "ohp", "pushup", "row"] as const) {
      const tracker = new FormCheckTracker(lift, "Side");
      let ts = 0;
      for (let rep = 0; rep < 2; rep++) {
        for (let step = 0; step <= 40; step++) {
          const lms = generateSimulatedPoseFrame(lift, step / 40);
          tracker.processFrame(lms, ts);
          ts += 50;
        }
      }
      const report = tracker.finalizeSet();
      expect(report.reps).toBeGreaterThanOrEqual(1);
    }
  });

  it("reports missing body visibility honestly when landmarks are hidden", () => {
    const tracker = new FormCheckTracker("squat", "Side");
    const hidden = generateSimulatedPoseFrame("squat", 0).map((lm, i) =>
      i === POSE_IDX.LEFT_ANKLE || i === POSE_IDX.RIGHT_ANKLE ? { ...lm, visibility: 0.1 } : lm,
    );
    const frame = tracker.processFrame(hidden, 100);
    expect(frame.bodyVisible).toBe(false);
    expect(frame.framingMessage.toLowerCase()).toContain("ankles");
  });
});
