"use client";

import { useSyncStatus } from "@/lib/offline-sync";
import { cn } from "@/lib/utils";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export function SyncStatusPill({ className }: { className?: string }) {
  const { status, pendingCount, isOnline } = useSyncStatus();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-wider transition-colors",
        status === "synced"
          ? "border border-mint/20 bg-mint/[0.08] text-mint"
          : status === "syncing"
          ? "border border-acid/25 bg-acid/[0.08] text-acid"
          : "border border-flame/25 bg-flame/[0.08] text-flame",
        className,
      )}
      title={
        status === "synced"
          ? "All workout data saved and synced to cloud"
          : status === "syncing"
          ? `Syncing ${pendingCount} set(s) in background`
          : `Offline mode. ${pendingCount} change(s) banked locally, auto-syncs when online.`
      }
    >
      {status === "synced" && (
        <>
          <span className="size-1.5 rounded-full bg-mint" />
          <span>Synced</span>
        </>
      )}
      {status === "syncing" && (
        <>
          <RefreshCw className="size-2.5 animate-spin text-acid" />
          <span>Syncing {pendingCount > 0 ? `(${pendingCount})` : ""}</span>
        </>
      )}
      {status === "offline" && (
        <>
          <CloudOff className="size-2.5 text-flame" />
          <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ""}</span>
        </>
      )}
    </div>
  );
}
