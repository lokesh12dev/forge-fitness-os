"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, RefreshCw, Sparkles, X } from "lucide-react";
import type { SyncProposalItem } from "@/lib/ai/sync";
import { cn } from "@/lib/utils";

export function SyncInbox() {
  const router = useRouter();
  const [proposals, setProposals] = useState<SyncProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/sync?status=pending", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { proposals?: SyncProposalItem[] };
        setProposals(data.proposals ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, resolution: "accept" | "dismiss" | "snooze") {
    setBusyId(id);
    setFeedback(null);
    try {
      const res = await fetch("/api/ai/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", proposalId: id, resolution }),
      });
      if (res.ok) {
        setProposals((prev) => prev.filter((p) => p.id !== id));
        setFeedback(
          resolution === "accept"
            ? "Sync proposal applied."
            : resolution === "snooze"
              ? "Proposal snoozed."
              : "Proposal dismissed.",
        );
        if (resolution === "accept") router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#101216] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-acid/15 text-acid border border-acid/30">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold text-chalk">Cross-Section Sync Inbox</h3>
            <p className="text-[11px] text-mist">
              Pending proposals across Schedule, Workout, Body & Nutrition — nothing changes until you approve.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-mist hover:text-chalk"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {feedback && (
        <p className="mt-3 rounded-xl border border-mint/25 bg-mint/10 px-3 py-1.5 text-xs text-mint">
          {feedback}
        </p>
      )}

      {!loading && proposals.length === 0 && (
        <p className="mt-3 text-xs text-dim">
          No pending cross-section sync proposals. Changes you make in one module will appear here when they affect another.
        </p>
      )}

      {proposals.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {proposals.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-panel p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-mist">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{p.originModule}</span>
                  <ArrowRight className="size-3 text-acid" />
                  <span className="rounded-full bg-acid/15 px-2 py-0.5 text-acid">{p.targetModule}</span>
                  <span className="text-dim">· {p.triggerType.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-chalk">{p.title}</p>
                <p className="mt-0.5 text-[11px] text-mist">{p.rationale}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void resolve(p.id, "accept")}
                  className="inline-flex items-center gap-1 rounded-full bg-acid px-3 py-1 text-[11px] font-semibold text-ink hover:brightness-110 disabled:opacity-50"
                >
                  <Check className="size-3" /> Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void resolve(p.id, "snooze")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-mist hover:text-chalk"
                >
                  <Clock className="size-3" /> Snooze
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void resolve(p.id, "dismiss")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-mist hover:text-flame"
                >
                  <X className="size-3" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
