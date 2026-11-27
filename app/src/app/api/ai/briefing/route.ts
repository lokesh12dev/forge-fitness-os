import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildUserFitnessContext } from "@/lib/ai/context";
import {
  buildContextualRecommendations,
  buildDailyBriefing,
  buildWeeklyReport,
} from "@/lib/ai/briefing";
import { getProviderHealth } from "@/lib/ai/providers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await buildUserFitnessContext(user.id);
  return NextResponse.json({
    providerHealth: getProviderHealth(),
    briefing: buildDailyBriefing(context),
    weeklyReport: buildWeeklyReport(context),
    recommendations: buildContextualRecommendations(context),
  });
}
