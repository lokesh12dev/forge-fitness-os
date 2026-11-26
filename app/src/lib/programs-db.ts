/**
 * FORGE Built-in Programs Database (F1)
 *
 * 10 battle-tested, periodized programs spanning strength, hypertrophy,
 * athletic conditioning, and calisthenics with clear progression rules.
 */

export interface ProgramExercisePrescription {
  name: string;
  slug: string;
  primaryMuscle: string;
  equipment: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  rpeTarget: number;
  supersetGroup?: string;
  notes?: string;
}

export interface ProgramDayPrescription {
  id: string;
  name: string;
  focus: string;
  exercises: ProgramExercisePrescription[];
}

export interface BuiltinProgram {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  goal: "hypertrophy" | "strength" | "athletic" | "bodyweight";
  level: "Beginner" | "Intermediate" | "Advanced";
  daysPerWeek: number;
  weeks: number;
  accent: string;
  rating: number;
  members: number;
  progressionRule: string;
  days: ProgramDayPrescription[];
}

export const BUILTIN_PROGRAMS: BuiltinProgram[] = [
  {
    id: "ppl-hypertrophy",
    name: "Push Pull Legs (PPL)",
    subtitle: "6-Day Hypertrophy Specialization",
    description: "The gold standard split for maximal muscle hypertrophy. Synergistic muscle groupings allow high frequency and volume with optimal 48-72h recovery between sessions.",
    goal: "hypertrophy",
    level: "Intermediate",
    daysPerWeek: 6,
    weeks: 8,
    accent: "#C9F73A",
    rating: 4.95,
    members: 2840,
    progressionRule: "Double progression: hit top of rep range on all working sets with RPE ≤ 8, then increase load by 2.5kg.",
    days: [
      {
        id: "ppl-push-1",
        name: "Push A (Chest Focus)",
        focus: "Chest, Shoulders & Triceps",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 180, rpeTarget: 8 },
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Incline Dumbbell Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Tricep Pushdown", slug: "tricep-pushdown", primaryMuscle: "triceps", equipment: "cable", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ppl-pull-1",
        name: "Pull A (Back Width & Biceps)",
        focus: "Lats, Upper Back & Biceps",
        exercises: [
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 6, repsMax: 10, restSec: 120, rpeTarget: 8.5 },
          { name: "Barbell Bent Over Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 90, rpeTarget: 8 },
          { name: "Face Pull", slug: "face-pull", primaryMuscle: "shoulders", equipment: "cable", sets: 4, repsMin: 15, repsMax: 20, restSec: 60, rpeTarget: 8.5 },
          { name: "Barbell Bicep Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ppl-legs-1",
        name: "Legs A (Quad Dominant)",
        focus: "Quads, Hamstrings & Calves",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 180, rpeTarget: 8 },
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ppl-push-2",
        name: "Push B (Shoulder Focus)",
        focus: "Deltoids, Upper Chest & Triceps",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 180, rpeTarget: 8 },
          { name: "Incline Barbell Bench", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Dips", slug: "dips", primaryMuscle: "chest", equipment: "bodyweight", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Cable Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "cable", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Skull Crusher", slug: "skull-crusher", primaryMuscle: "triceps", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ppl-pull-2",
        name: "Pull B (Thickness Focus)",
        focus: "Mid-Back, Traps & Forearms",
        exercises: [
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Seated Cable Row", slug: "seated-cable-row", primaryMuscle: "back", equipment: "cable", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Incline Dumbbell Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
          { name: "Hammer Curl", slug: "hammer-curl", primaryMuscle: "biceps", equipment: "dumbbell", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ppl-legs-2",
        name: "Legs B (Posterior Chain)",
        focus: "Hamstrings, Glutes & Quads",
        exercises: [
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8 },
          { name: "Leg Press", slug: "leg-press", primaryMuscle: "quads", equipment: "machine", sets: 3, repsMin: 10, repsMax: 12, restSec: 120, rpeTarget: 8.5 },
          { name: "Leg Curl", slug: "leg-curl", primaryMuscle: "hamstrings", equipment: "machine", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "upper-lower-4day",
    name: "Upper / Lower Split",
    subtitle: "4-Day Strength & Density",
    description: "The ideal balance of frequency, recovery, and life flexibility. Hits each muscle group twice weekly with dedicated upper and lower body workout days.",
    goal: "hypertrophy",
    level: "Intermediate",
    daysPerWeek: 4,
    weeks: 8,
    accent: "#6EA8FF",
    rating: 4.92,
    members: 2150,
    progressionRule: "Linear cycle: Heavy days aim for 4-6 rep strength PRs; Volume days employ 8-12 rep double progression.",
    days: [
      {
        id: "ul-upper-1",
        name: "Upper Power",
        focus: "Horizontal Push/Pull Strength",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 4, repsMin: 4, repsMax: 6, restSec: 180, rpeTarget: 8 },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 4, repsMax: 6, restSec: 180, rpeTarget: 8 },
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8 },
          { name: "Chin-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8.5 },
        ],
      },
      {
        id: "ul-lower-1",
        name: "Lower Power",
        focus: "Squat & Posterior Chain",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 4, repsMin: 4, repsMax: 6, restSec: 180, rpeTarget: 8 },
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8 },
          { name: "Leg Press", slug: "leg-press", primaryMuscle: "quads", equipment: "machine", sets: 3, repsMin: 8, repsMax: 10, restSec: 90, rpeTarget: 8.5 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "machine", sets: 4, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ul-upper-2",
        name: "Upper Hypertrophy",
        focus: "Volume & Pump",
        exercises: [
          { name: "Incline Dumbbell Bench Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Dips", slug: "dips", primaryMuscle: "triceps", equipment: "bodyweight", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
          { name: "Barbell Bicep Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "ul-lower-2",
        name: "Lower Hypertrophy",
        focus: "Hamstring & Quad Volume",
        exercises: [
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Leg Curl", slug: "leg-curl", primaryMuscle: "hamstrings", equipment: "machine", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "full-body-3x",
    name: "Full Body 3x",
    subtitle: "High-Efficiency Foundation",
    description: "Maximum results for busy lifters. 3 non-consecutive days hitting whole-body compounds with 48 hours recovery between sessions.",
    goal: "strength",
    level: "Beginner",
    daysPerWeek: 3,
    weeks: 10,
    accent: "#FFD166",
    rating: 4.88,
    members: 1980,
    progressionRule: "Add 2.5kg to upper body lifts every week and 5.0kg to squats and deadlifts.",
    days: [
      {
        id: "fb-day-1",
        name: "Full Body A",
        focus: "Squat + Bench + Row",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 7.5 },
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 7.5 },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 8, restSec: 120, rpeTarget: 8 },
        ],
      },
      {
        id: "fb-day-2",
        name: "Full Body B",
        focus: "Deadlift + OHP + Chins",
        exercises: [
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 150, rpeTarget: 8 },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8 },
        ],
      },
      {
        id: "fb-day-3",
        name: "Full Body C",
        focus: "Squat + Incline + Arms",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 8, restSec: 150, rpeTarget: 8 },
          { name: "Incline Dumbbell Bench Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Barbell Bicep Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "strength-531-bbb",
    name: "5/3/1 Boring But Big",
    subtitle: "Jim Wendler Pure Strength & Mass",
    description: "Submaximal percentage wave training paired with 5 sets of 10 reps assistance for massive raw strength and armor-like muscular density.",
    goal: "strength",
    level: "Advanced",
    daysPerWeek: 4,
    weeks: 6,
    accent: "#FF6B35",
    rating: 4.96,
    members: 1650,
    progressionRule: "4-week wave: Week 1 (3x5), Week 2 (3x3), Week 3 (5/3/1+), Week 4 (Deload). Advance Training Max by 2.5kg (upper) and 5kg (lower) per cycle.",
    days: [
      {
        id: "531-squat",
        name: "Squat Day",
        focus: "Squat 5/3/1 + 5x10 Squat",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Barbell Back Squat (BBB)", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 5, repsMin: 10, repsMax: 10, restSec: 90, rpeTarget: 7 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8 },
        ],
      },
      {
        id: "531-bench",
        name: "Bench Day",
        focus: "Bench 5/3/1 + 5x10 Bench",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Barbell Bench Press (BBB)", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 5, repsMin: 10, repsMax: 10, restSec: 90, rpeTarget: 7 },
          { name: "Dumbbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "dumbbell", sets: 4, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 8 },
        ],
      },
      {
        id: "531-deadlift",
        name: "Deadlift Day",
        focus: "Deadlift 5/3/1 + 5x10 Deadlift",
        exercises: [
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8 },
          { name: "Barbell Deadlift (BBB)", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 5, repsMin: 10, repsMax: 10, restSec: 90, rpeTarget: 7 },
          { name: "Leg Curl", slug: "leg-curl", primaryMuscle: "hamstrings", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "531-press",
        name: "Overhead Press Day",
        focus: "OHP 5/3/1 + 5x10 OHP",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 5, repsMax: 5, restSec: 150, rpeTarget: 8 },
          { name: "Overhead Press (BBB)", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 5, repsMin: 10, repsMax: 10, restSec: 90, rpeTarget: 7 },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 4, repsMin: 8, repsMax: 10, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "gzclp-linear",
    name: "GZCLP Linear Progression",
    subtitle: "Tiered Powerbuilding Methodology",
    description: "Cody Lefever's structured system dividing exercises into Tier 1 (Heavy Compounds 5x3+), Tier 2 (Volume 3x10), and Tier 3 (Accessories 3x15+).",
    goal: "strength",
    level: "Beginner",
    daysPerWeek: 4,
    weeks: 12,
    accent: "#A78BFA",
    rating: 4.91,
    members: 1420,
    progressionRule: "Fail Tier 1 5x3 → switch to 6x2 → fail → switch to 10x1 → retest 5RM and reset.",
    days: [
      {
        id: "gzclp-a1",
        name: "Day 1 (T1 Squat / T2 Bench)",
        focus: "Squat Heavy + Bench Volume",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 5, repsMin: 3, repsMax: 3, restSec: 180, rpeTarget: 8.5 },
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 3, repsMin: 15, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "gzclp-b1",
        name: "Day 2 (T1 OHP / T2 Deadlift)",
        focus: "OHP Heavy + Deadlift Volume",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 5, repsMin: 3, repsMax: 3, restSec: 180, rpeTarget: 8.5 },
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 15, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "gzclp-a2",
        name: "Day 3 (T1 Bench / T2 Squat)",
        focus: "Bench Heavy + Squat Volume",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 5, repsMin: 3, repsMax: 3, restSec: 180, rpeTarget: 8.5 },
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 15, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "gzclp-b2",
        name: "Day 4 (T1 Deadlift / T2 OHP)",
        focus: "Deadlift Heavy + OHP Volume",
        exercises: [
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 5, repsMin: 3, repsMax: 3, restSec: 180, rpeTarget: 8.5 },
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Face Pull", slug: "face-pull", primaryMuscle: "shoulders", equipment: "cable", sets: 3, repsMin: 15, repsMax: 20, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "phul-power-hypertrophy",
    name: "PHUL 4-Day Power Hypertrophy",
    subtitle: "Strength & Size Dual Periodization",
    description: "Brandon Campbell's proven system combining pure 3-5 rep strength days with 8-12 rep hypertrophy days for optimal muscle shape and neural power.",
    goal: "hypertrophy",
    level: "Intermediate",
    daysPerWeek: 4,
    weeks: 8,
    accent: "#38BDF8",
    rating: 4.89,
    members: 1820,
    progressionRule: "Add weight when top reps are hit on power days; utilize RPE auto-regulation on pump movements.",
    days: [
      {
        id: "phul-up-power",
        name: "Upper Power",
        focus: "Bench + Row Strength",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 4, repsMin: 3, repsMax: 5, restSec: 180, rpeTarget: 8.5 },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 3, repsMax: 5, restSec: 180, rpeTarget: 8.5 },
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 3, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8 },
          { name: "Skull Crusher", slug: "skull-crusher", primaryMuscle: "triceps", equipment: "barbell", sets: 3, repsMin: 6, repsMax: 8, restSec: 90, rpeTarget: 8.5 },
        ],
      },
      {
        id: "phul-low-power",
        name: "Lower Power",
        focus: "Squat + Deadlift Strength",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 4, repsMin: 3, repsMax: 5, restSec: 180, rpeTarget: 8.5 },
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 3, repsMin: 3, repsMax: 5, restSec: 180, rpeTarget: 8.5 },
          { name: "Leg Press", slug: "leg-press", primaryMuscle: "quads", equipment: "machine", sets: 3, repsMin: 8, repsMax: 10, restSec: 90, rpeTarget: 8 },
        ],
      },
      {
        id: "phul-up-hyp",
        name: "Upper Hypertrophy",
        focus: "Incline + Cable Isolation",
        exercises: [
          { name: "Incline Dumbbell Bench Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Barbell Bicep Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "barbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "phul-low-hyp",
        name: "Lower Hypertrophy",
        focus: "RDL + Lunges + Calves",
        exercises: [
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
    ],
  },
  {
    id: "arnold-golden-split",
    name: "Arnold Classic Split",
    subtitle: "High-Volume Antagonist Pairs",
    description: "Arnold Schwarzenegger's classic 6-day split pairing opposing muscle groups (Chest/Back, Shoulders/Arms, Legs) for skin-splitting pumps and posture balance.",
    goal: "hypertrophy",
    level: "Advanced",
    daysPerWeek: 6,
    weeks: 8,
    accent: "#F43F5E",
    rating: 4.97,
    members: 2430,
    progressionRule: "Wave intensity between heavy sets (6-8 reps) and burnout supersets (12-15 reps).",
    days: [
      {
        id: "arnold-cb-1",
        name: "Chest & Back A",
        focus: "Antagonist Push/Pull",
        exercises: [
          { name: "Barbell Bench Press", slug: "barbell-bench-press", primaryMuscle: "chest", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8.5, supersetGroup: "A" },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8.5, supersetGroup: "A" },
          { name: "Incline Dumbbell Bench Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5, supersetGroup: "B" },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 8, repsMax: 10, restSec: 90, rpeTarget: 8.5, supersetGroup: "B" },
        ],
      },
      {
        id: "arnold-sa-1",
        name: "Shoulders & Arms A",
        focus: "Delts, Biceps & Triceps",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 120, rpeTarget: 8 },
          { name: "Barbell Bicep Curl", slug: "bicep-curl", primaryMuscle: "biceps", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 60, rpeTarget: 9, supersetGroup: "C" },
          { name: "Skull Crusher", slug: "skull-crusher", primaryMuscle: "triceps", equipment: "barbell", sets: 3, repsMin: 8, repsMax: 10, restSec: 60, rpeTarget: 9, supersetGroup: "C" },
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "arnold-leg-1",
        name: "Legs A",
        focus: "Squat & Calves",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 5, repsMin: 6, repsMax: 8, restSec: 180, rpeTarget: 8 },
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "arnold-cb-2",
        name: "Chest & Back B",
        focus: "Volume Focus",
        exercises: [
          { name: "Dips", slug: "dips", primaryMuscle: "chest", equipment: "bodyweight", sets: 4, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 4, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
        ],
      },
      {
        id: "arnold-sa-2",
        name: "Shoulders & Arms B",
        focus: "Cable & Dumbbell Volume",
        exercises: [
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
          { name: "Hammer Curl", slug: "hammer-curl", primaryMuscle: "biceps", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
          { name: "Tricep Pushdown", slug: "tricep-pushdown", primaryMuscle: "triceps", equipment: "cable", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "arnold-leg-2",
        name: "Legs B",
        focus: "Bulgarian Split + Hamstring Curl",
        exercises: [
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 4, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Leg Curl", slug: "leg-curl", primaryMuscle: "hamstrings", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
    ],
  },
  {
    id: "calisthenics-mastery",
    name: "Calisthenics & Bodyweight Strength",
    subtitle: "Relative Strength & Core Mastery",
    description: "Build a shredded, mobile physique using bodyweight leverage, pull-up progressions, parallel bar dips, and gymnastic core strength.",
    goal: "bodyweight",
    level: "Intermediate",
    daysPerWeek: 4,
    weeks: 8,
    accent: "#10B981",
    rating: 4.87,
    members: 1210,
    progressionRule: "Add reps until 15 clean reps, then introduce weight belts with 2.5kg micro-plates.",
    days: [
      {
        id: "cal-upper-1",
        name: "Pull & Push Power",
        focus: "Weighted Pull-Up & Dip",
        exercises: [
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 4, repsMin: 5, repsMax: 8, restSec: 150, rpeTarget: 8.5 },
          { name: "Dips", slug: "dips", primaryMuscle: "chest", equipment: "bodyweight", sets: 4, repsMin: 6, repsMax: 10, restSec: 120, rpeTarget: 8.5 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "cal-lower-1",
        name: "Legs & Mobility",
        focus: "Single Leg Strength",
        exercises: [
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 4, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "bodyweight", sets: 4, repsMin: 15, repsMax: 20, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "cal-upper-2",
        name: "Volume & Skill",
        focus: "Chin-Ups & Push-Ups",
        exercises: [
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 4, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Dips", slug: "dips", primaryMuscle: "chest", equipment: "bodyweight", sets: 4, repsMin: 10, repsMax: 15, restSec: 90, rpeTarget: 8.5 },
        ],
      },
      {
        id: "cal-core-2",
        name: "Posterior & Core",
        focus: "Hanging Core & Nordic Prep",
        exercises: [
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
    ],
  },
  {
    id: "female-glute-hypertrophy",
    name: "Glute & Lower Body Focus",
    subtitle: "Posterior Chain Specialization",
    description: "Curated lower body specialization emphasizing hip thrusts, deep squats, Romanian deadlifts, and abduction volume without overtaxing upper body recovery.",
    goal: "hypertrophy",
    level: "Intermediate",
    daysPerWeek: 4,
    weeks: 8,
    accent: "#EC4899",
    rating: 4.94,
    members: 2280,
    progressionRule: "Prioritize full hip extension at top of hip thrusts and control 3-second eccentrics on RDLs.",
    days: [
      {
        id: "glute-heavy",
        name: "Glute & Quad Power",
        focus: "Barbell Squat + Hip Thrust",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 4, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8 },
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
        ],
      },
      {
        id: "glute-upper-1",
        name: "Upper Body & Posture",
        focus: "Back, Shoulders & Arms",
        exercises: [
          { name: "Incline Dumbbell Bench Press", slug: "incline-dumbbell-bench-press", primaryMuscle: "chest", equipment: "dumbbell", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8 },
          { name: "Lat Pulldown", slug: "lat-pulldown", primaryMuscle: "lats", equipment: "cable", sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8 },
          { name: "Lateral Raise", slug: "lateral-raise", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
      {
        id: "glute-hypertrophy",
        name: "Glute Pump & Hamstrings",
        focus: "High-Rep Deadlift & Lunges",
        exercises: [
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 12, repsMax: 15, restSec: 75, rpeTarget: 8.5 },
          { name: "Leg Curl", slug: "leg-curl", primaryMuscle: "hamstrings", equipment: "machine", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9 },
        ],
      },
      {
        id: "glute-upper-2",
        name: "Upper Maintenance & Core",
        focus: "Delts & Core Tone",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "dumbbell", sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
  {
    id: "athletic-power-speed",
    name: "Athletic Performance & Power",
    subtitle: "Speed, Explosiveness & Durability",
    description: "Designed for sport performance. Combines rate of force development, explosive hinge power, unilateral balance, and deceleration mechanics.",
    goal: "athletic",
    level: "Advanced",
    daysPerWeek: 4,
    weeks: 8,
    accent: "#EAB308",
    rating: 4.93,
    members: 1540,
    progressionRule: "Focus on maximum bar velocity on every rep; never train to technical failure.",
    days: [
      {
        id: "ath-power-1",
        name: "Lower Speed & Force",
        focus: "Explosive Squat & Deadlift",
        exercises: [
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 5, repsMin: 3, repsMax: 3, restSec: 150, rpeTarget: 7.5 },
          { name: "Barbell Deadlift", slug: "barbell-deadlift", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 3, repsMax: 3, restSec: 180, rpeTarget: 7.5 },
          { name: "Bulgarian Split Squat", slug: "bulgarian-split-squat", primaryMuscle: "quads", equipment: "dumbbell", sets: 3, repsMin: 6, repsMax: 6, restSec: 90, rpeTarget: 8 },
        ],
      },
      {
        id: "ath-power-2",
        name: "Upper Kinetic Chain",
        focus: "Push Press & Explosive Rows",
        exercises: [
          { name: "Overhead Press", slug: "overhead-press", primaryMuscle: "shoulders", equipment: "barbell", sets: 4, repsMin: 4, repsMax: 4, restSec: 150, rpeTarget: 8 },
          { name: "Barbell Row", slug: "barbell-row", primaryMuscle: "back", equipment: "barbell", sets: 4, repsMin: 5, repsMax: 5, restSec: 120, rpeTarget: 8 },
          { name: "Pull-Up", slug: "pull-up", primaryMuscle: "lats", equipment: "bodyweight", sets: 3, repsMin: 6, repsMax: 8, restSec: 90, rpeTarget: 8 },
        ],
      },
      {
        id: "ath-power-3",
        name: "Unilateral Power & Hips",
        focus: "RDL + Single Leg Drive",
        exercises: [
          { name: "Romanian Deadlift", slug: "romanian-deadlift", primaryMuscle: "hamstrings", equipment: "barbell", sets: 4, repsMin: 5, repsMax: 5, restSec: 120, rpeTarget: 8 },
          { name: "Barbell Back Squat", slug: "barbell-back-squat", primaryMuscle: "quads", equipment: "barbell", sets: 3, repsMin: 6, repsMax: 6, restSec: 120, rpeTarget: 7.5 },
        ],
      },
      {
        id: "ath-power-4",
        name: "Conditioning & Durability",
        focus: "Dips + Core + Calves",
        exercises: [
          { name: "Dips", slug: "dips", primaryMuscle: "chest", equipment: "bodyweight", sets: 3, repsMin: 8, repsMax: 10, restSec: 90, rpeTarget: 8 },
          { name: "Hanging Leg Raise", slug: "hanging-leg-raise", primaryMuscle: "core", equipment: "bodyweight", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
          { name: "Standing Calf Raise", slug: "standing-calf-raise", primaryMuscle: "calves", equipment: "machine", sets: 4, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 8.5 },
        ],
      },
    ],
  },
];
