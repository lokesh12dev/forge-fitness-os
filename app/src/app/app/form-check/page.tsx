import { Badge, ButtonLink } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { FormCheckStudio } from "@/components/form-check-client";
import { Camera, Dumbbell, ScanFace, ShieldCheck } from "lucide-react";

export default function FormCheckPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>On-device MediaPipe Pose</Badge>
            <Badge tone="grape"><ScanFace className="size-2.5" /> 33-landmark tracking</Badge>
            <span className="label-mono text-dim">WebGL / WASM · 30 fps</span>
          </>
        }
        title="Form check."
        subtitle="Real-time 33-joint biomechanical pose tracking in your browser. Open your camera, upload a lifting clip, or test the simulator to get live rep counting, bar path tracing, joint angles, and prioritized cues."
        actions={
          <>
            <ButtonLink href="/app/train" variant="secondary" size="md">
              <Dumbbell className="size-3.5" /> Train now
            </ButtonLink>
            <ButtonLink href="#studio" size="md">
              <Camera className="size-3.5" /> Open studio
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <span className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-mint">
          <ShieldCheck className="size-3.5" /> 100% On-device
        </span>
        <span className="text-[11px] text-mist">
          Pose detection runs locally in your browser using bundled MediaPipe WASM. Video never leaves your device.
        </span>
      </div>

      <div id="studio" className="scroll-mt-24">
        <FormCheckStudio />
      </div>
    </>
  );
}
