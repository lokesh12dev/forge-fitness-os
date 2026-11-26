import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { TrainerClient, type LiveAthleteSummary } from "@/components/trainer-client";
import {
  type AthleteClient,
  calculateAthleteAdherence,
  evaluateAthleteFatigueRisk,
} from "@/lib/b2b-portal";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { UserCheck } from "lucide-react";

function formatSessionStamp(value?: Date | number | string | null): string {
  if (!value) return "No completed session yet";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default async function TrainerPortalPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const lastWorkout = ws.completedWorkouts[0];
  const latestPr = ws.prs[0];
  const liveAdherence = calculateAthleteAdherence(ws.weekWorkouts.length, 4);
  const liveReadiness = ws.readiness;

  const liveNotes: string[] = [];
  if (latestPr) {
    const exName = ws.exerciseMap.get(latestPr.exerciseId)?.name ?? "Lift";
    liveNotes.push(`Latest PR recorded in SQLite: ${exName} — ${latestPr.value} kg × ${latestPr.reps} (${latestPr.type}).`);
  }
  if (lastWorkout) {
    liveNotes.push(`Last completed session: ${lastWorkout.name} (${ws.weekSets.length} sets this week).`);
  }
  if (liveNotes.length === 0) {
    liveNotes.push(`Live SQLite account synced · Readiness ${liveReadiness}/100.`);
  }

  const liveUserAthlete: AthleteClient = {
    id: "ath-live-user",
    name: `${user.name} (You · Live DB)`,
    initials: user.initials,
    avatarAccent: user.accent,
    email: user.email,
    tier: "elite_coached",
    currentProgramId: ws.enrolledRoutine?.id ?? "ppl-hypertrophy",
    currentProgramName: ws.enrolledRoutine?.name ?? "FORGE Adaptive Program",
    adherenceRate: Math.max(75, liveAdherence),
    streakDays: user.streak,
    lastSessionDate: formatSessionStamp(lastWorkout?.startedAt),
    readinessScore: liveReadiness,
    fatigueRisk: evaluateAthleteFatigueRisk(liveReadiness, 0),
    notes: liveNotes,
  };

  const liveSummary: LiveAthleteSummary = {
    completedWorkouts: ws.completedWorkouts.length,
    weekSets: ws.weekSets.length,
    prCount: ws.prs.length,
    latestWeightKg: ws.latestMetric?.weightKg ?? user.weightKg,
    recentWorkouts: ws.completedWorkouts.slice(0, 4).map((w) => ({
      id: w.id,
      name: w.name,
      dateLabel: formatSessionStamp(w.startedAt),
      readiness: w.readiness,
    })),
  };

  const slugPairs: [string, string][] = ws.exercises.map((e) => [e.slug, e.id]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>B2B Portal</Badge>
            <Badge tone="grape"><UserCheck className="size-2.5" /> Certified Coach</Badge>
            <span className="label-mono text-dim">SQLite Synced · RBAC Trainer</span>
          </>
        }
        title="Trainer roster & prescriptions."
        subtitle="Inspect athlete compliance and weekly consistency, manage readiness & coach notes, connect new clients via invite code, and push periodized training cycles straight to FORGE Plan."
      />

      <div className="mt-4">
        <TrainerClient
          liveUserAthlete={liveUserAthlete}
          liveSummary={liveSummary}
          slugToId={slugPairs}
        />
      </div>
    </>
  );
}
