import { describe, expect, it } from "vitest";
import { buildSyncDraftsForScenario } from "./sync";

describe("Part G — Cross-Section Sync V2 Scenarios", () => {
  it("generates goal_change proposals with Mifflin-St Jeor macro targets", () => {
    const drafts = buildSyncDraftsForScenario({
      scenario: "goal_change",
      sex: "male",
      weightKg: 80,
      heightCm: 178,
      newGoal: "fat_loss",
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0].targetModule).toBe("nutrition");
    expect(Number(drafts[0].payload.calories)).toBeGreaterThanOrEqual(1500);
    expect(drafts[1].targetModule).toBe("schedule");
  });

  it("generates missed_workout, plateau, and equipment_change proposals", () => {
    const missed = buildSyncDraftsForScenario({
      scenario: "missed_workout",
      sex: "male",
      weightKg: 80,
      heightCm: 178,
      daysMissed: 4,
    });
    expect(missed[0].payload.strategy).toBe("merge");

    const plateau = buildSyncDraftsForScenario({
      scenario: "plateau",
      sex: "female",
      weightKg: 60,
      heightCm: 165,
      currentCalories: 1900,
    });
    expect(plateau[0].payload.calories).toBe(1725);

    const equip = buildSyncDraftsForScenario({
      scenario: "equipment_change",
      sex: "male",
      weightKg: 80,
      heightCm: 178,
      newEquipment: ["dumbbell", "bodyweight"],
    });
    expect(equip[0].targetModule).toBe("workout");
  });
});
