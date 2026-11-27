/**
 * FORGE Subscription Plans & Feature Gates (I4)
 * Free forever logging, Pro AI coaching & vision, Gym B2B portal.
 * Mock payment adapters for Razorpay (India) & Stripe (Global).
 */

export type PlanTier = "free" | "pro" | "gym_b2b";

export interface PlanDetails {
  id: PlanTier;
  name: string;
  badge?: string;
  priceMonthlyUsd: number;
  priceMonthlyInr: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanTier, PlanDetails> = {
  free: {
    id: "free",
    name: "Forge Free",
    badge: "Forever Free",
    priceMonthlyUsd: 0,
    priceMonthlyInr: 0,
    description: "The fastest gym logger on earth. No paywalls on basic training.",
    features: [
      "Unlimited workout sessions & sets forever",
      "Offline-first sync with airplane mode",
      "Full exercise library & plate calculator",
      "Rest timer with haptics & audio chime",
      "Basic volume charts & PR tracking",
      "Community feed & social kudos",
    ],
  },
  pro: {
    id: "pro",
    name: "Forge Pro",
    badge: "Most Popular",
    priceMonthlyUsd: 9.99,
    priceMonthlyInr: 799,
    description: "Your autonomous AI strength coach & computer vision training partner.",
    highlight: true,
    features: [
      "Everything in Free",
      "Adaptive Auto-Regulation & target load engine",
      "Voice & natural language set logging",
      "AI Coach chat with workout re-planning",
      "Computer Vision Pose Form Check (MediaPipe)",
      "Photo-to-Macro meal recognition",
      "Advanced fatigue recovery heatmap & 12-week trends",
      "Unlimited custom routines & program generator",
    ],
  },
  gym_b2b: {
    id: "gym_b2b",
    name: "Forge for Gyms",
    badge: "B2B Partner",
    priceMonthlyUsd: 49.0,
    priceMonthlyInr: 3999,
    description: "Turn your physical gym into a connected, high-retention facility.",
    features: [
      "Everything in Pro for all staff trainers",
      "Branded member portal with QR check-in",
      "Gym leaderboard & inter-member challenges",
      "Trainer client assignment & progression monitors",
      "Equipment maintenance & load utilization analytics",
      "Priority WhatsApp & phone developer support",
    ],
  },
};

export type FeatureGateKey =
  | "unlimited_logging"
  | "voice_logging"
  | "auto_regulation"
  | "ai_coach"
  | "form_check"
  | "photo_macro"
  | "advanced_analytics"
  | "gym_portal";

const FEATURE_TIER_REQUIREMENTS: Record<FeatureGateKey, PlanTier> = {
  unlimited_logging: "free",
  voice_logging: "free",
  auto_regulation: "free",
  ai_coach: "pro",
  form_check: "pro",
  photo_macro: "pro",
  advanced_analytics: "pro",
  gym_portal: "gym_b2b",
};

export function isFeatureUnlocked(key: FeatureGateKey, userTier: PlanTier): boolean {
  const req = FEATURE_TIER_REQUIREMENTS[key];
  if (req === "free") return true;
  if (req === "pro") return userTier === "pro" || userTier === "gym_b2b";
  if (req === "gym_b2b") return userTier === "gym_b2b";
  return false;
}

/**
 * Mock Razorpay Payment Adapter (India UPI / Cards)
 */
export async function mockRazorpayCheckout(planId: PlanTier) {
  const plan = PLANS[planId];
  return {
    adapter: "razorpay" as const,
    orderId: `order_rzp_${Math.random().toString(36).substring(2, 10)}`,
    amountInr: plan.priceMonthlyInr,
    currency: "INR",
    keyId: "rzp_test_forge_mock_key",
    prefill: {
      name: "Athlete",
      email: "athlete@forge.fit",
      contact: "+919876543210",
    },
    theme: {
      color: "#C9F73A",
    },
  };
}

/**
 * Mock Stripe Payment Adapter (Global Cards / Apple Pay)
 */
export async function mockStripeCheckout(planId: PlanTier) {
  const plan = PLANS[planId];
  return {
    adapter: "stripe" as const,
    sessionId: `cs_test_${Math.random().toString(36).substring(2, 14)}`,
    amountUsd: plan.priceMonthlyUsd,
    currency: "USD",
    publishableKey: "pk_test_forge_mock_key",
    clientSecret: `pi_test_${Math.random().toString(36).substring(2, 10)}_secret_${Math.random().toString(36).substring(2, 8)}`,
  };
}
