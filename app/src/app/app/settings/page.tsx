import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "@/components/settings-client";
import { Settings, ShieldCheck, Sparkles } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const targets = ws.targets;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="neutral"><Settings className="size-2.5" /> Control room</Badge>
            <Badge tone="mint"><ShieldCheck className="size-2.5" /> Local-first</Badge>
            <span className="label-mono text-dim">Changes apply instantly</span>
          </>
        }
        title="Settings."
        subtitle="The engine is only as good as its inputs. Tell Forge what you have, what you're chasing, and how much you eat — everything downstream re-plans in real time."
      />

      <SettingsClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          handle: user.handle,
          initials: user.initials,
          accent: user.accent,
          bio: user.bio,
          goal: user.goal,
          experience: user.experience,
          unitPref: user.unitPref,
          weightKg: user.weightKg,
          heightCm: user.heightCm,
          level: user.level,
          streak: user.streak,
          xp: user.xp,
          equipment: user.equipment,
        }}
        targets={{
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat,
          waterMl: targets.waterMl,
        }}
      />

      <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-dim">
        <Sparkles className="size-2.5 text-acid" /> Forge v1.0 · built to adapt
      </div>
    </>
  );
}
