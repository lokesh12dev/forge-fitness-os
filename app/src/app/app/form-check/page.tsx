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
            <Badge tone="acid" dot>On-device pose AI</Badge>
            <Badge tone="grape"><ScanFace className="size-2.5" /> 17-joint tracking</Badge>
            <span className="label-mono text-dim">Private · 30 fps</span>
          </>
        }
        title="Form check."
        subtitle="A mirror tells you how you look. This tells you what to fix. Film a set from your phone and get rep counting, depth, bar path and the one cue that will clean it up — in under ten seconds."
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
          <Sparkles className="size-3" /> Demo mode
        </span>
        <span className="text-[11px] text-mist">
          Try the full analysis without a camera. Enable yours to see the live pose overlay — video never leaves this device.
        </span>
      </div>

      <div id="studio" className="scroll-mt-24">
        <FormCheckStudio />
      </div>
    </>
  );
}
