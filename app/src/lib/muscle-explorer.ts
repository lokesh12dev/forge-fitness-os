/**
 * OpenGym 21-Muscle Anatomical Model & Group Filter
 * Direct TypeScript port of openGym's lib/muscles.js + lib/muscle-filter.js + lib/body-geometry.js
 */

import type { CatalogExercise } from "@/lib/opengym-catalog";

export const OG_MUSCLES = [
  "trapezius",
  "front-delts",
  "side-delts",
  "rear-delts",
  "chest",
  "lats",
  "upper-back",
  "serratus",
  "biceps",
  "triceps",
  "forearm",
  "abs",
  "obliques",
  "lower-back",
  "gluteal",
  "quadriceps",
  "hamstring",
  "adductors",
  "hip-flexors",
  "calves",
  "tibialis",
] as const;

export type OgMuscleSlug = (typeof OG_MUSCLES)[number];

export interface MuscleGroupDef {
  id: string;
  name: string;
  muscles: OgMuscleSlug[];
}

export const OG_MUSCLE_GROUPS: MuscleGroupDef[] = [
  { id: "chest", name: "Chest", muscles: ["chest", "serratus"] },
  { id: "back", name: "Back muscles", muscles: ["lats", "upper-back", "lower-back", "trapezius"] },
  { id: "shoulders", name: "Shoulders", muscles: ["front-delts", "side-delts", "rear-delts"] },
  { id: "arms", name: "Arms", muscles: ["biceps", "triceps", "forearm"] },
  { id: "core", name: "Core", muscles: ["abs", "obliques"] },
  {
    id: "legs",
    name: "Legs",
    muscles: ["gluteal", "quadriceps", "hamstring", "adductors", "hip-flexors", "calves", "tibialis"],
  },
];

export const OG_MUSCLE_NAME: Record<string, string> = {
  trapezius: "Traps",
  deltoids: "Shoulders",
  "front-delts": "Front delts",
  "side-delts": "Side delts",
  "rear-delts": "Rear delts",
  chest: "Chest",
  lats: "Lats",
  "upper-back": "Upper back",
  serratus: "Serratus",
  biceps: "Biceps",
  triceps: "Triceps",
  forearm: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  "lower-back": "Lower back",
  gluteal: "Glutes",
  quadriceps: "Quads",
  hamstring: "Hamstrings",
  adductors: "Adductors",
  "hip-flexors": "Hip flexors",
  calves: "Calves",
  tibialis: "Shins",
  "cardiovascular system": "Cardio",
};

const GROUP_BY_ID = Object.fromEntries(OG_MUSCLE_GROUPS.map((g) => [g.id, g]));

export const groupTerm = (id: string) => `group:${id}`;

export const groupOfTerm = (term: string): MuscleGroupDef | null =>
  typeof term === "string" && term.startsWith("group:") ? GROUP_BY_ID[term.slice(6)] ?? null : null;

export const groupOfMuscle = (m: string): MuscleGroupDef | null =>
  OG_MUSCLE_GROUPS.find((g) => (g.muscles as string[]).includes(m)) ?? null;

export function termMuscles(term: string): OgMuscleSlug[] {
  const g = groupOfTerm(term);
  if (g) return g.muscles;
  return (OG_MUSCLES as readonly string[]).includes(term) ? [term as OgMuscleSlug] : [];
}

export function shownMuscles(terms: string[]): OgMuscleSlug[] {
  return OG_MUSCLES.filter((m) => terms.some((t) => termMuscles(t).includes(m)));
}

export function termDisplayName(term: string): string {
  const g = groupOfTerm(term);
  if (g) return g.name;
  return OG_MUSCLE_NAME[term] ?? term;
}

export function matchesTerms(
  weights: Record<string, number>,
  terms: string[],
  mode: "all" | "any" = "all",
): boolean {
  const list = terms.filter((t) => termMuscles(t).length > 0);
  if (!list.length || !weights) return false;
  const hit = (t: string) => termMuscles(t).some((m) => (weights[m] ?? 0) > 0);
  return mode === "any" ? list.some(hit) : list.every(hit);
}

export function termsWeight(weights: Record<string, number>, terms: string[]): number {
  return Math.max(0, ...shownMuscles(terms).map((m) => Number(weights?.[m]) || 0));
}

export function toggleTerm(terms: string[], term: string): string[] {
  const cur = [...terms];
  if (cur.includes(term)) return cur.filter((t) => t !== term);
  const g = groupOfTerm(term);
  if (g) return [...cur.filter((t) => !(g.muscles as string[]).includes(t)), term];
  const own = groupOfMuscle(term);
  return [...cur.filter((t) => !(own && t === groupTerm(own.id))), term];
}

const GENERIC_DELTOIDS: Record<string, number> = {
  "front-delts": 1,
  "side-delts": 0.6,
  "rear-delts": 0.4,
};

const ALIAS_TO_OG: Record<string, string | null> = {
  abs: "abs",
  pectorals: "chest",
  biceps: "biceps",
  glutes: "gluteal",
  gluteal: "gluteal",
  delts: "deltoids",
  "front delts": "front-delts",
  "front-delts": "front-delts",
  "side delts": "side-delts",
  "side-delts": "side-delts",
  "rear delts": "rear-delts",
  "rear-delts": "rear-delts",
  triceps: "triceps",
  "upper back": "upper-back",
  "upper-back": "upper-back",
  lats: "lats",
  calves: "calves",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  forearms: "forearm",
  forearm: "forearm",
  hamstrings: "hamstring",
  hamstring: "hamstring",
  spine: "lower-back",
  traps: "trapezius",
  trapezius: "trapezius",
  adductors: "adductors",
  "serratus anterior": "serratus",
  serratus: "serratus",
  abductors: "gluteal",
  "levator scapulae": "trapezius",
  shoulders: "deltoids",
  deltoids: "deltoids",
  "rear deltoids": "rear-delts",
  "rotator cuff": "rear-delts",
  core: "abs",
  abdominals: "abs",
  "lower abs": "abs",
  chest: "chest",
  "upper chest": "chest",
  "hip flexors": "hip-flexors",
  "hip-flexors": "hip-flexors",
  obliques: "obliques",
  "lower back": "lower-back",
  "lower-back": "lower-back",
  rhomboids: "upper-back",
  back: "upper-back",
  "latissimus dorsi": "lats",
  brachialis: "biceps",
  soleus: "calves",
  shins: "tibialis",
  tibialis: "tibialis",
  wrists: "forearm",
  "wrist flexors": "forearm",
  "wrist extensors": "forearm",
  "grip muscles": "forearm",
  groin: "adductors",
  "inner thighs": "adductors",
};

const BY_BODYPART_OG: Record<string, Record<string, number>> = {
  chest: { chest: 1 },
  back: { lats: 0.4, "upper-back": 0.4, "lower-back": 0.2 },
  shoulders: { "front-delts": 0.4, "side-delts": 0.4, "rear-delts": 0.2 },
  "upper arms": { biceps: 0.5, triceps: 0.5 },
  "lower arms": { forearm: 1 },
  waist: { abs: 0.7, obliques: 0.3 },
  "upper legs": { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  "lower legs": { calves: 0.8, tibialis: 0.2 },
  neck: { trapezius: 1 },
  "full body": {
    chest: 0.2,
    lats: 0.1,
    "upper-back": 0.1,
    gluteal: 0.2,
    quadriceps: 0.2,
    hamstring: 0.1,
    abs: 0.1,
  },
  cardio: {},
};

const weightsCache = new WeakMap<CatalogExercise, Record<string, number>>();

/**
 * Returns the 21-muscle openGym weights map for a CatalogExercise, resolving shoulder heads
 * (front-delts, side-delts, rear-delts) from targetName/secondaryMuscleNames + muscleWeights.
 */
export function ogMusclesOf(ex: CatalogExercise): Record<string, number> {
  const cached = weightsCache.get(ex);
  if (cached) return cached;

  const out: Record<string, number> = {};
  const put = (slug: string, w: number) => {
    out[slug] = Math.max(out[slug] ?? 0, w);
  };
  const addName = (raw: string | undefined, w: number) => {
    if (!raw) return;
    const slug = ALIAS_TO_OG[raw.toLowerCase().trim()];
    if (!slug) return;
    if (slug === "deltoids") {
      for (const [head, f] of Object.entries(GENERIC_DELTOIDS)) {
        put(head, Math.round(w * f * 100) / 100);
      }
    } else {
      put(slug, w);
    }
  };

  // Seed from existing muscleWeights first (if non-deltoid or already head-specific)
  for (const [k, val] of Object.entries(ex.muscleWeights || {})) {
    const w = Number(val);
    if (!Number.isFinite(w) || w <= 0) continue;
    if (k === "deltoids") {
      // Check if targetName/secondaryMuscleNames specify an exact shoulder head
      const nameLow = `${ex.targetName ?? ""} ${(ex.secondaryMuscleNames ?? []).join(" ")}`.toLowerCase();
      if (!/front delt|side delt|rear delt/.test(nameLow)) {
        for (const [head, f] of Object.entries(GENERIC_DELTOIDS)) {
          put(head, Math.round(w * f * 100) / 100);
        }
      }
    } else if ((OG_MUSCLES as readonly string[]).includes(k)) {
      put(k, w);
    }
  }

  addName(ex.targetName ?? ex.primaryMuscle, 1);
  for (const s of ex.secondaryMuscleNames?.length ? ex.secondaryMuscleNames : ex.secondaryMuscles) {
    addName(s, 0.4);
  }

  if (Object.keys(out).length === 0) {
    Object.assign(out, BY_BODYPART_OG[ex.bodyPart] ?? {});
  }

  weightsCache.set(ex, out);
  return out;
}
