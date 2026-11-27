import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { buildCsvContent, REPORT_CATALOG } from "@/lib/reports-ai";
import { formatMoney } from "@/lib/money";

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireAuthContext({ permission: "reports:export", redirectOnUnauth: false });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 403;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "GSTR1_REGISTER";
  const spec = REPORT_CATALOG.find((r) => r.key === type) ?? REPORT_CATALOG[0]!;
  if (spec.financialOnly && !canAccessFinance(ctx.role)) {
    return NextResponse.json({ error: "Role cannot export financial reports." }, { status: 403 });
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");

  if (type === "MEMBER_DIRECTORY" || type === "EXPIRING_RENEWALS" || type === "CHURN_WATCHLIST") {
    const members = await prisma.member.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        deletedAt: null,
        ...(type === "EXPIRING_RENEWALS" ? { status: "EXPIRING" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 250,
      include: { branch: { select: { name: true } } },
    });
    const csv = buildCsvContent(
      ["Member Code", "Full Name", "Branch", "Status", "Expiry Date", "Phone"],
      members.map((m) => [
        m.memberCode,
        m.fullName,
        m.branch.name,
        m.status,
        m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : "",
        m.phone,
      ])
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="forge-${type.toLowerCase()}.csv"`,
      },
    });
  }

  // Default GSTR1 / Collection CSV export
  const invoices = await prisma.invoice.findMany({
    where: { orgId: ctx.org.id, branchId: { in: branchIds } },
    orderBy: { issueDate: "desc" },
    take: 300,
    include: {
      member: { select: { memberCode: true, fullName: true } },
      branch: { select: { code: true } },
    },
  });

  const csv = buildCsvContent(
    ["Invoice #", "Branch", "Date", "Member", "SAC", "Taxable", "CGST", "SGST", "IGST", "Total", "Balance Due", "Status"],
    invoices.map((i) => [
      i.invoiceNumber,
      i.branch.code,
      i.issueDate.toISOString().slice(0, 10),
      `${i.member.fullName} (${i.member.memberCode})`,
      i.sacCode,
      formatMoney(i.taxablePaise, { currency: ctx.org.currency }),
      formatMoney(i.cgstPaise, { currency: ctx.org.currency }),
      formatMoney(i.sgstPaise, { currency: ctx.org.currency }),
      formatMoney(i.igstPaise, { currency: ctx.org.currency }),
      formatMoney(i.totalPaise, { currency: ctx.org.currency }),
      formatMoney(i.balanceDuePaise, { currency: ctx.org.currency }),
      i.status,
    ])
  );

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="forge-${type.toLowerCase()}.csv"`,
    },
  });
}
