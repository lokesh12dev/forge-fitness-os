import { describe, it, expect } from "vitest";
import { isFeatureFlagEnabled, DEFAULT_FEATURE_FLAGS } from "./feature-flags";
import {
  parseWorkoutCSV,
  detectCSVFormat,
  canonicalizeExerciseName,
  exportWorkoutsToCSV,
} from "./workout-import-export";
import { BUILTIN_PROGRAMS } from "./programs-db";
import {
  detectPlateau,
  rescheduleMissedSession,
  adaptForCrowdedGym,
  type ScheduledDay,
} from "./adaptive-features";
import { coachReply, type CoachContext } from "./coach";

describe("Phase 4: Feature Flags Engine", () => {
  it("evaluates default feature flags accurately", () => {
    expect(isFeatureFlagEnabled("import_export_csv")).toBe(true);
    expect(isFeatureFlagEnabled("programs_library_10")).toBe(true);
    expect(isFeatureFlagEnabled("ai_coach_advanced")).toBe(true);
    expect(isFeatureFlagEnabled("plateau_detection")).toBe(true);
    expect(isFeatureFlagEnabled("crowded_gym_mode")).toBe(true);
  });

  it("applies runtime feature flag overrides", () => {
    expect(isFeatureFlagEnabled("wearables_health_connect", { wearables_health_connect: true })).toBe(true);
    expect(isFeatureFlagEnabled("plateau_detection", { plateau_detection: false })).toBe(false);
  });
});

describe("Phase 4: Universal Workout CSV Importer & Exporter (A11)", () => {
  const sampleHevy = `Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE,Notes
"2026-11-20 09:30:00","Upper Push","Barbell Bench Press",1,80,8,8,"Warmup smooth"
"2026-11-20 09:30:00","Upper Push","Barbell Bench Press",2,85,8,8.5,"Solid"
"2026-11-20 09:30:00","Upper Push","Barbell Bench Press",3,90,6,9,"Top set"
"2026-11-20 09:30:00","Upper Push","Overhead Press",1,50,8,8,"Standing strict"`;

  const sampleStrongLbs = `Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Seconds,Notes
2026-11-15 10:00:00,Pull Day,Barbell Deadlift,1,315,lbs,5,8,0,"Chalked"
2026-11-15 10:00:00,Pull Day,Barbell Deadlift,2,335,lbs,5,8.5,0,"Belted"
2026-11-15 10:00:00,Pull Day,Barbell Row,1,185,lbs,8,8,0,"Strict"`;

  it("detects CSV formats from headers", () => {
    expect(detectCSVFormat('Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE')).toBe("hevy");
    expect(detectCSVFormat('Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps')).toBe("strong");
    expect(detectCSVFormat('Date,Exercise,Category,Weight (kgs),Reps')).toBe("fitnotes");
  });

  it("parses Hevy CSV and calculates workout volume", () => {
    const res = parseWorkoutCSV(sampleHevy);
    expect(res.detectedSource).toBe("hevy");
    expect(res.totalWorkouts).toBe(1);
    expect(res.totalSets).toBe(4);
    expect(res.workouts[0].workoutName).toBe("Upper Push");
    expect(res.workouts[0].exercises.length).toBe(2);

    // Bench press volume: (80*8) + (85*8) + (90*6) = 640 + 680 + 540 = 1860 kg
    // OHP volume: 50*8 = 400 kg
    // Total: 2260 kg
    expect(res.totalVolumeKg).toBe(2260);
  });

  it("accurately converts imperial pounds (lbs) to kilograms (kg)", () => {
    const res = parseWorkoutCSV(sampleStrongLbs);
    expect(res.detectedSource).toBe("strong");
    const deadliftSets = res.workouts[0].exercises[0].sets;
    // 315 lbs * 0.45359237 = 142.88 kg -> 142.9 kg
    expect(deadliftSets[0].weightKg).toBeCloseTo(142.9, 1);
  });

  it("canonicalizes exercise aliases to known slugs", () => {
    expect(canonicalizeExerciseName("Barbell Bench Press").slug).toBe("bench-press");
    expect(canonicalizeExerciseName("RDL").slug).toBe("romanian-deadlift");
    expect(canonicalizeExerciseName("OHP").slug).toBe("overhead-press");
  });

  it("exports parsed workouts into universal CSV format", () => {
    const res = parseWorkoutCSV(sampleHevy);
    const exportedCSV = exportWorkoutsToCSV(res.workouts);
    expect(exportedCSV).toContain("Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE,Notes");
    expect(exportedCSV).toContain("Bench Press");
    expect(exportedCSV).toContain("90,6,9");
  });
});

describe("Phase 4: 10 Built-in Periodized Programs (F1)", () => {
  it("provides exactly 10 distinct, fully structured programs", () => {
    expect(BUILTIN_PROGRAMS.length).toBe(10);
  });

  it("ensures each program has comprehensive exercise prescriptions and days", () => {
    for (const prog of BUILTIN_PROGRAMS) {
      expect(prog.id).toBeTruthy();
      expect(prog.name).toBeTruthy();
      expect(prog.days.length).toBeGreaterThanOrEqual(3);
      expect(prog.daysPerWeek).toBeGreaterThanOrEqual(3);
      expect(prog.weeks).toBeGreaterThanOrEqual(6);
      expect(prog.rating).toBeGreaterThanOrEqual(4.5);
      expect(prog.progressionRule).toBeTruthy();

      for (const day of prog.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(2);
        for (const ex of day.exercises) {
          expect(ex.name).toBeTruthy();
          expect(ex.sets).toBeGreaterThan(0);
          expect(ex.repsMin).toBeGreaterThan(0);
          expect(ex.repsMax).toBeGreaterThanOrEqual(ex.repsMin);
          expect(ex.restSec).toBeGreaterThanOrEqual(45);
          expect(ex.rpeTarget).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it("covers all target goals: hypertrophy, strength, athletic, bodyweight", () => {
    const goals = new Set(BUILTIN_PROGRAMS.map((p) => p.goal));
    expect(goals.has("hypertrophy")).toBe(true);
    expect(goals.has("strength")).toBe(true);
    expect(goals.has("athletic")).toBe(true);
    expect(goals.has("bodyweight")).toBe(true);
  });
});

describe("Phase 4: Plateau Detection (B6)", () => {
  it("flags plateau when load & reps stall for 3 consecutive high-effort sessions", () => {
    const history = [
      { date: "2026-11-01", weightKg: 100, reps: 5, rpe: 8.5 },
      { date: "2026-11-08", weightKg: 100, reps: 5, rpe: 9.0 },
      { date: "2026-11-15", weightKg: 100, reps: 5, rpe: 9.5 },
    ];
    const analysis = detectPlateau(history);
    expect(analysis.isPlateaued).toBe(true);
    expect(analysis.sessionsStalled).toBe(3);
    expect(analysis.recommendations.length).toBe(3);

    const microLoad = analysis.recommendations.find((r) => r.strategy === "micro_loading");
    expect(microLoad?.suggestedWeightKg).toBe(101);

    const backOff = analysis.recommendations.find((r) => r.strategy === "back_off_reset");
    expect(backOff?.suggestedWeightKg).toBe(90);
  });

  it("returns not plateaued when progress continues", () => {
    const history = [
      { date: "2026-11-01", weightKg: 100, reps: 5, rpe: 8.0 },
      { date: "2026-11-08", weightKg: 102.5, reps: 5, rpe: 8.0 },
      { date: "2026-11-15", weightKg: 105, reps: 5, rpe: 8.5 },
    ];
    const analysis = detectPlateau(history);
    expect(analysis.isPlateaued).toBe(false);
  });
});

describe("Phase 4: Missed Session Rescheduling (B9, B10)", () => {
  const sampleSchedule: ScheduledDay[] = [
    { dayIndex: 1, name: "Push Day", focus: "Chest & Triceps", exercises: [{ name: "Bench Press", sets: 4, equipment: "barbell" }] },
    { dayIndex: 2, name: "Pull Day", focus: "Back & Biceps", exercises: [{ name: "Deadlift", sets: 4, equipment: "barbell" }] },
    { dayIndex: 3, name: "Legs Day", focus: "Quads & Calves", exercises: [{ name: "Squat", sets: 4, equipment: "barbell" }] },
  ];

  it("shifts schedule with rolling slide", () => {
    const res = rescheduleMissedSession(sampleSchedule, 2, "rolling_slide");
    expect(res.strategy).toBe("rolling_slide");
    const day2 = res.updatedSchedule.find((d) => d.name === "Pull Day");
    expect(day2?.dayIndex).toBe(3);
  });

  it("merges missed day with next day using antagonist supersets", () => {
    const res = rescheduleMissedSession(sampleSchedule, 1, "antagonist_merge");
    expect(res.strategy).toBe("antagonist_merge");
    const mergedDay = res.updatedSchedule.find((d) => d.dayIndex === 2);
    expect(mergedDay?.name).toContain("Push Day + Pull Day");
    expect(mergedDay?.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it("advances cleanly with forgive & advance", () => {
    const res = rescheduleMissedSession(sampleSchedule, 2, "forgive_advance");
    expect(res.strategy).toBe("forgive_advance");
    expect(res.updatedSchedule.length).toBe(2);
    expect(res.updatedSchedule.some((d) => d.name === "Pull Day")).toBe(false);
  });
});

describe("Phase 4: Crowded Gym Mode (B7)", () => {
  it("substitutes barbell equipment to dumbbell/cable alternatives", () => {
    const exercises = [
      { name: "Barbell Bench Press", primaryMuscle: "chest", equipment: "barbell", sets: 4, reps: 8 },
      { name: "Barbell Back Squat", primaryMuscle: "quads", equipment: "barbell", sets: 4, reps: 6 },
      { name: "Pull-Up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, reps: 8 },
    ];

    const result = adaptForCrowdedGym(exercises);
    expect(result.originalExerciseCount).toBe(3);
    expect(result.substitutedCount).toBe(2);

    expect(result.adaptedExercises[0].name).toBe("Heavy Dumbbell Bench Press");
    expect(result.adaptedExercises[0].equipment).toBe("dumbbell");

    expect(result.adaptedExercises[1].name).toBe("Bulgarian Split Squat");
    expect(result.adaptedExercises[1].equipment).toBe("dumbbell");

    // Pull-up was already bodyweight so not substituted
    expect(result.adaptedExercises[2].name).toBe("Pull-Up");
  });
});

describe("Phase 4: AI Coach Advanced Intelligence (F2)", () => {
  const dummyContext: CoachContext = {
    name: "Alex",
    readiness: 82,
    sleep: 7.8,
    hrv: 65,
    proteinTarget: 180,
    proteinConsumed: 120,
    caloriesTarget: 2600,
    caloriesConsumed: 1900,
    planName: "Push A",
    planFocus: "Chest & Shoulders",
    planExercises: ["Bench Press", "OHP", "Lateral Raise"],
    programName: "PPL Hypertrophy",
    lastWorkout: { name: "Pull A", daysAgo: 1, volume: 14200 },
    prs: [{ exercise: "Barbell Bench Press", value: 110 }],
    recovery: [{ label: "Chest", recovery: 92 }],
    streak: 18,
  };

  it("provides periodization advice when asked about a plateau or stall", () => {
    const reply = coachReply("I hit a plateau on bench press, how to break it?", dummyContext);
    expect(reply).toContain("Plateau detected");
    expect(reply).toContain("Micro-Loading");
    expect(reply).toContain("Periodized Rep Shift");
  });

  it("details deload protocol when asked about deloading", () => {
    const reply = coachReply("How should I structure my deload week?", dummyContext);
    expect(reply).toContain("The FORGE Deload Protocol");
    expect(reply).toContain("Intensity");
    expect(reply).toContain("Volume");
  });

  it("explains equipment alternatives when the gym is crowded", () => {
    const reply = coachReply("The gym is crowded and benches are full", dummyContext);
    expect(reply).toContain("Crowded Gym Mode");
    expect(reply).toContain("Heavy Dumbbell Bench Press");
  });

  it("provides reschedule advice when a session was missed", () => {
    const reply = coachReply("I missed my workout yesterday", dummyContext);
    expect(reply).toContain("Rolling Slide");
    expect(reply).toContain("Antagonist Superset Merge");
  });
});
