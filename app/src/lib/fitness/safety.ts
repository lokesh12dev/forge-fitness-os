/**
 * Pure Safety, Red-Flag, Injury-Exclusion, and Clinical-Referral Rules
 * Zero side effects, zero LLM calls.
 */

export type SafetyCategory =
  | "medical_red_flag"
  | "eating_disorder"
  | "ped_dosing"
  | "injury"
  | "none";

export interface SafetyEvaluation {
  flagged: boolean;
  category: SafetyCategory;
  matchedSignals: string[];
  requiresClinicalReferral: boolean;
  refusalOrGuidance: string | null;
}

const MEDICAL_RED_FLAG_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bchest\s+pain\b/i, label: "chest pain" },
  { pattern: /\b(dizzy|dizziness|faint|fainted|syncope|lightheaded)\b/i, label: "dizziness/syncope" },
  { pattern: /\bshortness\s+of\s+breath\b/i, label: "shortness of breath" },
  { pattern: /\b(numbness|tingling|radiating\s+pain|sciatica)\b/i, label: "nerve/radicular symptoms" },
  { pattern: /\b(sharp|stabbing|tearing)\s+(joint|knee|shoulder|back|neck)\s+pain\b/i, label: "sharp joint pain" },
  { pattern: /\bheart\s+palpitations\b/i, label: "heart palpitations" },
];

const EATING_DISORDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(purge|purging|laxative|bulimia|anorexia|starve\s+myself)\b/i, label: "disordered eating behavior" },
  { pattern: /\b(eat\s+0\s+calories|zero\s+calories\s+a\s+day|water\s+fast\s+for\s+\d+\s+days)\b/i, label: "extreme caloric restriction" },
  { pattern: /\b(under|below)\s*(800|900|1000)\s*(?:k?cal|calories?)\b/i, label: "unsafe sub-1000 kcal target" },
  { pattern: /\b([1-9]\d{2})\s*(?:k?cal|calories?)\b/i, label: "unsafe sub-1000 kcal target" },
];

const PED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(tren|trenbolone|anavar|winstrol|dianabol|deca|test\s*e|testosterone\s+cycle|sarm|rad-?140|ostarine|mk-?677|clenbuterol|dnp)\b/i, label: "PED/SARM substance" },
  { pattern: /\b(steroid|gear)\s*(cycle|dose|dosing|mg|stack)\b/i, label: "anabolic dosing" },
];

export const INJURY_EXCLUSION_RULES: Record<
  string,
  {
    patterns: string[];
    nameRegex: RegExp;
    safeSubstitutes: string[];
    guidance: string;
  }
> = {
  shoulder: {
    patterns: ["vertical_push"],
    nameRegex: /\b(overhead\s+press|behind[\s-]the[\s-]neck|upright\s+row|dip|arnold\s+press|fly)\b/i,
    safeSubstitutes: ["ex-face-pull", "ex-lateral-raise", "ex-cable-fly", "ex-incline-dumbbell-press"],
    guidance: "Avoid painful overhead pressing, dips, and upright rows; favor scapular-plane or neutral-grip variations.",
  },
  lower_back: {
    patterns: ["hinge"],
    nameRegex: /\b(deadlift|good\s+morning|barbell\s+row|pendlay|back\s+squat)\b/i,
    safeSubstitutes: ["ex-chest-supported-row", "ex-leg-press", "ex-leg-curl", "ex-glute-bridge"],
    guidance: "Avoid heavy axial spinal loading and unsupported bent-over hinges; prefer chest-supported and machine-stabilized lifts.",
  },
  knee: {
    patterns: ["squat", "lunge", "jump_box"],
    nameRegex: /\b(squat|lunge|split\s+squat|jump\s+box|leg\s+extension|step[\s-]up)\b/i,
    safeSubstitutes: ["ex-romanian-deadlift", "ex-glute-bridge", "ex-leg-curl", "ex-hip-thrust"],
    guidance: "Avoid deep loaded knee flexion and ballistic jumping; prioritize hip-dominant posterior chain work.",
  },
  wrist: {
    patterns: [],
    nameRegex: /\b(barbell\s+curl|skull\s+crusher|front\s+squat|push[\s-]up|clean)\b/i,
    safeSubstitutes: ["ex-hammer-curl", "ex-triceps-pushdown", "ex-leg-press", "ex-machine-chest-press"],
    guidance: "Avoid extreme wrist extension or supinated straight-bar loading; use neutral-grip dumbbells, cables, or machines.",
  },
  elbow: {
    patterns: [],
    nameRegex: /\b(skull\s+crusher|preacher\s+curl|chin[\s-]up|overhead\s+triceps)\b/i,
    safeSubstitutes: ["ex-triceps-pushdown", "ex-hammer-curl", "ex-cable-fly"],
    guidance: "Avoid high-torque elbow flexion/extension at full stretch; use controlled cable or neutral-grip work.",
  },
  neck: {
    patterns: [],
    nameRegex: /\b(shrug|behind[\s-]the[\s-]neck|neck\s+curl|upright\s+row)\b/i,
    safeSubstitutes: ["ex-chest-supported-row", "ex-face-pull"],
    guidance: "Avoid heavy cervical/upper-trap loading and behind-the-neck movements.",
  },
  ankle: {
    patterns: ["jump_box"],
    nameRegex: /\b(calf\s+raise|jump|sprint|box\s+jump|lunge)\b/i,
    safeSubstitutes: ["ex-leg-extension", "ex-leg-curl", "ex-glute-bridge"],
    guidance: "Avoid high-impact plyometrics and heavy ankle dorsiflexion; use seated machine work.",
  },
};

export function normalizeInjuryKey(raw: string): string | null {
  const low = raw.toLowerCase().trim();
  if (!low) return null;
  if (low.includes("shoulder") || low.includes("rotator")) return "shoulder";
  if (low.includes("back") || low.includes("lumbar") || low.includes("spine") || low.includes("disc")) return "lower_back";
  if (low.includes("knee") || low.includes("patella") || low.includes("meniscus")) return "knee";
  if (low.includes("wrist") || low.includes("carpal")) return "wrist";
  if (low.includes("elbow") || low.includes("tendon")) return "elbow";
  if (low.includes("neck") || low.includes("cervical")) return "neck";
  if (low.includes("ankle") || low.includes("achilles")) return "ankle";
  return null;
}

export function isExerciseContraindicated(
  exercise: { name: string; pattern?: string },
  injuries: string[],
): { contraindicated: boolean; injuryKey: string | null; reason: string | null } {
  for (const rawInjury of injuries) {
    const key = normalizeInjuryKey(rawInjury);
    if (!key) continue;
    const rule = INJURY_EXCLUSION_RULES[key];
    if (!rule) continue;
    if (
      (exercise.pattern && rule.patterns.includes(exercise.pattern)) ||
      rule.nameRegex.test(exercise.name)
    ) {
      return {
        contraindicated: true,
        injuryKey: key,
        reason: `${exercise.name} conflicts with reported ${key.replace("_", " ")} constraint. ${rule.guidance}`,
      };
    }
  }
  return { contraindicated: false, injuryKey: null, reason: null };
}

export function filterExercisesForInjuries<
  T extends { id: string; name: string; pattern?: string },
>(exercises: T[], injuries: string[]): { safe: T[]; excluded: Array<{ exercise: T; reason: string }> } {
  if (!injuries.length) return { safe: exercises, excluded: [] };
  const safe: T[] = [];
  const excluded: Array<{ exercise: T; reason: string }> = [];
  for (const ex of exercises) {
    const check = isExerciseContraindicated(ex, injuries);
    if (check.contraindicated && check.reason) {
      excluded.push({ exercise: ex, reason: check.reason });
    } else {
      safe.push(ex);
    }
  }
  return { safe, excluded };
}

export function evaluateSafetyPrompt(userMessage: string): SafetyEvaluation {
  const msg = userMessage.trim();
  if (!msg) {
    return { flagged: false, category: "none", matchedSignals: [], requiresClinicalReferral: false, refusalOrGuidance: null };
  }

  const edMatches = EATING_DISORDER_PATTERNS.filter((p) => p.pattern.test(msg)).map((p) => p.label);
  if (edMatches.length > 0) {
    return {
      flagged: true,
      category: "eating_disorder",
      matchedSignals: edMatches,
      requiresClinicalReferral: true,
      refusalOrGuidance:
        "I cannot generate extreme restriction, purging, or sub-1,000 kcal plans. Please speak with a licensed physician or registered dietitian for safe, individualized support. If you'd like, we can set a sustainable, evidence-based nutrition target above safe clinical floors.",
    };
  }

  const pedMatches = PED_PATTERNS.filter((p) => p.pattern.test(msg)).map((p) => p.label);
  if (pedMatches.length > 0) {
    return {
      flagged: true,
      category: "ped_dosing",
      matchedSignals: pedMatches,
      requiresClinicalReferral: true,
      refusalOrGuidance:
        "I cannot provide dosing, cycle protocols, or recommendations for anabolic steroids, SARMs, or performance-enhancing drugs. Please consult a qualified physician for medical guidance. I can help optimize your natural training, recovery, and evidence-based nutrition.",
    };
  }

  const medMatches = MEDICAL_RED_FLAG_PATTERNS.filter((p) => p.pattern.test(msg)).map((p) => p.label);
  if (medMatches.length > 0) {
    return {
      flagged: true,
      category: "medical_red_flag",
      matchedSignals: medMatches,
      requiresClinicalReferral: true,
      refusalOrGuidance:
        `Stop training immediately if you are experiencing ${medMatches.join(", ")}. I cannot prescribe workouts over acute medical symptoms—please seek evaluation from a licensed healthcare professional before resuming exercise.`,
    };
  }

  const detectedInjury = normalizeInjuryKey(msg);
  if (detectedInjury) {
    const rule = INJURY_EXCLUSION_RULES[detectedInjury];
    return {
      flagged: true,
      category: "injury",
      matchedSignals: [detectedInjury],
      requiresClinicalReferral: false,
      refusalOrGuidance: `Noted ${detectedInjury.replace("_", " ")} sensitivity. ${rule.guidance}`,
    };
  }

  return {
    flagged: false,
    category: "none",
    matchedSignals: [],
    requiresClinicalReferral: false,
    refusalOrGuidance: null,
  };
}
