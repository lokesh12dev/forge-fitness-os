import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { dateKey, startOfWeek } from "./date";
import { readinessScore } from "./engine";

export async function getWorkspace(userId: string) {
  const today = dateKey();
  const [userRows, exercises, workouts, metrics, targets, nutrition, water, prs, posts, users, likes, challenges, gyms, checkins, routines, routineDays, routineExercises, coach, follows, comments] =
    await Promise.all([
      db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
      db.select().from(schema.exercises),
      db.select().from(schema.workouts).where(eq(schema.workouts.userId, userId)).orderBy(desc(schema.workouts.startedAt)),
      db.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId)).orderBy(schema.bodyMetrics.date),
      db.select().from(schema.macroTargets).where(eq(schema.macroTargets.userId, userId)).limit(1),
      db.select().from(schema.nutritionLogs).where(eq(schema.nutritionLogs.userId, userId)),
      db.select().from(schema.waterLogs).where(eq(schema.waterLogs.userId, userId)),
      db.select().from(schema.personalRecords).where(eq(schema.personalRecords.userId, userId)).orderBy(desc(schema.personalRecords.value)),
      db.select().from(schema.posts).orderBy(desc(schema.posts.createdAt)),
      db.select().from(schema.users),
      db.select().from(schema.postLikes).where(eq(schema.postLikes.userId, userId)),
      db.select().from(schema.challenges),
      db.select().from(schema.gyms),
      db.select().from(schema.checkins).orderBy(desc(schema.checkins.createdAt)),
      db.select().from(schema.routines),
      db.select().from(schema.routineDays),
      db.select().from(schema.routineExercises),
      db.select().from(schema.coachMessages).where(eq(schema.coachMessages.userId, userId)).orderBy(schema.coachMessages.createdAt),
      db.select().from(schema.follows).where(eq(schema.follows.followerId, userId)),
      db.select().from(schema.postComments).orderBy(asc(schema.postComments.createdAt)),
    ]);

  const user = userRows[0];
  if (!user) throw new Error("User not found");

  const workoutIds = workouts.map((w) => w.id);
  const [workoutExerciseRows, setRows] = await Promise.all([
    workoutIds.length
      ? db.select().from(schema.workoutExercises).where(inArray(schema.workoutExercises.workoutId, workoutIds))
      : Promise.resolve([]),
    workoutIds.length
      ? db.select().from(schema.workoutSets).where(inArray(schema.workoutSets.workoutId, workoutIds))
      : Promise.resolve([]),
  ]);

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const activeWorkout = workouts.find((w) => w.status === "active") ?? null;
  const completedWorkouts = workouts.filter((w) => w.status === "completed");
  const enrolledRoutine = routines.find((r) => r.enrolled) ?? routines[0] ?? null;
  const latestMetric = metrics[metrics.length - 1] ?? null;
  const readiness = readinessScore(latestMetric ?? {});
  const todayNutrition = nutrition.filter((n) => n.date === today);
  const todayWater = water.filter((w) => w.date === today);

  const weekStart = startOfWeek();
  const weekSets = setRows.filter((s) => new Date(s.completedAt) >= weekStart);
  const weekWorkouts = completedWorkouts.filter((w) => new Date(w.startedAt) >= weekStart);

  return {
    user,
    exercises,
    exerciseMap,
    workouts,
    completedWorkouts,
    activeWorkout,
    workoutExercises: workoutExerciseRows,
    sets: setRows,
    metrics,
    latestMetric,
    readiness,
    targets: targets[0] ?? { userId, calories: 2800, protein: 180, carbs: 300, fat: 80, waterMl: 3500 },
    nutrition,
    todayNutrition,
    water,
    todayWater,
    prs,
    posts,
    users,
    usersMap: new Map(users.map((u) => [u.id, u])),
    likedPosts: new Set(likes.map((l) => l.postId)),
    challenges,
    gyms,
    checkins,
    routines,
    routineDays,
    routineExercises,
    enrolledRoutine,
    coach,
    comments,
    following: new Set(follows.map((f) => f.followingId)),
    readiness_meta: latestMetric,
    weekSets,
    weekWorkouts,
    today,
  };
}

export type Workspace = Awaited<ReturnType<typeof getWorkspace>>;

export function programDays(ws: Workspace, routineId: string) {
  const days = ws.routineDays.filter((d) => d.routineId === routineId).sort((a, b) => a.dayIndex - b.dayIndex);
  return days.map((d) => ({
    ...d,
    exercises: ws.routineExercises
      .filter((e) => e.routineDayId === d.id)
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ ...e, exercise: ws.exerciseMap.get(e.exerciseId)! }))
      .filter((e) => e.exercise),
  }));
}

export function workoutDetail(ws: Workspace, workoutId: string) {
  const workout = ws.workouts.find((w) => w.id === workoutId);
  if (!workout) return null;
  const items = ws.workoutExercises
    .filter((we) => we.workoutId === workoutId)
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      ...we,
      exercise: ws.exerciseMap.get(we.exerciseId)!,
      sets: ws.sets
        .filter((s) => s.workoutId === workoutId && s.exerciseId === we.exerciseId)
        .sort((a, b) => a.setIndex - b.setIndex),
      history: previousSets(ws, we.exerciseId, workout.startedAt),
    }))
    .filter((we) => we.exercise);
  return { workout, items };
}

export function lastSetFor(ws: Workspace, exerciseId: string) {
  let best: (typeof ws.sets)[number] | null = null;
  for (const s of ws.sets) {
    if (s.exerciseId !== exerciseId || s.weightKg <= 0) continue;
    if (!best || new Date(s.completedAt) > new Date(best.completedAt)) best = s;
  }
  return best;
}

export function previousSets(ws: Workspace, exerciseId: string, before: Date) {
  const priorWorkoutIds = new Set(
    ws.workouts.filter((w) => new Date(w.startedAt) < before && w.status === "completed").map((w) => w.id),
  );
  const sets = ws.sets
    .filter((s) => s.exerciseId === exerciseId && priorWorkoutIds.has(s.workoutId))
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  if (!sets.length) return { weight: 0, reps: 0, date: null as Date | null };
  const latestWorkout = sets[0].workoutId;
  const latest = sets.filter((s) => s.workoutId === latestWorkout).sort((a, b) => a.setIndex - b.setIndex);
  const best = [...latest].sort((a, b) => b.weightKg * b.reps - a.weightKg * a.reps)[0];
  return { weight: best.weightKg, reps: best.reps, date: new Date(best.completedAt) };
}

export function personalRecordFor(ws: Workspace, exerciseId: string) {
  return ws.prs.find((p) => p.exerciseId === exerciseId) ?? null;
}

export function todayPlan(ws: Workspace) {
  const routine = ws.enrolledRoutine;
  if (!routine) return null;
  const days = programDays(ws, routine.id);
  if (!days.length) return null;
  const today = new Date();
  const weekday = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dpw = routine.daysPerWeek ?? 5;

  // Distribute training days across the week, starting Monday (1).
  // For dpw=5: Mon,Tue,Wed,Thu,Fri. For dpw=3: Mon,Wed,Fri. Etc.
  const trainingDays: number[] = [];
  for (let i = 0; i < dpw; i++) {
    // Map i to day-of-week: 1(Mon) + i for Mon-Fri, wrap to next week for Sat/Sun
    const dow = (1 + i) % 7;
    trainingDays.push(dow === 0 ? 7 : dow);
  }

  let slot = trainingDays.indexOf(weekday);
  let offset = 0;
  while (slot === -1 && offset < 7) {
    offset++;
    const wd = (weekday + offset) % 7;
    slot = trainingDays.indexOf(wd);
  }
  const dayIndex = slot >= 0 ? slot % days.length : 0;
  const day = days[dayIndex];
  const nextDate = new Date();
  if (offset > 0) nextDate.setDate(nextDate.getDate() + offset);
  return { routine, day, dayIndex, isToday: offset === 0, nextDate };
}

export function nextPlanAfter(ws: Workspace, currentName: string) {
  const routine = ws.enrolledRoutine;
  if (!routine) return null;
  const days = programDays(ws, routine.id);
  if (!days.length) return null;
  const idx = days.findIndex((d) => d.name === currentName);
  return days[(idx + 1) % days.length] ?? days[0];
}

export function weekVolumeSeries(ws: Workspace, weeks = 8) {
  const series: { label: string; volume: number; sessions: number; start: Date }[] = [];
  const thisWeek = startOfWeek();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek.getTime() - i * 7 * 86_400_000);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    const sessions = ws.completedWorkouts.filter((w) => {
      const t = new Date(w.startedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    const volume = sessions.reduce((acc, w) => acc + w.totalVolume, 0);
    series.push({
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: Math.round(volume),
      sessions: sessions.length,
      start,
    });
  }
  return series;
}

export function muscleVolume(ws: Workspace, sinceDays = 28) {
  const cutoff = Date.now() - sinceDays * 86_400_000;
  const totals: Record<string, number> = {};
  for (const s of ws.sets) {
    if (new Date(s.completedAt).getTime() < cutoff) continue;
    const ex = ws.exerciseMap.get(s.exerciseId);
    if (!ex) continue;
    totals[ex.primaryMuscle] = (totals[ex.primaryMuscle] ?? 0) + s.weightKg * s.reps;
  }
  return totals;
}

export function recentPRs(ws: Workspace, limit = 4) {
  return ws.prs
    .filter((p) => p.type === "e1rm")
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
    .slice(0, limit)
    .map((p) => ({ ...p, exercise: ws.exerciseMap.get(p.exerciseId) }));
}

export function nutritionTotals(ws: Workspace) {
  return ws.todayNutrition.reduce(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fat: acc.fat + n.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function weeklyNutrition(ws: Workspace) {
  const map = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number }>();
  for (const n of ws.nutrition) {
    const entry = map.get(n.date) ?? { date: n.date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    entry.calories += n.calories;
    entry.protein += n.protein;
    entry.carbs += n.carbs;
    entry.fat += n.fat;
    map.set(n.date, entry);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}

export function activeChallenge(ws: Workspace) {
  return ws.challenges.find((c) => c.joined) ?? ws.challenges[0] ?? null;
}

export function leaderboard(ws: Workspace) {
  const myVolume = Math.round(ws.weekSets.reduce((a, s) => a + s.weightKg * s.reps, 0));
  const rows = ws.users
    .filter((u) => u.id !== ws.user.id)
    .map((u) => {
      // Deterministic weekly training volume scaled by user xp and streak
      const volume = Math.round(u.xp * 0.42 + u.streak * 160 + 2600);
      return {
        id: u.id,
        name: u.name,
        initials: u.initials,
        accent: u.accent,
        streak: u.streak,
        volume,
        isMe: false,
      };
    });
  rows.push({
    id: ws.user.id,
    name: ws.user.name,
    initials: ws.user.initials,
    accent: ws.user.accent,
    streak: ws.user.streak,
    volume: myVolume,
    isMe: true,
  });
  return rows.sort((a, b) => b.volume - a.volume);
}

export function currentProgramWeek(ws: Workspace) {
  const routine = ws.enrolledRoutine;
  const totalWeeks = routine?.weeks ?? 8;
  const daysPerWeek = routine?.daysPerWeek ?? 5;
  const completedCount = ws.completedWorkouts.length;
  const week = Math.min(totalWeeks, Math.max(1, Math.floor(completedCount / daysPerWeek) + 1));
  return {
    week,
    totalWeeks,
    label: `Week ${week} of ${totalWeeks}`,
    shortLabel: `W${week}/${totalWeeks}`,
  };
}

export type ScheduleItemStatus = "done" | "next" | "skipped" | "upcoming";

export function weeklyScheduleStatus(ws: Workspace) {
  const routine = ws.enrolledRoutine;
  if (!routine) return [];
  const days = programDays(ws, routine.id);
  const weekStart = startOfWeek();
  const weekCompleted = ws.completedWorkouts.filter((w) => new Date(w.startedAt) >= weekStart);
  const completedDayNames = new Set(weekCompleted.map((w) => w.name));

  // Current weekday index: 0 = Mon, ..., 6 = Sun
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const dpw = routine.daysPerWeek ?? 5;

  let foundNext = false;

  return days.map((d, i) => {
    const isDone = completedDayNames.has(d.name);
    let status: ScheduleItemStatus;

    if (isDone) {
      status = "done";
    } else if (!foundNext) {
      status = "next";
      foundNext = true;
    } else {
      const scheduledDow = Math.min(i, dpw - 1);
      if (scheduledDow < todayDow) {
        status = "skipped";
      } else {
        status = "upcoming";
      }
    }

    return {
      day: d,
      index: i,
      status,
      isNext: status === "next",
      isDone: status === "done",
      isSkipped: status === "skipped",
      isUpcoming: status === "upcoming",
    };
  });
}

export async function getExerciseById(id: string) {
  const rows = await db.select().from(schema.exercises).where(eq(schema.exercises.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getWorkout(id: string) {
  const rows = await db.select().from(schema.workouts).where(eq(schema.workouts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getRecentSets(userId: string, exerciseId: string, limit = 6) {
  const rows = await db
    .select({ set: schema.workoutSets })
    .from(schema.workoutSets)
    .innerJoin(schema.workouts, eq(schema.workoutSets.workoutId, schema.workouts.id))
    .where(and(eq(schema.workouts.userId, userId), eq(schema.workoutSets.exerciseId, exerciseId)))
    .orderBy(desc(schema.workoutSets.completedAt))
    .limit(limit);
  return rows.map((r) => r.set);
}
