import Link from "next/link";
import { ArrowLeft, Check, Code2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Logo } from "@/components/ui";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · FORGE",
  description: "Open your adaptive training OS.",
};

const PROOF = [
  "Adaptive sessions that re-plan around time, gear and readiness",
  "Photo-to-macro nutrition with a protein-gap generator",
  "On-device camera form checks with one actionable cue",
  "Muscle recovery map, PR cards and a live community floor",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT / BRAND */}
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-2 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.16] [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -left-32 top-1/4 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.10),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,107,53,0.07),transparent_65%)]" />

        <div className="relative">
          <Logo size="lg" />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-acid/20 bg-acid/[0.06] px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-acid">
            <Zap className="size-3" /> The adaptive training OS
          </span>
          <h1 className="mt-5 font-display text-[clamp(2.4rem,4vw,3.6rem)] font-extrabold leading-[0.94] tracking-[-0.055em] text-chalk">
            Show up.
            <br />
            <span className="text-acid">It handles the rest.</span>
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-mist">
            One system for training, fuel and recovery. It reads your day, rewrites the session, and tells you exactly what to do next — set by set.
          </p>

          <ul className="mt-6 space-y-2.5">
            {PROOF.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[11px] leading-relaxed text-mist">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-acid/12 text-acid">
                  <Check className="size-2.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                { i: "MC", c: "#FF6B35" },
                { i: "JB", c: "#6EA8FF" },
                { i: "PN", c: "#F5A3FF" },
                { i: "MW", c: "#FFD166" },
              ].map((p) => (
                <span
                  key={p.i}
                  className="grid size-7 place-items-center rounded-full border-2 border-ink-2 text-[7.5px] font-bold"
                  style={{ background: `${p.c}22`, color: p.c }}
                >
                  {p.i}
                </span>
              ))}
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-chalk">38,000+ athletes</p>
              <p className="font-mono text-[7px] uppercase tracking-[0.1em] text-dim">2.4M sets logged</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-dim">
            <ShieldCheck className="size-3 text-mint" /> Local-first
          </span>
        </div>
      </div>

      {/* RIGHT / FORM */}
      <div className="relative flex flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.07] [mask-image:radial-gradient(ellipse_at_70%_20%,black,transparent_70%)] lg:hidden" />

        <div className="relative mx-auto w-full max-w-[380px]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo size="md" />
            <Link href="/" className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-dim transition-colors hover:text-chalk">
              <ArrowLeft className="size-3" /> Home
            </Link>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">
            <Sparkles className="size-2.5 text-acid" /> Welcome back
          </span>
          <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1] tracking-[-0.045em] text-chalk">
            Open your gym.
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-dim">
            Sign in to pick up your program exactly where you left it.
          </p>

          <div className="mt-7">
            <LoginForm initialError={error} />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
            <Link href="/" className="hidden transition-colors hover:text-chalk lg:block">
              ← Back to forge.app
            </Link>
            <span className="flex items-center gap-3">
              <span className="transition-colors hover:text-chalk">Privacy</span>
              <span className="transition-colors hover:text-chalk">Terms</span>
              <span className="flex items-center gap-1"><Code2 className="size-2.5" /> v1.0</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
