import React from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "blue" | "yellow";
export type ButtonDensity = "hero" | "dense";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  density?: ButtonDensity;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  density = "dense",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "bg-[#C8372B] text-[#FFFFFF] border-2 border-[#151515] hover:bg-[#151515] hover:text-[#FFFFFF] active:translate-y-[1px]",
    secondary:
      "bg-[#151515] text-[#FFFFFF] border-2 border-[#151515] hover:bg-[#2B4BCC] active:translate-y-[1px]",
    tertiary:
      "bg-[var(--bg-surface)] text-[var(--fg-ink)] border-2 border-[var(--border-ink)] hover:bg-[#EBC95B] hover:text-[#151515] active:translate-y-[1px]",
    blue:
      "bg-[#2B4BCC] text-[#FFFFFF] border-2 border-[#151515] hover:bg-[#151515] active:translate-y-[1px]",
    yellow:
      "bg-[#EBC95B] text-[#151515] border-2 border-[#151515] hover:bg-[#151515] hover:text-[#FFFFFF] active:translate-y-[1px]",
  };

  const sizeStyles =
    density === "hero"
      ? "min-h-[56px] px-6 text-[14px]"
      : "min-h-[48px] md:min-h-[40px] px-4 text-[13px]";

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-bold uppercase tracking-[0.08em] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap",
        variantStyles[variant],
        sizeStyles,
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
