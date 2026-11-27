/**
 * FORGE Consistency Module (E7)
 * Single-source-of-truth metric computation and formatting across Dashboard, Train,
 * Nutrition, Progress, and Settings.
 */

import { computeLevelProgress } from "./engine";

/**
 * Format program week progression consistently (e.g. "Week 6 of 8")
 */
export function formatProgramWeek(currentWeek: number, totalWeeks = 8): {
  label: string;
  badge: string;
  percent: number;
} {
  const safeCurrent = Math.max(1, currentWeek);
  const safeTotal = Math.max(safeCurrent, totalWeeks);
  const percent = Math.min(100, Math.round((safeCurrent / safeTotal) * 100));

  return {
    label: `Week ${safeCurrent} of ${safeTotal}`,
    badge: `W${safeCurrent}/${safeTotal}`,
    percent,
  };
}

/**
 * Format volume metrics clearly distinguishing projected vs accumulated load (E7)
 */
export function formatVolumeMetric(
  kg: number,
  type: "projected" | "accumulated" | "session",
): {
  rawKg: number;
  formatted: string;
  unit: string;
  fullLabel: string;
} {
  const safeKg = Math.max(0, kg);
  let formatted = "";
  if (safeKg >= 1000) {
    formatted = `${(safeKg / 1000).toFixed(1)}k`;
  } else {
    formatted = Math.round(safeKg).toLocaleString("en-US");
  }

  const suffix =
    type === "projected" ? "proj." : type === "accumulated" ? "load" : "vol.";
  const fullLabel = `${formatted} kg ${suffix}`;

  return {
    rawKg: safeKg,
    formatted,
    unit: "kg",
    fullLabel,
  };
}

/**
 * Canonical XP and Level calculation (Engine Section 2)
 */
export function formatUserLevel(xp: number): {
  level: number;
  progressPercent: number;
  xpToNext: number;
  floorXp: number;
  ceilXp: number;
  badgeText: string;
  subText: string;
} {
  const { level, progress, xpToNext, floorXp, ceilXp } = computeLevelProgress(xp);
  return {
    level,
    progressPercent: progress,
    xpToNext,
    floorXp,
    ceilXp,
    badgeText: `Level ${level}`,
    subText: `${progress}% to L${level + 1} (${xpToNext.toLocaleString("en-US")} XP needed)`,
  };
}

/**
 * Format streak with protection status
 */
export function formatStreak(
  days: number,
  hasFreezeActive = false,
): {
  days: number;
  label: string;
  badge: string;
  status: "active" | "frozen" | "broken";
} {
  if (days <= 0) {
    return { days: 0, label: "No active streak", badge: "0-day", status: "broken" };
  }
  return {
    days,
    label: `${days}-day streak`,
    badge: hasFreezeActive ? `${days}d 🛡️` : `${days}d 🔥`,
    status: hasFreezeActive ? "frozen" : "active",
  };
}
