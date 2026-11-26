import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import {
  AuthorizationError,
  assertAuthorized,
  canAccessBranch,
  type CrmPermission,
  type CrmRole,
} from "./rbac";

export const SESSION_COOKIE_NAME = "forge_crm_sid";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith("scrypt:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function hashSessionToken(token: string): string {
  const secret = process.env.AUTH_SECRET?.trim() || "forge-crm-dev-secret-change-in-production-32bytes";
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export async function createSessionCookie(input: {
  userId: string;
  orgId: string;
  activeBranchId?: string | null;
}): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId: input.userId,
      orgId: input.orgId,
      activeBranchId: input.activeBranchId ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return rawToken;
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(raw) },
    });
  }
  store.delete(SESSION_COOKIE_NAME);
}

export interface AuthBranchInfo {
  id: string;
  name: string;
  code: string;
  stateCode: string;
  timezone: string;
  invoiceSeriesPrefix: string;
}

export interface AuthContext {
  sessionId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  org: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    timezone: string;
    gstin: string | null;
    legalStateCode: string;
    invoicePrefix: string;
    defaultGstBps: number;
    demoLoaded: boolean;
  };
  role: CrmRole;
  assignedBranchIds: string[];
  activeBranchId: string | null;
  visibleBranches: AuthBranchInfo[];
  clientIp: string | null;
}

export async function getSessionContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(raw) },
    include: {
      user: true,
      org: {
        include: {
          branches: {
            where: { isActive: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  const membership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId: session.orgId,
        userId: session.userId,
      },
    },
  });

  if (!membership) return null;

  const role = membership.role as CrmRole;
  const assignedBranchIds = membership.branchIds;
  const visibleBranches = session.org.branches
    .filter((b) => canAccessBranch(role, assignedBranchIds, b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      stateCode: b.stateCode,
      timezone: b.timezone,
      invoiceSeriesPrefix: b.invoiceSeriesPrefix,
    }));

  const resolvedBranch =
    session.activeBranchId && visibleBranches.some((b) => b.id === session.activeBranchId)
      ? session.activeBranchId
      : visibleBranches[0]?.id ?? null;

  const hdrs = await headers();
  const clientIp =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "127.0.0.1";

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone,
    },
    org: {
      id: session.org.id,
      name: session.org.name,
      slug: session.org.slug,
      currency: session.org.currency,
      timezone: session.org.timezone,
      gstin: session.org.gstin,
      legalStateCode: session.org.legalStateCode,
      invoicePrefix: session.org.invoicePrefix,
      defaultGstBps: session.org.defaultGstBps,
      demoLoaded: session.org.demoLoaded,
    },
    role,
    assignedBranchIds,
    activeBranchId: resolvedBranch,
    visibleBranches,
    clientIp,
  };
}

/**
 * Enforces authentication, RBAC permission, and branch scoping on every server route/action.
 */
export async function requireAuthContext(options?: {
  permission?: CrmPermission;
  branchId?: string | null;
  redirectOnUnauth?: boolean;
}): Promise<AuthContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    if (options?.redirectOnUnauth !== false) {
      redirect("/login");
    }
    throw new AuthorizationError("Authentication required.");
  }

  if (options?.permission) {
    assertAuthorized({
      role: ctx.role,
      assignedBranchIds: ctx.assignedBranchIds,
      permission: options.permission,
      branchId: options.branchId,
    });
  }

  return ctx;
}

/**
 * Returns branch IDs allowed for queries. Throws 403 if an unauthorized branchId is requested.
 */
export function resolveScopedBranchIds(ctx: AuthContext, requestedBranchId?: string | null): string[] {
  if (requestedBranchId && requestedBranchId !== "ALL") {
    if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, requestedBranchId)) {
      throw new AuthorizationError(`Forbidden access to branch ${requestedBranchId}`);
    }
    return [requestedBranchId];
  }

  if (ctx.role === "OWNER" || ctx.role === "ACCOUNTANT") {
    return ctx.visibleBranches.map((b) => b.id);
  }
  return ctx.visibleBranches.map((b) => b.id);
}
