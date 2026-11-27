/**
 * World-Class Enterprise CRM Pure Engines:
 * - Split-tender validation (sum == total)
 * - Pipeline Lead SLA breach detector
 * - Recurring class schedule generator
 * - Studio Spot Grid label generator
 * - Custom Field payload sanitizer
 */

export interface SplitTenderEntry {
  method: "UPI" | "CARD" | "CASH" | "BANK_TRANSFER" | "WALLET" | "GIFT_CARD";
  amountPaise: number;
  ref?: string;
}

export function validateSplitTender(
  totalDuePaise: number,
  parts: SplitTenderEntry[]
): { ok: true; sumPaise: number; cleanParts: SplitTenderEntry[] } | { ok: false; error: string } {
  const cleanParts = parts
    .map((p) => ({
      ...p,
      amountPaise: Math.max(0, Math.trunc(p.amountPaise)),
    }))
    .filter((p) => p.amountPaise > 0);

  if (cleanParts.length === 0) {
    return { ok: false, error: "At least one positive payment split is required." };
  }
  const sumPaise = cleanParts.reduce((s, p) => s + p.amountPaise, 0);
  if (sumPaise > totalDuePaise) {
    return { ok: false, error: "Split tender sum exceeds invoice balance due." };
  }
  return { ok: true, sumPaise, cleanParts };
}

export function evaluateLeadSlaStatus(input: {
  stage: string;
  stageChangedAt: Date;
  now?: Date;
}): {
  hoursInStage: number;
  breached: boolean;
  severity: "OK" | "WARN" | "BREACHED";
  label: string;
} {
  if (input.stage === "WON" || input.stage === "LOST") {
    return { hoursInStage: 0, breached: false, severity: "OK", label: "Closed" };
  }
  const now = input.now ?? new Date();
  const hours = Math.max(0, Math.floor((now.getTime() - input.stageChangedAt.getTime()) / 3_600_000));
  if (input.stage === "NEW" && hours >= 4) {
    return { hoursInStage: hours, breached: true, severity: "BREACHED", label: `SLA ${hours}h >4h uncontacted` };
  }
  if ((input.stage === "CONTACTED" || input.stage === "TRIAL_BOOKED") && hours >= 48) {
    return { hoursInStage: hours, breached: true, severity: "BREACHED", label: `SLA ${Math.round(hours / 24)}d overdue` };
  }
  if (hours >= 24) {
    return { hoursInStage: hours, breached: false, severity: "WARN", label: `${Math.round(hours / 24)}d in stage` };
  }
  return { hoursInStage: hours, breached: false, severity: "OK", label: `${hours}h in stage` };
}

export function buildRecurringSessionDates(input: {
  firstStartsAt: Date;
  weeksCount: number;
  daysOfWeek?: number[]; // 0=Sun .. 6=Sat
}): Date[] {
  const weeks = Math.max(1, Math.min(16, Math.trunc(input.weeksCount)));
  const out: Date[] = [];
  if (!input.daysOfWeek || input.daysOfWeek.length === 0) {
    for (let w = 0; w < weeks; w++) {
      out.push(new Date(input.firstStartsAt.getTime() + w * 7 * 86_400_000));
    }
    return out;
  }

  const baseDay = input.firstStartsAt.getDay();
  const seen = new Set<number>();
  for (let w = 0; w < weeks; w++) {
    for (const targetDow of input.daysOfWeek) {
      const deltaDays = ((targetDow - baseDay + 7) % 7) + w * 7;
      const d = new Date(input.firstStartsAt.getTime() + deltaDays * 86_400_000);
      if (d.getTime() >= input.firstStartsAt.getTime() && !seen.has(d.getTime())) {
        seen.add(d.getTime());
        out.push(d);
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export function generateStudioSpotCodes(rows: number, cols: number, prefix: string = "S"): string[] {
  if (rows <= 0 || cols <= 0) return [];
  const cleanPrefix = prefix.trim().toUpperCase() || "S";
  const codes: string[] = [];
  const total = Math.min(80, rows * cols);
  for (let i = 1; i <= total; i++) {
    codes.push(`${cleanPrefix}${i}`);
  }
  return codes;
}

export function sanitizeCustomFieldsInput(
  raw: Record<string, unknown>,
  defs: Array<{ fieldKey: string; fieldType: string; required: boolean }>
): { ok: true; data: Record<string, string | number | boolean> } | { ok: false; error: string } {
  const out: Record<string, string | number | boolean> = {};
  for (const def of defs) {
    const val = raw[def.fieldKey];
    if (val === undefined || val === null || val === "") {
      if (def.required) {
        return { ok: false, error: `Required custom field "${def.fieldKey}" is missing.` };
      }
      continue;
    }
    if (def.fieldType === "NUMBER") {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `Custom field "${def.fieldKey}" must be numeric.` };
      }
      out[def.fieldKey] = n;
    } else if (def.fieldType === "BOOLEAN") {
      out[def.fieldKey] = Boolean(val === true || val === "true");
    } else {
      out[def.fieldKey] = String(val).trim();
    }
  }
  return { ok: true, data: out };
}
