import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskPhoneForRole } from "@/lib/privacy-guard";
import { AuthorizationError } from "@/lib/rbac";
import { buildCsvContent } from "@/lib/reports-ai";

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
      take: 5000,
    });

    const csv = buildCsvContent(
      ["Member Code", "Full Name", "Phone", "Email", "Branch", "Status", "Expiry Date", "Tags"],
      rows.map((m) => [
        m.memberCode,
        m.fullName,
        maskPhoneForRole(m.phone, ctx.role),
        m.email ?? "",
        m.branch.name,
        m.status,
        m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : "",
        m.tags.join("|"),
      ])
    );

    return new NextResponse(csv, {
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
