import React from "react";
import { requireAuthContext } from "@/lib/auth";
import { CrmShell } from "@/components/shell/crm-shell";
import { redirect } from "next/navigation";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuthContext();

  if (ctx.role === "MEMBER") {
    redirect("/login");
  }

  return (
    <CrmShell
      orgName={ctx.org.name}
      userName={ctx.user.name}
      role={ctx.role}
      branches={ctx.visibleBranches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
      }))}
      activeBranchId={ctx.activeBranchId}
    >
      {children}
    </CrmShell>
  );
}
