import crypto from "node:crypto";
import { and, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import type { AiModule } from "./schemas";

export type AiProviderName = "gemini" | "openai" | "anthropic" | "forge-engine";

export interface AIMeta {
  provenance: string; // "llm:<provider>:<model>" | "deterministic:forge"
  provider: AiProviderName;
  model: string;
  inTokens: number;
  outTokens: number;
  latencyMs: number;
  fellBack: boolean;
  fallbackReason?: string;
  circuitOpen?: boolean;
}

export interface ProviderHealthStatus {
  activeProvider: AiProviderName;
  externalConfigured: boolean;
  providers: Array<{
    name: AiProviderName;
    label: string;
    configured: boolean;
    model: string;
    mode: "external-llm" | "deterministic";
    circuitOpen: boolean;
    consecutiveFailures: number;
    circuitOpensUntil: number | null;
  }>;
}

export interface ProviderCompletionResult {
  text: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
  tokensEstimated: number;
  inTokens: number;
  outTokens: number;
  fallbackUsed: boolean;
  meta: AIMeta;
}

interface CircuitState {
  failures: number;
  openUntil: number | null;
}

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

const circuitBreakers = new Map<AiProviderName, CircuitState>();

export function resetCircuitBreakers() {
  circuitBreakers.clear();
}

export function getCircuitState(provider: AiProviderName): CircuitState {
  const st = circuitBreakers.get(provider) ?? { failures: 0, openUntil: null };
  if (st.openUntil !== null && Date.now() >= st.openUntil) {
    const reset = { failures: 0, openUntil: null };
    circuitBreakers.set(provider, reset);
    return reset;
  }
  return st;
}

export function isCircuitOpen(provider: AiProviderName): boolean {
  const st = getCircuitState(provider);
  return st.openUntil !== null && Date.now() < st.openUntil;
}

export function recordProviderSuccess(provider: AiProviderName) {
  circuitBreakers.set(provider, { failures: 0, openUntil: null });
}

export function recordProviderFailure(provider: AiProviderName) {
  const cur = getCircuitState(provider);
  const failures = cur.failures + 1;
  const openUntil = failures >= CIRCUIT_THRESHOLD ? Date.now() + CIRCUIT_OPEN_MS : null;
  circuitBreakers.set(provider, { failures, openUntil });
}

export function getProviderHealth(): ProviderHealthStatus {
  const geminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const openaiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const preferred = (process.env.AI_PROVIDER ?? "").toLowerCase();

  let activeProvider: AiProviderName = "forge-engine";
  if (preferred === "openai" && openaiKey && !isCircuitOpen("openai")) activeProvider = "openai";
  else if (preferred === "anthropic" && anthropicKey && !isCircuitOpen("anthropic")) activeProvider = "anthropic";
  else if (preferred === "gemini" && geminiKey && !isCircuitOpen("gemini")) activeProvider = "gemini";
  else if (geminiKey && !isCircuitOpen("gemini")) activeProvider = "gemini";
  else if (openaiKey && !isCircuitOpen("openai")) activeProvider = "openai";
  else if (anthropicKey && !isCircuitOpen("anthropic")) activeProvider = "anthropic";

  const makeEntry = (
    name: AiProviderName,
    label: string,
    configured: boolean,
    model: string,
    mode: "external-llm" | "deterministic",
  ) => {
    const st = getCircuitState(name);
    return {
      name,
      label,
      configured,
      model,
      mode,
      circuitOpen: st.openUntil !== null && Date.now() < st.openUntil,
      consecutiveFailures: st.failures,
      circuitOpensUntil: st.openUntil,
    };
  };

  return {
    activeProvider,
    externalConfigured: geminiKey || openaiKey || anthropicKey,
    providers: [
      makeEntry("gemini", "Google Gemini", geminiKey, process.env.GEMINI_MODEL || "gemini-2.0-flash", "external-llm"),
      makeEntry("openai", "OpenAI", openaiKey, process.env.OPENAI_MODEL || "gpt-4o-mini", "external-llm"),
      makeEntry("anthropic", "Anthropic Claude", anthropicKey, process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest", "external-llm"),
      makeEntry("forge-engine", "Forge Deterministic Engine", true, "forge-fitness-v2", "deterministic"),
    ],
  };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function formatProvenance(provider: AiProviderName, model: string): string {
  if (provider === "forge-engine") return "deterministic:forge";
  return `llm:${provider}:${model}`;
}

export function extractAndRepairJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip markdown fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  // Extract outermost JSON object or array
  const firstObj = candidate.indexOf("{");
  const firstArr = candidate.indexOf("[");
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return null;

  const isObj = candidate[start] === "{";
  const end = candidate.lastIndexOf(isObj ? "}" : "]");
  if (end <= start) return null;

  candidate = candidate.slice(start, end + 1);
  // Remove trailing commas before } or ]
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  return candidate;
}

export function parseAndValidateJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  const repaired = extractAndRepairJson(raw);
  if (!repaired) return null;
  try {
    const parsed: unknown = JSON.parse(repaired);
    const res = schema.safeParse(parsed);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  options?: { retries?: number; timeoutMs?: number; baseDelayMs?: number },
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 8000;
  const baseDelayMs = options?.baseDelayMs ?? 200;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }

    if (attempt < retries) {
      const jitter = Math.floor(Math.random() * 60);
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error("Provider request failed");
}

export function getDailyTokenBudget(): number {
  const raw = Number(process.env.AI_DAILY_TOKEN_BUDGET ?? "150000");
  return Number.isFinite(raw) && raw > 0 ? raw : 150000;
}

export async function getUserDailyTokenUsage(userId: string): Promise<{ usedTokens: number; budgetTokens: number; remainingTokens: number; exceeded: boolean }> {
  const budgetTokens = getDailyTokenBudget();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  try {
    const rows = await db
      .select({
        total: sql<number>`coalesce(sum(${aiUsage.inTokens} + ${aiUsage.outTokens}), 0)`,
      })
      .from(aiUsage)
      .where(and(sql`${aiUsage.userId} = ${userId}`, gte(aiUsage.createdAt, startOfDay)));
    const usedTokens = Number(rows[0]?.total ?? 0);
    return {
      usedTokens,
      budgetTokens,
      remainingTokens: Math.max(0, budgetTokens - usedTokens),
      exceeded: usedTokens >= budgetTokens,
    };
  } catch {
    return { usedTokens: 0, budgetTokens, remainingTokens: budgetTokens, exceeded: false };
  }
}

export async function recordAiUsage(params: {
  userId: string;
  module: string;
  meta: AIMeta;
  errorCode?: string | null;
}) {
  try {
    await db.insert(aiUsage).values({
      id: `aiu-${crypto.randomUUID()}`,
      userId: params.userId,
      module: params.module,
      provider: params.meta.provider,
      model: params.meta.model,
      inTokens: params.meta.inTokens,
      outTokens: params.meta.outTokens,
      latencyMs: params.meta.latencyMs,
      fellBack: params.meta.fellBack,
      errorCode: params.errorCode ?? null,
      createdAt: new Date(),
    });
  } catch {
    // Non-fatal telemetry failure
  }
}

async function callSingleProvider(
  provider: AiProviderName,
  systemPrompt: string,
  userPrompt: string,
  options?: { timeoutMs?: number; retries?: number; baseDelayMs?: number },
): Promise<{ text: string; model: string }> {
  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetchWithBackoff(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nUser: ${userPrompt}` }],
            },
          ],
        }),
      },
      options,
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("Gemini empty response");
    return { text, model };
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const res = await fetchWithBackoff(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      },
      options,
    );
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI empty response");
    return { text, model };
  }

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
    const res = await fetchWithBackoff(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      },
      options,
    );
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) throw new Error("Anthropic empty response");
    return { text, model };
  }

  throw new Error(`Provider ${provider} not configured`);
}

export async function generateWithConfiguredProvider(params: {
  module: AiModule;
  userId?: string;
  systemPrompt: string;
  userPrompt: string;
  deterministicReply: string;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}): Promise<ProviderCompletionResult> {
  const startedAt = Date.now();
  const health = getProviderHealth();
  const inTokens = estimateTokens(`${params.systemPrompt}\n${params.userPrompt}`);

  let fallbackReason: string | undefined;
  let errorCode: string | null = null;

  if (params.userId) {
    const budget = await getUserDailyTokenUsage(params.userId);
    if (budget.exceeded) {
      fallbackReason = "Daily AI token budget exceeded; using deterministic Forge engine.";
      errorCode = "BUDGET_EXCEEDED";
      const outTokens = estimateTokens(params.deterministicReply);
      const meta: AIMeta = {
        provenance: "deterministic:forge",
        provider: "forge-engine",
        model: "forge-fitness-v2",
        inTokens,
        outTokens,
        latencyMs: Date.now() - startedAt,
        fellBack: true,
        fallbackReason,
      };
      await recordAiUsage({ userId: params.userId, module: params.module, meta, errorCode });
      return {
        text: params.deterministicReply,
        provider: "forge-engine",
        model: "forge-fitness-v2",
        latencyMs: meta.latencyMs,
        tokensEstimated: outTokens,
        inTokens,
        outTokens,
        fallbackUsed: true,
        meta,
      };
    }
  }

  if (health.activeProvider !== "forge-engine") {
    try {
      const result = await callSingleProvider(
        health.activeProvider,
        params.systemPrompt,
        params.userPrompt,
        {
          timeoutMs: params.timeoutMs,
          retries: params.retries,
          baseDelayMs: params.baseDelayMs,
        },
      );
      recordProviderSuccess(health.activeProvider);
      const outTokens = estimateTokens(result.text);
      const latencyMs = Date.now() - startedAt;
      const meta: AIMeta = {
        provenance: formatProvenance(health.activeProvider, result.model),
        provider: health.activeProvider,
        model: result.model,
        inTokens,
        outTokens,
        latencyMs,
        fellBack: false,
      };
      if (params.userId) {
        await recordAiUsage({ userId: params.userId, module: params.module, meta });
      }
      return {
        text: result.text,
        provider: health.activeProvider,
        model: result.model,
        latencyMs,
        tokensEstimated: outTokens,
        inTokens,
        outTokens,
        fallbackUsed: false,
        meta,
      };
    } catch (err) {
      recordProviderFailure(health.activeProvider);
      fallbackReason = err instanceof Error ? err.message : "Provider error";
      errorCode = "PROVIDER_ERROR";
    }
  }

  const outTokens = estimateTokens(params.deterministicReply);
  const latencyMs = Date.now() - startedAt;
  const meta: AIMeta = {
    provenance: "deterministic:forge",
    provider: "forge-engine",
    model: "forge-fitness-v2",
    inTokens,
    outTokens,
    latencyMs,
    fellBack: health.externalConfigured,
    fallbackReason,
    circuitOpen: health.providers.some((p) => p.circuitOpen),
  };
  if (params.userId) {
    await recordAiUsage({ userId: params.userId, module: params.module, meta, errorCode });
  }
  return {
    text: params.deterministicReply,
    provider: "forge-engine",
    model: "forge-fitness-v2",
    latencyMs,
    tokensEstimated: outTokens,
    inTokens,
    outTokens,
    fallbackUsed: health.externalConfigured,
    meta,
  };
}

export async function generateStructuredJsonWithProvider<T>(params: {
  module: AiModule;
  userId?: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  deterministicFallback: T;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}): Promise<{ data: T; meta: AIMeta }> {
  const completion = await generateWithConfiguredProvider({
    module: params.module,
    userId: params.userId,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    deterministicReply: JSON.stringify(params.deterministicFallback),
    timeoutMs: params.timeoutMs,
    retries: params.retries,
    baseDelayMs: params.baseDelayMs,
  });

  if (completion.provider === "forge-engine") {
    return { data: params.deterministicFallback, meta: completion.meta };
  }

  const parsed = parseAndValidateJson(completion.text, params.schema);
  if (parsed) {
    return { data: parsed, meta: completion.meta };
  }

  // Single JSON repair pass
  const repairCompletion = await generateWithConfiguredProvider({
    module: params.module,
    userId: params.userId,
    systemPrompt: "Return ONLY valid JSON matching the requested structure. Do not include markdown or commentary.",
    userPrompt: `Repair this malformed JSON:\n${completion.text.slice(0, 2000)}`,
    deterministicReply: JSON.stringify(params.deterministicFallback),
    timeoutMs: params.timeoutMs,
    retries: 0,
    baseDelayMs: params.baseDelayMs,
  });

  const repaired = parseAndValidateJson(repairCompletion.text, params.schema);
  if (repaired) {
    return { data: repaired, meta: repairCompletion.meta };
  }

  return {
    data: params.deterministicFallback,
    meta: {
      ...completion.meta,
      provenance: "deterministic:forge",
      provider: "forge-engine",
      model: "forge-fitness-v2",
      fellBack: true,
      fallbackReason: "Malformed JSON after repair pass; fell back to deterministic engine.",
    },
  };
}
