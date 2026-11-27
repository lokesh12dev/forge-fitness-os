import { describe, it, expect } from "vitest";
import {
  calculateReadinessFromWearable,
  performWearablesSync,
  INITIAL_WEARABLES_STATE,
} from "./wearables-sync";

describe("FORGE Wearables & Platform Sync Engine", () => {
  describe("calculateReadinessFromWearable", () => {
    it("returns high readiness for optimal recovery markers", () => {
      // High HRV (80ms), low resting HR (50 bpm), good sleep (8.5 hrs)
      const score = calculateReadinessFromWearable(80, 50, 8.5);
      expect(score).toBeGreaterThanOrEqual(85);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("returns lower readiness when sleep and HRV are suppressed", () => {
      // Depressed HRV (35ms), elevated resting HR (78 bpm), low sleep (4.5 hrs)
      const score = calculateReadinessFromWearable(35, 78, 4.5);
      expect(score).toBeLessThan(60);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it("clamps readiness within [20, 100]", () => {
      expect(calculateReadinessFromWearable(200, 35, 12)).toBe(100);
      expect(calculateReadinessFromWearable(10, 110, 1)).toBe(20);
    });
  });

  describe("performWearablesSync", () => {
    it("updates syncedAt timestamp and recalculates readiness", () => {
      const { state, readinessScore } = performWearablesSync(INITIAL_WEARABLES_STATE, {
        restingHeartRateBpm: 52,
        heartRateVariabilityMs: 76,
        sleepDurationHours: 8.0,
      });

      expect(state.connected).toBe(true);
      expect(state.lastTelemetry.restingHeartRateBpm).toBe(52);
      expect(state.lastTelemetry.heartRateVariabilityMs).toBe(76);
      expect(readinessScore).toBeGreaterThanOrEqual(85);
    });
  });
});
