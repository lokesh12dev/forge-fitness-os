"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, Brain, Dumbbell, Flame, Loader2, Sparkles, Utensils, Zap,
} from "lucide-react";
import { sendCoachMessage } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: number;
};

const QUICK_PROMPTS = [
  { label: "Analyze bench stall", icon: Zap },
  { label: "Structure a deload", icon: Flame },
  { label: "Gym is crowded", icon: Dumbbell },
  { label: "Missed my last workout", icon: Sparkles },
  { label: "I only have 25 minutes", icon: Zap },
  { label: "Hit my remaining protein", icon: Utensils },
  { label: "How's my recovery today?", icon: Flame },
] as const;

function Inline({ text }: { text: string }) {
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

function RichText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 pl-1">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-acid/70" />
            <span><Inline text={item} /></span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (numbered) {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-1 leading-relaxed">
          <span className="mr-1.5 font-mono text-[9px] text-acid">{numbered[1]}.</span>
          <Inline text={numbered[2]} />
        </p>,
      );
    } else if (bullet) {
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-1 leading-relaxed first:mt-0 last:mb-0">
          <Inline text={line} />
        </p>,
      );
    }
  }
  flush();

  return <div className="text-[12px] leading-relaxed text-mist">{blocks}</div>;
}

export function CoachChat({
  initialMessages,
  user,
}: {
  initialMessages: ChatMessage[];
  user: { name: string; initials: string; accent: string };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const signature = initialMessages.map((m) => m.id).join("|");

  useEffect(() => {
    // The server refresh delivers the persisted pair; drop optimistic placeholders.
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: localId, role: "user", content: value, createdAt: Date.now() },
    ]);
    setInput("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("content", value);
      await sendCoachMessage(fd);
      router.refresh();
    } finally {
      setBusy(false);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="surface flex h-[min(72vh,720px)] min-h-[480px] flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar initials="FX" accent="#C9F73A" size={34} />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-panel bg-acid" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-chalk">Forge Coach</p>
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-acid">Online · sees your data</p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-dim sm:flex">
          <Brain className="size-2.5 text-grape" /> Adaptive engine v4
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        <div className="flex justify-center">
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">
            Today · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </span>
        </div>

        {messages.map((m) => {
          const isCoach = m.role === "coach";
          return (
            <div key={m.id} className={cn("flex items-start gap-2.5", !isCoach && "flex-row-reverse")}>
              {isCoach ? (
                <Avatar initials="FX" accent="#C9F73A" size={28} />
              ) : (
                <Avatar initials={user.initials} accent={user.accent} size={28} />
              )}
              <div className={cn("max-w-[84%] sm:max-w-[76%]", !isCoach && "text-right")}>
                <div className="mb-1 flex items-center gap-2 text-[8px] font-mono uppercase tracking-[0.1em] text-dim">
                  <span className={isCoach ? "text-acid/80" : "text-mist"}>{isCoach ? "Coach" : user.name.split(" ")[0]}</span>
                  <span>{new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <div
                  className={cn(
                    "inline-block rounded-2xl border px-3.5 py-3 text-left",
                    isCoach
                      ? "rounded-tl-md border-acid/15 bg-acid/[0.045]"
                      : "rounded-tr-md border-white/[0.08] bg-white/[0.05]",
                  )}
                >
                  {isCoach ? (
                    <RichText content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-chalk/90">{m.content}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-start gap-2.5">
            <Avatar initials="FX" accent="#C9F73A" size={28} />
            <div className="rounded-2xl rounded-tl-md border border-acid/15 bg-acid/[0.045] px-4 py-3">
              <span className="flex items-center gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-acid/70 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-acid/70 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-acid/70" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] bg-black/20 px-3.5 pb-3.5 pt-3">
        <div className="mb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                onClick={() => void send(p.label)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-mist transition-colors hover:border-acid/30 hover:text-acid disabled:opacity-40"
              >
                <Icon className="size-2.5" /> {p.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 focus-within:border-acid/35">
            <Sparkles className="mb-1.5 size-3.5 shrink-0 text-acid/70" />
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={600}
              placeholder="Ask about a lift, your recovery, or say “I only have 25 minutes”…"
              className="max-h-28 min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-[12px] leading-relaxed text-chalk placeholder:text-dim focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-acid text-ink transition-all hover:bg-acid-deep disabled:opacity-30"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
        <p className="mt-2 text-center font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
          Coach uses your readiness, recovery, PRs and nutrition · not medical advice
        </p>
      </div>
    </div>
  );
}
