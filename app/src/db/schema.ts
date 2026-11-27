import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/* ─────────────────────────── USERS ─────────────────────────── */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    initials: text("initials").notNull(),
    accent: text("accent").notNull().default("#C9F73A"),
    bio: text("bio"),
    goal: text("goal").notNull().default("hypertrophy"),
    experience: text("experience").notNull().default("intermediate"),
    sex: text("sex").notNull().default("male"),
    weightKg: real("weight_kg").notNull().default(80),
    heightCm: real("height_cm").notNull().default(178),
    unitPref: text("unit_pref").notNull().default("kg"),
    equipment: text("equipment", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'["barbell","dumbbell","machine","cable","bodyweight","kettlebell","bands"]'`),
    streak: integer("streak").notNull().default(0),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    onboarded: integer("onboarded", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_handle_idx").on(t.handle)],
);

/* ─────────────────────── EXERCISE LIBRARY ─────────────────────── */

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    primaryMuscle: text("primary_muscle").notNull(),
    secondaryMuscles: text("secondary_muscles", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    equipment: text("equipment").notNull(),
    category: text("category").notNull(), // compound | isolation | conditioning
    pattern: text("pattern").notNull(), // horizontal_push, squat, hinge...
    unilateral: integer("unilateral", { mode: "boolean" }).notNull().default(false),
    difficulty: text("difficulty").notNull().default("intermediate"),
    instructions: text("instructions", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    cues: text("cues", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    tempo: text("tempo").notNull().default("2-0-1"),
    popularity: integer("popularity").notNull().default(50),
  },
  (t) => [
    uniqueIndex("exercises_slug_idx").on(t.slug),
    index("exercises_muscle_idx").on(t.primaryMuscle),
    index("exercises_pattern_idx").on(t.pattern),
  ],
);

/* ─────────────────────────── PROGRAMS ─────────────────────────── */

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").references(() => users.id),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull(),
  description: text("description").notNull(),
  goal: text("goal").notNull(),
  level: text("level").notNull(),
  daysPerWeek: integer("days_per_week").notNull(),
  weeks: integer("weeks").notNull(),
  accent: text("accent").notNull().default("#C9F73A"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  enrolled: integer("enrolled", { mode: "boolean" }).notNull().default(false),
  rating: real("rating").notNull().default(4.8),
  members: integer("members").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const routineDays = sqliteTable(
  "routine_days",
  {
    id: text("id").primaryKey(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    name: text("name").notNull(),
    focus: text("focus").notNull(),
  },
  (t) => [index("routine_days_routine_idx").on(t.routineId)],
);

export const routineExercises = sqliteTable(
  "routine_exercises",
  {
    id: text("id").primaryKey(),
    routineDayId: text("routine_day_id")
      .notNull()
      .references(() => routineDays.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    sets: integer("sets").notNull().default(3),
    repsMin: integer("reps_min").notNull().default(8),
    repsMax: integer("reps_max").notNull().default(12),
    restSec: integer("rest_sec").notNull().default(90),
    rpeTarget: real("rpe_target").notNull().default(8),
    supersetGroup: text("superset_group"),
  },
  (t) => [index("routine_exercises_day_idx").on(t.routineDayId)],
);

/* ─────────────────────────── WORKOUTS ─────────────────────────── */

export const workouts = sqliteTable(
  "workouts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: text("routine_id"),
    name: text("name").notNull(),
    focus: text("focus").notNull().default("Full body"),
    status: text("status").notNull().default("active"), // active | completed
    readiness: integer("readiness").notNull().default(80),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    durationSec: integer("duration_sec").notNull().default(0),
    totalVolume: real("total_volume").notNull().default(0),
    totalSets: integer("total_sets").notNull().default(0),
    calories: integer("calories").notNull().default(0),
    notes: text("notes"),
    compressed: integer("compressed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("workouts_user_idx").on(t.userId), index("workouts_status_idx").on(t.status)],
);

export const workoutExercises = sqliteTable(
  "workout_exercises",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    repsMin: integer("reps_min").notNull().default(8),
    repsMax: integer("reps_max").notNull().default(12),
    restSec: integer("rest_sec").notNull().default(90),
    rpeTarget: real("rpe_target").notNull().default(8),
    supersetGroup: text("superset_group"),
    swappedFrom: text("swapped_from"),
    notes: text("notes"),
  },
  (t) => [index("workout_exercises_workout_idx").on(t.workoutId)],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    setIndex: integer("set_index").notNull(),
    weightKg: real("weight_kg").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    rpe: real("rpe").notNull().default(8),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
    isPR: integer("is_pr", { mode: "boolean" }).notNull().default(false),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("workout_sets_workout_idx").on(t.workoutId),
    index("workout_sets_exercise_idx").on(t.exerciseId),
  ],
);

export const personalRecords = sqliteTable(
  "personal_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    type: text("type").notNull().default("e1rm"), // weight | e1rm | reps | volume
    value: real("value").notNull(),
    reps: integer("reps").notNull().default(0),
    achievedAt: integer("achieved_at", { mode: "timestamp_ms" }).notNull(),
    workoutId: text("workout_id"),
  },
  (t) => [index("prs_user_idx").on(t.userId), index("prs_exercise_idx").on(t.exerciseId)],
);

/* ─────────────────────────── NUTRITION ─────────────────────────── */

export const macroTargets = sqliteTable("macro_targets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  calories: integer("calories").notNull().default(2800),
  protein: integer("protein").notNull().default(190),
  carbs: integer("carbs").notNull().default(320),
  fat: integer("fat").notNull().default(80),
  waterMl: integer("water_ml").notNull().default(3500),
});

export const nutritionLogs = sqliteTable(
  "nutrition_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    meal: text("meal").notNull(), // breakfast | lunch | dinner | snack
    name: text("name").notNull(),
    serving: text("serving").notNull().default("1 serving"),
    calories: integer("calories").notNull(),
    protein: real("protein").notNull(),
    carbs: real("carbs").notNull(),
    fat: real("fat").notNull(),
    source: text("source").notNull().default("manual"), // manual | photo | barcode | voice
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("nutrition_user_date_idx").on(t.userId, t.date)],
);

export const waterLogs = sqliteTable(
  "water_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    ml: integer("ml").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("water_user_date_idx").on(t.userId, t.date)],
);

/* ─────────────────────────── RECOVERY ─────────────────────────── */

export const bodyMetrics = sqliteTable(
  "body_metrics",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    weightKg: real("weight_kg"),
    bodyFat: real("body_fat"),
    sleepHours: real("sleep_hours"),
    hrv: integer("hrv"),
    restingHr: integer("resting_hr"),
    soreness: integer("soreness").notNull().default(0), // 0-10
    steps: integer("steps"),
  },
  (t) => [uniqueIndex("body_metrics_user_date_idx").on(t.userId, t.date)],
);

/* ─────────────────────────── SOCIAL ─────────────────────────── */

export const gyms = sqliteTable("gyms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  busyness: integer("busyness").notNull().default(40),
  accent: text("accent").notNull().default("#C9F73A"),
});

export const checkins = sqliteTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gymId: text("gym_id")
      .notNull()
      .references(() => gyms.id),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("checkins_user_idx").on(t.userId)],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId)],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("pr"), // pr | checkin | workout | streak | text
    title: text("title").notNull(),
    body: text("body"),
    meta: text("meta", { mode: "json" }).$type<Record<string, string | number>>(),
    workoutId: text("workout_id"),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("posts_created_idx").on(t.createdAt)],
);

export const postLikes = sqliteTable(
  "post_likes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("post_likes_pair_idx").on(t.postId, t.userId)],
);

export const postComments = sqliteTable(
  "post_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("post_comments_post_idx").on(t.postId)],
);

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  metric: text("metric").notNull(), // sessions | volume | protein | streak
  target: real("target").notNull(),
  unit: text("unit").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  participants: integer("participants").notNull().default(0),
  accent: text("accent").notNull().default("#C9F73A"),
  joined: integer("joined", { mode: "boolean" }).notNull().default(false),
  progress: real("progress").notNull().default(0),
});

/* ─────────────────────────── AI COACH ─────────────────────────── */

export const coachMessages = sqliteTable(
  "coach_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | coach
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("coach_messages_user_idx").on(t.userId)],
);

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(), // schedule | workout | exercise | body | nutrition
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    status: text("status").notNull().default("complete"), // complete | interrupted
    planId: text("plan_id"),
    planJson: text("plan_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ai_conv_user_module_idx").on(t.userId, t.module),
    index("ai_conv_user_module_created_idx").on(t.userId, t.module, t.createdAt),
  ],
);

export const aiPlans = sqliteTable(
  "ai_plans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(), // schedule | workout | exercise | body | nutrition
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    currentVersionId: text("current_version_id"),
    parentPlanId: text("parent_plan_id"),
    provider: text("provider").notNull().default("forge-engine"),
    status: text("status").notNull().default("draft"), // draft | validated | approved | applied | superseded | archived
    planJson: text("plan_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("ai_plans_user_module_idx").on(t.userId, t.module),
    index("ai_plans_user_module_created_idx").on(t.userId, t.module, t.createdAt),
  ],
);

export const aiPlanVersions = sqliteTable(
  "ai_plan_versions",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => aiPlans.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    payloadJson: text("payload_json").notNull(),
    schemaVersion: text("schema_version").notNull().default("2.0"),
    changeSummary: text("change_summary").notNull().default("Initial draft"),
    createdBy: text("created_by").notNull().default("ai"), // ai | user
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("ai_plan_ver_unique_idx").on(t.planId, t.versionNo)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inTokens: integer("in_tokens").notNull().default(0),
    outTokens: integer("out_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    fellBack: integer("fell_back", { mode: "boolean" }).notNull().default(false),
    errorCode: text("error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export const coachMemory = sqliteTable(
  "coach_memory",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    kind: text("kind").notNull(), // decision | preference | frequent_swap | injury_note | plan_applied | adherence_summary
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    source: text("source").notNull().default("system"),
    confidence: real("confidence").notNull().default(1.0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("coach_memory_unique_idx").on(t.userId, t.module, t.kind, t.key)],
);

export const syncProposals = sqliteTable(
  "sync_proposals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    triggerType: text("trigger_type").notNull(),
    originModule: text("origin_module").notNull(),
    targetModule: text("target_module").notNull(),
    targetEntity: text("target_entity").notNull().default("default"),
    causalChainId: text("causal_chain_id").notNull(),
    depth: integer("depth").notNull().default(1),
    status: text("status").notNull().default("pending"), // pending | accepted | edited | dismissed | expired
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("sync_proposals_user_status_idx").on(t.userId, t.status, t.createdAt)],
);

export const aiApplyTokens = sqliteTable("ai_apply_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(),
  versionNo: integer("version_no").notNull().default(1),
  resultJson: text("result_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const aiGoals = sqliteTable(
  "ai_goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    metric: text("metric").notNull(), // weight_kg | bench_1rm | weekly_sessions | protein_g | custom
    startValue: real("start_value").notNull(),
    currentValue: real("current_value").notNull(),
    targetValue: real("target_value").notNull(),
    unit: text("unit").notNull().default("kg"),
    deadline: text("deadline"),
    relatedPlanId: text("related_plan_id"),
    milestonesJson: text("milestones_json").notNull().default("[]"),
    status: text("status").notNull().default("active"), // active | completed | paused
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ai_goals_user_idx").on(t.userId),
    index("ai_goals_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineDay = typeof routineDays.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type PersonalRecord = typeof personalRecords.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Gym = typeof gyms.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiPlanRecord = typeof aiPlans.$inferSelect;
export type AiPlanVersionRecord = typeof aiPlanVersions.$inferSelect;
export type AiUsageRecord = typeof aiUsage.$inferSelect;
export type CoachMemoryRecord = typeof coachMemory.$inferSelect;
export type SyncProposalRecord = typeof syncProposals.$inferSelect;
export type AiGoalRecord = typeof aiGoals.$inferSelect;
