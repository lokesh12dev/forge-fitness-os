import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const ROLE_EMAIL_MAP: Record<string, string> = {
  OWNER: "owner@ironworks.in",
  MANAGER: "manager.blr@ironworks.in",
  FRONTDESK: "frontdesk.blr@ironworks.in",
  TRAINER: "trainer.blr@ironworks.in",
  ACCOUNTANT: "accountant@ironworks.in",
  MEMBER: "member@ironworks.in",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roleKey = (searchParams.get("role") ?? "OWNER").toUpperCase();
  const targetEmail = ROLE_EMAIL_MAP[roleKey] ?? ROLE_EMAIL_MAP.OWNER!;
  const rawNext = searchParams.get("next");

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: {
      memberships: {
        include: { org: { include: { branches: { orderBy: { createdAt: "asc" } } } } },
      },
    },
  });

  if (!user || !user.memberships[0]) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const membership = user.memberships[0];
  const firstBranch =
    membership.role === "OWNER" || membership.role === "ACCOUNTANT"
      ? membership.org.branches[0]?.id ?? null
      : membership.branchIds[0] ?? membership.org.branches[0]?.id ?? null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      orgId: membership.orgId,
      activeBranchId: firstBranch,
      expiresAt,
    },
  });

  const defaultDest = membership.role === "MEMBER" ? "/portal" : "/app";
  const dest =
    rawNext && (rawNext.startsWith("/app") || rawNext.startsWith("/portal"))
      ? rawNext
      : defaultDest;

  const res = NextResponse.redirect(new URL(dest, request.url));
  res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return res;
}
