"use client";

import React, { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ArrowUpDown, Columns, Download } from "lucide-react";

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  defaultVisible?: boolean;
  sortValue?: (row: T) => string | number;
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
  selectable = false,
  selectedKeys,
  onSelectionChange,
  bulkBar,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  title?: string;
  exportHref?: string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  bulkBar?: React.ReactNode;
}) {
  const [hiddenCols, setHiddenCols] = useState<string[]>(() =>
    columns.filter((c) => c.defaultVisible === false).map((c) => c.key)
  );
  const [chooserOpen, setChooserOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.includes(c.key)),
    [columns, hiddenCols]
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const getVal = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [rows, columns, sortKey, sortDir]);

  const toggleCol = (key: string) => {
    setHiddenCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < columns.length - 1 ? [...prev, key] : prev
    );
  };

  const toggleSort = (col: DataColumn<T>) => {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const selectedSet = useMemo(() => new Set(selectedKeys ?? []), [selectedKeys]);
  const allIds = useMemo(() => sortedRows.map((r) => rowKey(r)), [sortedRows, rowKey]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allIds);
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedSet.has(id)) {
      onSelectionChange((selectedKeys ?? []).filter((k) => k !== id));
    } else {
      onSelectionChange([...(selectedKeys ?? []), id]);
    }
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

      {selectable && selectedSet.size > 0 && bulkBar && (
        <div className="border-b-2 border-[var(--border-ink)] bg-[#EBC95B] px-4 py-2.5 text-[#151515] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em]">
            {selectedSet.size} SELECTED
          </span>
          <div className="flex flex-wrap items-center gap-2">{bulkBar}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#151515] text-[#FFFFFF]">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-3 border-b-2 border-[var(--border-ink)]">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 accent-[#C8372B]"
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col)}
                  className={clsx(
                    "px-4 py-3 text-[12px] font-bold uppercase tracking-[0.1em] border-b-2 border-[var(--border-ink)] whitespace-nowrap select-none",
                    col.align === "right" && "text-right",
                    col.sortValue && "cursor-pointer hover:text-[#EBC95B]"
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortValue && (
                      <ArrowUpDown
                        className={clsx(
                          "size-3",
                          sortKey === col.key ? "text-[#EBC95B]" : "opacity-60"
                        )}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[var(--border-ink)]">
            {sortedRows.map((row) => {
              const id = rowKey(row);
              const isChecked = selectedSet.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    "bg-[var(--bg-surface)]",
                    isChecked && "bg-[#EBC95B]/20",
                    onRowClick && "cursor-pointer hover:bg-[#EBC95B]/25"
                  )}
                >
                  {selectable && (
                    <td
                      className="px-3 py-3 text-[14px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${id}`}
                        checked={isChecked}
                        onChange={() => toggleOne(id)}
                        className="size-4 accent-[#C8372B]"
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        "px-4 py-3 text-[14px]",
                        col.align === "right" && "text-right font-tabular"
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
