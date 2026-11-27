import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const mockUserRef = {
  current: {
    id: "u-alex",
    email: "alex@forge.fit",
    name: "Alex Rivera",
    handle: "alex",
    initials: "AR",
    accent: "#C9F73A",
    bio: null,
    goal: "hypertrophy",
    experience: "intermediate",
    sex: "male",
    weightKg: 80,
    heightCm: 178,
    unitPref: "kg",
    equipment: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
    streak: 18,
    xp: 12480,
    level: 12,
    onboarded: true,
    createdAt: new Date(),
  },
};

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockUserRef.current),
  requireUser: vi.fn(async () => mockUserRef.current),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { GET as getHealth } from "@/app/api/ai/health/route";
import { POST as postCoach, GET as getCoach } from "@/app/api/ai/coach/route";
import { POST as postPlans, GET as getPlans } from "@/app/api/ai/plans/route";
import { POST as postMemory, DELETE as deleteMemory } from "@/app/api/ai/memory/route";
import { POST as postSync } from "@/app/api/ai/sync/route";

describe("Part K — Live Route Handler E2E Integration & Multi-User Isolation", () => {
  beforeEach(() => {
    mockUserRef.current = { ...mockUserRef.current, id: "u-alex" };
  });

  it("GET /api/ai/health returns honest provenance and daily budget", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; provenance: string; dailyBudget: { budgetTokens: number } };
    expect(body.ok).toBe(true);
    expect(body.provenance).toMatch(/^(deterministic:forge|llm:)/);
    expect(body.dailyBudget.budgetTokens).toBeGreaterThan(0);
  });

  it("POST /api/ai/coach streams meta, delta, plan, usage, and done SSE events and supports Idempotency-Key", async () => {
    const t0 = Date.now();
    const idem = `e2e-idem-${Date.now()}`;
    const req1 = new Request("http://localhost:3000/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify({
        module: "nutrition",
        message: "Create a high-protein vegetarian meal plan",
      }),
    });
    const res1 = await postCoach(req1);
    expect(res1.status).toBe(200);
    const text1 = await res1.text();
    const elapsedMs = Date.now() - t0;

    expect(text1).toContain("event: meta");
    expect(text1).toContain("event: delta");
    expect(text1).toContain("event: plan");
    expect(text1).toContain("event: usage");
    expect(text1).toContain("event: done");
    expect(elapsedMs).toBeLessThan(10000);

    // Duplicate Idempotency-Key returns deduped stream
    const req2 = new Request("http://localhost:3000/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify({
        module: "nutrition",
        message: "Create a high-protein vegetarian meal plan",
      }),
    });
    const res2 = await postCoach(req2);
    const text2 = await res2.text();
    expect(text2).toContain('"deduped":true');

    const listRes = await getCoach(new Request("http://localhost:3000/api/ai/coach?module=nutrition"));
    expect(listRes.status).toBe(200);
  });

  it("POST /api/ai/plans blocks hallucinated exercise IDs with 422 semantic error and supports GET versions", async () => {
    const badRes = await postPlans(
      new Request("http://localhost:3000/api/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_plan",
          module: "workout",
          plan: {
            kind: "workout",
            title: "Bad Plan",
            focus: "Push",
            goal: "hypertrophy",
            environment: "gym",
            durationMin: 45,
            intensity: "RPE 8",
            summary: "Test",
            exercises: [
              {
                exerciseId: "ex-nonexistent-999",
                name: "Fake Lift",
                primaryMuscle: "chest",
                equipment: "barbell",
                sets: 3,
                repsMin: 8,
                repsMax: 12,
                suggestedWeightKg: 50,
                restSec: 90,
                tempo: "2-0-1",
                rpeTarget: 8,
                notes: "",
              },
            ],
            progressiveOverloadRule: "Double progression",
            recoveryNote: "48h",
          },
        }),
      }),
    );
    expect(badRes.status).toBe(422);
    const badBody = (await badRes.json()) as { ok: boolean; error: string };
    expect(badBody.ok).toBe(false);
    expect(badBody.error).toContain("EX_UNKNOWN");

    const plansRes = await getPlans(new Request("http://localhost:3000/api/ai/plans"));
    expect(plansRes.status).toBe(200);
  });

  it("enforces User A vs User B isolation (404) on /api/ai/memory and /api/ai/sync with 24h dedupe", async () => {
    const memRes = await postMemory(
      new Request("http://localhost:3000/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "nutrition",
          kind: "preference",
          key: `e2e_key_${Date.now()}`,
          value: "vegetarian",
        }),
      }),
    );
    expect(memRes.status).toBe(200);
    const memBody = (await memRes.json()) as { memory: { id: string } };

    // User B cannot delete User A's memory -> 404
    mockUserRef.current = { ...mockUserRef.current, id: "u-isolated-other-user" };
    const userBDelete = await deleteMemory(
      new Request(`http://localhost:3000/api/ai/memory?id=${encodeURIComponent(memBody.memory.id)}`, {
        method: "DELETE",
      }),
    );
    expect(userBDelete.status).toBe(404);

    // Owner (User A) deletes cleanly -> 200
    mockUserRef.current = { ...mockUserRef.current, id: "u-alex" };
    const delRes = await deleteMemory(
      new Request(`http://localhost:3000/api/ai/memory?id=${encodeURIComponent(memBody.memory.id)}`, {
        method: "DELETE",
      }),
    );
    expect(delRes.status).toBe(200);

    // Sync V2 generate + 24h dedupe + User B 404 isolation
    const s1 = await postSync(
      new Request("http://localhost:3000/api/ai/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", scenario: "equipment_change", newEquipment: ["dumbbell", "bodyweight"] }),
      }),
    );
    expect(s1.status).toBe(200);
    const s1Json = (await s1.json()) as { createdCount: number; proposals: Array<{ id: string }> };

    const s2 = await postSync(
      new Request("http://localhost:3000/api/ai/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", scenario: "equipment_change", newEquipment: ["dumbbell", "bodyweight"] }),
      }),
    );
    const s2Json = (await s2.json()) as { createdCount: number };
    expect(s2Json.createdCount).toBe(0);

    if (s1Json.proposals[0]) {
      mockUserRef.current = { ...mockUserRef.current, id: "u-isolated-other-user" };
      const userBSyncResolve = await postSync(
        new Request("http://localhost:3000/api/ai/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resolve", proposalId: s1Json.proposals[0].id, resolution: "accept" }),
        }),
      );
      expect(userBSyncResolve.status).toBe(404);

      mockUserRef.current = { ...mockUserRef.current, id: "u-alex" };
      const dis = await postSync(
        new Request("http://localhost:3000/api/ai/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resolve", proposalId: s1Json.proposals[0].id, resolution: "dismiss" }),
        }),
      );
      expect(dis.status).toBe(200);
      await db.delete(schema.syncProposals).where(eq(schema.syncProposals.id, s1Json.proposals[0].id));
    }
  });
});
