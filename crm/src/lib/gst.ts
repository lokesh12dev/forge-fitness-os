/**
 * Pure Indian GST (CGST + SGST vs IGST) integer-paise calculation engine.
 * SAC 999723 applies to health/fitness club memberships & physical well-being services.
 */

export interface GstLineInput {
  description: string;
  unitPricePaise: number;
  quantity: number;
  discountPaise?: number;
  gstRateBps: number; // e.g. 1800 = 18.00%
  placeOfSupplyState: string;
  branchStateCode: string;
}

export interface GstLineBreakdown {
  description: string;
  quantity: number;
  unitPricePaise: number;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  gstRateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
}

export interface GstInvoiceSummary {
  lines: GstLineBreakdown[];
  isInterState: boolean;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
}

export function calculateGstLineItem(input: GstLineInput): GstLineBreakdown {
  const qty = Math.max(1, Math.trunc(input.quantity));
  const unit = Math.max(0, Math.trunc(input.unitPricePaise));
  const subtotalPaise = unit * qty;
  const rawDiscount = Math.max(0, Math.trunc(input.discountPaise ?? 0));
  const discountPaise = Math.min(subtotalPaise, rawDiscount);
  const taxablePaise = subtotalPaise - discountPaise;
  const gstRateBps = Math.max(0, Math.min(5000, Math.trunc(input.gstRateBps)));

  const totalTaxPaise = Math.round((taxablePaise * gstRateBps) / 10_000);
  const isInterState =
    input.placeOfSupplyState.trim().toUpperCase() !== input.branchStateCode.trim().toUpperCase();

  const igstPaise = isInterState ? totalTaxPaise : 0;
  const cgstPaise = isInterState ? 0 : Math.floor(totalTaxPaise / 2);
  const sgstPaise = isInterState ? 0 : totalTaxPaise - cgstPaise;
  const totalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise;

  return {
    description: input.description,
    quantity: qty,
    unitPricePaise: unit,
    subtotalPaise,
    discountPaise,
    taxablePaise,
    gstRateBps,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    totalPaise,
  };
}

export function aggregateGstInvoice(
  items: Omit<GstLineInput, "placeOfSupplyState" | "branchStateCode">[],
  placeOfSupplyState: string,
  branchStateCode: string
): GstInvoiceSummary {
  const lines = items.map((item) =>
    calculateGstLineItem({
      ...item,
      placeOfSupplyState,
      branchStateCode,
    })
  );

  const isInterState =
    placeOfSupplyState.trim().toUpperCase() !== branchStateCode.trim().toUpperCase();

  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let totalTaxPaise = 0;
  let totalPaise = 0;

  for (const line of lines) {
    subtotalPaise += line.subtotalPaise;
    discountPaise += line.discountPaise;
    taxablePaise += line.taxablePaise;
    cgstPaise += line.cgstPaise;
    sgstPaise += line.sgstPaise;
    igstPaise += line.igstPaise;
    totalTaxPaise += line.totalTaxPaise;
    totalPaise += line.totalPaise;
  }

  return {
    lines,
    isInterState,
    subtotalPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    totalPaise,
  };
}
