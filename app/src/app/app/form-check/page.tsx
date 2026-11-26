import { Badge, ButtonLink } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { FormCheckStudio } from "@/components/form-check-client";
import { Camera, Dumbbell, ScanFace, Sparkles } from "lucide-react";

export default function FormCheckPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Live squat count pilot</Badge>
            <Badge tone="grape"><ScanFace className="size-2.5" /> 33-point pose landmarks</Badge>
            <span className="label-mono text-dim">Local inference · device dependent</span>
          </>
        }
        title="Form check."
        subtitle="Use a side-on camera to preview body landmarks and count squat-like bend-and-return cycles. Live mode reports a rough rep count only; scores and technique cues remain clearly labeled examples."
        actions={
          <>
            <ButtonLink href="/app/train" variant="secondary" size="md">
              <Dumbbell className="size-3.5" /> Train now
            </ButtonLink>
            <ButtonLink href="#studio" size="md">
              <Camera className="size-3.5" /> Analyze a set
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <span className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-acid">
          <Sparkles className="size-3" /> Separate sample mode
        </span>
        <span className="text-[11px] text-mist">
          The sample report is illustrative. Live mode processes camera frames in your browser and currently supports a conservative squat rep count.
        </span>
      </div>

      <div id="studio" className="scroll-mt-24">
        <FormCheckStudio />
      </div>
    </>
  );
}
