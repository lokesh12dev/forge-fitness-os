import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage() {
  const ctx = await requireAuthContext({ redirectOnUnauth: true });

  if (!hasPermission(ctx.role, "settings:admin")) {
    return (
      <div className="bauhaus-card p-8 border-[3px] border-[#C8372B] space-y-4">
        <p className="bauhaus-label text-[#C8372B]">{"// ACCESS DENIED · 403 FORBIDDEN"}</p>
        <h1 className="font-headline text-[32px]">Owner Admin Settings Restricted</h1>
        <p className="text-[14px] text-[var(--fg-grey)]">
          Role {ctx.role} lacks permission settings:admin to configure RBAC, API keys, migrations, or DPDP erasure.
        </p>
        <Link
          href="/app"
          className="inline-flex min-h-[44px] items-center border-2 border-[#151515] bg-[#151515] text-[#FFFFFF] px-4 text-[13px] font-bold uppercase"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const [branches, holidays, apiKeys, webhookSubs, importJobs, dpdpJobs, auditLogs, members] =
    await Promise.all([
      prisma.branch.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.branchHoliday.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { date: "asc" },
        include: { branch: { select: { name: true } } },
      }),
      prisma.apiKey.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.webhookSubscription.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.migrationImportJob.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.dataExportDeletionJob.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { member: { select: { fullName: true, memberCode: true } } },
      }),
      prisma.auditLog.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true } } },
      }),
      prisma.member.findMany({
        where: { orgId: ctx.org.id, deletedAt: null },
        take: 40,
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, memberCode: true },
      }),
    ]);

  return (
    <SettingsClient
      org={{
        name: ctx.org.name,
        slug: ctx.org.slug,
        gstin: ctx.org.gstin,
        currency: ctx.org.currency,
        invoicePrefix: ctx.org.invoicePrefix,
        defaultGstBps: ctx.org.defaultGstBps,
      }}
      branches={branches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        stateCode: b.stateCode,
        address: b.address,
        invoiceSeriesPrefix: b.invoiceSeriesPrefix,
        nextInvoiceSeq: b.nextInvoiceSeq,
      }))}
      holidays={holidays.map((h) => ({
        id: h.id,
        branchName: h.branch.name,
        title: h.title,
        date: h.date.toISOString().slice(0, 10),
      }))}
      apiKeys={apiKeys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
      }))}
      webhookSubs={webhookSubs.map((w) => ({
        id: w.id,
        targetUrl: w.targetUrl,
        events: w.events,
        secretPreview: w.secretPreview,
        isActive: w.isActive,
      }))}
      importJobs={importJobs.map((j) => ({
        id: j.id,
        sourcePlatform: j.sourcePlatform,
        mode: j.mode,
        totalRows: j.totalRows,
        validRows: j.validRows,
        errorRows: j.errorRows,
        createdAt: j.createdAt.toISOString(),
      }))}
      dpdpJobs={dpdpJobs.map((d) => ({
        id: d.id,
        memberName: d.member.fullName,
        memberCode: d.member.memberCode,
        kind: d.kind,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }))}
      auditLogs={auditLogs.map((a) => ({
        id: a.id,
        timestamp: a.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        actorName: a.actor.name,
        actorRole: a.actorRole,
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
      }))}
      members={members}
      gatewayStatus={{
        razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        whatsappConfigured: Boolean(process.env.WHATSAPP_CLOUD_TOKEN),
        smsConfigured: Boolean(process.env.SMS_API_KEY),
        s3Configured: Boolean(process.env.S3_BUCKET),
      }}
    />
  );
}
