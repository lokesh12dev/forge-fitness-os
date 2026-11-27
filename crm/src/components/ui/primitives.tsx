"use client";

import React, { useEffect } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  Check,
  Clock,
  Pause,
  Square,
  X,
} from "lucide-react";

/* ─────────────────────────── STAT TILE ─────────────────────────── */

export function StatTile({
  label,
  value,
  subtext,
  accent = "paper",
  indicator,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: "paper" | "red" | "blue" | "yellow" | "ink";
  indicator?: string;
}) {
  const palette: Record<string, string> = {
    paper: "bg-[var(--bg-surface)] text-[var(--fg-ink)]",
    red: "bg-[#C8372B] text-[#FFFFFF]",
    blue: "bg-[#2B4BCC] text-[#FFFFFF]",
    yellow: "bg-[#EBC95B] text-[#151515]",
    ink: "bg-[#151515] text-[#FFFFFF]",
  };

  const mutedText =
    accent === "red" || accent === "blue" || accent === "ink"
      ? "text-[#FFFFFF]/80"
      : accent === "yellow"
      ? "text-[#151515]/80"
      : "text-[var(--fg-grey)]";

  return (
    <div
      className={clsx(
        "border-2 border-[var(--border-ink)] p-4 flex flex-col justify-between min-h-[124px]",
        palette[accent]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="bauhaus-label line-clamp-2">{label}</span>
        {indicator && (
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] border border-current px-1.5 py-0.5 shrink-0">
            {indicator}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p
          className={clsx(
            "font-headline tabular-nums leading-[0.95]",
            String(value).length >= 9
              ? "text-[22px] sm:text-[24px] xl:text-[28px]"
              : String(value).length >= 7
              ? "text-[24px] lg:text-[28px] xl:text-[32px]"
              : "text-[32px] md:text-[40px] break-words"
          )}
        >
          {value}
        </p>
        {subtext && <p className={clsx("mt-2 text-[12px] font-medium line-clamp-2", mutedText)}>{subtext}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────── STATUS PILL ─────────────────────────── */

export type SemanticStatus =
  | "ACTIVE"
  | "EXPIRING"
  | "OVERDUE"
  | "EXPIRED"
  | "FROZEN"
  | "PAID"
  | "PARTIALLY_PAID"
  | "ISSUED"
  | "VOID"
  | "REFUNDED";

export function StatusPill({ status }: { status: SemanticStatus | string }) {
  const norm = status.toUpperCase();

  if (norm === "ACTIVE" || norm === "PAID" || norm === "ALLOWED") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#2B4BCC] text-[#FFFFFF] border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
        <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
        <span>{norm}</span>
      </span>
    );
  }

  if (norm === "EXPIRING" || norm === "PARTIALLY_PAID" || norm === "ISSUED" || norm === "OVERRIDE_ALLOWED") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#EBC95B] text-[#151515] border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
        <Clock className="size-3.5 stroke-[2.5]" aria-hidden="true" />
        <span>{norm.replace("_", " ")}</span>
      </span>
    );
  }

  if (norm === "OVERDUE" || norm === "EXPIRED" || norm === "BLOCKED_EXPIRED" || norm === "DLQ") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#C8372B] text-[#FFFFFF] border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
        <AlertTriangle className="size-3.5 stroke-[2.5]" aria-hidden="true" />
        <span>{norm.replace("_", " ")}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 bg-[#6F6B61] text-[#FFFFFF] border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap">
      {norm === "FROZEN" ? (
        <Pause className="size-3.5" aria-hidden="true" />
      ) : (
        <Square className="size-3" aria-hidden="true" />
      )}
      <span>{norm.replace("_", " ")}</span>
    </span>
  );
}

/* ─────────────────────────── BAUHAUS AVATAR (DELIBERATE CIRCLE) ─────────────────────────── */

const AVATAR_TONES = ["bg-[#C8372B] text-[#FFFFFF]", "bg-[#2B4BCC] text-[#FFFFFF]", "bg-[#EBC95B] text-[#151515]", "bg-[#151515] text-[#FFFFFF]"];

export function Avatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  const code = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tone = AVATAR_TONES[code % AVATAR_TONES.length]!;

  return (
    <div
      style={{ width: size, height: size, borderRadius: "9999px" }}
      className={clsx(
        "shrink-0 grid place-items-center border-2 border-[var(--border-ink)] font-bold uppercase text-[13px] select-none",
        tone
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────── SEGMENTED PROGRESS ─────────────────────────── */

export function SegmentedProgress({
  value,
  max,
  segments = 10,
  color = "blue",
  label,
}: {
  value: number;
  max: number;
  segments?: number;
  color?: "blue" | "red" | "yellow" | "ink";
  label?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const filledCount = Math.round(pct * segments);
  const fillClass =
    color === "red"
      ? "bg-[#C8372B]"
      : color === "yellow"
      ? "bg-[#EBC95B]"
      : color === "ink"
      ? "bg-[#151515]"
      : "bg-[#2B4BCC]";

  return (
    <div>
      {label && <p className="bauhaus-label mb-1.5">{label}</p>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              "h-3 border border-[var(--border-ink)]",
              i < filledCount ? fillClass : "bg-[var(--bg-muted)]"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── EMPTY STATE (BAUHAUS GEOMETRIC SHAPE + SINGLE ACTION) ─────────────────────────── */

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bauhaus-card p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div className="flex items-start gap-6">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          className="shrink-0 border-2 border-[#151515] bg-[#F6F1E4]"
          aria-hidden="true"
        >
          <rect x="0" y="0" width="36" height="36" fill="#2B4BCC" />
          <circle cx="54" cy="18" r="14" fill="#EBC95B" stroke="#151515" strokeWidth="2" />
          <polygon points="8,66 36,24 64,66" fill="#C8372B" stroke="#151515" strokeWidth="2" />
        </svg>
        <div>
          <p className="bauhaus-label text-[var(--fg-grey)] mb-2">{`// ${eyebrow}`}</p>
          <h3 className="font-headline text-[24px]">{title}</h3>
          <p className="mt-2 max-w-xl text-[14px] text-[var(--fg-grey)]">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── FILTER BAR ─────────────────────────── */

export function FilterBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bauhaus-card p-3 md:p-4 flex flex-wrap items-center justify-between gap-3">
      {children}
    </div>
  );
}

/* ─────────────────────────── TIMELINE ─────────────────────────── */

export interface TimelineEntry {
  id: string;
  timestamp: string;
  badge: string;
  title: string;
  body: string;
  tone?: "blue" | "red" | "yellow" | "ink";
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="divide-y-2 divide-[var(--border-ink)] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
      {entries.map((entry) => {
        const dotColor =
          entry.tone === "red"
            ? "bg-[#C8372B]"
            : entry.tone === "yellow"
            ? "bg-[#EBC95B]"
            : entry.tone === "ink"
            ? "bg-[#151515]"
            : "bg-[#2B4BCC]";

        return (
          <div key={entry.id} className="p-4 flex items-start gap-3">
            <span className={clsx("mt-1.5 size-3 shrink-0 border border-[#151515]", dotColor)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="bauhaus-label text-[var(--fg-grey)]">{entry.badge}</span>
                <span className="text-[12px] font-tabular text-[var(--fg-grey)]">{entry.timestamp}</span>
              </div>
              <p className="mt-1 font-bold text-[14px]">{entry.title}</p>
              <p className="mt-1 text-[14px] text-[var(--fg-grey)] break-words">{entry.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── MODAL & DRAWER ─────────────────────────── */

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#151515]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-paper)] text-[var(--fg-ink)] border-[3px] border-[var(--border-ink)]">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-4 md:p-5">
          <div>
            {eyebrow && <p className="bauhaus-label text-[#C8372B] mb-1">{`// ${eyebrow}`}</p>}
            <h2 className="font-headline text-[24px]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[48px] min-h-[48px] md:min-w-[40px] md:min-h-[40px] grid place-items-center border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] hover:bg-[#151515] hover:text-[#FFFFFF]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#151515]/75 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-xl h-full overflow-y-auto bg-[var(--bg-paper)] text-[var(--fg-ink)] border-l-[3px] border-[var(--border-ink)] flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-5 sticky top-0 z-10">
          <div>
            {eyebrow && <p className="bauhaus-label text-[#2B4BCC] mb-1">{`// ${eyebrow}`}</p>}
            <h2 className="font-headline text-[24px]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="min-w-[48px] min-h-[48px] md:min-w-[40px] md:min-h-[40px] grid place-items-center border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] hover:bg-[#C8372B] hover:text-[#FFFFFF]"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────── TOAST ─────────────────────────── */

export function Toast({
  message,
  tone = "ink",
  onDismiss,
}: {
  message: string | null;
  tone?: "ink" | "red" | "blue" | "yellow";
  onDismiss?: () => void;
}) {
  if (!message) return null;
  const styles =
    tone === "red"
      ? "bg-[#C8372B] text-[#FFFFFF]"
      : tone === "blue"
      ? "bg-[#2B4BCC] text-[#FFFFFF]"
      : tone === "yellow"
      ? "bg-[#EBC95B] text-[#151515]"
      : "bg-[#151515] text-[#FFFFFF]";

  return (
    <div
      className={clsx(
        "fixed bottom-20 left-4 right-4 md:left-auto md:bottom-6 md:right-6 z-[90] border-2 border-[#151515] px-4 py-3 flex items-center justify-between gap-3 md:max-w-md",
        styles
      )}
      role="status"
      aria-live="polite"
    >
      <span className="text-[14px] font-bold">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss alert" className="p-1">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── CALENDAR & KANBAN SHELLS ─────────────────────────── */

export function AttendanceCalendar({
  visitedDayKeys,
  monthLabel,
  daysInMonth = 30,
}: {
  visitedDayKeys: number[];
  monthLabel: string;
  daysInMonth?: number;
}) {
  const visited = new Set(visitedDayKeys);
  return (
    <div className="bauhaus-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="bauhaus-label">{`// ${monthLabel}`}</span>
        <span className="text-[12px] font-bold uppercase text-[#2B4BCC]">
          {visited.size} VISITS LOGGED
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const hit = visited.has(day);
          return (
            <div
              key={day}
              className={clsx(
                "h-9 border border-[var(--border-ink)] flex items-center justify-center text-[12px] font-tabular font-bold",
                hit ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[var(--bg-muted)] text-[var(--fg-grey)]"
              )}
              title={`Day ${day}: ${hit ? "Visited" : "No visit"}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KanbanBoard({
  columns,
}: {
  columns: Array<{ id: string; title: string; count: number; accent: "paper" | "yellow" | "blue" | "red"; items: React.ReactNode }>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div key={col.id} className="bauhaus-card flex flex-col">
          <div className="border-b-2 border-[var(--border-ink)] p-3 flex items-center justify-between bg-[var(--bg-muted)]">
            <span className="bauhaus-label">{`// ${col.title}`}</span>
            <span className="bg-[#151515] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-tabular font-bold">
              {col.count}
            </span>
          </div>
          <div className="p-3 space-y-2">{col.items}</div>
        </div>
      ))}
    </div>
  );
}
