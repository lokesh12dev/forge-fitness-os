export type PosePoint = {
  x: number;
  y: number;
  visibility?: number;
  presence?: number;
};

export type SideLegMeasurement = {
  angleDegrees: number;
  visibility: number;
};

const MIN_LANDMARK_VISIBILITY = 0.55;

function angleAtJoint(a: PosePoint, joint: PosePoint, c: PosePoint) {
  const firstX = a.x - joint.x;
  const firstY = a.y - joint.y;
  const secondX = c.x - joint.x;
  const secondY = c.y - joint.y;
  const firstLength = Math.hypot(firstX, firstY);
  const secondLength = Math.hypot(secondX, secondY);

  if (firstLength < 0.015 || secondLength < 0.015) return null;

  const cosine = Math.max(-1, Math.min(1, (firstX * secondX + firstY * secondY) / (firstLength * secondLength)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/**
 * Returns a conservative 2D knee angle estimate from the more visible side.
 * This is useful for a rough squat rep cycle only; it is not a joint-angle
 * measurement or a form-quality assessment.
 */
export function measureSideLeg(landmarks: PosePoint[], imageAspectRatio = 1): SideLegMeasurement | null {
  const candidates = [
    [23, 25, 27], // left hip, knee, ankle
    [24, 26, 28], // right hip, knee, ankle
  ] as const;

  const measurements = candidates.flatMap(([hipIndex, kneeIndex, ankleIndex]) => {
    const hip = landmarks[hipIndex];
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];
    if (!hip || !knee || !ankle) return [];

    const visibility = Math.min(hip.visibility ?? 0, knee.visibility ?? 0, ankle.visibility ?? 0);
    if (visibility < MIN_LANDMARK_VISIBILITY) return [];

    // Landmark x/y are independently normalized by image width/height. Scale
    // x back into the image's aspect ratio before measuring a 2D angle.
    const angleDegrees = angleAtJoint(
      { ...hip, x: hip.x * imageAspectRatio },
      { ...knee, x: knee.x * imageAspectRatio },
      { ...ankle, x: ankle.x * imageAspectRatio },
    );
    return angleDegrees === null ? [] : [{ angleDegrees, visibility }];
  });

  return measurements.sort((a, b) => b.visibility - a.visibility)[0] ?? null;
}

export type SquatCounterState = {
  reps: number;
  filteredAngle: number | null;
  deepestAngle: number | null;
  bottomFrames: number;
  topFrames: number;
  bottomStartedAt: number | null;
  hasSeenTop: boolean;
};

export function createSquatCounter(): SquatCounterState {
  return {
    reps: 0,
    filteredAngle: null,
    deepestAngle: null,
    bottomFrames: 0,
    topFrames: 0,
    bottomStartedAt: null,
    hasSeenTop: false,
  };
}

/**
 * A deliberately simple hysteresis counter: two confident frames below 115°
 * arm a rep, then two frames above 155° complete it after a minimum cycle.
 * Thresholds are pilot defaults and must be field-validated before use as a
 * coaching or range-of-motion judgment.
 */
export function updateSquatCounter(state: SquatCounterState, angleDegrees: number, timestampMs: number) {
  const filteredAngle = state.filteredAngle === null
    ? angleDegrees
    : state.filteredAngle * 0.65 + angleDegrees * 0.35;
  const next: SquatCounterState = { ...state, filteredAngle };
  let repCompleted = false;

  if (filteredAngle >= 155) {
    next.topFrames += 1;
    next.bottomFrames = 0;
    if (next.topFrames >= 2) {
      next.hasSeenTop = true;
      if (next.bottomStartedAt !== null && timestampMs - next.bottomStartedAt >= 250) {
        next.reps += 1;
        repCompleted = true;
      }
      next.bottomStartedAt = null;
    }
  } else if (filteredAngle <= 115) {
    next.bottomFrames += 1;
    next.topFrames = 0;
    if (next.bottomFrames >= 2 && next.hasSeenTop && next.bottomStartedAt === null) {
      next.bottomStartedAt = timestampMs;
    }
    next.deepestAngle = next.deepestAngle === null
      ? filteredAngle
      : Math.min(next.deepestAngle, filteredAngle);
  } else {
    next.topFrames = 0;
    next.bottomFrames = 0;
  }

  return { state: next, repCompleted };
}
