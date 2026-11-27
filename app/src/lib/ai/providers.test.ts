import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  extractAndRepairJson,
  generateStructuredJsonWithProvider,
  generateWithConfiguredProvider,
  getProviderHealth,
  isCircuitOpen,
  parseAndValidateJson,
  recordProviderFailure,
  resetCircuitBreakers,
} from "./providers";

describe("Part D1 — AI Provider Layer, Circuit Breaker & JSON Repair", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetCircuitBreakers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("reports deterministic:forge honestly when no external keys are configured", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const health = getProviderHealth();
    expect(health.activeProvider).toBe("forge-engine");
    expect(health.externalConfigured).toBe(false);
  });

  it("opens circuit breaker after 3 consecutive failures", () => {
    expect(isCircuitOpen("openai")).toBe(false);
    recordProviderFailure("openai");
    recordProviderFailure("openai");
    expect(isCircuitOpen("openai")).toBe(false);
    recordProviderFailure("openai");
    expect(isCircuitOpen("openai")).toBe(true);
  });

  it("handles 200 OK from OpenAI with provenance llm:openai:...", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.AI_PROVIDER = "openai";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Live coach answer." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await generateWithConfiguredProvider({
      module: "workout",
      systemPrompt: "sys",
      userPrompt: "hi",
      deterministicReply: "fallback",
      retries: 0,
    });
    expect(res.provider).toBe("openai");
    expect(res.text).toBe("Live coach answer.");
    expect(res.meta.provenance).toMatch(/^llm:openai:/);
    expect(res.fallbackUsed).toBe(false);
  });

  it("retries on 429/500 and falls back deterministically on persistent failure", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.AI_PROVIDER = "openai";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("rate limited", { status: 429 }));

    const res = await generateWithConfiguredProvider({
      module: "nutrition",
      systemPrompt: "sys",
      userPrompt: "hi",
      deterministicReply: "deterministic nutrition plan",
      retries: 1,
      baseDelayMs: 5,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.provider).toBe("forge-engine");
    expect(res.text).toBe("deterministic nutrition plan");
    expect(res.meta.provenance).toBe("deterministic:forge");
    expect(res.fallbackUsed).toBe(true);
  });

  it("handles timeouts cleanly without throwing", async () => {
    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.AI_PROVIDER = "openai";

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Aborted", "TimeoutError"));

    const res = await generateWithConfiguredProvider({
      module: "body",
      systemPrompt: "sys",
      userPrompt: "hi",
      deterministicReply: "deterministic body response",
      retries: 0,
    });
    expect(res.provider).toBe("forge-engine");
    expect(res.text).toBe("deterministic body response");
  });

  it("repairs fenced/trailing-comma JSON and falls back on irreparable JSON", async () => {
    const schema = z.object({ title: z.string(), calories: z.number() });
    const fenced = "Here you go:\n```json\n{\"title\": \"Cut Plan\", \"calories\": 2100,}\n```";
    expect(extractAndRepairJson(fenced)).toContain("\"calories\": 2100");
    expect(parseAndValidateJson(fenced, schema)).toEqual({ title: "Cut Plan", calories: 2100 });

    process.env.OPENAI_API_KEY = "sk-test-123";
    process.env.AI_PROVIDER = "openai";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "{not valid json at all" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const structured = await generateStructuredJsonWithProvider({
      module: "nutrition",
      systemPrompt: "sys",
      userPrompt: "plan",
      schema,
      deterministicFallback: { title: "Safe Fallback", calories: 2200 },
      retries: 0,
      baseDelayMs: 5,
    });
    expect(structured.data).toEqual({ title: "Safe Fallback", calories: 2200 });
    expect(structured.meta.fellBack).toBe(true);
  });
});
