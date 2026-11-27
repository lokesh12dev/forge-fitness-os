"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, ArrowRight, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { signIn } from "@/app/actions";
import { Button } from "@/components/ui";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    initialError === "email" ? "Enter a valid email address to continue." : null,
  );
  const [pending, start] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address to continue.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    start(async () => {
      await signIn(fd);
    });
  }

  function demo() {
    setError(null);
    const fd = new FormData();
    fd.set("email", "alex@forge.app");
    start(async () => {
      await signIn(fd);
    });
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label-mono mb-1.5 block">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-dim" />
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] pl-10 pr-3 text-[13px] text-chalk placeholder:text-dim transition-colors focus:border-acid/45 focus:outline-none"
            />
          </div>
        </label>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-flame/20 bg-flame/[0.05] px-3 py-2 text-[11px] text-flame">
            <AlertTriangle className="size-3.5 shrink-0" /> {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Opening your gym…</>
          ) : (
            <>Continue with email <ArrowRight className="size-4" /></>
          )}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.07]" />
        <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-dim">or</span>
        <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <button
        onClick={demo}
        disabled={pending}
        className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] p-3 text-left transition-colors hover:border-acid/25 hover:bg-acid/[0.04] disabled:opacity-50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-acid/10 text-[11px] font-bold text-acid">AR</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-chalk">
            Enter as Alex Rivera
            <Sparkles className="size-3 text-acid" />
          </span>
          <span className="block font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
            Demo athlete · 35 workouts of history
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-acid" />
      </button>

      <p className="mt-4 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-dim">
        <Lock className="mt-0.5 size-3 shrink-0" />
        No password in the demo. Any email opens a local account; data stays on this machine and can be exported at any time.
      </p>
    </div>
  );
}
