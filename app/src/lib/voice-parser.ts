/**
 * Voice and Natural Language Parser for Workout Logging (C1)
 *
 * Parses spoken or typed workout phrases into structured set logs:
 * - "bench 100 kilos for 8 reps at rpe 8"
 * - "100x8@8" or "100 x 8 @ 8.5"
 * - "squat 140 for 5"
 * - "two plates for 5" (gym slang: 1 plate = 60kg, 2 plates = 100kg, 3 = 140kg, 4 = 180kg)
 * - "plate and a quarter for 10" (70kg = 20 + 2x20 + 2x5)
 * - "pullups bodyweight for 10"
 * - "warmup 60 for 10" / "failure 80 for 12"
 * - "skip rest" / "+30 seconds" / "rest 90"
 * - Number words: "eighty five kilos for eight reps at rpe seven point five"
 */

export type ParsedLogCommand = {
  matched: boolean;
  action: "log_set" | "skip_rest" | "adjust_rest" | "next_exercise" | "unknown";
  exerciseName?: string;
  weightKg?: number;
  reps?: number;
  rpe?: number;
  isWarmup?: boolean;
  isFailure?: boolean;
  restAdjustmentSec?: number;
  confidence: number;
  rawText: string;
  explanation: string;
};

// Word to number dictionary for spoken English
const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

// Gym plate slang conversions (standard 20kg Olympic bar + 20kg pairs)
const PLATE_SLANG: Record<string, number> = {
  "half plate": 40, // 20 bar + 10x2
  "a plate": 60,
  "one plate": 60,
  "1 plate": 60,
  "plate and a quarter": 70, // 20 bar + 20x2 + 5x2
  "plate and a dime": 80, // 20 bar + 20x2 + 10x2
  "two plates": 100,
  "2 plates": 100,
  "two and a half plates": 120,
  "three plates": 140,
  "3 plates": 140,
  "four plates": 180,
  "4 plates": 180,
  "five plates": 220,
  "5 plates": 220,
};

/** Convert number words like "eighty five" or "one hundred twenty" to numeric string */
export function normalizeNumberWords(text: string): string {
  let cleaned = text.toLowerCase().trim();

  // Handle "one hundred twenty" or "two hundred fifty" (only matching valid tens/ones number words)
  const tensWords = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
  const onesWords = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
  const hundredRegex = new RegExp(
    `\\b(one|two|three|four|five|six|seven|eight|nine)?\\s*hundred(?:\\s*and)?(?:\\s+(${tensWords}))?(?:\\s+(${onesWords}))?\\b`,
    "g",
  );
  cleaned = cleaned.replace(hundredRegex, (_, hDigit, tens, ones) => {
    const hVal = (hDigit ? WORD_NUMBERS[hDigit] : 1) * 100;
    let rem = 0;
    if (tens && WORD_NUMBERS[tens] !== undefined) {
      rem += WORD_NUMBERS[tens];
    }
    if (ones && WORD_NUMBERS[ones] !== undefined) {
      rem += WORD_NUMBERS[ones];
    }
    return String(hVal + rem);
  });

  // Handle "point five" or "half"
  cleaned = cleaned.replace(/\b(\w+)\s+point\s+five\b/g, "$1.5");
  cleaned = cleaned.replace(/\b(\w+)\s+and\s+a\s+half\b/g, "$1.5");

  // Handle compound numbers: "eighty five" -> 85
  const compoundRegex = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\b/g;
  cleaned = cleaned.replace(compoundRegex, (_, tens, ones) => {
    return String((WORD_NUMBERS[tens] || 0) + (WORD_NUMBERS[ones] || 0));
  });

  // Handle single words: "one", "two", "ten", etc.
  for (const [word, val] of Object.entries(WORD_NUMBERS)) {
    const rx = new RegExp(`\\b${word}\\b`, "g");
    cleaned = cleaned.replace(rx, String(val));
  }

  return cleaned;
}

export function parseWorkoutVoiceCommand(
  rawInput: string,
  context?: {
    currentExercise?: string;
    currentWeight?: number;
    currentReps?: number;
    currentRpe?: number;
  },
): ParsedLogCommand {
  const rawText = rawInput.trim();
  if (!rawText) {
    return {
      matched: false,
      action: "unknown",
      confidence: 0,
      rawText,
      explanation: "Empty input.",
    };
  }

  let text = rawText.toLowerCase();

  // Check for rest timer commands
  if (/\b(skip\s+rest|cancel\s+timer|stop\s+timer|skip\s+timer)\b/.test(text)) {
    return {
      matched: true,
      action: "skip_rest",
      confidence: 1.0,
      rawText,
      explanation: "Rest timer skipped.",
    };
  }

  const addSecMatch = text.match(/(?:add|\+)\s*(\d+)\s*(?:seconds?|secs?|s)\b/);
  if (addSecMatch) {
    const sec = Number(addSecMatch[1]);
    return {
      matched: true,
      action: "adjust_rest",
      restAdjustmentSec: sec,
      confidence: 0.95,
      rawText,
      explanation: `Add ${sec} seconds to rest timer.`,
    };
  }

  if (/\b(next\s+exercise|next\s+lift|advance\s+exercise)\b/.test(text)) {
    return {
      matched: true,
      action: "next_exercise",
      confidence: 1.0,
      rawText,
      explanation: "Advance to next exercise.",
    };
  }

  // Detect set qualifiers
  const isWarmup = /\b(warmup|warm\s*up|warm-up)\b/.test(text);
  const isFailure = /\b(failure|to\s+failure|fail|amrap)\b/.test(text);

  // Check for plate slang first on raw lowercase text (sorted by length descending so longer phrases match first)
  let detectedWeight: number | undefined;
  const plateEntries = Object.entries(PLATE_SLANG).sort((a, b) => b[0].length - a[0].length);
  for (const [slang, kg] of plateEntries) {
    if (text.includes(slang)) {
      detectedWeight = kg;
      text = text.replace(slang, `${kg} kg`);
      break;
    }
  }

  // Now normalize remaining number words
  text = normalizeNumberWords(text);

  // Also support "2.5 plates" if "two and a half plates" became "2.5 plates"
  if (detectedWeight === undefined && text.includes("2.5 plates")) {
    detectedWeight = 120;
    text = text.replace("2.5 plates", "120 kg");
  }

  // Check for bodyweight
  const isBodyweight = /\b(bodyweight|bw|body\s+weight)\b/.test(text);
  if (isBodyweight) {
    detectedWeight = 0;
  }

  // Extract RPE / RIR
  let rpe: number | undefined;
  const rpeMatch = text.match(/\b(?:rpe|@)\s*(\d+(?:\.\d+)?)\b/);
  if (rpeMatch) {
    rpe = Number(rpeMatch[1]);
  } else {
    const rirMatch = text.match(/\b(\d+)\s*(?:rir|reps?\s+in\s+reserve)\b/);
    if (rirMatch) {
      const rir = Number(rirMatch[1]);
      rpe = Math.max(1, 10 - rir);
    }
  }

  // Parse shorthand patterns: "100x8@8", "100 x 8 @ 8", "100x8", "100*8"
  const shorthandMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|\*)\s*(\d+)(?:\s*(?:@|rpe)\s*(\d+(?:\.\d+)?))?/);
  if (shorthandMatch) {
    const weight = Number(shorthandMatch[1]);
    const reps = Number(shorthandMatch[2]);
    const parsedRpe = shorthandMatch[3] ? Number(shorthandMatch[3]) : rpe ?? context?.currentRpe ?? 8;

    return {
      matched: true,
      action: "log_set",
      weightKg: weight,
      reps,
      rpe: Math.min(10, Math.max(1, parsedRpe)),
      isWarmup,
      isFailure,
      confidence: 0.95,
      rawText,
      explanation: `${weight} kg × ${reps} reps @ RPE ${parsedRpe}${isWarmup ? " (Warmup)" : isFailure ? " (Failure)" : ""}`,
    };
  }

  // Extract reps if explicitly mentioned with "for X", "X reps", "X times"
  let reps: number | undefined;
  const repsMatch = text.match(/(?:for|x)\s*(\d+)\s*(?:reps?|times)?\b/) || text.match(/\b(\d+)\s*(?:reps?|times)\b/);
  if (repsMatch) {
    reps = Number(repsMatch[1]);
  }

  // Extract weight if not already resolved by plate slang
  if (detectedWeight === undefined) {
    // Check for explicit weight units: "100kg", "100 kilos", "100 lbs"
    const unitWeightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|lbs?|pounds?)\b/);
    if (unitWeightMatch) {
      detectedWeight = Number(unitWeightMatch[1]);
    } else {
      // Check for weight before "for": "100 for 8"
      const beforeForMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:for\s*\d+)/);
      if (beforeForMatch) {
        detectedWeight = Number(beforeForMatch[1]);
      }
    }
  }

  // Fallback: extract all lone numbers
  if (detectedWeight === undefined || reps === undefined) {
    const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length >= 2) {
      if (detectedWeight === undefined) detectedWeight = numbers[0];
      if (reps === undefined) reps = numbers[1];
      if (rpe === undefined && numbers.length >= 3) {
        // If 3rd number is between 5 and 10, treat as RPE
        if (numbers[2] >= 5 && numbers[2] <= 10) {
          rpe = numbers[2];
        }
      }
    } else if (numbers.length === 1) {
      // Just one number: if "for 8", it's reps using current weight
      if (text.includes("for") || text.includes("reps")) {
        reps = numbers[0];
        detectedWeight = context?.currentWeight ?? 0;
      } else {
        // Assume weight using context reps
        detectedWeight = numbers[0];
        reps = context?.currentReps ?? 8;
      }
    }
  }

  // Final fallback from context
  if (detectedWeight === undefined && context?.currentWeight !== undefined) {
    detectedWeight = context.currentWeight;
  }
  if (reps === undefined && context?.currentReps !== undefined) {
    reps = context.currentReps;
  }
  if (rpe === undefined) {
    rpe = context?.currentRpe ?? 8;
  }

  // Extract exercise name if mentioned in text (sort by length descending so multi-word names match first)
  let exerciseName: string | undefined;
  const exerciseKeywords = [
    "incline dumbbell press", "incline dumbbell", "incline bench", "dumbbell press", "bench press", "bench",
    "front squat", "back squat", "hack squat", "leg press", "squat",
    "romanian deadlift", "deadlift", "rdl",
    "overhead press", "shoulder press", "lateral raise", "ohp",
    "barbell row", "dumbbell row", "cable row",
    "lat pulldown", "pullups", "pullup", "pull up", "chin up",
    "skull crusher", "tricep pushdown", "tricep extension",
    "bicep curl", "curl",
  ].sort((a, b) => b.length - a.length);

  for (const kw of exerciseKeywords) {
    if (text.includes(kw)) {
      exerciseName = kw.charAt(0).toUpperCase() + kw.slice(1);
      break;
    }
  }

  if (detectedWeight !== undefined && reps !== undefined && reps > 0) {
    return {
      matched: true,
      action: "log_set",
      exerciseName: exerciseName ?? context?.currentExercise,
      weightKg: detectedWeight,
      reps,
      rpe: Math.min(10, Math.max(1, rpe)),
      isWarmup,
      isFailure,
      confidence: exerciseName ? 0.95 : 0.85,
      rawText,
      explanation: `${detectedWeight === 0 ? "Bodyweight" : `${detectedWeight} kg`} × ${reps} reps @ RPE ${rpe}${isWarmup ? " (Warmup)" : isFailure ? " (Failure)" : ""}`,
    };
  }

  return {
    matched: false,
    action: "unknown",
    confidence: 0.2,
    rawText,
    explanation: `Could not parse set. Try "100 kilos for 8" or "100x8@8".`,
  };
}
