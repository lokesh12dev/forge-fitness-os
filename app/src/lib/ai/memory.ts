import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { coachMemory, type CoachMemoryRecord } from "@/db/schema";
import type { AiModule } from "./schemas";

export type CoachMemoryKind =
  | "decision"
  | "preference"
  | "frequent_swap"
  | "injury_note"
  | "plan_applied"
  | "adherence_summary";

export interface CoachMemoryEntry {
  id: string;
  module: string;
  kind: CoachMemoryKind;
  key: string;
  value: unknown;
  source: string;
  confidence: number;
  createdAt: number;
  expiresAt: number | null;
}

function toEntry(row: CoachMemoryRecord): CoachMemoryEntry {
  let parsed: unknown = row.valueJson;
  try {
    parsed = JSON.parse(row.valueJson);
  } catch {
    parsed = row.valueJson;
  }
  return {
    id: row.id,
    module: row.module,
    kind: row.kind as CoachMemoryKind,
    key: row.key,
    value: parsed,
    source: row.source,
    confidence: row.confidence,
    createdAt: new Date(row.createdAt).getTime(),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null,
  };
}

export async function listCoachMemories(
  userId: string,
  moduleFilter?: AiModule,
  limit = 25,
): Promise<CoachMemoryEntry[]> {
  const now = new Date();
  const baseCond = and(
    eq(coachMemory.userId, userId),
    or(isNull(coachMemory.expiresAt), gt(coachMemory.expiresAt, now)),
  );
  const whereCond = moduleFilter
    ? and(baseCond, eq(coachMemory.module, moduleFilter))
    : baseCond;

  const rows = await db
    .select()
    .from(coachMemory)
    .where(whereCond)
    .orderBy(desc(coachMemory.createdAt))
    .limit(limit);

  return rows.map(toEntry);
}

export async function upsertCoachMemory(input: {
  userId: string;
  module: AiModule | "global";
  kind: CoachMemoryKind;
  key: string;
  value: unknown;
  source?: string;
  confidence?: number;
  ttlDays?: number | null;
}): Promise<CoachMemoryEntry> {
  const now = new Date();
  const expiresAt =
    input.ttlDays && input.ttlDays > 0
      ? new Date(now.getTime() + input.ttlDays * 86_400_000)
      : null;
  const valueJson = JSON.stringify(input.value);

  const existing = await db
    .select()
    .from(coachMemory)
    .where(
      and(
        eq(coachMemory.userId, input.userId),
        eq(coachMemory.module, input.module),
        eq(coachMemory.kind, input.kind),
        eq(coachMemory.key, input.key),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(coachMemory)
      .set({
        valueJson,
        source: input.source ?? "system",
        confidence: input.confidence ?? 1.0,
        createdAt: now,
        expiresAt,
      })
      .where(eq(coachMemory.id, existing[0].id));
    return {
      id: existing[0].id,
      module: input.module,
      kind: input.kind,
      key: input.key,
      value: input.value,
      source: input.source ?? "system",
      confidence: input.confidence ?? 1.0,
      createdAt: now.getTime(),
      expiresAt: expiresAt ? expiresAt.getTime() : null,
    };
  }

  const id = `mem-${crypto.randomUUID().slice(0, 12)}`;
  await db.insert(coachMemory).values({
    id,
    userId: input.userId,
    module: input.module,
    kind: input.kind,
    key: input.key,
    valueJson,
    source: input.source ?? "system",
    confidence: input.confidence ?? 1.0,
    createdAt: now,
    expiresAt,
  });

  return {
    id,
    module: input.module,
    kind: input.kind,
    key: input.key,
    value: input.value,
    source: input.source ?? "system",
    confidence: input.confidence ?? 1.0,
    createdAt: now.getTime(),
    expiresAt: expiresAt ? expiresAt.getTime() : null,
  };
}

export async function deleteCoachMemory(userId: string, memoryId: string): Promise<boolean> {
  const rows = await db
    .select({ id: coachMemory.id })
    .from(coachMemory)
    .where(and(eq(coachMemory.id, memoryId), eq(coachMemory.userId, userId)))
    .limit(1);
  if (!rows[0]) return false;
  await db
    .delete(coachMemory)
    .where(and(eq(coachMemory.id, memoryId), eq(coachMemory.userId, userId)));
  return true;
}
