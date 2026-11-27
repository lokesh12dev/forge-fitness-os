"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown, ArrowUp, BarChart3, Bookmark, Calendar, Check, ChevronDown, ChevronRight,
  Copy, Download, Dumbbell, Folder, Moon, Play, Plus, Printer, Repeat, Search, Share2,
  Sparkles, Star, Trash2, Undo2, Upload, X, Zap,
} from "lucide-react";
import { cn, titleCase } from "@/lib/utils";
import {
  BUILTIN_PROGRAMS,
  DEFAULT_PLAN_STATE,
  PLAN_STATE_STORAGE_KEY,
  applyBuiltinProgramToPlan,
  applyCuratedTemplateToPlan,
  getAllCuratedTemplates,
  loadPlanState,
  savePlanState,
  type PlanRoutine,
  type PlanScheduleState,
} from "@/lib/plan-store";
import {
  CATALOG_BY_ID,
  FULL_EXERCISE_CATALOG,
  computeRoutineMuscleLoad,
  type CuratedTemplateRoutine,
} from "@/lib/opengym-catalog";
import { startRoutineWorkout } from "@/app/actions";
import { DualMiniBodyMap, MUSCLE_METADATA } from "@/components/body-map";
import { ModuleAiCoach } from "@/components/ai/module-ai-coach";

const WEEK_ORDER = [
  { dow: 1, short: "Mo", full: "Monday" },
  { dow: 2, short: "Tu", full: "Tuesday" },
  { dow: 3, short: "We", full: "Wednesday" },
  { dow: 4, short: "Th", full: "Thursday" },
  { dow: 5, short: "Fr", full: "Friday" },
  { dow: 6, short: "Sa", full: "Saturday" },
  { dow: 0, short: "Su", full: "Sunday" },
];

export function PlansOsClient({
  slugToId,
  activeWorkoutId,
  weeklySetsCount,
}: {
  slugToId: [string, string][];
  activeWorkoutId: string | null;
  weeklySetsCount: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [tab, setTab] = useState<"schedule" | "routines" | "programmes">("schedule");
  const [plan, setPlan] = useState<PlanScheduleState>(DEFAULT_PLAN_STATE);
  const [todayDow, setTodayDow] = useState(1);

  // Editors & modals
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingLoop, setEditingLoop] = useState(false);
  const [editingRoutines, setEditingRoutines] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [addingExerciseToRoutine, setAddingExerciseToRoutine] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState("");
  const [addingToLoopOpen, setAddingToLoopOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [undoSnap, setUndoSnap] = useState<{ label: string; state: PlanScheduleState } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setPlan(loadPlanState());
    setTodayDow(new Date().getDay());
  }, []);

  const slugMap = useMemo(() => new Map(slugToId), [slugToId]);
  const allTemplates = useMemo(() => getAllCuratedTemplates(), []);

  const updatePlan = (updater: (prev: PlanScheduleState) => PlanScheduleState, undoLabel?: string) => {
    setPlan((prev) => {
      if (undoLabel) setUndoSnap({ label: undoLabel, state: prev });
      const next = updater(prev);
      savePlanState(next);
      return next;
    });
  };

  const flashToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2800);
  };

  const handleStartRoutine = (routines: PlanRoutine[]) => {
    if (activeWorkoutId) {
      router.push(`/app/train/${activeWorkoutId}`);
      return;
    }
    const slots = routines.flatMap((r) => r.slots);
    const title = routines.map((r) => r.name).join(" + ") || "Training Session";
    startTransition(async () => {
      const res = await startRoutineWorkout({
        name: title,
        focus: routines[0]?.folder ?? "Strength",
        routineId: routines[0]?.id,
        slots,
      });
      if (res.ok) router.push(`/app/train/${res.workoutId}`);
    });
  };

  const routineMap = useMemo(() => new Map(plan.routines.map((r) => [r.id, r])), [plan.routines]);

  const weekdaysForRoutine = (rid: string) =>
    WEEK_ORDER.filter((w) => (plan.week[w.dow] ?? []).includes(rid)).map((w) => w.short);

  const selectedRoutine = selectedRoutineId ? routineMap.get(selectedRoutineId) ?? null : null;

  const groupedRoutines = useMemo(() => {
    const favs = plan.routines.filter((r) => r.favourite);
    const nonFavs = plan.routines.filter((r) => !r.favourite);
    const byFolder = new Map<string, PlanRoutine[]>();
    for (const r of nonFavs) {
      const f = r.folder || "Custom Routines";
      const arr = byFolder.get(f) ?? [];
      arr.push(r);
      byFolder.set(f, arr);
    }
    return { favs, folders: [...byFolder.entries()] };
  }, [plan.routines]);

  const handleCreateRoutine = () => {
    const newR: PlanRoutine = {
      id: `rt-${Date.now().toString(36)}`,
      name: "New routine",
      folder: "Custom Routines",
      glyph: "barbell",
      color: "#C9F73A",
      favourite: false,
      progression: "double",
      slots: [
        { exerciseId: "ex-bench-press", sets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8, progression: "double" },
      ],
    };
    updatePlan((p) => ({ ...p, routines: [newR, ...p.routines] }));
    setTab("routines");
    setSelectedRoutineId(newR.id);
  };

  const handleExportPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forge-plan.json";
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(false);
    flashToast("Exported weekly plan JSON.");
  };

  const handleImportPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as PlanScheduleState;
      if (!Array.isArray(parsed.routines)) throw new Error("Invalid file");
      updatePlan(() => parsed, "Imported plan");
      setOpenMenu(false);
      flashToast(`Imported "${parsed.routines.length}" routines.`);
    } catch {
      flashToast("Could not read plan JSON file.");
    }
  };

  const pickerMatches = useMemo(() => {
    const ql = exQuery.trim().toLowerCase();
    const list = ql
      ? FULL_EXERCISE_CATALOG.filter(
          (e) =>
            e.name.toLowerCase().includes(ql) ||
            e.primaryMuscle.toLowerCase().includes(ql) ||
            e.equipment.toLowerCase().includes(ql),
        )
      : FULL_EXERCISE_CATALOG.slice(0, 60);
    return list.slice(0, 35);
  }, [exQuery]);

  const weeklyPlannedCount = useMemo(
    () => WEEK_ORDER.filter((d) => (plan.week[d.dow] ?? []).length > 0).length,
    [plan.week],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header matching openGym/#/plan */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight text-chalk">Plan</h1>
          <p className="mt-0.5 text-[14px] text-mist">
            {plan.scheduleMode === "rotation" ? "Your routines in a loop" : "Your weekly routine"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app/coach"
            className="press inline-flex items-center gap-1.5 rounded-full bg-acid/16 px-3.5 py-2 text-[13px] font-medium text-acid hover:bg-acid/24"
          >
            <Sparkles className="size-3.5" />
            Coach
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu((v) => !v)}
              aria-label="Plan options"
              className="press grid size-9 place-items-center rounded-full bg-panel-2 text-chalk hover:bg-panel-3"
            >
              <Share2 className="size-4" />
            </button>
            {openMenu && (
              <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-2xl border border-white/12 bg-panel-2 p-1 shadow-2xl">
                <button type="button" onClick={handleExportPlan} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-chalk hover:bg-white/[0.06]">
                  <Download className="size-4 text-mist" /> Export plan JSON
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-chalk hover:bg-white/[0.06]">
                  <Upload className="size-4 text-mist" /> Import plan JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(false);
                    window.print();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-chalk hover:bg-white/[0.06]"
                >
                  <Printer className="size-4 text-mist" /> Print / Save PDF
                </button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportPlan} />
        </div>
      </div>

      <ModuleAiCoach
        module="schedule"
        hints={{ currentScheduleMode: plan.scheduleMode }}
        onPlanApplied={({ clientPlanPatch, summary }) => {
          if (clientPlanPatch && typeof clientPlanPatch === "object") {
            const patch = clientPlanPatch as Partial<PlanScheduleState>;
            updatePlan((prev) => ({
              ...prev,
              activeProgrammeId: patch.activeProgrammeId ?? prev.activeProgrammeId,
              scheduleMode: patch.scheduleMode ?? prev.scheduleMode,
              week: patch.week ?? prev.week,
              rotation: patch.rotation ?? prev.rotation,
              routines: [
                ...(patch.routines ?? []),
                ...prev.routines.filter((r) => !(patch.routines ?? []).some((nr) => nr.id === r.id)),
              ],
            }));
          }
          flashToast(summary);
        }}
      />

      {/* Top Segmented Control: Schedule | Routines | Programmes */}
      <div className="grid grid-cols-3 rounded-2xl bg-panel p-1 border border-white/[0.06]">
        {[
          { key: "schedule", label: "Schedule" },
          { key: "routines", label: `Routines (${plan.routines.length})` },
          { key: "programmes", label: "Programmes" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={cn(
              "press rounded-xl py-2 text-[13.5px] font-medium transition-colors",
              tab === item.key ? "bg-panel-3 text-chalk shadow-sm" : "text-mist hover:text-chalk",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ═════════════ TAB 1: SCHEDULE (openGym/#/plan) ═════════════ */}
      {tab === "schedule" && (
        <div className="space-y-4">
          {/* How you train card */}
          <div className="rounded-[20px] border border-white/[0.07] bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-flame text-ink">
                  <Repeat className="size-4.5" />
                </span>
                <div>
                  <p className="text-[15px] font-medium text-chalk">How you train</p>
                  <p className="text-[12.5px] text-mist">
                    {plan.scheduleMode === "rotation"
                      ? "Whatever is next stays next until you train it."
                      : "The same routines on the same weekdays, every week."}
                  </p>
                </div>
              </div>

              <div className="inline-flex rounded-xl bg-panel-2 p-1">
                <button
                  type="button"
                  onClick={() => updatePlan((p) => ({ ...p, scheduleMode: "week" }))}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    plan.scheduleMode === "week" ? "bg-panel-3 text-chalk" : "text-mist hover:text-chalk",
                  )}
                >
                  Fixed Week
                </button>
                <button
                  type="button"
                  onClick={() => updatePlan((p) => ({ ...p, scheduleMode: "rotation" }))}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    plan.scheduleMode === "rotation" ? "bg-panel-3 text-chalk" : "text-mist hover:text-chalk",
                  )}
                >
                  Rotation
                </button>
              </div>
            </div>
          </div>

          {plan.scheduleMode === "week" ? (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-0.5 px-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] font-medium text-mist">This week ({weeklyPlannedCount} training days)</p>
                <span className="text-[12px] text-dim">Tap any day to assign or combine routines</span>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-panel divide-y divide-white/[0.06]">
                {WEEK_ORDER.map((w) => {
                  const ids = plan.week[w.dow] ?? [];
                  const dayRoutines = ids.map((id) => routineMap.get(id)).filter((r): r is PlanRoutine => Boolean(r));
                  const isToday = todayDow === w.dow;
                  const load = computeRoutineMuscleLoad(dayRoutines.flatMap((r) => r.slots.map((s) => s.exerciseId)));
                  const totalEx = dayRoutines.reduce((a, r) => a + r.slots.length, 0);

                  return (
                    <div
                      key={w.dow}
                      className="flex items-center gap-2.5 px-3.5 py-3.5 transition-colors hover:bg-panel-2 sm:gap-3 sm:px-4"
                    >
                      <button
                        type="button"
                        onClick={() => setEditingDay(w.dow)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
                      >
                        <span
                          className={cn(
                            "w-6 shrink-0 text-[14px] font-semibold sm:w-7",
                            isToday ? "text-acid" : "text-mist",
                          )}
                        >
                          {w.short}
                        </span>

                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl",
                            dayRoutines.length ? "bg-acid text-ink" : "bg-panel-2 text-mist",
                          )}
                        >
                          {dayRoutines.length ? <Dumbbell className="size-4.5" /> : <Moon className="size-4.5" />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-chalk">
                            {dayRoutines.length ? dayRoutines.map((r) => r.name).join(" + ") : "Rest day"}
                          </p>
                          <p className="truncate whitespace-nowrap text-[12.5px] text-mist">
                            {dayRoutines.length ? `${totalEx} exercises` : "Tap to plan something"}
                          </p>
                        </div>
                      </button>

                      {dayRoutines.length > 0 && (
                        <>
                          <DualMiniBodyMap load={load} heightClass="h-9" />
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleStartRoutine(dayRoutines)}
                            title={`Start ${dayRoutines.map((r) => r.name).join(" + ")}`}
                            className="press hidden rounded-full bg-acid/14 px-3 py-1.5 text-[12px] font-semibold text-acid hover:bg-acid hover:text-ink sm:inline-flex"
                          >
                            Start
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingDay(w.dow)}
                        aria-label={`Edit ${w.full}`}
                        className="shrink-0 p-1 text-dim hover:text-chalk"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ROTATION LOOP MODE */
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[13px] font-medium text-mist">The loop ({plan.rotation.length} steps)</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLoop((v) => !v)}
                    className="rounded-full bg-panel-2 px-3 py-1 text-[12.5px] font-medium text-chalk"
                  >
                    {editingLoop ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingToLoopOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-acid/16 px-3 py-1 text-[12.5px] font-medium text-acid"
                  >
                    <Plus className="size-3.5" /> Add
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-panel divide-y divide-white/[0.06]">
                {plan.rotation.map((item, idx) => {
                  const isRest = item === "rest";
                  const r = isRest ? null : routineMap.get(item);
                  const state = idx < plan.rotationIndex ? "done" : idx === plan.rotationIndex ? "next" : "later";
                  const load = r ? computeRoutineMuscleLoad(r.slots.map((s) => s.exerciseId)) : undefined;

                  return (
                    <div key={`${item}-${idx}`} className="flex items-center gap-3 px-4 py-3.5">
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold",
                          state === "done"
                            ? "bg-mint/20 text-mint"
                            : state === "next"
                              ? "bg-acid text-ink"
                              : "bg-panel-2 text-mist",
                        )}
                      >
                        {state === "done" ? <Check className="size-3" /> : idx + 1}
                      </span>

                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          isRest ? "bg-panel-2 text-mist" : "bg-acid/18 text-acid",
                        )}
                      >
                        {isRest ? <Moon className="size-4.5" /> : <Dumbbell className="size-4.5" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-chalk">
                          {isRest ? "Rest day" : r?.name ?? item}
                        </p>
                        <p className="text-[12px] text-mist">
                          {state === "next" ? "Up next" : state === "done" ? "Done this round" : isRest ? "Recovery day" : `${r?.slots.length ?? 0} exercises`}
                        </p>
                      </div>

                      {!editingLoop && load && <DualMiniBodyMap load={load} heightClass="h-8" />}
                      {!editingLoop && r && state === "next" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleStartRoutine([r])}
                          className="press rounded-full bg-acid px-3.5 py-1.5 text-[12px] font-semibold text-ink"
                        >
                          Start
                        </button>
                      )}

                      {editingLoop && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() =>
                              updatePlan((p) => {
                                const arr = [...p.rotation];
                                [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                return { ...p, rotation: arr };
                              })
                            }
                            className="grid size-7 place-items-center rounded-lg bg-panel-2 text-mist disabled:opacity-30"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === plan.rotation.length - 1}
                            onClick={() =>
                              updatePlan((p) => {
                                const arr = [...p.rotation];
                                [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                                return { ...p, rotation: arr };
                              })
                            }
                            className="grid size-7 place-items-center rounded-lg bg-panel-2 text-mist disabled:opacity-30"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlan(
                                (p) => ({ ...p, rotation: p.rotation.filter((_, i) => i !== idx) }),
                                `Removed step from loop`,
                              )
                            }
                            className="grid size-7 place-items-center rounded-lg bg-rose/15 text-rose"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updatePlan((p) => ({ ...p, rotationIndex: (p.rotationIndex + 1) % Math.max(1, p.rotation.length) }))}
                  className="rounded-full bg-panel-2 px-4 py-2 text-[12.5px] font-medium text-chalk hover:bg-panel-3"
                >
                  Advance next step
                </button>
                <button
                  type="button"
                  onClick={() => updatePlan((p) => ({ ...p, rotationIndex: 0 }))}
                  className="rounded-full bg-panel-2 px-4 py-2 text-[12.5px] font-medium text-mist hover:text-chalk"
                >
                  Start the loop over
                </button>
              </div>
            </div>
          )}

          {/* Weekly muscle volume footer row */}
          <Link
            href="/app/progress"
            className="flex items-center justify-between rounded-[20px] border border-white/[0.07] bg-panel p-4 hover:bg-panel-2"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <BarChart3 className="size-4.5" />
              </span>
              <div>
                <p className="text-[14.5px] font-medium text-chalk">Weekly muscle volume</p>
                <p className="text-[12.5px] text-mist">{weeklySetsCount} working sets logged this week · inspect balance in Stats</p>
              </div>
            </div>
            <ChevronRight className="size-4 text-dim" />
          </Link>
        </div>
      )}

      {/* ═════════════ TAB 2: ROUTINES (Favourites + Folders + Editor) ═════════════ */}
      {tab === "routines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEditingRoutines((v) => !v)}
              className="rounded-full bg-panel-2 px-3.5 py-1.5 text-[13px] font-medium text-chalk"
            >
              {editingRoutines ? "Done" : "Edit"}
            </button>
            <button
              type="button"
              onClick={handleCreateRoutine}
              className="press inline-flex items-center gap-1.5 rounded-full bg-acid/16 px-3.5 py-1.5 text-[13px] font-medium text-acid hover:bg-acid/24"
            >
              <Plus className="size-4" /> New routine
            </button>
          </div>

          {/* Favourites section */}
          {groupedRoutines.favs.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 px-1 text-[12.5px] font-medium text-mist">
                <Star className="size-3.5 fill-amber text-amber" /> Favourites
              </p>
              <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-panel divide-y divide-white/[0.06]">
                {groupedRoutines.favs.map((r) => {
                  const load = computeRoutineMuscleLoad(r.slots.map((s) => s.exerciseId));
                  const days = weekdaysForRoutine(r.id);
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2">
                      <button type="button" onClick={() => setSelectedRoutineId(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acid text-ink">
                          <Dumbbell className="size-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-chalk">{r.name}</p>
                          <p className="truncate text-[12.5px] text-mist">
                            {r.slots.length} exercises{days.length ? ` · ${days.join(", ")}` : ""}
                          </p>
                        </div>
                      </button>
                      <DualMiniBodyMap load={load} heightClass="h-9" />
                      {editingRoutines ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const copy: PlanRoutine = {
                                ...r,
                                id: `rt-${Date.now().toString(36)}`,
                                name: `${r.name} Copy`,
                                favourite: false,
                              };
                              updatePlan((p) => ({ ...p, routines: [...p.routines, copy] }));
                              flashToast(`Duplicated "${r.name}".`);
                            }}
                            className="grid size-8 place-items-center rounded-lg bg-panel-2 text-mist hover:text-chalk"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlan(
                                (p) => ({ ...p, routines: p.routines.filter((x) => x.id !== r.id) }),
                                `Deleted "${r.name}"`,
                              )
                            }
                            className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setSelectedRoutineId(r.id)} className="p-1 text-dim">
                          <ChevronRight className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Folder groups (GYM-One + openGym routine-folders) */}
          {groupedRoutines.folders.map(([folderName, list]) => {
            const isOpen = openFolders[folderName] ?? true;
            return (
              <div key={folderName} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setOpenFolders((o) => ({ ...o, [folderName]: !isOpen }))}
                  className="flex w-full items-center gap-2 px-1 text-left text-[13px] font-medium text-mist hover:text-chalk"
                >
                  <Folder className="size-4 text-acid" />
                  <span className="flex-1">{folderName}</span>
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px]">{list.length}</span>
                  <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90")} />
                </button>

                {isOpen && (
                  <div className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-panel divide-y divide-white/[0.06]">
                    {list.map((r) => {
                      const load = computeRoutineMuscleLoad(r.slots.map((s) => s.exerciseId));
                      const days = weekdaysForRoutine(r.id);
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2">
                          <button type="button" onClick={() => setSelectedRoutineId(r.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-acid">
                              <Dumbbell className="size-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-medium text-chalk">{r.name}</p>
                              <p className="truncate text-[12.5px] text-mist">
                                {r.slots.length} exercises{days.length ? ` · ${days.join(", ")}` : ""}
                              </p>
                            </div>
                          </button>
                          <DualMiniBodyMap load={load} heightClass="h-9" />
                          {editingRoutines ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const copy: PlanRoutine = {
                                    ...r,
                                    id: `rt-${Date.now().toString(36)}`,
                                    name: `${r.name} Copy`,
                                  };
                                  updatePlan((p) => ({ ...p, routines: [...p.routines, copy] }));
                                  flashToast(`Duplicated "${r.name}".`);
                                }}
                                className="grid size-8 place-items-center rounded-lg bg-panel-2 text-mist hover:text-chalk"
                              >
                                <Copy className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updatePlan(
                                    (p) => ({ ...p, routines: p.routines.filter((x) => x.id !== r.id) }),
                                    `Deleted "${r.name}"`,
                                  )
                                }
                                className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setSelectedRoutineId(r.id)} className="p-1 text-dim">
                              <ChevronRight className="size-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═════════════ TAB 3: PROGRAMMES (openGym CC-BY + FORGE 10 Splits) ═════════════ */}
      {tab === "programmes" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[18px] font-semibold text-chalk">Starter & Periodized Plans</h2>
              <p className="text-[12.5px] text-mist">
                {allTemplates.length} openGym curated plans + {BUILTIN_PROGRAMS.length} multi-week FORGE splits. Applying sets your schedule immediately.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["all", "hypertrophy", "strength", "athletic", "bodyweight"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoalFilter(g)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[12px] font-medium",
                    goalFilter === g ? "bg-acid text-ink" : "bg-panel-2 text-mist hover:text-chalk",
                  )}
                >
                  {titleCase(g)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {allTemplates
              .filter((t) => goalFilter === "all" || t.goal === goalFilter)
              .map((tmpl: CuratedTemplateRoutine) => {
                const isActive = plan.activeProgrammeId === tmpl.id;
                const load = computeRoutineMuscleLoad(tmpl.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
                return (
                  <div
                    key={tmpl.id}
                    className={cn(
                      "flex flex-col rounded-[22px] border p-5 transition-colors",
                      isActive ? "border-acid/40 bg-panel" : "border-white/[0.08] bg-panel hover:bg-panel-2",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11.5px] text-mist">
                          <span>openGym {tmpl.license}</span>
                          <span>·</span>
                          <span>{tmpl.daysPerWeek}d/wk</span>
                          <span>·</span>
                          <span>{tmpl.level}</span>
                        </div>
                        <h3 className="mt-1 text-[18px] font-semibold text-chalk">{tmpl.name}</h3>
                      </div>
                      <DualMiniBodyMap load={load} heightClass="h-10" />
                    </div>

                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-mist">{tmpl.description}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tmpl.sessions.slice(0, 4).map((s) => (
                        <span key={s.key} className="rounded-lg bg-panel-2 px-2.5 py-1 text-[11.5px] text-chalk">
                          {s.name}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3.5 mt-4">
                      <span className="text-[12px] text-mist">{tmpl.durationMin} min / session</span>
                      <button
                        type="button"
                        onClick={() => {
                          updatePlan((p) => applyCuratedTemplateToPlan(p, tmpl), `Switched plan to ${tmpl.name}`);
                          setTab("schedule");
                          flashToast(`Applied "${tmpl.name}" to your weekly schedule.`);
                        }}
                        className={cn(
                          "press rounded-full px-4 py-1.5 text-[12.5px] font-semibold",
                          isActive ? "bg-acid/20 text-acid" : "bg-acid text-ink",
                        )}
                      >
                        {isActive ? "Active in Schedule" : "Apply Plan"}
                      </button>
                    </div>
                  </div>
                );
              })}

            {BUILTIN_PROGRAMS.filter((p) => goalFilter === "all" || p.goal === goalFilter).map((prog) => {
              const isActive = plan.activeProgrammeId === prog.id;
              return (
                <div
                  key={prog.id}
                  className={cn(
                    "flex flex-col rounded-[22px] border p-5 transition-colors",
                    isActive ? "border-acid/40 bg-panel" : "border-white/[0.08] bg-panel hover:bg-panel-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11.5px] text-mist">
                        <span>{prog.weeks} weeks</span>
                        <span>·</span>
                        <span>{prog.daysPerWeek}d/wk</span>
                        <span>·</span>
                        <span>★ {prog.rating}</span>
                      </div>
                      <h3 className="mt-1 text-[18px] font-semibold text-chalk">{prog.name}</h3>
                      <p className="text-[12px] text-acid">{prog.subtitle}</p>
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-mist">{prog.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {prog.days.slice(0, 3).map((d) => (
                      <span key={d.id} className="rounded-lg bg-panel-2 px-2.5 py-1 text-[11.5px] text-chalk">
                        {d.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3.5 mt-4">
                    <span className="truncate text-[11.5px] text-mist max-w-[200px]">{prog.level}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlan((p) => applyBuiltinProgramToPlan(p, prog, slugMap), `Switched plan to ${prog.name}`);
                        setTab("schedule");
                        flashToast(`Applied "${prog.name}" to your weekly schedule.`);
                      }}
                      className={cn(
                        "press rounded-full px-4 py-1.5 text-[12.5px] font-semibold",
                        isActive ? "bg-acid/20 text-acid" : "bg-acid text-ink",
                      )}
                    >
                      {isActive ? "Active in Schedule" : "Apply Plan"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Undo Toast Bar */}
      {undoSnap && (
        <div className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-panel-3 px-4 py-2 text-[13px] font-medium text-chalk shadow-2xl md:bottom-8">
          <span>{undoSnap.label}</span>
          <button
            type="button"
            onClick={() => {
              const restore = undoSnap.state;
              savePlanState(restore);
              setPlan(restore);
              setUndoSnap(null);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-acid px-3 py-0.5 text-[12px] font-semibold text-ink"
          >
            <Undo2 className="size-3" /> Undo
          </button>
        </div>
      )}

      {toastMsg && !undoSnap && (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/15 bg-panel-3 px-4 py-2 text-[13px] font-medium text-chalk shadow-2xl md:bottom-8">
          {toastMsg}
        </div>
      )}

      {/* Weekday Assignment Sheet ("Tap to plan something") */}
      {editingDay !== null && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-chalk">
                  {WEEK_ORDER.find((w) => w.dow === editingDay)?.full}
                </h3>
                <p className="text-[12.5px] text-mist">Pick one routine, combine two, or set a rest day.</p>
              </div>
              <button type="button" onClick={() => setEditingDay(null)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 max-h-[55vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  updatePlan((p) => ({ ...p, week: { ...p.week, [editingDay]: [] } }));
                  setEditingDay(null);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors",
                  (plan.week[editingDay] ?? []).length === 0 ? "bg-panel-3 text-chalk" : "bg-panel-2 text-mist hover:text-chalk",
                )}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-panel text-mist"><Moon className="size-4" /></span>
                <div className="flex-1">
                  <p className="text-[14.5px] font-medium">Rest day</p>
                  <p className="text-[12px] text-mist">Recovery & mobility focus</p>
                </div>
                {(plan.week[editingDay] ?? []).length === 0 && <Check className="size-4 text-acid" />}
              </button>

              {plan.routines.map((r) => {
                const assigned = (plan.week[editingDay] ?? []).includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      updatePlan((p) => {
                        const cur = p.week[editingDay] ?? [];
                        const next = assigned ? cur.filter((x) => x !== r.id) : [...cur, r.id];
                        return { ...p, week: { ...p.week, [editingDay]: next } };
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors",
                      assigned ? "border border-acid/40 bg-acid/10" : "bg-panel-2 hover:bg-panel-3",
                    )}
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-panel text-acid"><Dumbbell className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-chalk">{r.name}</p>
                      <p className="text-[12px] text-mist">{r.slots.length} exercises</p>
                    </div>
                    {assigned && <Check className="size-4 text-acid" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              {(plan.week[editingDay] ?? []).length > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const dr = (plan.week[editingDay] ?? []).map((id) => routineMap.get(id)).filter((r): r is PlanRoutine => Boolean(r));
                    setEditingDay(null);
                    handleStartRoutine(dr);
                  }}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-acid py-2.5 text-[14px] font-semibold text-ink"
                >
                  <Play className="size-4 fill-current" /> Start workout
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingDay(null)}
                className="flex-1 rounded-full bg-panel-2 py-2.5 text-[14px] font-semibold text-chalk hover:bg-panel-3"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Loop Modal */}
      {addingToLoopOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Add to rotation loop</h3>
              <button type="button" onClick={() => setAddingToLoopOpen(false)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-[55vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  updatePlan((p) => ({ ...p, rotation: [...p.rotation, "rest"] }));
                  setAddingToLoopOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 p-3 text-left hover:bg-panel-3"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-panel text-mist"><Moon className="size-4" /></span>
                <span className="text-[14.5px] font-medium text-chalk">Rest day</span>
              </button>
              {plan.routines.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    updatePlan((p) => ({ ...p, rotation: [...p.rotation, r.id] }));
                    setAddingToLoopOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 p-3 text-left hover:bg-panel-3"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-panel text-acid"><Dumbbell className="size-4" /></span>
                  <div className="flex-1">
                    <p className="text-[14.5px] font-medium text-chalk">{r.name}</p>
                    <p className="text-[12px] text-mist">{r.slots.length} exercises</p>
                  </div>
                  <Plus className="size-4 text-acid" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Routine Editor Modal */}
      {selectedRoutine && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/12 bg-panel p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <input
                  value={selectedRoutine.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    updatePlan((p) => ({
                      ...p,
                      routines: p.routines.map((x) => (x.id === selectedRoutine.id ? { ...x, name: v } : x)),
                    }));
                  }}
                  className="w-full bg-transparent font-display text-2xl font-semibold text-chalk focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={selectedRoutine.folder}
                    onChange={(e) => {
                      const f = e.target.value;
                      updatePlan((p) => ({
                        ...p,
                        routines: p.routines.map((x) => (x.id === selectedRoutine.id ? { ...x, folder: f } : x)),
                      }));
                    }}
                    className="rounded-xl bg-panel-2 px-3 py-1 text-[12px] text-mist"
                  >
                    <option>Hypertrophy & Aesthetics</option>
                    <option>Strength & Powerlifting</option>
                    <option>Athletic & Bodyweight</option>
                    <option>Custom Routines</option>
                  </select>
                  <select
                    value={selectedRoutine.progression}
                    onChange={(e) => {
                      const pr = e.target.value as PlanRoutine["progression"];
                      updatePlan((p) => ({
                        ...p,
                        routines: p.routines.map((x) => (x.id === selectedRoutine.id ? { ...x, progression: pr } : x)),
                      }));
                    }}
                    className="rounded-xl bg-panel-2 px-3 py-1 text-[12px] text-acid"
                  >
                    <option value="double">Double progression</option>
                    <option value="linear">Linear progression</option>
                    <option value="rpe">RPE autoregulated</option>
                    <option value="ladder">Skill ladder</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updatePlan((p) => ({
                      ...p,
                      routines: p.routines.map((x) => (x.id === selectedRoutine.id ? { ...x, favourite: !x.favourite } : x)),
                    }))
                  }
                  aria-label="Toggle favourite"
                  className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist hover:text-amber"
                >
                  <Star className={cn("size-4", selectedRoutine.favourite && "fill-amber text-amber")} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRoutineId(null)}
                  className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {selectedRoutine.slots.map((slot, sIdx) => {
                const ex = CATALOG_BY_ID.get(slot.exerciseId);
                return (
                  <div key={`${slot.exerciseId}-${sIdx}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-panel-2 p-3">
                    <div className="min-w-[180px] flex-1">
                      <p className="text-[14px] font-medium text-chalk">{ex?.name ?? slot.exerciseId}</p>
                      <p className="text-[12px] text-mist">
                        {MUSCLE_METADATA[ex?.primaryMuscle ?? "chest"]?.name ?? titleCase(ex?.primaryMuscle ?? "chest")} · {titleCase(ex?.equipment ?? "barbell")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[12px]">
                      <label className="flex items-center gap-1 text-mist">
                        Sets
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={slot.sets}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 3);
                            updatePlan((p) => ({
                              ...p,
                              routines: p.routines.map((r) =>
                                r.id === selectedRoutine.id
                                  ? { ...r, slots: r.slots.map((sl, i) => (i === sIdx ? { ...sl, sets: n } : sl)) }
                                  : r,
                              ),
                            }));
                          }}
                          className="w-12 rounded-lg bg-panel px-2 py-1 text-center font-numeric text-chalk"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-mist">
                        Reps
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={slot.repsMax}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 10);
                            updatePlan((p) => ({
                              ...p,
                              routines: p.routines.map((r) =>
                                r.id === selectedRoutine.id
                                  ? { ...r, slots: r.slots.map((sl, i) => (i === sIdx ? { ...sl, repsMin: Math.max(1, n - 2), repsMax: n } : sl)) }
                                  : r,
                              ),
                            }));
                          }}
                          className="w-12 rounded-lg bg-panel px-2 py-1 text-center font-numeric text-chalk"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updatePlan((p) => ({
                            ...p,
                            routines: p.routines.map((r) =>
                              r.id === selectedRoutine.id
                                ? { ...r, slots: r.slots.filter((_, i) => i !== sIdx) }
                                : r,
                            ),
                          }))
                        }
                        className="grid size-7 place-items-center rounded-lg bg-rose/15 text-rose"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setExQuery("");
                  setAddingExerciseToRoutine(selectedRoutine.id);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 bg-panel-2 py-3 text-[13.5px] font-medium text-acid hover:bg-panel-3"
              >
                <Plus className="size-4" /> Add exercise from 1,350+ catalog
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending || selectedRoutine.slots.length === 0}
                onClick={() => handleStartRoutine([selectedRoutine])}
                className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-acid py-2.5 text-[14px] font-semibold text-ink disabled:opacity-50"
              >
                <Play className="size-4 fill-current" /> Start this routine
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoutineId(null)}
                className="rounded-full bg-panel-2 px-5 py-2.5 text-[14px] font-medium text-chalk"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Exercise Picker Modal for Routine Editing */}
      {addingExerciseToRoutine && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/12 bg-panel p-5 sm:rounded-3xl flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-chalk">Add exercise</h3>
              <button type="button" onClick={() => setAddingExerciseToRoutine(null)} className="grid size-8 place-items-center rounded-full bg-panel-2 text-mist">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2">
              <Search className="size-4 text-dim" />
              <input
                value={exQuery}
                onChange={(e) => setExQuery(e.target.value)}
                placeholder="Search 1,350+ exercises..."
                className="w-full bg-transparent text-[14px] text-chalk focus:outline-none"
              />
            </div>
            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {pickerMatches.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    updatePlan((p) => ({
                      ...p,
                      routines: p.routines.map((r) =>
                        r.id === addingExerciseToRoutine
                          ? {
                              ...r,
                              slots: [
                                ...r.slots,
                                { exerciseId: ex.id, sets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8, progression: r.progression },
                              ],
                            }
                          : r,
                      ),
                    }));
                    setAddingExerciseToRoutine(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-panel-2"
                >
                  <div>
                    <p className="text-[14px] font-medium text-chalk">{ex.name}</p>
                    <p className="text-[12px] text-mist">{MUSCLE_METADATA[ex.primaryMuscle]?.name ?? titleCase(ex.primaryMuscle)} · {titleCase(ex.equipment)}</p>
                  </div>
                  <Plus className="size-4 text-acid" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
