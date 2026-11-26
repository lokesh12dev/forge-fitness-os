/**
 * FORGE Gamification & Achievement Badges (G1)
 * Server-authoritative badge criteria and XP rewards.
 */

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or Lucide icon name
  category: "strength" | "streak" | "volume" | "nutrition" | "consistency";
  xpReward: number;
  unlocked: boolean;
  progressPercent: number;
  currentValueLabel: string;
  targetValueLabel: string;
}

export function evaluateBadges(context: {
  benchMaxKg: number;
  squatMaxKg: number;
  bodyweightKg: number;
  streakDays: number;
  totalVolumeKg: number;
  completedWorkoutsCount: number;
  proteinHitDays: number;
}): BadgeDefinition[] {
  const {
    benchMaxKg,
    squatMaxKg,
    bodyweightKg,
    streakDays,
    totalVolumeKg,
    completedWorkoutsCount,
    proteinHitDays,
  } = context;

  const squatRatio = bodyweightKg > 0 ? squatMaxKg / bodyweightKg : 0;

  return [
    {
      id: "century_club",
      name: "Century Club",
      description: "Hit a 100 kg or greater Bench Press (1RM / e1RM)",
      icon: "🏋️",
      category: "strength",
      xpReward: 500,
      unlocked: benchMaxKg >= 100,
      progressPercent: Math.min(100, Math.round((benchMaxKg / 100) * 100)),
      currentValueLabel: `${benchMaxKg.toFixed(1)} kg`,
      targetValueLabel: "100 kg",
    },
    {
      id: "iron_streak_14",
      name: "Iron Streak",
      description: "Maintain a training & logging streak of 14 consecutive days",
      icon: "🔥",
      category: "streak",
      xpReward: 350,
      unlocked: streakDays >= 14,
      progressPercent: Math.min(100, Math.round((streakDays / 14) * 100)),
      currentValueLabel: `${streakDays} days`,
      targetValueLabel: "14 days",
    },
    {
      id: "double_bw_squat",
      name: "Double Bodyweight Squat",
      description: "Squat 2.0x your bodyweight in estimated 1RM",
      icon: "⚡",
      category: "strength",
      xpReward: 750,
      unlocked: squatRatio >= 2.0,
      progressPercent: Math.min(100, Math.round((squatRatio / 2.0) * 100)),
      currentValueLabel: `${squatRatio.toFixed(2)}x`,
      targetValueLabel: "2.0x BW",
    },
    {
      id: "volume_titan",
      name: "Volume Titan",
      description: "Accumulate 100,000 kg of total lifetime volume load",
      icon: "🦍",
      category: "volume",
      xpReward: 600,
      unlocked: totalVolumeKg >= 100_000,
      progressPercent: Math.min(100, Math.round((totalVolumeKg / 100_000) * 100)),
      currentValueLabel: `${Math.round(totalVolumeKg / 1000)}k kg`,
      targetValueLabel: "100k kg",
    },
    {
      id: "protein_champion",
      name: "Protein Champion",
      description: "Hit or exceed your daily protein target 7 days in a row",
      icon: "🥩",
      category: "nutrition",
      xpReward: 300,
      unlocked: proteinHitDays >= 7,
      progressPercent: Math.min(100, Math.round((proteinHitDays / 7) * 100)),
      currentValueLabel: `${proteinHitDays} days`,
      targetValueLabel: "7 days",
    },
    {
      id: "consistency_king",
      name: "Centurion Lifter",
      description: "Complete 25 verified workout sessions in Forge",
      icon: "👑",
      category: "consistency",
      xpReward: 400,
      unlocked: completedWorkoutsCount >= 25,
      progressPercent: Math.min(100, Math.round((completedWorkoutsCount / 25) * 100)),
      currentValueLabel: `${completedWorkoutsCount} sessions`,
      targetValueLabel: "25 sessions",
    },
  ];
}
