import { describe, expect, it } from "vitest";
import {
  ONT_COMPENDIUM_ACTIVITIES,
  ONT_CORE_FOODS,
  ONT_RECIPES,
  calculateIom2005Tdee,
  calculateMetBurnedKcal,
  calculateWhoBmi,
  convertEnergy,
  getIomDriTable,
  resolveFoodPhoto,
  scaleNutrients,
} from "./opennutri-core";

describe("OpenNutriTracker Core Engine & Meal Imagery", () => {
  it("provides all 11 core demo foods with valid local Unsplash imagery and micronutrients", () => {
    expect(ONT_CORE_FOODS).toHaveLength(11);
    for (const food of ONT_CORE_FOODS) {
      expect(food.imageUrl).toMatch(/^\/nutri-meals\/.+\.jpg$/);
      expect(food.per100g.kcal).toBeGreaterThan(0);
      expect(food.photoCredit.name.length).toBeGreaterThan(2);
    }
  });

  it("computes IOM 2005 TDEE for male, female, and averaged non-binary profiles", () => {
    const male = calculateIom2005Tdee({ weightKg: 80, heightCm: 178, age: 26, gender: "male", palCategory: "active" });
    const female = calculateIom2005Tdee({ weightKg: 80, heightCm: 178, age: 26, gender: "female", palCategory: "active" });
    const nb = calculateIom2005Tdee({ weightKg: 80, heightCm: 178, age: 26, gender: "non_binary", palCategory: "active" });
    expect(male).toBeGreaterThan(2600);
    expect(female).toBeGreaterThan(2200);
    expect(nb).toBe(Math.round((male + female) / 2));
  });

  it("computes WHO BMI classification accurately", () => {
    expect(calculateWhoBmi(72, 178).status).toBe("Normal weight");
    expect(calculateWhoBmi(87, 178).status).toBe("Pre-obesity");
  });

  it("returns IOM DRI tables across 10 micronutrients with sex and age adjustment", () => {
    const fTable = getIomDriTable("female", 26);
    const mTable = getIomDriTable("male", 26);
    expect(fTable.length).toBe(10);
    expect(fTable.find((n) => n.key === "iron")?.amount).toBe(18);
    expect(mTable.find((n) => n.key === "iron")?.amount).toBe(8);
  });

  it("calculates Compendium 2024 MET burn and energy unit conversion (kcal <-> kJ)", () => {
    const running = ONT_COMPENDIUM_ACTIVITIES.find((a) => a.code === "12150")!;
    expect(calculateMetBurnedKcal(running.mets, 80, 60)).toBe(664);
    expect(convertEnergy(200, "kJ")).toBe(837);
  });

  it("maps Indian IFCT food names cleanly to bundled meal photos and scales nutrients accurately", () => {
    expect(resolveFoodPhoto("Paneer bhurji + 2 roti").imageUrl).toContain("/nutri-meals/");
    const scaled = scaleNutrients(ONT_CORE_FOODS[7].per100g, 50); // Almonds 50g
    expect(scaled.kcal).toBe(290);
    expect(scaled.protein).toBe(10.5);
    expect(ONT_RECIPES).toHaveLength(4);
  });
});
