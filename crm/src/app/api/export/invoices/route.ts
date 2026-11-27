import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthorizationError } from "@/lib/rbac";
import { buildCsvContent } from "@/lib/reports-ai";

export async function GET(req: NextRequest) {
  try {
    const branchId = req.nextUrl.searchParams.get("branchId");
    const ctx = await requireAuthContext({
      permission: "billing:read",
      redirectOnUnauth: false,
    });
    const branchIds = resolveScopedBranchIds(ctx, branchId);

    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
      },
      include: {
        branch: { select: { name: true } },
        member: { select: { fullName: true, memberCode: true } },
      },
      orderBy: { issueDate: "desc" },
      take: 5000,
    });

    const csv = buildCsvContent(
      [
        "Invoice No",
        "Issue Date",
        "Branch",
        "Member Code",
        "Member Name",
        "Status",
        "Taxable (INR)",
        "CGST (INR)",
        "SGST (INR)",
        "IGST (INR)",
        "Total (INR)",
        "Paid (INR)",
        "Balance Due (INR)",
      ],
      invoices.map((inv) => [
        inv.invoiceNumber,
        inv.issueDate.toISOString().slice(0, 10),
        inv.branch.name,
        inv.member.memberCode,
        inv.member.fullName,
        inv.status,
        (inv.taxablePaise / 100).toFixed(2),
        (inv.cgstPaise / 100).toFixed(2),
        (inv.sgstPaise / 100).toFixed(2),
        (inv.igstPaise / 100).toFixed(2),
        (inv.totalPaise / 100).toFixed(2),
        (inv.paidPaise / 100).toFixed(2),
        (inv.balanceDuePaise / 100).toFixed(2),
      ])
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="forge-gst-invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Invoice export failed" }, { status: 500 });
  }
}
