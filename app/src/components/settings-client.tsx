"use client";

import { useEffect, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, BadgeCheck, Bell, Check, ChevronRight, CreditCard, Dumbbell, Flame,
  Globe, Heart, Loader2, Lock, LogOut, RefreshCw, Salad, Shield, ShieldAlert, ShieldCheck,
  Smartphone, Sparkles, Target, Trash2, UploadCloud, User, Users, Watch, Zap,
} from "lucide-react";
import { signOut, updateEquipment, updateProfile, updateTargets } from "@/app/actions";
import { Avatar, Badge, Button, ProgressBar } from "@/components/ui";
import { PLANS, mockRazorpayCheckout, mockStripeCheckout, type PlanTier } from "@/lib/plans";
import { formatUserLevel } from "@/lib/consistency";
import { CsvImportModal } from "@/components/csv-import-modal";
import {
  INITIAL_WEARABLES_STATE,
  performWearablesSync,
  type WearablesSyncState,
  type HealthPlatform,
} from "@/lib/wearables-sync";
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
  { key: "wearables", label: "Wearables & Sync", icon: Activity },
  { key: "plans", label: "Plans & Billing", icon: Zap },
  { key: "privacy", label: "Privacy & Data", icon: Shield },
  { key: "account", label: "Account", icon: BadgeCheck },
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [wearables, setWearables] = useState<WearablesSyncState>(INITIAL_WEARABLES_STATE);
  const [syncingWearables, setSyncingWearables] = useState(false);
  const [measureUnit, setMeasureUnit] = useState<"cm" | "in">("cm");
  const [defaultBarKg, setDefaultBarKg] = useState<number>(20);

  useEffect(() => {
    try {
      const m = localStorage.getItem("forge_measure_unit");
      if (m === "cm" || m === "in") setMeasureUnit(m);
      const b = Number(localStorage.getItem("forge_default_bar_kg"));
      if ([10, 15, 20, 25].includes(b)) setDefaultBarKg(b);
    } catch {
      /* ignore */
    }
  }, []);

  function updateMeasureUnit(unit: "cm" | "in") {
    setMeasureUnit(unit);
    try {
      localStorage.setItem("forge_measure_unit", unit);
    } catch {
      /* ignore */
    }
    ping(`Tape measurement unit set to ${unit === "cm" ? "Centimeters (cm)" : "Inches (in)"}.`);
  }

  function updateDefaultBarWeight(barKg: number) {
    setDefaultBarKg(barKg);
    try {
      localStorage.setItem("forge_default_bar_kg", String(barKg));
    } catch {
      /* ignore */
    }
    ping(`Default barbell set to ${barKg}kg (synced with Plate Calculator).`);
  }

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function handleWearablesSync() {
    setSyncingWearables(true);
    setTimeout(() => {
      const { state, readinessScore } = performWearablesSync(wearables);
      setWearables(state);
      setSyncingWearables(false);
      ping(`Synced with ${wearables.platform === "apple_health" ? "Apple Health" : "Health Connect"}: Readiness updated to ${readinessScore}/100.`);
    }, 600);
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

  const userLevelData = formatUserLevel(user.xp);
  const gearCount = equipment.length;
  const [plansCurrency, setPlansCurrency] = useState<"INR" | "USD">("INR");
  const [privacyVisibility, setPrivacyVisibility] = useState<"public" | "friends" | "private">("public");
  const [telemetryOptIn, setTelemetryOptIn] = useState(false);
  const [activePlan, setActivePlan] = useState<PlanTier>("pro");

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
                <span>Level {userLevelData.level}</span>
                <span>{userLevelData.progressPercent}% ({userLevelData.xpToNext} XP to next)</span>
              </div>
              <ProgressBar value={userLevelData.progressPercent} color="#C9F73A" height={4} />
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
              <Field label="Weight units">
                <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                  {[{ v: "kg", l: "Kilograms (kg)" }, { v: "lb", l: "Pounds (lb)" }].map((u) => (
                    <label key={u.v} className="flex-1 cursor-pointer">
                      <input type="radio" name="unitPref" value={u.v} defaultChecked={user.unitPref === u.v} className="peer sr-only" />
                      <span className="flex h-8 items-center justify-center rounded-lg text-[10.5px] font-medium text-dim transition-colors peer-checked:bg-white/10 peer-checked:text-chalk">
                        {u.l}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Tape measurement units" hint="Synced with Progress">
                <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                  {(
                    [
                      { v: "cm", l: "Centimeters (cm)" },
                      { v: "in", l: "Inches (in)" },
                    ] as const
                  ).map((u) => (
                    <button
                      key={u.v}
                      type="button"
                      onClick={() => updateMeasureUnit(u.v)}
                      className={cn(
                        "flex h-8 flex-1 items-center justify-center rounded-lg text-[10.5px] font-medium transition-colors",
                        measureUnit === u.v ? "bg-acid/15 text-acid font-semibold" : "text-dim hover:text-mist",
                      )}
                    >
                      {u.l}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email">
                  <input value={user.email} readOnly className={cn(inputCls, "text-mist")} />
                </Field>
              </div>
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

            {/* Default Barbell Specification Synced with Plate Calculator */}
            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-[12px] font-semibold text-chalk">Default Barbell Weight</p>
                  <p className="text-[10px] text-dim">Used as the starting bar weight in the Plate &amp; 1RM Calculator.</p>
                </div>
                <span className="font-mono text-[10px] font-bold text-acid">{defaultBarKg} kg bar</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { weight: 20, label: "20 kg Olympic", note: "Standard men's bar" },
                  { weight: 15, label: "15 kg Women's", note: "25mm grip shaft" },
                  { weight: 25, label: "25 kg Squat Bar", note: "Heavy power bar" },
                  { weight: 10, label: "10 kg Tech / EZ", note: "Technique & curl bar" },
                ].map((bar) => (
                  <button
                    key={bar.weight}
                    type="button"
                    onClick={() => updateDefaultBarWeight(bar.weight)}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-all",
                      defaultBarKg === bar.weight
                        ? "border-acid/40 bg-acid/10 text-chalk"
                        : "border-white/[0.08] bg-white/[0.02] text-dim hover:text-mist",
                    )}
                  >
                    <p className={cn("font-mono text-[11px] font-bold", defaultBarKg === bar.weight ? "text-acid" : "text-chalk")}>
                      {bar.label}
                    </p>
                    <p className="text-[9.5px] text-dim mt-0.5">{bar.note}</p>
                  </button>
                ))}
              </div>
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

        {/* WEARABLES & SYNC TAB (C3-C6, I5) */}
        {tab === "wearables" && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
                <div>
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-acid font-bold flex items-center gap-1.5">
                    <Activity className="size-3" /> Biometric Platform Integration (C3–C6, I5)
                  </span>
                  <h2 className="font-display text-[22px] font-bold tracking-tight text-chalk mt-0.5">
                    Wearables &amp; Health Sync
                  </h2>
                  <p className="mt-1 text-[11.5px] text-mist">
                    Bidirectional sync with Apple Health, Health Connect, and Garmin. Imports HRV, resting HR and sleep directly into the FORGE readiness engine.
                  </p>
                </div>

                <Button size="sm" variant="secondary" onClick={handleWearablesSync} disabled={syncingWearables}>
                  <RefreshCw className={cn("size-3.5", syncingWearables && "animate-spin")} />
                  {syncingWearables ? "Syncing Biometrics..." : "Sync Now"}
                </Button>
              </div>

              {/* Provider Selection */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { id: "apple_health", label: "Apple Health", sub: "HealthKit · iOS & Watch", icon: Heart },
                  { id: "health_connect", label: "Health Connect", sub: "Google · Android & Pixel", icon: Smartphone },
                  { id: "garmin", label: "Garmin Connect", sub: "Forerunner & Fenix series", icon: Watch },
                ].map((prov) => {
                  const Icon = prov.icon;
                  const isSelected = wearables.platform === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setWearables((prev) => ({ ...prev, platform: prov.id as HealthPlatform }));
                        ping(`Switched health provider to ${prov.label}.`);
                      }}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                        isSelected
                          ? "border-acid/60 bg-acid/[0.05]"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                      )}
                    >
                      <div className={cn("grid size-9 place-items-center rounded-xl", isSelected ? "bg-acid/20 text-acid" : "bg-white/5 text-mist")}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[12.5px] font-semibold text-chalk">{prov.label}</p>
                          {isSelected && <Badge tone="acid" dot>Active</Badge>}
                        </div>
                        <p className="text-[10px] text-dim mt-0.5">{prov.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Telemetry Display */}
              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                    Latest Biometric Packet · {wearables.lastTelemetry.syncedAt}
                  </span>
                  <span className="font-mono text-[9px] text-acid flex items-center gap-1">
                    <Check className="size-3" /> Encrypted on-device
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Resting HR</p>
                    <p className="font-numeric text-xl font-bold text-chalk mt-0.5">
                      {wearables.lastTelemetry.restingHeartRateBpm} <span className="text-xs text-dim">bpm</span>
                    </p>
                    <span className="font-mono text-[8px] text-emerald-400">Optimal (base 58)</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">HRV (SDNN)</p>
                    <p className="font-numeric text-xl font-bold text-acid mt-0.5">
                      {wearables.lastTelemetry.heartRateVariabilityMs} <span className="text-xs text-dim">ms</span>
                    </p>
                    <span className="font-mono text-[8px] text-acid">High vagal tone</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Sleep Duration</p>
                    <p className="font-numeric text-xl font-bold text-chalk mt-0.5">
                      {wearables.lastTelemetry.sleepDurationHours} <span className="text-xs text-dim">hrs</span>
                    </p>
                    <span className="font-mono text-[8px] text-mist">{wearables.lastTelemetry.sleepQualityScore}% efficiency</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Active Burn</p>
                    <p className="font-numeric text-xl font-bold text-flame mt-0.5">
                      {wearables.lastTelemetry.activeEnergyBurnedKcal} <span className="text-xs text-dim">kcal</span>
                    </p>
                    <span className="font-mono text-[8px] text-mist">{wearables.lastTelemetry.stepCount.toLocaleString()} steps</span>
                  </div>
                </div>
              </div>

              {/* Companion Watch & Offline Queue Toggles */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-3">
                    <Watch className="size-4 text-acid" />
                    <div>
                      <p className="text-[12px] font-semibold text-chalk">Wrist Quick-Log (2-Tap)</p>
                      <p className="text-[10px] text-dim">Log sets and reps from Apple Watch / Wear OS</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWearables((prev) => ({ ...prev, wristQuickLogEnabled: !prev.wristQuickLogEnabled }));
                      ping("Wrist quick-log preference updated.");
                    }}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      wearables.wristQuickLogEnabled ? "bg-acid" : "bg-white/15"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-ink transition-all",
                        wearables.wristQuickLogEnabled ? "left-4" : "left-0.5"
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-3">
                    <Bell className="size-4 text-sky" />
                    <div>
                      <p className="text-[12px] font-semibold text-chalk">Watch Rest Haptic Pulse</p>
                      <p className="text-[10px] text-dim">Taptic buzz on rest countdown expiry</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWearables((prev) => ({ ...prev, hapticFeedbackEnabled: !prev.hapticFeedbackEnabled }));
                      ping("Haptic pulse preference updated.");
                    }}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      wearables.hapticFeedbackEnabled ? "bg-acid" : "bg-white/15"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-ink transition-all",
                        wearables.hapticFeedbackEnabled ? "left-4" : "left-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLANS & BILLING TAB (I4) */}
        {tab === "plans" && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
                <div>
                  <span className="font-mono text-[8.5px] uppercase tracking-wider text-acid font-bold">
                    Subscription Tier &amp; Billing (I4)
                  </span>
                  <h2 className="font-display text-[22px] font-bold tracking-tight text-chalk mt-0.5">
                    Forge Platform Plans
                  </h2>
                </div>

                {/* Currency Switcher */}
                <div className="flex rounded-xl border border-white/[0.08] bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setPlansCurrency("INR")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors",
                      plansCurrency === "INR" ? "bg-acid text-ink font-bold" : "text-dim hover:text-mist",
                    )}
                  >
                    INR (₹) India
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlansCurrency("USD")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors",
                      plansCurrency === "USD" ? "bg-acid text-ink font-bold" : "text-dim hover:text-mist",
                    )}
                  >
                    USD ($) Global
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {(Object.keys(PLANS) as PlanTier[]).map((tierKey) => {
                  const plan = PLANS[tierKey];
                  const isCurrent = activePlan === tierKey;
                  const price =
                    plansCurrency === "INR"
                      ? plan.priceMonthlyInr === 0 ? "Free" : `₹${plan.priceMonthlyInr}`
                      : plan.priceMonthlyUsd === 0 ? "Free" : `$${plan.priceMonthlyUsd}`;

                  return (
                    <div
                      key={tierKey}
                      className={cn(
                        "relative flex flex-col justify-between rounded-2xl border p-4 transition-all",
                        plan.highlight
                          ? "border-acid/40 bg-acid/[0.04] shadow-[0_0_20px_rgba(201,247,58,0.06)]"
                          : "border-white/[0.08] bg-white/[0.015]",
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider font-semibold",
                              plan.highlight ? "bg-acid/20 text-acid" : "bg-white/10 text-dim",
                            )}
                          >
                            {plan.badge}
                          </span>
                          {isCurrent && (
                            <span className="rounded bg-mint/20 px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-wider text-mint font-bold">
                              Current Plan
                            </span>
                          )}
                        </div>

                        <h3 className="font-display text-lg font-bold text-chalk mt-2">{plan.name}</h3>
                        <p className="mt-1 text-[11px] text-mist">{plan.description}</p>

                        <div className="mt-3">
                          <span className="font-numeric text-2xl font-black text-chalk">{price}</span>
                          {price !== "Free" && <span className="font-mono text-[9px] text-dim ml-1">/mo</span>}
                        </div>

                        <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-mist">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <Check className="size-3 text-acid shrink-0 mt-0.5" />
                              <span className="leading-tight">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-5">
                        {isCurrent ? (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 font-mono text-[9.5px] uppercase tracking-wider text-dim"
                          >
                            Active Tier
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              if (plansCurrency === "INR") {
                                await mockRazorpayCheckout(tierKey);
                              } else {
                                await mockStripeCheckout(tierKey);
                              }
                              setActivePlan(tierKey);
                              ping(`Switched to ${plan.name} tier!`);
                            }}
                            className={cn(
                              "press w-full rounded-xl py-2 font-semibold text-[11.5px] transition-colors",
                              plan.highlight ? "bg-acid text-ink" : "bg-white/10 text-chalk hover:bg-white/15",
                            )}
                          >
                            {tierKey === "free" ? "Downgrade to Free" : "Upgrade Now"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PRIVACY & DATA SOVEREIGNTY TAB (I3) */}
        {tab === "privacy" && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-5 md:p-6">
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-mint font-bold">
                Data Sovereignty (I3)
              </span>
              <h2 className="font-display text-[22px] font-bold tracking-tight text-chalk mt-0.5">
                Privacy &amp; Data Ownership
              </h2>
              <p className="mt-1 text-[11.5px] text-mist">
                You own your physiological and workout telemetry. Zero ad tracking. No third-party data broker sales.
              </p>

              {/* Profile Visibility */}
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <span className="font-mono text-[9px] uppercase tracking-wider text-dim block mb-2">
                  Profile &amp; Leaderboard Visibility:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: "public", label: "Public", desc: "Appear on gym and public PR leaderboards" },
                    { id: "friends", label: "Friends Only", desc: "Visible only to mutual workout partners" },
                    { id: "private", label: "Private", desc: "Incognito mode: full logging without feed posts" },
                  ].map((vis) => (
                    <button
                      key={vis.id}
                      type="button"
                      onClick={() => {
                        setPrivacyVisibility(vis.id as any);
                        ping(`Visibility set to ${vis.label}`);
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-3 text-left transition-colors",
                        privacyVisibility === vis.id
                          ? "border-acid bg-acid/10 text-chalk"
                          : "border-white/[0.08] bg-white/[0.02] text-mist hover:border-white/20",
                      )}
                    >
                      <span className="font-semibold text-[12px] text-chalk">{vis.label}</span>
                      <span className="text-[10px] text-dim mt-0.5">{vis.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Telemetry & Cache Management */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[12px] font-medium text-chalk block">Crash &amp; Performance Telemetry</span>
                    <span className="text-[10px] text-dim">Anonymous performance traces without PII</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTelemetryOptIn(!telemetryOptIn);
                      ping(telemetryOptIn ? "Telemetry disabled" : "Telemetry enabled");
                    }}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      telemetryOptIn ? "bg-acid" : "bg-white/15",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-4 rounded-full bg-ink transition-all",
                        telemetryOptIn ? "left-4.5" : "left-0.5",
                      )}
                    />
                  </button>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[12px] font-medium text-chalk block">Reset Local Cache &amp; Queue</span>
                    <span className="text-[10px] text-dim">Purge IndexedDB snapshots &amp; sync queue</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => ping("Local IndexedDB cache refreshed.")}
                    className="press rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-mist hover:text-chalk"
                  >
                    Clear Cache
                  </button>
                </div>
              </div>

              {/* Universal Logger CSV Migration (A11) */}
              <div className="mt-4 rounded-2xl border border-acid/25 bg-acid/[0.04] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[13px] font-bold text-chalk flex items-center gap-2">
                    <UploadCloud className="size-4 text-acid" /> Migrate Workout History (A11)
                  </span>
                  <span className="text-[11px] text-mist mt-0.5 block">
                    Import historical sets and routines from Hevy, Strong, FitNotes, or Jefit CSV exports.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="press rounded-xl bg-acid px-4 py-2 font-mono text-[10.5px] font-bold text-ink hover:bg-[#b8e330] shrink-0 self-start sm:self-auto"
                >
                  Import CSV
                </button>
              </div>

              {/* Danger Zone */}
              <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-4">
                <div className="flex items-center gap-2 text-rose-400">
                  <ShieldAlert className="size-4" />
                  <span className="font-semibold text-[12px]">Danger Zone — Account Deletion</span>
                </div>
                <p className="mt-1 text-[11px] text-mist">
                  Permanently erase your account, workout history, PRs, and nutrition logs per GDPR &amp; DPDP requirements.
                </p>
                <button
                  type="button"
                  onClick={() => ping("Account deletion requires email confirmation.")}
                  className="press mt-3 flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 font-mono text-[9.5px] uppercase tracking-wider text-rose-300 hover:bg-rose-500/20"
                >
                  <Trash2 className="size-3" /> Request Account &amp; Data Purge
                </button>
              </div>
            </div>
          </div>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/api/export?format=json";
                      ping("Downloading full JSON export...");
                    }}
                  >
                    Export JSON
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/api/export?format=csv";
                      ping("Downloading sets CSV export...");
                    }}
                  >
                    Export CSV
                  </Button>
                </div>
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

      {/* CSV Import Modal (A11) */}
      <CsvImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => ping("Successfully imported historical workouts!")}
      />
    </div>
  );
}
