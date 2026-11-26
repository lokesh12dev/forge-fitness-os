import { clamp } from "./utils";

export const MUSCLES = [
  { key: "chest", label: "Chest", color: "#C9F73A" },
  { key: "back", label: "Back", color: "#6EA8FF" },
  { key: "lats", label: "Lats", color: "#7BE0AD" },
  { key: "shoulders", label: "Shoulders", color: "#FFD166" },
  { key: "biceps", label: "Biceps", color: "#F5A3FF" },
  { key: "triceps", label: "Triceps", color: "#B49CFF" },
  { key: "quads", label: "Quads", color: "#FF6B35" },
  { key: "hamstrings", label: "Hamstrings", color: "#FF8FA3" },
  { key: "glutes", label: "Glutes", color: "#FFB86B" },
  { key: "calves", label: "Calves", color: "#8BE3D2" },
  { key: "core", label: "Core", color: "#D7E36B" },
  { key: "forearms", label: "Forearms", color: "#A8B3C4" },
] as const;

export type MuscleKey = (typeof MUSCLES)[number]["key"];

export function muscleLabel(key: string) {
  return MUSCLES.find((m) => m.key === key)?.label ?? "Full body";
}

export function muscleColor(key: string) {
  return MUSCLES.find((m) => m.key === key)?.color ?? "#C9F73A";
}

export function roundTo(n: number, step = 2.5) {
  return Math.max(0, Math.round(n / step) * step);
}

export function e1rm(weightKg: number, reps: number) {
  if (!weightKg || !reps) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function readinessScore(input: {
  sleepHours?: number | null;
  hrv?: number | null;
  restingHr?: number | null;
  soreness?: number | null;
}) {
  const sleep = input.sleepHours ?? 7;
  const hrv = input.hrv ?? 62;
  const rhr = input.restingHr ?? 56;
  const soreness = input.soreness ?? 3;
  const sleepPts = clamp((sleep - 5.5) / 3, 0, 1) * 34;
  const hrvPts = clamp((hrv - 40) / 45, 0, 1) * 30;
  const rhrPts = clamp((70 - rhr) / 20, 0, 1) * 16;
  const sorePts = clamp(1 - soreness / 10, 0, 1) * 20;
  return Math.round(clamp(12 + sleepPts + hrvPts + rhrPts + sorePts, 20, 99));
}

export function readinessVerdict(score: number) {
  if (score >= 85) return { label: "Primed", tone: "acid", advice: "Push the top set. Your body is ready for a PR attempt." };
  if (score >= 70) return { label: "Ready", tone: "mint", advice: "Train as planned. Auto-regulate the last set by feel." };
  if (score >= 55) return { label: "Moderate", tone: "amber", advice: "Keep the volume, drop intensity 5–8%. Quality reps only." };
  return { label: "Depleted", tone: "flame", advice: "Deload or zone-2 today. Recovery is the workout." };
}

/**
 * How much of the readiness score is backed by real inputs.
 * 1.0 means all four signals present; 0 means every signal is a default.
 */
export function readinessConfidence(input: {
  sleepHours?: number | null;
  hrv?: number | null;
  restingHr?: number | null;
  soreness?: number | null;
}) {
  const present = [input.sleepHours, input.hrv, input.restingHr, input.soreness].filter(
    (v) => v != null,
  ).length;
  return present / 4;
}

export type ReadinessFactor = {
  key: string;
  label: string;
  value: string;
  target: string;
  pts: number;
  maxPts: number;
  pct: number;
  status: "optimal" | "fair" | "warn";
};

export function readinessBreakdown(input: {
  sleepHours?: number | null;
  hrv?: number | null;
  restingHr?: number | null;
  soreness?: number | null;
}): { score: number; factors: ReadinessFactor[] } {
  const sleep = input.sleepHours ?? 7;
  const hrv = input.hrv ?? 62;
  const rhr = input.restingHr ?? 56;
  const soreness = input.soreness ?? 3;
  const sleepPts = Math.round(clamp((sleep - 5.5) / 3, 0, 1) * 34);
  const hrvPts = Math.round(clamp((hrv - 40) / 45, 0, 1) * 30);
  const rhrPts = Math.round(clamp((70 - rhr) / 20, 0, 1) * 16);
  const sorePts = Math.round(clamp(1 - soreness / 10, 0, 1) * 20);
  const score = Math.round(clamp(12 + sleepPts + hrvPts + rhrPts + sorePts, 20, 99));

  return {
    score,
    factors: [
      {
        key: "sleep",
        label: "Sleep",
        value: `${sleep}h`,
        target: "8h",
        pts: sleepPts,
        maxPts: 34,
        pct: Math.round((sleepPts / 34) * 100),
        status: sleep >= 7 ? "optimal" : sleep >= 6 ? "fair" : "warn",
      },
      {
        key: "hrv",
        label: "HRV",
        value: `${hrv} ms`,
        target: "65+ ms",
        pts: hrvPts,
        maxPts: 30,
        pct: Math.round((hrvPts / 30) * 100),
        status: hrv >= 60 ? "optimal" : hrv >= 48 ? "fair" : "warn",
      },
      {
        key: "rhr",
        label: "Resting HR",
        value: `${rhr} bpm`,
        target: "<60 bpm",
        pts: rhrPts,
        maxPts: 16,
        pct: Math.round((rhrPts / 16) * 100),
        status: rhr <= 58 ? "optimal" : rhr <= 68 ? "fair" : "warn",
      },
      {
        key: "soreness",
        label: "Soreness",
        value: `${soreness}/10`,
        target: "<4/10",
        pts: sorePts,
        maxPts: 20,
        pct: Math.round((sorePts / 20) * 100),
        status: soreness <= 4 ? "optimal" : soreness <= 6 ? "fair" : "warn",
      },
    ],
  };
}

/** Computes auto-regulated target weight from past performance and readiness. */
export function adaptiveTargetWeight(
  previousWeight: number,
  readiness: number,
  rpeTarget: number = 8,
  equipment: string = "barbell",
) {
  // No history means no honest target. The UI shows "—" until a set exists.
  if (!previousWeight || previousWeight <= 0) return 0;

  const step = equipment === "dumbbell" ? 2 : equipment === "machine" ? 5 : 2.5;
  const rpeAdjustment = 1 + (rpeTarget - 8) * 0.005; // RPE 9 → +0.5%, RPE 7 → -0.5%
  let next = previousWeight * rpeAdjustment;

  if (readiness >= 85) {
    next *= 1.025; // high readiness: small progression
  } else if (readiness < 60) {
    next *= 0.95; // fatigued: auto-regulate down 5%
  }
  return roundTo(next, step);
}

/** Recovery % per muscle from recent training stress. */
export function recoveryMap(
  sets: { primaryMuscle: string; completedAt: Date | number; weightKg: number; reps: number }[],
) {
  const now = Date.now();
  const out: Record<string, { recovery: number; sets: number; lastTrained: number | null }> = {};
  for (const m of MUSCLES) out[m.key] = { recovery: 100, sets: 0, lastTrained: null };
  for (const s of sets) {
    const key = s.primaryMuscle;
    if (!out[key]) out[key] = { recovery: 100, sets: 0, lastTrained: null };
    const ts = s.completedAt instanceof Date ? s.completedAt.getTime() : s.completedAt;
    const ageDays = Math.max(0, (now - ts) / 86_400_000);
    if (ageDays > 8) continue;
    const stress = (1 + Math.min(1.4, (s.weightKg * s.reps) / 1400)) * Math.exp(-ageDays / 2.6);
    out[key].sets += 1;
    out[key].recovery -= stress * 5.2;
    if (out[key].lastTrained === null || ageDays < out[key].lastTrained!) out[key].lastTrained = ageDays;
  }
  for (const k of Object.keys(out)) {
    out[k].recovery = Math.round(clamp(out[k].recovery, 8, 100));
    if (out[k].lastTrained !== null) out[k].lastTrained = Math.round(out[k].lastTrained * 10) / 10;
  }
  return out;
}

/** Ranked equipment-swap alternatives for a crowded gym. */
export function alternativesFor<
  E extends {
    id: string; name: string; pattern: string; primaryMuscle: string; category: string;
    equipment: string; popularity: number; secondaryMuscles: string[];
  },
>(
  target: { id: string; pattern: string; primaryMuscle: string; category: string; equipment: string },
  all: E[],
  availableEquipment: string[],
  limit = 5,
) {
  return all
    .filter((e) => e.id !== target.id && availableEquipment.includes(e.equipment))
    .map((e) => {
      let score = 0;
      const reasons: string[] = [];
      if (e.pattern === target.pattern) { score += 50; reasons.push("Same movement pattern"); }
      if (e.primaryMuscle === target.primaryMuscle) { score += 30; reasons.push("Same primary muscle"); }
      if (e.category === target.category) score += 8;
      if (e.secondaryMuscles.includes(target.primaryMuscle)) score += 6;
      score += e.popularity / 12;
      if (e.equipment === "bodyweight") { score += 6; reasons.push("Zero equipment"); }
      return { ...e, score: Math.round(score), reasons: reasons.slice(0, 2) };
    })
    .filter((e) => e.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function estimateSessionMinutes(
  exercises: { targetSets: number; restSec: number; supersetGroup?: string | null }[],
  setSeconds = 42,
) {
  let seconds = 8 * 60; // warm-up
  for (const ex of exercises) {
    const rest = ex.supersetGroup ? ex.restSec * 0.35 : ex.restSec;
    seconds += ex.targetSets * (setSeconds + rest);
  }
  return Math.round(seconds / 60);
}

/** Converts straight sets into supersets and trims rest without losing volume. */
export function compressSession<T extends { id: string; targetSets: number; restSec: number; supersetGroup?: string | null; exerciseId: string }>(
  exercises: T[],
  targetMinutes = 25,
) {
  const originalMin = estimateSessionMinutes(exercises);
  if (exercises.length < 2) {
    return { exercises, originalMin, compressedMin: originalMin, groups: [] as { a: string; b: string }[] };
  }
  const paired = exercises.map((ex, i) => ({
    ...ex,
    supersetGroup: i < exercises.length - (exercises.length % 2) ? (i % 2 === 0 ? `SS-${Math.floor(i / 2) + 1}A` : `SS-${Math.floor(i / 2)}B`) : null,
    restSec: Math.round(ex.restSec * 0.5),
  }));
  const compressedMin = Math.max(
    targetMinutes,
    Math.round(originalMin * 0.6),
  );
  const groups: { a: string; b: string }[] = [];
  for (let i = 0; i + 1 < paired.length; i += 2) {
    groups.push({ a: paired[i].id, b: paired[i + 1].id });
  }
  return { exercises: paired, originalMin, compressedMin, groups };
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function plateBreakdown(totalKg: number, barKg = 20) {
  if (totalKg <= barKg) return { perSide: [] as number[], remainder: Math.max(0, totalKg - barKg), barKg };
  let perSideKg = (totalKg - barKg) / 2;
  const perSide: number[] = [];
  for (const p of PLATES) {
    while (perSideKg >= p - 0.001) {
      perSide.push(p);
      perSideKg -= p;
    }
  }
  return { perSide, remainder: Math.round(perSideKg * 100) / 100, barKg };
}

export const STRENGTH_STANDARDS = {
  male: {
    "bench-press": [0.5, 0.75, 1.15, 1.6],
    "back-squat": [0.75, 1.2, 1.75, 2.4],
    deadlift: [1.0, 1.5, 2.2, 2.9],
    "overhead-press": [0.35, 0.55, 0.8, 1.05],
  },
  female: {
    "bench-press": [0.25, 0.45, 0.7, 1.0],
    "back-squat": [0.5, 0.85, 1.25, 1.75],
    deadlift: [0.75, 1.15, 1.6, 2.1],
    "overhead-press": [0.2, 0.35, 0.5, 0.7],
  },
} as const;

export function strengthStanding(slug: string, e1rmKg: number, bodyweight: number, sex: string) {
  const table = STRENGTH_STANDARDS[(sex === "female" ? "female" : "male") as "male" | "female"];
  const ratios = (table as Record<string, readonly number[]>)[slug];
  if (!ratios || !bodyweight) return null;
  const ratio = e1rmKg / bodyweight;
  const levels = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"];
  let idx = 0;
  while (idx < ratios.length && ratio >= ratios[idx]) idx++;
  const current = levels[idx];
  const next = idx < ratios.length ? ratios[idx] : null;
  return {
    ratio: Math.round(ratio * 100) / 100,
    level: current,
    nextLevel: levels[Math.min(idx + 1, levels.length - 1)],
    nextRatio: next,
    toNextKg: next ? Math.round((next * bodyweight - e1rmKg) * 10) / 10 : 0,
    pct: clamp(Math.round((ratio / ratios[ratios.length - 1]) * 100), 4, 100),
  };
}

/**
 * Canonical level/XP formula. Used everywhere — do not duplicate.
 * Level N requires (N-1)² × 100 total XP.
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 5 = 1600 XP, Level 10 = 8100 XP.
 */
export function computeLevelProgress(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const floorXp = (level - 1) ** 2 * 100;
  const ceilXp = level ** 2 * 100;
  const progress = ceilXp > floorXp ? Math.round(((xp - floorXp) / (ceilXp - floorXp)) * 100) : 0;
  return { level, progress, floorXp, ceilXp, xpToNext: ceilXp - xp };
}

/**
 * Adaptive load suggestion. Takes the most recent working set and inverts the
 * Epley estimate to find the load that should hit `targetReps`.
 * Returns null when there is no usable history, so the UI can show "—"
 * instead of inventing a number.
 */
export function suggestedLoad(
  last: { weightKg: number; reps: number } | null | undefined,
  targetReps: number,
  step = 2.5,
) {
  if (!last || last.weightKg <= 0 || last.reps <= 0 || targetReps <= 0) return null;
  const estimated1rm = e1rm(last.weightKg, last.reps);
  const target = estimated1rm / (1 + targetReps / 30);
  return Math.max(step, roundTo(target, step));
}

export const PROTEIN_FOODS = [
  { name: "Whey isolate", serving: "1 scoop", protein: 30, calories: 160, tags: ["fast", "supplement"] },
  { name: "Greek yogurt", serving: "250 g", protein: 20, calories: 240, tags: ["vegetarian", "snack"] },
  { name: "Paneer tikka", serving: "150 g", protein: 27, calories: 340, tags: ["vegetarian", "home"] },
  { name: "Grilled chicken breast", serving: "150 g", protein: 35, calories: 248, tags: ["high-protein"] },
  { name: "Egg white omelette", serving: "4 whites + 1 egg", protein: 22, calories: 190, tags: ["breakfast", "home"] },
  { name: "Tofu bhurji", serving: "200 g", protein: 22, calories: 280, tags: ["vegan", "home"] },
  { name: "Dal + curd bowl", serving: "1 bowl", protein: 18, calories: 320, tags: ["vegetarian", "home"] },
  { name: "Cottage cheese", serving: "200 g", protein: 24, calories: 220, tags: ["vegetarian", "snack"] },
  { name: "Canned tuna", serving: "1 can", protein: 25, calories: 120, tags: ["fast"] },
  { name: "Protein oats", serving: "60 g oats + whey", protein: 32, calories: 380, tags: ["breakfast"] },
  { name: "Soya chunks curry", serving: "150 g dry", protein: 39, calories: 420, tags: ["vegan", "home"] },
  { name: "Chicken tikka", serving: "150 g", protein: 33, calories: 290, tags: ["high-protein", "home"] },
];

export function proteinPlan(remainingGrams: number) {
  if (remainingGrams <= 0) return [];
  const out: { name: string; serving: string; protein: number; calories: number; tags: string[] }[] = [];
  let left = remainingGrams;
  const sorted = [...PROTEIN_FOODS].sort((a, b) => b.protein - a.protein);
  for (const food of sorted) {
    if (left <= 4) break;
    if (food.protein <= left + 4) {
      out.push(food);
      left -= food.protein;
    }
    if (out.length >= 3) break;
  }
  if (left > 4) {
    const closest = sorted.find((f) => f.protein >= left - 5) ?? sorted[0];
    if (!out.includes(closest)) out.push(closest);
  }
  return out.slice(0, 3);
}
