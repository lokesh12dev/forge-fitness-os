import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { upsertCoachMemory } from "@/lib/ai/memory";

const SaveFormCheckSchema = z.object({
  lift: z.enum(["squat", "deadlift", "bench", "ohp", "pushup", "row"]),
  angle: z.enum(["Side", "Front"]),
  mode: z.enum(["camera", "video", "simulator"]),
  reps: z.number().int().min(0).max(200),
  score: z.number().int().min(0).max(100),
  verdict: z.string().min(1).max(400),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      target: z.string(),
      ok: z.boolean(),
    }),
  ),
  issues: z.array(
    z.object({
      title: z.string(),
      cue: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      at: z.string(),
    }),
  ),
  repBreakdown: z.array(z.record(z.string(), z.unknown())).default([]),
  attachToActiveWorkout: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessions, activeWorkoutRows] = await Promise.all([
    db
      .select()
      .from(schema.formCheckSessions)
      .where(eq(schema.formCheckSessions.userId, user.id))
      .orderBy(desc(schema.formCheckSessions.createdAt))
      .limit(20),
    db
      .select({ id: schema.workouts.id, name: schema.workouts.name })
      .from(schema.workouts)
      .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
      .limit(1),
  ]);

  return NextResponse.json({
    ok: true,
    activeWorkout: activeWorkoutRows[0] ?? null,
    sessions: sessions.map((s) => ({
      id: s.id,
      workoutId: s.workoutId,
      lift: s.lift,
      angle: s.angle,
      mode: s.mode,
      reps: s.reps,
      score: s.score,
      verdict: s.verdict,
      metrics: JSON.parse(s.metricsJson),
      issues: JSON.parse(s.issuesJson),
      repBreakdown: JSON.parse(s.repBreakdownJson),
      createdAt: new Date(s.createdAt).getTime(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SaveFormCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const d = parsed.data;
  let workoutId: string | null = null;
  let attachedWorkoutName: string | null = null;

  if (d.attachToActiveWorkout) {
    const active = await db
      .select({ id: schema.workouts.id, name: schema.workouts.name })
      .from(schema.workouts)
      .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
      .limit(1);
    if (active[0]) {
      workoutId = active[0].id;
      attachedWorkoutName = active[0].name;
    }
  }

  const id = `fc-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date();
  await db.insert(schema.formCheckSessions).values({
    id,
    userId: user.id,
    workoutId,
    lift: d.lift,
    angle: d.angle,
    mode: d.mode,
    reps: d.reps,
    score: d.score,
    verdict: d.verdict,
    metricsJson: JSON.stringify(d.metrics),
    issuesJson: JSON.stringify(d.issues),
    repBreakdownJson: JSON.stringify(d.repBreakdown),
    createdAt: now,
  });

  if (d.issues.length > 0) {
    await upsertCoachMemory({
      userId: user.id,
      module: "exercise",
      kind: "adherence_summary",
      key: `form_check_${d.lift}`,
      value: {
        score: d.score,
        reps: d.reps,
        topCue: d.issues[0].cue,
        recordedAt: now.toISOString(),
      },
      source: "form_check",
      ttlDays: 30,
    }).catch(() => {});
  }

  revalidatePath("/app/form-check");
  revalidatePath("/app/train");

  return NextResponse.json({
    ok: true,
    id,
    workoutId,
    attachedWorkoutName,
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing session id" }, { status: 400 });

  const existing = await db
    .select({ id: schema.formCheckSessions.id })
    .from(schema.formCheckSessions)
    .where(and(eq(schema.formCheckSessions.id, id), eq(schema.formCheckSessions.userId, user.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "Form check session not found" }, { status: 404 });
  }

  await db
    .delete(schema.formCheckSessions)
    .where(and(eq(schema.formCheckSessions.id, id), eq(schema.formCheckSessions.userId, user.id)));

  return NextResponse.json({ ok: true, deletedId: id });
}
