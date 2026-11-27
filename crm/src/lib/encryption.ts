import crypto from "node:crypto";

/**
 * Envelope-style AES-256-GCM encryption for sensitive member health notes & KYC numbers.
 * Ciphertext format: v1:<ivHex>:<tagHex>:<payloadHex>
 */

function resolveKey(): Buffer {
  const rawHex = process.env.ENCRYPTION_KEY?.trim();
  if (rawHex && /^[0-9a-fA-F]{64}$/.test(rawHex)) {
    return Buffer.from(rawHex, "hex");
  }
  const secret = process.env.AUTH_SECRET?.trim() || "forge-crm-local-dev-encryption-key";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSensitiveField(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (!trimmed) return "";
  const iv = crypto.randomBytes(12);
  const key = resolveKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSensitiveField(ciphertext: string | null | undefined): string {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith("v1:")) return ciphertext;
  const parts = ciphertext.split(":");
  if (parts.length !== 4) return "";
  const [, ivHex, tagHex, dataHex] = parts;
  if (!ivHex || !tagHex || !dataHex) return "";
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      resolveKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "[Encrypted data unavailable with current key]";
  }
}

export function maskKycLast4(value: string): string {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"X".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}
