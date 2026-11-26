import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { GymClient } from "@/components/gym-client";
import { Building2, Shield, Activity } from "lucide-react";

export default function GymOwnerPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Facility OS</Badge>
            <Badge tone="grape"><Building2 className="size-2.5" /> Gym Owner & Operator</Badge>
            <span className="label-mono text-dim">RBAC: Gym Owner</span>
          </>
        }
        title="Gym floor & member ops."
        subtitle="Live floor occupancy, equipment bottleneck detection, contactless attendance check-in terminal, and real-time monthly recurring revenue analytics."
      />

      <div className="mt-4">
        <GymClient />
      </div>
    </>
  );
}
