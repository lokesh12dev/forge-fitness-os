/**
 * Role-Based Phone Masking & Manager OTP Approval Guard (inspired by gymsmart.in)
 */

export function maskPhoneForRole(phone: string, role: string): string {
  const clean = phone.trim();
  if (!clean) return "";
  if (role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT") {
    return clean;
  }
  const digits = clean.replace(/\D/g, "");
  if (digits.length < 6) return "***-***";
  const prefix = clean.startsWith("+91") ? "+91 " : "";
  const core = digits.length > 10 ? digits.slice(-10) : digits;
  return `${prefix}${core.slice(0, 2)}*** **${core.slice(-3)}`;
}

export function requiresManagerOtpForDiscount(discountPct: number): boolean {
  return discountPct > 15;
}

export function verifyManagerApprovalOtp(
  enteredOtp: string,
  expectedOtp = "482910"
): { valid: boolean; reason: string } {
  const clean = enteredOtp.trim();
  if (!/^\d{6}$/.test(clean)) {
    return { valid: false, reason: "Enter a 6-digit Manager OTP." };
  }
  if (clean !== expectedOtp) {
    return { valid: false, reason: "Invalid Manager OTP code." };
  }
  return { valid: true, reason: "Manager OTP verified." };
}
