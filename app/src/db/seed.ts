import { randomUUID } from "crypto";
import { db, schema } from "./index";
import { EXERCISES, BASE_WEIGHTS } from "./exercise-data";
import { computeLevelProgress } from "../lib/engine";

const now = new Date();
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at = (daysAgo: number, hour = 18, minute = 30) => {
  const d = startOfDay(new Date(now.getTime() - daysAgo * DAY));
  d.setHours(hour, minute, 0, 0);
  return d;
};
const id = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;

// Deterministic pseudo-random so every seed looks the same
let seedState = 42;
const rnd = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const round25 = (n: number) => Math.round(n / 2.5) * 2.5;
const e1rm = (weight: number, reps: number) => Math.round(weight * (1 + reps / 30) * 10) / 10;

/* ───────────────────────────── USERS ───────────────────────────── */

const PEOPLE = [
  { key: "alex", name: "Alex Rivera", handle: "alexlifts", initials: "AR", accent: "#C9F73A", email: "alex@forge.app", bio: "Chasing a 500kg total. Software by day, barbell by night.", goal: "hypertrophy", exp: "intermediate", sex: "male", weight: 80.4, height: 178, streak: 18, xp: 12480, level: 24 },
  { key: "maya", name: "Maya Chen", handle: "mayabuilds", initials: "MC", accent: "#FF6B35", email: "maya@forge.app", bio: "Powerlifter · 3 plates and climbing", goal: "strength", exp: "advanced", sex: "female", weight: 63.2, height: 165, streak: 42, xp: 38210, level: 51 },
  { key: "jordan", name: "Jordan Blake", handle: "jblakefit", initials: "JB", accent: "#6EA8FF", email: "jordan@forge.app", bio: "Hybrid athlete. Run clubs & rack pulls.", goal: "recomp", exp: "intermediate", sex: "male", weight: 86.1, height: 185, streak: 9, xp: 8420, level: 17 },
  { key: "priya", name: "Priya Nair", handle: "priyalifts", initials: "PN", accent: "#F5A3FF", email: "priya@forge.app", bio: "Yoga + hypertrophy. Balance is a skill.", goal: "hypertrophy", exp: "intermediate", sex: "female", weight: 58.4, height: 162, streak: 27, xp: 19870, level: 32 },
  { key: "marcus", name: "Marcus Webb", handle: "mwebb", initials: "MW", accent: "#FFD166", email: "marcus@forge.app", bio: "Coaching humans, not algorithms.", goal: "strength", exp: "advanced", sex: "male", weight: 95.3, height: 190, streak: 63, xp: 52140, level: 68 },
  { key: "sofia", name: "Sofia Rossi", handle: "sofiarossi", initials: "SR", accent: "#7BE0AD", email: "sofia@forge.app", bio: "Deadlift specialist. Coffee is a macro.", goal: "strength", exp: "advanced", sex: "female", weight: 67.8, height: 170, streak: 31, xp: 27640, level: 39 },
  { key: "kenji", name: "Kenji Tanaka", handle: "kenjitrains", initials: "KT", accent: "#9B8CFF", email: "kenji@forge.app", bio: "Calisthenics → barbell. Learning in public.", goal: "hypertrophy", exp: "beginner", sex: "male", weight: 71.2, height: 174, streak: 4, xp: 2180, level: 6 },
];

async function seedUsers() {
  const rows = PEOPLE.map((p, i) => {
    const { level } = computeLevelProgress(p.xp);
    return {
      id: `u-${p.key}`,
      email: p.email,
      name: p.name,
      handle: p.handle,
      initials: p.initials,
      accent: p.accent,
      bio: p.bio,
      goal: p.goal,
      experience: p.exp,
      sex: p.sex,
      weightKg: p.weight,
      heightCm: p.height,
      unitPref: "kg",
      equipment: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "bands", "ez-bar"],
      streak: p.streak,
      xp: p.xp,
      level,
      onboarded: true,
      createdAt: new Date(now.getTime() - (180 - i * 12) * DAY),
    };
  });
  await db.insert(schema.users).values(rows);
  return rows;
}

/* ───────────────────────────── EXERCISES ───────────────────────────── */

async function seedExercises() {
  await db.insert(schema.exercises).values(
    EXERCISES.map((e) => ({
      id: `ex-${e.slug}`,
      slug: e.slug,
      name: e.name,
      primaryMuscle: e.primary,
      secondaryMuscles: e.secondary,
      equipment: e.equipment,
      category: e.category,
      pattern: e.pattern,
      unilateral: e.unilateral ?? false,
      difficulty: e.difficulty ?? "intermediate",
      instructions: e.instructions,
      cues: e.cues,
      tempo: "2-0-1",
      popularity: e.popularity,
    })),
  );
}

/* ───────────────────────────── PROGRAMS ───────────────────────────── */

type DaySpec = { name: string; focus: string; ex: [string, number, number, number, number, number?, string?][] };

const PROGRAMS: {
  key: string; name: string; subtitle: string; description: string; goal: string; level: string;
  daysPerWeek: number; weeks: number; accent: string; rating: number; members: number; days: DaySpec[];
}[] = [
  {
    key: "hypertrophy-forge", name: "Hypertrophy Forge", subtitle: "5-day Push / Pull / Legs",
    description: "A high-frequency PPL built around progressive overload, 12–20 weekly sets per muscle, and auto-regulated top sets. The default Forge program.",
    goal: "hypertrophy", level: "intermediate", daysPerWeek: 5, weeks: 8, accent: "#C9F73A", rating: 4.9, members: 48210,
    days: [
      { name: "Push A · Chest Bias", focus: "Chest · Shoulders · Triceps", ex: [
        ["bench-press", 4, 6, 8, 150, 8], ["incline-dumbbell-press", 3, 8, 10, 120, 8],
        ["lateral-raise", 4, 12, 15, 75, 9], ["triceps-pushdown", 3, 10, 12, 75, 9],
        ["overhead-triceps-extension", 3, 10, 12, 75, 9],
      ]},
      { name: "Pull A · Width", focus: "Lats · Upper back · Biceps", ex: [
        ["pull-up", 4, 6, 10, 150, 9], ["barbell-row", 4, 6, 8, 150, 8],
        ["face-pull", 3, 12, 15, 60, 9], ["barbell-curl", 3, 8, 10, 75, 9],
        ["hammer-curl", 3, 10, 12, 60, 9],
      ]},
      { name: "Legs A · Squat", focus: "Quads · Hamstrings · Calves", ex: [
        ["back-squat", 4, 5, 8, 180, 8], ["romanian-deadlift", 3, 8, 10, 150, 8],
        ["leg-press", 3, 10, 12, 120, 9], ["leg-curl", 3, 10, 12, 75, 9],
        ["calf-raise", 4, 12, 15, 60, 10],
      ]},
      { name: "Push B · Shoulder Bias", focus: "Shoulders · Chest · Triceps", ex: [
        ["overhead-press", 4, 6, 8, 150, 8], ["dumbbell-bench-press", 3, 8, 10, 120, 8],
        ["cable-fly", 3, 12, 15, 75, 9], ["lateral-raise", 4, 15, 20, 60, 10],
        ["close-grip-bench", 3, 8, 10, 120, 8],
      ]},
      { name: "Pull B · Thickness", focus: "Back · Rear delts · Biceps", ex: [
        ["deadlift", 3, 4, 6, 210, 8], ["lat-pulldown", 4, 8, 10, 120, 9],
        ["seated-cable-row", 3, 8, 10, 120, 9], ["rear-delt-fly", 3, 12, 15, 60, 9],
        ["cable-curl", 3, 12, 15, 60, 9],
      ]},
    ],
  },
  {
    key: "foundation-5x5", name: "Foundation 5×5", subtitle: "3-day full-body strength",
    description: "The fastest route from untrained to strong. Two alternating full-body days, heavy compounds, and a deadlift that gets respect.",
    goal: "strength", level: "beginner", daysPerWeek: 3, weeks: 12, accent: "#6EA8FF", rating: 4.8, members: 32140,
    days: [
      { name: "Workout A", focus: "Squat · Bench · Row", ex: [
        ["back-squat", 5, 5, 5, 180, 8], ["bench-press", 5, 5, 5, 180, 8],
        ["barbell-row", 5, 5, 5, 150, 8], ["plank", 3, 30, 45, 60, 7],
      ]},
      { name: "Workout B", focus: "Front squat · Press · Deadlift", ex: [
        ["front-squat", 5, 5, 5, 180, 8], ["overhead-press", 5, 5, 5, 180, 8],
        ["deadlift", 1, 5, 5, 240, 8], ["hanging-leg-raise", 3, 8, 12, 75, 8],
      ]},
    ],
  },
  {
    key: "powerbuild", name: "Upper / Lower Power-Build", subtitle: "4-day strength + size",
    description: "Two heavy days, two hypertrophy days. For lifters who want a bigger total without living under a barbell five times a week.",
    goal: "strength", level: "intermediate", daysPerWeek: 4, weeks: 10, accent: "#FF6B35", rating: 4.9, members: 26780,
    days: [
      { name: "Upper Power", focus: "Heavy horizontal push / pull", ex: [
        ["bench-press", 4, 4, 6, 180, 8], ["barbell-row", 4, 4, 6, 180, 8],
        ["overhead-press", 3, 6, 8, 150, 8], ["pull-up", 3, 6, 8, 120, 9],
        ["barbell-curl", 3, 8, 10, 60, 9],
      ]},
      { name: "Lower Power", focus: "Squat · Hinge", ex: [
        ["back-squat", 4, 4, 6, 210, 8], ["romanian-deadlift", 4, 6, 8, 150, 8],
        ["leg-press", 3, 8, 10, 120, 9], ["calf-raise", 4, 10, 12, 60, 10],
      ]},
      { name: "Upper Hypertrophy", focus: "Chest · Back · Arms", ex: [
        ["incline-dumbbell-press", 4, 8, 12, 90, 9], ["chest-supported-row", 4, 8, 12, 90, 9],
        ["lateral-raise", 4, 12, 15, 60, 10], ["triceps-pushdown", 3, 12, 15, 60, 9],
        ["hammer-curl", 3, 12, 15, 60, 9],
      ]},
      { name: "Lower Hypertrophy", focus: "Glutes · Quads · Hamstrings", ex: [
        ["hip-thrust", 4, 8, 12, 120, 9], ["bulgarian-split-squat", 3, 10, 12, 90, 9],
        ["leg-extension", 3, 12, 15, 60, 10], ["leg-curl", 3, 12, 15, 60, 10],
        ["seated-calf-raise", 4, 15, 20, 45, 10],
      ]},
    ],
  },
  {
    key: "metcon-shred", name: "Metcon / Shred", subtitle: "4-day conditioning + strength",
    description: "Strength circuits, zone-2 finishers, and enough variety to keep you consistent. Built for the busy lifter.",
    goal: "fat_loss", level: "beginner", daysPerWeek: 4, weeks: 6, accent: "#7BE0AD", rating: 4.7, members: 19420,
    days: [
      { name: "Strength + HIIT", focus: "Full body power", ex: [
        ["front-squat", 4, 6, 8, 120, 8], ["dumbbell-bench-press", 3, 8, 10, 90, 8],
        ["kettlebell-swing", 3, 15, 20, 45, 8], ["rower", 1, 8, 10, 60, 8],
      ]},
      { name: "Upper Circuit", focus: "Push · Pull · Carry", ex: [
        ["pull-up", 4, 6, 10, 75, 9], ["push-up", 3, 12, 20, 60, 9],
        ["dumbbell-shoulder-press", 3, 10, 12, 75, 9], ["farmer-carry", 3, 40, 60, 90, 8],
      ]},
      { name: "Lower Circuit", focus: "Legs · Glutes · Engine", ex: [
        ["goblet-squat", 4, 12, 15, 60, 9], ["walking-lunge", 3, 12, 16, 75, 9],
        ["glute-bridge", 3, 15, 20, 45, 9], ["assault-bike", 1, 10, 12, 60, 8],
      ]},
      { name: "Full Body Finisher", focus: "Hinge · Push · Engine", ex: [
        ["deadlift", 3, 5, 6, 150, 8], ["landmine-press", 3, 8, 10, 75, 9],
        ["burpee", 3, 10, 15, 60, 9], ["treadmill-incline", 1, 15, 20, 60, 7],
      ]},
    ],
  },
];

async function seedPrograms() {
  for (const p of PROGRAMS) {
    const routineId = `rt-${p.key}`;
    await db.insert(schema.routines).values({
      id: routineId, ownerId: "u-alex", name: p.name, subtitle: p.subtitle,
      description: p.description, goal: p.goal, level: p.level, daysPerWeek: p.daysPerWeek,
      weeks: p.weeks, accent: p.accent, isPublic: true, enrolled: p.key === "hypertrophy-forge",
      rating: p.rating, members: p.members, createdAt: new Date(now.getTime() - 60 * DAY),
    });
    for (let di = 0; di < p.days.length; di++) {
      const day = p.days[di];
      const dayId = `rd-${p.key}-${di}`;
      await db.insert(schema.routineDays).values({
        id: dayId, routineId, dayIndex: di, name: day.name, focus: day.focus,
      });
      await db.insert(schema.routineExercises).values(
        day.ex.map(([slug, sets, repsMin, repsMax, restSec, rpeTarget, superset], pos) => ({
          id: `re-${p.key}-${di}-${pos}`, routineDayId: dayId, exerciseId: `ex-${slug}`,
          position: pos, sets, repsMin, repsMax, restSec, rpeTarget: rpeTarget ?? 8,
          supersetGroup: superset ?? null,
        })),
      );
    }
  }
  return PROGRAMS;
}

/* ───────────────────────────── HISTORY ───────────────────────────── */

async function seedHistory(programs: typeof PROGRAMS) {
  const ppl = programs[0];
  const weightBySlug = { ...BASE_WEIGHTS };
  const best = new Map<string, { weight: number; reps: number; e1rm: number; date: Date; workoutId: string }>();
  const trainingWeekdays = [1, 2, 4, 5, 6]; // Mon Tue Thu Fri Sat

  let session = 0;
  for (let daysAgo = 56; daysAgo >= 1; daysAgo--) {
    const d = at(daysAgo);
    const weekday = d.getDay();
    const slot = trainingWeekdays.indexOf(weekday);
    if (slot === -1) continue;
    if (daysAgo % 11 === 0) continue; // realistic missed session
    session++;

    const daySpec = ppl.days[session % ppl.days.length];
    const week = Math.floor((56 - daysAgo) / 7);
    const progress = 0.86 + week * 0.022;
    const workoutId = `wk-hist-${daysAgo}`;
    const startedAt = at(daysAgo, 18, 10 + (session % 3) * 5);
    const durationSec = 3300 + Math.floor(rnd() * 1500);
    let volume = 0;
    let setCount = 0;

    const weRows: (typeof schema.workoutExercises.$inferInsert)[] = [];
    const setRows: (typeof schema.workoutSets.$inferInsert)[] = [];

    daySpec.ex.forEach(([slug, sets, repsMin, repsMax, restSec, rpeTarget], pos) => {
      const ex = EXERCISES.find((e) => e.slug === slug)!;
      weRows.push({
        id: `we-hist-${daysAgo}-${pos}`, workoutId, exerciseId: `ex-${slug}`, position: pos,
        targetSets: sets, repsMin, repsMax, restSec, rpeTarget: rpeTarget ?? 8, supersetGroup: null,
      });
      const base = weightBySlug[slug] ?? 0;
      const bodyweight = base === 0;
      const working = bodyweight
        ? slug === "plank" ? 0 : Math.round(80.4 * (slug === "pull-up" ? 0.72 : 0.62))
        : round25(base * progress);
      for (let s = 0; s < sets; s++) {
        if (rnd() < 0.06) continue; // occasional skipped set
        const reps = repsMin + Math.floor(rnd() * (repsMax - repsMin + 1));
        const fatigueDrop = s > 1 ? 0.97 : 1;
        const weight = bodyweight ? working : round25(working * fatigueDrop);
        const rpe = Math.min(10, (rpeTarget ?? 8) + (s === sets - 1 ? 0.5 : 0));
        volume += weight * reps;
        setCount++;
        const completedAt = new Date(startedAt.getTime() + (pos * 8 + s * 4) * 60_000);
        setRows.push({
          id: `ws-hist-${daysAgo}-${pos}-${s}`, workoutId, exerciseId: `ex-${slug}`,
          setIndex: s, weightKg: weight, reps, rpe, isWarmup: false, isPR: false, completedAt,
        });
        if (weight > 0 && reps >= 3) {
          const score = e1rm(weight, reps);
          const prev = best.get(slug);
          if (!prev || score > prev.e1rm) {
            best.set(slug, { weight, reps, e1rm: score, date: completedAt, workoutId });
          }
        }
      }
    });

    await db.insert(schema.workouts).values({
      id: workoutId, userId: "u-alex", routineId: "rt-hypertrophy-forge", name: daySpec.name,
      focus: daySpec.focus, status: "completed", readiness: 68 + Math.floor(rnd() * 28),
      startedAt, completedAt: new Date(startedAt.getTime() + durationSec * 1000),
      durationSec, totalVolume: Math.round(volume), totalSets: setCount,
      calories: 380 + Math.floor(rnd() * 220), notes: null, compressed: false,
    });
    if (weRows.length) await db.insert(schema.workoutExercises).values(weRows);
    if (setRows.length) await db.insert(schema.workoutSets).values(setRows);
  }

  // Headline PRs (a realistic 8-week snapshot)
  const prs: (typeof schema.personalRecords.$inferInsert)[] = [];
  const headline = [
    ["bench-press", 102.5, 5, 3], ["back-squat", 145, 5, 5], ["deadlift", 185, 3, 8],
    ["overhead-press", 62.5, 5, 12], ["barbell-row", 85, 8, 16], ["hip-thrust", 140, 8, 20],
  ] as const;
  headline.forEach(([slug, weight, reps, daysAgo]) => {
    prs.push({
      id: `pr-${slug}`, userId: "u-alex", exerciseId: `ex-${slug}`, type: "e1rm",
      value: e1rm(weight, reps), reps, achievedAt: at(daysAgo, 19, 0), workoutId: null,
    });
  });
  best.forEach((v, slug) => {
    if (headline.some(([s]) => s === slug)) return;
    if (v.e1rm < 20) return;
    prs.push({
      id: `pr-${slug}-hist`, userId: "u-alex", exerciseId: `ex-${slug}`, type: "e1rm",
      value: v.e1rm, reps: v.reps, achievedAt: v.date, workoutId: v.workoutId,
    });
  });
  await db.insert(schema.personalRecords).values(prs);
  return session;
}

/* ───────────────────────────── NUTRITION ───────────────────────────── */

async function seedNutrition() {
  await db.insert(schema.macroTargets).values({
    userId: "u-alex", calories: 2900, protein: 190, carbs: 330, fat: 80, waterMl: 3500,
  });
  const today = dateKey(now);
  const meals = [
    { meal: "breakfast", name: "Paneer bhurji + 2 roti", serving: "1 plate", calories: 520, protein: 28, carbs: 42, fat: 26, source: "photo", h: 8 },
    { meal: "lunch", name: "Grilled chicken rice bowl", serving: "1 bowl · 200g chicken", calories: 720, protein: 52, carbs: 78, fat: 18, source: "manual", h: 13 },
    { meal: "snack", name: "Greek yogurt, berries & honey", serving: "250g", calories: 240, protein: 20, carbs: 26, fat: 5, source: "barcode", h: 16 },
    { meal: "snack", name: "Whey isolate shake", serving: "1 scoop + water", calories: 160, protein: 30, carbs: 4, fat: 2, source: "voice", h: 17 },
  ];
  await db.insert(schema.nutritionLogs).values(
    meals.map((m, i) => ({
      id: `nl-today-${i}`, userId: "u-alex", date: today, meal: m.meal, name: m.name,
      serving: m.serving, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
      source: m.source, createdAt: at(0, m.h, 15),
    })),
  );
  await db.insert(schema.waterLogs).values([
    { id: "wl-1", userId: "u-alex", date: today, ml: 750, createdAt: at(0, 9, 0) },
    { id: "wl-2", userId: "u-alex", date: today, ml: 750, createdAt: at(0, 12, 30) },
    { id: "wl-3", userId: "u-alex", date: today, ml: 300, createdAt: at(0, 16, 0) },
  ]);

  // 7 days of nutrition history for the weekly chart
  const historyRows: (typeof schema.nutritionLogs.$inferInsert)[] = [];
  for (let d = 1; d <= 7; d++) {
    const k = dateKey(new Date(now.getTime() - d * DAY));
    const p = 150 + Math.floor(rnd() * 55);
    const c = 240 + Math.floor(rnd() * 110);
    const f = 60 + Math.floor(rnd() * 30);
    historyRows.push({
      id: `nl-hist-${d}`, userId: "u-alex", date: k, meal: "day", name: "Daily total",
      serving: "1 day", calories: Math.round(p * 4 + c * 4 + f * 9), protein: p, carbs: c, fat: f,
      source: "manual", createdAt: at(d, 22, 0),
    });
  }
  await db.insert(schema.nutritionLogs).values(historyRows);
}

/* ───────────────────────────── RECOVERY ───────────────────────────── */

async function seedMetrics() {
  const rows: (typeof schema.bodyMetrics.$inferInsert)[] = [];
  for (let d = 84; d >= 0; d--) {
    const t = (84 - d) / 84;
    const date = new Date(now.getTime() - d * DAY);
    rows.push({
      id: `bm-${d}`, userId: "u-alex", date: dateKey(date),
      weightKg: Math.round((84.8 - t * 4.4 + (rnd() - 0.5) * 0.5) * 10) / 10,
      bodyFat: Math.round((19.2 - t * 2.6 + (rnd() - 0.5) * 0.2) * 10) / 10,
      sleepHours: Math.round((6.4 + rnd() * 1.9) * 10) / 10,
      hrv: 52 + Math.floor(rnd() * 26),
      restingHr: 52 + Math.floor(rnd() * 8),
      soreness: d === 0 ? 4 : Math.floor(rnd() * 8),
      steps: 5200 + Math.floor(rnd() * 8200),
    });
  }
  await db.insert(schema.bodyMetrics).values(rows);
}

/* ───────────────────────────── SOCIAL ───────────────────────────── */

async function seedSocial() {
  const gymRows = [
    { id: "gym-iron", name: "Iron District", city: "Bengaluru", memberCount: 1840, busyness: 72, accent: "#C9F73A" },
    { id: "gym-barbell", name: "Barbell Society", city: "Bengaluru", memberCount: 960, busyness: 48, accent: "#FF6B35" },
    { id: "gym-pulse", name: "Pulse Fitness", city: "Bengaluru", memberCount: 2210, busyness: 35, accent: "#6EA8FF" },
    { id: "gym-yard", name: "The Yard", city: "Bengaluru", memberCount: 620, busyness: 88, accent: "#7BE0AD" },
  ];
  await db.insert(schema.gyms).values(gymRows);

  await db.insert(schema.checkins).values([
    { id: "ci-1", userId: "u-alex", gymId: "gym-iron", note: "Leg day. Pray for me.", createdAt: at(1, 18, 20) },
    { id: "ci-2", userId: "u-maya", gymId: "gym-barbell", note: "Squat rack secured.", createdAt: at(0, 17, 40) },
    { id: "ci-3", userId: "u-jordan", gymId: "gym-iron", note: "Upper power", createdAt: at(0, 18, 5) },
  ]);

  const followRows = PEOPLE.slice(1).map((p) => ({
    followerId: "u-alex", followingId: `u-${p.key}`, createdAt: new Date(now.getTime() - 40 * DAY),
  }));
  await db.insert(schema.follows).values([
    ...followRows,
    ...["maya", "jordan", "priya"].map((k) => ({ followerId: `u-${k}`, followingId: "u-alex", createdAt: new Date(now.getTime() - 30 * DAY) })),
  ]);

  const postRows: (typeof schema.posts.$inferInsert)[] = [
    {
      id: "post-1", userId: "u-maya", type: "pr", title: "New bench PR · 102.5 kg × 3",
      body: "Three plates is a mindset until it's a bar. 8 weeks of Forge Hypertrophy, zero missed sessions.",
      meta: { weight: "102.5 kg", reps: 3, e1rm: "112.8 kg", exercise: "Barbell Bench Press" },
      likes: 214, comments: 31, createdAt: at(0, 17, 42),
    },
    {
      id: "post-2", userId: "u-jordan", type: "checkin", title: "Checked in at Iron District",
      body: "The stair climber at the end was a war crime. 8,420 kg moved before it.",
      meta: { gym: "Iron District", volume: "8,420 kg", duration: "64 min" },
      likes: 96, comments: 12, createdAt: at(0, 18, 10),
    },
    {
      id: "post-3", userId: "u-priya", type: "streak", title: "27-day training streak",
      body: "Consistency isn't motivation. It's a calendar you refuse to break.",
      meta: { streak: 27, level: 32 },
      likes: 168, comments: 19, createdAt: at(0, 15, 20),
    },
    {
      id: "post-4", userId: "u-sofia", type: "pr", title: "Deadlift · 145 kg × 2",
      body: "Speed off the floor is back. 160 by December.",
      meta: { weight: "145 kg", reps: 2, e1rm: "154.7 kg", exercise: "Conventional Deadlift" },
      likes: 302, comments: 44, createdAt: at(1, 19, 30),
    },
    {
      id: "post-5", userId: "u-marcus", type: "workout", title: "Upper Power · 9,180 kg",
      body: "Coached three clients through this session, then did it myself. Volume is a love language.",
      meta: { volume: "9,180 kg", duration: "71 min", sets: 22 },
      likes: 87, comments: 8, createdAt: at(1, 20, 15),
    },
    {
      id: "post-6", userId: "u-kenji", type: "text", title: "Deload week. Boring. Necessary.",
      body: "Sleep 8h, eat protein, walk. See you in seven days, PRs.",
      meta: { readiness: 94 },
      likes: 54, comments: 5, createdAt: at(2, 9, 10),
    },
  ];
  await db.insert(schema.posts).values(postRows);

  await db.insert(schema.postComments).values([
    { id: "pc-1", postId: "post-1", userId: "u-jordan", content: "Textbook bar path on that third rep. Three plates loading soon.", createdAt: at(0, 17, 55) },
    { id: "pc-2", postId: "post-1", userId: "u-priya", content: "The consistency is the PR. Huge.", createdAt: at(0, 18, 2) },
    { id: "pc-3", postId: "post-2", userId: "u-alex", content: "8.4k before the stair climber is criminal volume. Respect.", createdAt: at(0, 18, 20) },
    { id: "pc-4", postId: "post-4", userId: "u-maya", content: "Bar speed looked easy. 160 is a formality.", createdAt: at(1, 19, 48) },
    { id: "pc-5", postId: "post-4", userId: "u-marcus", content: "Keep the hips down off the floor and that pulls 165 next block.", createdAt: at(1, 20, 12) },
    { id: "pc-6", postId: "post-6", userId: "u-sofia", content: "Deload gang. Recovery is a training block too.", createdAt: at(2, 9, 40) },
  ]);

  await db.insert(schema.postLikes).values([
    { postId: "post-1", userId: "u-alex", createdAt: at(0, 17, 50) },
    { postId: "post-2", userId: "u-alex", createdAt: at(0, 18, 15) },
    { postId: "post-4", userId: "u-alex", createdAt: at(1, 20, 0) },
    { postId: "post-5", userId: "u-alex", createdAt: at(1, 20, 30) },
  ]);

  await db.insert(schema.challenges).values([
    {
      id: "ch-squat", title: "Squat Every Day", description: "20 squat sessions in 30 days. Any variation counts. Consistency over ego.",
      metric: "sessions", target: 20, unit: "sessions", startsAt: at(14, 0, 0), endsAt: at(-16, 23, 59),
      participants: 18420, accent: "#C9F73A", joined: true, progress: 14,
    },
    {
      id: "ch-volume", title: "100K Volume Club", description: "Move 100,000 kg this month. Every set logged counts. No cap on ambition.",
      metric: "volume", target: 100000, unit: "kg", startsAt: at(20, 0, 0), endsAt: at(-10, 23, 59),
      participants: 9310, accent: "#FF6B35", joined: true, progress: 68400,
    },
    {
      id: "ch-protein", title: "Protein Consistency", description: "Hit your protein target 25 days this month. The unsexy superpower.",
      metric: "protein", target: 25, unit: "days", startsAt: at(5, 0, 0), endsAt: at(-25, 23, 59),
      participants: 26750, accent: "#6EA8FF", joined: false, progress: 0,
    },
  ]);

  await db.insert(schema.coachMessages).values([
    {
      id: "cm-1", userId: "u-alex", role: "coach",
      content: "Morning, Alex. Readiness is 82 — sleep was 7.4h and HRV is trending up. Today is Push A. Your bench top set is 92.5 kg for 6 at RPE 8. Want me to load the session?",
      createdAt: at(0, 7, 10),
    },
    {
      id: "cm-2", userId: "u-alex", role: "user", content: "Bench felt heavy on Monday. Should I drop the weight?",
      createdAt: at(0, 7, 14),
    },
    {
      id: "cm-3", userId: "u-alex", role: "coach",
      content: "Yes — auto-regulate down 5%. Hit 87.5 kg × 6 @ RPE 8 and add one back-off set at 80 kg. Your e1RM trend is still up 4.2% this month, so one lighter day protects the trend.",
      createdAt: at(0, 7, 15),
    },
  ]);
}

/* ───────────────────────────── RUN ───────────────────────────── */

async function main() {
  console.log("🔥 Seeding Forge…");
  const tables = [
    schema.postComments, schema.postLikes, schema.posts, schema.checkins, schema.follows, schema.coachMessages,
    schema.waterLogs, schema.nutritionLogs, schema.macroTargets, schema.bodyMetrics,
    schema.personalRecords, schema.workoutSets, schema.workoutExercises, schema.workouts,
    schema.routineExercises, schema.routineDays, schema.routines, schema.challenges,
    schema.gyms, schema.exercises, schema.users,
  ];
  for (const t of tables) await db.delete(t);

  await seedUsers();
  console.log("  ✓ users");
  await seedExercises();
  console.log("  ✓ exercises");
  const programs = await seedPrograms();
  console.log("  ✓ programs");
  const sessions = await seedHistory(programs);
  console.log(`  ✓ ${sessions} historical workouts`);
  await seedNutrition();
  console.log("  ✓ nutrition");
  await seedMetrics();
  console.log("  ✓ recovery metrics");
  await seedSocial();
  console.log("  ✓ social");
  console.log("✅ Forge seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
