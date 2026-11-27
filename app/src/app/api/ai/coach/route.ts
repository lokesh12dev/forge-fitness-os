import { randomUUID } from "crypto";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { buildUserFitnessContext } from "@/lib/ai/context";
import { generateModuleCoachResponse } from "@/lib/ai/engine";
import { estimateTokens, formatProvenance, getProviderHealth } from "@/lib/ai/providers";
import { AiModuleSchema, type AnyAiPlan } from "@/lib/ai/schemas";

const rid = (prefix: string) => `${prefix}_${randomUUID().slice(0, 12)}`;

// Sliding window per-user rate limiter (30 req / 60s)
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const stamps = (rateBuckets.get(userId) ?? []).filter((t) => t > windowStart);
  if (stamps.length >= 30) return false;
  stamps.push(now);
  rateBuckets.set(userId, stamps);
  return true;
}

// 5-minute Idempotency-Key cache
const idempotencyCache = new Map<
  string,
  { reply: string; plan: AnyAiPlan | null; planId: string | null; messageId: string; provider: string; model: string; expiresAt: number }
>();

const PostBodySchema = z.object({
  module: AiModuleSchema,
  message: z.string().trim().min(1).max(1200),
  regenerate: z.boolean().optional(),
  hints: z
    .object({
      selectedExerciseId: z.string().optional(),
      selectedExerciseName: z.string().optional(),
      currentScheduleMode: z.enum(["week", "rotation"]).optional(),
      recordedTapeMetrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      dietPreference: z.string().optional(),
      allergies: z.string().optional(),
    })
    .optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", status: "offline" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modParsed = AiModuleSchema.safeParse(searchParams.get("module"));
  if (!modParsed.success) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }
  const mod = modParsed.data;
  const afterId = searchParams.get("after")?.trim();

  let afterTs: Date | null = null;
  if (afterId) {
    const anchor = await db
      .select({ createdAt: schema.aiConversations.createdAt })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, afterId), eq(schema.aiConversations.userId, user.id)))
      .limit(1);
    if (anchor[0]) afterTs = anchor[0].createdAt;
  }

  const msgCondition = afterTs
    ? and(
        eq(schema.aiConversations.userId, user.id),
        eq(schema.aiConversations.module, mod),
        gt(schema.aiConversations.createdAt, afterTs),
      )
    : and(eq(schema.aiConversations.userId, user.id), eq(schema.aiConversations.module, mod));

  const [messages, plans, context] = await Promise.all([
    db
      .select()
      .from(schema.aiConversations)
      .where(msgCondition)
      .orderBy(asc(schema.aiConversations.createdAt))
      .limit(60),
    db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.userId, user.id), eq(schema.aiPlans.module, mod)))
      .orderBy(desc(schema.aiPlans.createdAt))
      .limit(12),
    buildUserFitnessContext(user.id),
  ]);

  return NextResponse.json({
    status: "online",
    providerHealth: getProviderHealth(),
    module: mod,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: m.status,
      planId: m.planId,
      plan: m.planJson ? (JSON.parse(m.planJson) as AnyAiPlan) : null,
      createdAt: new Date(m.createdAt).getTime(),
    })),
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      version: p.version,
      parentPlanId: p.parentPlanId,
      provider: p.provider,
      status: p.status,
      plan: JSON.parse(p.planJson) as AnyAiPlan,
      createdAt: new Date(p.createdAt).getTime(),
      appliedAt: p.appliedAt ? new Date(p.appliedAt).getTime() : null,
    })),
    contextSummary: {
      firstName: context.firstName,
      goal: context.goal,
      readiness: context.readiness,
      weightKg: context.weightKg,
      caloriesConsumed: context.nutrition.caloriesConsumed,
      caloriesTarget: context.nutrition.caloriesTarget,
      proteinConsumed: context.nutrition.proteinConsumed,
      proteinTarget: context.nutrition.proteinTarget,
      streak: context.streak,
    },
  });
}

function encodeSse(encoder: TextEncoder, event: string, payload: Record<string, unknown>) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Rate limit exceeded. Please wait a few seconds." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { module: mod, message, regenerate, hints } = parsed.data;
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
  const cacheKey = idempotencyKey ? `${user.id}:${mod}:${idempotencyKey}` : null;

  if (cacheKey) {
    const cached = idempotencyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encodeSse(encoder, "meta", {
              type: "meta",
              provenance: formatProvenance(cached.provider as "forge-engine", cached.model),
              provider: cached.provider,
              model: cached.model,
              deduped: true,
            }),
          );
          controller.enqueue(encodeSse(encoder, "delta", { type: "delta", text: cached.reply }));
          if (cached.plan && cached.planId) {
            controller.enqueue(
              encodeSse(encoder, "plan", {
                type: "plan",
                planId: cached.planId,
                provider: cached.provider,
                plan: cached.plan,
              }),
            );
          }
          controller.enqueue(
            encodeSse(encoder, "done", {
              type: "done",
              messageId: cached.messageId,
              provider: cached.provider,
              model: cached.model,
              status: "complete",
              deduped: true,
            }),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
  }

  const now = new Date();
  if (!regenerate) {
    await db.insert(schema.aiConversations).values({
      id: rid("aic"),
      userId: user.id,
      module: mod,
      role: "user",
      content: message,
      status: "complete",
      planId: null,
      planJson: null,
      createdAt: now,
    });
  }

  const [existingPlans, context] = await Promise.all([
    db
      .select()
      .from(schema.aiPlans)
      .where(and(eq(schema.aiPlans.userId, user.id), eq(schema.aiPlans.module, mod)))
      .orderBy(desc(schema.aiPlans.version))
      .limit(1),
    buildUserFitnessContext(user.id),
  ]);

  const latestDraftRow = existingPlans[0] && existingPlans[0].status === "draft" ? existingPlans[0] : null;
  const activeDraftPlan = latestDraftRow ? (JSON.parse(latestDraftRow.planJson) as AnyAiPlan) : null;

  const result = await generateModuleCoachResponse({
    module: mod,
    message,
    context,
    hints,
    activeDraftPlan: regenerate ? null : activeDraftPlan,
  });

  let savedPlanId: string | null = null;
  let savedVersion = 1;

  if (result.plan) {
    savedVersion = (existingPlans[0]?.version ?? 0) + 1;
    savedPlanId = rid("aip");
    await db.insert(schema.aiPlans).values({
      id: savedPlanId,
      userId: user.id,
      module: mod,
      title: result.plan.title,
      version: savedVersion,
      parentPlanId: result.mutatedExistingDraft && latestDraftRow ? latestDraftRow.id : null,
      provider: result.provider,
      status: "draft",
      planJson: JSON.stringify(result.plan),
      createdAt: new Date(),
      appliedAt: null,
    });
  }

  const assistantMsgId = rid("aic");
  await db.insert(schema.aiConversations).values({
    id: assistantMsgId,
    userId: user.id,
    module: mod,
    role: "assistant",
    content: result.reply,
    status: "complete",
    planId: savedPlanId,
    planJson: result.plan ? JSON.stringify(result.plan) : null,
    createdAt: new Date(),
  });

  if (cacheKey) {
    idempotencyCache.set(cacheKey, {
      reply: result.reply,
      plan: result.plan,
      planId: savedPlanId,
      messageId: assistantMsgId,
      provider: result.provider,
      model: result.model,
      expiresAt: Date.now() + 5 * 60_000,
    });
  }

  const encoder = new TextEncoder();
  const words = result.reply.split(/(\s+)/);
  const provenance = formatProvenance(result.provider, result.model);

  const stream = new ReadableStream({
    async start(controller) {
      let emitted = "";
      let aborted = false;
      const onAbort = () => {
        aborted = true;
      };
      req.signal.addEventListener("abort", onAbort, { once: true });

      try {
        controller.enqueue(
          encodeSse(encoder, "meta", {
            type: "meta",
            provenance,
            provider: result.provider,
            model: result.model,
          }),
        );

        const chunkSize = 4;
        for (let i = 0; i < words.length; i += chunkSize) {
          if (aborted || req.signal.aborted) {
            aborted = true;
            break;
          }
          const piece = words.slice(i, i + chunkSize).join("");
          emitted += piece;
          controller.enqueue(encodeSse(encoder, "delta", { type: "delta", text: piece }));
          await new Promise((r) => setTimeout(r, 10));
        }

        if (aborted) {
          await db
            .update(schema.aiConversations)
            .set({
              status: "interrupted",
              content: emitted.trim() || "(Response interrupted)",
            })
            .where(eq(schema.aiConversations.id, assistantMsgId));
          controller.close();
          return;
        }

        if (result.plan && savedPlanId) {
          const planPayload = {
            type: "plan",
            planId: savedPlanId,
            version: savedVersion,
            provider: result.provider,
            plan: result.plan,
            mutatedExistingDraft: result.mutatedExistingDraft,
          };
          controller.enqueue(encodeSse(encoder, "plan", planPayload));
          controller.enqueue(encodeSse(encoder, "draft", { ...planPayload, type: "draft" }));
        }

        const inTokens = estimateTokens(message);
        const outTokens = result.tokensEstimated;
        controller.enqueue(
          encodeSse(encoder, "usage", {
            type: "usage",
            inTokens,
            outTokens,
            latencyMs: result.latencyMs,
          }),
        );

        controller.enqueue(
          encodeSse(encoder, "done", {
            type: "done",
            messageId: assistantMsgId,
            provider: result.provider,
            model: result.model,
            provenance,
            latencyMs: result.latencyMs,
            tokensEstimated: outTokens,
            fallbackUsed: result.fallbackUsed,
            mutatedExistingDraft: result.mutatedExistingDraft,
            status: "complete",
          }),
        );
        controller.close();
      } catch {
        controller.close();
      } finally {
        req.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const modParsed = AiModuleSchema.safeParse(searchParams.get("module"));
  if (!modParsed.success) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  await db
    .delete(schema.aiConversations)
    .where(and(eq(schema.aiConversations.userId, user.id), eq(schema.aiConversations.module, modParsed.data)));

  return NextResponse.json({ ok: true });
}
