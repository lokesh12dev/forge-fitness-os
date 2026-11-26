"use client";

import { useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, BadgeCheck, Bell, Check, ChevronRight, Dumbbell, Flame,
  Loader2, LogOut, Salad, Shield, Sparkles, Target, User, Users, Zap,
} from "lucide-react";
import { signOut, updateEquipment, updateProfile, updateTargets } from "@/app/actions";
import { Avatar, Badge, Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

type SettingsUser = {
  id: string;
  name: string;
  email: string;
  handle: string;
  initials: string;
  accent: string;
  bio: string | null;
  goal: string;
  experience: string;
  unitPref: string;
  weightKg: number;
  heightCm: number;
  level: number;
  streak: number;
  xp: number;
  equipment: string[];
};

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "training", label: "Equipment", icon: Dumbbell },
  { key: "nutrition", label: "Targets", icon: Salad },
  { key: "account", label: "Account", icon: Shield },
] as const;

const GOALS = [
  { value: "hypertrophy", label: "Build muscle" },
  { value: "strength", label: "Get stronger" },
  { value: "fat-loss", label: "Lose fat" },
  { value: "recomp", label: "Recomposition" },
  { value: "endurance", label: "Endurance" },
];
const EXPERIENCE = [
  { value: "beginner", label: "Beginner · < 1 year" },
  { value: "intermediate", label: "Intermediate · 1–3 years" },
  { value: "advanced", label: "Advanced · 3+ years" },
];

const EQUIPMENT = [
  { id: "barbell", label: "Barbell", note: "Rack, plates, bench" },
  { id: "dumbbell", label: "Dumbbells", note: "Fixed or adjustable" },
  { id: "machine", label: "Machines", note: "Selectorized + plate-loaded" },
  { id: "cable", label: "Cables", note: "Pulley stack" },
  { id: "bodyweight", label: "Bodyweight", note: "Always available" },
  { id: "kettlebell", label: "Kettlebells", note: "Swings, carries" },
  { id: "bands", label: "Bands", note: "Resistance loops" },
  { id: "ez-bar", label: "EZ bar", note: "Curls, skull crushers" },
  { id: "smith-machine", label: "Smith machine", note: "Guided bar path" },
  { id: "trap-bar", label: "Trap bar", note: "Hex bar lifts" },
  { id: "pull-up-bar", label: "Pull-up bar", note: "Vertical pulling" },
  { id: "sled", label: "Sled", note: "Conditioning" },
];

const XP_PER_LEVEL = 1000;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 flex items-center justify-between">
        {label}
        {hint && <span className="normal-case tracking-normal text-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-chalk placeholder:text-dim transition-colors focus:border-acid/40 focus:outline-none";

export function SettingsClient({
  user,
  targets,
}: {
  user: SettingsUser;
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("profile");
  const [toast, setToast] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>(user.equipment);
  const [savingGear, startGear] = useTransition();
  const [savingProfile, startProfile] = useTransition();
  const [savingTargets, startTargets] = useTransition();
  const [leaving, startLeave] = useTransition();

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function toggleGear(id: string) {
    setEquipment((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function saveGear() {
    startGear(async () => {
      await updateEquipment(equipment);
      ping("Equipment updated. Tomorrow's session re-planned.");
      router.refresh();
    });
  }

  function submitProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startProfile(async () => {
      await updateProfile(fd);
      ping("Profile saved.");
      router.refresh();
    });
  }

  function submitTargets(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTargets(async () => {
      await updateTargets(fd);
      ping("Targets saved. Macro ring recalculated.");
      router.refresh();
    });
  }

  function leave() {
    startLeave(async () => {
      await signOut();
    });
  }

  const levelProgress = ((user.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const gearCount = equipment.length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* SIDEBAR */}
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className="surface overflow-hidden rounded-2xl">
          <div className="relative border-b border-white/[0.07] p-5">
            <div className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.12),transparent_65%)]" />
            <div className="relative flex items-center gap-3">
              <Avatar initials={user.initials} accent={user.accent} size={52} ring />
              <div className="min-w-0">
                <p className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-chalk">{user.name}</p>
                <p className="truncate font-mono text-[9px] text-dim">@{user.handle}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone="acid">Lv {user.level}</Badge>
                  <span className="flex items-center gap-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-flame">
                    <Flame className="size-2.5" /> {user.streak}d
                  </span>
                </div>
              </div>
            </div>
            <div className="relative mt-4">
              <div className="mb-1 flex items-center justify-between font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
                <span>Level {user.level}</span>
                <span>{user.xp % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</span>
              </div>
              <ProgressBar value={levelProgress} color="#C9F73A" height={4} />
            </div>
          </div>

          <nav className="p-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[11.5px] font-medium transition-colors",
                    tab === t.key ? "bg-white/[0.06] text-chalk" : "text-dim hover:bg-white/[0.03] hover:text-mist",
                  )}
                >
                  <Icon className={cn("size-3.5", tab === t.key ? "text-acid" : "text-dim")} />
                  <span className="flex-1">{t.label}</span>
                  {tab === t.key && <ChevronRight className="size-3 text-dim" />}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.07] p-3">
            <button
              onClick={leave}
              disabled={leaving}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium text-dim transition-colors hover:bg-flame/[0.06] hover:text-flame"
            >
              {leaving ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />} Sign out
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-[linear-gradient(140deg,rgba(201,247,58,0.06),transparent)] p-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-acid" />
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-acid">System status</p>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-dim">
            Adaptive engine synced. {gearCount} equipment types feed the swap algorithm.
          </p>
        </div>
      </aside>

      {/* CONTENT */}
      <div className="lg:col-span-8 xl:col-span-9">
        {tab === "profile" && (
          <form onSubmit={submitProfile} className="surface rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-mono mb-1.5">Identity</p>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.03em] text-chalk">Your profile</h2>
                <p className="mt-1 text-[11px] text-dim">This is what your coach, leaderboard and PR cards use.</p>
              </div>
              <Button type="submit" size="md" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save changes
              </Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <input name="name" defaultValue={user.name} maxLength={60} className={inputCls} />
              </Field>
              <Field label="Handle">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-dim">@</span>
                  <input value={user.handle} readOnly className={cn(inputCls, "pl-7 text-mist")} />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Bio" hint="120 characters shown on your profile">
                  <textarea
                    name="bio"
                    defaultValue={user.bio ?? ""}
                    maxLength={200}
                    rows={3}
                    placeholder="Trained for the mirror. Stayed for the numbers."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-chalk placeholder:text-dim focus:border-acid/40 focus:outline-none"
                  />
                </Field>
              </div>
              <Field label="Goal">
                <select name="goal" defaultValue={user.goal} className={inputCls}>
                  {GOALS.map((g) => <option key={g.value} value={g.value} className="bg-panel">{g.label}</option>)}
                </select>
              </Field>
              <Field label="Training age">
                <select name="experience" defaultValue={user.experience} className={inputCls}>
                  {EXPERIENCE.map((x) => <option key={x.value} value={x.value} className="bg-panel">{x.label}</option>)}
                </select>
              </Field>
              <Field label="Bodyweight" hint="kg">
                <input name="weightKg" type="number" step="0.1" min={30} max={250} defaultValue={user.weightKg} className={inputCls} />
              </Field>
              <Field label="Height" hint="cm">
                <input name="heightCm" type="number" step="0.5" min={120} max={230} defaultValue={user.heightCm} className={inputCls} />
              </Field>
              <Field label="Units">
                <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                  {[{ v: "kg", l: "Kilograms" }, { v: "lb", l: "Pounds" }].map((u) => (
                    <label key={u.v} className="flex-1 cursor-pointer">
                      <input type="radio" name="unitPref" value={u.v} defaultChecked={user.unitPref === u.v} className="peer sr-only" />
                      <span className="flex h-8 items-center justify-center rounded-lg text-[10.5px] font-medium text-dim transition-colors peer-checked:bg-white/10 peer-checked:text-chalk">
                        {u.l}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Email">
                <input value={user.email} readOnly className={cn(inputCls, "text-mist")} />
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-[10px] text-dim">
              <BadgeCheck className="size-3.5 shrink-0 text-mint" />
              Bodyweight changes automatically re-scale your strength standards and calorie targets.
            </div>
          </form>
        )}

        {tab === "training" && (
          <div className="surface rounded-2xl p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-mono mb-1.5">Training environment</p>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.03em] text-chalk">What can you train with?</h2>
                <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-dim">
                  Check everything you have access to. Forge swaps any unavailable movement for a same-pattern alternative instead of skipping it.
                </p>
              </div>
              <Badge tone="neutral"><Dumbbell className="size-2.5" /> {gearCount} selected</Badge>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {EQUIPMENT.map((item) => {
                const on = equipment.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleGear(item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                      on ? "border-acid/25 bg-acid/[0.05]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <span className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-lg border",
                      on ? "border-acid/30 bg-acid/10 text-acid" : "border-white/[0.07] bg-white/[0.02] text-dim",
                    )}>
                      {on ? <Check className="size-3.5" /> : <Dumbbell className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-chalk">{item.label}</p>
                      <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.08em] text-dim">{item.note}</p>
                    </div>
                    <span className={cn("size-4 rounded-full border", on ? "border-acid bg-acid" : "border-white/20")} />
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
              <div className="flex items-center gap-2 text-[10.5px] text-dim">
                <Zap className="size-3.5 text-amber" />
                Changing equipment re-plans tomorrow&apos;s session instantly.
              </div>
              <Button onClick={saveGear} disabled={savingGear} size="md">
                {savingGear ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save equipment
              </Button>
            </div>
          </div>
        )}

        {tab === "nutrition" && (
          <form onSubmit={submitTargets} className="space-y-4">
            <div className="surface rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-mono mb-1.5">Daily targets</p>
                  <h2 className="font-display text-[22px] font-bold tracking-[-0.03em] text-chalk">Fuel the work</h2>
                  <p className="mt-1 text-[11px] text-dim">Used by the macro ring, protein-gap generator and coach.</p>
                </div>
                <Button type="submit" size="md" disabled={savingTargets}>
                  {savingTargets ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save targets
                </Button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { name: "calories", label: "Calories", unit: "kcal", value: targets.calories, color: "#FFD166" },
                  { name: "protein", label: "Protein", unit: "g", value: targets.protein, color: "#C9F73A" },
                  { name: "carbs", label: "Carbs", unit: "g", value: targets.carbs, color: "#6EA8FF" },
                  { name: "fat", label: "Fat", unit: "g", value: targets.fat, color: "#FF8FA3" },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-dim">
                      <span className="size-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <input
                        name={m.name}
                        type="number"
                        min={0}
                        defaultValue={m.value}
                        className="w-full min-w-0 border-0 bg-transparent p-0 font-numeric text-[22px] font-bold tracking-[-0.04em] text-chalk focus:outline-none"
                      />
                      <span className="shrink-0 font-mono text-[9px] text-dim">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 max-w-xs">
                <Field label="Water target" hint="ml">
                  <input name="waterMl" type="number" min={500} step={100} defaultValue={targets.waterMl} className={inputCls} />
                </Field>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  { icon: Activity, label: "Protein floor", body: `${Math.round(targets.protein / Math.max(1, user.weightKg) * 10) / 10} g/kg bodyweight` },
                  { icon: Target, label: "Calorie split", body: `${Math.round((targets.protein * 4 / targets.calories) * 100)}% P · ${Math.round((targets.carbs * 4 / targets.calories) * 100)}% C · ${Math.round((targets.fat * 9 / targets.calories) * 100)}% F` },
                  { icon: Flame, label: "Goal", body: GOALS.find((g) => g.value === user.goal)?.label ?? "Hypertrophy" },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
                      <Icon className="size-3.5 shrink-0 text-acid" />
                      <div className="min-w-0">
                        <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">{row.label}</p>
                        <p className="truncate text-[10px] text-mist">{row.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        )}

        {tab === "account" && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-5 md:p-6">
              <p className="label-mono mb-1.5">Account</p>
              <h2 className="font-display text-[22px] font-bold tracking-[-0.03em] text-chalk">Signed in</h2>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar initials={user.initials} accent={user.accent} size={40} />
                  <div>
                    <p className="text-[12px] font-semibold text-chalk">{user.name}</p>
                    <p className="text-[10.5px] text-dim">{user.email}</p>
                  </div>
                </div>
                <Badge tone="mint"><BadgeCheck className="size-2.5" /> Verified</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-[10.5px] text-mist">Demo plan</span>
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-acid">Forge Pro · trial</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-[10.5px] text-mist">Data region</span>
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist">Local · SQLite</span>
                </div>
              </div>
            </div>

            <div className="surface rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-sky" />
                <h3 className="font-display text-[17px] font-bold tracking-[-0.02em] text-chalk">Notifications</h3>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { label: "Rest timer alerts", on: true },
                  { label: "Weekly progress digest", on: true },
                  { label: "Streak protection", on: true },
                  { label: "Community replies", on: false },
                ].map((n) => (
                  <div key={n.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                    <span className="text-[10.5px] text-mist">{n.label}</span>
                    <span className={cn("relative h-4 w-7 rounded-full transition-colors", n.on ? "bg-acid" : "bg-white/15")}>
                      <span className={cn("absolute top-0.5 size-3 rounded-full bg-ink transition-all", n.on ? "left-3.5" : "left-0.5")} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">Demo toggles — preferences UI preview</p>
            </div>

            <div className="rounded-2xl border border-flame/15 bg-flame/[0.03] p-5">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-flame" />
                <p className="text-[12px] font-semibold text-chalk">Session &amp; data</p>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-dim">
                Signing out clears the local session cookie. Your training data stays in the local Forge database so you can pick up where you left off.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => ping("Export queued (demo).")}>
                  Export my data
                </Button>
                <Button variant="ghost" size="sm" onClick={leave} disabled={leaving}>
                  {leaving ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />} Sign out
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { icon: Users, label: "Community", body: "Your posts and follows stay linked." },
            { icon: Activity, label: "Self-hosted", body: "One SQLite file. No vendor lock-in." },
            { icon: Sparkles, label: "Adaptive", body: "Every setting feeds the engine." },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <Icon className="mt-0.5 size-3.5 shrink-0 text-acid" />
                <div>
                  <p className="text-[10px] font-semibold text-chalk/85">{row.label}</p>
                  <p className="text-[9.5px] leading-relaxed text-dim">{row.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="animate-fade-up fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-acid/30 bg-panel-3 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-acid shadow-2xl md:bottom-6">
          <Check className="mr-1.5 inline size-3" /> {toast}
        </div>
      )}
    </div>
  );
}
