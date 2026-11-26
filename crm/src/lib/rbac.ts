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
  ]),
  // Trainer strictly has NO finance/billing/invoice permissions
  TRAINER: new Set<CrmPermission>([
    "dashboard:ops",
    "members:read",
    "members:health:read",
    "checkin:operate",
  ]),
  // Accountant is strictly read-only on finance, billing, expenses & audit
  ACCOUNTANT: new Set<CrmPermission>([
    "dashboard:finance",
    "plans:read",
    "billing:read",
    "expenses:read",
    "audit:read",
  ]),
  MEMBER: new Set<CrmPermission>(["portal:self"]),
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
