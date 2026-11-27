/**
 * FORGE Feature Flags System (Phase 4 / P1 Architecture)
 *
 * Safe progressive rollout of Phase 4 P1 capabilities.
 * Allows instant toggling via environment variables or runtime overrides.
 */

export interface FeatureFlags {
  import_export_csv: boolean;
  programs_library_10: boolean;
  ai_coach_advanced: boolean;
  plateau_detection: boolean;
  crowded_gym_mode: boolean;
  cardio_advanced_sets: boolean;
  form_check_mediapipe: boolean;
  wearables_health_connect: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  import_export_csv: true,
  programs_library_10: true,
  ai_coach_advanced: true,
  plateau_detection: true,
  crowded_gym_mode: true,
  cardio_advanced_sets: true,
  form_check_mediapipe: true,
  wearables_health_connect: false, // In development
};

export function isFeatureFlagEnabled(flag: keyof FeatureFlags, customOverrides?: Partial<FeatureFlags>): boolean {
  if (customOverrides && typeof customOverrides[flag] === "boolean") {
    return customOverrides[flag]!;
  }
  return DEFAULT_FEATURE_FLAGS[flag] ?? false;
}
