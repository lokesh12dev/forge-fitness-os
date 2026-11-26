"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { PRCard } from "@/components/pr-card";

export type SharePR = {
  id: string;
  exercise: string;
  value: number;
  previous: number | null;
  weight: number;
  reps: number;
};

export function SummaryActions({
  user,
  prs,
}: {
  user: { name: string; initials: string };
  prs: SharePR[];
}) {
  const [active, setActive] = useState<SharePR | null>(null);
  return (
    <>
      {prs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {prs.map((pr) => (
            <button
              key={pr.id}
              onClick={() => setActive(pr)}
              className="press inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/[0.07] px-3 py-2 text-[11px] font-medium text-amber hover:bg-amber/[0.12]"
            >
              <Share2 className="size-3" /> Share {pr.exercise} PR
            </button>
          ))}
        </div>
      )}
      <PRCard
        open={!!active}
        onClose={() => setActive(null)}
        user={user}
        exercise={active?.exercise ?? ""}
        value={active?.value ?? 0}
        previous={active?.previous ?? null}
        weight={active?.weight ?? 0}
        reps={active?.reps ?? 0}
      />
    </>
  );
}

export function WorkoutWhatsAppShare({
  athleteName,
  workoutName,
  dateLabel,
  totalVolumeLabel,
  durationLabel,
  setsSummary,
  avgRpe,
  prCount,
  topSetSummary,
  streakDays,
}: {
  athleteName: string;
  workoutName: string;
  dateLabel: string;
  totalVolumeLabel: string;
  durationLabel: string;
  setsSummary: string;
  avgRpe: number;
  prCount: number;
  topSetSummary?: string;
  streakDays: number;
}) {
  const handleShare = () => {
    const text = `🏋️ *FORGE Session Summary · ${athleteName}*\n📌 *${workoutName}* (${dateLabel})\n\n📊 Volume: *${totalVolumeLabel} kg*\n⏱️ Duration: *${durationLabel}*\n✅ Working Sets: *${setsSummary}*${avgRpe ? ` @ Avg RPE ${avgRpe}` : ""}${topSetSummary ? `\n⚡ Top Set: *${topSetSummary}*` : ""}${prCount > 0 ? `\n🏆 New PRs Hit: *${prCount}*` : ""}\n🔥 Streak: *${streakDays}-day consistency*\n\nBuilt with FORGE · Train with precision`;
    if (typeof window !== "undefined") {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Share workout summary to WhatsApp (gymsmart.in)"
      className="press inline-flex h-10 items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-4 text-[12px] font-semibold text-mint hover:bg-mint/20 transition-colors"
    >
      <Share2 className="size-3.5" /> WhatsApp Summary
    </button>
  );
}
