"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function drawCard(canvas: HTMLCanvasElement, input: {
  name: string;
  initials: string;
  exercise: string;
  value: number;
  previous: number | null;
  reps: number;
  weight: number;
  date: string;
}) {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  await document.fonts.ready.catch(() => {});

  ctx.fillStyle = "#060708";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.82, H * 0.1, 0, W * 0.82, H * 0.1, 720);
  glow.addColorStop(0, "rgba(201,247,58,0.24)");
  glow.addColorStop(1, "rgba(201,247,58,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#C9F73A";
  ctx.fillRect(80, 84, 54, 54);
  ctx.fillStyle = "#060708";
  ctx.font = "800 38px Inter, Arial, sans-serif";
  ctx.fillText("F", 97, 126);
  ctx.fillStyle = "#F2F3EE";
  ctx.font = "800 34px Inter, Arial, sans-serif";
  ctx.fillText("FORGE", 150, 122);
  ctx.fillStyle = "rgba(242,243,238,0.45)";
  ctx.font = "500 17px 'JetBrains Mono', monospace";
  ctx.fillText("THE ADAPTIVE TRAINING OS", 150, 146);

  ctx.fillStyle = "#C9F73A";
  ctx.font = "600 19px 'JetBrains Mono', monospace";
  ctx.fillText("NEW PERSONAL RECORD", 80, 280);

  ctx.fillStyle = "#F2F3EE";
  ctx.font = "800 82px Inter, Arial, sans-serif";
  const lines = input.exercise.toUpperCase().split(" ");
  let line = "";
  let y = 380;
  for (const word of lines) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > 900) {
      ctx.fillText(line, 80, y);
      y += 88;
      line = word;
    } else line = test;
  }
  ctx.fillText(line, 80, y);

  ctx.fillStyle = "#C9F73A";
  ctx.font = "800 260px Inter, Arial, sans-serif";
  const valueText = `${Math.round(input.value)}`;
  ctx.fillText(valueText, 68, y + 300);
  const vw = ctx.measureText(valueText).width;
  ctx.font = "700 56px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(242,243,238,0.65)";
  ctx.fillText("KG", 100 + vw, y + 300);
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(242,243,238,0.4)";
  ctx.fillText("ESTIMATED 1RM", 80, y + 350);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.moveTo(80, y + 410);
  ctx.lineTo(W - 80, y + 410);
  ctx.stroke();

  const cells = [
    { label: "SET", value: `${Math.round(input.weight)} kg × ${input.reps}` },
    { label: "PREVIOUS BEST", value: input.previous ? `${input.previous} kg` : "FIRST" },
    { label: "GAIN", value: input.previous ? `+${Math.max(0, Math.round((input.value - input.previous) * 10) / 10)} kg` : "NEW" },
  ];
  cells.forEach((cell, i) => {
    const x = 80 + i * 310;
    ctx.fillStyle = "rgba(242,243,238,0.4)";
    ctx.font = "500 16px 'JetBrains Mono', monospace";
    ctx.fillText(cell.label, x, y + 475);
    ctx.fillStyle = i === 2 ? "#C9F73A" : "#F2F3EE";
    ctx.font = "700 34px Inter, Arial, sans-serif";
    ctx.fillText(cell.value, x, y + 520);
  });

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.beginPath();
  ctx.roundRect(80, H - 220, W - 160, 120, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  ctx.fillStyle = "#C9F73A";
  ctx.beginPath();
  ctx.arc(140, H - 160, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#060708";
  ctx.font = "800 24px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(input.initials, 140, H - 151);
  ctx.textAlign = "left";
  ctx.fillStyle = "#F2F3EE";
  ctx.font = "600 24px Inter, Arial, sans-serif";
  ctx.fillText(input.name, 190, H - 168);
  ctx.fillStyle = "rgba(242,243,238,0.4)";
  ctx.font = "500 16px 'JetBrains Mono', monospace";
  ctx.fillText(input.date, 190, H - 138);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(242,243,238,0.55)";
  ctx.font = "500 17px 'JetBrains Mono', monospace";
  ctx.fillText("FORGE.APP", W - 110, H - 160);
  ctx.fillStyle = "rgba(242,243,238,0.25)";
  ctx.font = "500 14px 'JetBrains Mono', monospace";
  ctx.fillText("SHOW UP. LEVEL UP.", W - 110, H - 136);
  ctx.textAlign = "left";
}

export function PRCard({
  open,
  onClose,
  user,
  exercise,
  value,
  previous,
  weight,
  reps,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; initials: string };
  exercise: string;
  value: number;
  previous: number | null;
  weight: number;
  reps: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const ensure = async () => {
    if (!ref.current) return;
    await drawCard(ref.current, { name: user.name, initials: user.initials, exercise, value, previous, reps, weight, date });
    return ref.current;
  };

  const download = async () => {
    setBusy(true);
    const canvas = await ensure();
    if (canvas) {
      const a = document.createElement("a");
      a.download = `forge-pr-${exercise.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    }
    setBusy(false);
  };

  const share = async () => {
    setBusy(true);
    const text = `New PR on ${exercise}: ${Math.round(value)}kg estimated 1RM (${Math.round(weight)}kg × ${reps}). Built with FORGE.`;
    try {
      if (navigator.share) {
        const canvas = await ensure();
        const blob = await new Promise<Blob | null>((res) => canvas?.toBlob((b) => res(b), "image/png"));
        if (blob && navigator.canShare?.({ files: [new File([blob], "pr.png", { type: "image/png" })] })) {
          await navigator.share({ text, files: [new File([blob], "forge-pr.png", { type: "image/png" })] });
        } else {
          await navigator.share({ text });
        }
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
    } catch {
      /* user cancelled */
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} aria-label="Close PR backdrop" />
      <div className="animate-scale-in relative w-full max-w-md">
        <button
          onClick={onClose}
          aria-label="Close PR celebration"
          className="absolute -right-1 -top-1 z-10 grid size-9 place-items-center rounded-full border border-white/15 bg-ink text-mist hover:text-chalk"
        >
          <X className="size-4" />
        </button>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-2 shadow-[0_40px_120px_-20px_rgba(201,247,58,0.35)]">
          <div className="relative bg-gradient-to-br from-panel-2 via-ink-2 to-ink px-6 pb-6 pt-7">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(201,247,58,0.28),transparent_70%)]" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-acid text-[11px] font-black text-ink">F</span>
                <span className="font-display text-sm font-extrabold uppercase tracking-[-0.04em]">Forge<span className="text-acid">.</span></span>
              </div>
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-dim">New personal record</span>
            </div>
            <p className="relative mt-7 font-display text-[30px] font-bold leading-[0.94] tracking-[-0.05em]">{exercise}</p>
            <div className="relative mt-3 flex items-baseline gap-2">
              <span className="text-glow font-display text-[72px] font-extrabold leading-none tracking-[-0.07em] text-acid">{Math.round(value)}</span>
              <span className="font-mono text-sm text-mist">kg e1RM</span>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <div><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-dim">Set</p><p className="mt-1 font-numeric text-sm font-semibold">{Math.round(weight)} × {reps}</p></div>
              <div><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-dim">Previous</p><p className="mt-1 font-numeric text-sm font-semibold">{previous ? `${previous} kg` : "First"}</p></div>
              <div><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-dim">Gain</p><p className="mt-1 font-numeric text-sm font-semibold text-acid">{previous ? `+${Math.round((value - previous) * 10) / 10} kg` : "New"}</p></div>
            </div>
            <div className="relative mt-4 flex items-center justify-between text-[9px] text-dim">
              <span className="font-mono uppercase tracking-[0.12em]">{user.name} · {date}</span>
              <span className="font-mono uppercase tracking-[0.12em]">Show up. Level up.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-panel p-3">
            <button onClick={share} disabled={busy} className="press inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-acid text-[12.5px] font-semibold text-ink disabled:opacity-50">
              <Share2 className="size-3.5" /> {shared ? "Shared" : "Share"}
            </button>
            <button onClick={download} disabled={busy} className="press inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-[12.5px] font-semibold text-chalk disabled:opacity-50">
              <Download className="size-3.5" /> Save PNG
            </button>
          </div>
        </div>
        <canvas ref={ref} className="hidden" />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-dim">
          <Trophy className="size-3 text-amber" /> Auto-generated from your logged set
        </p>
      </div>
    </div>
  );
}
