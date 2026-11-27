"use client";

import { useState } from "react";
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, Dumbbell,
  Flame, Loader2, Pencil, RefreshCw, Sparkles, Trash2, Utensils, Zap,
} from "lucide-react";
import type { AiModule, AnyAiPlan } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";
import { ExerciseMotionDemo } from "@/components/exercise-motion";

interface AiPlanPanelProps {
  module: AiModule;
  planId: string | null;
  version: number;
  status: "draft" | "applied" | "archived";
  plan: AnyAiPlan;
  busy: boolean;
  onApply: (plan: AnyAiPlan, applyCrossSync: boolean) => Promise<void>;
  onUpdate: (plan: AnyAiPlan) => Promise<void>;
  onRegenerate: () => void;
  onDelete?: () => Promise<void>;
}

export function AiPlanPanel({
  planId,
  version,
  status,
  plan,
  busy,
  onApply,
  onUpdate,
  onRegenerate,
  onDelete,
}: AiPlanPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applyCrossSync, setApplyCrossSync] = useState(false);
  const [draftTitle, setDraftTitle] = useState(plan.title);
  const [nutritionCalories, setNutritionCalories] = useState(
    plan.kind === "nutrition" ? String(plan.dailyTargets.calories) : "",
  );
  const [nutritionProtein, setNutritionProtein] = useState(
    plan.kind === "nutrition" ? String(plan.dailyTargets.protein) : "",
  );

  async function saveEdits() {
    let nextPlan: AnyAiPlan = { ...plan, title: draftTitle.trim() || plan.title };
    if (nextPlan.kind === "nutrition") {
      nextPlan = {
        ...nextPlan,
        dailyTargets: {
          ...nextPlan.dailyTargets,
          calories: Math.max(1200, Math.round(Number(nutritionCalories) || nextPlan.dailyTargets.calories)),
          protein: Math.max(40, Math.round(Number(nutritionProtein) || nextPlan.dailyTargets.protein)),
        },
      };
    }
    await onUpdate(nextPlan);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-acid/25 bg-[#16181D] p-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-acid/15 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-acid">
              <Sparkles className="size-2.5" /> AI {plan.kind} Plan · v{version}
            </span>
            {status === "applied" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-mint">
                <CheckCircle2 className="size-2.5" /> Applied
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="h-9 w-full rounded-xl border border-white/15 bg-panel px-3 text-sm font-semibold text-chalk focus:border-acid focus:outline-none"
              />
              {plan.kind === "nutrition" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-mist">
                    Calories (kcal)
                    <input
                      type="number"
                      value={nutritionCalories}
                      onChange={(e) => setNutritionCalories(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-white/15 bg-panel px-2 font-numeric text-xs text-chalk"
                    />
                  </label>
                  <label className="text-[11px] text-mist">
                    Protein (g)
                    <input
                      type="number"
                      value={nutritionProtein}
                      onChange={(e) => setNutritionProtein(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-white/15 bg-panel px-2 font-numeric text-xs text-chalk"
                    />
                  </label>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveEdits}
                  className="rounded-full bg-acid px-3 py-1 text-xs font-semibold text-ink"
                >
                  Save edits
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-mist"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <h4 className="mt-1 font-display text-[17px] font-bold leading-snug text-chalk">{plan.title}</h4>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-mist hover:text-chalk"
        >
          {expanded ? "Collapse" : "Preview Plan"}
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/[0.07] pt-3 text-xs">
          {"summary" in plan && <p className="leading-relaxed text-mist">{plan.summary}</p>}

          {/* SCHEDULE & WARM-UP */}
          {plan.kind === "schedule" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-wider text-amber">
                  Dynamic Warm-Up ({plan.warmup.length} drills)
                </p>
                <div className="space-y-1">
                  {plan.warmup.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="text-chalk">{w.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-dim">{w.reps} · {w.durationSec}s</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {plan.days.map((d) => (
                  <div
                    key={d.weekday}
                    className={cn(
                      "rounded-xl border px-3 py-2",
                      d.isRest ? "border-white/[0.05] bg-white/[0.015] text-dim" : "border-white/[0.08] bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-chalk">
                        {d.dayLabel}: <span className={d.isRest ? "text-mist font-normal" : "text-acid"}>{d.routineName}</span>
                      </span>
                      <span className="font-mono text-[10px] text-dim">{d.durationMin} min · {d.intensity}</span>
                    </div>
                    {!d.isRest && d.exercises.length > 0 && (
                      <p className="mt-1 truncate font-mono text-[10px] text-mist">
                        {d.exercises.map((e) => `${e.name} (${e.sets}×${e.repsMin}-${e.repsMax})`).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {plan.rebalanceNote && (
                <p className="rounded-xl border border-sky/20 bg-sky/10 px-3 py-2 text-[11px] text-sky">{plan.rebalanceNote}</p>
              )}
            </div>
          )}

          {/* WORKOUT */}
          {plan.kind === "workout" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-chalk">{plan.durationMin} min</span>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-acid">{plan.intensity}</span>
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-mint">{plan.environment}</span>
              </div>
              <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02]">
                {plan.exercises.map((ex, i) => (
                  <div key={`${ex.exerciseId}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-chalk">{ex.name}</p>
                      <p className="font-mono text-[10px] text-dim">
                        {ex.sets} × {ex.repsMin}–{ex.repsMax} · Rest {ex.restSec}s · Tempo {ex.tempo}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-acid/15 px-2 py-0.5 font-numeric text-[11px] font-semibold text-acid">
                      {ex.suggestedWeightKg > 0 ? `${ex.suggestedWeightKg} kg` : "BW"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-mist"><strong className="text-chalk">Progression:</strong> {plan.progressiveOverloadRule}</p>
            </div>
          )}

          {/* EXERCISE GUIDE */}
          {plan.kind === "exercise" && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                <ExerciseMotionDemo
                  openGymId={plan.openGymId}
                  pattern="horizontal_push"
                  equipment={plan.equipment}
                  primaryMuscle={plan.primaryMuscle}
                  secondaryMuscles={plan.secondaryMuscles}
                  name={plan.exerciseName}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-chalk">{plan.exerciseName}</p>
                  <p className="font-mono text-[10px] text-mist">
                    {plan.prescription.sets} sets × {plan.prescription.reps} · Tempo {plan.prescription.tempo} · Rest {plan.prescription.restSec}s
                  </p>
                </div>
              </div>
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-acid">Step-by-Step Mechanics</p>
                <ol className="mt-1 space-y-1 pl-4 list-decimal text-[11.5px] text-mist">
                  {plan.movementSteps.map((s, idx) => <li key={idx}>{s}</li>)}
                </ol>
              </div>
              <p className="text-[11px] text-mist"><strong className="text-chalk">Breathing:</strong> {plan.breathingCues}</p>
              {plan.alternatives.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {plan.alternatives.map((a) => (
                    <span key={a.exerciseId} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10.5px] text-chalk">
                      Alt: {a.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STATUS & BODY */}
          {plan.kind === "body" && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                {plan.recordedMetrics.map((rm) => (
                  <div key={rm.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                    <p className="font-mono text-[9.5px] uppercase text-dim">{rm.label}</p>
                    <p className={cn("mt-0.5 font-numeric text-sm font-semibold", rm.recorded ? "text-chalk" : "text-dim")}>
                      {rm.value}
                    </p>
                    {rm.trend && <p className="mt-0.5 text-[10px] text-acid">{rm.trend}</p>}
                  </div>
                ))}
              </div>
              {plan.missingMeasurements.length > 0 && (
                <p className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2 text-[11px] text-amber">
                  Not recorded yet: {plan.missingMeasurements.join(", ")}
                </p>
              )}
              <ul className="space-y-1 pl-4 list-disc text-[11.5px] text-mist">
                {plan.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            </div>
          )}

          {/* NUTRITION */}
          {plan.kind === "nutrition" && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { l: "kcal", v: plan.dailyTargets.calories, c: "text-acid" },
                  { l: "Protein", v: `${plan.dailyTargets.protein}g`, c: "text-sky" },
                  { l: "Carbs", v: `${plan.dailyTargets.carbs}g`, c: "text-amber" },
                  { l: "Fat", v: `${plan.dailyTargets.fat}g`, c: "text-grape" },
                ].map((m) => (
                  <div key={m.l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
                    <p className={cn("font-display text-sm font-bold", m.c)}>{m.v}</p>
                    <p className="font-mono text-[9px] uppercase text-dim">{m.l}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {plan.meals.map((slot) => (
                  <div key={slot.slot} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-mint">{slot.label}</p>
                    {slot.items.map((it, idx) => (
                      <div key={idx} className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="truncate text-chalk">{it.name} <span className="text-dim">({it.serving})</span></span>
                        <span className="shrink-0 font-mono text-[10px] text-mist">{it.calories} kcal · {it.protein}g P</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[10px] italic text-dim">{plan.disclaimer}</p>
            </div>
          )}

          {/* Cross-Section Sync Opt-In */}
          {plan.crossSync && (
            <label className="flex items-start gap-2.5 rounded-xl border border-sky/25 bg-sky/[0.07] p-3 text-[11.5px] text-chalk cursor-pointer">
              <input
                type="checkbox"
                checked={applyCrossSync}
                onChange={(e) => setApplyCrossSync(e.target.checked)}
                className="mt-0.5 size-4 accent-[#C9F73A]"
              />
              <div>
                <p className="font-semibold text-sky">Cross-Section Sync Proposal</p>
                <p className="mt-0.5 text-mist">{plan.crossSync.summary}</p>
              </div>
            </label>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(plan, applyCrossSync)}
          className="inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          {status === "applied" ? "Re-Apply Plan" : "Apply Plan"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-chalk hover:border-white/25"
        >
          <Pencil className="size-3" /> Edit Plan
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onRegenerate}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-mist hover:text-chalk"
        >
          <RefreshCw className="size-3" /> Regenerate
        </button>

        {planId && onDelete && (
          confirmDelete ? (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] text-amber"><AlertTriangle className="size-3" /> Confirm?</span>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await onDelete();
                  setConfirmDelete(false);
                }}
                className="rounded-full bg-flame px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-mist"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete plan"
              className="ml-auto grid size-8 place-items-center rounded-full border border-white/10 text-dim hover:border-flame/40 hover:text-flame"
            >
              <Trash2 className="size-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
