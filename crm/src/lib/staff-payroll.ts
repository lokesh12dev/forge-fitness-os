/**
 * Staff Shift Attendance & Net Payroll Calculator (inspired by advice.fit & gymsmart.in)
 */

export interface StaffPayrollInput {
  baseSalaryPaise: number;
  scheduledDays: number;
  presentDays: number;
  lateMinutesTotal: number;
  graceMinutesPerMonth?: number;
  latePenaltyPerMinutePaise?: number;
  advanceTakenPaise: number;
  commissionPaise?: number;
}

export interface StaffPayrollBreakdown {
  baseSalaryPaise: number;
  proratedPayPaise: number;
  lateDeductionPaise: number;
  advanceDeductionPaise: number;
  commissionPaise: number;
  netPayablePaise: number;
}

export function calculateStaffNetPayroll(input: StaffPayrollInput): StaffPayrollBreakdown {
  const daysRatio =
    input.scheduledDays > 0 ? Math.min(1, Math.max(0, input.presentDays / input.scheduledDays)) : 1;
  const proratedPayPaise = Math.round(input.baseSalaryPaise * daysRatio);
  const grace = input.graceMinutesPerMonth ?? 30;
  const billableLateMins = Math.max(0, input.lateMinutesTotal - grace);
  const ratePerMin = input.latePenaltyPerMinutePaise ?? 500;
  const lateDeductionPaise = billableLateMins * ratePerMin;
  const commissionPaise = Math.max(0, input.commissionPaise ?? 0);
  const advanceDeductionPaise = Math.max(0, input.advanceTakenPaise);

  const netPayablePaise = Math.max(
    0,
    proratedPayPaise + commissionPaise - lateDeductionPaise - advanceDeductionPaise
  );

  return {
    baseSalaryPaise: input.baseSalaryPaise,
    proratedPayPaise,
    lateDeductionPaise,
    advanceDeductionPaise,
    commissionPaise,
    netPayablePaise,
  };
}
