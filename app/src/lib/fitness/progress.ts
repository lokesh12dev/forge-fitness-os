/**
 * Pure Body Progress, Trend Smoothing, Plateau Detection & Provenance Module
 * Zero DB calls, zero LLM calls, never invents missing metrics.
 */

export type MetricProvenance = "measured" | "calculated" | "recommendation" | "missing";

export interface ProvenancedMetric<T = number> {
  value: T | null;
  display: string;
  provenance: MetricProvenance;
}

export function formatMetricWithProvenance<T extends number | string>(
  value: T | null | undefined,
  provenance: Exclude<MetricProvenance, "missing">,
  unit = "",
): ProvenancedMetric<T> {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) {
    return { value: null, display: "Not recorded", provenance: "missing" };
  }
  const suffix = unit ? ` ${unit}` : "";
  return { value, display: `${value}${suffix}`, provenance };
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface WeightTrendResult {
  hasEnoughData: boolean;
  entryCount: number;
  spanDays: number;
  latestKg: number | null;
  smoothed7dKg: number | null;
  kgPerWeek: number | null;
  waterNoiseFlag: boolean;
  waterNoiseNotes: string[];
  provenance: MetricProvenance;
}

export function computeWeightTrend(entries: WeightEntry[]): WeightTrendResult {
  if (entries.length === 0) {
    return {
      hasEnoughData: false,
      entryCount: 0,
      spanDays: 0,
      latestKg: null,
      smoothed7dKg: null,
      kgPerWeek: null,
      waterNoiseFlag: false,
      waterNoiseNotes: [],
      provenance: "missing",
    };
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const waterNoiseNotes: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const dayDiff = Math.max(
      1,
      Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / 86_400_000),
    );
    const delta = cur.weightKg - prev.weightKg;
    if (dayDiff <= 2 && Math.abs(delta) >= 1.5) {
      waterNoiseNotes.push(
        `${cur.date}: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg in ${dayDiff}d — likely glycogen/sodium/water fluctuation, not tissue change.`,
      );
    }
  }

  const firstTs = Date.parse(sorted[0].date);
  const lastTs = Date.parse(sorted[sorted.length - 1].date);
  const spanDays = Math.max(0, Math.round((lastTs - firstTs) / 86_400_000));
  const latestKg = sorted[sorted.length - 1].weightKg;

  const recent7 = sorted.filter((e) => lastTs - Date.parse(e.date) <= 6 * 86_400_000);
  const smoothed7dKg =
    Math.round((recent7.reduce((s, e) => s + e.weightKg, 0) / recent7.length) * 100) / 100;

  if (sorted.length < 3 || spanDays < 7) {
    return {
      hasEnoughData: false,
      entryCount: sorted.length,
      spanDays,
      latestKg,
      smoothed7dKg,
      kgPerWeek: null,
      waterNoiseFlag: waterNoiseNotes.length > 0,
      waterNoiseNotes,
      provenance: "measured",
    };
  }

  // Linear regression slope (kg/day -> kg/week)
  const xs = sorted.map((e) => (Date.parse(e.date) - firstTs) / 86_400_000);
  const ys = sorted.map((e) => e.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const kgPerDay = den > 0 ? num / den : 0;
  const kgPerWeek = Math.round(kgPerDay * 7 * 100) / 100;

  return {
    hasEnoughData: true,
    entryCount: sorted.length,
    spanDays,
    latestKg,
    smoothed7dKg,
    kgPerWeek,
    waterNoiseFlag: waterNoiseNotes.length > 0,
    waterNoiseNotes,
    provenance: "calculated",
  };
}

export interface PlateauDetectionResult {
  isPlateau: boolean;
  reason: string;
  rankedCauses: string[];
  recommendedAdjustments: string[];
}

export function detectPlateau(input: {
  weightEntries: WeightEntry[];
  adherencePct: number;
  goal: "cut" | "bulk" | "maintain" | "recomp";
}): PlateauDetectionResult {
  const trend = computeWeightTrend(input.weightEntries);

  if (trend.spanDays < 14 || trend.entryCount < 5 || trend.kgPerWeek === null) {
    return {
      isPlateau: false,
      reason: `Insufficient window for plateau diagnosis (${trend.entryCount} entries over ${trend.spanDays}d; requires >=5 entries over >=14d).`,
      rankedCauses: [],
      recommendedAdjustments: [],
    };
  }

  if (input.adherencePct < 70) {
    return {
      isPlateau: false,
      reason: `Adherence is ${input.adherencePct}% (<70% threshold). Stabilize logging & target consistency before adjusting calories.`,
      rankedCauses: ["Inconsistent calorie/protein adherence (<70%)"],
      recommendedAdjustments: ["Hit target calories within +/-10% for 14 consecutive days before changing targets."],
    };
  }

  if (input.goal === "cut" && trend.kgPerWeek > -0.1) {
    return {
      isPlateau: true,
      reason: `Weight trend stalled at ${trend.kgPerWeek >= 0 ? "+" : ""}${trend.kgPerWeek} kg/week over ${trend.spanDays} days despite ${input.adherencePct}% adherence.`,
      rankedCauses: [
        "1. Metabolic adaptation / reduced NEAT (non-exercise activity) lowering TDEE.",
        "2. Unlogged liquid calories, cooking oils, or weekend intake variance.",
        "3. Water retention masking fat loss from recent high-volume training or sodium.",
      ],
      recommendedAdjustments: [
        "Trim daily intake by 150–200 kcal (keeping protein fixed) OR add +1,500–2,000 daily steps.",
        "Verify cooking oil/ghee & beverage logging for 7 days.",
      ],
    };
  }

  if (input.goal === "bulk" && trend.kgPerWeek < 0.05) {
    return {
      isPlateau: true,
      reason: `Weight gain stalled at ${trend.kgPerWeek} kg/week over ${trend.spanDays} days despite ${input.adherencePct}% adherence.`,
      rankedCauses: [
        "1. Increased daily energy expenditure / NEAT outpacing current surplus.",
        "2. Underestimated portion sizes on training days.",
      ],
      recommendedAdjustments: [
        "Add +200 kcal/day primarily from carbohydrates around training.",
      ],
    };
  }

  return {
    isPlateau: false,
    reason: `Trend (${trend.kgPerWeek} kg/week) is progressing appropriately for ${input.goal}.`,
    rankedCauses: [],
    recommendedAdjustments: [],
  };
}

export interface ProgressReportSummary {
  period: "weekly" | "monthly";
  workoutsCompleted: number;
  totalVolumeKg: number;
  weightTrend: WeightTrendResult;
  nutritionAdherencePct: ProvenancedMetric<number>;
  bodyFatPct: ProvenancedMetric<number>;
}

export function buildProgressReportSummary(input: {
  period: "weekly" | "monthly";
  workoutsCompleted: number;
  totalVolumeKg: number;
  weightEntries: WeightEntry[];
  nutritionAdherencePct?: number | null;
  latestBodyFatPct?: number | null;
}): ProgressReportSummary {
  return {
    period: input.period,
    workoutsCompleted: input.workoutsCompleted,
    totalVolumeKg: Math.round(input.totalVolumeKg),
    weightTrend: computeWeightTrend(input.weightEntries),
    nutritionAdherencePct: formatMetricWithProvenance(
      input.nutritionAdherencePct ?? null,
      "calculated",
      "%",
    ),
    bodyFatPct: formatMetricWithProvenance(
      input.latestBodyFatPct ?? null,
      "measured",
      "%",
    ),
  };
}
