/**
 * FORGE Wearables & Platform Sync Engine
 * Handles bidirectional telemetry with Apple Health (HealthKit), Android Health Connect, and Garmin.
 */

export type HealthPlatform = "apple_health" | "health_connect" | "garmin";

export type WearableTelemetry = {
  restingHeartRateBpm: number;
  heartRateVariabilityMs: number; // SDNN in ms
  sleepDurationHours: number;
  sleepQualityScore: number; // 0 - 100
  activeEnergyBurnedKcal: number;
  stepCount: number;
  syncedAt: string;
};

export type WearablesSyncState = {
  platform: HealthPlatform;
  connected: boolean;
  autoSync: boolean;
  hapticFeedbackEnabled: boolean;
  wristQuickLogEnabled: boolean;
  lastTelemetry: WearableTelemetry;
};

/**
 * Computes CNS readiness score (0 - 100) from wearable biometric markers.
 * Weighted: 40% HRV relative to 65ms baseline, 35% Sleep relative to 8h, 25% Resting HR.
 */
export function calculateReadinessFromWearable(
  hrvMs: number,
  restingHrBpm: number,
  sleepHours: number
): number {
  const hrvRatio = Math.min(1.5, Math.max(0.1, hrvMs / 65));
  const hrvScore = hrvRatio * 40;

  const sleepRatio = Math.min(1.25, Math.max(0.1, sleepHours / 8.0));
  const sleepScore = sleepRatio * 35;

  // Lower resting HR is superior (baseline 60 bpm, range 40 - 90 bpm)
  const hrScore = Math.min(25, Math.max(0, ((85 - restingHrBpm) / 35) * 25));

  const total = Math.round(hrvScore + sleepScore + hrScore);
  return Math.min(100, Math.max(20, total));
}

/**
 * Simulates an instantaneous biometric sync pull from the connected wearable platform.
 */
export function performWearablesSync(
  state: WearablesSyncState,
  overrideTelemetry?: Partial<WearableTelemetry>
): { state: WearablesSyncState; readinessScore: number } {
  const updatedTelemetry: WearableTelemetry = {
    ...state.lastTelemetry,
    ...overrideTelemetry,
    syncedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const readinessScore = calculateReadinessFromWearable(
    updatedTelemetry.heartRateVariabilityMs,
    updatedTelemetry.restingHeartRateBpm,
    updatedTelemetry.sleepDurationHours
  );

  return {
    state: {
      ...state,
      connected: true,
      lastTelemetry: updatedTelemetry,
    },
    readinessScore,
  };
}

export const INITIAL_WEARABLES_STATE: WearablesSyncState = {
  platform: "apple_health",
  connected: true,
  autoSync: true,
  hapticFeedbackEnabled: true,
  wristQuickLogEnabled: true,
  lastTelemetry: {
    restingHeartRateBpm: 54,
    heartRateVariabilityMs: 72,
    sleepDurationHours: 7.8,
    sleepQualityScore: 89,
    activeEnergyBurnedKcal: 640,
    stepCount: 11420,
    syncedAt: "Just now",
  },
};
