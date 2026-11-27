import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

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
  } as Record<string, unknown> | null,
};

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mockUserRef.current),
  requireUser: vi.fn(async () => mockUserRef.current),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { DELETE as deleteFormCheck, GET as getFormCheck, POST as postFormCheck } from "@/app/api/form-check/route";

const createdIds: string[] = [];

describe("/api/form-check route handler", () => {
  beforeEach(() => {
    mockUserRef.current = {
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
    };
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.delete(schema.formCheckSessions).where(eq(schema.formCheckSessions.id, id));
    }
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserRef.current = null;
    const res = await getFormCheck();
    expect(res.status).toBe(401);
  });

  it("persists a form-check session via POST and returns it via GET", async () => {
    const postReq = new Request("http://localhost:3000/api/form-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lift: "squat",
        angle: "Side",
        mode: "camera",
        reps: 5,
        score: 88,
        verdict: "Solid squat depth and bar path.",
        metrics: [
          { label: "Depth (knee)", value: "89°", target: "≤ 95°", ok: true },
          { label: "Bar drift", value: "3.1 cm", target: "≤ 4.0 cm", ok: true },
        ],
        issues: [
          {
            title: "Slight forward torso lean",
            cue: "Keep chest proud out of the hole.",
            severity: "low",
            at: "Rep 4",
          },
        ],
        repBreakdown: [{ rep: 1, score: 90, depthDeg: 89 }],
        attachToActiveWorkout: false,
      }),
    });

    const postRes = await postFormCheck(postReq);
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as { ok: boolean; id: string };
    expect(postJson.ok).toBe(true);
    expect(postJson.id).toMatch(/^fc-/);
    createdIds.push(postJson.id);

    const getRes = await getFormCheck();
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      ok: boolean;
      sessions: Array<{ id: string; lift: string; reps: number; score: number }>;
    };
    expect(getJson.ok).toBe(true);
    const found = getJson.sessions.find((s) => s.id === postJson.id);
    expect(found).toBeDefined();
    expect(found?.lift).toBe("squat");
    expect(found?.reps).toBe(5);
    expect(found?.score).toBe(88);
  });

  it("rejects invalid payloads with 400", async () => {
    const req = new Request("http://localhost:3000/api/form-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lift: "invalid_lift", score: 150 }),
    });
    const res = await postFormCheck(req);
    expect(res.status).toBe(400);
  });

  it("enforces user isolation on DELETE (404 for another user) and allows owner DELETE", async () => {
    const postReq = new Request("http://localhost:3000/api/form-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lift: "deadlift",
        angle: "Side",
        mode: "simulator",
        reps: 3,
        score: 84,
        verdict: "Good hinge mechanics.",
        metrics: [],
        issues: [],
        repBreakdown: [],
      }),
    });
    const postRes = await postFormCheck(postReq);
    const { id } = (await postRes.json()) as { id: string };
    createdIds.push(id);

    // Switch to another user
    mockUserRef.current = { ...mockUserRef.current, id: "u-other-user" };
    const otherDelRes = await deleteFormCheck(
      new Request(`http://localhost:3000/api/form-check?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
    expect(otherDelRes.status).toBe(404);

    // Switch back to owner
    mockUserRef.current = { ...mockUserRef.current, id: "u-alex" };
    const ownerDelRes = await deleteFormCheck(
      new Request(`http://localhost:3000/api/form-check?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
    expect(ownerDelRes.status).toBe(200);
    const ownerDelJson = (await ownerDelRes.json()) as { ok: boolean; deletedId: string };
    expect(ownerDelJson.ok).toBe(true);
    expect(ownerDelJson.deletedId).toBe(id);
  });
});
