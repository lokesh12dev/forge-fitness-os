"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { BODY_PATHS, INERT_SILHOUETTE_PARTS, type BodyView } from "@/lib/body-paths";
import { Activity, Dumbbell, Sparkles, User, X } from "lucide-react";

export function recoveryColor(pct: number) {
  if (pct >= 80) return "#C9F73A"; // Acid green: primed
  if (pct >= 60) return "#7BE0AD"; // Mint: ready
  if (pct >= 40) return "#FFD166"; // Amber: moderate
  return "#FF6B35"; // Flame: fatigued
}

export type MuscleRecoveryState = Record<
  string,
  { recovery: number; sets: number; lastTrained: number | null }
>;

export const MUSCLE_METADATA: Record<
  string,
  {
    name: string;
    scientific: string;
    recommended: string[];
    role: string;
  }
> = {
  chest: {
    name: "Chest",
    scientific: "Pectoralis Major & Minor",
    recommended: ["Barbell Bench Press", "Incline Dumbbell Press", "Dips", "Cable Flyes"],
    role: "Horizontal pushing & shoulder adduction",
  },
  back: {
    name: "Upper Back",
    scientific: "Trapezius & Rhomboids",
    recommended: ["Barbell Row", "Chest-Supported Row", "Face Pulls", "Deadlift"],
    role: "Scapular retraction & posture control",
  },
  lats: {
    name: "Lats",
    scientific: "Latissimus Dorsi",
    recommended: ["Pull-ups", "Lat Pulldown", "Single-Arm DB Row"],
    role: "Vertical pulling & shoulder extension",
  },
  shoulders: {
    name: "Shoulders",
    scientific: "Deltoids (Anterior, Lateral, Rear)",
    recommended: ["Overhead Press", "Lateral Raises", "Rear Delt Flyes"],
    role: "Shoulder abduction & overhead pressing",
  },
  biceps: {
    name: "Biceps",
    scientific: "Biceps Brachii & Brachialis",
    recommended: ["Incline Dumbbell Curl", "Barbell Curl", "Hammer Curls"],
    role: "Elbow flexion & forearm supination",
  },
  triceps: {
    name: "Triceps",
    scientific: "Triceps Brachii (3 Heads)",
    recommended: ["Close-Grip Bench", "Skull Crushers", "Cable Pushdowns"],
    role: "Elbow extension & lockout strength",
  },
  quads: {
    name: "Quads",
    scientific: "Quadriceps Femoris",
    recommended: ["Barbell Back Squat", "Leg Press", "Bulgarian Split Squat"],
    role: "Knee extension & squat drive",
  },
  hamstrings: {
    name: "Hamstrings",
    scientific: "Biceps Femoris & Semitendinosus",
    recommended: ["Romanian Deadlift", "Seated Leg Curl", "Glute Ham Raise"],
    role: "Hip extension & knee flexion",
  },
  glutes: {
    name: "Glutes",
    scientific: "Gluteus Maximus & Medius",
    recommended: ["Barbell Hip Thrust", "Deadlift", "Walking Lunges"],
    role: "Hip extension, abduction, & pelvis stabilization",
  },
  calves: {
    name: "Calves",
    scientific: "Gastrocnemius & Soleus",
    recommended: ["Standing Calf Raise", "Seated Calf Raise"],
    role: "Plantarflexion & ankle stability",
  },
  core: {
    name: "Core / Abs",
    scientific: "Rectus Abdominis & Obliques",
    recommended: ["Hanging Leg Raise", "Ab Wheel Rollout", "Cable Woodchop"],
    role: "Anti-extension, anti-rotation, & spinal stiffness",
  },
  forearms: {
    name: "Forearms",
    scientific: "Brachioradialis & Wrist Flexors",
    recommended: ["Farmer's Walks", "Wrist Curls", "Dead Hangs"],
    role: "Grip strength & wrist flexion",
  },
};

/**
 * Maps anatomical SVG path identifiers to FORGE canonical muscle keys.
 */
export function mapPathToMuscleKey(pathKey: string): string | null {
  switch (pathKey) {
    case "chest":
      return "chest";
    case "abs":
    case "obliques":
    case "serratus":
    case "hip-flexors":
      return "core";
    case "biceps":
      return "biceps";
    case "triceps":
      return "triceps";
    case "deltoids":
      return "shoulders";
    case "quadriceps":
    case "adductors":
      return "quads";
    case "calves":
      return "calves";
    case "trapezius":
    case "upper-back":
      return "back";
    case "lats":
      return "lats";
    case "lower-back":
      return "back";
    case "forearm":
      return "forearms";
    case "gluteal":
      return "glutes";
    case "hamstring":
      return "hamstrings";
    default:
      return null;
  }
}

export interface BodyMapProps {
  recovery?: MuscleRecoveryState;
  className?: string;
  onSelectMuscle?: (muscleKey: string) => void;
  selectedMuscle?: string | null;
  selectedMuscles?: string[];
  gender?: "male" | "female";
  view?: "both" | "front" | "back";
  interactive?: boolean;
  highlightColor?: string;
  showLabels?: boolean;
  showDetailsCard?: boolean;
  allowViewSwitch?: boolean;
  svgHeightClass?: string;
}

export function BodyMap({
  recovery,
  className,
  onSelectMuscle,
  selectedMuscle,
  selectedMuscles,
  gender: initialGender = "male",
  view: initialView = "both",
  interactive = true,
  highlightColor = "#C9F73A",
  showLabels = false,
  showDetailsCard = true,
  allowViewSwitch = true,
  svgHeightClass = "max-h-[300px]",
}: BodyMapProps) {
  const [gender, setGender] = useState<"male" | "female">(initialGender);
  const [viewMode, setViewMode] = useState<"both" | "front" | "back">(initialView);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const activeSelected = selectedMuscle !== undefined ? selectedMuscle : internalSelected;
  const activeSelectedList = selectedMuscles || (activeSelected ? [activeSelected] : []);

  const handleMuscleClick = (mKey: string) => {
    if (!interactive) return;
    const next = activeSelected === mKey ? null : mKey;
    setInternalSelected(next);
    if (onSelectMuscle) {
      onSelectMuscle(next ?? "all");
    }
  };

  const getRecovery = (mKey: string) => recovery?.[mKey]?.recovery ?? 100;

  const isMuscleSelected = (mKey: string) => activeSelectedList.includes(mKey);

  const renderSvgView = (viewKey: "front" | "back") => {
    const viewData: BodyView = BODY_PATHS[gender][viewKey];
    if (!viewData) return null;

    return (
      <svg
        viewBox={viewData.vb}
        className={cn("h-full w-auto max-w-full select-none drop-shadow-md", svgHeightClass)}
        role="img"
        aria-label={`${gender} ${viewKey} body anatomical muscle map`}
      >
        <defs>
          <filter id={`glow-${viewKey}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={highlightColor} floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Inert Anatomical Silhouette Parts */}
        {INERT_SILHOUETTE_PARTS.map((slug) => {
          const paths = viewData.p[slug] || [];
          return paths.map((d, i) => (
            <path
              key={`inert-${slug}-${i}`}
              d={d}
              fill="#141922"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.8"
              pointerEvents="none"
            />
          ));
        })}

        {/* Interactive Muscle Layers */}
        {Object.entries(viewData.p).map(([pathKey, paths]) => {
          if (INERT_SILHOUETTE_PARTS.includes(slugToInert(pathKey))) return null;

          const mKey = mapPathToMuscleKey(pathKey);
          if (!mKey) {
            return paths.map((d, i) => (
              <path
                key={`neutral-${pathKey}-${i}`}
                d={d}
                fill="#161C26"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.8"
                pointerEvents="none"
              />
            ));
          }

          const selected = isMuscleSelected(mKey);
          const rec = getRecovery(mKey);
          const hasLoggedSets = (recovery?.[mKey]?.sets ?? 0) > 0;

          // Shading rule: selected > recovery-colored > resting charcoal
          let fill = "#1E2530";
          let opacity = 0.85;

          if (selected) {
            fill = highlightColor;
            opacity = 1;
          } else if (recovery) {
            fill = recoveryColor(rec);
            opacity = hasLoggedSets ? 0.95 : 0.45;
          }

          return (
            <g
              key={`muscle-${pathKey}`}
              onClick={() => handleMuscleClick(mKey)}
              className={cn(
                "transition-all duration-200",
                interactive ? "cursor-pointer hover:brightness-125" : "pointer-events-none"
              )}
            >
              {paths.map((d, i) => (
                <path
                  key={`${pathKey}-${i}`}
                  d={d}
                  fill={fill}
                  fillOpacity={opacity}
                  stroke={selected ? "#FFFFFF" : "rgba(255,255,255,0.15)"}
                  strokeWidth={selected ? 1.6 : 0.8}
                  filter={selected ? `url(#glow-${viewKey})` : undefined}
                >
                  <title>{`${MUSCLE_METADATA[mKey]?.name || mKey}: ${rec}% recovery`}</title>
                </path>
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  const selectedMeta = activeSelected ? MUSCLE_METADATA[activeSelected] : null;
  const selectedData = activeSelected && recovery ? recovery[activeSelected] : null;

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Gender & View Toggle Toolbar */}
      {interactive && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {/* View Mode Toggle: front, back, both */}
          {allowViewSwitch && (
            <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
              {(["both", "front", "back"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
                    viewMode === v ? "bg-white/15 text-chalk font-semibold" : "text-dim hover:text-mist"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {/* Gender Switcher */}
          <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
                  gender === g ? "bg-acid/15 text-acid font-semibold" : "text-dim hover:text-mist"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Anatomical Body Renderings */}
      <div className="relative flex items-center justify-center gap-4 sm:gap-6 py-1">
        {viewMode === "both" ? (
          <>
            <div className="flex flex-col items-center">
              {renderSvgView("front")}
              {showLabels && (
                <span className="font-mono text-[8.5px] uppercase tracking-widest text-dim mt-2">
                  Anterior (Front)
                </span>
              )}
            </div>
            <div className="flex flex-col items-center">
              {renderSvgView("back")}
              {showLabels && (
                <span className="font-mono text-[8.5px] uppercase tracking-widest text-dim mt-2">
                  Posterior (Back)
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            {renderSvgView(viewMode)}
            {showLabels && (
              <span className="font-mono text-[8.5px] uppercase tracking-widest text-dim mt-2">
                {viewMode === "front" ? "Anterior (Front)" : "Posterior (Back)"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selected Muscle Insight Drawer */}
      {showDetailsCard && selectedMeta && (
        <div className="animate-fade-in mt-4 w-full max-w-sm rounded-2xl border border-white/10 bg-panel/95 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-acid flex items-center gap-1">
                <Sparkles className="size-2.5" /> Anatomical Target
              </span>
              <h4 className="text-sm font-bold text-chalk mt-0.5">{selectedMeta.name}</h4>
              <p className="font-mono text-[10px] text-dim">{selectedMeta.scientific}</p>
            </div>
            {interactive && (
              <button
                type="button"
                onClick={() => {
                  setInternalSelected(null);
                  if (onSelectMuscle) onSelectMuscle("all");
                }}
                className="grid size-6 place-items-center rounded-full bg-white/5 text-mist hover:text-chalk"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-black/25 p-2.5">
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">Biomechanics</span>
            <p className="text-[11px] text-mist mt-0.5 leading-snug">{selectedMeta.role}</p>
          </div>

          {selectedData && (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
              <span className="text-[11px] text-mist">Recovery Index</span>
              <span
                className="font-mono text-[11px] font-bold"
                style={{ color: recoveryColor(selectedData.recovery) }}
              >
                {selectedData.recovery}% Primed
              </span>
            </div>
          )}

          <div className="mt-3">
            <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
              Key Exercise Matches:
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {selectedMeta.recommended.map((ex) => (
                <span
                  key={ex}
                  className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[9.5px] text-chalk"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function slugToInert(slug: string): (typeof INERT_SILHOUETTE_PARTS)[number] {
  return slug as any;
}

export function MiniBodyMap({
  primaryMuscle,
  secondaryMuscles = [],
  gender = "male",
  view,
  className = "h-14 w-auto",
}: {
  primaryMuscle: string;
  secondaryMuscles?: string[];
  gender?: "male" | "female";
  view?: "front" | "back";
  className?: string;
}) {
  const isPosterior = ["back", "lats", "glutes", "hamstrings", "triceps", "calves"].includes(primaryMuscle);
  const viewKey: "front" | "back" = view || (isPosterior ? "back" : "front");
  const viewData = BODY_PATHS[gender][viewKey];
  if (!viewData) return null;

  return (
    <svg
      viewBox={viewData.vb}
      className={cn("select-none opacity-90", className)}
      role="img"
      aria-label={`Target muscle anatomy for ${primaryMuscle}`}
    >
      {/* Inert silhouette */}
      {INERT_SILHOUETTE_PARTS.map((slug) => {
        const paths: string[] = viewData.p[slug] || [];
        return paths.map((d: string, i: number) => (
          <path
            key={`mini-inert-${slug}-${i}`}
            d={d}
            fill="#121720"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.8"
          />
        ));
      })}

      {/* Muscle paths */}
      {Object.entries(viewData.p).map(([pathKey, rawPaths]) => {
        if (INERT_SILHOUETTE_PARTS.includes(slugToInert(pathKey))) return null;
        const paths = (rawPaths as string[]) || [];
        const mKey = mapPathToMuscleKey(pathKey);

        const isPrimary = mKey === primaryMuscle;
        const isSecondary = mKey ? secondaryMuscles.includes(mKey) : false;

        let fill = "#181E28";
        let opacity = 0.5;

        if (isPrimary) {
          fill = "#C9F73A";
          opacity = 1;
        } else if (isSecondary) {
          fill = "#7BE0AD";
          opacity = 0.85;
        }

        return paths.map((d: string, i: number) => (
          <path
            key={`mini-${pathKey}-${i}`}
            d={d}
            fill={fill}
            fillOpacity={opacity}
            stroke={isPrimary ? "#FFFFFF" : "rgba(255,255,255,0.1)"}
            strokeWidth={isPrimary ? 1.2 : 0.6}
          />
        ));
      })}
    </svg>
  );
}

export function RecoveryLegend({
  recovery,
  limit = 6,
  onSelect,
}: {
  recovery: MuscleRecoveryState;
  limit?: number;
  onSelect?: (muscleKey: string) => void;
}) {
  const rows = Object.entries(recovery)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => a.recovery - b.recovery)
    .slice(0, limit);

  return (
    <div className="w-full space-y-2.5">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onSelect && onSelect(r.key)}
          className="group w-full text-left transition-colors"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-chalk/80 group-hover:text-acid">
              {MUSCLE_METADATA[r.key]?.name ?? r.key}
            </span>
            <span className="font-numeric text-[10px]" style={{ color: recoveryColor(r.recovery) }}>
              {r.recovery}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${r.recovery}%`, background: recoveryColor(r.recovery) }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
