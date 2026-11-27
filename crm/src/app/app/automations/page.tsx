import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { AutomationsClient } from "@/components/automations-client";

export default async function AutomationsPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });

  if (!hasPermission(ctx.role, "automations:manage")) {
    return (
      <div className="bauhaus-card p-8 border-[3px] border-[#C8372B] space-y-4">
        <p className="bauhaus-label text-[#C8372B]">{"// ACCESS DENIED · 403 FORBIDDEN"}</p>
        <h1 className="font-headline text-[32px]">Restricted Workflow Engine</h1>
        <p className="text-[14px] text-[var(--fg-grey)]">
          Role {ctx.role} lacks permission automations:manage to view or execute growth automation rules.
        </p>
        <Link
          href="/app"
          className="inline-flex min-h-[44px] items-center border-2 border-[#151515] bg-[#151515] text-[#FFFFFF] px-4 text-[13px] font-bold uppercase"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const [rules, runs] = await Promise.all([
    prisma.automationRule.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.automationRun.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { executedAt: "desc" },
      take: 30,
      include: { rule: { select: { name: true, triggerKey: true } } },
    }),
  ]);

  return (
    <AutomationsClient
      rules={rules.map((r) => ({
        id: r.id,
        name: r.name,
        triggerKey: r.triggerKey,
        conditionLabel: r.conditionLabel,
        actionChannel: r.actionChannel,
        messageTemplate: r.messageTemplate,
        delayMinutes: r.delayMinutes,
        maxPerMemberDays: r.maxPerMemberDays,
        quietStartHour: r.quietStartHour,
        quietEndHour: r.quietEndHour,
        isActive: r.isActive,
      }))}
      runs={runs.map((run) => ({
        id: run.id,
        ruleName: run.rule.name,
        triggerKey: run.rule.triggerKey,
        mode: run.mode,
        matchedCount: run.matchedCount,
        dispatchedCount: run.dispatchedCount,
        skippedOptOutCount: run.skippedOptOutCount,
        skippedCapCount: run.skippedCapCount,
        skippedQuietHours: run.skippedQuietHours,
        executedAt: run.executedAt.toISOString(),
      }))}
    />
  );
}
