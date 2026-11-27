import { describe, expect, it } from "vitest";
import {
  CATALOG_BY_ID,
  FULL_EXERCISE_CATALOG,
  OPENGYM_CURATED_ROUTINES,
  OPENGYM_STARTER_PLANS,
  SKILL_LADDERS,
  buildSessionFromMuscles,
  computeEpley1RM,
  computeMusclePercentages,
  computeRoutineMuscleLoad,
} from "./opengym-catalog";
import {
  DEFAULT_PLAN_STATE,
  applyCuratedTemplateToPlan,
  computeWeekTally,
  getScheduledRoutinesForDate,
} from "./plan-store";

describe("Unified openGym Catalog, Ladders & Epley 1RM", () => {
  it("loads all 5,632 exercises combining FORGE + openGym full catalogue", () => {
    expect(FULL_EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(5600);
    expect(CATALOG_BY_ID.get("ex-bench-press")?.name).toBe("Barbell Bench Press");
    const jumpBox = CATALOG_BY_ID.get("og-4209");
    expect(jumpBox?.name).toBe("1 To 2 Jump Box");
    expect(jumpBox?.description).toContain("Push off with one leg");
  });

  it("computes muscle share percentages and Epley 1RM accurately", () => {
    const jumpBox = CATALOG_BY_ID.get("og-4209")!;
    const shares = computeMusclePercentages(jumpBox);
    expect(shares[0].label.toLowerCase()).toContain("quad");
    expect(shares.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(computeEpley1RM(20, 5)).toBe(23.3);
  });

  it("resolves every Skill Ladder step cleanly in CATALOG_BY_ID", () => {
    expect(SKILL_LADDERS.length).toBe(7);
    for (const ladder of SKILL_LADDERS) {
      expect(ladder.steps.length).toBeGreaterThanOrEqual(3);
      for (const stepId of ladder.steps) {
        expect(CATALOG_BY_ID.has(stepId)).toBe(true);
      }
    }
  });

  it("resolves every slot in openGym starter and curated CC-BY-4.0 routines", () => {
    for (const plan of [...OPENGYM_STARTER_PLANS, ...OPENGYM_CURATED_ROUTINES]) {
      expect(plan.sessions.length).toBeGreaterThan(0);
      for (const s of plan.sessions) {
        for (const slot of s.exercises) {
          expect(CATALOG_BY_ID.has(slot.exerciseId)).toBe(true);
        }
      }
    }
  });

  it("builds a targeted session when picking muscles in MuscleExplorer", () => {
    const picked = buildSessionFromMuscles(["chest", "shoulders"], FULL_EXERCISE_CATALOG, ["barbell", "dumbbell", "bodyweight"]);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked.some((e) => e.primaryMuscle === "chest" || e.primaryMuscle === "shoulders")).toBe(true);
  });

  it("computes routine muscle heatmap weights for MiniBodyMap", () => {
    const load = computeRoutineMuscleLoad(["ex-bench-press", "ex-overhead-press"]);
    expect(load.chest).toBeGreaterThan(0);
    expect(load.deltoids).toBeGreaterThan(0);
  });
});

describe("Plan Schedule OS (Fixed Week, Rotation, & Home Sync)", () => {
  it("resolves Fixed Week scheduled routines and handles explicit day overrides", () => {
    const mon = getScheduledRoutinesForDate(DEFAULT_PLAN_STATE, "2026-11-23", 1);
    expect(mon.map((r) => r.name)).toEqual(["Push Day"]);

    const overridden = {
      ...DEFAULT_PLAN_STATE,
      dayOverrides: { "2026-11-23": "rest" as const },
    };
    expect(getScheduledRoutinesForDate(overridden, "2026-11-23", 1)).toEqual([]);
  });

  it("computes weekly workouts left accurately", () => {
    const weekDates = [
      { iso: "2026-11-23", weekday: 1 },
      { iso: "2026-11-24", weekday: 2 },
      { iso: "2026-11-25", weekday: 3 },
      { iso: "2026-11-26", weekday: 4 },
      { iso: "2026-11-27", weekday: 5 },
      { iso: "2026-11-28", weekday: 6 },
      { iso: "2026-11-29", weekday: 0 },
    ];
    const tally = computeWeekTally(DEFAULT_PLAN_STATE, weekDates, new Set(["2026-11-23", "2026-11-25"]));
    expect(tally.planned).toBe(4);
    expect(tally.done).toBe(2);
    expect(tally.left).toBe(2);
  });

  it("applies curated openGym plans directly onto Fixed Week & Rotation", () => {
    const template = OPENGYM_STARTER_PLANS[1]; // 5x5
    const next = applyCuratedTemplateToPlan(DEFAULT_PLAN_STATE, template);
    expect(next.activeProgrammeId).toBe(template.id);
    expect(next.routines.some((r) => r.name.includes("5×5"))).toBe(true);
    expect(next.week[1].length).toBeGreaterThan(0);
  });
});
