"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Download,
  Flame,
  FolderOpen,
  GitCompare,
  Search,
  Send,
  Sparkles,
  Square,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  AthleteClient,
  INITIAL_ATHLETES,
  INITIAL_ROUTINE_FOLDERS,
  batchPrescribeProgram,
  prescribeProgramToAthlete,
} from "@/lib/b2b-portal";
import { BUILTIN_PROGRAMS } from "@/lib/programs-db";
import { Avatar, Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";

export function TrainerClient() {
  const [athletes, setAthletes] = useState<AthleteClient[]>(INITIAL_ATHLETES);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteClient | null>(null);
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
  const [rxProgramId, setRxProgramId] = useState(BUILTIN_PROGRAMS[0].id);
  const [rxIntensityMultiplier, setRxIntensityMultiplier] = useState(1.0);
  const [rxFocusCue, setRxFocusCue] = useState("Focus on explosive intent on the concentric.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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

  const handleOpenRx = (ath: AthleteClient) => {
    setSelectedAthlete(ath);
    setRxModalOpen(true);
  };

  const handleApplyRx = () => {
    if (!selectedAthlete) return;
    const targetProgram = BUILTIN_PROGRAMS.find((p) => p.id === rxProgramId) || BUILTIN_PROGRAMS[0];
    const updated = prescribeProgramToAthlete(
      selectedAthlete,
      targetProgram.id,
      targetProgram.name,
      rxIntensityMultiplier,
      rxFocusCue
    );

    setAthletes((prev) => prev.map((a) => (a.id === selectedAthlete.id ? updated : a)));
    setSelectedAthlete(updated);
    setRxModalOpen(false);
    notify(`Prescribed ${targetProgram.name} to ${selectedAthlete.name}!`);
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
    const count = batchSelectedIds.length;
    setBatchSelectedIds([]);
    setIsBatchModalOpen(false);
    notify(`Batch prescribed ${targetProgram.name} to ${count} athletes!`);
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
  };

  const activeFolder =
    INITIAL_ROUTINE_FOLDERS.find((f) => f.id === activeFolderId) ?? INITIAL_ROUTINE_FOLDERS[0];
  const folderPrograms = BUILTIN_PROGRAMS.filter((p) => activeFolder.programIds.includes(p.id));
  const comparedAthletes = athletes.filter((a) => compareIds.includes(a.id));

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-acid/30 bg-ink-2/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="size-4 text-acid shrink-0" />
          <span className="text-[12.5px] font-medium text-chalk">{toastMessage}</span>
        </div>
      )}

      {/* Top Controls & KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Active Athletes</p>
          <p className="font-numeric text-2xl font-bold text-chalk mt-1">{athletes.length}</p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <UserCheck className="size-3 text-acid" /> 100% on active programs
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Avg Adherence</p>
          <p className="font-numeric text-2xl font-bold text-acid mt-1">
            {Math.round(athletes.reduce((acc, a) => acc + a.adherenceRate, 0) / athletes.length)}%
          </p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <TrendingUp className="size-3 text-acid" /> +3.2% vs last month
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
            {Math.max(...athletes.map((a) => a.streakDays))}d
          </p>
          <span className="text-[10px] text-mist flex items-center gap-1 mt-0.5">
            <Flame className="size-3 text-flame" /> Priya Nair (100% comp)
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
                onClick={() => {
                  setRxProgramId(prog.id);
                  if (batchSelectedIds.length > 0) {
                    setIsBatchModalOpen(true);
                  } else if (athletes[0]) {
                    handleOpenRx(athletes[0]);
                  }
                }}
                className="shrink-0 rounded-xl border border-acid/30 bg-acid/10 px-2.5 py-1 font-mono text-[9px] font-bold text-acid hover:bg-acid hover:text-ink transition-colors"
              >
                {batchSelectedIds.length > 0 ? `Assign (${batchSelectedIds.length})` : "Use Template"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filter, Search, Batch Actions, & Progress Comparison Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
              filter === "all" ? "bg-acid text-ink font-bold" : "border border-white/10 text-mist hover:text-chalk"
            }`}
          >
            All Athletes ({athletes.length})
          </button>
          <button
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
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-dim" />
            <input
              type="text"
              placeholder="Search athlete or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-8 pr-3 py-1.5 text-[12px] text-chalk placeholder:text-dim focus:border-acid focus:outline-none"
            />
          </div>

          <Button
            variant={compareOpen ? "primary" : "secondary"}
            size="sm"
            onClick={() => setCompareOpen((v) => !v)}
          >
            <GitCompare className="size-3.5" /> Compare ({compareIds.length})
          </Button>

          {batchSelectedIds.length > 0 && (
            <Button size="sm" onClick={() => setIsBatchModalOpen(true)}>
              <Users className="size-3.5" /> Batch Assign ({batchSelectedIds.length})
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={exportRosterCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
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
          return (
            <div
              key={ath.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-4 transition-all",
                isBatchSelected
                  ? "border-acid/60 bg-acid/[0.04]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
              )}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
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
                    <div>
                      <h3 className="text-sm font-semibold text-chalk">{ath.name}</h3>
                      <p className="text-[10px] text-dim">{ath.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {ath.fatigueRisk === "high" && (
                      <span className="flex items-center gap-1 rounded-full bg-flame/15 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-flame">
                        <AlertTriangle className="size-2.5" /> High Fatigue
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
                    <span>Readiness: {ath.readinessScore}/100</span>
                  </div>
                </div>

                {/* Latest Coach Notes */}
                <div className="mt-3 space-y-1">
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Latest Coach Log</p>
                  <p className="text-[11px] text-mist line-clamp-2 italic">&ldquo;{ath.notes[0]}&rdquo;</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="font-mono text-[9px] text-dim">{ath.lastSessionDate}</span>
                <Button size="sm" variant="secondary" onClick={() => handleOpenRx(ath)}>
                  <ClipboardList className="size-3" /> Prescribe Plan
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prescription Modal (Single OR Batch) */}
      {((rxModalOpen && selectedAthlete) || isBatchModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-ink-2 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-acid flex items-center gap-1">
                  <Sparkles className="size-3" /> {isBatchModalOpen ? "Batch Cohort Prescription" : "Trainer Prescription"}
                </span>
                <h2 className="text-lg font-bold text-chalk mt-0.5">
                  {isBatchModalOpen
                    ? `Prescribe Program to ${batchSelectedIds.length} Athletes`
                    : `Prescribe Program to ${selectedAthlete?.name}`}
                </h2>
              </div>
              <button
                onClick={() => {
                  setRxModalOpen(false);
                  setIsBatchModalOpen(false);
                }}
                className="grid size-8 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
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
                    Readiness: <strong className="text-chalk">{selectedAthlete?.readinessScore}/100</strong> · Current:{" "}
                    <strong className="text-chalk">{selectedAthlete?.currentProgramName}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
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
