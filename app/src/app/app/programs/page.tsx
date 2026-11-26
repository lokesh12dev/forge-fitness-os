import { Layers, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { Badge, ButtonLink } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { ProgramsClient } from "@/components/programs-client";

export default async function ProgramsPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const enrolled = ws.enrolledRoutine;

  const totalWeeks = enrolled?.weeks ?? 8;
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.ceil(ws.completedWorkouts.length / Math.max(1, enrolled?.daysPerWeek ?? 5)))
  );
  const totalVolumeKg = ws.completedWorkouts.reduce((a, w) => a + w.totalVolume, 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid"><Layers className="size-2.5" /> Program engine</Badge>
            <span className="label-mono text-dim">Week {currentWeek} of {totalWeeks}</span>
          </>
        }
        title="Programs"
        subtitle="Structured progression with autoregulation built in. Choose from 10 battle-tested splits — every set adapts to your recovery."
        actions={
          <ButtonLink href="/app/train" size="md">
            <Play className="size-3.5" /> Train now
          </ButtonLink>
        }
      />

      <ProgramsClient
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        completedWorkoutsCount={ws.completedWorkouts.length}
        totalVolumeKg={totalVolumeKg}
        streakDays={user.streak}
        userAccent={user.accent}
      />
    </>
  );
}
