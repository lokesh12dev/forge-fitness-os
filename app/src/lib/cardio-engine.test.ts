import { describe, it, expect } from "vitest";
import {
  calculateHeartRateZones,
  calculateCardioCalories,
  calculatePace,
  calculateHaversineDistance,
  parseTempo,
  calculateUnilateralVolume,
  calculateMyoRepsVolume,
} from "./cardio-engine";

describe("Phase 4: Cardio & Heart Rate Engine (A12)", () => {
  it("calculates Tanaka heart rate zones accurately for 28yo athlete", () => {
    const zones = calculateHeartRateZones(28, 56);
    // Tanaka: 208 - (0.7 * 28) = 208 - 19.6 = 188.4 -> 188
    expect(zones.maxHr).toBe(188);
    expect(zones.zone1.min).toBe(94); // 50% of 188
    expect(zones.zone2.label).toBe("Aerobic Base");
    expect(zones.zone5.max).toBe(188);
  });

  it("calculates MET-based caloric expenditure", () => {
    // Run (MET 9.8), 60 min, 78kg -> 9.8 * 78 * 1 = 764.4 -> 764 kcal
    const calories60 = calculateCardioCalories("run", 60, 78);
    expect(calories60).toBe(764);

    // Treadmill (MET 9.0), 30 min, 78kg -> 9.0 * 78 * 0.5 = 351 kcal
    const calories30 = calculateCardioCalories("treadmill", 30, 78);
    expect(calories30).toBe(351);
  });

  it("computes split pace and speed from distance and duration", () => {
    // 5 km in 25 minutes (1500s) -> 5:00 /km, 12 km/h
    const pace1 = calculatePace(5.0, 1500);
    expect(pace1.paceFormatted).toBe("5:00 /km");
    expect(pace1.speedKmh).toBe(12.0);

    // 3.2 km in 20 minutes (1200s) -> 6:15 /km, 9.6 km/h
    const pace2 = calculatePace(3.2, 1200);
    expect(pace2.paceFormatted).toBe("6:15 /km");
    expect(pace2.speedKmh).toBe(9.6);
  });

  it("computes accurate GPS coordinates distance with Haversine formula", () => {
    // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ≈ 343 km
    const dist = calculateHaversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(340);
    expect(dist).toBeLessThan(350);
  });
});

describe("Phase 4: Advanced Set Types Engine (A13)", () => {
  it("parses 4-digit tempo prescriptions and formats explanation", () => {
    const tempo1 = parseTempo("3-1-1-0");
    expect(tempo1.valid).toBe(true);
    expect(tempo1.eccentricSec).toBe(3);
    expect(tempo1.isometricSec).toBe(1);
    expect(tempo1.concentricSec).toBe(1);
    expect(tempo1.pauseSec).toBe(0);
    expect(tempo1.formatted).toBe("3-1-1-0");
    expect(tempo1.explanation).toContain("3s descent");

    const tempoExplosive = parseTempo("40X0");
    expect(tempoExplosive.valid).toBe(true);
    expect(tempoExplosive.concentricSec).toBe(1);
    expect(tempoExplosive.explanation).toContain("explosive");

    const invalidTempo = parseTempo("12");
    expect(invalidTempo.valid).toBe(false);
  });

  it("calculates unilateral volume and bilateral limb asymmetry percentage", () => {
    // Perfectly symmetrical: 20kg x 10 vs 20kg x 10 -> asymmetry 0%
    const symm = calculateUnilateralVolume(20, 10, 20, 10);
    expect(symm.totalVolumeKg).toBe(400);
    expect(symm.asymmetryPct).toBe(0);

    // Asymmetric: Left 20kg x 10 (200), Right 20kg x 8 (160) -> (40 / 200) * 100 = 20%
    const asymm = calculateUnilateralVolume(20, 10, 20, 8);
    expect(asymm.totalVolumeKg).toBe(360);
    expect(asymm.asymmetryPct).toBe(20);
  });

  it("calculates Myo-reps cluster volume and effective stimulus reps", () => {
    // 80kg: 12 reps activation + 4 mini-sets of 3 reps = 24 total reps
    const myo = calculateMyoRepsVolume(80, 12, 4, 3);
    expect(myo.totalReps).toBe(24);
    expect(myo.totalVolumeKg).toBe(1920);
    expect(myo.effectiveReps).toBe(17); // 5 effective from activation + 12 from mini-sets
  });
});
