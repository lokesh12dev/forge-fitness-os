"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, Bot, Check, ChevronDown, ChevronUp, Copy, History, MessageSquarePlus,
  RefreshCw, RotateCcw, Sparkles, Square, Wifi, WifiOff,
} from "lucide-react";
import type { AiModule, AnyAiPlan } from "@/lib/ai/schemas";
import type { ModuleClientHints } from "@/lib/ai/engine";
import { cn } from "@/lib/utils";
import { AiPlanPanel } from "./ai-plan-panel";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  planId?: string | null;
  plan?: AnyAiPlan | null;
  createdAt: number;
}

interface SavedPlanItem {
  id: string;
  title: string;
  version: number;
  provider?: string;
  status: "draft" | "applied" | "archived";
  plan: AnyAiPlan;
}

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-chalk">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function RichAiMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 pl-1">
        {bullets.map((b, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-acid" />
            <span><InlineMd text={b} /></span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^[-•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else if (numbered) {
      flushBullets();
      blocks.push(
        <p key={`n-${blocks.length}`} className="my-1 leading-relaxed">
          <span className="mr-1.5 font-mono text-[10.5px] text-acid">{numbered[1]}.</span>
          <InlineMd text={numbered[2]} />
        </p>,
      );
    } else if (!line.trim()) {
      flushBullets();
    } else {
      flushBullets();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-1 leading-relaxed first:mt-0 last:mb-0">
          <InlineMd text={line} />
        </p>,
      );
    }
  }
  flushBullets();

  return <div className="space-y-0.5 text-[13px] leading-relaxed text-chalk/95">{blocks}</div>;
}

const MODULE_META: Record<
  AiModule,
  {
    title: string;
    subtitle: string;
    prompts: string[];
    followUps: string[];
  }
> = {
  schedule: {
    title: "Warm-Up, Plan & Schedule AI",
    subtitle: "7/14/30/60/90-day programs, dynamic warm-ups, recovery days & missed-workout rebalancing",
    prompts: [
      "Create my complete 30-day fitness plan",
      "Generate today's warm-up",
      "Create a 6-day workout schedule",
      "Adjust my schedule based on my missed workout",
      "Create a beginner-friendly recovery plan",
    ],
    followUps: ["Make Wednesday a recovery day", "Make Sunday a rest day"],
  },
  workout: {
    title: "Workout AI Coach",
    subtitle: "Executable Push/Pull/Legs/Upper/Lower sessions with sets, reps, tempo, RPE & overload",
    prompts: [
      "Create a complete 5-day muscle-building workout plan",
      "Build a 45-min Push hypertrophy workout",
      "Create a 30-min home dumbbell workout",
      "Generate a bodyweight conditioning workout",
    ],
    followUps: ["Replace first exercise", "Make it 30 minutes"],
  },
  exercise: {
    title: "Exercise Mechanics AI",
    subtitle: "Step-by-step form mechanics, breathing, muscles targeted, mistakes & superset pairings",
    prompts: [
      "Explain Barbell Bench Press step by step",
      "Recommend alternatives for Back Squat",
      "Build a superset & progression plan for Pull-Ups",
      "Common mistakes and breathing cues for Deadlift",
    ],
    followUps: ["Explain breathing cues", "Show equipment alternatives"],
  },
  body: {
    title: "Status & Body AI Coach",
    subtitle: "Honest audit of recorded weight, body metrics, strength plateaus & recomposition targets",
    prompts: [
      "Analyze my weight and strength progress",
      "Am I hitting a plateau right now?",
      "Build a realistic 4-week body transformation target",
      "Which body measurements am I missing?",
    ],
    followUps: ["Shift goal to muscle building", "Shift goal to fat loss"],
  },
  nutrition: {
    title: "Nutrition Check AI Coach",
    subtitle: "Personalized meal plans, Indian & vegetarian/vegan options, grocery lists & macro targets",
    prompts: [
      "Create a high-protein Indian vegetarian meal plan",
      "Build a muscle-building nutrition plan with grocery list",
      "Suggest pre-workout and post-workout meals",
      "Shift my goal to muscle building and update macros",
    ],
    followUps: ["Make it vegan", "Switch to Indian meal options"],
  },
};

export function ModuleAiCoach({
  module,
  hints,
  defaultOpen = false,
  compactHeader = false,
  onPlanApplied,
}: {
  module: AiModule;
  hints?: ModuleClientHints;
  defaultOpen?: boolean;
  compactHeader?: boolean;
  onPlanApplied?: (result: { plan: AnyAiPlan; summary: string; clientPlanPatch?: unknown; redirectUrl?: string }) => void;
}) {
  const router = useRouter();
  const meta = MODULE_META[module];

  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [providerLabel, setProviderLabel] = useState<string>("Forge Engine");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [planHistory, setPlanHistory] = useState<SavedPlanItem[]>([]);
  const [latestPlan, setLatestPlan] = useState<SavedPlanItem | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [ctxBadge, setCtxBadge] = useState<string>("");
  const [telemetry, setTelemetry] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/coach?module=${module}`, { cache: "no-store" });
      if (!res.ok) {
        setStatus("offline");
        return;
      }
      const data = (await res.json()) as {
        status: "online" | "offline";
        providerHealth?: {
          activeProvider: string;
          providers: Array<{ name: string; label: string }>;
        };
        messages: ChatMsg[];
        plans: SavedPlanItem[];
        contextSummary?: {
          readiness: number;
          goal: string;
          caloriesConsumed: number;
          caloriesTarget: number;
        };
      };
      setStatus(data.status ?? "online");
      if (data.providerHealth) {
        const active = data.providerHealth.providers.find((p) => p.name === data.providerHealth?.activeProvider);
        if (active) setProviderLabel(active.label);
      }
      setMessages(data.messages ?? []);
      setPlanHistory(data.plans ?? []);
      if (data.plans?.length) setLatestPlan(data.plans[0]);
      if (data.contextSummary) {
        setCtxBadge(
          module === "nutrition"
            ? `${data.contextSummary.caloriesConsumed}/${data.contextSummary.caloriesTarget} kcal`
            : `Readiness ${data.contextSummary.readiness}/100 · ${data.contextSummary.goal}`,
        );
      }
    } catch {
      setStatus("offline");
    }
  }, [module]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, latestPlan, open]);

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }

  async function sendPrompt(text: string, regenerate = false) {
    const clean = text.trim();
    if (!clean || isStreaming) return;

    setOpen(true);
    setFeedback(null);
    if (!regenerate) {
      setMessages((prev) => [
        ...prev,
        { id: `local-u-${Date.now()}`, role: "user", content: clean, createdAt: Date.now() },
      ]);
      setInput("");
    }

    setIsStreaming(true);
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";
    let streamedPlan: SavedPlanItem | null = null;

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ module, message: clean, regenerate, hints }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({ error: "AI service unavailable" }));
        setFeedback({ tone: "err", text: errJson.error || "Could not reach AI Coach." });
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as
            | { type: "delta"; text: string }
            | { type: "plan"; planId: string; version: number; provider?: string; plan: AnyAiPlan }
            | { type: "done"; messageId: string; provider?: string; latencyMs?: number; tokensEstimated?: number; mutatedExistingDraft?: boolean };

          if (payload.type === "delta") {
            accumulated += payload.text;
            setStreamingText(accumulated);
          } else if (payload.type === "plan") {
            streamedPlan = {
              id: payload.planId,
              title: payload.plan.title,
              version: payload.version,
              provider: payload.provider,
              status: "draft",
              plan: payload.plan,
            };
            setLatestPlan(streamedPlan);
            setPlanHistory((prev) => [streamedPlan!, ...prev]);
          } else if (payload.type === "done") {
            setMessages((prev) => [
              ...prev,
              {
                id: payload.messageId,
                role: "assistant",
                content: accumulated,
                planId: streamedPlan?.id ?? null,
                plan: streamedPlan?.plan ?? null,
                createdAt: Date.now(),
              },
            ]);
            setStreamingText("");
            if (payload.provider) {
              setTelemetry(
                `${payload.provider} · ${payload.latencyMs ?? 0}ms · ~${payload.tokensEstimated ?? 0} tok${payload.mutatedExistingDraft ? " · draft updated" : ""}`,
              );
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { id: `abort-${Date.now()}`, role: "assistant", content: `${accumulated} [stopped]`, createdAt: Date.now() },
          ]);
        }
        setStreamingText("");
      } else {
        setFeedback({ tone: "err", text: "Connection interrupted while streaming response." });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleClearChat() {
    if (isStreaming) stopGeneration();
    const res = await fetch(`/api/ai/coach?module=${module}`, { method: "DELETE" });
    if (res.ok) {
      setMessages([]);
      setFeedback({ tone: "ok", text: "Started a fresh conversation." });
    }
  }

  async function handleApplyPlan(plan: AnyAiPlan, applyCrossSync: boolean) {
    setActionBusy(true);
    setFeedback(null);
    try {
      const applyToken = `apply-${latestPlan?.id ?? module}-${latestPlan?.version ?? 1}-${Date.now()}`;
      const res = await fetch("/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_plan",
          module,
          planId: latestPlan?.id,
          applyToken,
          plan,
          applyCrossSync,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        summary?: string;
        redirectUrl?: string;
        clientPlanPatch?: unknown;
      };
      if (!res.ok || !data.ok) {
        setFeedback({ tone: "err", text: data.error || "Failed to apply plan." });
        return;
      }
      if (latestPlan) {
        setLatestPlan({ ...latestPlan, status: "applied", plan });
      }
      setFeedback({ tone: "ok", text: data.summary || "Plan applied and saved." });
      onPlanApplied?.({
        plan,
        summary: data.summary || "Applied",
        clientPlanPatch: data.clientPlanPatch,
        redirectUrl: data.redirectUrl,
      });
      router.refresh();
      if (data.redirectUrl) router.push(data.redirectUrl);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUpdatePlan(plan: AnyAiPlan) {
    if (!latestPlan) return;
    setActionBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_plan",
          module,
          planId: latestPlan.id,
          plan,
        }),
      });
      const data = (await res.json()) as { ok: boolean; version?: number; plan?: AnyAiPlan; error?: string };
      if (!res.ok || !data.ok) {
        setFeedback({ tone: "err", text: data.error || "Failed to update plan." });
        return;
      }
      const nextItem: SavedPlanItem = {
        ...latestPlan,
        title: data.plan?.title ?? plan.title,
        version: data.version ?? latestPlan.version + 1,
        plan: data.plan ?? plan,
      };
      setLatestPlan(nextItem);
      setFeedback({ tone: "ok", text: `Updated plan to v${nextItem.version}.` });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRestoreVersion(planId: string) {
    setActionBusy(true);
    try {
      const res = await fetch("/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_plan", planId }),
      });
      const data = (await res.json()) as { ok: boolean; planId?: string; version?: number; plan?: AnyAiPlan; message?: string };
      if (res.ok && data.ok && data.plan && data.planId) {
        const restored: SavedPlanItem = {
          id: data.planId,
          title: data.plan.title,
          version: data.version ?? 1,
          status: "draft",
          plan: data.plan,
        };
        setLatestPlan(restored);
        setPlanHistory((prev) => [restored, ...prev]);
        setShowVersions(false);
        setFeedback({ tone: "ok", text: data.message || "Restored version." });
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDeletePlan() {
    if (!latestPlan) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_plan", planId: latestPlan.id }),
      });
      if (res.ok) {
        const nextList = planHistory.filter((p) => p.id !== latestPlan.id);
        setPlanHistory(nextList);
        setLatestPlan(nextList[0] ?? null);
        setFeedback({ tone: "ok", text: "Plan deleted." });
      }
    } finally {
      setActionBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendPrompt(input);
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const activeChips = latestPlan?.status === "draft" ? [...meta.followUps, ...meta.prompts] : meta.prompts;

  return (
    <section className="rounded-3xl border border-acid/20 bg-[#101216] shadow-2xl overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#14171C]",
          compactHeader ? "px-4 py-3" : "px-5 py-4",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-acid/15 text-acid border border-acid/30">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold text-chalk sm:text-lg">{meta.title}</h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                  status === "online"
                    ? "bg-mint/15 text-mint"
                    : status === "offline"
                      ? "bg-flame/15 text-flame"
                      : "bg-white/10 text-mist",
                )}
              >
                {status === "online" ? <Wifi className="size-2.5" /> : <WifiOff className="size-2.5" />}
                {status} · {providerLabel}
              </span>
              {ctxBadge && (
                <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[9.5px] text-mist sm:inline-block">
                  {ctxBadge}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-mist">{meta.subtitle}</p>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          {open && planHistory.length > 1 && (
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-mist hover:text-chalk"
            >
              <History className="size-3.5" /> Versions ({planHistory.length})
            </button>
          )}
          {open && messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              title="New conversation"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-mist hover:text-chalk"
            >
              <MessageSquarePlus className="size-3.5" /> New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-acid px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110"
          >
            <Sparkles className="size-3.5" />
            {open ? "Minimize" : "Open AI Coach"}
            {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Workspace */}
      {open && (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12 sm:p-5">
          {showVersions && planHistory.length > 0 && (
            <div className="lg:col-span-12 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-panel p-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mist">Plan History:</span>
              {planHistory.slice(0, 6).map((ph) => (
                <button
                  key={ph.id}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleRestoreVersion(ph.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition",
                    ph.id === latestPlan?.id
                      ? "border-acid/50 bg-acid/15 text-acid font-semibold"
                      : "border-white/10 bg-white/[0.03] text-mist hover:text-chalk",
                  )}
                >
                  <RotateCcw className="size-3" /> v{ph.version} · {ph.title.slice(0, 26)} ({ph.status})
                </button>
              ))}
            </div>
          )}

          {/* Left: Streaming Chat */}
          <div className={cn("flex flex-col", latestPlan ? "lg:col-span-7" : "lg:col-span-12")}>
            <div
              ref={scrollRef}
              className="h-[340px] space-y-3 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#0B0D10] p-4"
            >
              {messages.length === 0 && !isStreaming && (
                <div className="flex h-full flex-col items-center justify-center text-center px-4">
                  <Sparkles className="size-6 text-acid mb-2" />
                  <p className="text-sm font-semibold text-chalk">{meta.title}</p>
                  <p className="mt-1 max-w-md text-xs text-mist">
                    Ask a question or tap a quick command below to generate an executable, structured plan synced to your live Forge data.
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                      m.role === "user"
                        ? "rounded-tr-sm bg-acid text-ink font-medium"
                        : "rounded-tl-sm border border-white/[0.07] bg-[#181B21] text-chalk/95",
                    )}
                  >
                    {m.role === "assistant" ? <RichAiMarkdown content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 px-1">
                    <span className="font-mono text-[9.5px] text-dim" suppressHydrationWarning>
                      {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    {m.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(m.content);
                          setCopiedId(m.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="inline-flex items-center gap-1 font-mono text-[9.5px] text-dim hover:text-chalk"
                      >
                        {copiedId === m.id ? <Check className="size-2.5 text-mint" /> : <Copy className="size-2.5" />}
                        {copiedId === m.id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-acid/25 bg-[#181B21] px-3.5 py-2.5 text-[13px] leading-relaxed text-chalk">
                    {streamingText ? (
                      <RichAiMarkdown content={streamingText} />
                    ) : (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-acid [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-acid [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-acid" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Prompts & Follow-ups */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {activeChips.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => void sendPrompt(p)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-mist transition hover:border-acid/45 hover:text-acid disabled:opacity-40"
                >
                  {p}
                </button>
              ))}
            </div>

            {telemetry && (
              <p className="mt-1 px-1 font-mono text-[9.5px] text-dim">{telemetry}</p>
            )}

            {/* Feedback Banner */}
            {feedback && (
              <div
                className={cn(
                  "mt-2 flex items-center justify-between rounded-xl border px-3 py-2 text-xs",
                  feedback.tone === "ok"
                    ? "border-mint/30 bg-mint/10 text-mint"
                    : "border-flame/30 bg-flame/10 text-flame",
                )}
              >
                <span>{feedback.text}</span>
                <button type="button" onClick={() => setFeedback(null)} className="text-[10px] underline">
                  Dismiss
                </button>
              </div>
            )}

            {/* Composer */}
            <form onSubmit={handleSubmit} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${meta.title}...`}
                className="h-10 flex-1 rounded-full border border-white/12 bg-[#0B0D10] px-4 text-xs text-chalk placeholder:text-dim focus:border-acid/50 focus:outline-none"
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-flame/20 px-4 text-xs font-semibold text-flame hover:bg-flame/30"
                >
                  <Square className="size-3 fill-current" /> Stop
                </button>
              ) : (
                <>
                  {lastUserMsg && (
                    <button
                      type="button"
                      onClick={() => void sendPrompt(lastUserMsg.content, true)}
                      title="Regenerate last response"
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-mist hover:text-chalk"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send message"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-acid text-ink transition hover:brightness-110 disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Right: Structured Generated Plan Panel */}
          {latestPlan && (
            <div className="lg:col-span-5">
              <AiPlanPanel
                module={module}
                planId={latestPlan.id}
                version={latestPlan.version}
                status={latestPlan.status}
                plan={latestPlan.plan}
                busy={actionBusy}
                onApply={handleApplyPlan}
                onUpdate={handleUpdatePlan}
                onRegenerate={() => {
                  if (lastUserMsg) void sendPrompt(lastUserMsg.content, true);
                  else void sendPrompt(meta.prompts[0]);
                }}
                onDelete={handleDeletePlan}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
