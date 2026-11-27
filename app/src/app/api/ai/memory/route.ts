import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deleteCoachMemory, listCoachMemories, upsertCoachMemory } from "@/lib/ai/memory";
import { AiModuleSchema } from "@/lib/ai/schemas";

const UpsertMemorySchema = z.object({
  module: z.union([AiModuleSchema, z.literal("global")]),
  kind: z.enum([
    "decision",
    "preference",
    "frequent_swap",
    "injury_note",
    "plan_applied",
    "adherence_summary",
  ]),
  key: z.string().trim().min(1).max(80),
  value: z.unknown(),
  ttlDays: z.number().int().positive().max(365).nullable().optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const modRaw = searchParams.get("module");
  const modParsed = modRaw ? AiModuleSchema.safeParse(modRaw) : null;
  if (modRaw && !modParsed?.success) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  const memories = await listCoachMemories(user.id, modParsed?.data);
  return NextResponse.json({ ok: true, memories });
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

  const parsed = UpsertMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const entry = await upsertCoachMemory({
    userId: user.id,
    module: parsed.data.module,
    kind: parsed.data.kind,
    key: parsed.data.key,
    value: parsed.data.value,
    source: "user",
    ttlDays: parsed.data.ttlDays ?? null,
  });

  return NextResponse.json({ ok: true, memory: entry });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing memory id" }, { status: 400 });
  }

  const deleted = await deleteCoachMemory(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deletedId: id });
}
