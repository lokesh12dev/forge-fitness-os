import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/rbac";

function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const branchId = req.nextUrl.searchParams.get("branchId");
    const ctx = await requireAuthContext({
      permission: "members:read",
      redirectOnUnauth: false,
    });
    const branchIds = resolveScopedBranchIds(ctx, branchId);

    const rows = await prisma.member.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        deletedAt: null,
        mergedIntoMemberId: null,
        ...(ctx.role === "TRAINER" ? { assignedTrainerId: ctx.user.id } : {}),
      },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const header = "Member Code,Full Name,Phone,Email,Branch,Status,Expiry Date,Tags\n";
    const body = rows
      .map((m) =>
        [
          csvEscape(m.memberCode),
          csvEscape(m.fullName),
          csvEscape(m.phone),
          csvEscape(m.email),
          csvEscape(m.branch.name),
          csvEscape(m.status),
          csvEscape(m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : ""),
          csvEscape(m.tags.join("|")),
        ].join(",")
      )
      .join("\n");

    return new NextResponse(header + body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="forge-members-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
