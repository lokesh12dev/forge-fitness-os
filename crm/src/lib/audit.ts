import { type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { type CrmRole } from "./rbac";
import { generateRequestId } from "./observability";

export async function recordAuditLog(input: {
  orgId: string;
  branchId?: string | null;
  actorUserId: string;
  actorRole: CrmRole;
  action: string;
  resourceType: string;
  resourceId: string;
  diff?: Record<string, unknown>;
  ip?: string | null;
  requestId?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      branchId: input.branchId ?? null,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      diffJson: (input.diff ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: input.ip ?? null,
      requestId: input.requestId ?? generateRequestId(),
    },
  });
}
