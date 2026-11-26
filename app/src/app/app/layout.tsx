import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
    >
      {children}
    </AppShell>
  );
}
