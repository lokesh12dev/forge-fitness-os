import { describe, expect, it } from "vitest";
import { generateRotatingQrToken, verifyRotatingQrToken } from "./dynamic-qr";
import {
  buildRecurringSessionDates,
  evaluateLeadSlaStatus,
  generateStudioSpotCodes,
  sanitizeCustomFieldsInput,
  validateSplitTender,
} from "./world-class-engines";

describe("World-Class CRM Engines (Dynamic QR, Split Tender, SLA, Spots, Custom Fields)", () => {
  it("generates and verifies 60s rotating HMAC QR tokens and rejects expired or tampered codes", () => {
    const now = 1_795_750_000_000;
    const gen = generateRotatingQrToken("FM-1003", now);
    expect(gen.token.startsWith("FQR2:FM-1003:")).toBe(true);

    // Valid within current and next 60s bucket (clock skew tolerance)
    expect(verifyRotatingQrToken(gen.token, now)).toEqual({ valid: true, memberCode: "FM-1003" });
    expect(verifyRotatingQrToken(gen.token, now + 60_000)).toEqual({ valid: true, memberCode: "FM-1003" });

    // Expired after 2+ buckets
    const expired = verifyRotatingQrToken(gen.token, now + 180_000);
    expect(expired).toEqual({ valid: false, expired: true });

    // Tampered signature rejected immediately
    const tampered = gen.token.slice(0, -4) + "ZZZZ";
    expect(verifyRotatingQrToken(tampered, now)).toEqual({ valid: false, expired: false });
  });

  it("validates multi-method split tender against remaining invoice balance", () => {
    const ok = validateSplitTender(500000, [
      { method: "UPI", amountPaise: 300000 },
      { method: "CASH", amountPaise: 150000 },
      { method: "WALLET", amountPaise: 50000 },
    ]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.sumPaise).toBe(500000);

    const over = validateSplitTender(200000, [
      { method: "UPI", amountPaise: 150000 },
      { method: "CASH", amountPaise: 100000 },
    ]);
    expect(over.ok).toBe(false);
  });

  it("flags pipeline SLA breaches, builds recurring class schedules, generates spots, and sanitizes custom fields", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    const sla = evaluateLeadSlaStatus({
      stage: "NEW",
      stageChangedAt: new Date("2026-11-27T05:00:00Z"),
      now,
    });
    expect(sla.breached).toBe(true);
    expect(sla.severity).toBe("BREACHED");

    const dates = buildRecurringSessionDates({
      firstStartsAt: new Date("2026-11-30T07:00:00Z"), // Monday
      weeksCount: 3,
      daysOfWeek: [1, 3], // Mon & Wed
    });
    expect(dates).toHaveLength(6);

    const spots = generateStudioSpotCodes(2, 4, "B");
    expect(spots).toEqual(["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"]);

    const custom = sanitizeCustomFieldsInput(
      { target_weight: "72.5", tshirt_size: "L", locker_pref: true },
      [
        { fieldKey: "target_weight", fieldType: "NUMBER", required: true },
        { fieldKey: "tshirt_size", fieldType: "SELECT", required: true },
        { fieldKey: "locker_pref", fieldType: "BOOLEAN", required: false },
      ]
    );
    expect(custom).toEqual({
      ok: true,
      data: { target_weight: 72.5, tshirt_size: "L", locker_pref: true },
    });
  });
});
