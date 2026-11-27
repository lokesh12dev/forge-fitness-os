import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── LOGO ─────────────────────────── */

export function Logo({
  size = "md",
  href = "/",
  showWord = true,
  showTagline = false,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  showWord?: boolean;
  showTagline?: boolean;
}) {
  const markSize = size === "lg" ? "size-10" : size === "sm" ? "size-7" : "size-8";
  const forgeTextClass =
    size === "lg"
      ? "text-[38px] leading-[0.82]"
      : size === "sm"
        ? "text-[23px] leading-[0.84]"
        : "text-[30px] leading-[0.84]";
  const fitnessTextClass =
    size === "lg"
      ? "text-[10.5px] tracking-[0.42em] mt-[4px]"
      : size === "sm"
        ? "text-[6.5px] tracking-[0.36em] mt-[2px]"
        : "text-[8.5px] tracking-[0.38em] mt-[3px]";

  const inner = (
    <span className="inline-flex flex-col items-start select-none">
      {showWord ? (
        <span
          className="inline-flex flex-col items-center"
          role="img"
          aria-label="forge FITNESS"
        >
          <span
            className={cn(
              forgeTextClass,
              "font-extrabold lowercase text-white tracking-[-0.025em]",
            )}
            style={{
              fontFamily:
                "'DIN Condensed', 'Barlow Condensed', 'Impact', var(--font-jakarta), sans-serif",
            }}
          >
            forge
          </span>
          <span
            className={cn(
              fitnessTextClass,
              "font-bold uppercase leading-none text-acid",
            )}
            style={{
              fontFamily: "var(--font-jakarta), 'Avenir Next', sans-serif",
            }}
          >
            FITNESS
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "relative grid place-items-center rounded-[10px] border border-acid/35 bg-[#0b0c0e] shadow-[0_0_20px_-4px_rgba(201,247,58,0.28)]",
            markSize,
          )}
        >
          <span
            className={cn(
              "font-extrabold lowercase text-white leading-none",
              size === "lg" ? "text-[26px]" : size === "sm" ? "text-[18px]" : "text-[21px]",
            )}
            style={{
              fontFamily:
                "'DIN Condensed', 'Barlow Condensed', 'Impact', var(--font-jakarta), sans-serif",
            }}
          >
            f
          </span>
        </span>
      )}

      {showTagline && showWord && (
        <span className="mt-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.26em] text-dim">
          Train · Nutrition · Recover · Perform
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="group inline-flex items-center transition-opacity hover:opacity-90" aria-label="forge FITNESS home">
      {inner}
    </Link>
  );
}

/* ─────────────────────────── BUTTON ─────────────────────────── */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-acid text-ink hover:bg-[#d8ff5e] shadow-[0_8px_30px_-10px_rgba(201,247,58,0.55)]",
  secondary: "bg-white/[0.07] text-chalk border border-white/10 hover:bg-white/[0.11]",
  outline: "border border-white/15 text-chalk hover:border-acid/60 hover:text-acid bg-transparent",
  ghost: "text-mist hover:text-chalk hover:bg-white/[0.06]",
  danger: "bg-flame/12 text-flame border border-flame/25 hover:bg-flame/20",
  dark: "bg-ink text-chalk border border-white/10 hover:bg-panel-2",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5 rounded-full",
  md: "h-10 px-4 text-[13px] gap-2 rounded-full",
  lg: "h-12 px-6 text-[14px] gap-2 rounded-full",
  xl: "h-14 px-8 text-[15px] gap-2.5 rounded-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "press inline-flex select-none items-center justify-center whitespace-nowrap font-semibold disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      href={href}
      className={cn(
        "press inline-flex select-none items-center justify-center whitespace-nowrap font-semibold",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function IconButton({ className, children, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "press grid size-9 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-mist hover:border-white/15 hover:text-chalk",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── BADGE ─────────────────────────── */

const tones = {
  acid: "bg-acid/10 text-acid border-acid/20",
  flame: "bg-flame/10 text-flame border-flame/25",
  sky: "bg-sky/10 text-sky border-sky/25",
  mint: "bg-mint/10 text-mint border-mint/25",
  amber: "bg-amber/10 text-amber border-amber/25",
  grape: "bg-grape/10 text-grape border-grape/25",
  neutral: "bg-white/[0.05] text-mist border-white/10",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase leading-none tracking-[0.14em]", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current animate-pulse-dot" />}
      {children}
    </span>
  );
}

/* ─────────────────────────── AVATAR ─────────────────────────── */

export function Avatar({
  initials,
  accent = "#C9F73A",
  size = 36,
  className,
  ring,
}: {
  initials: string;
  accent?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full font-display font-bold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: accent,
        backgroundColor: `${accent}18`,
        border: `1px solid ${accent}40`,
        boxShadow: ring ? `0 0 0 3px #060708, 0 0 0 4px ${accent}55` : undefined,
      }}
    >
      {initials}
    </span>
  );
}

/* ─────────────────────────── MISC ─────────────────────────── */

export function Stat({
  label,
  value,
  unit,
  hint,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="label-mono mb-2">{label}</p>
      <p className="flex items-baseline gap-1.5 font-display text-3xl font-bold leading-none tracking-[-0.05em]" style={{ color: accent }}>
        {value}
        {unit && <span className="font-mono text-[11px] font-medium tracking-normal text-mist">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-dim">{hint}</p>}
    </div>
  );
}

export function ProgressBar({
  value,
  color = "#C9F73A",
  className,
  height = 4,
  track = "rgba(255,255,255,0.07)",
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  track?: string;
}) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full", className)} style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-acid" />
        <span className="label-mono text-chalk/70">{children}</span>
      </div>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-white/[0.07]", className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center rounded-3xl px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-acid">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
