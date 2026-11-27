"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive, Calendar, Check, CheckCircle2, Copy, Flame, History, Loader2,
  Plus, RotateCcw, Search, Sparkles, Target, Trash2, TrendingUp, Zap,
} from "lucide-react";
import type { CoachRecommendation, DailyBriefing, WeeklyReport } from "@/lib/ai/briefing";
import type { AnyAiPlan } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

interface GoalRow {
  id: string;
  title: string;
  metric: string;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  deadline: string | null;
  status: "active" | "completed" | "paused";
  milestones: string[];
}

interface LibraryPlanRow {
  id: string;
  module: string;
  title: string;
  version: number;
  provider: string;
  status: "draft" | "applied" | "archived";
  plan: AnyAiPlan;
  createdAt: number;
}

export function AiHubPanels() {
  const [tab, setTab] = useState<"briefing" | "goals" | "library">("briefing");
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [recs, setRecs] = useState<CoachRecommendation[]>([]);
  const [providerLabel, setProviderLabel] = useState("Forge Deterministic Engine");

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: "",
    metric: "weight_kg",
    startValue: "80",
    currentValue: "80",
    targetValue: "76",
    unit: "kg",
    deadline: "",
  });

  const [plans, setPlans] = useState<LibraryPlanRow[]>([]);
  const [libModule, setLibModule] = useState("all");
  const [libStatus, setLibStatus] = useState("all");
  const [libQuery, setLibQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, gRes, pRes] = await Promise.all([
        fetch("/api/ai/briefing", { cache: "no-store" }),
        fetch("/api/ai/goals", { cache: "no-store" }),
        fetch("/api/ai/plans", { cache: "no-store" }),
      ]);
      if (bRes.ok) {
        const bData = await bRes.json();
        setBriefing(bData.briefing);
        setWeekly(bData.weeklyReport);
        setRecs(bData.recommendations ?? []);
        const active = bData.providerHealth?.providers?.find(
          (p: { name: string }) => p.name === bData.providerHealth?.activeProvider,
        );
        if (active) setProviderLabel(active.label);
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        setGoals(gData.goals ?? []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(pData.plans ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((c) => (c === msg ? null : c)), 3000);
  }

  async function handleCreateGoal(e: FormEvent) {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    setBusyId("new-goal");
    try {
      const res = await fetch("/api/ai/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goalForm.title.trim(),
          metric: goalForm.metric,
          startValue: Number(goalForm.startValue) || 0,
          currentValue: Number(goalForm.currentValue) || 0,
          targetValue: Number(goalForm.targetValue) || 0,
          unit: goalForm.unit.trim() || "kg",
          deadline: goalForm.deadline || undefined,
        }),
      });
      if (res.ok) {
        setGoalForm({ title: "", metric: "weight_kg", startValue: "80", currentValue: "80", targetValue: "76", unit: "kg", deadline: "" });
        setShowGoalForm(false);
        flash("Goal created.");
        await loadAll();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleGoalProgress(goal: GoalRow, delta: number) {
    setBusyId(goal.id);
    try {
      const next = Math.round((goal.currentValue + delta) * 10) / 10;
      const res = await fetch("/api/ai/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, currentValue: next }),
      });
      if (res.ok) await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteGoal(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ai/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handlePlanAction(action: "restore_plan" | "duplicate_plan" | "archive_plan" | "delete_plan", planId: string) {
    setBusyId(planId);
    try {
      const res = await fetch("/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, planId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        flash(data.message || `Updated plan (${action.replace("_plan", "")}).`);
        await loadAll();
      }
    } finally {
      setBusyId(null);
    }
  }

  const filteredPlans = plans.filter((p) => {
    if (libModule !== "all" && p.module !== libModule) return false;
    if (libStatus !== "all" && p.status !== libStatus) return false;
    if (libQuery.trim() && !p.title.toLowerCase().includes(libQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mt-6 space-y-4 rounded-3xl border border-white/[0.08] bg-[#101216] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-acid" />
            <h2 className="font-display text-xl font-bold text-chalk">Forge Intelligence Hub</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[9.5px] text-mint">
              {providerLabel}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-mist">
            Daily Briefing, Weekly Performance Report, Fitness Goal Manager &amp; Central AI Plan Library.
          </p>
        </div>

        <div className="flex rounded-xl border border-white/10 bg-panel p-1">
          {[
            { id: "briefing" as const, label: "Briefing & Report" },
            { id: "goals" as const, label: `Goals (${goals.length})` },
            { id: "library" as const, label: `Plan Library (${plans.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                tab === t.id ? "bg-acid text-ink" : "text-mist hover:text-chalk",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-xs text-mint">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-mist">
          <Loader2 className="mr-2 size-4 animate-spin text-acid" /> Loading Forge Intelligence...
        </div>
      ) : tab === "briefing" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* 8.1 Daily Briefing */}
          {briefing && (
            <div className="rounded-2xl border border-white/[0.08] bg-panel p-4 lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-acid">AI Daily Briefing</span>
                <span className="font-mono text-[10px] text-dim">{briefing.dateLabel}</span>
              </div>
              <p className="text-sm font-semibold text-chalk">{briefing.greeting}</p>
              <div className="space-y-2 text-xs text-mist">
                <p><strong className="text-chalk">Today&apos;s Workout:</strong> {briefing.todaysWorkout}</p>
                <p><strong className="text-chalk">Warm-Up:</strong> {briefing.warmupFocus}</p>
                <p><strong className="text-chalk">Recovery:</strong> {briefing.recoveryNote}</p>
                <p><strong className="text-chalk">Nutrition:</strong> {briefing.nutritionFocus}</p>
              </div>
              {briefing.outstandingActions.length > 0 && (
                <div className="border-t border-white/[0.06] pt-2.5">
                  <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-wider text-amber">Actionable Today</p>
                  <ul className="space-y-1 text-xs text-chalk/90">
                    {briefing.outstandingActions.map((a, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Zap className="size-3 shrink-0 text-acid" /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 8.2 Weekly Report */}
          {weekly && (
            <div className="rounded-2xl border border-white/[0.08] bg-panel p-4 lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-sky">AI Weekly Report</span>
                <span className="font-mono text-[10px] text-mint">{weekly.consistencyPct}% adherence</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.03] p-2.5">
                  <p className="font-display text-lg font-bold text-chalk">{weekly.workoutsCompleted}/{weekly.workoutsPlanned}</p>
                  <p className="font-mono text-[9px] uppercase text-dim">Sessions</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-2.5">
                  <p className="font-display text-lg font-bold text-acid">{weekly.consistencyPct}%</p>
                  <p className="font-mono text-[9px] uppercase text-dim">Consistency</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-2.5">
                  <p className="font-display text-lg font-bold text-chalk">{weekly.totalVolumeKg.toLocaleString("en-US")}</p>
                  <p className="font-mono text-[9px] uppercase text-dim">Vol (kg)</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-mist">
                <p><strong className="text-chalk">Nutrition:</strong> {weekly.nutritionAdherenceNote}</p>
                <p><strong className="text-chalk">Recovery:</strong> {weekly.recoveryTrendNote}</p>
                {weekly.strengthHighlights.length > 0 && (
                  <p><strong className="text-chalk">Top Lifts:</strong> {weekly.strengthHighlights.join(" · ")}</p>
                )}
              </div>
              <div className="border-t border-white/[0.06] pt-2.5">
                <p className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-mint">Next Steps</p>
                <ul className="space-y-1 text-xs text-mist">
                  {weekly.nextWeekFocus.map((f, i) => <li key={i}>• {f}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* 8.4 Contextual Coach Recommendations */}
          {recs.length > 0 && (
            <div className="lg:col-span-12">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-mist">
                Contextual Coach Recommendations (Grounded in Live Data)
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {recs.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-white/[0.08] bg-panel p-3.5">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-acid">{r.module}</span>
                    <p className="mt-1 text-xs font-semibold text-chalk">{r.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-mist">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : tab === "goals" ? (
        /* 8.3 AI Fitness Goal Manager */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-mist">Track measurable targets with automatic 25/50/75/100% milestones.</p>
            <button
              type="button"
              onClick={() => setShowGoalForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-acid px-3 py-1.5 text-xs font-semibold text-ink"
            >
              <Plus className="size-3.5" /> New Goal
            </button>
          </div>

          {showGoalForm && (
            <form onSubmit={handleCreateGoal} className="grid grid-cols-2 gap-2.5 rounded-2xl border border-acid/25 bg-panel p-4 sm:grid-cols-6">
              <input
                required
                placeholder="Goal title (e.g. Reach 110kg Bench)"
                value={goalForm.title}
                onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))}
                className="col-span-2 h-9 rounded-xl border border-white/10 bg-[#0B0D10] px-3 text-xs text-chalk sm:col-span-3"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Start"
                value={goalForm.startValue}
                onChange={(e) => setGoalForm((p) => ({ ...p, startValue: e.target.value, currentValue: e.target.value }))}
                className="h-9 rounded-xl border border-white/10 bg-[#0B0D10] px-3 text-xs text-chalk"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Target"
                value={goalForm.targetValue}
                onChange={(e) => setGoalForm((p) => ({ ...p, targetValue: e.target.value }))}
                className="h-9 rounded-xl border border-white/10 bg-[#0B0D10] px-3 text-xs text-chalk"
              />
              <button
                type="submit"
                disabled={busyId === "new-goal"}
                className="h-9 rounded-xl bg-acid px-3 text-xs font-semibold text-ink"
              >
                Save Goal
              </button>
            </form>
          )}

          {goals.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-panel p-8 text-center text-xs text-mist">
              No active AI goals yet. Click <strong>New Goal</strong> to set a target weight, lift, or weekly consistency goal.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {goals.map((g) => {
                const denom = Math.abs(g.targetValue - g.startValue) || 1;
                const numer = Math.abs(g.currentValue - g.startValue);
                const pct = Math.min(100, Math.max(0, Math.round((numer / denom) * 100)));
                return (
                  <div key={g.id} className="rounded-2xl border border-white/[0.08] bg-panel p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={cn("font-mono text-[9px] uppercase tracking-wider", g.status === "completed" ? "text-mint" : "text-acid")}>
                          {g.status}
                        </span>
                        <h4 className="text-sm font-semibold text-chalk">{g.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        className="text-dim hover:text-flame"
                        aria-label="Delete goal"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-mist">
                      <span>Current: <strong className="text-chalk">{g.currentValue} {g.unit}</strong></span>
                      <span>Target: <strong className="text-acid">{g.targetValue} {g.unit}</strong> ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-acid transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[9.5px] text-dim">{g.milestones[1] ?? ""}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === g.id}
                          onClick={() => handleGoalProgress(g, g.targetValue >= g.startValue ? 0.5 : -0.5)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10.5px] text-chalk hover:border-acid/40"
                        >
                          Update progress
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 8.5 Central AI Plan Library */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
              <input
                value={libQuery}
                onChange={(e) => setLibQuery(e.target.value)}
                placeholder="Search saved AI plans..."
                className="h-9 w-full rounded-xl border border-white/10 bg-panel pl-8 pr-3 text-xs text-chalk"
              />
            </div>
            <select
              value={libModule}
              onChange={(e) => setLibModule(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="all">All Modules</option>
              <option value="schedule">Schedule</option>
              <option value="workout">Workout</option>
              <option value="exercise">Exercise</option>
              <option value="body">Body</option>
              <option value="nutrition">Nutrition</option>
            </select>
            <select
              value={libStatus}
              onChange={(e) => setLibStatus(e.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-panel px-2.5 text-xs text-chalk"
            >
              <option value="all">All Statuses</option>
              <option value="applied">Applied</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-panel p-8 text-center text-xs text-mist">
              No AI plans match the current filter. Open any module AI Coach to generate a plan.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlans.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-panel p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-acid/15 px-2 py-0.5 font-mono text-[9px] uppercase text-acid">{p.module}</span>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] text-mist">v{p.version}</span>
                      <span className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase", p.status === "applied" ? "bg-mint/15 text-mint" : "bg-white/10 text-dim")}>
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-chalk">{p.title}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => handlePlanAction("restore_plan", p.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-chalk hover:border-acid/40"
                    >
                      <RotateCcw className="size-3" /> Restore
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => handlePlanAction("duplicate_plan", p.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-mist hover:text-chalk"
                    >
                      <Copy className="size-3" /> Duplicate
                    </button>
                    {p.status !== "archived" && (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => handlePlanAction("archive_plan", p.id)}
                        className="grid size-7 place-items-center rounded-full border border-white/10 text-dim hover:text-amber"
                        title="Archive plan"
                      >
                        <Archive className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
