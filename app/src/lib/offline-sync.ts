"use client";

import { useEffect, useState } from "react";

export type SyncActionType =
  | "COMPLETE_SET"
  | "UNDO_SET"
  | "UPDATE_TARGET_SETS"
  | "SWAP_EXERCISE"
  | "COMPRESS_WORKOUT"
  | "FINISH_WORKOUT";

export type QueuedAction = {
  id: string; // Idempotency key
  type: SyncActionType;
  payload: any;
  clientTimestamp: number;
  attempts: number;
};

export type SyncState = {
  status: "synced" | "syncing" | "offline";
  pendingCount: number;
  isOnline: boolean;
  lastSyncedAt: number | null;
};

const QUEUE_STORAGE_KEY = "forge_sync_queue_v1";
const WORKOUT_SNAPSHOT_KEY = "forge_active_workout_snapshot_v1";

interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Memory storage fallback for testing / SSR environments
const memoryStore = new Map<string, string>();
const memoryStorage: SimpleStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => { memoryStore.set(k, v); },
  removeItem: (k: string) => { memoryStore.delete(k); },
};

function getStorage(): SimpleStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

class SyncManager {
  private queue: QueuedAction[] = [];
  private isSyncing = false;
  private listeners = new Set<(state: SyncState) => void>();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private lastSyncedAt: number | null = null;

  constructor() {
    this.loadQueue();
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;

      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notify();
        this.flush();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.notify();
      });
    }
  }

  private loadQueue() {
    try {
      const raw = getStorage().getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      getStorage().setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn("Failed to persist sync queue", err);
    }
  }

  public getState(): SyncState {
    let status: "synced" | "syncing" | "offline" = "synced";
    if (!this.isOnline) {
      status = "offline";
    } else if (this.isSyncing || this.queue.length > 0) {
      status = "syncing";
    }

    return {
      status,
      pendingCount: this.queue.length,
      isOnline: this.isOnline,
      lastSyncedAt: this.lastSyncedAt,
    };
  }

  public getStatus(): SyncState {
    return this.getState();
  }

  public getPendingActions(): QueuedAction[] {
    return [...this.queue];
  }

  public subscribe(fn: (state: SyncState) => void) {
    this.listeners.add(fn);
    fn(this.getState());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  public async enqueue(type: SyncActionType, payload: any): Promise<{ ok: boolean; idempotencyKey: string; action: QueuedAction }> {
    const action: QueuedAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      clientTimestamp: Date.now(),
      attempts: 0,
    };

    this.queue.push(action);
    this.saveQueue();
    this.notify();

    if (this.isOnline) {
      this.flush();
    }

    return { ok: true, idempotencyKey: action.id, action };
  }

  public async flush(serverActionHandler?: (action: QueuedAction) => Promise<{ ok: boolean }>) {
    if (this.isSyncing || this.queue.length === 0 || !this.isOnline) return;
    this.isSyncing = true;
    this.notify();

    const remaining: QueuedAction[] = [];

    for (const action of this.queue) {
      try {
        if (serverActionHandler) {
          const res = await serverActionHandler(action);
          if (!res.ok) {
            action.attempts += 1;
            remaining.push(action);
            continue;
          }
        }
      } catch (err) {
        action.attempts += 1;
        remaining.push(action);
      }
    }

    this.queue = remaining;
    this.saveQueue();
    this.lastSyncedAt = Date.now();
    this.isSyncing = false;
    this.notify();
  }

  // Active workout crash recovery
  public saveActiveSnapshot(workoutId: string, state: any) {
    try {
      getStorage().setItem(`${WORKOUT_SNAPSHOT_KEY}_${workoutId}`, JSON.stringify({
        workoutId,
        state,
        savedAt: Date.now(),
      }));
    } catch {}
  }

  public loadActiveSnapshot(workoutId: string) {
    try {
      const raw = getStorage().getItem(`${WORKOUT_SNAPSHOT_KEY}_${workoutId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public clearActiveSnapshot(workoutId: string) {
    try {
      getStorage().removeItem(`${WORKOUT_SNAPSHOT_KEY}_${workoutId}`);
    } catch {}
  }
}

export const syncManager = new SyncManager();

export function useSyncStatus() {
  const [state, setState] = useState<SyncState>({
    status: "synced",
    pendingCount: 0,
    isOnline: true,
    lastSyncedAt: null,
  });

  useEffect(() => {
    return syncManager.subscribe(setState);
  }, []);

  return state;
}
