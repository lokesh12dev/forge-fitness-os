/**
 * Strength & Body Composition Calculators
 * Combines formulas from wger (FFMI, US Navy Body Fat), lyftr (Plate Loader), and powerlifting DOTS.
 */

export interface NavyBodyFatInput {
  sex: "male" | "female";
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number;
}

export interface NavyBodyFatResult {
  bodyFatPct: number;
  category: string;
}

export function calculateNavyBodyFat(input: NavyBodyFatInput): NavyBodyFatResult | null {
  const { sex, heightCm, waistCm, neckCm, hipCm = 0 } = input;
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null;

  let pct = 0;
  if (sex === "male") {
    const diff = waistCm - neckCm;
    if (diff <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    const sum = waistCm + hipCm - neckCm;
    if (sum <= 0 || hipCm <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(heightCm)) - 450;
  }

  const clamped = Math.max(3, Math.min(60, Math.round(pct * 10) / 10));
  const category =
    sex === "male"
      ? clamped < 6 ? "Essential" : clamped < 14 ? "Athletic" : clamped < 18 ? "Fitness" : clamped < 25 ? "Average" : "Above average"
      : clamped < 14 ? "Essential" : clamped < 21 ? "Athletic" : clamped < 25 ? "Fitness" : clamped < 32 ? "Average" : "Above average";

  return { bodyFatPct: clamped, category };
}

export interface FfmiResult {
  leanMassKg: number;
  ffmi: number;
  normalizedFfmi: number;
  tier: string;
}

export function calculateFfmi(weightKg: number, heightCm: number, bodyFatPct: number): FfmiResult | null {
  if (weightKg <= 0 || heightCm <= 0 || bodyFatPct < 0 || bodyFatPct >= 80) return null;
  const heightM = heightCm / 100;
  const leanMassKg = Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;
  const ffmi = Math.round((leanMassKg / (heightM * heightM)) * 10) / 10;
  const normalizedFfmi = Math.round((ffmi + 6.1 * (1.8 - heightM)) * 10) / 10;
  const tier =
    normalizedFfmi < 18 ? "Developing"
      : normalizedFfmi < 20 ? "Intermediate"
      : normalizedFfmi < 22 ? "Advanced"
      : normalizedFfmi < 25 ? "Near natural ceiling"
      : "Elite / Enhanced";
  return { leanMassKg, ffmi, normalizedFfmi, tier };
}

export function calculateDotsScore(
  sex: "male" | "female",
  bodyweightKg: number,
  totalKg: number
): number {
  if (bodyweightKg < 30 || totalKg <= 0) return 0;
  const bw = Math.min(210, bodyweightKg);
  const coeff =
    sex === "male"
      ? [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
      : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  const denom =
    coeff[0] + coeff[1] * bw + coeff[2] * bw ** 2 + coeff[3] * bw ** 3 + coeff[4] * bw ** 4;
  if (denom <= 0) return 0;
  return Math.round(((totalKg * 500) / denom) * 10) / 10;
}

export interface PlateLoadout {
  targetKg: number;
  achievableKg: number;
  barKg: number;
  perSide: Array<{ plateKg: number; count: number }>;
  remainderKg: number;
}

const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calculateBarbellPlates(
  targetKg: number,
  barKg = 20,
  availablePlates = STANDARD_PLATES_KG
): PlateLoadout {
  if (targetKg <= barKg) {
    return { targetKg, achievableKg: barKg, barKg, perSide: [], remainderKg: 0 };
  }
  let perSideRemaining = (targetKg - barKg) / 2;
  const sorted = [...availablePlates].sort((a, b) => b - a);
  const perSide: Array<{ plateKg: number; count: number }> = [];

  for (const plate of sorted) {
    if (perSideRemaining + 1e-6 >= plate) {
      const count = Math.floor((perSideRemaining + 1e-6) / plate);
      if (count > 0) {
        perSide.push({ plateKg: plate, count });
        perSideRemaining = Math.round((perSideRemaining - count * plate) * 1000) / 1000;
      }
    }
  }

  const loadedPerSide = perSide.reduce((acc, p) => acc + p.plateKg * p.count, 0);
  const achievableKg = Math.round((barKg + loadedPerSide * 2) * 100) / 100;
  const remainderKg = Math.round((targetKg - achievableKg) * 100) / 100;
  return { targetKg, achievableKg, barKg, perSide, remainderKg };
}
