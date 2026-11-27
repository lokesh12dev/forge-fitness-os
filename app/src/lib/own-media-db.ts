/**
 * Device-local storage helpers for user exercise settings & media:
 * - Own Exercise Media ("Your photo or video") stored in IndexedDB (never sent off device)
 * - Custom Aliases ("+ Add another name")
 * - Per-exercise Weight Unit ("default" | "kg" | "lb")
 * - Per-exercise Plate Loading & Base Weight ("plate loading" / stack machine)
 */

export type ExerciseWeightUnit = "default" | "kg" | "lb";

export interface ExercisePrefs {
  aliases?: string[];
  weightUnit?: ExerciseWeightUnit;
  plateLoading?: boolean;
  baseWeightKg?: number;
  showOwnFirst?: boolean;
}

export interface StoredOwnMedia {
  exerciseId: string;
  kind: "image" | "video";
  mimeType: string;
  dataUrl: string;
  updatedAt: number;
}

const PREFS_STORAGE_KEY = "forge_exercise_prefs_v1";
const DB_NAME = "forge_own_media_db";
const STORE_NAME = "exercise_media";

export function loadAllExercisePrefs(): Record<string, ExercisePrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ExercisePrefs>) : {};
  } catch {
    return {};
  }
}

export function saveExercisePrefs(exerciseId: string, patch: ExercisePrefs): Record<string, ExercisePrefs> {
  const all = loadAllExercisePrefs();
  const next = { ...all, [exerciseId]: { ...(all[exerciseId] ?? {}), ...patch } };
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return next;
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "exerciseId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOwnExerciseMedia(exerciseId: string): Promise<StoredOwnMedia | null> {
  try {
    const db = await openMediaDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(exerciseId);
      req.onsuccess = () => resolve((req.result as StoredOwnMedia) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putOwnExerciseMedia(record: StoredOwnMedia): Promise<void> {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteOwnExerciseMedia(exerciseId: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(exerciseId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup error
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
