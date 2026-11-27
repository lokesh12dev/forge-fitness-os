/**
 * Loyalty points, tier evaluation, referral rewards, and automation quiet-hours guards.
 */

export type LoyaltyTierType = "IRON" | "BRONZE" | "SILVER" | "GOLD";

export function deriveLoyaltyTier(lifetimePoints: number): LoyaltyTierType {
  if (lifetimePoints >= 3000) return "GOLD";
  if (lifetimePoints >= 1500) return "SILVER";
  if (lifetimePoints >= 500) return "BRONZE";
  return "IRON";
}

export function getLoyaltyPointsForEvent(
  event: "CHECKIN" | "STREAK_5" | "ONTIME_RENEWAL" | "REFERRAL_CONVERTED"
): number {
  switch (event) {
    case "CHECKIN":
      return 25;
    case "STREAK_5":
      return 100;
    case "ONTIME_RENEWAL":
      return 250;
    case "REFERRAL_CONVERTED":
      return 500;
  }
}

export function evaluateQuietHours(
  currentHour24: number,
  quietStartHour: number,
  quietEndHour: number
): boolean {
  const hr = ((Math.trunc(currentHour24) % 24) + 24) % 24;
  const start = ((Math.trunc(quietStartHour) % 24) + 24) % 24;
  const end = ((Math.trunc(quietEndHour) % 24) + 24) % 24;
  if (start === end) return false;
  if (start > end) {
    // Overnight e.g. 21:00 -> 08:00
    return hr >= start || hr < end;
  }
  return hr >= start && hr < end;
}
