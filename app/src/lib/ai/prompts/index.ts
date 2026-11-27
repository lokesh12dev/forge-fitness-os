import type { UnifiedUserFitnessContext } from "../context";
import type { AiModule } from "../schemas";
import { buildBodySystemPrompt } from "./body";
import { buildExerciseSystemPrompt } from "./exercise";
import { buildNutritionSystemPrompt } from "./nutrition";
import { buildScheduleSystemPrompt } from "./schedule";
import { buildWorkoutSystemPrompt } from "./workout";

export function buildModuleSystemPrompt(
  module: AiModule,
  ctx: UnifiedUserFitnessContext,
  userMessage: string,
  selectedExerciseId?: string,
): string {
  switch (module) {
    case "schedule":
      return buildScheduleSystemPrompt(ctx, userMessage);
    case "workout":
      return buildWorkoutSystemPrompt(ctx, userMessage);
    case "exercise":
      return buildExerciseSystemPrompt(ctx, userMessage, selectedExerciseId);
    case "body":
      return buildBodySystemPrompt(ctx, userMessage);
    case "nutrition":
      return buildNutritionSystemPrompt(ctx, userMessage);
  }
}
