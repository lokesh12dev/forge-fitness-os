import { describe, expect, it } from "vitest";
import {
  adaptiveTargetWeightWithReason,
  checkDeloadRecommendation,
  compressSession,
  EQUIPMENT_PROFILES,
  alternativesFor,
} from "./engine";

describe("Sprint 2 Engine Features", () => {
  describe("adaptiveTargetWeightWithReason (B2)", () => {
    it("returns zero and 'no_history' explanation when no prior history exists", () => {
      const rec = adaptiveTargetWeightWithReason(0, 85, 8, "barbell");
      expect(rec.targetWeight).toBe(0);
      expect(rec.factor).toBe("no_history");
      expect(rec.reason).toContain("First time logging");
    });

    it("applies double progression (+2.5kg) when top of rep range is hit", () => {
      // previous was 100kg, hit 10 reps on a 10-rep max target
      const rec = adaptiveTargetWeightWithReason(100, 75, 8, "barbell", 10, 10);
      expect(rec.targetWeight).toBe(102.5);
      expect(rec.factor).toBe("double_progression");
      expect(rec.adjustmentKg).toBe(2.5);
      expect(rec.reason).toContain("Double progression");
    });

    it("applies +2.5% progression on high readiness (>= 85)", () => {
      const rec = adaptiveTargetWeightWithReason(100, 90, 8, "barbell");
      expect(rec.targetWeight).toBe(102.5);
      expect(rec.factor).toBe("high_readiness");
      expect(rec.reason).toContain("Primed recovery");
    });

    it("applies -5% back-off on low readiness (< 60)", () => {
      const rec = adaptiveTargetWeightWithReason(100, 52, 8, "barbell");
      expect(rec.targetWeight).toBe(95);
      expect(rec.factor).toBe("low_readiness");
      expect(rec.reason).toContain("Fatigue back-off");
    });

    it("uses 2kg steps for dumbbells", () => {
      const rec = adaptiveTargetWeightWithReason(40, 92, 8, "dumbbell");
      expect(rec.targetWeight % 2).toBe(0);
      expect(rec.targetWeight).toBe(42);
    });

    it("adjusts for non-standard RPE targets", () => {
      // RPE 9 on 100kg baseline
      const rec = adaptiveTargetWeightWithReason(100, 75, 9, "barbell");
      expect(rec.targetWeight).toBeGreaterThanOrEqual(100);
      expect(rec.rpeTarget).toBe(9);
    });
  });

  describe("Equipment Profiles & Alternatives (B3)", () => {
    const mockExercises = [
      {
        id: "ex-bb-bench",
        name: "Barbell Bench Press",
        pattern: "horizontal_push",
        primaryMuscle: "chest",
        category: "compound",
        equipment: "barbell",
        popularity: 95,
        secondaryMuscles: ["shoulders", "triceps"],
      },
      {
        id: "ex-db-bench",
        name: "Dumbbell Bench Press",
        pattern: "horizontal_push",
        primaryMuscle: "chest",
        category: "compound",
        equipment: "dumbbell",
        popularity: 90,
        secondaryMuscles: ["shoulders", "triceps"],
      },
      {
        id: "ex-pushup",
        name: "Push-up",
        pattern: "horizontal_push",
        primaryMuscle: "chest",
        category: "compound",
        equipment: "bodyweight",
        popularity: 85,
        secondaryMuscles: ["shoulders", "triceps"],
      },
      {
        id: "ex-machine-press",
        name: "Chest Press Machine",
        pattern: "horizontal_push",
        primaryMuscle: "chest",
        category: "compound",
        equipment: "machine",
        popularity: 75,
        secondaryMuscles: ["shoulders", "triceps"],
      },
    ];

    it("defines 4 core equipment profiles", () => {
      expect(EQUIPMENT_PROFILES.commercial).toBeDefined();
      expect(EQUIPMENT_PROFILES.home_gym).toBeDefined();
      expect(EQUIPMENT_PROFILES.hotel_travel).toBeDefined();
      expect(EQUIPMENT_PROFILES.bodyweight).toBeDefined();
    });

    it("filters alternatives strictly by profile equipment", () => {
      const target = mockExercises[0]; // Barbell Bench

      // Hotel/Travel has dumbbells & bodyweight, but NOT barbells or machines
      const hotelAlternatives = alternativesFor(
        target,
        mockExercises,
        EQUIPMENT_PROFILES.hotel_travel.equipment,
      );

      expect(hotelAlternatives.some((e) => e.equipment === "machine")).toBe(false);
      expect(hotelAlternatives.some((e) => e.equipment === "barbell")).toBe(false);
      expect(hotelAlternatives.some((e) => e.id === "ex-db-bench")).toBe(true);
    });

    it("ranks alternatives by movement pattern and muscle overlap", () => {
      const target = mockExercises[0];
      const alts = alternativesFor(target, mockExercises, EQUIPMENT_PROFILES.commercial.equipment);

      expect(alts.length).toBeGreaterThan(0);
      expect(alts[0].pattern).toBe(target.pattern);
      expect(alts[0].primaryMuscle).toBe(target.primaryMuscle);
      expect(alts[0].score).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Session Compression & Diff (B4)", () => {
    const mockExercises = [
      { id: "e1", exerciseId: "ex1", targetSets: 4, restSec: 120, category: "compound", position: 0, supersetGroup: null as string | null },
      { id: "e2", exerciseId: "ex2", targetSets: 4, restSec: 120, category: "compound", position: 1, supersetGroup: null as string | null },
      { id: "e3", exerciseId: "ex3", targetSets: 3, restSec: 90, category: "isolation", position: 2, supersetGroup: null as string | null },
      { id: "e4", exerciseId: "ex4", targetSets: 3, restSec: 90, category: "isolation", position: 3, supersetGroup: null as string | null },
    ];

    it("pairs straight sets into supersets and trims rest for 25m target", () => {
      const res = compressSession(mockExercises, 25);
      expect(res.groups.length).toBe(2);
      expect(res.groups[0].label).toBe("Superset 1");
      expect(res.exercises[0].supersetGroup).toBe("SS-1A");
      expect(res.exercises[1].supersetGroup).toBe("SS-1B");
      expect(res.exercises[0].restSec).toBe(60); // 120 * 0.5
      expect(res.diffSummary.length).toBeGreaterThan(0);
    });

    it("prunes isolation exercises for 15-minute blitz window", () => {
      const res = compressSession(mockExercises, 15);
      expect(res.dropped.length).toBeGreaterThan(0);
      expect(res.dropped.every((d) => d.category === "isolation")).toBe(true);
      expect(res.exercises.every((e) => e.category === "compound")).toBe(true);
      expect(res.diffSummary.some((s) => s.includes("pruned"))).toBe(true);
    });
  });

  describe("Deload Auto-Detection (B5)", () => {
    it("recommends train as planned when recovery is fresh", () => {
      const sessions = [
        { volume: 12000, rpeAvg: 7.5, completedAt: Date.now() - 86400000 * 2 },
        { volume: 11500, rpeAvg: 8.0, completedAt: Date.now() - 86400000 * 1 },
      ];
      const readiness = [82, 85, 80, 88];
      const res = checkDeloadRecommendation(sessions, readiness, 2);

      expect(res.shouldDeload).toBe(false);
      expect(res.suggestedAction).toBe("train_as_planned");
    });

    it("triggers deload recommendation after 4+ weeks of high fatigue and low readiness", () => {
      const sessions = [
        { volume: 14000, rpeAvg: 9.2, completedAt: Date.now() - 86400000 * 4 },
        { volume: 14500, rpeAvg: 9.5, completedAt: Date.now() - 86400000 * 2 },
        { volume: 13000, rpeAvg: 9.5, completedAt: Date.now() - 86400000 * 1 },
      ];
      const readiness = [52, 58, 60, 54]; // all < 65
      const res = checkDeloadRecommendation(sessions, readiness, 5); // 5 weeks

      expect(res.shouldDeload).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(60);
      expect(res.deloadProtocol).toBeDefined();
      expect(res.deloadProtocol?.intensityPct).toBe(60);
      expect(res.reasons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
