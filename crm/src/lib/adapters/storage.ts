import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const LOCAL_STORE_DIR = "/tmp/forge-crm-uploads";

export async function storeDocumentObject(input: {
  orgId: string;
  memberId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ ok: true; key: string; mode: "LOCAL_DISK" | "S3_ADAPTER" } | { ok: false; error: string }> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type "${input.mimeType}". Allowed: JPG, PNG, WEBP, PDF.`,
    };
  }
  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File size must be between 1 byte and 5 MB.`,
    };
  }

  const safeExt =
    input.mimeType === "application/pdf"
      ? "pdf"
      : input.mimeType === "image/png"
      ? "png"
      : input.mimeType === "image/webp"
      ? "webp"
      : "jpg";
  const key = `${input.orgId}/${input.memberId}/${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${safeExt}`;

  const dest = path.join(LOCAL_STORE_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, input.bytes);

  return {
    ok: true,
    key,
    mode: process.env.S3_ENDPOINT ? "S3_ADAPTER" : "LOCAL_DISK",
  };
}

export function createSignedObjectUrl(key: string): string {
  const secret = process.env.AUTH_SECRET?.trim() || "forge-crm-dev-secret-change-in-production-32bytes";
  const exp = Math.floor(Date.now() / 1000) + 900;
  const sig = crypto.createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
  return `/api/files?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedObjectUrl(key: string, expStr: string, sig: string): boolean {
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const secret = process.env.AUTH_SECRET?.trim() || "forge-crm-dev-secret-change-in-production-32bytes";
  const expected = crypto.createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
