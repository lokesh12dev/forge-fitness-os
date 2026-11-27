import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderHealth, getUserDailyTokenUsage } from "@/lib/ai/providers";

export async function GET() {
  const user = await getCurrentUser();
  const health = getProviderHealth();
  const usage = await getUserDailyTokenUsage(user.id);

  return NextResponse.json({
    ok: true,
    activeProvider: health.activeProvider,
    provenance:
      health.activeProvider === "forge-engine"
        ? "deterministic:forge"
        : `llm:${health.activeProvider}:${health.providers.find((p) => p.name === health.activeProvider)?.model ?? "unknown"}`,
    externalConfigured: health.externalConfigured,
    providers: health.providers,
    dailyBudget: usage,
  });
}
