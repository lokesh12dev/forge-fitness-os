import { prisma } from "@/lib/prisma";
import { CrmLandingClient } from "@/components/crm-landing";

export const dynamic = "force-dynamic";

export default async function CrmHomePage() {
  const [members, branches, leads, checkIns, invoices] = await Promise.all([
    prisma.member.count({ where: { deletedAt: null } }),
    prisma.branch.count({ where: { isActive: true } }),
    prisma.lead.count(),
    prisma.checkIn.count(),
    prisma.invoice.count(),
  ]);

  return (
    <CrmLandingClient
      metrics={{
        members,
        branches,
        leads,
        checkIns,
        invoices,
      }}
    />
  );
}
