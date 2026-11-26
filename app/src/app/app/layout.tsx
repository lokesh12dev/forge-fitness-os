import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [activeWorkout] = await db
    .select({ id: schema.workouts.id, name: schema.workouts.name, startedAt: schema.workouts.startedAt })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
    .limit(1);

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        initials: user.initials,
        accent: user.accent,
        level: user.level,
        streak: user.streak,
        xp: user.xp,
        goal: user.goal,
      }}
      activeWorkout={
        activeWorkout
          ? {
              id: activeWorkout.id,
              name: activeWorkout.name,
              startedAt: new Date(activeWorkout.startedAt).toISOString(),
            }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
