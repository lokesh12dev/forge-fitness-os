import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthContext, resolveScopedBranchIds } from "@/lib/auth";
import { canAccessFinance } from "@/lib/rbac";
import { buildCsvContent, REPORT_CATALOG } from "@/lib/reports-ai";
import { formatMoney } from "@/lib/money";
import { classifyDuesAging } from "@/lib/dues-ledger";
import { evaluateMemberChurnRisk } from "@/lib/churn";
import { computeSourceRoiReport } from "@/lib/leads-math";
import { calculateTrainerCommission } from "@/lib/ops-math";
import { maskPhoneForRole } from "@/lib/privacy-guard";

function parseDateBounds(searchParams: URLSearchParams) {
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();
  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00+05:30`) : null;
  const toDate = toParam ? new Date(`${toParam}T23:59:59+05:30`) : null;
  return {
    fromDate: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null,
    toDate: toDate && !Number.isNaN(toDate.getTime()) ? toDate : null,
  };
}

function csvDownload(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

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
  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  const spec = REPORT_CATALOG.find((r) => r.key === type) ?? REPORT_CATALOG[0]!;
  if (spec.financialOnly && !canAccessFinance(ctx.role)) {
    return NextResponse.json({ error: "Role cannot export financial reports." }, { status: 403 });
  }

  const branchIds = resolveScopedBranchIds(ctx, ctx.activeBranchId ?? "ALL");
  const { fromDate, toDate } = parseDateBounds(searchParams);
  const dateFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  // Real Indian GST Portal GSTR-1 / GSTR-3B JSON Return Downloads
  if (format === "json" && (type === "GSTR1_REGISTER" || type === "GSTR3B_SUMMARY")) {
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: ctx.org.id,
        branchId: { in: branchIds },
        status: { not: "VOID" },
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
      orderBy: { issueDate: "asc" },
      include: {
        member: { include: { group: true } },
        branch: { select: { code: true, stateCode: true } },
        lineItems: true,
      },
    });

    if (type === "GSTR3B_SUMMARY") {
      const expenses = await prisma.expense.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          ...(dateFilter ? { incurredOn: dateFilter } : {}),
        },
        select: { gstPaise: true, amountPaise: true },
      });
      const outwardTaxable = invoices.reduce((s, i) => s + i.taxablePaise, 0);
      const cgstOut = invoices.reduce((s, i) => s + i.cgstPaise, 0);
      const sgstOut = invoices.reduce((s, i) => s + i.sgstPaise, 0);
      const igstOut = invoices.reduce((s, i) => s + i.igstPaise, 0);
      const inputGst = expenses.reduce((s, e) => s + e.gstPaise, 0);
      const payload = {
        gstin: ctx.org.gstin ?? "29AABCI1234F1Z5",
        legal_name: ctx.org.name,
        ret_period: `${String(new Date().getMonth() + 1).padStart(2, "0")}${new Date().getFullYear()}`,
        sup_details: {
          osup_det: {
            txval: Number((outwardTaxable / 100).toFixed(2)),
            iamt: Number((igstOut / 100).toFixed(2)),
            camt: Number((cgstOut / 100).toFixed(2)),
            samt: Number((sgstOut / 100).toFixed(2)),
          },
        },
        itc_elg: {
          itc_avl: [
            {
              ty: "OTH",
              camt: Number(((inputGst / 2) / 100).toFixed(2)),
              samt: Number(((inputGst / 2) / 100).toFixed(2)),
              iamt: 0,
            },
          ],
          net_tax_payable_inr: Number((Math.max(0, cgstOut + sgstOut + igstOut - inputGst) / 100).toFixed(2)),
        },
      };
      return NextResponse.json(payload, {
        headers: { "Content-Disposition": `attachment; filename="forge-gstr3b-${ctx.org.slug}.json"` },
      });
    }

    const b2bMap = new Map<string, Array<Record<string, unknown>>>();
    const b2csMap = new Map<string, { sply_ty: string; rt: number; pos: string; txval: number; camt: number; samt: number; iamt: number }>();

    for (const inv of invoices) {
      const buyerGstin = inv.member.group?.corporateGstin;
      const ratePct = 18;
      if (buyerGstin && buyerGstin.length >= 15) {
        const list = b2bMap.get(buyerGstin) ?? [];
        list.push({
          inum: inv.invoiceNumber,
          idt: inv.issueDate.toISOString().slice(0, 10),
          val: Number((inv.totalPaise / 100).toFixed(2)),
          pos: inv.placeOfSupplyState,
          itms: [
            {
              num: 1,
              itm_det: {
                txval: Number((inv.taxablePaise / 100).toFixed(2)),
                rt: ratePct,
                camt: Number((inv.cgstPaise / 100).toFixed(2)),
                samt: Number((inv.sgstPaise / 100).toFixed(2)),
                iamt: Number((inv.igstPaise / 100).toFixed(2)),
              },
            },
          ],
        });
        b2bMap.set(buyerGstin, list);
      } else {
        const isInter = inv.igstPaise > 0;
        const key = `${inv.placeOfSupplyState}-${isInter ? "INTER" : "INTRA"}`;
        const bucket = b2csMap.get(key) ?? {
          sply_ty: isInter ? "INTER" : "INTRA",
          rt: ratePct,
          pos: inv.placeOfSupplyState,
          txval: 0,
          camt: 0,
          samt: 0,
          iamt: 0,
        };
        bucket.txval += Number((inv.taxablePaise / 100).toFixed(2));
        bucket.camt += Number((inv.cgstPaise / 100).toFixed(2));
        bucket.samt += Number((inv.sgstPaise / 100).toFixed(2));
        bucket.iamt += Number((inv.igstPaise / 100).toFixed(2));
        b2csMap.set(key, bucket);
      }
    }

    const gstr1 = {
      gstin: ctx.org.gstin ?? "29AABCI1234F1Z5",
      fp: `${String(new Date().getMonth() + 1).padStart(2, "0")}${new Date().getFullYear()}`,
      version: "GST3.0.4",
      b2b: Array.from(b2bMap.entries()).map(([ctin, inv]) => ({ ctin, inv })),
      b2cs: Array.from(b2csMap.values()),
      hsn: {
        data: [
          {
            num: 1,
            hsn_sc: "999723",
            desc: "Physical well-being & gym membership services",
            qty: invoices.length,
            txval: Number((invoices.reduce((s, i) => s + i.taxablePaise, 0) / 100).toFixed(2)),
            iamt: Number((invoices.reduce((s, i) => s + i.igstPaise, 0) / 100).toFixed(2)),
            camt: Number((invoices.reduce((s, i) => s + i.cgstPaise, 0) / 100).toFixed(2)),
            samt: Number((invoices.reduce((s, i) => s + i.sgstPaise, 0) / 100).toFixed(2)),
          },
        ],
      },
    };
    return NextResponse.json(gstr1, {
      headers: { "Content-Disposition": `attachment; filename="forge-gstr1-${ctx.org.slug}.json"` },
    });
  }

  switch (type) {
    case "DAILY_COLLECTION": {
      const payments = await prisma.payment.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          status: "CAPTURED",
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
        orderBy: { paidAt: "desc" },
        take: 1500,
        include: {
          branch: { select: { code: true } },
          member: { select: { memberCode: true, fullName: true } },
          invoice: { select: { invoiceNumber: true, totalPaise: true, cgstPaise: true, sgstPaise: true, igstPaise: true } },
          collectedBy: { select: { name: true } },
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Paid At (IST)", "Branch", "Receipt/Invoice", "Member", "Method", "Provider", "Amount", "Staff", "Ref"],
          payments.map((p) => [
            p.paidAt.toISOString(),
            p.branch.code,
            p.invoice.invoiceNumber,
            `${p.member.fullName} (${p.member.memberCode})`,
            p.method,
            p.provider,
            formatMoney(p.amountPaise, { currency: ctx.org.currency }),
            p.collectedBy?.name ?? "Online/Auto",
            p.referenceText ?? p.providerPaymentId ?? "",
          ])
        ),
        "forge-daily-collection.csv"
      );
    }

    case "DUES_AGING": {
      const openInvoices = await prisma.invoice.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          balanceDuePaise: { gt: 0 },
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        },
        orderBy: { dueDate: "asc" },
        take: 1000,
        include: {
          branch: { select: { code: true } },
          member: { select: { memberCode: true, fullName: true, phone: true } },
        },
      });
      const now = new Date();
      return csvDownload(
        buildCsvContent(
          ["Invoice #", "Branch", "Due Date", "Aging Bucket", "Member", "Phone", "Total", "Paid", "Balance Due"],
          openInvoices.map((i) => [
            i.invoiceNumber,
            i.branch.code,
            i.dueDate.toISOString().slice(0, 10),
            classifyDuesAging(i.dueDate, i.balanceDuePaise, now),
            `${i.member.fullName} (${i.member.memberCode})`,
            maskPhoneForRole(i.member.phone, ctx.role),
            formatMoney(i.totalPaise, { currency: ctx.org.currency }),
            formatMoney(i.paidPaise, { currency: ctx.org.currency }),
            formatMoney(i.balanceDuePaise, { currency: ctx.org.currency }),
          ])
        ),
        "forge-dues-aging.csv"
      );
    }

    case "POS_SALES": {
      const sales = await prisma.posSale.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          ...(dateFilter ? { soldAt: dateFilter } : {}),
        },
        orderBy: { soldAt: "desc" },
        take: 1000,
        include: {
          branch: { select: { code: true } },
          member: { select: { fullName: true, memberCode: true } },
          soldBy: { select: { name: true } },
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Receipt #", "Date", "Branch", "Customer", "Method", "Subtotal", "GST", "Total", "Cashier", "Items"],
          sales.map((s) => {
            const items = Array.isArray(s.itemsJson)
              ? (s.itemsJson as Array<{ name?: string; qty?: number }>).map((x) => `${x.name ?? "SKU"} x${x.qty ?? 1}`).join(" | ")
              : "Items";
            return [
              s.invoiceNumber,
              s.soldAt.toISOString().slice(0, 16).replace("T", " "),
              s.branch.code,
              s.member ? `${s.member.fullName} (${s.member.memberCode})` : "Walk-in",
              s.method,
              formatMoney(s.subtotalPaise, { currency: ctx.org.currency }),
              formatMoney(s.gstPaise, { currency: ctx.org.currency }),
              formatMoney(s.totalPaise, { currency: ctx.org.currency }),
              s.soldBy.name,
              items,
            ];
          })
        ),
        "forge-pos-sales.csv"
      );
    }

    case "INVENTORY_VALUATION": {
      const items = await prisma.inventoryItem.findMany({
        where: { orgId: ctx.org.id, branchId: { in: branchIds }, isActive: true },
        orderBy: [{ branchId: "asc" }, { category: "asc" }, { name: "asc" }],
        include: { branch: { select: { code: true } } },
      });
      return csvDownload(
        buildCsvContent(
          ["SKU", "Branch", "Item Name", "Category", "Stock Qty", "Reorder Lvl", "Cost Value", "Retail Value", "Supplier", "Status"],
          items.map((it) => [
            it.sku,
            it.branch.code,
            it.name,
            it.category,
            it.stockQty,
            it.reorderLevel,
            formatMoney(it.costPaise * it.stockQty, { currency: ctx.org.currency }),
            formatMoney(it.unitPricePaise * it.stockQty, { currency: ctx.org.currency }),
            it.supplierName,
            it.stockQty <= it.reorderLevel ? "LOW_STOCK" : "HEALTHY",
          ])
        ),
        "forge-inventory-valuation.csv"
      );
    }

    case "TRAINER_PAYROLL": {
      const profiles = await prisma.trainerProfile.findMany({
        where: { orgId: ctx.org.id, branchId: { in: branchIds }, isActive: true },
        include: { user: { select: { name: true } }, branch: { select: { code: true } } },
      });
      const sessions = await prisma.ptSession.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          status: "COMPLETED",
          ...(dateFilter ? { scheduledAt: dateFilter } : {}),
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Trainer", "Branch", "Completed PT", "Rate Bps", "Base Retainer", "PT Gross", "PT Commission", "Total Payout"],
          profiles.map((p) => {
            const mine = sessions.filter((s) => s.trainerId === p.userId);
            const calc = calculateTrainerCommission({
              baseRetainerPaise: p.baseRetainerPaise,
              completedSessionFeesPaise: mine.map((s) => s.sessionFeePaise),
              baseCommissionBps: p.commissionBps,
            });
            return [
              p.user.name,
              p.branch.code,
              mine.length,
              calc.effectiveBps,
              formatMoney(calc.retainerPaise, { currency: ctx.org.currency }),
              formatMoney(calc.grossPtRevenuePaise, { currency: ctx.org.currency }),
              formatMoney(calc.commissionEarnedPaise, { currency: ctx.org.currency }),
              formatMoney(calc.totalPayoutPaise, { currency: ctx.org.currency }),
            ];
          })
        ),
        "forge-trainer-payroll.csv"
      );
    }

    case "SOURCE_ROI": {
      const [leads, adSpends, wonInvoices] = await Promise.all([
        prisma.lead.findMany({
          where: { orgId: ctx.org.id, branchId: { in: branchIds }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
          select: { source: true, stage: true, convertedMemberId: true },
        }),
        prisma.adSpendCampaign.findMany({
          where: { orgId: ctx.org.id, OR: [{ branchId: { in: branchIds } }, { branchId: null }] },
          select: { source: true, spendPaise: true },
        }),
        prisma.invoice.groupBy({
          by: ["memberId"],
          where: { orgId: ctx.org.id, branchId: { in: branchIds }, status: { in: ["PAID", "PARTIALLY_PAID"] } },
          _sum: { paidPaise: true },
        }),
      ]);
      const spendBySourcePaise: Record<string, number> = {};
      for (const a of adSpends) {
        spendBySourcePaise[a.source] = (spendBySourcePaise[a.source] ?? 0) + a.spendPaise;
      }
      const revenueByMemberPaise: Record<string, number> = {};
      for (const r of wonInvoices) revenueByMemberPaise[r.memberId] = r._sum.paidPaise ?? 0;
      const roiRows = computeSourceRoiReport({ leads, spendBySourcePaise, revenueByMemberPaise });
      return csvDownload(
        buildCsvContent(
          ["Source", "Leads", "Won", "Conversion %", "Ad Spend", "CPL", "Attributed Revenue", "ROI %"],
          roiRows.map((r) => [
            r.source,
            r.leadsCount,
            r.wonCount,
            `${r.conversionRatePct}%`,
            formatMoney(r.spendPaise, { currency: ctx.org.currency }),
            formatMoney(r.costPerLeadPaise, { currency: ctx.org.currency }),
            formatMoney(r.revenuePaise, { currency: ctx.org.currency }),
            `${r.roiMultiplierPct}%`,
          ])
        ),
        "forge-source-roi.csv"
      );
    }

    case "CHURN_WATCHLIST": {
      const now = new Date();
      const d14Ago = new Date(now.getTime() - 14 * 86_400_000);
      const d28Ago = new Date(now.getTime() - 28 * 86_400_000);
      const [members, recentCheckIns] = await Promise.all([
        prisma.member.findMany({
          where: {
            orgId: ctx.org.id,
            branchId: { in: branchIds },
            deletedAt: null,
            mergedIntoMemberId: null,
            status: { in: ["ACTIVE", "EXPIRING", "OVERDUE"] },
          },
          include: {
            branch: { select: { name: true } },
            subscriptions: { orderBy: { endDate: "desc" }, take: 1, include: { plan: true } },
            invoices: { where: { balanceDuePaise: { gt: 0 } }, select: { balanceDuePaise: true } },
          },
        }),
        prisma.checkIn.findMany({
          where: { orgId: ctx.org.id, branchId: { in: branchIds }, visitedAt: { gte: d28Ago }, result: { in: ["ALLOWED", "OVERRIDE_ALLOWED"] } },
          select: { memberId: true, visitedAt: true },
        }),
      ]);
      const ciMap = new Map<string, { last14: number; prev14: number }>();
      for (const ci of recentCheckIns) {
        const entry = ciMap.get(ci.memberId) ?? { last14: 0, prev14: 0 };
        if (ci.visitedAt >= d14Ago) entry.last14++;
        else entry.prev14++;
        ciMap.set(ci.memberId, entry);
      }
      const watchlist = members
        .map((m) => {
          const cnt = ciMap.get(m.id) ?? { last14: 0, prev14: 0 };
          const daysAbsent = m.lastVisitedAt ? Math.max(0, Math.round((now.getTime() - m.lastVisitedAt.getTime()) / 86_400_000)) : 30;
          const dues = m.invoices.reduce((s, inv) => s + inv.balanceDuePaise, 0);
          const assessment = evaluateMemberChurnRisk(
            {
              visitsLast14d: cnt.last14,
              visitsPrev14d: cnt.prev14,
              daysSinceLastVisit: daysAbsent,
              status: m.status,
              overdueBalancePaise: dues,
              billingModel: m.subscriptions[0]?.plan.billingModel ?? null,
              tenureDays: Math.round((now.getTime() - m.createdAt.getTime()) / 86_400_000),
            },
            m.fullName
          );
          return { m, daysAbsent, assessment };
        })
        .filter((x) => x.assessment.score >= 30 || x.daysAbsent >= 10)
        .sort((a, b) => b.assessment.score - a.assessment.score);

      return csvDownload(
        buildCsvContent(
          ["Member Code", "Full Name", "Branch", "Status", "Risk Score", "Risk Tier", "Days Absent", "Primary Reason", "Phone"],
          watchlist.map(({ m, daysAbsent, assessment }) => [
            m.memberCode,
            m.fullName,
            m.branch.name,
            m.status,
            assessment.score,
            assessment.tier,
            daysAbsent,
            assessment.factors[0]?.label ?? "Low engagement",
            maskPhoneForRole(m.phone, ctx.role),
          ])
        ),
        "forge-churn-watchlist.csv"
      );
    }

    case "MEMBER_DIRECTORY":
    case "EXPIRING_RENEWALS": {
      const members = await prisma.member.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          deletedAt: null,
          mergedIntoMemberId: null,
          ...(type === "EXPIRING_RENEWALS" ? { status: "EXPIRING" } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 2500,
        include: { branch: { select: { name: true } } },
      });
      return csvDownload(
        buildCsvContent(
          ["Member Code", "Full Name", "Branch", "Status", "Expiry Date", "Phone"],
          members.map((m) => [
            m.memberCode,
            m.fullName,
            m.branch.name,
            m.status,
            m.expiryDate ? m.expiryDate.toISOString().slice(0, 10) : "",
            maskPhoneForRole(m.phone, ctx.role),
          ])
        ),
        `forge-${type.toLowerCase()}.csv`
      );
    }

    case "ATTENDANCE_PEAKS": {
      const checkIns = await prisma.checkIn.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          ...(dateFilter ? { visitedAt: dateFilter } : {}),
        },
        orderBy: { visitedAt: "desc" },
        take: 2500,
        include: {
          branch: { select: { code: true } },
          member: { select: { memberCode: true, fullName: true } },
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Visited At", "Checked Out", "Branch", "Member", "Method", "Result", "Override Reason"],
          checkIns.map((ci) => [
            ci.visitedAt.toISOString(),
            ci.checkedOutAt ? ci.checkedOutAt.toISOString() : "On Floor",
            ci.branch.code,
            `${ci.member.fullName} (${ci.member.memberCode})`,
            ci.method,
            ci.result,
            ci.overrideReason ?? "",
          ])
        ),
        "forge-attendance-peaks.csv"
      );
    }

    case "CLASS_UTILIZATION": {
      const sessions = await prisma.classSession.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          ...(dateFilter ? { startsAt: dateFilter } : {}),
        },
        orderBy: { startsAt: "desc" },
        take: 500,
        include: {
          branch: { select: { code: true } },
          classType: { select: { name: true } },
          trainer: { select: { name: true } },
          bookings: { select: { status: true } },
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Class", "Type", "Branch", "Trainer", "Starts At", "Studio", "Capacity", "Booked", "Checked In", "Waitlisted", "No Show", "Fill %"],
          sessions.map((s) => {
            const booked = s.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length;
            const checked = s.bookings.filter((b) => b.status === "CHECKED_IN").length;
            const wait = s.bookings.filter((b) => b.status === "WAITLISTED").length;
            const noShow = s.bookings.filter((b) => b.status === "NO_SHOW").length;
            return [
              s.title,
              s.classType.name,
              s.branch.code,
              s.trainer.name,
              s.startsAt.toISOString().slice(0, 16).replace("T", " "),
              s.studioRoom,
              s.capacity,
              booked,
              checked,
              wait,
              noShow,
              `${Math.round((booked / Math.max(1, s.capacity)) * 100)}%`,
            ];
          })
        ),
        "forge-class-utilization.csv"
      );
    }

    case "EQUIPMENT_HEALTH": {
      const assets = await prisma.equipmentAsset.findMany({
        where: { orgId: ctx.org.id, branchId: { in: branchIds } },
        orderBy: [{ branchId: "asc" }, { zone: "asc" }],
        include: { branch: { select: { code: true } } },
      });
      return csvDownload(
        buildCsvContent(
          ["Asset Code", "Branch", "Name", "Brand", "Zone", "Status", "Last Serviced", "Next Service Due", "Warranty Until", "Notes"],
          assets.map((a) => [
            a.assetCode,
            a.branch.code,
            a.name,
            a.brand,
            a.zone,
            a.status,
            a.lastServicedAt ? a.lastServicedAt.toISOString().slice(0, 10) : "",
            a.nextServiceDue ? a.nextServiceDue.toISOString().slice(0, 10) : "",
            a.warrantyUntil ? a.warrantyUntil.toISOString().slice(0, 10) : "",
            a.maintenanceNotes ?? "",
          ])
        ),
        "forge-equipment-health.csv"
      );
    }

    case "AUDIT_LOG": {
      const logs = await prisma.auditLog.findMany({
        where: {
          orgId: ctx.org.id,
          ...(branchIds.length > 0 ? { OR: [{ branchId: { in: branchIds } }, { branchId: null }] } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 1500,
        include: { actor: { select: { name: true, email: true } }, branch: { select: { code: true } } },
      });
      return csvDownload(
        buildCsvContent(
          ["Timestamp", "Branch", "Actor", "Role", "Action", "Resource Type", "Resource ID", "Request ID"],
          logs.map((l) => [
            l.createdAt.toISOString(),
            l.branch?.code ?? "ORG",
            `${l.actor.name} <${l.actor.email}>`,
            l.actorRole,
            l.action,
            l.resourceType,
            l.resourceId,
            l.requestId,
          ])
        ),
        "forge-audit-log.csv"
      );
    }

    case "GSTR1_REGISTER":
    default: {
      const invoices = await prisma.invoice.findMany({
        where: {
          orgId: ctx.org.id,
          branchId: { in: branchIds },
          ...(dateFilter ? { issueDate: dateFilter } : {}),
        },
        orderBy: { issueDate: "desc" },
        take: 1500,
        include: {
          member: { select: { memberCode: true, fullName: true, group: { select: { corporateGstin: true } } } },
          branch: { select: { code: true } },
        },
      });
      return csvDownload(
        buildCsvContent(
          ["Invoice #", "Branch", "Date", "Member", "Buyer GSTIN", "POS State", "SAC", "Taxable", "CGST", "SGST", "IGST", "Total", "Balance Due", "Status"],
          invoices.map((i) => [
            i.invoiceNumber,
            i.branch.code,
            i.issueDate.toISOString().slice(0, 10),
            `${i.member.fullName} (${i.member.memberCode})`,
            i.member.group?.corporateGstin ?? "B2C",
            i.placeOfSupplyState,
            i.sacCode,
            formatMoney(i.taxablePaise, { currency: ctx.org.currency }),
            formatMoney(i.cgstPaise, { currency: ctx.org.currency }),
            formatMoney(i.sgstPaise, { currency: ctx.org.currency }),
            formatMoney(i.igstPaise, { currency: ctx.org.currency }),
            formatMoney(i.totalPaise, { currency: ctx.org.currency }),
            formatMoney(i.balanceDuePaise, { currency: ctx.org.currency }),
            i.status,
          ])
        ),
        `forge-${type.toLowerCase()}.csv`
      );
    }
  }
}
