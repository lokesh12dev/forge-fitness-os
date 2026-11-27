import { describe, expect, it, vi } from "vitest";
import { generateWarmupSets, plateBreakdownDetailed } from "../components/plate-calculator";
import { syncManager } from "./offline-sync";

describe("plateBreakdownDetailed", () => {
  it("computes exact Olympic plates per side for standard 20kg barbell", () => {
    // 60kg total on 20kg bar = 40kg plates total = 20kg per side
    const res60 = plateBreakdownDetailed(60, 20);
    expect(res60.barKg).toBe(20);
    expect(res60.perSide).toEqual([20]);
    expect(res60.remainder).toBe(0);

    // 100kg total on 20kg bar = 80kg plates total = 40kg per side (25 + 15)
    const res100 = plateBreakdownDetailed(100, 20);
    expect(res100.perSide).toEqual([25, 15]);
    expect(res100.remainder).toBe(0);

    // 140kg total on 20kg bar = 120kg plates total = 60kg per side (25 + 25 + 10)
    const res140 = plateBreakdownDetailed(140, 20);
    expect(res140.perSide).toEqual([25, 25, 10]);
    expect(res140.remainder).toBe(0);
  });

  it("handles empty bar or sub-bar weight correctly", () => {
    const res20 = plateBreakdownDetailed(20, 20);
    expect(res20.perSide).toEqual([]);
    expect(res20.remainder).toBe(0);

    const resUnder = plateBreakdownDetailed(15, 20);
    expect(resUnder.perSide).toEqual([]);
  });

  it("supports alternative bar weights (e.g. 15kg bar)", () => {
    // 65kg on 15kg bar = 50kg plates = 25kg per side
    const res65 = plateBreakdownDetailed(65, 15);
    expect(res65.barKg).toBe(15);
    expect(res65.perSide).toEqual([25]);
    expect(res65.remainder).toBe(0);
  });
});

describe("generateWarmupSets", () => {
  it("generates progressive warm-up ramp leading to working weight", () => {
    const sets = generateWarmupSets(100, 20);
    expect(sets.length).toBeGreaterThanOrEqual(3);
    // First set is empty bar
    expect(sets[0].weight).toBe(20);
    expect(sets[0].reps).toBe(10);

    // Later sets strictly increase in weight
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i].weight).toBeGreaterThan(sets[i - 1].weight);
      expect(sets[i].weight).toBeLessThan(100);
    }
  });

  it("returns single warm-up step if working weight is very light", () => {
    const sets = generateWarmupSets(22, 20);
    expect(sets.length).toBe(1);
    expect(sets[0].weight).toBe(20);
  });
});

describe("syncManager (offline queue & state recovery)", () => {
  it("enqueues mutations and records pending count", async () => {
    const initialStatus = syncManager.getStatus();
    expect(initialStatus.status).toBeDefined();

    const { action } = await syncManager.enqueue("COMPLETE_SET", {
      workoutId: "test-w1",
      exerciseId: "bench-press",
      weightKg: 100,
      reps: 5,
    });

    expect(action.id).toBeDefined();
    expect(action.type).toBe("COMPLETE_SET");
    expect(action.clientTimestamp).toBeDefined();

    const pending = syncManager.getPendingActions();
    expect(pending.some((p) => p.id === action.id)).toBe(true);
  });

  it("saves and loads active workout state snapshots for crash recovery", () => {
    const dummyState = [
      { id: "e1", sets: [{ id: "s1", weightKg: 80, reps: 8 }] },
    ];

    syncManager.saveActiveSnapshot("workout-crash-test", dummyState);
    const loaded = syncManager.loadActiveSnapshot("workout-crash-test");

    expect(loaded).toBeDefined();
    expect(loaded?.workoutId).toBe("workout-crash-test");
    expect(loaded?.state).toEqual(dummyState);

    syncManager.clearActiveSnapshot("workout-crash-test");
    expect(syncManager.loadActiveSnapshot("workout-crash-test")).toBeNull();
  });
});
