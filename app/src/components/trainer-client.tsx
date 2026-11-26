"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Copy,
  Download,
  Eye,
  Flame,
  FolderOpen,
  GitCompare,
  MessageSquarePlus,
  QrCode,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  AthleteClient,
  INITIAL_ATHLETES,
  INITIAL_ROUTINE_FOLDERS,
  appendCoachNoteToAthlete,
  batchPrescribeProgram,
  createAthleteClient,
  prescribeProgramToAthlete,
  updateAthleteReadiness,
} from "@/lib/b2b-portal";
import {
  applyBuiltinProgramToPlan,
  loadPlanState,
  savePlanState,
} from "@/lib/plan-store";
import { BUILTIN_PROGRAMS } from "@/lib/programs-db";
import { Avatar, Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

const TRAINER_STORAGE_KEY = "forge_trainer_portal_v1";
const TRAINER_INVITE_CODE = "TRN-FORGE-8842";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type LiveAthleteSummary = {
  completedWorkouts: number;
  weekSets: number;
  prCount: number;
  latestWeightKg: number;
  recentWorkouts: {
    id: string;
    name: string;
    dateLabel: string;
    readiness: number | null;
  }[];
};

type TrainerClientProps = {
  liveUserAthlete?: AthleteClient;
  liveSummary?: LiveAthleteSummary;
  slugToId?: [string, string][];
};

type PersistedTrainerState = {
  athletes: AthleteClient[];
  activeFolderId: string;
  compareIds: string[];
};

function mergeRoster(liveUser: AthleteClient | undefined, roster: AthleteClient[]): AthleteClient[] {
  if (!liveUser) return roster;
  const exists = roster.some((a) => a.id === liveUser.id);
  if (exists) {
    return roster.map((a) => (a.id === liveUser.id ? { ...a, streakDays: liveUser.streakDays, lastSessionDate: liveUser.lastSessionDate } : a));
  }
  return [liveUser, ...roster];
}

function computeWeekDots(athlete: AthleteClient): boolean[] {
  const activeDays = Math.max(1, Math.min(7, Math.round((athlete.adherenceRate / 100) * 6)));
  const pattern = [0, 2, 4, 5, 1, 3, 6];
  const on = new Set(pattern.slice(0, activeDays));
  return WEEKDAY_LABELS.map((_, idx) => on.has(idx));
}

export function TrainerClient({
  liveUserAthlete,
  liveSummary,
  slugToId = [],
}: TrainerClientProps) {
  const initialRoster = useMemo(
    () => (liveUserAthlete ? [liveUserAthlete, ...INITIAL_ATHLETES] : INITIAL_ATHLETES),
    [liveUserAthlete]
  );

  const [athletes, setAthletes] = useState<AthleteClient[]>(initialRoster);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteClient | null>(null);
  const [detailAthleteId, setDetailAthleteId] = useState<string | null>(null);
  const [newCoachNote, setNewCoachNote] = useState("");

  const [filter, setFilter] = useState<"all" | "high_risk" | "sub_90">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Routine folders organizer (GYM-One)
  const [activeFolderId, setActiveFolderId] = useState<string>(INITIAL_ROUTINE_FOLDERS[0].id);

  // Batch program assignment state (laragym + GYM-One)
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Client Progress Comparison drawer state
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>(["ath-1", "ath-2", "ath-6"]);

  // Prescription modal state
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [rxTargetAthleteId, setRxTargetAthleteId] = useState<string>(initialRoster[0]?.id ?? "");
  const [rxProgramId, setRxProgramId] = useState(BUILTIN_PROGRAMS[0].id);
  const [rxIntensityMultiplier, setRxIntensityMultiplier] = useState(1.0);
  const [rxFocusCue, setRxFocusCue] = useState("Focus on explosive intent on the concentric.");
  const [syncToUserPlan, setSyncToUserPlan] = useState(true);

  // Connect Athlete & Invite Sheet modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addTier, setAddTier] = useState<"elite_coached" | "pro">("elite_coached");
  const [addProgramId, setAddProgramId] = useState(BUILTIN_PROGRAMS[0].id);
  const [addReadiness, setAddReadiness] = useState(85);
  const [addNote, setAddNote] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [planSyncedBanner, setPlanSyncedBanner] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const slugMap = useMemo(() => new Map(slugToId), [slugToId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRAINER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedTrainerState>;
        if (Array.isArray(parsed.athletes) && parsed.athletes.length > 0) {
          setAthletes(mergeRoster(liveUserAthlete, parsed.athletes));
        }
        if (parsed.activeFolderId && INITIAL_ROUTINE_FOLDERS.some((f) => f.id === parsed.activeFolderId)) {
          setActiveFolderId(parsed.activeFolderId);
        }
        if (Array.isArray(parsed.compareIds) && parsed.compareIds.length > 0) {
          setCompareIds(parsed.compareIds);
        }
      }
    } catch {}
    hydratedRef.current = true;
  }, [liveUserAthlete]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const payload: PersistedTrainerState = {
        athletes,
        activeFolderId,
        compareIds,
      };
      localStorage.setItem(TRAINER_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [athletes, activeFolderId, compareIds]);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const detailAthlete = useMemo(
    () => athletes.find((a) => a.id === detailAthleteId) ?? null,
    [athletes, detailAthleteId]
  );

  // Filter athletes
  const filteredAthletes = athletes.filter((ath) => {
    const matchesSearch =
      ath.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ath.currentProgramName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === "high_risk") return ath.fatigueRisk === "high";
    if (filter === "sub_90") return ath.adherenceRate < 90;
    return true;
  });

  const handleOpenRx = (ath: AthleteClient, overrideProgramId?: string) => {
    setSelectedAthlete(ath);
    setRxTargetAthleteId(ath.id);
    if (overrideProgramId) setRxProgramId(overrideProgramId);
    setSyncToUserPlan(ath.id === liveUserAthlete?.id);
    setRxModalOpen(true);
  };

  const handleOpenTemplateModal = (programId: string) => {
    setRxProgramId(programId);
    if (batchSelectedIds.length > 0) {
      setIsBatchModalOpen(true);
      return;
    }
    const target = athletes.find((a) => a.id === rxTargetAthleteId) ?? athletes[0] ?? null;
    if (target) {
      handleOpenRx(target, programId);
    }
  };

  const handleApplyRx = () => {
    const targetAthlete = athletes.find((a) => a.id === rxTargetAthleteId) ?? selectedAthlete;
    if (!targetAthlete) return;
    const targetProgram = BUILTIN_PROGRAMS.find((p) => p.id === rxProgramId) || BUILTIN_PROGRAMS[0];
    const updated = prescribeProgramToAthlete(
      targetAthlete,
      targetProgram.id,
      targetProgram.name,
      rxIntensityMultiplier,
      rxFocusCue
    );

    setAthletes((prev) => prev.map((a) => (a.id === targetAthlete.id ? updated : a)));
    setSelectedAthlete(updated);
    if (syncToUserPlan) {
      const nextPlan = applyBuiltinProgramToPlan(loadPlanState(), targetProgram, slugMap);
      savePlanState(nextPlan);
      setPlanSyncedBanner(targetProgram.name);
    }
    setRxModalOpen(false);
    notify(
      syncToUserPlan
        ? `Prescribed ${targetProgram.name} to ${targetAthlete.name} & updated FORGE Plan!`
        : `Prescribed ${targetProgram.name} to ${targetAthlete.name}!`
    );
  };

  const toggleBatchSelect = (id: string) => {
    setBatchSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyBatchRx = () => {
    if (batchSelectedIds.length === 0) return;
    const targetProgram = BUILTIN_PROGRAMS.find((p) => p.id === rxProgramId) || BUILTIN_PROGRAMS[0];
    const updated = batchPrescribeProgram(
      athletes,
      batchSelectedIds,
      targetProgram.id,
      targetProgram.name,
      rxIntensityMultiplier,
      rxFocusCue
    );
    setAthletes(updated);
    if (syncToUserPlan || (liveUserAthlete && batchSelectedIds.includes(liveUserAthlete.id))) {
      const nextPlan = applyBuiltinProgramToPlan(loadPlanState(), targetProgram, slugMap);
      savePlanState(nextPlan);
      setPlanSyncedBanner(targetProgram.name);
    }
    const count = batchSelectedIds.length;
    setBatchSelectedIds([]);
    setIsBatchModalOpen(false);
    notify(`Batch prescribed ${targetProgram.name} to ${count} athletes!`);
  };

  const handleAddAthlete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    const prog = BUILTIN_PROGRAMS.find((p) => p.id === addProgramId) ?? BUILTIN_PROGRAMS[0];
    const created = createAthleteClient({
      name: addName,
      email: addEmail,
      tier: addTier,
      currentProgramId: prog.id,
      currentProgramName: prog.name,
      readinessScore: addReadiness,
      existingCount: athletes.length,
      note: addNote,
    });
    setAthletes((prev) => [created, ...prev]);
    setAddModalOpen(false);
    setAddName("");
    setAddEmail("");
    setAddNote("");
    setDetailAthleteId(created.id);
    notify(`Added ${created.name} to coaching roster!`);
  };

  const handleSimulateInviteJoin = () => {
    const prog = BUILTIN_PROGRAMS[1] ?? BUILTIN_PROGRAMS[0];
    const joined = createAthleteClient({
      name: `Athlete #${athletes.length + 1} (QR Join)`,
      email: `athlete${athletes.length + 1}@forge.fit`,
      tier: "pro",
      currentProgramId: prog.id,
      currentProgramName: prog.name,
      readinessScore: 86,
      existingCount: athletes.length,
      note: `Connected via coach invite code ${TRAINER_INVITE_CODE}.`,
    });
    setAthletes((prev) => [joined, ...prev]);
    setInviteModalOpen(false);
    setDetailAthleteId(joined.id);
    notify(`${joined.name} paired via ${TRAINER_INVITE_CODE}!`);
  };

  const handleSaveCoachNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAthlete || !newCoachNote.trim()) return;
    const stamped = `${newCoachNote.trim()}`;
    setAthletes((prev) =>
      prev.map((a) => (a.id === detailAthlete.id ? appendCoachNoteToAthlete(a, stamped) : a))
    );
    setNewCoachNote("");
    notify(`Saved coach log note for ${detailAthlete.name}.`);
  };

  const handleSetReadiness = (athleteId: string, score: number) => {
    setAthletes((prev) =>
      prev.map((a) => (a.id === athleteId ? updateAthleteReadiness(a, score) : a))
    );
    notify(`Updated readiness to ${score}/100 & recalculated fatigue status.`);
  };

  const handleRemoveAthlete = (athleteId: string) => {
    const victim = athletes.find((a) => a.id === athleteId);
    if (!victim) return;
    setAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    setCompareIds((prev) => prev.filter((id) => id !== athleteId));
    setBatchSelectedIds((prev) => prev.filter((id) => id !== athleteId));
    if (detailAthleteId === athleteId) setDetailAthleteId(null);
    notify(`Removed ${victim.name} from roster.`);
  };

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(TRAINER_INVITE_CODE);
      notify(`Copied invite code ${TRAINER_INVITE_CODE}`);
    } catch {
      notify(`Invite code: ${TRAINER_INVITE_CODE}`);
    }
  };

  const handleResetDemo = () => {
    try {
      localStorage.removeItem(TRAINER_STORAGE_KEY);
    } catch {}
    setAthletes(initialRoster);
    setActiveFolderId(INITIAL_ROUTINE_FOLDERS[0].id);
    setCompareIds(["ath-1", "ath-2", "ath-6"]);
    setBatchSelectedIds([]);
    setDetailAthleteId(null);
    setPlanSyncedBanner(null);
    notify("Trainer roster reset to SQLite + baseline cohort.");
  };

  const toggleCompareAthlete = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const exportRosterCsv = () => {
    const headers = "Name,Email,Tier,Current Program,Adherence %,Streak Days,Readiness,Fatigue Risk\n";
    const rows = athletes
      .map(
        (a) =>
          `"${a.name}","${a.email}","${a.tier}","${a.currentProgramName}",${a.adherenceRate},${a.streakDays},${a.readinessScore},"${a.fatigueRisk}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `forge-athlete-roster-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exported ${athletes.length} athlete records to CSV.`);
  };

  const activeFolder =
    INITIAL_ROUTINE_FOLDERS.find((f) => f.id === activeFolderId) ?? INITIAL_ROUTINE_FOLDERS[0];
  const folderPrograms = BUILTIN_PROGRAMS.filter((p) => activeFolder.programIds.includes(p.id));
  const comparedAthletes = athletes.filter((a) => compareIds.includes(a.id));

  const avgAdherence = athletes.length
    ? Math.round(athletes.reduce((acc, a) => acc + a.adherenceRate, 0) / athletes.length)
    : 0;
  const topStreakAthlete = useMemo(
    () =>
      athletes.length > 0
        ? [...athletes].sort((a, b) => b.streakDays - a.streakDays)[0]
        : null,
    [athletes]
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] flex items-center gap-2.5 rounded-2xl border border-acid/30 bg-ink-2/95 px-4 py-3 shadow-2xl backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:max-w-md">
          <CheckCircle2 className="size-4 text-acid shrink-0" />
          <span className="text-[12.5px] font-medium text-chalk">{toastMessage}</span>
        </div>
      )}

      {/* Synced-to-Plan Confirmation Strip */}
      {planSyncedBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-acid/30 bg-acid/[0.07] px-4 py-2.5">
          <span className="text-[12px] text-chalk">
            <strong className="text-acid">Plan Synced:</strong> <strong>{planSyncedBanner}</strong> is now loaded into your active schedule.
          </span>
          <Link
            href="/app/programs"
            className="rounded-lg bg-acid px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink hover:brightness-95"
          >
            Open Plan &amp; Schedule →
          </Link>
        </div>
      )}

      {/* Top Controls & KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Active Athletes</p>
          <p className="font-numeric text-2xl font-bold text-chalk mt-1">{athletes.length}</p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <UserCheck className="size-3 text-acid" /> {liveUserAthlete ? "Live DB + cohort" : "100% active programs"}
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Avg Adherence</p>
          <p className="font-numeric text-2xl font-bold text-acid mt-1">{avgAdherence}%</p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <TrendingUp className="size-3 text-acid" /> Roster compliance
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Deload Candidates</p>
          <p className="font-numeric text-2xl font-bold text-flame mt-1">
            {athletes.filter((a) => a.fatigueRisk === "high").length}
          </p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <AlertTriangle className="size-3 text-flame" /> CNS readiness &lt; 55
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Top Streak</p>
          <p className="font-numeric text-2xl font-bold text-chalk mt-1">
            {topStreakAthlete ? `${topStreakAthlete.streakDays}d` : "0d"}
          </p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5 truncate">
            <Flame className="size-3 text-flame shrink-0" />{" "}
            {topStreakAthlete ? `${topStreakAthlete.name.split(" ")[0]} (${topStreakAthlete.adherenceRate}%)` : "No athletes"}
          </span>
        </div>
      </div>

      {/* Coach Routine Folders Organizer (GYM-One) */}
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1.5">
              <FolderOpen className="size-3" /> Routine Folders · GYM-One Library
            </span>
            <h3 className="text-base font-bold text-chalk mt-0.5">
              Curated Client Program Blueprints
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {INITIAL_ROUTINE_FOLDERS.map((folder) => {
              const isSelected = folder.id === activeFolder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-wider transition-all",
                    isSelected
                      ? "border-acid/50 bg-acid/15 text-acid font-bold"
                      : "border-white/10 bg-white/[0.02] text-mist hover:text-chalk"
                  )}
                >
                  <FolderOpen className="size-3" style={{ color: folder.accent }} />
                  {folder.name} ({folder.programIds.length})
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-dim mb-3">{activeFolder.description}</p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {folderPrograms.map((prog) => (
            <div
              key={prog.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/25 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-chalk">{prog.name}</p>
                <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
                  {prog.daysPerWeek}d/wk · {prog.weeks} weeks · {prog.level}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenTemplateModal(prog.id)}
                className="shrink-0 rounded-xl border border-acid/30 bg-acid/10 px-2.5 py-1 font-mono text-[9px] font-bold text-acid hover:bg-acid hover:text-ink transition-colors"
              >
                {batchSelectedIds.length > 0 ? `Assign (${batchSelectedIds.length})` : "Use Template"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filter, Search, Onboarding, Batch Actions, & Progress Comparison Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
              filter === "all" ? "bg-acid text-ink font-bold" : "border border-white/10 text-mist hover:text-chalk"
            }`}
          >
            All Athletes ({athletes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("high_risk")}
            className={`rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
              filter === "high_risk"
                ? "bg-flame text-chalk font-bold"
                : "border border-white/10 text-mist hover:text-chalk"
            }`}
          >
            Deload Needed ({athletes.filter((a) => a.fatigueRisk === "high").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("sub_90")}
            className={`rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
              filter === "sub_90"
                ? "bg-amber-400 text-ink font-bold"
                : "border border-white/10 text-mist hover:text-chalk"
            }`}
          >
            Adherence &lt; 90% ({athletes.filter((a) => a.adherenceRate < 90).length})
          </button>

          <button
            type="button"
            onClick={() => {
              if (batchSelectedIds.length === filteredAthletes.length) {
                setBatchSelectedIds([]);
              } else {
                setBatchSelectedIds(filteredAthletes.map((a) => a.id));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist hover:border-acid/40 hover:text-acid"
          >
            {batchSelectedIds.length === filteredAthletes.length && filteredAthletes.length > 0 ? (
              <CheckSquare className="size-3 text-acid" />
            ) : (
              <Square className="size-3" />
            )}
            {batchSelectedIds.length > 0 ? `Selected (${batchSelectedIds.length})` : "Select Filtered"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-dim" />
            <input
              type="text"
              placeholder="Search athlete or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-8 pr-3 py-1.5 text-[12px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
            />
          </div>

          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <UserPlus className="size-3.5" /> Connect Athlete
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setInviteModalOpen(true)}>
            <QrCode className="size-3.5" /> Invite Code
          </Button>

          <Button
            variant={compareOpen ? "primary" : "secondary"}
            size="sm"
            onClick={() => setCompareOpen((v) => !v)}
          >
            <GitCompare className="size-3.5" /> Compare ({comparedAthletes.length})
          </Button>

          {batchSelectedIds.length > 0 && (
            <Button size="sm" onClick={() => setIsBatchModalOpen(true)}>
              <Users className="size-3.5" /> Batch Assign ({batchSelectedIds.length})
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={exportRosterCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>

          <button
            type="button"
            onClick={handleResetDemo}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-wider text-dim hover:border-white/25 hover:text-chalk transition-colors"
            title="Reset roster changes"
          >
            <RotateCcw className="size-3" /> Reset
          </button>
        </div>
      </div>

      {/* Athlete Progress Comparison Panel */}
      {compareOpen && (
        <div className="rounded-3xl border border-acid/30 bg-ink-2/80 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-white/[0.07] pb-3">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1.5">
                <GitCompare className="size-3" /> Side-by-Side Readiness &amp; Compliance
              </span>
              <h3 className="text-base font-bold text-chalk mt-0.5">
                Athlete Progress Comparison ({comparedAthletes.length}/3 selected)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {athletes.map((a) => {
                const picked = compareIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleCompareAthlete(a.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[8.5px] transition-colors",
                      picked
                        ? "border-acid bg-acid/15 text-acid font-bold"
                        : "border-white/10 text-dim hover:text-mist"
                    )}
                  >
                    {a.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {comparedAthletes.map((ath) => (
              <div
                key={ath.id}
                className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar initials={ath.initials} accent={ath.avatarAccent} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-chalk">{ath.name}</p>
                    <p className="truncate font-mono text-[8.5px] text-dim">{ath.currentProgramName}</p>
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[8.5px] uppercase text-dim">Adherence Rate</span>
                      <span className="font-numeric font-bold text-acid">{ath.adherenceRate}%</span>
                    </div>
                    <ProgressBar value={ath.adherenceRate} color="#C9F73A" height={5} />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[8.5px] uppercase text-dim">CNS Readiness</span>
                      <span
                        className={cn(
                          "font-numeric font-bold",
                          ath.readinessScore < 55 ? "text-flame" : "text-mint"
                        )}
                      >
                        {ath.readinessScore}/100
                      </span>
                    </div>
                    <ProgressBar
                      value={ath.readinessScore}
                      color={ath.readinessScore < 55 ? "#FF5E5B" : "#7BE0AD"}
                      height={5}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] font-mono text-[9px] text-dim">
                  <span>Streak: {ath.streakDays}d</span>
                  <span
                    className={cn(
                      "uppercase font-bold",
                      ath.fatigueRisk === "high"
                        ? "text-flame"
                        : ath.fatigueRisk === "medium"
                        ? "text-amber-300"
                        : "text-emerald-400"
                    )}
                  >
                    {ath.fatigueRisk} fatigue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Athletes Roster List */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredAthletes.map((ath) => {
          const isBatchSelected = batchSelectedIds.includes(ath.id);
          const isLiveUser = ath.id === "ath-live-user";
          const weekDots = computeWeekDots(ath);

          return (
            <div
              key={ath.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-4 transition-all",
                isBatchSelected
                  ? "border-acid/60 bg-acid/[0.04]"
                  : isLiveUser
                  ? "border-mint/30 bg-mint/[0.03] hover:border-mint/50"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
              )}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleBatchSelect(ath.id)}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded border transition-colors",
                        isBatchSelected
                          ? "border-acid bg-acid text-ink"
                          : "border-white/20 bg-white/[0.03] text-transparent hover:border-acid/50"
                      )}
                      aria-label={`Select ${ath.name} for batch prescription`}
                    >
                      <Check className="size-3 stroke-[3]" />
                    </button>
                    <Avatar initials={ath.initials} accent={ath.avatarAccent} size={36} />
                    <button
                      type="button"
                      onClick={() => setDetailAthleteId(ath.id)}
                      className="min-w-0 text-left group"
                    >
                      <h3 className="truncate text-sm font-semibold text-chalk group-hover:text-acid transition-colors">
                        {ath.name}
                      </h3>
                      <p className="truncate text-[10px] text-dim">{ath.email}</p>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isLiveUser && (
                      <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-mint">
                        Live DB
                      </span>
                    )}
                    {ath.fatigueRisk === "high" && (
                      <span className="flex items-center gap-1 rounded-full bg-flame/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-flame">
                        <AlertTriangle className="size-2.5" /> High
                      </span>
                    )}
                    {ath.fatigueRisk === "low" && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-emerald-400">
                        Optimal
                      </span>
                    )}
                    {ath.fatigueRisk === "medium" && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-300">
                        Elevated
                      </span>
                    )}
                  </div>
                </div>

                {/* Program & Adherence Metrics */}
                <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-mist truncate pr-2">{ath.currentProgramName}</span>
                    <span className="font-mono text-acid font-semibold">{ath.adherenceRate}%</span>
                  </div>
                  <ProgressBar value={ath.adherenceRate} color={ath.adherenceRate >= 90 ? "#C9F73A" : "#FFB020"} />

                  <div className="flex items-center justify-between pt-1 font-mono text-[9px] uppercase tracking-wider text-dim">
                    <span className="flex items-center gap-1">
                      <Flame className="size-3 text-flame" /> {ath.streakDays}d streak
                    </span>
                    <div className="flex items-center gap-1" title="Weekly session dots (Mon-Sun)">
                      {weekDots.map((hit, i) => (
                        <span
                          key={WEEKDAY_LABELS[i]}
                          className={cn(
                            "size-1.5 rounded-full",
                            hit ? "bg-acid" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <span>R: {ath.readinessScore}/100</span>
                  </div>
                </div>

                {/* Latest Coach Notes */}
                <div className="mt-3 space-y-1">
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Latest Coach Log</p>
                  <p className="text-[11px] text-mist line-clamp-2 italic">&ldquo;{ath.notes[0]}&rdquo;</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => setDetailAthleteId(ath.id)}
                  className="inline-flex items-center gap-1 font-mono text-[9.5px] text-mist hover:text-acid transition-colors"
                >
                  <Eye className="size-3" /> Inspect ({ath.notes.length})
                </button>
                <Button size="sm" variant="secondary" onClick={() => handleOpenRx(ath)}>
                  <ClipboardList className="size-3" /> Prescribe Plan
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Athlete Detail Drawer / Inspector Modal (openGym TrainerMember style) */}
      {detailAthlete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar initials={detailAthlete.initials} accent={detailAthlete.avatarAccent} size={46} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-acid">
                      {detailAthlete.tier.replace("_", " ")}
                    </span>
                    {detailAthlete.id === "ath-live-user" && (
                      <span className="rounded-full bg-mint/15 px-2 py-0.5 font-mono text-[8px] uppercase text-mint">
                        Synced with SQLite
                      </span>
                    )}
                  </div>
                  <h2 className="truncate text-xl font-bold text-chalk mt-0.5">{detailAthlete.name}</h2>
                  <p className="truncate text-[11.5px] text-dim">{detailAthlete.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailAthleteId(null)}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
                aria-label="Close athlete inspector"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* WeekDots & Adherence Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                    Weekly Sessions (Mon–Sun)
                  </span>
                  <span className="font-mono text-[10px] font-bold text-acid">{detailAthlete.adherenceRate}%</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {computeWeekDots(detailAthlete).map((hit, idx) => (
                    <div
                      key={WEEKDAY_LABELS[idx]}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl py-2 font-mono text-[9px]",
                        hit
                          ? "bg-acid/20 text-acid border border-acid/30 font-bold"
                          : "bg-white/[0.03] text-dim border border-white/[0.06]"
                      )}
                    >
                      <span>{WEEKDAY_LABELS[idx]}</span>
                      <span className="mt-1 text-[10px]">{hit ? "●" : "○"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-mist pt-1">
                  Active Plan: <strong className="text-chalk">{detailAthlete.currentProgramName}</strong>
                </p>
              </div>

              {/* Readiness Calibration */}
              <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                    CNS Readiness &amp; Fatigue
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[8.5px] uppercase font-bold",
                      detailAthlete.fatigueRisk === "high"
                        ? "bg-flame/20 text-flame"
                        : detailAthlete.fatigueRisk === "medium"
                        ? "bg-amber-400/20 text-amber-300"
                        : "bg-emerald-500/15 text-emerald-400"
                    )}
                  >
                    {detailAthlete.fatigueRisk} fatigue · {detailAthlete.readinessScore}/100
                  </span>
                </div>

                <ProgressBar
                  value={detailAthlete.readinessScore}
                  color={
                    detailAthlete.readinessScore < 55
                      ? "#FF5E5B"
                      : detailAthlete.readinessScore < 75
                      ? "#FFB020"
                      : "#C9F73A"
                  }
                />

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "Peak 90", val: 90 },
                    { label: "Steady 72", val: 72 },
                    { label: "Deload 48", val: 48 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleSetReadiness(detailAthlete.id, preset.val)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] text-mist hover:border-acid/40 hover:text-acid"
                    >
                      Set {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Real SQLite Telemetry (when viewing logged-in athlete) */}
            {detailAthlete.id === "ath-live-user" && liveSummary && (
              <div className="rounded-2xl border border-mint/25 bg-mint/[0.04] p-4 space-y-2.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-mint">
                  Live SQLite Workspace Telemetry
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-black/30 p-2">
                    <span className="font-mono text-[8px] uppercase text-dim block">Workouts</span>
                    <span className="font-numeric text-sm font-bold text-chalk">{liveSummary.completedWorkouts}</span>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2">
                    <span className="font-mono text-[8px] uppercase text-dim block">Week Sets</span>
                    <span className="font-numeric text-sm font-bold text-acid">{liveSummary.weekSets}</span>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2">
                    <span className="font-mono text-[8px] uppercase text-dim block">PR Records</span>
                    <span className="font-numeric text-sm font-bold text-chalk">{liveSummary.prCount}</span>
                  </div>
                  <div className="rounded-xl bg-black/30 p-2">
                    <span className="font-mono text-[8px] uppercase text-dim block">Bodyweight</span>
                    <span className="font-numeric text-sm font-bold text-chalk">{liveSummary.latestWeightKg} kg</span>
                  </div>
                </div>
              </div>
            )}

            {/* Coach Notes History & Input */}
            <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid">
                  Coaching Notes ({detailAthlete.notes.length})
                </span>
                <span className="font-mono text-[9px] text-dim">Last active: {detailAthlete.lastSessionDate}</span>
              </div>

              <form onSubmit={handleSaveCoachNote} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newCoachNote}
                  onChange={(e) => setNewCoachNote(e.target.value)}
                  placeholder="Write technical cue, load progression, or check-in note..."
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
                <Button type="submit" size="sm" className="shrink-0">
                  <MessageSquarePlus className="size-3.5" /> Add Note
                </Button>
              </form>

              <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                {detailAthlete.notes.map((n, idx) => (
                  <div
                    key={`${idx}-${n.slice(0, 12)}`}
                    className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11.5px] text-mist"
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
              {detailAthlete.id !== "ath-live-user" ? (
                <button
                  type="button"
                  onClick={() => handleRemoveAthlete(detailAthlete.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-flame/30 bg-flame/10 px-3 py-1.5 font-mono text-[9.5px] text-flame hover:bg-flame hover:text-ink transition-colors"
                >
                  <Trash2 className="size-3" /> Remove from Roster
                </button>
              ) : (
                <Link
                  href="/app/progress"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-1.5 font-mono text-[9.5px] text-mist hover:text-chalk"
                >
                  View Full Stats →
                </Link>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDetailAthleteId(null)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const target = detailAthlete;
                    setDetailAthleteId(null);
                    handleOpenRx(target);
                  }}
                >
                  <ClipboardList className="size-3.5" /> Prescribe Program
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Athlete Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
                  <UserPlus className="size-3" /> Roster Onboarding
                </span>
                <h2 className="text-lg font-bold text-chalk mt-0.5">Connect New Athlete</h2>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
                aria-label="Close connect athlete modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddAthlete} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Athlete Name
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Kiran Deshmukh"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="kiran@forge.fit"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                    Coaching Tier
                  </label>
                  <select
                    value={addTier}
                    onChange={(e) => setAddTier(e.target.value as "elite_coached" | "pro")}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                  >
                    <option value="elite_coached" className="bg-ink-2 text-chalk">Elite Coached</option>
                    <option value="pro" className="bg-ink-2 text-chalk">Pro Track</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                    Baseline Readiness
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={addReadiness}
                    onChange={(e) => setAddReadiness(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Initial Program Blueprint
                </label>
                <select
                  value={addProgramId}
                  onChange={(e) => setAddProgramId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-chalk focus:border-acid focus:outline-none"
                >
                  {BUILTIN_PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-ink-2 text-chalk">
                      {p.name} ({p.daysPerWeek}d/w)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1">
                  Initial Note (Optional)
                </label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="e.g. Prioritizing overhead mobility + hypertrophy."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="md">
                  <UserPlus className="size-3.5" /> Add to Roster
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OpenGym Style Trainer Invite Code Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
                  <QrCode className="size-3" /> OpenGym Pair Code
                </span>
                <h2 className="text-lg font-bold text-chalk mt-0.5">Pair Athlete Device</h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
                aria-label="Close invite modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center space-y-3">
              <div className="grid size-24 place-items-center rounded-2xl border border-acid/40 bg-acid/[0.08]">
                <QrCode className="size-14 text-acid" />
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Coach Invite Code</p>
                <p className="font-mono text-xl font-bold tracking-widest text-chalk mt-0.5">{TRAINER_INVITE_CODE}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleCopyInviteCode}>
                  <Copy className="size-3.5" /> Copy Code
                </Button>
                <Button size="sm" onClick={handleSimulateInviteJoin}>
                  <UserPlus className="size-3.5" /> Simulate QR Pair Join
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Modal (Single OR Batch) */}
      {(rxModalOpen || isBatchModalOpen) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
                  <Sparkles className="size-3" /> {isBatchModalOpen ? "Batch Cohort Prescription" : "Trainer Prescription"}
                </span>
                <h2 className="text-lg font-bold text-chalk mt-0.5">
                  {isBatchModalOpen
                    ? `Prescribe Program to ${batchSelectedIds.length} Athletes`
                    : `Prescribe Program to ${athletes.find((a) => a.id === rxTargetAthleteId)?.name ?? selectedAthlete?.name ?? "Athlete"}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRxModalOpen(false);
                  setIsBatchModalOpen(false);
                }}
                className="grid size-8 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
                aria-label="Close prescription modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {!isBatchModalOpen && (
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1.5">
                    Target Athlete
                  </label>
                  <select
                    value={rxTargetAthleteId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setRxTargetAthleteId(nextId);
                      setSyncToUserPlan(nextId === liveUserAthlete?.id);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-chalk focus:border-acid focus:outline-none"
                  >
                    {athletes.map((ath) => (
                      <option key={ath.id} value={ath.id} className="bg-ink-2 text-chalk">
                        {ath.name} ({ath.adherenceRate}% adh · {ath.readinessScore}/100 rdy)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1.5">
                  Select Training Program
                </label>
                <select
                  value={rxProgramId}
                  onChange={(e) => setRxProgramId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-chalk focus:border-acid focus:outline-none"
                >
                  {BUILTIN_PROGRAMS.map((prog) => (
                    <option key={prog.id} value={prog.id} className="bg-ink-2 text-chalk">
                      {prog.name} ({prog.weeks}w · {prog.daysPerWeek}d/w)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-mist">
                    Load Intensity Modifier
                  </label>
                  <span className="font-mono text-[11px] font-bold text-acid">
                    {Math.round(rxIntensityMultiplier * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="1.15"
                  step="0.05"
                  value={rxIntensityMultiplier}
                  onChange={(e) => setRxIntensityMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-[#C9F73A]"
                />
                <div className="flex justify-between font-mono text-[8px] uppercase tracking-wider text-dim mt-1">
                  <span>80% (Deload)</span>
                  <span>100% (Baseline)</span>
                  <span>115% (Peak Overload)</span>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-mist mb-1.5">
                  Coaching Focus / Biomechanical Cue
                </label>
                <textarea
                  rows={2}
                  value={rxFocusCue}
                  onChange={(e) => setRxFocusCue(e.target.value)}
                  placeholder="e.g. Prioritize paused reps on the chest; stay 1 rep in reserve."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 rounded-2xl border border-acid/25 bg-acid/[0.05] px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncToUserPlan}
                  onChange={(e) => setSyncToUserPlan(e.target.checked)}
                  className="size-4 accent-[#C9F73A]"
                />
                <span className="text-[11.5px] text-chalk">
                  Load this program into my active <strong>FORGE Plan &amp; Schedule</strong>
                </span>
              </label>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-dim">
                  {isBatchModalOpen ? "Selected Cohort" : "Athlete Context"}
                </p>
                {isBatchModalOpen ? (
                  <p className="text-[11px] text-mist mt-1">
                    Pushing to:{" "}
                    <strong className="text-chalk">
                      {athletes
                        .filter((a) => batchSelectedIds.includes(a.id))
                        .map((a) => a.name.split(" ")[0])
                        .join(", ")}
                    </strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-mist mt-1">
                    Readiness:{" "}
                    <strong className="text-chalk">
                      {(athletes.find((a) => a.id === rxTargetAthleteId) ?? selectedAthlete)?.readinessScore ?? "--"}/100
                    </strong>{" "}
                    · Current:{" "}
                    <strong className="text-chalk">
                      {(athletes.find((a) => a.id === rxTargetAthleteId) ?? selectedAthlete)?.currentProgramName ?? "--"}
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setRxModalOpen(false);
                  setIsBatchModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="md"
                onClick={isBatchModalOpen ? handleApplyBatchRx : handleApplyRx}
              >
                <Send className="size-3.5" />{" "}
                {isBatchModalOpen ? `Push to ${batchSelectedIds.length} Athletes` : "Save & Push Prescription"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
