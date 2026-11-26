/**
 * FORGE Cardio & Advanced Set Types Engine (A12, A13)
 *
 * Implements:
 * - Heart rate zone calculations (Tanaka formula: HRmax = 208 - 0.7 * age)
 * - Caloric expenditure via METs (Metabolic Equivalent of Task)
 * - Pace, speed & Haversine GPS distance formulas
 * - Tempo notation parser ("3-1-1-0" eccentric, isometric, concentric, pause)
 * - Unilateral split load tracker
 * - Myo-reps and AMRAP volume calculations
 */

export type CardioModality = "run" | "treadmill" | "cycle" | "row" | "stairmaster" | "walk" | "hiit";

export interface HeartRateZones {
  maxHr: number;
  restingHr: number;
  zone1: { min: number; max: number; label: "Active Recovery" };
  zone2: { min: number; max: number; label: "Aerobic Base" };
  zone3: { min: number; max: number; label: "Tempo / Aerobic" };
  zone4: { min: number; max: number; label: "Lactate Threshold" };
  zone5: { min: number; max: number; label: "Anaerobic Peak" };
}

export const MODALITY_METS: Record<CardioModality, { label: string; baseMet: number; speedMetFactor?: number }> = {
  run: { label: "Outdoor Run", baseMet: 9.8 },
  treadmill: { label: "Treadmill Run", baseMet: 9.0 },
  cycle: { label: "Stationary Bike", baseMet: 7.5 },
  row: { label: "Rowing Machine", baseMet: 7.0 },
  stairmaster: { label: "Stairmaster", baseMet: 8.5 },
  walk: { label: "Brisk Incline Walk", baseMet: 4.5 },
  hiit: { label: "HIIT Intervals", baseMet: 11.0 },
};

/**
 * Calculates heart rate training zones using the Tanaka formula.
 */
export function calculateHeartRateZones(age = 28, restingHr = 56): HeartRateZones {
  const maxHr = Math.round(208 - 0.7 * age);
  return {
    maxHr,
    restingHr,
    zone1: { min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60) - 1, label: "Active Recovery" },
    zone2: { min: Math.round(maxHr * 0.60), max: Math.round(maxHr * 0.70) - 1, label: "Aerobic Base" },
    zone3: { min: Math.round(maxHr * 0.70), max: Math.round(maxHr * 0.80) - 1, label: "Tempo / Aerobic" },
    zone4: { min: Math.round(maxHr * 0.80), max: Math.round(maxHr * 0.90) - 1, label: "Lactate Threshold" },
    zone5: { min: Math.round(maxHr * 0.90), max: maxHr, label: "Anaerobic Peak" },
  };
}

/**
 * Calculates calories burned using standard ACSM MET formula:
 * Calories = MET * weightKg * durationHours
 */
export function calculateCardioCalories(
  modality: CardioModality,
  durationMinutes: number,
  weightKg = 78
): number {
  const met = MODALITY_METS[modality]?.baseMet ?? 7.0;
  const hours = durationMinutes / 60;
  return Math.round(met * weightKg * hours);
}

/**
 * Calculates pace in minutes and seconds per kilometer.
 */
export function calculatePace(distanceKm: number, durationSeconds: number): {
  paceFormatted: string;
  speedKmh: number;
} {
  if (distanceKm <= 0 || durationSeconds <= 0) {
    return { paceFormatted: "—", speedKmh: 0 };
  }

  const speedKmh = Math.round((distanceKm / (durationSeconds / 3600)) * 10) / 10;
  const secondsPerKm = durationSeconds / distanceKm;
  const paceMinutes = Math.floor(secondsPerKm / 60);
  const paceSeconds = Math.round(secondsPerKm % 60);
  const paceFormatted = `${paceMinutes}:${paceSeconds < 10 ? "0" : ""}${paceSeconds} /km`;

  return {
    paceFormatted,
    speedKmh,
  };
}

/**
 * Haversine formula for calculating GPS distance between two coordinate points.
 */
export function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000; // in km
}

/* ───────────────────────────── ADVANCED SET TYPES (A13) ───────────────────────────── */

export interface ParsedTempo {
  valid: boolean;
  eccentricSec: number;
  isometricSec: number;
  concentricSec: number;
  pauseSec: number;
  formatted: string;
  explanation: string;
}

/**
 * Parses and validates 4-digit tempo prescriptions (e.g. "3-1-1-0" or "4010").
 */
export function parseTempo(rawTempo: string): ParsedTempo {
  const cleaned = rawTempo.replace(/[^0-9xX]/g, "");
  if (cleaned.length !== 4) {
    return {
      valid: false,
      eccentricSec: 0,
      isometricSec: 0,
      concentricSec: 0,
      pauseSec: 0,
      formatted: rawTempo,
      explanation: "Invalid tempo. Use 4-digit format (e.g. 3-1-1-0 or 4010).",
    };
  }

  const eccentricSec = parseInt(cleaned[0], 10) || 0;
  const isometricSec = parseInt(cleaned[1], 10) || 0;
  const concentricSec = cleaned[2].toLowerCase() === "x" ? 1 : parseInt(cleaned[2], 10) || 0;
  const pauseSec = parseInt(cleaned[3], 10) || 0;

  const formatted = `${eccentricSec}-${isometricSec}-${cleaned[2].toUpperCase()}-${pauseSec}`;
  const explanation = `${eccentricSec}s descent, ${isometricSec}s bottom pause, ${cleaned[2].toUpperCase() === "X" ? "explosive" : `${concentricSec}s`} ascent, ${pauseSec}s lockout.`;

  return {
    valid: true,
    eccentricSec,
    isometricSec,
    concentricSec,
    pauseSec,
    formatted,
    explanation,
  };
}

/**
 * Calculates volume for unilateral exercises tracking independent limbs.
 */
export function calculateUnilateralVolume(
  leftWeightKg: number, leftReps: number,
  rightWeightKg: number, rightReps: number
): { totalVolumeKg: number; asymmetryPct: number } {
  const leftVol = leftWeightKg * leftReps;
  const rightVol = rightWeightKg * rightReps;
  const totalVolumeKg = leftVol + rightVol;
  const maxVol = Math.max(leftVol, rightVol);
  const asymmetryPct = maxVol > 0 ? Math.round((Math.abs(leftVol - rightVol) / maxVol) * 100) : 0;

  return {
    totalVolumeKg,
    asymmetryPct,
  };
}

/**
 * Calculates volume and effective reps for Myo-Reps rest-pause protocols:
 * 1 activation set + N mini-clusters with 15s rest.
 */
export function calculateMyoRepsVolume(
  weightKg: number,
  activationReps: number,
  miniSets: number,
  miniReps = 3
): { totalReps: number; effectiveReps: number; totalVolumeKg: number } {
  const totalReps = activationReps + miniSets * miniReps;
  // In hypertrophy science (Borge Fagerli), all mini-set reps + last 4-5 of activation set are effective
  const effectiveReps = Math.min(5, activationReps) + miniSets * miniReps;
  const totalVolumeKg = totalReps * weightKg;

  return {
    totalReps,
    effectiveReps,
    totalVolumeKg,
  };
}
