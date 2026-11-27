"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, Dumbbell, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { estimateSessionMinutes, muscleColor, muscleLabel } from "@/lib/engine";
import { enrollProgram } from "@/app/actions";

export type ProgramItem = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: number;
  accent: string;
  enrolled: boolean;
  rating: number;
  members: number;
  days: {
    id: string;
    name: string;
    focus: string;
    exercises: { id: string; name: string; sets: number; repsMin: number; repsMax: number; restSec: number; primaryMuscle: string; equipment: string }[];
  }[];
};

export function ProgramCard({ program }: { program: ProgramItem }) {
  const [open, setOpen] = useState(false);
  const totalSets = program.days.reduce((a, d) => a + d.exercises.reduce((b, e) => b + e.sets, 0), 0);
  const avgMin = Math.round(
    program.days.reduce((a, d) => a + estimateSessionMinutes(d.exercises.map((e) => ({ targetSets: e.sets, restSec: e.restSec }))), 0) /
      Math.max(1, program.days.length),
  );
  const muscles = [...new Set(program.days.flatMap((d) => d.exercises.map((e) => e.primaryMuscle)))].slice(0, 5);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-panel/70 transition-colors", open ? "border-white/15" : "border-white/[0.07] hover:border-white/12")}>
      <div className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full" style={{ background: `radial-gradient(circle, ${program.accent}14, transparent 70%)` }} />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={program.enrolled ? "acid" : "neutral"}>{program.enrolled ? <><Check className="size-2.5" /> Enrolled</> : program.goal}</Badge>
              <Badge tone="neutral">{program.level}</Badge>
            </div>
            <h3 className="mt-2.5 font-display text-[21px] font-bold leading-none tracking-[-0.035em]">{program.name}</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-mist">{program.subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-numeric text-2xl font-bold leading-none" style={{ color: program.accent }}>{program.daysPerWeek}<span className="text-[10px] font-normal text-dim">×/wk</span></p>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">{program.weeks} weeks</p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-dim">
          <span className="flex items-center gap-1"><Star className="size-3 text-amber" /> {program.rating.toFixed(1)}</span>
          <span className="flex items-center gap-1"><Users className="size-3" /> {(program.members / 1000).toFixed(1)}k</span>
          <span className="flex items-center gap-1"><Clock className="size-3" /> ~{avgMin} min</span>
          <span className="flex items-center gap-1"><Dumbbell className="size-3" /> {totalSets} sets/wk</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {muscles.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.08em] text-mist">
              <span className="size-1 rounded-full" style={{ background: muscleColor(m) }} /> {muscleLabel(m)}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {program.enrolled ? (
            <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-acid/20 bg-acid/[0.06] text-[11px] font-medium text-acid">
              <Check className="size-3" /> Your active plan
            </span>
          ) : (
            <form action={enrollProgram} className="flex-1">
              <input type="hidden" name="routineId" value={program.id} />
              <button className="press flex h-9 w-full items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-medium text-chalk hover:bg-acid hover:text-ink">
                Enroll in {program.weeks} weeks
              </button>
            </form>
          )}
          <button onClick={() => setOpen((v) => !v)} className="grid size-9 place-items-center rounded-full border border-white/[0.08] text-mist hover:text-chalk" aria-label="Details">
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-white/[0.06] bg-black/20 p-5">
          <p className="text-[11px] leading-relaxed text-mist">{program.description}</p>
          <div className="mt-4 space-y-2">
            {program.days.map((day, i) => (
              <div key={day.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-md bg-white/[0.06] font-mono text-[8.5px] text-dim">{i + 1}</span>
                    <p className="text-[11.5px] font-medium">{day.name}</p>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">{day.focus}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {day.exercises.map((e) => (
                    <span key={e.id} className="rounded-md border border-white/[0.05] px-1.5 py-0.5 text-[9px] text-mist">
                      {e.name} <span className="font-numeric text-dim">{e.sets}×{e.repsMin}–{e.repsMax}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
