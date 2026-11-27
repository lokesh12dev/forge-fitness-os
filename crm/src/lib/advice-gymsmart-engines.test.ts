import { describe, expect, it } from "vitest";
import { evaluateGeofenceCheckIn, haversineDistanceMeters } from "./geofence";
import {
  maskPhoneForRole,
  requiresManagerOtpForDiscount,
  verifyManagerApprovalOtp,
} from "./privacy-guard";
import { calculateStaffNetPayroll } from "./staff-payroll";

describe("advice.fit & gymsmart.in CRM Engines", () => {
  it("evaluates geofenced GPS check-ins and rejects spoofing or out-of-range coordinates", () => {
    const inside = evaluateGeofenceCheckIn({
      branchLat: 12.9716,
      branchLng: 77.6412,
      radiusMeters: 50,
      deviceLat: 12.9717,
      deviceLng: 77.6412,
      accuracyMeters: 12,
    });
    expect(inside.allowed).toBe(true);
    expect(inside.status).toBe("ACCEPTED");
    expect(inside.distanceMeters).toBeLessThanOrEqual(50);

    const outside = evaluateGeofenceCheckIn({
      branchLat: 12.9716,
      branchLng: 77.6412,
      radiusMeters: 50,
      deviceLat: 12.976,
      deviceLng: 77.6412,
      accuracyMeters: 15,
    });
    expect(outside.allowed).toBe(false);
    expect(outside.status).toBe("OUTSIDE_RADIUS");

    const spoof = evaluateGeofenceCheckIn({
      branchLat: 12.9716,
      branchLng: 77.6412,
      radiusMeters: 50,
      deviceLat: 12.9716,
      deviceLng: 77.6412,
      accuracyMeters: 10,
      isMockLocation: true,
    });
    expect(spoof.allowed).toBe(false);
    expect(spoof.status).toBe("SPOOF_DETECTED");
    expect(haversineDistanceMeters(12.9716, 77.6412, 12.9716, 77.6412)).toBe(0);
  });

  it("masks phone numbers for frontdesk/trainer roles and verifies Manager OTP", () => {
    expect(maskPhoneForRole("+91 9845012566", "FRONTDESK")).toBe("+91 98*** **566");
    expect(maskPhoneForRole("+91 9845012566", "OWNER")).toBe("+91 9845012566");
    expect(requiresManagerOtpForDiscount(20)).toBe(true);
    expect(requiresManagerOtpForDiscount(10)).toBe(false);
    expect(verifyManagerApprovalOtp("482910").valid).toBe(true);
    expect(verifyManagerApprovalOtp("000000").valid).toBe(false);
  });

  it("computes staff shift net payroll with late penalty and advance deductions", () => {
    const res = calculateStaffNetPayroll({
      baseSalaryPaise: 3_000_000, // ₹30,000
      scheduledDays: 26,
      presentDays: 26,
      lateMinutesTotal: 50, // 20m over 30m grace -> 20 * 500 = 10,000 paise (₹100)
      advanceTakenPaise: 500_000, // ₹5,000
      commissionPaise: 200_000, // ₹2,000
    });
    expect(res.lateDeductionPaise).toBe(10_000);
    expect(res.netPayablePaise).toBe(2_690_000); // ₹26,900
  });
});
