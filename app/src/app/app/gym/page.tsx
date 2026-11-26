import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { GymClient, type GymDbFacilitySeed } from "@/components/gym-client";
import { type GymMemberCheckIn } from "@/lib/b2b-portal";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";
import { Building2 } from "lucide-react";

function formatCheckInTime(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default async function GymOwnerPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const dbGyms: GymDbFacilitySeed[] = ws.gyms.map((g) => ({
    id: g.id,
    name: g.name,
    city: g.city,
    memberCount: g.memberCount,
    busyness: g.busyness,
    accent: g.accent,
  }));

  const dbCheckins: GymMemberCheckIn[] = ws.checkins.slice(0, 12).map((c) => {
    const memberUser = ws.usersMap.get(c.userId);
    const gym = ws.gyms.find((g) => g.id === c.gymId);
    return {
      id: `db-${c.id}`,
      memberId: c.userId,
      memberName: memberUser?.name ?? "FORGE Athlete",
      planName: c.note?.trim() || (gym ? `${gym.name} · Member Pass` : "Gold All-Access"),
      checkedInAt: formatCheckInTime(c.createdAt),
      status: "active",
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Facility OS</Badge>
            <Badge tone="grape"><Building2 className="size-2.5" /> Gym Owner &amp; Operator</Badge>
            <span className="label-mono text-dim">SQLite Synced · RBAC Owner</span>
          </>
        }
        title="Gym floor & member ops."
        subtitle="Live floor occupancy synced with workspace check-ins, equipment bottleneck detection, contactless QR attendance terminal, and dynamic MRR analytics."
      />

      <div className="mt-4">
        <GymClient
          currentUser={{
            id: user.id,
            name: user.name,
            initials: user.initials,
            accent: user.accent,
          }}
          dbGyms={dbGyms}
          dbCheckins={dbCheckins}
          referenceDateKey={ws.today}
        />
      </div>
    </>
  );
}
