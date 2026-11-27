"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, ClipboardList, Dumbbell, Play, Shuffle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogExercise } from "@/lib/opengym-catalog";
import type { ExerciseStat } from "@/components/exercise-library";
import { ExerciseMotionDemo } from "@/components/exercise-motion";
import { termDisplayName } from "@/lib/muscle-explorer";
import {
  buildSession,
  SESSION_DURATIONS,
  swapSessionPick,
  type SessionPick,
} from "@/lib/session-builder";

export function SessionBuilderModal({
  terms,
  catalog,
  stats,
  favIds,
  equipment,
  onlyMyGym,
  pending,
  onInspectExercise,
  onStartWorkout,
  onSaveAsRoutine,
  onClose,
}: {
  terms: string[];
  catalog: CatalogExercise[];
  stats: Record<string, ExerciseStat>;
  favIds: string[];
  equipment: string[];
  onlyMyGym: boolean;
  pending: boolean;
  onInspectExercise: (ex: CatalogExercise) => void;
  onStartWorkout: (picks: SessionPick[], title: string) => void;
  onSaveAsRoutine: (picks: SessionPick[], title: string) => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState<number>(40);
  const [seed, setSeed] = useState<number>(1);
  const [swaps, setSwaps] = useState<Array<[number, number]>>([]);

  const session = useMemo(() => {
    let out = buildSession({
      catalog,
      terms,
      minutes,
      seed,
      stats,
      favIds,
      equipment,
      onlyMyGym,
    });
    for (const [idx, sd] of swaps) {
      out = swapSessionPick(
        { catalog, stats, favIds, equipment, onlyMyGym },
        out,
        idx,
        sd,
      );
    }
    return out;
  }, [catalog, terms, minutes, seed, swaps, stats, favIds, equipment, onlyMyGym]);

  const title = terms.map(termDisplayName).join(" + ") || "Custom";
  const empty = session.picks.length === 0;

  const shuffle = () => {
    setSwaps([]);
    setSeed((s) => s + 1);
  };

  const swapOne = (index: number) => {
    setSwaps((cur) => [...cur, [index, seed * 31 + cur.length + 7]]);
  };

  return (
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close session builder"
        className="absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/12 bg-panel p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[22px] font-bold leading-tight text-chalk">
              Session for {title}
            </h3>
            <p className="mt-0.5 text-[13px] text-mist">
              {session.profileLabel
                ? `Built from what your gym has (${session.profileLabel}).`
                : "Built from the whole library. Pick a gym in Settings to narrow it."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 20 min | 40 min | 60 min segmented bar */}
        <div className="mt-4 grid grid-cols-3 rounded-2xl bg-panel-2 p-1">
          {SESSION_DURATIONS.map((m) => {
            const active = minutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSwaps([]);
                  setMinutes(m);
                }}
                className={cn(
                  "rounded-xl py-2 text-[13px] font-semibold transition-colors",
                  active ? "bg-panel-3 text-chalk shadow-sm" : "text-mist hover:text-chalk",
                )}
              >
                {m} min
              </button>
            );
          })}
        </div>

        {/* Exercise list */}
        {empty ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-panel-2 p-8 text-center">
            <Dumbbell className="size-8 text-dim" />
            <p className="mt-2.5 text-[13.5px] text-mist">
              Nothing here trains that with the equipment you have. Try another muscle or turn off the equipment filter.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {session.picks.map((p, i) => {
              const amount = p.mode === "time" ? `${p.sets} × ${p.sec} s` : `${p.sets} × ${p.reps}`;
              const subtitle = p.why.length ? `${amount} · ${p.why.join(" · ")}` : amount;
              return (
                <div
                  key={`${p.id}:${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-panel-2 px-3 py-2.5 transition-colors hover:bg-panel-3/80"
                >
                  <button
                    type="button"
                    onClick={() => onInspectExercise(p.exercise)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ExerciseMotionDemo
                      openGymId={p.exercise.openGymId}
                      name={p.exercise.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-chalk">
                        {p.exercise.name}
                      </p>
                      <p className="truncate text-[12.5px] text-mist">{subtitle}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => swapOne(i)}
                    aria-label={`Swap ${p.exercise.name}`}
                    title="Swap"
                    className="press grid size-9 shrink-0 place-items-center rounded-xl text-mist hover:bg-white/[0.08] hover:text-chalk"
                  >
                    <ArrowLeftRight className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!empty && (
          <p className="mt-3 text-[13px] text-mist">
            About {session.minutes} min, {session.picks.length}{" "}
            {session.picks.length === 1 ? "exercise" : "exercises"}.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={empty || pending}
            onClick={() => onStartWorkout(session.picks, `Session for ${title}`)}
            className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-acid py-3 text-[14.5px] font-semibold text-ink disabled:opacity-50"
          >
            <Play className="size-4 fill-current" />
            Start workout
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={shuffle}
              className="press flex items-center justify-center gap-2 rounded-2xl bg-acid/14 py-2.5 text-[13.5px] font-semibold text-acid hover:bg-acid/20"
            >
              <Shuffle className="size-4" />
              Shuffle
            </button>
            <button
              type="button"
              disabled={empty || pending}
              onClick={() => onSaveAsRoutine(session.picks, title)}
              className="press flex items-center justify-center gap-2 rounded-2xl bg-acid/14 py-2.5 text-[13.5px] font-semibold text-acid hover:bg-acid/20 disabled:opacity-50"
            >
              <ClipboardList className="size-4" />
              Save as routine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
