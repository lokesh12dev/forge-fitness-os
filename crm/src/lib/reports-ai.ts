/**
 * Phase 4 Pure Intelligence & Export Engines:
 * 14 Report catalog + CSV injection sanitizer, GSTR register summary, Migration CSV validator, and Grounded Org AI query resolver.
 */

import { formatMoney } from "./money";

export interface ReportCatalogEntry {
  key: string;
  title: string;
  category: "FINANCE" | "OPS" | "GROWTH";
  financialOnly: boolean;
  description: string;
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { key: "DAILY_COLLECTION", title: "Daily Collection Register", category: "FINANCE", financialOnly: true, description: "UPI, card, cash, and bank payments with GST breakup" },
  { key: "GSTR1_REGISTER", title: "GSTR-1 Outward Tax Sheet", category: "FINANCE", financialOnly: true, description: "Sequential GST invoices grouped by CGST/SGST and IGST + JSON export" },
  { key: "GSTR3B_SUMMARY", title: "GSTR-3B Net Liability & ITC", category: "FINANCE", financialOnly: true, description: "Outward tax vs expense Input Tax Credit JSON/CSV return" },
  { key: "DUES_AGING", title: "Overdue & Dunning Aging", category: "FINANCE", financialOnly: true, description: "0-7d, 8-30d, and 30d+ pending invoice balances" },
  { key: "POS_SALES", title: "POS Retail & Supplements", category: "FINANCE", financialOnly: true, description: "Store SKU checkout totals and tax collected" },
  { key: "INVENTORY_VALUATION", title: "Stock Valuation & Reorder", category: "FINANCE", financialOnly: true, description: "On-hand unit cost vs retail valuation per branch" },
  { key: "TRAINER_PAYROLL", title: "Trainer PT Payroll Slabs", category: "FINANCE", financialOnly: true, description: "Retainer + tiered PT commission payouts" },
  { key: "SOURCE_ROI", title: "Lead Acquisition ROI", category: "GROWTH", financialOnly: true, description: "Ad spend, CPL, won conversions, and member revenue" },
  { key: "MEMBER_DIRECTORY", title: "Active & Expiring Roster", category: "OPS", financialOnly: false, description: "Full branch member statuses, plans, and expiries" },
  { key: "EXPIRING_RENEWALS", title: "Next-14d Expiring Pass List", category: "GROWTH", financialOnly: false, description: "Members due for renewal follow-up" },
  { key: "CHURN_WATCHLIST", title: "At-Risk & Absentee Report", category: "GROWTH", financialOnly: false, description: "Members absent >= 14 days with urgency tier" },
  { key: "ATTENDANCE_PEAKS", title: "Check-In Floor Velocity", category: "OPS", financialOnly: false, description: "Daily verified QR & override gate entries" },
  { key: "CLASS_UTILIZATION", title: "Class Fill & Waitlist Rates", category: "OPS", financialOnly: false, description: "Session occupancy %, waitlists, and no-show ratios" },
  { key: "EQUIPMENT_HEALTH", title: "Equipment Service Log", category: "OPS", financialOnly: false, description: "Asset statuses, warranties, and overdue maintenance" },
  { key: "AUDIT_LOG", title: "Immutable Compliance Audit", category: "OPS", financialOnly: false, description: "Sensitive staff actions, overrides, refunds & DPDP logs" },
];

function sanitizeCsvCell(val: unknown): string {
  const str = String(val ?? "");
  // Prevent CSV formula injection (=, +, -, @)
  const neutralized = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function buildCsvContent(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const headLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headLine, ...dataLines].join("\r\n");
}

export function aggregateGstrSummary(
  invoices: Array<{
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
    sacCode: string;
  }>
): {
  invoiceCount: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
} {
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let totalPaise = 0;
  for (const inv of invoices) {
    taxablePaise += inv.taxablePaise;
    cgstPaise += inv.cgstPaise;
    sgstPaise += inv.sgstPaise;
    igstPaise += inv.igstPaise;
    totalPaise += inv.totalPaise;
  }
  return {
    invoiceCount: invoices.length,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise,
  };
}

export interface ParsedImportRow {
  rowNum: number;
  fullName: string;
  phone: string;
  email: string;
  status: string;
  valid: boolean;
  error?: string;
}

export function validateMigrationCsvRows(rawCsv: string): {
  rows: ParsedImportRow[];
  validCount: number;
  errorCount: number;
} {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  // Skip header if first line contains "name" or "phone"
  const startIdx = /name|phone/i.test(lines[0] ?? "") ? 1 : 0;
  const parsed: ParsedImportRow[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    const fullName = cols[0] ?? "";
    const phone = cols[1] ?? "";
    const email = cols[2] ?? "";
    const status = (cols[3] ?? "ACTIVE").toUpperCase();
    const digits = phone.replace(/\D/g, "");

    let error: string | undefined;
    if (fullName.length < 2) {
      error = "Full name missing (<2 chars)";
    } else if (digits.length < 8) {
      error = "Invalid mobile digits (<8 digits)";
    }

    parsed.push({
      rowNum: i + 1,
      fullName,
      phone,
      email,
      status,
      valid: !error,
      error,
    });
  }

  return {
    rows: parsed,
    validCount: parsed.filter((r) => r.valid).length,
    errorCount: parsed.filter((r) => !r.valid).length,
  };
}

export interface OrgAiContextSnapshot {
  orgName: string;
  branchName: string;
  role: string;
  canAccessFinance: boolean;
  currency: string;
  activeMembers: number;
  expiring7d: number;
  overdueCount: number;
  overdueTotalPaise: number;
  todayRevenuePaise: number;
  openLeadsCount: number;
  lowStockItemsCount: number;
  topAbsentMemberName: string | null;
  topAbsentMemberId: string | null;
}

export function resolveGroundedOrgAiQuery(
  prompt: string,
  snap: OrgAiContextSnapshot
): {
  answer: string;
  citations: Array<{ source: string; metric: string }>;
  suggestedAction: {
    type: "CREATE_TASK" | "DRAFT_WHATSAPP";
    title: string;
    targetMemberId?: string;
    payloadText: string;
  } | null;
} {
  const q = prompt.toLowerCase();

  if (/(revenue|collection|dues|overdue|unpaid|money|paise|cash)/i.test(q)) {
    if (!snap.canAccessFinance) {
      return {
        answer: `Access restricted: role ${snap.role} cannot query financial collections or overdue INR ledgers in FORGE CRM.`,
        citations: [{ source: "RBAC Policy Guard", metric: `${snap.role} blocked from billing metrics` }],
        suggestedAction: null,
      };
    }
    return {
      answer: `${snap.branchName} collected ${formatMoney(snap.todayRevenuePaise, { currency: snap.currency })} today across captured payments, while ${snap.overdueCount} members carry ${formatMoney(snap.overdueTotalPaise, { currency: snap.currency })} in open dues.`,
      citations: [
        { source: "Payment Ledger (Captured Today)", metric: formatMoney(snap.todayRevenuePaise, { currency: snap.currency }) },
        { source: "Invoice Dues Aging", metric: `${snap.overdueCount} overdue · ${formatMoney(snap.overdueTotalPaise, { currency: snap.currency })}` },
      ],
      suggestedAction:
        snap.overdueCount > 0
          ? {
              type: "CREATE_TASK",
              title: `Follow up on top ${snap.overdueCount} overdue balances in ${snap.branchName}`,
              payloadText: `Run T-7 & Unpaid UPI link reminders for ${snap.overdueCount} overdue balances (${formatMoney(snap.overdueTotalPaise, { currency: snap.currency })}).`,
            }
          : null,
    };
  }

  if (/(churn|absent|expir|retention|save|risk)/i.test(q)) {
    return {
      answer: `${snap.branchName} currently has ${snap.expiring7d} memberships expiring within 7 days and ${snap.activeMembers} active athletes.${snap.topAbsentMemberName ? ` Highest priority outreach target: ${snap.topAbsentMemberName}.` : ""}`,
      citations: [
        { source: "Member Renewal Window (<=7d)", metric: `${snap.expiring7d} expiring` },
        { source: "Active Roster", metric: `${snap.activeMembers} active members` },
      ],
      suggestedAction: snap.topAbsentMemberId
        ? {
            type: "DRAFT_WHATSAPP",
            title: `Send personal check-in WhatsApp to ${snap.topAbsentMemberName}`,
            targetMemberId: snap.topAbsentMemberId,
            payloadText: `Hey ${snap.topAbsentMemberName?.split(" ")[0] ?? "there"}, missed seeing you at ${snap.branchName}! Want us to reserve a 30-min mobility + strength reset with a coach this week?`,
          }
        : null,
    };
  }

  if (/(lead|pipeline|trial|stock|inventory|low)/i.test(q)) {
    return {
      answer: `Pipeline holds ${snap.openLeadsCount} open enquiries in ${snap.branchName}. Inventory audit flags ${snap.lowStockItemsCount} SKU(s) at or below reorder threshold.`,
      citations: [
        { source: "Lead Funnel", metric: `${snap.openLeadsCount} open leads` },
        { source: "Inventory Stock Guard", metric: `${snap.lowStockItemsCount} low-stock alerts` },
      ],
      suggestedAction:
        snap.lowStockItemsCount > 0
          ? {
              type: "CREATE_TASK",
              title: `Raise supplier PO for ${snap.lowStockItemsCount} low-stock SKUs`,
              payloadText: `Review Inventory -> Purchase Orders for ${snap.lowStockItemsCount} items below reorder level in ${snap.branchName}.`,
            }
          : null,
    };
  }

  return {
    answer: `Live brief for ${snap.orgName} (${snap.branchName}): ${snap.activeMembers} active members, ${snap.expiring7d} expiring in 7 days, ${snap.openLeadsCount} open pipeline leads, and ${snap.lowStockItemsCount} inventory alerts.${snap.canAccessFinance ? ` Today's captured revenue: ${formatMoney(snap.todayRevenuePaise, { currency: snap.currency })}.` : ""}`,
    citations: [
      { source: "Members Snapshot", metric: `${snap.activeMembers} active / ${snap.expiring7d} expiring 7d` },
      { source: "Growth Funnel", metric: `${snap.openLeadsCount} open leads` },
    ],
    suggestedAction: null,
  };
}
