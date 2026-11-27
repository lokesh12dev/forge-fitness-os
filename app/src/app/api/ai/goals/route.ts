import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

const rid = (p: string) => `${p}_${randomUUID().slice(0, 12)}`;

const CreateGoalSchema = z.object({
  title: z.string().trim().min(2).max(120),
  metric: z.enum(["weight_kg", "bench_1rm", "weekly_sessions", "protein_g", "custom"]).default("custom"),
  startValue: z.number().finite(),
  currentValue: z.number().finite(),
  targetValue: z.number().finite(),
  unit: z.string().trim().min(1).max(20).default("kg"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relatedPlanId: z.string().optional(),
});

const UpdateGoalSchema = z.object({
  id: z.string().min(1),
  currentValue: z.number().finite().optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(schema.aiGoals)
    .where(eq(schema.aiGoals.userId, user.id))
    .orderBy(desc(schema.aiGoals.createdAt));

  return NextResponse.json({
    goals: rows.map((g) => ({
      ...g,
      milestones: JSON.parse(g.milestonesJson || "[]") as string[],
      createdAt: new Date(g.createdAt).getTime(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const d = parsed.data;
  const span = d.targetValue - d.startValue;
  const milestones = [
    `25%: ${(d.startValue + span * 0.25).toFixed(1)} ${d.unit}`,
    `50%: ${(d.startValue + span * 0.5).toFixed(1)} ${d.unit}`,
    `75%: ${(d.startValue + span * 0.75).toFixed(1)} ${d.unit}`,
    `100%: ${d.targetValue.toFixed(1)} ${d.unit}`,
  ];

  const id = rid("aig");
  await db.insert(schema.aiGoals).values({
    id,
    userId: user.id,
    title: d.title,
    metric: d.metric,
    startValue: d.startValue,
    currentValue: d.currentValue,
    targetValue: d.targetValue,
    unit: d.unit,
    deadline: d.deadline ?? null,
    relatedPlanId: d.relatedPlanId ?? null,
    milestonesJson: JSON.stringify(milestones),
    status: "active",
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, id, milestones });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { id, currentValue, status } = parsed.data;
  const [existing] = await db
    .select()
    .from(schema.aiGoals)
    .where(and(eq(schema.aiGoals.id, id), eq(schema.aiGoals.userId, user.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const nextVal = currentValue ?? existing.currentValue;
  const autoDone =
    existing.targetValue >= existing.startValue
      ? nextVal >= existing.targetValue
      : nextVal <= existing.targetValue;

  await db
    .update(schema.aiGoals)
    .set({
      currentValue: nextVal,
      status: status ?? (autoDone ? "completed" : existing.status),
    })
    .where(and(eq(schema.aiGoals.id, id), eq(schema.aiGoals.userId, user.id)));

  return NextResponse.json({ ok: true, currentValue: nextVal, status: status ?? (autoDone ? "completed" : existing.status) });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing goal id" }, { status: 400 });
  }

  await db.delete(schema.aiGoals).where(and(eq(schema.aiGoals.id, id), eq(schema.aiGoals.userId, user.id)));
  return NextResponse.json({ ok: true });
}
