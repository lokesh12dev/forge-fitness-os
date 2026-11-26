import { describe, expect, it } from "vitest";
import { FOOD_DATABASE, resolveBarcode, searchFoods } from "./food-db";
import {
  calculateTDEE,
  calculateWeightMovingAverage,
  hitRemainingProtein,
} from "./nutrition-engine";
import { evaluateBadges } from "./gamification";
import { isFeatureUnlocked, mockRazorpayCheckout, mockStripeCheckout, PLANS } from "./plans";
import { formatProgramWeek, formatUserLevel, formatVolumeMetric } from "./consistency";

describe("Sprint 3: Food Database & Barcode Scanner (D1, D2)", () => {
  it("resolves verified barcodes accurately", () => {
    const amul = resolveBarcode("8901262010051");
    expect(amul).not.toBeNull();
    expect(amul?.name).toContain("Amul High Protein Lassi");
    expect(amul?.protein).toBe(15);
    expect(amul?.calories).toBe(130);

    const onWhey = resolveBarcode("0748927028669");
    expect(onWhey).not.toBeNull();
    expect(onWhey?.name).toContain("Gold Standard");
    expect(onWhey?.protein).toBe(24);

    const soya = resolveBarcode("8901058852924");
    expect(soya).not.toBeNull();
    expect(soya?.protein).toBe(26);
  });

  it("returns null for unknown barcodes", () => {
    const unknown = resolveBarcode("9999999999999");
    expect(unknown).toBeNull();
  });

  it("searches Indian foods by name and regional items", () => {
    const dalResults = searchFoods("dal");
    expect(dalResults.length).toBeGreaterThanOrEqual(2);
    expect(dalResults.some((d) => d.name.includes("Dal"))).toBe(true);

    const paneerResults = searchFoods("paneer");
    expect(paneerResults.length).toBeGreaterThanOrEqual(3);
    expect(paneerResults.every((p) => p.isVegetarian)).toBe(true);

    const biryaniResults = searchFoods("biryani");
    expect(biryaniResults.length).toBeGreaterThanOrEqual(1);
    expect(biryaniResults[0].calories).toBeGreaterThan(500);
  });

  it("filters foods by dietary restrictions", () => {
    const vegFoods = searchFoods("", "vegetarian");
    expect(vegFoods.every((f) => f.isVegetarian)).toBe(true);

    const veganFoods = searchFoods("", "vegan");
    expect(veganFoods.every((f) => f.isVegan)).toBe(true);

    const highProtein = searchFoods("", "high_protein");
    expect(highProtein.every((f) => f.isHighProtein)).toBe(true);
  });
});

describe("Sprint 3: Nutrition Engine & TDEE (D3, D4)", () => {
  it("calculates Mifflin-St Jeor BMR & TDEE for male accurately", () => {
    // 80kg, 180cm, 25y, male:
    // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    const res = calculateTDEE({
      weightKg: 80,
      heightCm: 180,
      age: 25,
      sex: "male",
      activityLevel: "moderate", // 1.55x
      goal: "maintenance",
    });

    expect(res.bmr).toBe(1805);
    expect(res.tdee).toBe(Math.round(1805 * 1.55));
    expect(res.targetCalories).toBe(res.tdee);
    expect(res.targetProtein).toBe(80 * 2); // 160g
    expect(res.targetFat).toBeGreaterThanOrEqual(64); // >= 80 * 0.8
    expect(res.targetCarbs).toBeGreaterThan(100);
    expect(res.targetWaterMl).toBe(Math.round(80 * 35 + 500));
  });

  it("applies deficit for fat loss and surplus for lean bulk", () => {
    const cut = calculateTDEE({
      weightKg: 75,
      heightCm: 175,
      age: 28,
      sex: "male",
      activityLevel: "moderate",
      goal: "fat_loss",
    });
    expect(cut.deficitOrSurplusKcal).toBe(-500);
    expect(cut.targetCalories).toBe(cut.tdee - 500);
    // Cut prescribes 2.2g/kg protein to preserve muscle
    expect(cut.targetProtein).toBe(Math.round(75 * 2.2));

    const bulk = calculateTDEE({
      weightKg: 75,
      heightCm: 175,
      age: 28,
      sex: "male",
      activityLevel: "moderate",
      goal: "lean_bulk",
    });
    expect(bulk.deficitOrSurplusKcal).toBe(300);
    expect(bulk.targetCalories).toBe(bulk.tdee + 300);
  });

  it("generates smart 'Hit My Remaining Protein' suggestions", () => {
    const suggestions = hitRemainingProtein(30, 300);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);

    // Each suggestion covers the majority of the 30g gap
    for (const s of suggestions) {
      expect(s.proteinGrams).toBeGreaterThanOrEqual(20);
      expect(s.efficiency).toBeGreaterThan(0);
      expect(s.reason).toBeDefined();
    }

    // Vegetarian filter
    const vegSuggestions = hitRemainingProtein(25, 350, { vegetarianOnly: true });
    expect(vegSuggestions.every((s) => s.isVegetarian)).toBe(true);

    // Zero protein remaining returns empty
    const zeroGap = hitRemainingProtein(0, 300);
    expect(zeroGap).toEqual([]);
  });

  it("calculates 7-day moving average weight smoothing", () => {
    const weighIns = [
      { date: "2026-11-01", weightKg: 80.0 },
      { date: "2026-11-02", weightKg: 81.0 }, // water spike
      { date: "2026-11-03", weightKg: 79.5 },
      { date: "2026-11-04", weightKg: 80.5 },
      { date: "2026-11-05", weightKg: 79.8 },
      { date: "2026-11-06", weightKg: 79.6 },
      { date: "2026-11-07", weightKg: 79.4 },
    ];

    const smoothed = calculateWeightMovingAverage(weighIns, 7);
    expect(smoothed.length).toBe(7);

    // Day 7 moving average is the mean of all 7 days: (80 + 81 + 79.5 + 80.5 + 79.8 + 79.6 + 79.4) / 7 = 559.8 / 7 = 79.97 -> 80.0
    expect(smoothed[6].movingAvgKg).toBe(80.0);
    // Raw was 79.4, smoothed is 80.0 (dampening daily dehydration/glycogen spikes)
    expect(smoothed[6].weightKg).toBe(79.4);
  });
});

describe("Sprint 3: Gamification & Badges (G1)", () => {
  it("evaluates server-authoritative badge unlocks accurately", () => {
    const badges = evaluateBadges({
      benchMaxKg: 105, // Century Club unlocked!
      squatMaxKg: 160,
      bodyweightKg: 80, // 160 / 80 = 2.0x Double BW Squat unlocked!
      streakDays: 14,   // Iron Streak unlocked!
      totalVolumeKg: 120_000, // Volume Titan unlocked!
      completedWorkoutsCount: 30, // Centurion Lifter unlocked!
      proteinHitDays: 7, // Protein Champion unlocked!
    });

    const century = badges.find((b) => b.id === "century_club");
    expect(century?.unlocked).toBe(true);
    expect(century?.progressPercent).toBe(100);

    const squat = badges.find((b) => b.id === "double_bw_squat");
    expect(squat?.unlocked).toBe(true);

    const streak = badges.find((b) => b.id === "iron_streak_14");
    expect(streak?.unlocked).toBe(true);

    const volume = badges.find((b) => b.id === "volume_titan");
    expect(volume?.unlocked).toBe(true);

    const protein = badges.find((b) => b.id === "protein_champion");
    expect(protein?.unlocked).toBe(true);
  });

  it("calculates partial progress on locked badges", () => {
    const badges = evaluateBadges({
      benchMaxKg: 75,
      squatMaxKg: 100,
      bodyweightKg: 75,
      streakDays: 7,
      totalVolumeKg: 40_000,
      completedWorkoutsCount: 10,
      proteinHitDays: 3,
    });

    const century = badges.find((b) => b.id === "century_club");
    expect(century?.unlocked).toBe(false);
    expect(century?.progressPercent).toBe(75);

    const streak = badges.find((b) => b.id === "iron_streak_14");
    expect(streak?.unlocked).toBe(false);
    expect(streak?.progressPercent).toBe(50);
  });
});

describe("Sprint 3: Platform Plans, Gating & Mock Payments (I4)", () => {
  it("verifies feature gate permissions across Free and Pro tiers", () => {
    expect(isFeatureUnlocked("unlimited_logging", "free")).toBe(true);
    expect(isFeatureUnlocked("voice_logging", "free")).toBe(true);
    expect(isFeatureUnlocked("auto_regulation", "free")).toBe(true);

    expect(isFeatureUnlocked("ai_coach", "free")).toBe(false);
    expect(isFeatureUnlocked("ai_coach", "pro")).toBe(true);

    expect(isFeatureUnlocked("form_check", "free")).toBe(false);
    expect(isFeatureUnlocked("form_check", "pro")).toBe(true);

    expect(isFeatureUnlocked("photo_macro", "free")).toBe(false);
    expect(isFeatureUnlocked("photo_macro", "pro")).toBe(true);

    expect(isFeatureUnlocked("gym_portal", "pro")).toBe(false);
    expect(isFeatureUnlocked("gym_portal", "gym_b2b")).toBe(true);
  });

  it("simulates Razorpay order creation for India", async () => {
    const order = await mockRazorpayCheckout("pro");
    expect(order.adapter).toBe("razorpay");
    expect(order.currency).toBe("INR");
    expect(order.amountInr).toBe(PLANS.pro.priceMonthlyInr);
    expect(order.orderId).toContain("order_rzp_");
  });

  it("simulates Stripe checkout session for Global users", async () => {
    const session = await mockStripeCheckout("pro");
    expect(session.adapter).toBe("stripe");
    expect(session.currency).toBe("USD");
    expect(session.amountUsd).toBe(PLANS.pro.priceMonthlyUsd);
    expect(session.sessionId).toContain("cs_test_");
  });
});

describe("Sprint 3: Consistency Module (E7)", () => {
  it("formats program weeks uniformly without ambiguity", () => {
    const w6 = formatProgramWeek(6, 8);
    expect(w6.label).toBe("Week 6 of 8");
    expect(w6.badge).toBe("W6/8");
    expect(w6.percent).toBe(75);
  });

  it("distinguishes projected load from accumulated volume load", () => {
    const proj = formatVolumeMetric(14700, "projected");
    expect(proj.fullLabel).toBe("14.7k kg proj.");

    const load = formatVolumeMetric(11500, "accumulated");
    expect(load.fullLabel).toBe("11.5k kg load");

    const small = formatVolumeMetric(850, "session");
    expect(small.fullLabel).toBe("850 kg vol.");
  });

  it("computes level progression strictly from canonical formula", () => {
    const l1 = formatUserLevel(0);
    expect(l1.level).toBe(1);
    expect(l1.progressPercent).toBe(0);

    const l12 = formatUserLevel(12480);
    expect(l12.level).toBe(12);
    expect(l12.progressPercent).toBe(17);
    expect(l12.badgeText).toBe("Level 12");
  });
});
