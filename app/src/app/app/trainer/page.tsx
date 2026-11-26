import { Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { TrainerClient } from "@/components/trainer-client";
import { UserCheck, Shield, Sparkles } from "lucide-react";

export default function TrainerPortalPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>B2B Portal</Badge>
            <Badge tone="grape"><UserCheck className="size-2.5" /> Certified Coach</Badge>
            <span className="label-mono text-dim">RBAC: Trainer Access</span>
          </>
        }
        title="Trainer roster & prescriptions."
        subtitle="Manage athlete compliance, detect central fatigue before overuse injury strikes, and push periodized training cycles with tailored intensity modifiers in one click."
      />

      <div className="mt-4">
        <TrainerClient />
      </div>
    </>
  );
}
