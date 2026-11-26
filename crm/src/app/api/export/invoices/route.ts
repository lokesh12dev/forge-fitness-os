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
      take: 2500,
    });

    const header =
      "Invoice No,Issue Date,Branch,Member Code,Member Name,Status,Taxable (INR),CGST (INR),SGST (INR),IGST (INR),Total (INR),Paid (INR),Balance Due (INR)\n";
    const body = invoices
      .map((inv) =>
        [
          csvEscape(inv.invoiceNumber),
          csvEscape(inv.issueDate.toISOString().slice(0, 10)),
          csvEscape(inv.branch.name),
          csvEscape(inv.member.memberCode),
          csvEscape(inv.member.fullName),
          csvEscape(inv.status),
          csvEscape((inv.taxablePaise / 100).toFixed(2)),
          csvEscape((inv.cgstPaise / 100).toFixed(2)),
          csvEscape((inv.sgstPaise / 100).toFixed(2)),
          csvEscape((inv.igstPaise / 100).toFixed(2)),
          csvEscape((inv.totalPaise / 100).toFixed(2)),
          csvEscape((inv.paidPaise / 100).toFixed(2)),
          csvEscape((inv.balanceDuePaise / 100).toFixed(2)),
        ].join(",")
      )
      .join("\n");

    return new NextResponse(header + body, {
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
