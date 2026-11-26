/**
 * Unified Weekly Schedule, Rotation Loop, & Routine Folder Store
 *
 * Powers both /app/programs (Plan: Fixed Week | Rotation | Routines | Programmes)
 * and /app (Home: This week strip, "X of Y left this week", Today session).
 */

import {
  OPENGYM_CURATED_ROUTINES,
  OPENGYM_STARTER_PLANS,
  type CuratedTemplateRoutine,
  type RoutineSlotItem,
} from "@/lib/opengym-catalog";
import { BUILTIN_PROGRAMS, type BuiltinProgram } from "@/lib/programs-db";

export interface PlanRoutine {
  id: string;
  name: string;
  folder: string;
  glyph: "barbell" | "pullup" | "legs" | "dumbbell" | "flame" | "zap";
  color: string;
  favourite: boolean;
  progression: "double" | "linear" | "rpe" | "ladder";
  slots: RoutineSlotItem[];
}

export interface PlanScheduleState {
  scheduleMode: "week" | "rotation";
  /** 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat */
  week: Record<number, string[]>;
  rotation: Array<string | "rest">;
  rotationIndex: number;
  dayOverrides: Record<string, string[] | "rest">;
  dayNotes: Record<string, string>;
  activeProgrammeId: string;
  routines: PlanRoutine[];
}

export const PLAN_STATE_STORAGE_KEY = "forge_plan_state_v1";

export const DEFAULT_PLAN_STATE: PlanScheduleState = {
  scheduleMode: "week",
  week: {
    1: ["rt-push-day"],
    2: [],
    3: ["rt-pull-day"],
    4: [],
    5: ["rt-leg-day"],
    6: ["rt-upper-power"],
    0: [],
  },
  rotation: ["rt-push-day", "rt-pull-day", "rt-leg-day", "rest"],
  rotationIndex: 0,
  dayOverrides: {},
  dayNotes: {},
  activeProgrammeId: "og-starter-ppl",
  routines: [
    {
      id: "rt-push-day",
      name: "Push Day",
      folder: "Hypertrophy & Aesthetics",
      glyph: "barbell",
      color: "#C9F73A",
      favourite: true,
      progression: "double",
      slots: OPENGYM_STARTER_PLANS[0].sessions[0].exercises,
    },
    {
      id: "rt-pull-day",
      name: "Pull Day",
      folder: "Hypertrophy & Aesthetics",
      glyph: "pullup",
      color: "#A3E635",
      favourite: true,
      progression: "double",
      slots: OPENGYM_STARTER_PLANS[0].sessions[1].exercises,
    },
    {
      id: "rt-leg-day",
      name: "Leg Day",
      folder: "Hypertrophy & Aesthetics",
      glyph: "legs",
      color: "#C9F73A",
      favourite: false,
      progression: "double",
      slots: OPENGYM_STARTER_PLANS[0].sessions[2].exercises,
    },
    {
      id: "rt-upper-power",
      name: "5×5 Strength A",
      folder: "Strength & Powerlifting",
      glyph: "dumbbell",
      color: "#6EA8FF",
      favourite: false,
      progression: "linear",
      slots: OPENGYM_STARTER_PLANS[1].sessions[0].exercises,
    },
  ],
};

export function loadPlanState(): PlanScheduleState {
  if (typeof window === "undefined") return DEFAULT_PLAN_STATE;
  try {
    const raw = localStorage.getItem(PLAN_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN_STATE;
    const parsed = JSON.parse(raw) as Partial<PlanScheduleState>;
    if (!Array.isArray(parsed.routines) || parsed.routines.length === 0) return DEFAULT_PLAN_STATE;
    return {
      ...DEFAULT_PLAN_STATE,
      ...parsed,
      week: { ...DEFAULT_PLAN_STATE.week, ...(parsed.week ?? {}) },
      dayOverrides: parsed.dayOverrides ?? {},
      dayNotes: parsed.dayNotes ?? {},
    };
  } catch {
    return DEFAULT_PLAN_STATE;
  }
}

export function savePlanState(state: PlanScheduleState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLAN_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getScheduledRoutinesForDate(
  state: PlanScheduleState,
  isoDate: string,
  weekday: number,
): PlanRoutine[] {
  const override = state.dayOverrides[isoDate];
  const ids =
    override === "rest"
      ? []
      : Array.isArray(override)
        ? override
        : state.scheduleMode === "rotation"
          ? (() => {
              const rId = state.rotation[state.rotationIndex % Math.max(1, state.rotation.length)];
              return rId && rId !== "rest" ? [rId] : [];
            })()
          : state.week[weekday] ?? [];

  const map = new Map(state.routines.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter((r): r is PlanRoutine => Boolean(r));
}

export function computeWeekTally(
  state: PlanScheduleState,
  weekDates: Array<{ iso: string; weekday: number }>,
  completedDateSet: Set<string>,
): { planned: number; done: number; left: number } {
  if (state.scheduleMode === "rotation") {
    const seqWorkouts = state.rotation.filter((x) => x !== "rest").length;
    const done = weekDates.filter((d) => completedDateSet.has(d.iso)).length;
    return { planned: seqWorkouts, done, left: Math.max(0, seqWorkouts - done) };
  }
  let planned = 0;
  let done = 0;
  for (const d of weekDates) {
    const rs = getScheduledRoutinesForDate(state, d.iso, d.weekday);
    if (rs.length > 0) planned += 1;
    if (completedDateSet.has(d.iso)) done += 1;
  }
  return { planned, done, left: Math.max(0, planned - done) };
}

export function applyCuratedTemplateToPlan(
  state: PlanScheduleState,
  template: CuratedTemplateRoutine,
): PlanScheduleState {
  const newRoutines: PlanRoutine[] = template.sessions.map((s, idx) => ({
    id: `rt-${template.id}-${idx}`,
    name: s.name,
    folder: template.folder,
    glyph: idx % 3 === 0 ? "barbell" : idx % 3 === 1 ? "pullup" : "legs",
    color: idx % 2 === 0 ? "#C9F73A" : "#7BE0AD",
    favourite: idx === 0,
    progression: template.goal === "strength" ? "linear" : "double",
    slots: s.exercises,
  }));

  const newWeek: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const slotsPerWeek = [1, 2, 3, 4, 5, 6, 0];
  template.sessions.forEach((s, idx) => {
    const wd = s.weekday ?? slotsPerWeek[idx % 7];
    newWeek[wd] = [...(newWeek[wd] ?? []), newRoutines[idx].id];
  });

  const existingOthers = state.routines.filter((r) => !newRoutines.some((n) => n.id === r.id));
  return {
    ...state,
    activeProgrammeId: template.id,
    week: newWeek,
    rotation: [...newRoutines.map((r) => r.id), "rest"],
    rotationIndex: 0,
    routines: [...newRoutines, ...existingOthers],
  };
}

export function applyBuiltinProgramToPlan(
  state: PlanScheduleState,
  program: BuiltinProgram,
  slugToExerciseId: Map<string, string>,
): PlanScheduleState {
  const newRoutines: PlanRoutine[] = program.days.map((d, idx) => ({
    id: `rt-${program.id}-${idx}`,
    name: d.name,
    folder:
      program.goal === "strength"
        ? "Strength & Powerlifting"
        : program.goal === "athletic" || program.goal === "bodyweight"
          ? "Athletic & Bodyweight"
          : "Hypertrophy & Aesthetics",
    glyph: idx % 3 === 0 ? "barbell" : idx % 3 === 1 ? "pullup" : "legs",
    color: program.accent,
    favourite: idx === 0,
    progression: program.goal === "strength" ? "linear" : "double",
    slots: d.exercises.map((ex) => ({
      exerciseId: slugToExerciseId.get(ex.slug) ?? "ex-bench-press",
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      restSec: ex.restSec,
      rpeTarget: ex.rpeTarget,
      supersetGroup: ex.supersetGroup ?? null,
      progression: program.goal === "strength" ? "linear" : "double",
    })),
  }));

  const newWeek: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const daysOrder = program.days.length <= 3 ? [1, 3, 5] : program.days.length === 4 ? [1, 2, 4, 5] : [1, 2, 3, 4, 5, 6];
  newRoutines.forEach((r, idx) => {
    const wd = daysOrder[idx % daysOrder.length];
    newWeek[wd] = [...(newWeek[wd] ?? []), r.id];
  });

  const existingOthers = state.routines.filter((r) => !newRoutines.some((n) => n.id === r.id));
  return {
    ...state,
    activeProgrammeId: program.id,
    week: newWeek,
    rotation: [...newRoutines.map((r) => r.id), "rest"],
    rotationIndex: 0,
    routines: [...newRoutines, ...existingOthers],
  };
}

export function getAllCuratedTemplates(): CuratedTemplateRoutine[] {
  return [...OPENGYM_STARTER_PLANS, ...OPENGYM_CURATED_ROUTINES];
}

export { BUILTIN_PROGRAMS };
