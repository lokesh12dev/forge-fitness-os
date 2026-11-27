"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ExternalLink, Link2, Plus, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Modal, StatTile, Toast } from "@/components/ui/primitives";
import {
  assignTrainingTemplateAction,
  createWorkoutDietTemplateAction,
} from "@/app/actions/phase34-actions";

interface TemplateRow {
  id: string;
  name: string;
  goal: string;
  dietType: string;
  caloriesTarget: number;
  proteinGrams: number;
  createdByName: string;
  workouts: Array<{ day: string; exercises: string[] }>;
  meals: Array<{ slot: string; items: string; macros: string }>;
}

interface AssignmentRow {
  id: string;
  memberName: string;
  memberCode: string;
  templateName: string;
  dietType: string;
  caloriesTarget: number;
  proteinGrams: number;
  trainerName: string;
  syncToken: string;
  syncedAt: string | null;
}

export function TrainingPlansClient({
  canWrite,
  members,
  templates,
  assignments,
}: {
  canWrite: boolean;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  templates: TemplateRow[];
  assignments: AssignmentRow[];
}) {
  const router = useRouter();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState(members[0]?.id ?? "");
  const [assignTplId, setAssignTplId] = useState(templates[0]?.id ?? "");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Template builder
  const [name, setName] = useState("Eggetarian Athletic Strength 3-Day");
  const [goal, setGoal] = useState("Strength + Conditioning");
  const [dietType, setDietType] = useState<"VEG" | "EGG" | "NON_VEG" | "JAIN" | "VEGAN">("EGG");
  const [calories, setCalories] = useState(2300);
  const [protein, setProtein] = useState(145);
  const [blockTitle, setBlockTitle] = useState("Day A - Push/Pull Compound");
  const [exercisesCsv, setExercisesCsv] = useState("Back Squat 4x5, Barbell Bench 4x6, Barbell Row 4x8");
  const [mealSummary, setMealSummary] = useState("4 Egg Whites + Paneer + Dal Chawal + Whey Isolate");

  const assignCols: DataColumn<AssignmentRow>[] = [
    { key: "mem", header: "Member", render: (r) => <div><p className="font-bold">{r.memberName}</p><p className="text-[12px] text-[var(--fg-grey)] font-tabular">{r.memberCode}</p></div> },
    { key: "tpl", header: "Assigned Protocol", render: (r) => <div><p className="font-bold">{r.templateName}</p><p className="text-[12px] text-[var(--fg-grey)]">{r.dietType} · {r.caloriesTarget} kcal · {r.proteinGrams}g P</p></div> },
    { key: "tr", header: "Coach", render: (r) => <span>{r.trainerName}</span> },
    {
      key: "sync",
      header: "FORGE App Sync Token",
      render: (r) => (
        <a
          href={`/api/v1/member-app-sync?syncToken=${encodeURIComponent(r.syncToken)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 border border-[#151515] bg-[#EBC95B] text-[#151515] px-2.5 py-1 text-[12px] font-mono font-bold hover:bg-[#2B4BCC] hover:text-[#FFFFFF]"
        >
          {r.syncToken} <ExternalLink className="size-3.5" />
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// WORKOUTS, INDIAN DIET PROTOCOLS & FORGE APP SYNC"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">TRAINING & DIET PLANS.</h1>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setBuilderOpen(true)}>
            <Plus className="size-4" /> New Plan Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// PROTOCOL TEMPLATES" value={templates.length} subtext="Veg, Egg, Non-Veg, Jain, Vegan" accent="blue" />
        <StatTile label="// SYNCED MEMBERS" value={assignments.length} subtext="Active API sync tokens issued" accent="ink" />
        <StatTile label="// APP SYNC ENDPOINT" value="/api/v1" subtext="member-app-sync JSON webhook ready" accent="yellow" />
        <StatTile label="// DIET COVERAGE" value="INDIAN" subtext="Paneer, Soya, Dal, Rotis & Macros" accent="red" />
      </div>

      {/* Assign to Member Strip */}
      {canWrite && templates.length > 0 && members.length > 0 && (
        <div className="bauhaus-card p-4 flex flex-wrap items-end gap-3 bg-[var(--bg-surface)]">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="as-mem" className="bauhaus-label block mb-1">{"// MEMBER"}</label>
            <select id="as-mem" className="bauhaus-input" value={assignMemberId} onChange={(e) => setAssignMemberId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="as-tpl" className="bauhaus-label block mb-1">{"// WORKOUT + DIET PROTOCOL"}</label>
            <select id="as-tpl" className="bauhaus-input" value={assignTplId} onChange={(e) => setAssignTplId(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} [{t.dietType}]</option>)}
            </select>
          </div>
          <Button
            variant="blue"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await assignTrainingTemplateAction({
                  memberId: assignMemberId,
                  templateId: assignTplId,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setToast({ msg: `Assigned! Sync token: ${res.syncToken}`, tone: "blue" });
                router.refresh();
              });
            }}
          >
            <Link2 className="size-4" /> Assign & Sync to Member App
          </Button>
        </div>
      )}

      {/* Template Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bauhaus-card p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="bg-[#151515] text-[#EBC95B] px-2 py-0.5 text-[12px] font-bold uppercase">
                  <Utensils className="size-3.5 inline mr-1" />{t.dietType}
                </span>
                <span className="border border-[#151515] px-2 py-0.5 text-[12px] font-tabular font-bold">
                  {t.caloriesTarget} kcal · {t.proteinGrams}g P
                </span>
              </div>
              <h2 className="font-headline text-[20px]">{t.name}</h2>
              <p className="text-[12px] font-bold text-[#2B4BCC] uppercase">GOAL: {t.goal}</p>

              <div className="border-t-2 border-[var(--border-ink)]/25 pt-2 space-y-1.5">
                <p className="bauhaus-label text-[var(--fg-grey)]">{"// WORKOUT SPLITS"}</p>
                {t.workouts.slice(0, 2).map((w, idx) => (
                  <div key={idx} className="text-[12px]">
                    <span className="font-bold">{w.day}:</span> {w.exercises.join(", ")}
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-[var(--border-ink)]/25 pt-2 space-y-1.5">
                <p className="bauhaus-label text-[var(--fg-grey)]">{"// INDIAN MEAL STRUCTURE"}</p>
                {t.meals.slice(0, 2).map((m, idx) => (
                  <div key={idx} className="text-[12px]">
                    <span className="font-bold">{m.slot}:</span> {m.items} <span className="text-[#C8372B] font-bold">({m.macros})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <DataTable title="ACTIVE FORGE MEMBER APP SYNC TOKENS" rows={assignments} columns={assignCols} rowKey={(r) => r.id} />

      <Modal open={builderOpen} onClose={() => setBuilderOpen(false)} eyebrow="PROGRAMMING STUDIO" title="Build Workout + Indian Diet Plan">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="wp-name" className="bauhaus-label block mb-1.5">{"// PROTOCOL NAME"}</label>
              <input id="wp-name" className="bauhaus-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="wp-diet" className="bauhaus-label block mb-1.5">{"// DIET PREFERENCE"}</label>
              <select
                id="wp-diet"
                className="bauhaus-input"
                value={dietType}
                onChange={(e) => setDietType(e.target.value as "VEG" | "EGG" | "NON_VEG" | "JAIN" | "VEGAN")}
              >
                <option value="VEG">VEG (Lacto-Vegetarian)</option>
                <option value="EGG">EGG (Eggetarian)</option>
                <option value="NON_VEG">NON_VEG</option>
                <option value="JAIN">JAIN (Sattvic)</option>
                <option value="VEGAN">VEGAN (Plant-Based)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="wp-goal" className="bauhaus-label block mb-1.5">{"// GOAL"}</label>
              <input id="wp-goal" className="bauhaus-input" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div>
              <label htmlFor="wp-cal" className="bauhaus-label block mb-1.5">{"// KCAL"}</label>
              <input id="wp-cal" type="number" className="bauhaus-input" value={calories} onChange={(e) => setCalories(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="wp-pro" className="bauhaus-label block mb-1.5">{"// PROTEIN (G)"}</label>
              <input id="wp-pro" type="number" className="bauhaus-input" value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label htmlFor="wp-blk" className="bauhaus-label block mb-1.5">{"// WORKOUT DAY & EXERCISES"}</label>
            <input id="wp-blk" className="bauhaus-input mb-2" value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} />
            <input className="bauhaus-input" value={exercisesCsv} onChange={(e) => setExercisesCsv(e.target.value)} />
          </div>
          <div>
            <label htmlFor="wp-meal" className="bauhaus-label block mb-1.5">{"// INDIAN MEAL SUMMARY"}</label>
            <textarea id="wp-meal" rows={2} className="bauhaus-input h-auto py-2" value={mealSummary} onChange={(e) => setMealSummary(e.target.value)} />
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await createWorkoutDietTemplateAction({
                  name,
                  goal,
                  dietType,
                  caloriesTarget: calories,
                  proteinGrams: protein,
                  workoutBlockTitle: blockTitle,
                  workoutExercisesCsv: exercisesCsv,
                  mealSummary,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setBuilderOpen(false);
                setToast({ msg: clsx("Template created for", dietType, "protocol."), tone: "blue" });
                router.refresh();
              });
            }}
          >
            SAVE TRAINING & DIET PROTOCOL
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
