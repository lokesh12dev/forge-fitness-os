import { describe, expect, it } from "vitest";
import {
  calculateBarbellPlates,
  calculateDotsScore,
  calculateFfmi,
  calculateNavyBodyFat,
} from "./fitness-calculators";

describe("Fitness Calculators (wger / lyftr / DOTS)", () => {
  it("computes US Navy Body Fat % accurately for male and female", () => {
    const male = calculateNavyBodyFat({
      sex: "male",
      heightCm: 178,
      waistCm: 84,
      neckCm: 38,
    });
    expect(male).not.toBeNull();
    expect(male!.bodyFatPct).toBeGreaterThan(10);
    expect(male!.bodyFatPct).toBeLessThan(20);

    const female = calculateNavyBodyFat({
      sex: "female",
      heightCm: 165,
      waistCm: 70,
      neckCm: 32,
      hipCm: 95,
    });
    expect(female).not.toBeNull();
    expect(female!.bodyFatPct).toBeGreaterThan(15);
    expect(female!.bodyFatPct).toBeLessThan(28);
  });

  it("computes FFMI and normalized FFMI", () => {
    const res = calculateFfmi(80, 180, 12);
    expect(res).not.toBeNull();
    expect(res!.leanMassKg).toBe(70.4);
    expect(res!.ffmi).toBeCloseTo(21.7, 1);
    expect(res!.tier).toBe("Advanced");
  });

  it("computes IPF DOTS score", () => {
    const dots = calculateDotsScore("male", 83, 600);
    expect(dots).toBeGreaterThan(390);
    expect(dots).toBeLessThan(430);
  });

  it("calculates greedy barbell plates per side", () => {
    const load = calculateBarbellPlates(142.5, 20);
    expect(load.achievableKg).toBe(142.5);
    expect(load.remainderKg).toBe(0);
    expect(load.perSide).toEqual([
      { plateKg: 25, count: 2 },
      { plateKg: 10, count: 1 },
      { plateKg: 1.25, count: 1 },
    ]);
  });
});
