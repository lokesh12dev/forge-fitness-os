import { describe, expect, it } from "vitest";
import {
  buildShoppingList,
  calculateMifflinBmr,
  computeDailyNutritionScore,
  generateNutritionAssistantReply,
  generateWeeklyMealPlan,
} from "./nutrition-planner";

describe("Nutrition Planner, Calculators & Assistant Engine", () => {
  it("generates 7-day meal plans respecting vegan and dairy allergy filters", () => {
    const days = generateWeeklyMealPlan({
      goal: "weight_loss",
      diet: "vegan",
      cuisine: "all",
      budget: "budget",
      allergies: ["dairy"],
      targetCalories: 2000,
    });
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(day.meals).toHaveLength(5);
      expect(day.totals.calories).toBeGreaterThan(0);
    }
    const shopping = buildShoppingList(days);
    expect(shopping.length).toBeGreaterThan(0);
  });

  it("computes Daily Nutrition Score and Mifflin-St Jeor BMR accurately", () => {
    const score = computeDailyNutritionScore({
      calories: 2400,
      targetCalories: 2400,
      protein: 180,
      targetProtein: 180,
      fiber: 38,
      targetFiber: 38,
      waterMl: 3500,
      targetWaterMl: 3500,
    });
    expect(score).toBe(100);
    expect(calculateMifflinBmr(75, 175, 26, "male")).toBe(1719);
  });

  it("returns contextual educational guidance from Nutrition Assistant", () => {
    const reply = generateNutritionAssistantReply("How do I hit my protein target?", {
      firstName: "Alex",
      calories: 1500,
      targetCalories: 2500,
      protein: 100,
      targetProtein: 180,
      carbs: 150,
      targetCarbs: 280,
      fat: 45,
      targetFat: 75,
      waterMl: 2000,
      targetWaterMl: 3500,
      weightKg: 75,
    });
    expect(reply).toContain("80g");
    expect(reply).toContain("Paneer");
  });
});
