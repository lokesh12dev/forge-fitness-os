import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { AiClient } from "@/components/ai-client";

export default async function AiPage() {
  const ctx = await requireAuthContext({
    permission: "ai:use",
    redirectOnUnauth: true,
  });

  const logs = await prisma.aiAssistantLog.findMany({
    where: { orgId: ctx.org.id, userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <AiClient
      role={ctx.role}
      canAccessFinance={canAccessFinance(ctx.role)}
      orgName={ctx.org.name}
      logs={logs.map((l) => ({
        id: l.id,
        prompt: l.prompt,
        response: l.response,
        citations: (l.citationsJson as Array<{ source: string; metric: string }>) ?? [],
        draftAction:
          (l.draftActionJson as {
            type: "CREATE_TASK" | "DRAFT_WHATSAPP";
            title: string;
            payloadText: string;
          } | null) ?? null,
        approvalStatus: l.approvalStatus,
        tokensUsed: l.tokensUsed,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
