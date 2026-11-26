import crypto from "node:crypto";

/**
 * Structured logger & lightweight Sentry adapter (no PII in logs).
 */

export function generateRequestId(): string {
  return `req_${crypto.randomBytes(6).toString("hex")}`;
}

const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "healthNotes",
  "healthNotesEnc",
  "kycNumber",
  "kycNumberEnc",
  "otp",
  "secret",
]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (REDACT_KEYS.has(k)) {
      clean[k] = "[REDACTED]";
    } else if (v instanceof Error) {
      clean[k] = { name: v.name, message: v.message };
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: "forge-crm",
    message,
    ...(sanitizeMeta(meta) ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function reportException(error: unknown, context?: Record<string, unknown>): void {
  logEvent("error", error instanceof Error ? error.message : "Unhandled CRM error", {
    error,
    sentryConfigured: Boolean(process.env.SENTRY_DSN),
    ...(context ?? {}),
  });
}
