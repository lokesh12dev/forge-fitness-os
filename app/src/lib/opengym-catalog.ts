/**
 * Unified Exercise Catalog, Skill Ladders, & CC-BY-4.0 Curated Plans
 *
 * Combines FORGE's 63 enriched core strength/conditioning exercises (SQLite seeded)
 * with the 1,323 MIT-licensed ExerciseDB v1 movements (via hasaneyldrm/exercises-dataset)
 * and CC-BY-4.0 openGym starter/curated routine structures.
 */

import rawOpenGymFull from "@/data/opengym-full-catalog.json";
import rawOpengymRoutines from "@/data/opengym-routines.json";
import { EXERCISES, type SeedExercise } from "@/db/exercise-data";

export interface CatalogExercise {
  id: string;
  openGymId?: string;
  slug: string;
  name: string;
  primaryMuscle: string;
  targetName?: string;
  secondaryMuscles: string[];
  secondaryMuscleNames?: string[];
  bodyPart: string;
  equipment: string;
  category: string;
  pattern: string;
  description?: string;
  hold?: boolean;
  track?: "distance";
  machineKind?: string;
  unilateral: boolean;
  difficulty: string;
  instructions: string[];
  cues: string[];
  tempo: string;
  popularity: number;
  muscleWeights: Record<string, number>;
  source: "forge" | "opengym" | "exercisedb" | "custom";
}

type RawCatalogItem = {
  id: string;
  n: string;
  bp: string;
  eq: string;
  tg: string;
  sm: string[];
  cat: string;
  desc?: string;
  inst: string[];
  hold?: boolean;
  track?: "distance";
  mk?: string;
  mm?: {
    primaries?: string[];
    secondaries?: string[];
    weights?: Record<string, number>;
  } | null;
  src?: string;
};

type RawRoutineFile = {
  file: string;
  title: string;
  goal?: string;
  level?: string;
  split?: string;
  duration?: number;
  tags?: string[];
  description?: string;
  about?: string;
  builtin?: string;
  sessions?: Array<{
    name: string;
    exercises: Array<{ id: string; sets?: number; reps?: number; rest?: number; sec?: number }>;
  }>;
};

export interface SkillLadderDef {
  id: string;
  name: string;
  description: string;
  steps: string[]; // Exercise IDs from easiest to hardest
}

export interface RoutineSlotItem {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  rpeTarget?: number;
  supersetGroup?: string | null;
  mode?: "reps" | "time";
  sec?: number;
  progression?: "double" | "linear" | "rpe" | "ladder";
}

export interface CuratedTemplateRoutine {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  goal: "hypertrophy" | "strength" | "athletic" | "bodyweight";
  level: "Beginner" | "Intermediate" | "Advanced";
  daysPerWeek: number;
  durationMin: number;
  source: "opengym" | "forge";
  license: string;
  folder: string;
  tags: string[];
  sessions: Array<{
    key: string;
    name: string;
    weekday?: number; // 0 = Sun, 1 = Mon ... 6 = Sat
    exercises: RoutineSlotItem[];
  }>;
}

const SLUGIFY = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const TITLE_CASE = (s: string) =>
  s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());

function normalizeEquipment(eq: string): string {
  const low = eq.toLowerCase().trim();
  if (low === "body weight" || low === "assisted") return "bodyweight";
  if (low === "ez barbell") return "ez-bar";
  if (low === "olympic barbell" || low === "trap bar") return "barbell";
  if (low.includes("machine") || low === "hammer" || low === "sled machine" || low === "smith machine") return "machine";
  if (low.includes("band")) return "bands";
  if (low === "cable" || low === "rope") return "cable";
  if (low.includes("kettlebell")) return "kettlebell";
  if (low.includes("dumbbell")) return "dumbbell";
  if (low.includes("barbell")) return "barbell";
  return low || "bodyweight";
}

export function normalizeCanonicalMuscle(m: string): string {
  const low = m.toLowerCase().trim();
  if (low === "pectorals" || low === "chest" || low === "upper chest") return "chest";
  if (low === "lats" || low === "latissimus dorsi") return "lats";
  if (low === "upper back" || low === "upper-back" || low === "traps" || low === "trapezius" || low === "lower back" || low === "lower-back" || low === "spine" || low === "rhomboids" || low === "levator scapulae" || low === "back") return "back";
  if (low === "delts" || low === "deltoids" || low === "front delts" || low === "front-delts" || low === "side delts" || low === "side-delts" || low === "rear delts" || low === "rear-delts" || low === "shoulders" || low === "rotator cuff") return "shoulders";
  if (low === "biceps" || low === "brachialis") return "biceps";
  if (low === "triceps") return "triceps";
  if (low === "forearms" || low === "forearm" || low === "wrists" || low === "wrist flexors" || low === "grip muscles") return "forearms";
  if (low === "quads" || low === "quadriceps" || low === "adductors" || low === "upper legs") return "quads";
  if (low === "hamstrings" || low === "hamstring") return "hamstrings";
  if (low === "glutes" || low === "gluteal" || low === "abductors") return "glutes";
  if (low === "calves" || low === "soleus" || low === "lower legs") return "calves";
  if (low === "abs" || low === "core" || low === "obliques" || low === "serratus" || low === "serratus anterior" || low === "hip flexors" || low === "hip-flexors" || low === "waist") return "core";
  if (low === "cardiovascular system" || low === "cardio") return "cardio";
  return "core";
}

export function toBodyMapSlug(m: string): string[] {
  const low = m.toLowerCase().trim();
  switch (low) {
    case "pectorals":
    case "chest":
      return ["chest"];
    case "lats":
    case "latissimus dorsi":
      return ["lats"];
    case "upper back":
    case "upper-back":
    case "rhomboids":
      return ["upper-back"];
    case "traps":
    case "trapezius":
    case "neck":
      return ["trapezius"];
    case "lower back":
    case "lower-back":
    case "spine":
    case "back":
      return ["lats", "upper-back", "lower-back"];
    case "front delts":
    case "front-delts":
    case "side delts":
    case "side-delts":
    case "rear delts":
    case "rear-delts":
    case "delts":
    case "deltoids":
    case "shoulders":
      return ["deltoids"];
    case "biceps":
      return ["biceps"];
    case "triceps":
      return ["triceps"];
    case "forearm":
    case "forearms":
      return ["forearm"];
    case "quads":
    case "quadriceps":
      return ["quadriceps"];
    case "adductors":
    case "groin":
      return ["adductors"];
    case "hamstring":
    case "hamstrings":
      return ["hamstring"];
    case "glutes":
    case "gluteal":
    case "abductors":
      return ["gluteal"];
    case "calves":
    case "soleus":
      return ["calves"];
    case "abs":
    case "core":
      return ["abs"];
    case "obliques":
      return ["obliques"];
    case "serratus":
      return ["serratus"];
    case "hip flexors":
    case "hip-flexors":
      return ["hip-flexors"];
    default:
      return [];
  }
}

function inferPattern(name: string, bodyPart: string, cat: string): string {
  const low = name.toLowerCase();
  if (low.includes("jump box") || low.includes("box jump")) return "jump_box";
  if (cat === "cardio" || cat === "plyometrics" || bodyPart === "cardio" || low.includes("bike") || (low.includes("row") && low.includes("machine")) || low.includes("treadmill") || low.includes("burpee") || low.includes("jump")) return "conditioning";
  if (low.includes("bench press") || low.includes("push-up") || low.includes("chest press") || (low.includes("dip") && bodyPart === "chest")) return "horizontal_push";
  if (low.includes("overhead") || low.includes("military press") || low.includes("shoulder press") || low.includes("arnold") || low.includes("handstand")) return "vertical_push";
  if (low.includes("pull-up") || low.includes("chin-up") || low.includes("pulldown")) return "vertical_pull";
  if (low.includes("row") || low.includes("face pull")) return "horizontal_pull";
  if (low.includes("squat")) return "squat";
  if (low.includes("deadlift") || low.includes("hip thrust") || low.includes("glute bridge") || low.includes("good morning") || low.includes("swing")) return "hinge";
  if (low.includes("lunge") || low.includes("step-up")) return "lunge";
  if (low.includes("plank") || low.includes("crunch") || low.includes("leg raise") || low.includes("twist") || low.includes("rollout") || bodyPart === "waist") return "core";
  if (bodyPart === "upper arms" || low.includes("curl") || low.includes("tricep") || low.includes("skull") || low.includes("pushdown")) return "isolation_arm";
  if (bodyPart === "shoulders" || low.includes("raise") || low.includes("fly")) return "isolation_shoulder";
  if (bodyPart === "upper legs" || bodyPart === "lower legs") return "isolation_leg";
  return "isolation_chest";
}

function buildWeightsForForgeSeed(ex: SeedExercise): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const slug of toBodyMapSlug(ex.primary)) {
    weights[slug] = 1;
  }
  for (const s of ex.secondary) {
    for (const slug of toBodyMapSlug(s)) {
      if (!weights[slug]) weights[slug] = 0.45;
    }
  }
  return weights;
}

function buildWeightsForEdb(item: RawCatalogItem): Record<string, number> {
  if (item.mm?.weights && Object.keys(item.mm.weights).length > 0) {
    const mapped: Record<string, number> = {};
    for (const [k, v] of Object.entries(item.mm.weights)) {
      for (const s of toBodyMapSlug(k)) {
        mapped[s] = Math.max(mapped[s] ?? 0, v);
      }
    }
    if (Object.keys(mapped).length > 0) return mapped;
  }
  const weights: Record<string, number> = {};
  for (const slug of toBodyMapSlug(item.tg)) weights[slug] = 1;
  for (const sec of item.sm) {
    for (const slug of toBodyMapSlug(sec)) {
      if (!weights[slug]) weights[slug] = 0.4;
    }
  }
  return weights;
}

const FORGE_BY_LOWER_NAME = new Map<string, SeedExercise>();
for (const ex of EXERCISES) {
  FORGE_BY_LOWER_NAME.set(ex.name.toLowerCase().trim(), ex);
}

const rawByLowerName = new Map<string, RawCatalogItem>();
for (const item of rawOpenGymFull as RawCatalogItem[]) {
  rawByLowerName.set(item.n.toLowerCase().trim(), item);
}

const forgeCatalog: CatalogExercise[] = EXERCISES.map((ex) => {
  const matchRaw = rawByLowerName.get(ex.name.toLowerCase().trim());
  return {
    id: `ex-${ex.slug}`,
    openGymId: matchRaw?.id,
    slug: ex.slug,
    name: ex.name,
    primaryMuscle: ex.primary,
    targetName: matchRaw ? TITLE_CASE(matchRaw.tg) : TITLE_CASE(ex.primary),
    secondaryMuscles: ex.secondary,
    secondaryMuscleNames: matchRaw ? matchRaw.sm.map(TITLE_CASE) : ex.secondary.map(TITLE_CASE),
    bodyPart:
      ex.primary === "chest"
        ? "chest"
        : ex.primary === "back" || ex.primary === "lats"
          ? "back"
          : ex.primary === "shoulders"
            ? "shoulders"
            : ex.primary === "biceps" || ex.primary === "triceps"
              ? "upper arms"
              : ex.primary === "forearms"
                ? "lower arms"
                : ex.primary === "quads" || ex.primary === "hamstrings" || ex.primary === "glutes"
                  ? "upper legs"
                  : ex.primary === "calves"
                    ? "lower legs"
                    : ex.primary === "core"
                      ? "waist"
                      : "cardio",
    equipment: ex.equipment,
    category: matchRaw?.cat ?? ex.category,
    pattern: ex.pattern,
    description: matchRaw?.desc ?? `${ex.name}: focused ${ex.primary} development with controlled resistance.`,
    hold: matchRaw?.hold,
    track: matchRaw?.track,
    machineKind: matchRaw?.mk,
    unilateral: Boolean(ex.unilateral),
    difficulty: ex.difficulty ?? "intermediate",
    instructions: matchRaw?.inst?.length ? matchRaw.inst : ex.instructions,
    cues: ex.cues,
    tempo: ex.category === "compound" ? "3-1-1" : "2-0-1",
    popularity: ex.popularity,
    muscleWeights: matchRaw ? buildWeightsForEdb(matchRaw) : buildWeightsForForgeSeed(ex),
    source: "forge",
  };
});

const seenNames = new Set(forgeCatalog.map((e) => e.name.toLowerCase()));
const edbIdToCatalogId = new Map<string, string>();

// Direct aliases from common ExerciseDB/openGym IDs to canonical SQLite-seeded IDs
const KNOWN_ID_ALIASES: Record<string, string> = {
  "0025": "ex-bench-press",
  "0032": "ex-deadlift",
  "0043": "ex-back-squat",
  "0047": "ex-overhead-press",
  "0085": "ex-romanian-deadlift",
  "0027": "ex-barbell-row",
  "0031": "ex-barbell-curl",
  "0251": "ex-dips",
  "0241": "ex-triceps-pushdown",
  "0334": "ex-lateral-raise",
  "0426": "ex-incline-dumbbell-press",
  "0652": "ex-pull-up",
  "0662": "ex-push-up",
  "0739": "ex-leg-press",
  "0585": "ex-leg-extension",
  "0586": "ex-leg-curl",
  "0605": "ex-calf-raise",
  "0313": "ex-hammer-curl",
  "1323": "ex-seated-cable-row",
  "2330": "ex-lat-pulldown",
};

const openGymCatalogItems: CatalogExercise[] = [];
for (const item of rawOpenGymFull as RawCatalogItem[]) {
  const formattedName = TITLE_CASE(item.n);
  const lowName = formattedName.toLowerCase();
  if (KNOWN_ID_ALIASES[item.id]) {
    edbIdToCatalogId.set(item.id, KNOWN_ID_ALIASES[item.id]);
    const existing = forgeCatalog.find((f) => f.id === KNOWN_ID_ALIASES[item.id]);
    if (existing && !existing.openGymId) {
      existing.openGymId = item.id;
      if (item.desc) existing.description = item.desc;
    }
    continue;
  }
  const existingForge = FORGE_BY_LOWER_NAME.get(lowName);
  if (existingForge) {
    edbIdToCatalogId.set(item.id, `ex-${existingForge.slug}`);
    continue;
  }
  if (seenNames.has(lowName)) continue;
  seenNames.add(lowName);

  const id = `og-${item.id}`;
  edbIdToCatalogId.set(item.id, id);

  const equip = normalizeEquipment(item.eq);
  const primary = normalizeCanonicalMuscle(item.tg);
  const secondaries = Array.from(
    new Set(item.sm.map(normalizeCanonicalMuscle).filter((m) => m !== primary)),
  );
  const pattern = inferPattern(formattedName, item.bp, item.cat);

  openGymCatalogItems.push({
    id,
    openGymId: item.id,
    slug: `${SLUGIFY(item.n)}-${item.id}`,
    name: formattedName,
    primaryMuscle: primary,
    targetName: TITLE_CASE(item.tg),
    secondaryMuscles: secondaries,
    secondaryMuscleNames: item.sm.map(TITLE_CASE),
    bodyPart: item.bp,
    equipment: equip,
    category: item.cat || "strength",
    pattern,
    description: item.desc || undefined,
    hold: item.hold,
    track: item.track,
    machineKind: item.mk,
    unilateral: /single|one arm|one leg|unilateral|alternat|1 to 2|2 to 1/i.test(formattedName),
    difficulty: /assisted|chair|wall|kneeling/i.test(formattedName)
      ? "beginner"
      : /one arm|pistol|dragon|handstand|muscle-up|olympic/i.test(formattedName)
        ? "advanced"
        : "intermediate",
    instructions: item.inst.length > 0 ? item.inst : [`Perform ${formattedName} through a controlled range of motion.`],
    cues: [
      `Focus tension cleanly on ${TITLE_CASE(item.tg)}.`,
      "Control the eccentric lowering phase.",
    ],
    tempo: item.hold ? "Hold" : item.cat === "stretching" || item.cat === "mobility" ? "Hold 30s" : "2-0-1",
    popularity: 42,
    muscleWeights: buildWeightsForEdb(item),
    source: item.src === "exercisedb" ? "exercisedb" : "opengym",
  });
}

export const FULL_EXERCISE_CATALOG: CatalogExercise[] = [...forgeCatalog, ...openGymCatalogItems];

export const CATALOG_BY_ID = new Map<string, CatalogExercise>(
  FULL_EXERCISE_CATALOG.map((e) => [e.id, e]),
);

export function resolveCatalogId(rawId: string): string {
  if (CATALOG_BY_ID.has(rawId)) return rawId;
  if (KNOWN_ID_ALIASES[rawId] && CATALOG_BY_ID.has(KNOWN_ID_ALIASES[rawId])) {
    return KNOWN_ID_ALIASES[rawId];
  }
  if (CATALOG_BY_ID.has(`og-${rawId}`)) return `og-${rawId}`;
  const mapped = edbIdToCatalogId.get(rawId);
  if (mapped && CATALOG_BY_ID.has(mapped)) return mapped;
  return "ex-bench-press";
}

export function computeMusclePercentages(ex: CatalogExercise): Array<{ label: string; pct: number; isPrimary: boolean }> {
  const secCount = ex.secondaryMuscleNames?.length ?? ex.secondaryMuscles.length;
  const primaryLabel = ex.targetName || TITLE_CASE(ex.primaryMuscle);
  if (secCount === 0) return [{ label: primaryLabel, pct: 100, isPrimary: true }];

  const weights: Array<{ label: string; w: number; isPrimary: boolean }> = [
    { label: primaryLabel, w: 1.0, isPrimary: true },
  ];
  const secNames = ex.secondaryMuscleNames?.length ? ex.secondaryMuscleNames : ex.secondaryMuscles.map(TITLE_CASE);
  secNames.forEach((sec, idx) => {
    weights.push({ label: sec, w: idx === 0 ? 0.4 : 0.35, isPrimary: false });
  });
  const total = weights.reduce((s, x) => s + x.w, 0);
  const firstTwo = weights.slice(0, 2).map((x) => ({
    label: x.label,
    pct: Math.round((x.w / total) * 100),
    isPrimary: x.isPrimary,
  }));
  const restPct = Math.max(0, 100 - firstTwo.reduce((s, x) => s + x.pct, 0));
  if (secCount === 1 || restPct < 5) {
    return weights.map((x) => ({ label: x.label, pct: Math.round((x.w / total) * 100), isPrimary: x.isPrimary }));
  }
  return [...firstTwo, { label: "Other", pct: restPct, isPrimary: false }];
}

export function computeEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export const SKILL_LADDERS: SkillLadderDef[] = [
  {
    id: "push-up",
    name: "Push-up ladder",
    description: "Build horizontal pushing control from incline presses up to strict unilateral power.",
    steps: [
      resolveCatalogId("0659"),
      resolveCatalogId("0493"),
      "ex-push-up",
      resolveCatalogId("0259"),
      resolveCatalogId("0279"),
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "pull-up",
    name: "Pull-up ladder",
    description: "Develop scapular strength and vertical pulling endurance rung by rung.",
    steps: [
      resolveCatalogId("0499"),
      resolveCatalogId("0017"),
      resolveCatalogId("0253"),
      "ex-pull-up",
      resolveCatalogId("0627"),
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "dip",
    name: "Dip ladder",
    description: "Master parallel-bar pressing strength and triceps lockout stability.",
    steps: [
      resolveCatalogId("0129"),
      resolveCatalogId("0019"),
      resolveCatalogId("0009"),
      "ex-dips",
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "squat",
    name: "Single-leg squat ladder",
    description: "Climb from symmetrical bodyweight knee flexion into deep unilateral leg strength.",
    steps: [
      "ex-goblet-squat",
      "ex-walking-lunge",
      "ex-bulgarian-split-squat",
      resolveCatalogId("0099"),
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "hinge",
    name: "Posterior chain & hinge ladder",
    description: "Strengthen glutes and hamstrings progressively from bridges to pure hip hinges.",
    steps: [
      "ex-glute-bridge",
      "ex-hip-thrust",
      "ex-romanian-deadlift",
      "ex-leg-curl",
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "core",
    name: "Core brace ladder",
    description: "Anti-extension trunk stability progressing toward hanging flexion.",
    steps: [
      "ex-plank",
      "ex-ab-wheel",
      "ex-cable-crunch",
      "ex-hanging-leg-raise",
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
  {
    id: "handstand",
    name: "Overhead & inversion ladder",
    description: "Progressive vertical pushing culminating in full overhead pressing.",
    steps: [
      "ex-dumbbell-shoulder-press",
      "ex-overhead-press",
      resolveCatalogId("3302"),
      resolveCatalogId("0471"),
    ].filter((v, i, a) => CATALOG_BY_ID.has(v) && a.indexOf(v) === i),
  },
];

export const OPENGYM_STARTER_PLANS: CuratedTemplateRoutine[] = [
  {
    id: "og-starter-ppl",
    name: "Push Pull Legs (Starter)",
    subtitle: "3-Day Classic Weekly Foundation",
    description: "Balanced 3-day Push, Pull, Leg split from the openGym starter library with crisp compound progressions.",
    goal: "hypertrophy",
    level: "Beginner",
    daysPerWeek: 3,
    durationMin: 55,
    source: "opengym",
    license: "CC-BY-4.0",
    folder: "Hypertrophy & Aesthetics",
    tags: ["gym", "3 days", "starter"],
    sessions: [
      {
        key: "push",
        name: "Push Day",
        weekday: 1,
        exercises: [
          { exerciseId: resolveCatalogId("0025"), sets: 4, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("0047"), sets: 3, repsMin: 8, repsMax: 12, restSec: 120, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("0426"), sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5, progression: "double" },
          { exerciseId: resolveCatalogId("0334"), sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9, progression: "double" },
          { exerciseId: resolveCatalogId("0241"), sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9, progression: "double" },
          { exerciseId: resolveCatalogId("0251"), sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8.5, progression: "double" },
        ],
      },
      {
        key: "pull",
        name: "Pull Day",
        weekday: 3,
        exercises: [
          { exerciseId: resolveCatalogId("2330"), sets: 4, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("0027"), sets: 4, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("1323"), sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5, progression: "double" },
          { exerciseId: resolveCatalogId("0031"), sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9, progression: "double" },
          { exerciseId: resolveCatalogId("0313"), sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9, progression: "double" },
        ],
      },
      {
        key: "legs",
        name: "Leg Day",
        weekday: 5,
        exercises: [
          { exerciseId: resolveCatalogId("0043"), sets: 4, repsMin: 6, repsMax: 10, restSec: 150, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("0085"), sets: 3, repsMin: 8, repsMax: 12, restSec: 120, rpeTarget: 8, progression: "double" },
          { exerciseId: resolveCatalogId("0739"), sets: 3, repsMin: 10, repsMax: 12, restSec: 90, rpeTarget: 8.5, progression: "double" },
          { exerciseId: resolveCatalogId("0585"), sets: 3, repsMin: 12, repsMax: 15, restSec: 60, rpeTarget: 9, progression: "double" },
          { exerciseId: resolveCatalogId("0586"), sets: 3, repsMin: 10, repsMax: 12, restSec: 60, rpeTarget: 9, progression: "double" },
          { exerciseId: resolveCatalogId("0605"), sets: 4, repsMin: 12, repsMax: 16, restSec: 60, rpeTarget: 9, progression: "double" },
        ],
      },
    ],
  },
  {
    id: "og-starter-5x5",
    name: "5×5 Strength",
    subtitle: "3-Day Linear Barbell Progression",
    description: "Five sets of five on core barbell compounds three days a week. Simple linear jumps every completed session.",
    goal: "strength",
    level: "Beginner",
    daysPerWeek: 3,
    durationMin: 50,
    source: "opengym",
    license: "CC-BY-4.0",
    folder: "Strength & Powerlifting",
    tags: ["barbell", "linear progression"],
    sessions: [
      {
        key: "5x5-a",
        name: "5×5 Workout A",
        weekday: 1,
        exercises: [
          { exerciseId: "ex-back-squat", sets: 5, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-bench-press", sets: 5, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-barbell-row", sets: 5, repsMin: 5, repsMax: 5, restSec: 150, rpeTarget: 8, progression: "linear" },
        ],
      },
      {
        key: "5x5-b",
        name: "5×5 Workout B",
        weekday: 3,
        exercises: [
          { exerciseId: "ex-back-squat", sets: 5, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-overhead-press", sets: 5, repsMin: 5, repsMax: 5, restSec: 150, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-deadlift", sets: 3, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8.5, progression: "linear" },
        ],
      },
      {
        key: "5x5-c",
        name: "5×5 Workout C",
        weekday: 5,
        exercises: [
          { exerciseId: "ex-front-squat", sets: 5, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-bench-press", sets: 5, repsMin: 5, repsMax: 5, restSec: 180, rpeTarget: 8, progression: "linear" },
          { exerciseId: "ex-seated-cable-row", sets: 5, repsMin: 5, repsMax: 5, restSec: 120, rpeTarget: 8, progression: "linear" },
        ],
      },
    ],
  },
];

// Also ingest CC-BY-4.0 rich multi-day routines from opengym-routines.json
export const OPENGYM_CURATED_ROUTINES: CuratedTemplateRoutine[] = (rawOpengymRoutines as RawRoutineFile[])
  .filter((r) => Array.isArray(r.sessions) && r.sessions.length > 0 && !r.file.includes("ganzkoerper"))
  .map((r, idx) => {
    const cleanId = `og-${SLUGIFY(r.title)}`;
    const sessions = (r.sessions ?? []).map((s, sIdx) => ({
      key: `${cleanId}-${sIdx}`,
      name: s.name,
      weekday: [1, 2, 4, 5, 6, 3][sIdx % 6],
      exercises: (s.exercises ?? []).map((ex) => ({
        exerciseId: resolveCatalogId(ex.id),
        sets: ex.sets ?? 3,
        repsMin: ex.reps ?? 8,
        repsMax: Math.max((ex.reps ?? 10) + 2, ex.reps ?? 10),
        restSec: ex.rest ?? 90,
        rpeTarget: 8,
        mode: ex.sec ? ("time" as const) : ("reps" as const),
        sec: ex.sec,
        progression: "double" as const,
      })),
    }));
    const goal: CuratedTemplateRoutine["goal"] =
      r.goal === "strength"
        ? "strength"
        : r.split === "bw" || r.tags?.includes("home") || r.tags?.includes("calisthenics")
          ? "bodyweight"
          : r.split === "circuit" || r.goal === "conditioning"
            ? "athletic"
            : "hypertrophy";
    return {
      id: cleanId,
      name: r.title,
      subtitle: `${sessions.length}-Day ${TITLE_CASE(r.split ?? "Split")} · openGym CC-BY`,
      description: r.description ?? "Structured curated routine from the openGym community library.",
      goal,
      level: r.level === "beginner" ? "Beginner" : r.level === "advanced" ? "Advanced" : "Intermediate",
      daysPerWeek: Math.min(7, sessions.length),
      durationMin: r.duration ?? 50,
      source: "opengym",
      license: "CC-BY-4.0",
      folder: goal === "strength" ? "Strength & Powerlifting" : goal === "bodyweight" || goal === "athletic" ? "Athletic & Bodyweight" : "Hypertrophy & Aesthetics",
      tags: r.tags ?? [String(idx + 1)],
      sessions,
    };
  });

export function buildSessionFromMuscles(
  selectedMuscles: string[],
  catalog: CatalogExercise[],
  availableEquipment?: string[],
): CatalogExercise[] {
  const pool = availableEquipment?.length
    ? catalog.filter((e) => availableEquipment.includes(e.equipment) || e.equipment === "bodyweight")
    : catalog;
  const picked: CatalogExercise[] = [];
  const seen = new Set<string>();

  for (const m of selectedMuscles) {
    const canon = normalizeCanonicalMuscle(m);
    const candidates = pool
      .filter((e) => e.primaryMuscle === canon || Object.keys(e.muscleWeights).some((k) => k.includes(m) || normalizeCanonicalMuscle(k) === canon))
      .sort((a, b) => (b.category === "compound" ? 1 : 0) - (a.category === "compound" ? 1 : 0) || b.popularity - a.popularity);
    for (const c of candidates.slice(0, 2)) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        picked.push(c);
      }
    }
  }
  return picked.slice(0, 6);
}

export function computeRoutineMuscleLoad(exerciseIds: string[]): Record<string, number> {
  const load: Record<string, number> = {};
  for (const rawId of exerciseIds) {
    const ex = CATALOG_BY_ID.get(rawId) ?? CATALOG_BY_ID.get(resolveCatalogId(rawId));
    if (!ex) continue;
    for (const [slug, w] of Object.entries(ex.muscleWeights)) {
      load[slug] = (load[slug] ?? 0) + w * 3;
    }
  }
  return load;
}
