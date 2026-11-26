import { describe, it, expect } from "vitest";
import {
  calculateAthleteAdherence,
  evaluateAthleteFatigueRisk,
  calculateGymOccupancyRate,
  calculateEquipmentBottleneck,
  prescribeProgramToAthlete,
  processMemberCheckIn,
  INITIAL_ATHLETES,
  INITIAL_GYM_FACILITY,
  INITIAL_CHECK_INS,
} from "./b2b-portal";

describe("FORGE B2B Portal Engine", () => {
  describe("calculateAthleteAdherence", () => {
    it("calculates exact percentage rounded to integer", () => {
      expect(calculateAthleteAdherence(18, 20)).toBe(90);
      expect(calculateAthleteAdherence(19, 20)).toBe(95);
      expect(calculateAthleteAdherence(7, 10)).toBe(70);
    });

    it("handles boundary and empty schedule conditions", () => {
      expect(calculateAthleteAdherence(0, 0)).toBe(100);
      expect(calculateAthleteAdherence(-2, 10)).toBe(0);
      expect(calculateAthleteAdherence(25, 20)).toBe(100); // capped at 100
    });
  });

  describe("evaluateAthleteFatigueRisk", () => {
    it("flags high risk when readiness dips below 55", () => {
      expect(evaluateAthleteFatigueRisk(52, 1)).toBe("high");
      expect(evaluateAthleteFatigueRisk(40, 0)).toBe("high");
    });

    it("flags high risk when consecutive high RPE sessions reaches 3+", () => {
      expect(evaluateAthleteFatigueRisk(85, 3)).toBe("high");
      expect(evaluateAthleteFatigueRisk(80, 4)).toBe("high");
    });

    it("flags medium risk when readiness is between 55 and 74 or consecutive high RPE is 2", () => {
      expect(evaluateAthleteFatigueRisk(68, 1)).toBe("medium");
      expect(evaluateAthleteFatigueRisk(82, 2)).toBe("medium");
    });

    it("evaluates low risk when athlete is well recovered", () => {
      expect(evaluateAthleteFatigueRisk(88, 1)).toBe("low");
      expect(evaluateAthleteFatigueRisk(95, 0)).toBe("low");
    });
  });

  describe("calculateGymOccupancyRate", () => {
    it("classifies occupancy states accurately", () => {
      expect(calculateGymOccupancyRate(20, 100)).toEqual({ ratePct: 20, status: "optimal" });
      expect(calculateGymOccupancyRate(60, 100)).toEqual({ ratePct: 60, status: "busy" });
      expect(calculateGymOccupancyRate(85, 100)).toEqual({ ratePct: 85, status: "crowded" });
      expect(calculateGymOccupancyRate(96, 100)).toEqual({ ratePct: 96, status: "at_capacity" });
    });

    it("guards against division by zero", () => {
      expect(calculateGymOccupancyRate(10, 0)).toEqual({ ratePct: 0, status: "optimal" });
    });
  });

  describe("calculateEquipmentBottleneck", () => {
    it("identifies most congested station and flags crowded mode", () => {
      const result = calculateEquipmentBottleneck(INITIAL_GYM_FACILITY.equipmentStations);
      expect(result.congestionRate).toBe(100); // Squat Racks & Platforms at 4/4 (100%)
      expect(result.isCrowded).toBe(true);
    });

    it("handles empty equipment station arrays safely", () => {
      expect(calculateEquipmentBottleneck([])).toEqual({
        mostCongested: "None",
        congestionRate: 0,
        isCrowded: false,
      });
    });
  });

  describe("prescribeProgramToAthlete", () => {
    it("updates athlete program and appends coach note immutably", () => {
      const athlete = INITIAL_ATHLETES[0];
      const updated = prescribeProgramToAthlete(
        athlete,
        "531-bbb",
        "5/3/1 Boring But Big",
        0.9,
        "Deload week: cap intensity at 90% and focus on barbell velocity."
      );

      expect(updated.currentProgramId).toBe("531-bbb");
      expect(updated.currentProgramName).toBe("5/3/1 Boring But Big");
      expect(updated.prescription.customIntensityMultiplier).toBe(0.9);
      expect(updated.notes[0]).toContain("Assigned 5/3/1 Boring But Big (90% load intensity)");
      expect(athlete.currentProgramId).toBe("ppl-hypertrophy-6x"); // Original untouched
    });
  });

  describe("processMemberCheckIn", () => {
    it("prepends new check-in and increments occupancy", () => {
      const initialCount = INITIAL_CHECK_INS.length;
      const initialOcc = 46;

      const { checkIns, newOccupancy } = processMemberCheckIn(
        INITIAL_CHECK_INS,
        {
          memberId: "ath-88",
          memberName: "Kavita Rao",
          planName: "Gold All-Access",
          status: "active",
        },
        initialOcc
      );

      expect(checkIns.length).toBe(initialCount + 1);
      expect(checkIns[0].memberName).toBe("Kavita Rao");
      expect(checkIns[0].checkedInAt).toBeDefined();
      expect(newOccupancy).toBe(47);
    });
  });
});
