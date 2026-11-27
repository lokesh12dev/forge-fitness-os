import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const syncToken = searchParams.get("syncToken")?.trim();
  const qrToken = searchParams.get("qrToken")?.trim();
  const memberCode = searchParams.get("memberCode")?.trim();
  const rawApiKey = extractApiKey(request);

  // Scoped REST ApiKey authentication (required for qrToken or memberCode queries; optional if syncToken capability secret is provided)
  let authorizedOrgId: string | null = null;
  if (rawApiKey) {
    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const apiKeyRow = await prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: { id: true, orgId: true, scopes: true },
    });
    if (!apiKeyRow || (!apiKeyRow.scopes.includes("member:sync") && !apiKeyRow.scopes.includes("*"))) {
      return NextResponse.json({ error: "Invalid or insufficient API key scope." }, { status: 401 });
    }
    authorizedOrgId = apiKeyRow.orgId;
    await prisma.apiKey.update({
      where: { id: apiKeyRow.id },
      data: { lastUsedAt: new Date() },
    });
  } else if (!syncToken) {
    return NextResponse.json(
      { error: "Provide an x-api-key header (or syncToken capability token)." },
      { status: 401 }
    );
  }

  if (!syncToken && !qrToken && !memberCode) {
    return NextResponse.json(
      { error: "Provide syncToken, qrToken, or memberCode query parameter." },
      { status: 400 }
    );
  }

  const assignment = await prisma.memberPlanAssignment.findFirst({
    where: syncToken
      ? { syncToken }
      : {
          orgId: authorizedOrgId!,
          member: qrToken ? { qrToken } : { memberCode },
        },
    orderBy: { createdAt: "desc" },
    include: {
      member: {
        select: {
          memberCode: true,
          fullName: true,
          status: true,
          expiryDate: true,
        },
      },
      template: {
        select: {
          name: true,
          goal: true,
          dietType: true,
          caloriesTarget: true,
          proteinGrams: true,
          workoutsJson: true,
          mealsJson: true,
        },
      },
      trainer: { select: { name: true } },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Plan assignment not found." }, { status: 404 });
  }

  const now = new Date();
  if (!assignment.syncedAt) {
    await prisma.memberPlanAssignment.update({
      where: { id: assignment.id },
      data: { syncedAt: now },
    });
  }

  return NextResponse.json({
    ok: true,
    syncedAt: (assignment.syncedAt ?? now).toISOString(),
    member: assignment.member,
    coachName: assignment.trainer.name,
    plan: assignment.template,
  });
}
