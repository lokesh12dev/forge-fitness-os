import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { PlansOsClient } from "@/components/programs-client";

export default async function ProgramsPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const slugPairs: [string, string][] = ws.exercises.map((e) => [e.slug, e.id]);

  return (
    <PlansOsClient
      slugToId={slugPairs}
      activeWorkoutId={ws.activeWorkout?.id ?? null}
      weeklySetsCount={ws.weekSets.length}
    />
  );
}
