"use client";

import React, { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Columns, Download } from "lucide-react";

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  defaultVisible?: boolean;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  title,
  exportHref,
  onRowClick,
  emptyState,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  title?: string;
  exportHref?: string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}) {
  const [hiddenCols, setHiddenCols] = useState<string[]>(() =>
    columns.filter((c) => c.defaultVisible === false).map((c) => c.key)
  );
  const [chooserOpen, setChooserOpen] = useState(false);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.includes(c.key)),
    [columns, hiddenCols]
  );

  const toggleCol = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < columns.length - 1 ? [...prev, key] : prev
    );
  };

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="bauhaus-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] px-4 py-3">
        <span className="bauhaus-label">{title ? `// ${title}` : `// RECORDS (${rows.length})`}</span>
        <div className="flex flex-wrap items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setChooserOpen((v) => !v)}
            className="min-h-[40px] inline-flex items-center gap-1.5 border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#EBC95B] hover:text-[#151515]"
          >
            <Columns className="size-3.5" /> Columns
          </button>

          {exportHref && (
            <a
              href={exportHref}
              className="min-h-[40px] inline-flex items-center gap-1.5 border-2 border-[var(--border-ink)] bg-[#151515] text-[#FFFFFF] px-3 text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#2B4BCC]"
            >
              <Download className="size-3.5" /> CSV Export
            </a>
          )}

          {chooserOpen && (
            <div className="absolute right-0 top-12 z-30 w-56 border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-3 space-y-2">
              <p className="bauhaus-label text-[var(--fg-grey)]">Toggle Columns</p>
              {columns.map((c) => {
                const checked = !hiddenCols.includes(c.key);
                return (
                  <label key={c.key} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCol(c.key)}
                      className="size-4 accent-[#C8372B]"
                    />
                    <span>{c.header}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#151515] text-[#FFFFFF]">
            <tr>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] border-b-2 border-[var(--border-ink)] whitespace-nowrap",
                    col.align === "right" && "text-right"
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[var(--border-ink)]">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "bg-[var(--bg-surface)]",
                  onRowClick && "cursor-pointer hover:bg-[#EBC95B]/25"
                )}
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 text-[14px] align-middle",
                      col.align === "right" && "text-right font-tabular"
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
