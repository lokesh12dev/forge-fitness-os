import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  buildSyncDraftsForScenario,
  createSyncProposalIfAllowed,
  listUserSyncProposals,
  resolveSyncProposal,
} from "@/lib/ai/sync";

const PostSyncSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    scenario: z.enum(["goal_change", "missed_workout", "plateau", "equipment_change"]),
    newGoal: z.string().optional(),
    daysMissed: z.number().int().min(1).max(60).optional(),
    newEquipment: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("resolve"),
    proposalId: z.string().min(1),
    resolution: z.enum(["accept", "edit", "dismiss", "snooze"]),
    editedPayload: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const proposals = await listUserSyncProposals(user.id, status);
  return NextResponse.json({ ok: true, proposals });
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

  const parsed = PostSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  if (parsed.data.action === "generate") {
    const drafts = buildSyncDraftsForScenario({
      scenario: parsed.data.scenario,
      sex: user.sex === "female" ? "female" : "male",
      weightKg: user.weightKg || 75,
      heightCm: user.heightCm || 175,
      newGoal: parsed.data.newGoal,
      daysMissed: parsed.data.daysMissed,
      newEquipment: parsed.data.newEquipment,
    });
    const created = [];
    for (const d of drafts) {
      const res = await createSyncProposalIfAllowed({ userId: user.id, draft: d });
      if (res.created && res.proposal) created.push(res.proposal);
    }
    return NextResponse.json({ ok: true, createdCount: created.length, proposals: created });
  }

  const result = await resolveSyncProposal({
    userId: user.id,
    proposalId: parsed.data.proposalId,
    action: parsed.data.resolution,
    editedPayload: parsed.data.editedPayload,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  revalidatePath("/app");
  revalidatePath("/app/programs");
  revalidatePath("/app/train");
  revalidatePath("/app/progress");
  revalidatePath("/app/nutrition");

  return NextResponse.json({ ok: true, status: result.status });
}
