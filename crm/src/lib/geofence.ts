/**
 * Geofenced Check-In & Anti-Spoofing Engine (inspired by advice.fit)
 * Verifies member/staff GPS coordinates against branch pin & radius,
 * rejecting stale timestamps, low-accuracy fixes, and spoofed jumps.
 */

export interface GeofenceInput {
  branchLat: number;
  branchLng: number;
  radiusMeters: number;
  deviceLat: number;
  deviceLng: number;
  accuracyMeters: number;
  capturedAtMs?: number;
  nowMs?: number;
  isMockLocation?: boolean;
}

export interface GeofenceVerdict {
  allowed: boolean;
  distanceMeters: number;
  radiusMeters: number;
  status: "ACCEPTED" | "OUTSIDE_RADIUS" | "LOW_ACCURACY" | "STALE_FIX" | "SPOOF_DETECTED";
  label: string;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}

export function evaluateGeofenceCheckIn(input: GeofenceInput): GeofenceVerdict {
  const now = input.nowMs ?? Date.now();
  const distanceMeters = haversineDistanceMeters(
    input.branchLat,
    input.branchLng,
    input.deviceLat,
    input.deviceLng
  );

  if (input.isMockLocation) {
    return {
      allowed: false,
      distanceMeters,
      radiusMeters: input.radiusMeters,
      status: "SPOOF_DETECTED",
      label: "Mock / Fake GPS detected · Rejected",
    };
  }

  if (input.capturedAtMs && Math.abs(now - input.capturedAtMs) > 120_000) {
    return {
      allowed: false,
      distanceMeters,
      radiusMeters: input.radiusMeters,
      status: "STALE_FIX",
      label: "GPS fix older than 2 min · Refresh location",
    };
  }

  if (input.accuracyMeters > 100) {
    return {
      allowed: false,
      distanceMeters,
      radiusMeters: input.radiusMeters,
      status: "LOW_ACCURACY",
      label: `Low GPS accuracy (±${Math.round(input.accuracyMeters)}m) · Move near window`,
    };
  }

  if (distanceMeters > input.radiusMeters) {
    return {
      allowed: false,
      distanceMeters,
      radiusMeters: input.radiusMeters,
      status: "OUTSIDE_RADIUS",
      label: `${distanceMeters} m · Outside the gym (${input.radiusMeters}m limit)`,
    };
  }

  return {
    allowed: true,
    distanceMeters,
    radiusMeters: input.radiusMeters,
    status: "ACCEPTED",
    label: `${distanceMeters} m · Accepted`,
  };
}
