import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("syncToken")?.trim();
  const qrToken = searchParams.get("qrToken")?.trim();

  if (!token && !qrToken) {
    return NextResponse.json(
      { error: "Provide syncToken or qrToken query parameter." },
      { status: 400 }
    );
  }

  const assignment = await prisma.memberPlanAssignment.findFirst({
    where: token
      ? { syncToken: token }
      : { member: { qrToken: qrToken! } },
    orderBy: { createdAt: "desc" },
    include: {
      member: {
        select: {
          id: true,
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

  return NextResponse.json({
    ok: true,
    syncToken: assignment.syncToken,
    syncedAt: assignment.syncedAt,
    member: assignment.member,
    coachName: assignment.trainer.name,
    plan: assignment.template,
  });
}
