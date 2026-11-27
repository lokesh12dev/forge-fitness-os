/**
 * Anti-Screenshot Dynamic TOTP-style Rotating QR Token Engine
 * Generates compact `FQR2:<memberCode>:<minuteBucket>:<hmac8>` passes that expire every 120s
 * (accepting current + previous bucket for clock skew), while remaining deterministic when tested with `nowMs`.
 */

import crypto from "node:crypto";

const QR_BUCKET_MS = 60_000;

function getQrSecret(): string {
  return process.env.AUTH_SECRET?.trim() || "forge-crm-local-qr-hmac-secret";
}

function signBucket(memberCode: string, bucket: number): string {
  return crypto
    .createHmac("sha256", getQrSecret())
    .update(`${memberCode.toUpperCase()}:${bucket}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

export function generateRotatingQrToken(memberCode: string, nowMs: number = Date.now()): {
  token: string;
  bucket: number;
  expiresInSec: number;
} {
  const code = memberCode.trim().toUpperCase();
  const bucket = Math.floor(nowMs / QR_BUCKET_MS);
  const sig = signBucket(code, bucket);
  const secondsIntoBucket = Math.floor((nowMs % QR_BUCKET_MS) / 1000);
  return {
    token: `FQR2:${code}:${bucket}:${sig}`,
    bucket,
    expiresInSec: 60 - secondsIntoBucket,
  };
}

export function verifyRotatingQrToken(
  token: string,
  nowMs: number = Date.now()
): { valid: true; memberCode: string } | { valid: false; expired: boolean } {
  const clean = token.trim().toUpperCase();
  if (!clean.startsWith("FQR2:")) {
    return { valid: false, expired: false };
  }
  const parts = clean.split(":");
  if (parts.length !== 4) {
    return { valid: false, expired: false };
  }
  const [, memberCode, bucketStr, sig] = parts;
  const bucket = Number.parseInt(bucketStr ?? "", 10);
  if (!memberCode || !Number.isFinite(bucket) || !sig) {
    return { valid: false, expired: false };
  }
  const expectedSig = signBucket(memberCode, bucket);
  if (sig !== expectedSig) {
    return { valid: false, expired: false };
  }
  const currentBucket = Math.floor(nowMs / QR_BUCKET_MS);
  // Accept current bucket and previous bucket (up to 120s validity window)
  if (Math.abs(currentBucket - bucket) <= 1) {
    return { valid: true, memberCode };
  }
  return { valid: false, expired: true };
}
