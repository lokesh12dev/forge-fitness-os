"use server";

import { randomUUID } from "crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser, requireUser, SESSION_COOKIE } from "@/lib/auth";
import { dateKey } from "@/lib/date";
import { compressSession, computeLevelProgress, e1rm, proteinPlan, readinessScore, recoveryMap } from "@/lib/engine";
import { coachReply } from "@/lib/coach";

const rid = (p: string) => `${p}_${randomUUID().slice(0, 12)}`;

/* ─────────────────────────── AUTH ─────────────────────────── */

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) redirect("/login?error=email");
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  let userId = existing[0]?.id;
  if (!userId) {
    const base = email.split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 14) || "athlete";
    let handle = base;
    const clash = await db.select().from(schema.users).where(eq(schema.users.handle, handle)).limit(1);
    if (clash.length) handle = `${base}${Math.floor(Math.random() * 900 + 100)}`;
    userId = rid("u");
    const name = base.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await db.insert(schema.users).values({
      id: userId, email, name, handle,
      initials: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "AT",
      accent: "#C9F73A", goal: "hypertrophy", experience: "beginner", sex: "male",
      weightKg: 75, heightCm: 175, unitPref: "kg",
      equipment: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "bands", "ez-bar"],
      streak: 0, xp: 0, level: 1, onboarded: true, createdAt: new Date(),
    });
    await db.insert(schema.macroTargets).values({ userId, calories: 2600, protein: 160, carbs: 290, fat: 75, waterMl: 3000 });
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/* ─────────────────────────── WORKOUTS ─────────────────────────── */

export async function startWorkout(formData: FormData) {
  const user = await requireUser();
  const dayId = String(formData.get("dayId") ?? "");
  const [existing] = await db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "active")))
    .limit(1);
  if (existing) redirect(`/app/train/${existing.id}`);

  let day = null as typeof schema.routineDays.$inferSelect | null;
  let routine = null as typeof schema.routines.$inferSelect | null;
  if (dayId) {
    const [d] = await db.select().from(schema.routineDays).where(eq(schema.routineDays.id, dayId)).limit(1);
    day = d ?? null;
    if (d) {
      const [r] = await db.select().from(schema.routines).where(eq(schema.routines.id, d.routineId)).limit(1);
      routine = r ?? null;
    }
  }
  if (!day) {
    const [d] = await db.select().from(schema.routineDays).where(eq(schema.routineDays.id, "rd-hypertrophy-forge-0")).limit(1);
    day = d ?? null;
  }
  if (!day) redirect("/app/programs");

  const planned = await db
    .select()
    .from(schema.routineExercises)
    .where(eq(schema.routineExercises.routineDayId, day.id))
    .orderBy(schema.routineExercises.position);
  const scaffold = planned.length
    ? planned.map((p) => ({ exerciseId: p.exerciseId, targetSets: p.sets, repsMin: p.repsMin, repsMax: p.repsMax, restSec: p.restSec, rpeTarget: p.rpeTarget, supersetGroup: p.supersetGroup }))
    : [
        { exerciseId: "ex-bench-press", targetSets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8, supersetGroup: null },
        { exerciseId: "ex-barbell-row", targetSets: 3, repsMin: 8, repsMax: 10, restSec: 120, rpeTarget: 8, supersetGroup: null },
        { exerciseId: "ex-back-squat", targetSets: 3, repsMin: 6, repsMax: 8, restSec: 150, rpeTarget: 8, supersetGroup: null },
      ];

  const [metric] = await db.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, user.id)).orderBy(desc(schema.bodyMetrics.date)).limit(1);
  const workoutId = rid("wk");
  await db.insert(schema.workouts).values({
    id: workoutId, userId: user.id, routineId: routine?.id ?? "rt-hypertrophy-forge",
    name: day.name, focus: day.focus, status: "active",
    readiness: readinessScore(metric ?? {}), startedAt: new Date(),
    totalVolume: 0, totalSets: 0, notes: null, compressed: false,
  });
  await db.insert(schema.workoutExercises).values(
    scaffold.map((s, i) => ({
      id: rid("we"), workoutId, exerciseId: s.exerciseId, position: i,
      targetSets: s.targetSets, repsMin: s.repsMin, repsMax: s.repsMax,
      restSec: s.restSec, rpeTarget: s.rpeTarget, supersetGroup: s.supersetGroup,
    })),
  );
  redirect(`/app/train/${workoutId}`);
}

export async function completeSet(input: {
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  const weight = Math.max(0, Math.min(600, Number(input.weightKg) || 0));
  const reps = Math.max(0, Math.min(100, Math.round(Number(input.reps) || 0)));
  const rpe = Math.max(1, Math.min(10, Number(input.rpe) || 8));
  if (reps < 1) return { ok: false as const, error: "Enter reps" };

  const [workout] = await db
    .select()
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, input.workoutId), eq(schema.workouts.userId, user.id)))
    .limit(1);
  if (!workout) return { ok: false as const, error: "Workout not found" };
  if (workout.status !== "active") return { ok: false as const, error: "Workout already finished" };

  const [we] = await db
    .select()
    .from(schema.workoutExercises)
    .where(eq(schema.workoutExercises.id, input.workoutExerciseId))
    .limit(1);

  const [existingPR] = await db
    .select()
    .from(schema.personalRecords)
    .where(and(eq(schema.personalRecords.userId, user.id), eq(schema.personalRecords.exerciseId, input.exerciseId), eq(schema.personalRecords.type, "e1rm")))
    .orderBy(desc(schema.personalRecords.value))
    .limit(1);

  const score = e1rm(weight, reps);
  const isPR = score > 0 && score > (existingPR?.value ?? 0) + 0.4;

  const setId = rid("ws");
  await db.insert(schema.workoutSets).values({
    id: setId, workoutId: input.workoutId, exerciseId: input.exerciseId,
    setIndex: input.setIndex, weightKg: weight, reps, rpe,
    isWarmup: false, isPR, completedAt: new Date(),
  });

  if (isPR) {
    if (existingPR) {
      await db.update(schema.personalRecords)
        .set({ value: score, reps, achievedAt: new Date(), workoutId: input.workoutId })
        .where(eq(schema.personalRecords.id, existingPR.id));
    } else {
      await db.insert(schema.personalRecords).values({
        id: rid("pr"), userId: user.id, exerciseId: input.exerciseId, type: "e1rm",
        value: score, reps, achievedAt: new Date(), workoutId: input.workoutId,
      });
    }
  }

  await db.update(schema.workouts)
    .set({
      totalVolume: sql`${schema.workouts.totalVolume} + ${weight * reps}`,
      totalSets: sql`${schema.workouts.totalSets} + 1`,
    })
    .where(eq(schema.workouts.id, input.workoutId));

  return {
    ok: true as const,
    setId,
    isPR,
    e1rm: score,
    previousBest: existingPR?.value ?? null,
    restSec: we?.restSec ?? 90,
    totalVolume: workout.totalVolume + weight * reps,
  };
}

export async function undoSet(setId: string) {
  const user = await requireUser();
  const [row] = await db.select().from(schema.workoutSets).where(eq(schema.workoutSets.id, setId)).limit(1);
  if (!row) return { ok: false as const };
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, row.workoutId)).limit(1);
  if (!workout || workout.userId !== user.id) return { ok: false as const };
  await db.delete(schema.workoutSets).where(eq(schema.workoutSets.id, setId));
  await db.update(schema.workouts)
    .set({
      totalVolume: sql`MAX(0, ${schema.workouts.totalVolume} - ${row.weightKg * row.reps})`,
      totalSets: sql`MAX(0, ${schema.workouts.totalSets} - 1)`,
    })
    .where(eq(schema.workouts.id, row.workoutId));
  return { ok: true as const };
}

export async function swapExercise(input: { workoutId: string; workoutExerciseId: string; newExerciseId: string }) {
  const user = await requireUser();
  const [we] = await db.select().from(schema.workoutExercises).where(eq(schema.workoutExercises.id, input.workoutExerciseId)).limit(1);
  if (!we) return { ok: false as const, error: "Not found" };
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, input.workoutId)).limit(1);
  if (!workout || workout.userId !== user.id) return { ok: false as const, error: "Not found" };

  const oldSets = await db.select().from(schema.workoutSets)
    .where(and(eq(schema.workoutSets.workoutId, input.workoutId), eq(schema.workoutSets.exerciseId, we.exerciseId)));
  const oldVolume = oldSets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  if (oldSets.length) {
    await db.delete(schema.workoutSets)
      .where(and(eq(schema.workoutSets.workoutId, input.workoutId), eq(schema.workoutSets.exerciseId, we.exerciseId)));
    await db.update(schema.workouts).set({
      totalVolume: sql`MAX(0, ${schema.workouts.totalVolume} - ${oldVolume})`,
      totalSets: sql`MAX(0, ${schema.workouts.totalSets} - ${oldSets.length})`,
    }).where(eq(schema.workouts.id, input.workoutId));
  }
  await db.update(schema.workoutExercises)
    .set({ exerciseId: input.newExerciseId, swappedFrom: we.exerciseId })
    .where(eq(schema.workoutExercises.id, we.id));
  return { ok: true as const };
}

export async function compressWorkout(workoutId: string) {
  const user = await requireUser();
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId)).limit(1);
  if (!workout || workout.userId !== user.id) return { ok: false as const, error: "Not found" };
  const items = await db.select().from(schema.workoutExercises)
    .where(eq(schema.workoutExercises.workoutId, workoutId))
    .orderBy(schema.workoutExercises.position);
  if (!items.length) return { ok: false as const, error: "No exercises" };
  const result = compressSession(items, 25);
  for (const ex of result.exercises) {
    await db.update(schema.workoutExercises)
      .set({ restSec: ex.restSec, supersetGroup: ex.supersetGroup })
      .where(eq(schema.workoutExercises.id, ex.id));
  }
  await db.update(schema.workouts).set({ compressed: true }).where(eq(schema.workouts.id, workoutId));
  return { ok: true as const, originalMin: result.originalMin, compressedMin: result.compressedMin };
}

export async function addExerciseToWorkout(input: { workoutId: string; exerciseId: string }) {
  const user = await requireUser();
  const [workout] = await db.select().from(schema.workouts).where(eq(schema.workouts.id, input.workoutId)).limit(1);
  if (!workout || workout.userId !== user.id) return { ok: false as const, error: "Not found" };
  const items = await db.select().from(schema.workoutExercises).where(eq(schema.workoutExercises.workoutId, input.workoutId));
  const newId = rid("we");
  await db.insert(schema.workoutExercises).values({
    id: newId, workoutId: input.workoutId, exerciseId: input.exerciseId,
    position: items.length, targetSets: 3, repsMin: 8, repsMax: 12, restSec: 90, rpeTarget: 8,
  });
  const [ex] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, input.exerciseId)).limit(1);
  return { ok: true as const, id: newId, exercise: ex ?? null };
}

export async function updateTargetSets(workoutExerciseId: string, targetSets: number) {
  await requireUser();
  await db.update(schema.workoutExercises)
    .set({ targetSets: Math.max(1, Math.min(12, targetSets)) })
    .where(eq(schema.workoutExercises.id, workoutExerciseId));
  return { ok: true as const };
}

export async function finishWorkout(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const [workout] = await db
    .select().from(schema.workouts)
    .where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userId, user.id)))
    .limit(1);
  if (!workout) redirect("/app");
  const now = new Date();
  const durationSec = Math.max(60, Math.round((now.getTime() - new Date(workout.startedAt).getTime()) / 1000));
  await db.update(schema.workouts).set({
    status: "completed", completedAt: now, durationSec,
    notes: notes || null,
    calories: Math.round((durationSec / 3600) * (user.weightKg * 6.5)),
  }).where(eq(schema.workouts.id, workoutId));

  const [last] = await db.select().from(schema.workouts)
    .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "completed")))
    .orderBy(desc(schema.workouts.completedAt)).limit(1);
  const alreadyToday = last && dateKey(new Date(last.completedAt!)) === dateKey(now) && last.id !== workoutId;
  const xpGain = Math.round(workout.totalVolume / 60) + 60;
  const newXp = user.xp + xpGain;
  const { level: newLevel } = computeLevelProgress(newXp);
  await db.update(schema.users).set({
    xp: newXp,
    level: newLevel,
    streak: alreadyToday ? user.streak : user.streak + 1,
  }).where(eq(schema.users.id, user.id));

  revalidatePath("/app");
  revalidatePath("/app/train");
  revalidatePath("/app/progress");
  revalidatePath("/app/social");
  redirect(`/app/train/${workoutId}/summary`);
}

/* ─────────────────────────── NUTRITION ─────────────────────────── */

export async function logFood(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const calories = Math.max(0, Math.round(Number(formData.get("calories")) || 0));
  const protein = Math.max(0, Number(formData.get("protein")) || 0);
  const carbs = Math.max(0, Number(formData.get("carbs")) || 0);
  const fat = Math.max(0, Number(formData.get("fat")) || 0);
  const meal = String(formData.get("meal") ?? "snack");
  const source = String(formData.get("source") ?? "manual");
  if (!name) return;
  await db.insert(schema.nutritionLogs).values({
    id: rid("nl"), userId: user.id, date: dateKey(), meal,
    name, serving: String(formData.get("serving") ?? "1 serving"),
    calories, protein, carbs, fat, source, createdAt: new Date(),
  });
  revalidatePath("/app/nutrition");
  revalidatePath("/app");
}

export async function deleteFood(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const [row] = await db.select().from(schema.nutritionLogs).where(eq(schema.nutritionLogs.id, id)).limit(1);
  if (row && row.userId === user.id) {
    await db.delete(schema.nutritionLogs).where(eq(schema.nutritionLogs.id, id));
  }
  revalidatePath("/app/nutrition");
  revalidatePath("/app");
}

export async function addWater(ml: number) {
  const user = await requireUser();
  await db.insert(schema.waterLogs).values({ id: rid("wl"), userId: user.id, date: dateKey(), ml, createdAt: new Date() });
  revalidatePath("/app/nutrition");
  revalidatePath("/app");
}

export async function updateTargets(formData: FormData) {
  const user = await requireUser();
  const values = {
    calories: Math.max(1200, Math.round(Number(formData.get("calories")) || 2800)),
    protein: Math.max(40, Math.round(Number(formData.get("protein")) || 180)),
    carbs: Math.max(0, Math.round(Number(formData.get("carbs")) || 300)),
    fat: Math.max(20, Math.round(Number(formData.get("fat")) || 80)),
    waterMl: Math.max(500, Math.round(Number(formData.get("waterMl")) || 3500)),
  };
  const existing = await db.select().from(schema.macroTargets).where(eq(schema.macroTargets.userId, user.id)).limit(1);
  if (existing.length) {
    await db.update(schema.macroTargets).set(values).where(eq(schema.macroTargets.userId, user.id));
  } else {
    await db.insert(schema.macroTargets).values({ userId: user.id, ...values });
  }
  revalidatePath("/app/nutrition");
  revalidatePath("/app");
}

/* ─────────────────────────── SOCIAL ─────────────────────────── */

export async function toggleLike(postId: string) {
  const user = await requireUser();
  const [existing] = await db.select().from(schema.postLikes)
    .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, user.id))).limit(1);
  if (existing) {
    await db.delete(schema.postLikes)
      .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, user.id)));
    await db.update(schema.posts).set({ likes: sql`MAX(0, ${schema.posts.likes} - 1)` }).where(eq(schema.posts.id, postId));
  } else {
    await db.insert(schema.postLikes).values({ postId, userId: user.id, createdAt: new Date() });
    await db.update(schema.posts).set({ likes: sql`${schema.posts.likes} + 1` }).where(eq(schema.posts.id, postId));
  }
  revalidatePath("/app/social");
  return { ok: true as const, liked: !existing };
}

export async function joinChallenge(formData: FormData) {
  const user = await requireUser();
  const challengeId = String(formData.get("challengeId") ?? "");
  const [c] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, challengeId)).limit(1);
  if (!c) return;
  await db.update(schema.challenges).set({
    joined: !c.joined,
    participants: c.joined ? Math.max(0, c.participants - 1) : c.participants + 1,
  }).where(eq(schema.challenges.id, challengeId));
  revalidatePath("/app/social");
}

export async function checkIn(formData: FormData) {
  const user = await requireUser();
  const gymId = String(formData.get("gymId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  await db.insert(schema.checkins).values({ id: rid("ci"), userId: user.id, gymId, note: note || null, createdAt: new Date() });
  const [gym] = await db.select().from(schema.gyms).where(eq(schema.gyms.id, gymId)).limit(1);
  if (gym) {
    await db.insert(schema.posts).values({
      id: rid("post"), userId: user.id, type: "checkin", title: `Checked in at ${gym.name}`,
      body: note || null, meta: { gym: gym.name }, likes: 0, comments: 0, createdAt: new Date(),
    });
  }
  revalidatePath("/app/social");
  revalidatePath("/app");
}

export async function toggleFollow(formData: FormData) {
  const user = await requireUser();
  const followingId = String(formData.get("userId") ?? "");
  if (followingId === user.id) return;
  const [existing] = await db.select().from(schema.follows)
    .where(and(eq(schema.follows.followerId, user.id), eq(schema.follows.followingId, followingId))).limit(1);
  if (existing) {
    await db.delete(schema.follows)
      .where(and(eq(schema.follows.followerId, user.id), eq(schema.follows.followingId, followingId)));
  } else {
    await db.insert(schema.follows).values({ followerId: user.id, followingId, createdAt: new Date() });
  }
  revalidatePath("/app/social");
}

export async function createPost(formData: FormData) {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "").trim().slice(0, 600);
  if (!content) return;
  const kind = String(formData.get("type") ?? "text");
  const allowed = ["text", "pr", "workout", "streak", "checkin"];
  const type = allowed.includes(kind) ? kind : "text";
  const firstLine = content.split("\n")[0];
  const title = firstLine.length > 74 ? `${firstLine.slice(0, 71)}…` : firstLine;
  const body = content.length > firstLine.length ? content.slice(firstLine.length + 1).trim() : null;
  await db.insert(schema.posts).values({
    id: rid("post"), userId: user.id, type, title,
    body: body || null, meta: null, likes: 0, comments: 0, createdAt: new Date(),
  });
  revalidatePath("/app/social");
}

export async function addComment(formData: FormData) {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const content = String(formData.get("content") ?? "").trim().slice(0, 400);
  if (!postId || !content) return;
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!post) return;
  await db.insert(schema.postComments).values({
    id: rid("pc"), postId, userId: user.id, content, createdAt: new Date(),
  });
  await db.update(schema.posts).set({ comments: sql`${schema.posts.comments} + 1` }).where(eq(schema.posts.id, postId));
  revalidatePath("/app/social");
}

/* ─────────────────────────── COACH ─────────────────────────── */

export async function sendCoachMessage(formData: FormData) {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await db.insert(schema.coachMessages).values({
    id: rid("cm"), userId: user.id, role: "user", content, createdAt: new Date(),
  });

  const [metric] = await db.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, user.id)).orderBy(desc(schema.bodyMetrics.date)).limit(1);
  const [targets] = await db.select().from(schema.macroTargets).where(eq(schema.macroTargets.userId, user.id)).limit(1);
  const todayLogs = await db.select().from(schema.nutritionLogs).where(and(eq(schema.nutritionLogs.userId, user.id), eq(schema.nutritionLogs.date, dateKey())));
  const meals = todayLogs.filter((l) => l.meal !== "day");
  const consumed = meals.reduce((a, n) => ({ calories: a.calories + n.calories, protein: a.protein + n.protein }), { calories: 0, protein: 0 });
  const allSets = await db
    .select({ set: schema.workoutSets, workout: schema.workouts })
    .from(schema.workoutSets)
    .innerJoin(schema.workouts, eq(schema.workoutSets.workoutId, schema.workouts.id))
    .where(eq(schema.workouts.userId, user.id));
  const last7 = allSets
    .filter((r) => new Date(r.set.completedAt).getTime() > Date.now() - 7 * 86_400_000)
    .map((r) => ({ ...r.set, primaryMuscle: "" }));
  const exRows = await db.select().from(schema.exercises);
  const exMap = new Map(exRows.map((e) => [e.id, e]));
  const recoveryRows = allSets.map((r) => ({
    primaryMuscle: exMap.get(r.set.exerciseId)?.primaryMuscle ?? "core",
    completedAt: r.set.completedAt, weightKg: r.set.weightKg, reps: r.set.reps,
  }));
  const rec = recoveryMap(recoveryRows);
  const labels: Record<string, string> = { chest: "Chest", back: "Back", lats: "Lats", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", core: "Core", forearms: "Forearms" };
  const prRows = await db.select().from(schema.personalRecords).where(eq(schema.personalRecords.userId, user.id));
  const prs = prRows.map((p) => ({ exercise: exMap.get(p.exerciseId)?.name ?? "Lift", value: p.value }));
  const [routine] = await db.select().from(schema.routines).where(and(eq(schema.routines.ownerId, user.id), eq(schema.routines.enrolled, true))).limit(1);
  const [last] = await db.select().from(schema.workouts).where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "completed"))).orderBy(desc(schema.workouts.completedAt)).limit(1);

  // Resolve the actual next program day and its exercises instead of a canned plan.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
  const weekRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, "completed"), gte(schema.workouts.startedAt, weekStart)));
  const weekCount = Number(weekRows[0]?.n ?? 0);
  const planDays = routine
    ? await db.select().from(schema.routineDays).where(eq(schema.routineDays.routineId, routine.id)).orderBy(schema.routineDays.dayIndex)
    : [];
  const planDay = planDays.length ? planDays[weekCount % planDays.length] : null;
  const planExerciseRows = planDay
    ? await db
        .select({ name: schema.exercises.name })
        .from(schema.routineExercises)
        .innerJoin(schema.exercises, eq(schema.routineExercises.exerciseId, schema.exercises.id))
        .where(eq(schema.routineExercises.routineDayId, planDay.id))
        .orderBy(schema.routineExercises.position)
    : [];
  const readiness = readinessScore(metric ?? {});
  const reply = coachReply(content, {
    name: user.name.split(" ")[0], readiness,
    sleep: metric?.sleepHours ?? 7, hrv: metric?.hrv ?? 60,
    proteinTarget: targets?.protein ?? 180, proteinConsumed: consumed.protein,
    caloriesTarget: targets?.calories ?? 2800, caloriesConsumed: consumed.calories,
    planName: planDay?.name ?? "today's session",
    planFocus: planDay?.focus ?? "Full body",
    planExercises: planExerciseRows.map((r) => r.name),
    programName: routine?.name ?? "Hypertrophy Forge",
    lastWorkout: last ? { name: last.name, daysAgo: Math.floor((Date.now() - new Date(last.completedAt!).getTime()) / 86_400_000), volume: last.totalVolume } : null,
    prs,
    recovery: Object.entries(rec).map(([k, v]) => ({ label: labels[k] ?? k, recovery: v.recovery })).sort((a, b) => a.recovery - b.recovery),
    streak: user.streak,
  });
  await db.insert(schema.coachMessages).values({
    id: rid("cm"), userId: user.id, role: "coach", content: reply, createdAt: new Date(),
  });
  revalidatePath("/app/coach");
}

/* ─────────────────────────── PROFILE ─────────────────────────── */

export async function updateEquipment(equipment: string[]) {
  const user = await requireUser();
  await db.update(schema.users).set({ equipment }).where(eq(schema.users.id, user.id));
  revalidatePath("/app/settings");
  revalidatePath("/app/train");
  return { ok: true as const };
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  await db.update(schema.users).set({
    name: String(formData.get("name") ?? user.name).slice(0, 60),
    bio: String(formData.get("bio") ?? "").slice(0, 200) || null,
    goal: String(formData.get("goal") ?? user.goal),
    experience: String(formData.get("experience") ?? user.experience),
    unitPref: String(formData.get("unitPref") ?? user.unitPref),
    weightKg: Math.max(30, Math.min(250, Number(formData.get("weightKg")) || user.weightKg)),
    heightCm: Math.max(120, Math.min(230, Number(formData.get("heightCm")) || user.heightCm)),
  }).where(eq(schema.users.id, user.id));
  revalidatePath("/app/settings");
  revalidatePath("/app");
}

export async function enrollProgram(formData: FormData) {
  const user = await requireUser();
  const routineId = String(formData.get("routineId") ?? "");
  await db.update(schema.routines).set({ enrolled: false }).where(eq(schema.routines.ownerId, user.id));
  await db.update(schema.routines).set({ enrolled: true }).where(eq(schema.routines.id, routineId));
  revalidatePath("/app/programs");
  revalidatePath("/app");
  redirect("/app");
}
