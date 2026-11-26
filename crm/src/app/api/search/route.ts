import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessFinance, AuthorizationError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const branchId = req.nextUrl.searchParams.get("branchId");
    const ctx = await requireAuthContext({ redirectOnUnauth: false });
    const branchIds = resolveScopedBranchIds(ctx, branchId);

    if (q.length < 2) {
      return NextResponse.json({ members: [], invoices: [] });
    }

    const members = await prisma.member.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        deletedAt: null,
        mergedIntoMemberId: null,
        ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { memberCode: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        memberCode: true,
        fullName: true,
        phone: true,
        status: true,
        branch: { select: { name: true } },
      },
      take: 8,
    });

    const invoices = canAccessFinance(ctx.role)
      ? await prisma.invoice.findMany({
          where: {
            orgId: ctx.org.id,
            branchId: { in: branchIds },
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { member: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            invoiceNumber: true,
            totalPaise: true,
            balanceDuePaise: true,
            status: true,
            member: { select: { fullName: true } },
          },
          take: 5,
        })
      : [];

    return NextResponse.json({ members, invoices });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Search unavailable" }, { status: 500 });
  }
}
