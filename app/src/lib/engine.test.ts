import { describe, expect, it } from "vitest";
import {
  adaptiveTargetWeight,
  computeLevelProgress,
  e1rm,
  estimateSessionMinutes,
  plateBreakdown,
  proteinPlan,
  readinessConfidence,
  readinessScore,
  readinessVerdict,
  recoveryMap,
  roundTo,
  strengthStanding,
  suggestedLoad,
} from "./engine";

describe("e1rm", () => {
  it("uses the Epley formula and rounds to 0.1", () => {
    expect(e1rm(100, 5)).toBe(116.7);
    expect(e1rm(60, 10)).toBe(80);
  });

  it("returns 0 for missing weight or reps", () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
  });
});

describe("roundTo", () => {
  it("snaps to the nearest step", () => {
    expect(roundTo(41.2)).toBe(40);
    expect(roundTo(93.4, 5)).toBe(95);
    expect(roundTo(-10)).toBe(0);
  });
});

describe("readinessScore", () => {
  it("scores ideal inputs as primed", () => {
    const score = readinessScore({ sleepHours: 8.5, hrv: 80, restingHr: 48, soreness: 1 });
    expect(score).toBeGreaterThanOrEqual(88);
    expect(score).toBeLessThanOrEqual(99);
  });

  it("scores poor inputs lower than ideal inputs", () => {
    const poor = readinessScore({ sleepHours: 4, hrv: 30, restingHr: 82, soreness: 9 });
    const good = readinessScore({ sleepHours: 8, hrv: 70, restingHr: 50, soreness: 2 });
    expect(poor).toBeLessThan(good);
  });

  it("returns a default-based score when no inputs exist", () => {
    const score = readinessScore({});
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThanOrEqual(99);
  });
});

describe("readinessConfidence", () => {
  it("reports the fraction of real inputs", () => {
    expect(readinessConfidence({})).toBe(0);
    expect(readinessConfidence({ sleepHours: 7 })).toBe(0.25);
    expect(readinessConfidence({ sleepHours: 7, hrv: 60, restingHr: 55, soreness: 3 })).toBe(1);
  });
});

describe("readinessVerdict", () => {
  it("maps score bands to verdicts", () => {
    expect(readinessVerdict(90).label).toBe("Primed");
    expect(readinessVerdict(75).label).toBe("Ready");
    expect(readinessVerdict(60).label).toBe("Moderate");
    expect(readinessVerdict(30).label).toBe("Depleted");
  });
});

describe("computeLevelProgress", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(computeLevelProgress(0)).toMatchObject({ level: 1, progress: 0, xpToNext: 100 });
  });

  it("crosses to level 2 at exactly 100 XP", () => {
    expect(computeLevelProgress(100)).toMatchObject({ level: 2, progress: 0 });
  });

  it("is non-zero at 12,480 XP (the old bug showed 0%)", () => {
    const result = computeLevelProgress(12_480);
    expect(result.level).toBe(12);
    expect(result.progress).toBe(17);
    expect(result.progress).toBeGreaterThan(0);
  });

  it("is monotonic across levels", () => {
    for (let xp = 0; xp < 20_000; xp += 137) {
      const { level, progress } = computeLevelProgress(xp);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    }
  });
});

describe("recoveryMap", () => {
  it("returns fully recovered muscles when there is no training", () => {
    const map = recoveryMap([]);
    expect(map.chest.recovery).toBe(100);
    expect(map.chest.sets).toBe(0);
  });

  it("reduces recovery for a recent hard set", () => {
    const map = recoveryMap([
      { primaryMuscle: "chest", completedAt: new Date(), weightKg: 100, reps: 8 },
    ]);
    expect(map.chest.recovery).toBeLessThan(100);
    expect(map.chest.sets).toBe(1);
  });

  it("ignores sets older than eight days", () => {
    const old = new Date(Date.now() - 9 * 86_400_000);
    const map = recoveryMap([
      { primaryMuscle: "quads", completedAt: old, weightKg: 200, reps: 5 },
    ]);
    expect(map.quads.recovery).toBe(100);
  });
});

describe("suggestedLoad", () => {
  it("returns null without history so the UI can show a dash", () => {
    expect(suggestedLoad(null, 8)).toBeNull();
    expect(suggestedLoad({ weightKg: 0, reps: 8 }, 8)).toBeNull();
  });

  it("derives a target from the last set's e1RM", () => {
    const load = suggestedLoad({ weightKg: 100, reps: 5 }, 8);
    expect(load).toBe(92.5);
  });

  it("never returns less than one plate step", () => {
    expect(suggestedLoad({ weightKg: 1, reps: 30 }, 30)).toBe(2.5);
  });
});

describe("adaptiveTargetWeight", () => {
  it("returns 0 when there is no history instead of inventing a baseline", () => {
    expect(adaptiveTargetWeight(0, 90, 8, "barbell")).toBe(0);
  });

  it("progresses on high readiness and backs off on low readiness", () => {
    expect(adaptiveTargetWeight(100, 90)).toBe(102.5);
    expect(adaptiveTargetWeight(100, 50)).toBe(95);
    expect(adaptiveTargetWeight(100, 75)).toBe(100);
  });

  it("uses a smaller step for dumbbells", () => {
    expect(adaptiveTargetWeight(20, 90, 8, "dumbbell")).toBe(20);
  });
});

describe("plateBreakdown", () => {
  it("splits plates per side", () => {
    const result = plateBreakdown(100);
    expect(result.perSide).toEqual([25, 15]);
    expect(result.remainder).toBe(0);
  });

  it("handles a load below bar weight", () => {
    const result = plateBreakdown(15);
    expect(result.perSide).toEqual([]);
    expect(result.remainder).toBe(0);
  });
});

describe("strengthStanding", () => {
  it("returns a tier for a known lift", () => {
    const standing = strengthStanding("bench-press", 100, 80, "male");
    expect(standing).not.toBeNull();
    expect(standing!.ratio).toBe(1.25);
    expect(standing!.level).toBe("Advanced");
  });

  it("returns null for unknown lifts or missing bodyweight", () => {
    expect(strengthStanding("curl", 40, 80, "male")).toBeNull();
    expect(strengthStanding("bench-press", 100, 0, "male")).toBeNull();
  });
});

describe("proteinPlan", () => {
  it("suggests foods that cover the remaining protein", () => {
    const plan = proteinPlan(40);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].protein).toBeLessThanOrEqual(40);
  });

  it("returns an empty plan when the target is hit", () => {
    expect(proteinPlan(0)).toEqual([]);
  });
});

describe("estimateSessionMinutes", () => {
  it("adds warm-up time and per-set work", () => {
    const minutes = estimateSessionMinutes([
      { targetSets: 3, restSec: 120 },
      { targetSets: 3, restSec: 120 },
      { targetSets: 3, restSec: 120 },
    ]);
    expect(minutes).toBeGreaterThan(20);
    expect(minutes).toBeLessThan(40);
  });
});
