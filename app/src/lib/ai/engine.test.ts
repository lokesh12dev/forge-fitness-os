import { describe, expect, it } from "vitest";
import type { UnifiedUserFitnessContext } from "./context";
import { generateModuleCoachResponse } from "./engine";
import { getProviderHealth } from "./providers";
import { buildContextualRecommendations, buildDailyBriefing, buildWeeklyReport } from "./briefing";
import { validateAndNormalizeAiPlan } from "./schemas";

const MOCK_CTX: UnifiedUserFitnessContext = {
  userId: "u-test",
  firstName: "Alex",
  fullName: "Alex Rivera",
  goal: "strength",
  experience: "intermediate",
  sex: "male",
  weightKg: 80,
  heightCm: 178,
  equipment: ["barbell", "dumbbell", "cable", "bodyweight"],
  streak: 14,
  readiness: 86,
  latestMetric: {
    date: "2026-11-27",
    weightKg: 80.4,
    bodyFat: null,
    sleepHours: 8.1,
    hrv: 72,
    restingHr: 54,
    soreness: 2,
  },
  weightTrend: [
    { date: "2026-11-14", weightKg: 80.4 },
    { date: "2026-11-18", weightKg: 80.3 },
    { date: "2026-11-21", weightKg: 80.4 },
    { date: "2026-11-24", weightKg: 80.4 },
    { date: "2026-11-27", weightKg: 80.4 },
  ],
  activeProgram: {
    id: "rt-1",
    name: "Push Pull Legs",
    daysPerWeek: 4,
    days: [
      { id: "d1", name: "Push A", focus: "Chest & Shoulders", exerciseNames: ["Barbell Bench Press"] },
    ],
  },
  activeWorkout: null,
  lastWorkout: {
    id: "wk-1",
    name: "Push A",
    focus: "Chest & Shoulders",
    daysAgo: 1,
    totalVolume: 8400,
    totalSets: 16,
  },
  completedSessionsCount: 18,
  weekWorkoutsCount: 3,
  weeklyVolumes: [
    { label: "W1", volume: 18500, sessions: 4 },
    { label: "W2", volume: 18500, sessions: 4 },
  ],
  prs: [{ exerciseId: "ex-bench-press", exerciseName: "Barbell Bench Press", e1rm: 105, reps: 5 }],
  lowestRecoveredMuscles: [{ muscle: "chest", recovery: 68 }],
  nutrition: {
    caloriesTarget: 2800,
    proteinTarget: 180,
    carbsTarget: 320,
    fatTarget: 80,
    waterTargetMl: 3400,
    caloriesConsumed: 1450,
    proteinConsumed: 95,
    carbsConsumed: 160,
    fatConsumed: 42,
    waterConsumedMl: 1750,
    todayLogNames: ["Oatmeal", "Greek yogurt"],
  },
};

describe("Forge AI Coach & Plan Generation Engine V2", () => {
  it("reports provider health honestly with deterministic fallback always ready", () => {
    const health = getProviderHealth();
    expect(health.providers.some((p) => p.name === "forge-engine" && p.configured)).toBe(true);
    expect(["gemini", "openai", "forge-engine"]).toContain(health.activeProvider);
  });

  it("generates validated 30-day schedule & warm-up plan", async () => {
    const res = await generateModuleCoachResponse({
      module: "schedule",
      message: "Create my complete 30-day fitness plan with 6-day workout schedule",
      context: MOCK_CTX,
    });
    expect(res.plan).not.toBeNull();
    expect(res.plan?.kind).toBe("schedule");
    if (res.plan?.kind === "schedule") {
      expect(res.plan.horizon).toBe("monthly");
      expect(res.plan.daysPerWeek).toBe(6);
      expect(res.plan.warmup.length).toBeGreaterThanOrEqual(3);
      expect(res.plan.days.length).toBe(7);
    }
  });

  it("mutates existing schedule draft on follow-up ('Make Wednesday a recovery day')", async () => {
    const first = await generateModuleCoachResponse({
      module: "schedule",
      message: "Create a 6-day workout schedule",
      context: MOCK_CTX,
    });
    const followUp = await generateModuleCoachResponse({
      module: "schedule",
      message: "Make Wednesday a recovery day",
      context: MOCK_CTX,
      activeDraftPlan: first.plan,
    });
    expect(followUp.mutatedExistingDraft).toBe(true);
    expect(followUp.plan?.kind).toBe("schedule");
    if (followUp.plan?.kind === "schedule") {
      const wed = followUp.plan.days.find((d) => d.dayLabel === "Wednesday");
      expect(wed?.isRest).toBe(true);
    }
  });

  it("generates executable workout plan and supports follow-up exercise replacement", async () => {
    const res = await generateModuleCoachResponse({
      module: "workout",
      message: "Create a 30-min home dumbbell push workout",
      context: MOCK_CTX,
    });
    expect(res.plan?.kind).toBe("workout");
    if (res.plan?.kind === "workout") {
      expect(res.plan.environment).toBe("home");
      expect(res.plan.durationMin).toBe(30);
      expect(res.plan.exercises.length).toBeGreaterThanOrEqual(3);

      const firstExName = res.plan.exercises[0].name;
      const swapped = await generateModuleCoachResponse({
        module: "workout",
        message: "Replace first exercise",
        context: MOCK_CTX,
        activeDraftPlan: res.plan,
      });
      expect(swapped.mutatedExistingDraft).toBe(true);
      if (swapped.plan?.kind === "workout") {
        expect(swapped.plan.exercises[0].name).not.toBe(firstExName);
      }
    }
  });

  it("generates exercise mechanics guide with alternatives and supersets", async () => {
    const res = await generateModuleCoachResponse({
      module: "exercise",
      message: "Explain Barbell Bench Press step by step",
      context: MOCK_CTX,
    });
    expect(res.plan?.kind).toBe("exercise");
    if (res.plan?.kind === "exercise") {
      expect(res.plan.exerciseName.toLowerCase()).toContain("bench");
      expect(res.plan.movementSteps.length).toBeGreaterThanOrEqual(2);
      expect(res.plan.breathingCues.length).toBeGreaterThan(10);
    }
  });

  it("audits recorded body metrics without inventing missing measurements", async () => {
    const res = await generateModuleCoachResponse({
      module: "body",
      message: "Analyze my weight and check if I hit a plateau",
      context: MOCK_CTX,
    });
    expect(res.plan?.kind).toBe("body");
    if (res.plan?.kind === "body") {
      expect(res.plan.plateauDetected).toBe(true);
      expect(res.plan.missingMeasurements).toContain("Waist circumference");
      expect(res.plan.missingMeasurements).toContain("Body fat %");
    }
  });

  it("generates Indian vegetarian nutrition plan with cross-section goal sync", async () => {
    const res = await generateModuleCoachResponse({
      module: "nutrition",
      message: "Create an Indian vegetarian meal plan and shift my goal to muscle building",
      context: MOCK_CTX,
    });
    expect(res.plan?.kind).toBe("nutrition");
    if (res.plan?.kind === "nutrition") {
      expect(res.plan.dietStyle).toBe("indian");
      expect(res.plan.meals.length).toBeGreaterThanOrEqual(3);
      expect(res.plan.groceryList.length).toBeGreaterThan(0);
      expect(res.plan.crossSync?.goalUpdate).toBe("hypertrophy");
      expect(res.plan.crossSync?.affectedModules).toContain("workout");
    }
  });

  it("builds Daily Briefing, Weekly Report, and Contextual Recommendations from real context", () => {
    const briefing = buildDailyBriefing(MOCK_CTX);
    const weekly = buildWeeklyReport(MOCK_CTX);
    const recs = buildContextualRecommendations(MOCK_CTX);

    expect(briefing.todaysWorkout).toContain("Push A");
    expect(weekly.workoutsCompleted).toBe(3);
    expect(weekly.workoutsPlanned).toBe(4);
    expect(recs.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects mismatched plan kind during Zod validation", () => {
    const check = validateAndNormalizeAiPlan("workout", {
      kind: "nutrition",
      title: "Wrong module",
    });
    expect(check.ok).toBe(false);
  });
});
