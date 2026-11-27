import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getWorkspace } from "@/lib/queries";

export async function GET(req: Request) {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  if (format === "csv") {
    const header = [
      "workout_id",
      "workout_name",
      "started_at",
      "exercise",
      "set_number",
      "weight_kg",
      "reps",
      "rpe",
      "completed_at",
    ].join(",");

    const workoutNameMap = new Map(ws.completedWorkouts.map((w) => [w.id, w]));
    const rows = ws.sets.map((s) => {
      const ex = ws.exerciseMap.get(s.exerciseId)?.name ?? s.exerciseId;
      const w = workoutNameMap.get(s.workoutId);
      const safeName = (w?.name ?? "Session").replaceAll('"', '""');
      const safeEx = ex.replaceAll('"', '""');
      return [
        s.workoutId,
        `"${safeName}"`,
        w?.startedAt ? new Date(w.startedAt).toISOString() : "",
        `"${safeEx}"`,
        s.setIndex,
        s.weightKg,
        s.reps,
        s.rpe ?? "",
        new Date(s.completedAt).toISOString(),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="forge-training-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    app: "FORGE Personal Training & Nutrition OS",
    athlete: {
      id: user.id,
      name: user.name,
      email: user.email,
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      goal: user.goal,
      streak: user.streak,
      level: user.level,
    },
    targets: ws.targets,
    workouts: ws.completedWorkouts,
    sets: ws.sets,
    prs: ws.prs,
    bodyMetrics: ws.metrics,
    nutrition: ws.nutrition,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="forge-full-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
