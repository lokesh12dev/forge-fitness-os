import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicEnquiryClient } from "@/components/public-enquiry-client";

export default async function PublicEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ embed?: string; branch?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      branches: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, code: true, address: true },
      },
    },
  });

  if (!org) {
    notFound();
  }

  return (
    <PublicEnquiryClient
      orgSlug={org.slug}
      orgName={org.name}
      branches={org.branches}
      defaultBranchId={sp.branch ?? org.branches[0]?.id ?? ""}
      embed={sp.embed === "1"}
    />
  );
}
