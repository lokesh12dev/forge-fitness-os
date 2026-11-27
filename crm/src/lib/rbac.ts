/**
 * Server-enforced RBAC and branch-scoping matrix for FORGE CRM.
 * Never rely on client checks; every API route and Server Action calls authorize().
 */

export type CrmRole = "OWNER" | "MANAGER" | "FRONTDESK" | "TRAINER" | "ACCOUNTANT" | "MEMBER";

export type CrmPermission =
  | "org:manage"
  | "dashboard:ops"
  | "dashboard:finance"
  | "members:read"
  | "members:write"
  | "members:health:read"
  | "members:freeze"
  | "plans:read"
  | "plans:write"
  | "billing:read"
  | "billing:collect"
  | "billing:refund"
  | "billing:cash_close"
  | "expenses:read"
  | "expenses:write"
  | "checkin:operate"
  | "checkin:override"
  | "audit:read"
  | "leads:read"
  | "leads:write"
  | "leads:roi"
  | "inbox:read"
  | "inbox:write"
  | "campaigns:broadcast"
  | "automations:manage"
  | "retention:read"
  | "retention:outreach"
  | "loyalty:read"
  | "loyalty:manage"
  | "classes:read"
  | "classes:manage"
  | "trainers:read"
  | "trainers:payroll"
  | "training:read"
  | "training:write"
  | "inventory:read"
  | "inventory:pos"
  | "equipment:manage"
  | "staff:shifts"
  | "reports:read"
  | "reports:export"
  | "ai:use"
  | "settings:admin"
  | "portal:self";

const ROLE_PERMISSIONS: Record<CrmRole, ReadonlySet<CrmPermission>> = {
  OWNER: new Set<CrmPermission>([
    "org:manage",
    "dashboard:ops",
    "dashboard:finance",
    "members:read",
    "members:write",
    "members:health:read",
    "members:freeze",
    "plans:read",
    "plans:write",
    "billing:read",
    "billing:collect",
    "billing:refund",
    "billing:cash_close",
    "expenses:read",
    "expenses:write",
    "checkin:operate",
    "checkin:override",
    "audit:read",
    "leads:read",
    "leads:write",
    "leads:roi",
    "inbox:read",
    "inbox:write",
    "campaigns:broadcast",
    "automations:manage",
    "retention:read",
    "retention:outreach",
    "loyalty:read",
    "loyalty:manage",
    "classes:read",
    "classes:manage",
    "trainers:read",
    "trainers:payroll",
    "training:read",
    "training:write",
    "inventory:read",
    "inventory:pos",
    "equipment:manage",
    "staff:shifts",
    "reports:read",
    "reports:export",
    "ai:use",
    "settings:admin",
  ]),
  MANAGER: new Set<CrmPermission>([
    "dashboard:ops",
    "dashboard:finance",
    "members:read",
    "members:write",
    "members:health:read",
    "members:freeze",
    "plans:read",
    "billing:read",
    "billing:collect",
    "billing:refund",
    "billing:cash_close",
    "expenses:read",
    "expenses:write",
    "checkin:operate",
    "checkin:override",
    "audit:read",
    "leads:read",
    "leads:write",
    "leads:roi",
    "inbox:read",
    "inbox:write",
    "campaigns:broadcast",
    "automations:manage",
    "retention:read",
    "retention:outreach",
    "loyalty:read",
    "loyalty:manage",
    "classes:read",
    "classes:manage",
    "trainers:read",
    "trainers:payroll",
    "training:read",
    "training:write",
    "inventory:read",
    "inventory:pos",
    "equipment:manage",
    "staff:shifts",
    "reports:read",
    "reports:export",
    "ai:use",
  ]),
  FRONTDESK: new Set<CrmPermission>([
    "dashboard:ops",
    "members:read",
    "members:write",
    "members:freeze",
    "plans:read",
    "billing:read",
    "billing:collect",
    "billing:cash_close",
    "checkin:operate",
    "checkin:override",
    "leads:read",
    "leads:write",
    "inbox:read",
    "inbox:write",
    "retention:read",
    "retention:outreach",
    "loyalty:read",
    "loyalty:manage",
    "classes:read",
    "classes:manage",
    "trainers:read",
    "inventory:read",
    "inventory:pos",
    "staff:shifts",
    "reports:read",
  ]),
  // Trainer strictly has NO club finance/payroll/inventory-POS/admin settings permissions
  TRAINER: new Set<CrmPermission>([
    "dashboard:ops",
    "members:read",
    "members:health:read",
    "checkin:operate",
    "leads:read",
    "retention:read",
    "classes:read",
    "trainers:read",
    "training:read",
    "training:write",
    "reports:read",
    "ai:use",
  ]),
  // Accountant is strictly read-only on finance, billing, payroll, GSTR/reports, ROI, expenses & audit
  ACCOUNTANT: new Set<CrmPermission>([
    "dashboard:finance",
    "plans:read",
    "billing:read",
    "expenses:read",
    "audit:read",
    "leads:roi",
    "trainers:payroll",
    "reports:read",
    "reports:export",
  ]),
  MEMBER: new Set<CrmPermission>(["portal:self", "classes:read"]),
};

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function hasPermission(role: CrmRole, permission: CrmPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canAccessFinance(role: CrmRole): boolean {
  return hasPermission(role, "dashboard:finance") || hasPermission(role, "billing:read");
}

export function canAccessBranch(
  role: CrmRole,
  assignedBranchIds: readonly string[],
  targetBranchId: string | null | undefined
): boolean {
  if (role === "OWNER" || role === "ACCOUNTANT") return true;
  if (!targetBranchId) return false;
  return assignedBranchIds.includes(targetBranchId);
}

export function assertAuthorized(input: {
  role: CrmRole;
  assignedBranchIds: readonly string[];
  permission: CrmPermission;
  branchId?: string | null;
}): void {
  if (!hasPermission(input.role, input.permission)) {
    throw new AuthorizationError(`Role ${input.role} lacks permission ${input.permission}`);
  }
  if (input.branchId && !canAccessBranch(input.role, input.assignedBranchIds, input.branchId)) {
    throw new AuthorizationError(`Role ${input.role} is not scoped for branch ${input.branchId}`);
  }
}
