export const EXERCISE_ALIASES: Record<string, string[]> = {
  "bench-press": ["bench", "bb bench", "flat bench", "flat barbell bench", "chest press", "barbell press"],
  "incline-barbell-press": ["incline bench", "incline bb", "incline press", "incline barbell"],
  "dumbbell-bench-press": ["db bench", "db chest press", "dumbbell press", "flat db bench"],
  "incline-dumbbell-press": ["db incline", "incline db", "incline dumbbell", "incline dumbbell bench"],
  "machine-chest-press": ["chest press machine", "machine press", "seated chest press"],
  "push-up": ["pushup", "press up", "pushups"],
  "dips": ["dip", "chest dip", "tricep dip", "parallel bar dip"],
  "cable-fly": ["cable flies", "chest fly", "cable crossover", "cables fly"],
  "pec-deck": ["machine fly", "pec fly", "butterfly", "pec deck fly"],
  "landmine-press": ["landmine", "angled press"],
  "overhead-press": ["ohp", "military press", "standing press", "shoulder press", "bb ohp", "bb shoulder press"],
  "dumbbell-shoulder-press": ["db shoulder press", "db ohp", "dumbbell press", "seated db press"],
  "arnold-press": ["arnold", "arnold shoulder press"],
  "lateral-raise": ["lat raise", "side raise", "side delt", "side delts", "delt raise", "db lateral", "side lateral"],
  "cable-lateral-raise": ["cable lat raise", "cable lateral", "cables lateral"],
  "rear-delt-fly": ["rear delt", "face fly", "reverse fly", "rear delt flyes"],
  "face-pull": ["facepull", "rope face pull", "cable face pull"],
  "deadlift": ["dl", "conventional deadlift", "barbell deadlift", "dead lift"],
  "romanian-deadlift": ["rdl", "romanian", "stiff leg", "sldl", "barbell rdl", "straight leg deadlift"],
  "sumo-deadlift": ["sumo", "sumo dl"],
  "barbell-row": ["bb row", "bent over row", "barbell bent over row", "pendlay row"],
  "pendlay-row": ["pendlay", "deadstop row"],
  "single-arm-row": ["db row", "one arm row", "single arm db row", "dumbbell row"],
  "chest-supported-row": ["incline row", "seal row", "chest supported db row"],
  "t-bar-row": ["tbar", "t bar", "tbar row"],
  "pull-up": ["pullup", "pull ups", "chin up", "chinup", "chins", "wide grip pullup"],
  "lat-pulldown": ["lat pull", "pulldown", "lat pull down", "cable pulldown", "front pulldown"],
  "straight-arm-pulldown": ["straight arm lat", "cable pullover"],
  "seated-cable-row": ["cable row", "low row", "seated row", "cable seated row"],
  "back-squat": ["squat", "bb squat", "backsquat", "barbell squat", "barbell back squat"],
  "front-squat": ["frontsquat", "bb front squat"],
  "hack-squat": ["hack", "hack squat machine"],
  "goblet-squat": ["goblet", "db goblet squat"],
  "leg-press": ["legpress", "sled", "45 degree leg press"],
  "bulgarian-split-squat": ["bss", "bulgarian", "split squat", "rear foot elevated split squat"],
  "walking-lunge": ["lunge", "lunges", "db lunge"],
  "leg-extension": ["leg ext", "quad ext", "knee extension", "quad extension"],
  "leg-curl": ["ham curl", "seated curl", "seated hamstring curl", "hamstring curl"],
  "lying-leg-curl": ["prone curl", "lying ham curl", "lying hamstring curl"],
  "hip-thrust": ["thrust", "glute thrust", "bb hip thrust", "barbell hip thrust"],
  "glute-bridge": ["bridge", "hip bridge"],
  "calf-raise": ["calves", "standing calf", "calf raises", "standing calf raise"],
  "seated-calf-raise": ["seated calf", "soleus raise"],
  "barbell-curl": ["bb curl", "bicep curl", "straight bar curl", "standing barbell curl"],
  "dumbbell-curl": ["db curl", "biceps curl", "db bicep", "standing db curl"],
  "hammer-curl": ["hammer", "neutral curl", "db hammer curl"],
  "preacher-curl": ["preacher", "scott curl", "ez bar preacher"],
  "cable-curl": ["cable bicep curl", "biceps cable"],
  "triceps-pushdown": ["pushdown", "tricep pushdown", "rope pushdown", "cable pushdown", "straight bar pushdown"],
  "overhead-triceps-extension": ["overhead tricep", "french press", "katana curl", "cable overhead tricep"],
  "skull-crusher": ["skullcrushers", "skull crusher", "skullcrusher", "lying tricep extension", "ez bar skull crusher"],
  "close-grip-bench": ["cgbp", "close grip", "close grip bench", "close grip bench press"],
  "plank": ["ab plank", "elbow plank"],
  "hanging-leg-raise": ["leg raise", "hanging knee raise", "hanging toes to bar"],
  "cable-crunch": ["rope crunch", "kneeling cable crunch"],
  "ab-wheel": ["ab rollout", "wheel rollout", "ab roller"],
  "russian-twist": ["russian twists", "seated twist"],
  "kettlebell-swing": ["kb swing", "russian swing", "kettlebell"],
  "farmer-carry": ["farmers walk", "farmer walk", "trap bar carry"],
  "rower": ["rowing", "erg", "concept 2", "rowing ergometer"],
  "assault-bike": ["air bike", "echo bike", "fan bike"],
  "treadmill-incline": ["incline walk", "12-3-30", "treadmill"],
  "burpee": ["burpees"],
};

/**
 * Match a user search query against an exercise by:
 * 1. Standard fields (name, slug, primary muscle, secondary muscles, equipment, pattern)
 * 2. Aliases and abbreviations (e.g., "rdl" -> Romanian Deadlift, "ohp" -> Overhead Press)
 * 3. Acronyms (e.g. first letter of each word in the exercise name)
 */
export function matchExercise(
  query: string,
  exercise: {
    slug: string;
    name: string;
    primaryMuscle: string;
    secondaryMuscles?: string[];
    equipment: string;
    pattern?: string;
  },
): boolean {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return true;

  // Direct token match in standard fields
  const baseText = [
    exercise.name,
    exercise.slug,
    exercise.primaryMuscle,
    ...(exercise.secondaryMuscles ?? []),
    exercise.equipment,
    exercise.pattern ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (baseText.includes(cleanQ)) return true;

  // Check aliases
  const aliases = EXERCISE_ALIASES[exercise.slug] ?? [];
  for (const alias of aliases) {
    if (alias.toLowerCase().includes(cleanQ) || cleanQ.includes(alias.toLowerCase())) {
      return true;
    }
  }

  // Check acronym match (e.g. "rdl" matches "Romanian Deadlift", "bss" matches "Bulgarian Split Squat")
  const words = exercise.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const initials = words.map((w) => w[0]).join("");
  if (initials === cleanQ || initials.startsWith(cleanQ)) {
    return true;
  }

  // Also check without "barbell", "dumbbell", "seated" prefixes
  const keyWords = words.filter((w) => !["barbell", "dumbbell", "seated", "standing", "cable", "machine"].includes(w));
  const keyInitials = keyWords.map((w) => w[0]).join("");
  if (keyInitials && (keyInitials === cleanQ || keyInitials.startsWith(cleanQ))) {
    return true;
  }

  return false;
}

/**
 * Looks up an exercise slug and display name by an alias, acronym, or raw name.
 */
export function findExerciseByAlias(query: string): { slug: string; name: string } | null {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;

  // Exact slug match or slug without dashes
  for (const [slug, aliases] of Object.entries(EXERCISE_ALIASES)) {
    if (slug === clean || slug.replace(/-/g, " ") === clean) {
      return {
        slug,
        name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      };
    }
    for (const alias of aliases) {
      if (alias.toLowerCase() === clean) {
        return {
          slug,
          name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        };
      }
    }
  }

  // Substring or token match
  for (const [slug, aliases] of Object.entries(EXERCISE_ALIASES)) {
    for (const alias of aliases) {
      if (clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean)) {
        return {
          slug,
          name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        };
      }
    }
  }

  return null;
}
