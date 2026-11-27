import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { AuthorizationError, canAccessBranch, hasPermission } from "@/lib/rbac";
import { formatDateInBranchTz } from "@/lib/membership-math";
import { InvoicePrintClient } from "@/components/invoice-print-client";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthContext({ permission: "billing:read", redirectOnUnauth: true });

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId: ctx.org.id },
    include: {
      org: true,
      branch: true,
      member: true,
      lineItems: true,
      payments: { orderBy: { paidAt: "asc" } },
      refunds: { orderBy: { issuedAt: "asc" } },
    },
  });

  if (!invoice) notFound();
  if (!canAccessBranch(ctx.role, ctx.assignedBranchIds, invoice.branchId)) {
    throw new AuthorizationError("Forbidden invoice branch.");
  }

  return (
    <InvoicePrintClient
      canCollect={hasPermission(ctx.role, "billing:collect")}
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: formatDateInBranchTz(invoice.issueDate, invoice.branch.timezone, true),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        status: invoice.status,
        currency: invoice.currency,
        sacCode: invoice.sacCode,
        placeOfSupplyState: invoice.placeOfSupplyState,
        branchStateCode: invoice.branchStateCode,
        subtotalPaise: invoice.subtotalPaise,
        discountPaise: invoice.discountPaise,
        taxablePaise: invoice.taxablePaise,
        cgstPaise: invoice.cgstPaise,
        sgstPaise: invoice.sgstPaise,
        igstPaise: invoice.igstPaise,
        totalPaise: invoice.totalPaise,
        paidPaise: invoice.paidPaise,
        balanceDuePaise: invoice.balanceDuePaise,
      }}
      org={{
        name: invoice.org.name,
        gstin: invoice.org.gstin ?? "29AABCI4921M1Z4",
        upiVpa: invoice.org.upiVpa,
      }}
      branch={{
        name: invoice.branch.name,
        address: invoice.branch.address,
      }}
      member={{
        id: invoice.member.id,
        fullName: invoice.member.fullName,
        memberCode: invoice.member.memberCode,
        phone: invoice.member.phone,
        email: invoice.member.email ?? "",
      }}
      lines={invoice.lineItems.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        discountPaise: l.discountPaise,
        cgstPaise: l.cgstPaise,
        sgstPaise: l.sgstPaise,
        igstPaise: l.igstPaise,
        totalPaise: l.totalPaise,
      }))}
      payments={invoice.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amountPaise: p.amountPaise,
        paidAt: formatDateInBranchTz(p.paidAt, invoice.branch.timezone, true),
      }))}
    />
  );
}
