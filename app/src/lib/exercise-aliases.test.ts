import { describe, expect, it } from "vitest";
import { EXERCISE_ALIASES, matchExercise } from "./exercise-aliases";

describe("EXERCISE_ALIASES", () => {
  it("contains mappings for major compound and isolation movements", () => {
    expect(EXERCISE_ALIASES["bench-press"]).toContain("bench");
    expect(EXERCISE_ALIASES["bench-press"]).toContain("bb bench");
    expect(EXERCISE_ALIASES["romanian-deadlift"]).toContain("rdl");
    expect(EXERCISE_ALIASES["overhead-press"]).toContain("ohp");
    expect(EXERCISE_ALIASES["lat-pulldown"]).toContain("lat pull");
    expect(EXERCISE_ALIASES["skull-crusher"]).toContain("skullcrushers");
    expect(EXERCISE_ALIASES["bulgarian-split-squat"]).toContain("bss");
  });
});

describe("matchExercise", () => {
  const rdl = {
    slug: "romanian-deadlift",
    name: "Romanian Deadlift",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "lower_back"],
    equipment: "barbell",
    pattern: "hinge",
  };

  const bench = {
    slug: "bench-press",
    name: "Barbell Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "barbell",
    pattern: "horizontal_push",
  };

  const ohp = {
    slug: "overhead-press",
    name: "Barbell Overhead Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps"],
    equipment: "barbell",
    pattern: "vertical_push",
  };

  const latPulldown = {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    primaryMuscle: "back",
    secondaryMuscles: ["biceps"],
    equipment: "cable",
    pattern: "vertical_pull",
  };

  it("matches common gym abbreviations", () => {
    expect(matchExercise("rdl", rdl)).toBe(true);
    expect(matchExercise("RDL", rdl)).toBe(true);
    expect(matchExercise("ohp", ohp)).toBe(true);
    expect(matchExercise("bb bench", bench)).toBe(true);
    expect(matchExercise("lat pull", latPulldown)).toBe(true);
  });

  it("matches by muscle group, equipment, and movement pattern", () => {
    expect(matchExercise("hamstrings", rdl)).toBe(true);
    expect(matchExercise("hinge", rdl)).toBe(true);
    expect(matchExercise("cable", latPulldown)).toBe(true);
    expect(matchExercise("horizontal_push", bench)).toBe(true);
  });

  it("matches acronyms from multi-word movements", () => {
    expect(matchExercise("bsp", bench)).toBe(false);
    expect(matchExercise("rdl", rdl)).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchExercise("", bench)).toBe(true);
    expect(matchExercise("   ", rdl)).toBe(true);
  });

  it("does not falsely match unrelated lifts", () => {
    expect(matchExercise("squat", bench)).toBe(false);
    expect(matchExercise("curl", rdl)).toBe(false);
  });
});
