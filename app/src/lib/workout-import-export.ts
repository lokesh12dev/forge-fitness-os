/**
 * FORGE Universal Workout CSV Importer & Exporter (A11)
 *
 * Implements high-tolerance CSV parsing for external gym loggers:
 * - Hevy
 * - Strong
 * - FitNotes
 * - Jefit
 * - FORGE Universal CSV
 *
 * Automatically canonicalizes exercise names using the alias engine,
 * detects weight units (kg vs lbs), handles multi-workout CSVs, and calculates volume.
 */

import { findExerciseByAlias } from "./exercise-aliases";

export interface ParsedSet {
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  type: "normal" | "warmup" | "drop" | "failure";
  notes?: string;
}

export interface ParsedExercise {
  exerciseName: string;
  exerciseSlug: string;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  date: string; // ISO format or YYYY-MM-DD
  workoutName: string;
  sourceApp: "hevy" | "strong" | "fitnotes" | "jefit" | "forge" | "unknown";
  exercises: ParsedExercise[];
  totalSets: number;
  totalVolumeKg: number;
}

export interface ImportResult {
  workouts: ParsedWorkout[];
  totalWorkouts: number;
  totalSets: number;
  totalVolumeKg: number;
  unmappedExercises: string[];
  detectedSource: "hevy" | "strong" | "fitnotes" | "jefit" | "forge" | "unknown";
}

/**
 * Normalizes an exercise name to a known FORGE exercise slug.
 */
export function canonicalizeExerciseName(rawName: string): { slug: string; displayName: string } {
  const cleaned = rawName.trim();
  const aliasMatch = findExerciseByAlias(cleaned);
  if (aliasMatch) {
    return {
      slug: aliasMatch.slug,
      displayName: aliasMatch.name,
    };
  }

  // Fallback slugify
  const fallbackSlug = cleaned
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  return {
    slug: fallbackSlug,
    displayName: cleaned,
  };
}

/**
 * Simple robust CSV row splitter supporting quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detects the source logger from the CSV header line.
 */
export function detectCSVFormat(headerLine: string): "hevy" | "strong" | "fitnotes" | "jefit" | "forge" | "unknown" {
  const lower = headerLine.toLowerCase();
  if (lower.includes("forge") || lower.includes("workoutsexported")) return "forge";
  if (lower.includes("workout name") && lower.includes("exercise name") && (lower.includes("weight (kg)") || lower.includes("weight (lbs)"))) return "hevy";
  if (lower.includes("workout name") && lower.includes("exercise name") && lower.includes("set order")) return "strong";
  if (lower.includes("category") && lower.includes("weight (kgs)") || (lower.includes("fitnotes"))) return "fitnotes";
  if (lower.includes("jefit") || (lower.includes("exercise") && lower.includes("set") && !lower.includes("order"))) return "jefit";
  return "unknown";
}

/**
 * Parses raw CSV text into a structured list of workouts.
 */
export function parseWorkoutCSV(csvText: string): ImportResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      workouts: [],
      totalWorkouts: 0,
      totalSets: 0,
      totalVolumeKg: 0,
      unmappedExercises: [],
      detectedSource: "unknown",
    };
  }

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const detectedSource = detectCSVFormat(lines[0]);

  // Find column indexes
  const dateIdx = header.findIndex((h) => h.includes("date") || h === "timestamp");
  const workoutNameIdx = header.findIndex((h) => h.includes("workout name") || h.includes("routine"));
  const exerciseIdx = header.findIndex((h) => h.includes("exercise name") || h === "exercise");
  const weightIdx = header.findIndex((h) => h.startsWith("weight"));
  const repsIdx = header.findIndex((h) => h.startsWith("rep"));
  const rpeIdx = header.findIndex((h) => h === "rpe");
  const setOrderIdx = header.findIndex((h) => h.includes("set order") || h === "set");
  const notesIdx = header.findIndex((h) => h.includes("note"));

  // Check if lbs is default in header
  const isLbsHeader = header[weightIdx]?.includes("lbs") ?? false;

  const workoutMap = new Map<string, { date: string; name: string; exercises: Map<string, ParsedSet[]> }>();
  const unmapped = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= Math.max(dateIdx, exerciseIdx, weightIdx, repsIdx)) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().slice(0, 10);
    const rawWorkoutName = workoutNameIdx >= 0 && cols[workoutNameIdx] ? cols[workoutNameIdx] : "Imported Workout";
    const rawExercise = exerciseIdx >= 0 ? cols[exerciseIdx] : "Unknown Exercise";
    if (!rawExercise) continue;

    const rawWeight = weightIdx >= 0 ? parseFloat(cols[weightIdx].replace(/[^\d.-]/g, "")) || 0 : 0;
    const rawReps = repsIdx >= 0 ? parseInt(cols[repsIdx].replace(/[^\d]/g, ""), 10) || 0 : 0;
    const rawRpe = rpeIdx >= 0 ? parseFloat(cols[rpeIdx]) || undefined : undefined;
    const rawNotes = notesIdx >= 0 ? cols[notesIdx] : undefined;

    // Convert lbs to kg if needed
    const isLbs = isLbsHeader || cols.some((c) => c.toLowerCase() === "lbs");
    const weightKg = isLbs ? Math.round(rawWeight * 0.45359237 * 10) / 10 : rawWeight;

    const { slug, displayName } = canonicalizeExerciseName(rawExercise);
    if (!findExerciseByAlias(rawExercise)) {
      unmapped.add(rawExercise);
    }

    const workoutKey = `${rawDate}::${rawWorkoutName}`;
    if (!workoutMap.has(workoutKey)) {
      workoutMap.set(workoutKey, {
        date: rawDate,
        name: rawWorkoutName,
        exercises: new Map<string, ParsedSet[]>(),
      });
    }

    const currentWorkout = workoutMap.get(workoutKey)!;
    if (!currentWorkout.exercises.has(displayName)) {
      currentWorkout.exercises.set(displayName, []);
    }

    const setsList = currentWorkout.exercises.get(displayName)!;
    const setIndex = setsList.length + 1;

    setsList.push({
      setIndex,
      weightKg,
      reps: rawReps,
      rpe: rawRpe && rawRpe >= 5 && rawRpe <= 10 ? rawRpe : undefined,
      type: "normal",
      notes: rawNotes,
    });
  }

  const workouts: ParsedWorkout[] = [];
  let totalSets = 0;
  let totalVolumeKg = 0;

  for (const [_, w] of workoutMap.entries()) {
    const exercises: ParsedExercise[] = [];
    let workoutSets = 0;
    let workoutVolume = 0;

    for (const [exName, sets] of w.exercises.entries()) {
      const { slug } = canonicalizeExerciseName(exName);
      exercises.push({
        exerciseName: exName,
        exerciseSlug: slug,
        sets,
      });

      for (const s of sets) {
        workoutSets++;
        workoutVolume += s.weightKg * s.reps;
      }
    }

    totalSets += workoutSets;
    totalVolumeKg += workoutVolume;

    workouts.push({
      date: w.date,
      workoutName: w.name,
      sourceApp: detectedSource,
      exercises,
      totalSets: workoutSets,
      totalVolumeKg: Math.round(workoutVolume),
    });
  }

  // Sort chronological
  workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    workouts,
    totalWorkouts: workouts.length,
    totalSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    unmappedExercises: Array.from(unmapped),
    detectedSource,
  };
}

/**
 * Generates an export CSV matching standard universal fitness logging schemas.
 */
export function exportWorkoutsToCSV(workouts: ParsedWorkout[]): string {
  const header = "Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE,Notes\n";
  const rows: string[] = [];

  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const row = [
          `"${w.date}"`,
          `"${w.workoutName.replace(/"/g, '""')}"`,
          `"${ex.exerciseName.replace(/"/g, '""')}"`,
          s.setIndex,
          s.weightKg,
          s.reps,
          s.rpe ?? "",
          `"${(s.notes ?? "").replace(/"/g, '""')}"`,
        ].join(",");
        rows.push(row);
      }
    }
  }

  return header + rows.join("\n");
}
