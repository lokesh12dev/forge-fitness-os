"use client";

import { useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, Info, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { parseWorkoutCSV, type ImportResult } from "@/lib/workout-import-export";
import { cn } from "@/lib/utils";

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

const SAMPLE_HEVY_CSV = `Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps,RPE,Notes
"2026-11-20 09:30:00","Upper Body Push","Barbell Bench Press",1,80,8,8,"Warmup smooth"
"2026-11-20 09:30:00","Upper Body Push","Barbell Bench Press",2,85,8,8.5,"Solid bar path"
"2026-11-20 09:30:00","Upper Body Push","Barbell Bench Press",3,90,6,9,"Top set"
"2026-11-20 09:30:00","Upper Body Push","Overhead Press",1,50,8,8,"Strict standing"
"2026-11-20 09:30:00","Upper Body Push","Overhead Press",2,55,6,8.5,"Good velocity"
"2026-11-22 17:00:00","Lower Heavy","Barbell Back Squat",1,120,5,8,"Depth checked"
"2026-11-22 17:00:00","Lower Heavy","Barbell Back Squat",2,130,5,8.5,"Belt on"
"2026-11-22 17:00:00","Lower Heavy","Romanian Deadlift",1,100,8,8,"Full stretch"`;

const SAMPLE_STRONG_CSV = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Seconds,Notes
2026-11-15 10:15:00,Pull Day,Barbell Deadlift,1,140,5,8,0,"Felt light"
2026-11-15 10:15:00,Pull Day,Barbell Deadlift,2,150,5,8.5,0,"Chalk used"
2026-11-15 10:15:00,Pull Day,Barbell Row,1,75,8,8,0,"Chest braced"
2026-11-15 10:15:00,Pull Day,Pull Up,1,0,10,8.5,0,"Bodyweight clean"`;

export function CsvImportModal({ open, onClose, onImportComplete }: CsvImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedSuccess, setImportedSuccess] = useState(false);

  if (!open) return null;

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      const result = parseWorkoutCSV(text);
      setParsed(result);
    };
    reader.readAsText(file);
  }

  function loadPreset(sample: string, name: string) {
    setFileName(name);
    setCsvContent(sample);
    const result = parseWorkoutCSV(sample);
    setParsed(result);
  }

  function executeImport() {
    if (!parsed || parsed.totalWorkouts === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setImportedSuccess(true);
      if (onImportComplete) {
        onImportComplete(parsed);
      }
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="animate-scale-in relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-panel p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-acid/10 text-acid">
                <UploadCloud className="size-4" />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                Universal Logger Migration (A11)
              </span>
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-1">
              Import Historical Workouts
            </h3>
            <p className="text-[12px] text-mist mt-0.5">
              Switching from Hevy, Strong, FitNotes or Jefit? Drop your export CSV to migrate your entire history.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
          >
            <X className="size-4" />
          </button>
        </div>

        {!importedSuccess ? (
          <div className="mt-5 space-y-4">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                dragActive
                  ? "border-acid bg-acid/5"
                  : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
              )}
            >
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <FileSpreadsheet className="size-8 text-mist mb-2" />
              <p className="text-[13px] font-semibold text-chalk">
                {fileName ? fileName : "Drag & drop your CSV file here"}
              </p>
              <p className="text-[11px] text-dim mt-1">
                Supports Hevy, Strong, FitNotes, Jefit & Universal formats
              </p>
            </div>

            {/* Quick Test Presets */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-dim">
                Quick test fixtures:
              </span>
              <button
                type="button"
                onClick={() => loadPreset(SAMPLE_HEVY_CSV, "hevy_export_sample.csv")}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-chalk hover:bg-white/[0.08]"
              >
                Hevy Sample
              </button>
              <button
                type="button"
                onClick={() => loadPreset(SAMPLE_STRONG_CSV, "strong_export_sample.csv")}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-chalk hover:bg-white/[0.08]"
              >
                Strong Sample
              </button>
            </div>

            {/* Parsed Summary Card */}
            {parsed && parsed.totalWorkouts > 0 && (
              <div className="rounded-2xl border border-acid/20 bg-acid/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
                    Detected: {parsed.detectedSource.toUpperCase()} CSV
                  </span>
                  <span className="rounded-full bg-acid/15 px-2 py-0.5 font-numeric text-[10px] font-bold text-acid">
                    Ready to sync
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Workouts</p>
                    <p className="font-numeric text-base font-bold text-chalk mt-0.5">{parsed.totalWorkouts}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Total Sets</p>
                    <p className="font-numeric text-base font-bold text-chalk mt-0.5">{parsed.totalSets}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                    <p className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Total Volume</p>
                    <p className="font-numeric text-base font-bold text-chalk mt-0.5">
                      {(parsed.totalVolumeKg / 1000).toFixed(1)}k <span className="text-[10px] font-normal text-dim">kg</span>
                    </p>
                  </div>
                </div>

                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {parsed.workouts.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 text-[11px]">
                      <div>
                        <span className="font-medium text-chalk">{w.workoutName}</span>
                        <span className="text-dim ml-2 font-mono text-[10px]">{w.date.slice(0, 10)}</span>
                      </div>
                      <span className="font-mono text-[10px] text-acid font-semibold">
                        {w.exercises.length} lifts · {w.totalSets} sets
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-4">
              <button
                type="button"
                disabled={!parsed || parsed.totalWorkouts === 0 || isProcessing}
                onClick={executeImport}
                className={cn(
                  "press flex h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-[12.5px] transition-all",
                  parsed && parsed.totalWorkouts > 0
                    ? "bg-acid text-ink shadow-[0_0_20px_rgba(201,247,58,0.25)] hover:bg-[#b8e330]"
                    : "border border-white/10 bg-white/[0.04] text-dim cursor-not-allowed"
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Migrating Workout Records...
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4" /> Import {parsed?.totalWorkouts ?? 0} Workouts
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center py-4 space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-acid/15 text-acid">
              <Check className="size-6 stroke-[3]" />
            </div>
            <h4 className="font-display text-lg font-bold text-chalk">
              Import Successful!
            </h4>
            <p className="text-[12px] text-mist max-w-sm mx-auto">
              Successfully migrated {parsed?.totalWorkouts} sessions ({parsed?.totalSets} sets) into your FORGE training history. Personal records and volume curves have been updated.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="press mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-acid px-6 text-[12px] font-bold text-ink"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
