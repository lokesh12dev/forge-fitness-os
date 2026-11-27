import { requireUser } from "@/lib/auth";
import { getWorkspace, nutritionTotals } from "@/lib/queries";
import { dateKey, weekdayName } from "@/lib/date";
import { NutritionClient } from "@/components/nutrition-client";

export default async function NutritionPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const targets = ws.targets;
  const totals = nutritionTotals(ws);
  const todayKey = dateKey();

  const allLogs = ws.nutrition
    .filter((l) => l.meal !== "day")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((l) => ({
      id: l.id,
      date: l.date,
      meal: l.meal,
      name: l.name,
      serving: l.serving,
      calories: l.calories,
      protein: l.protein,
      carbs: l.carbs,
      fat: l.fat,
      source: l.source,
      createdAt: new Date(l.createdAt).getTime(),
    }));

  const logs = allLogs.filter((l) => l.date === todayKey);

  const waterByDate: Record<string, number> = {};
  for (const w of ws.water) {
    waterByDate[w.date] = (waterByDate[w.date] ?? 0) + w.ml;
  }
  const waterMl = waterByDate[todayKey] ?? 0;

  const burnedByDate: Record<string, number> = {};
  for (const w of ws.completedWorkouts) {
    const k = dateKey(new Date(w.startedAt));
    const kcal = w.calories || Math.round((w.durationSec / 3600) * user.weightKg * 6.5);
    burnedByDate[k] = (burnedByDate[k] ?? 0) + kcal;
  }
  const burned = burnedByDate[todayKey] ?? 0;

  const byDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const log of ws.nutrition) {
    const entry = byDate.get(log.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    entry.calories += log.calories;
    entry.protein += log.protein;
    entry.carbs += log.carbs;
    entry.fat += log.fat;
    byDate.set(log.date, entry);
  }

  const dailyHistory = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - i));
    const key = dateKey(d);
    const value = byDate.get(key) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      key,
      label: key === todayKey ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      shortDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...value,
      waterMl: waterByDate[key] ?? 0,
      burned: burnedByDate[key] ?? 0,
    };
  });

  const week = dailyHistory.slice(-7);

  const weightHistory = ws.metrics
    .filter((m) => typeof m.weightKg === "number" && m.weightKg > 0)
    .slice(-60)
    .map((m) => ({ date: m.date, weightKg: m.weightKg as number }));

  const latestWeight = weightHistory.length ? weightHistory[weightHistory.length - 1].weightKg : user.weightKg;
  const dateLabel = `${weekdayName(new Date())}, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;

  return (
    <NutritionClient
      firstName={user.name.split(" ")[0]}
      dateLabel={dateLabel}
      todayKey={todayKey}
      targets={targets}
      totals={totals}
      logs={logs}
      allLogs={allLogs}
      waterMl={waterMl}
      waterByDate={waterByDate}
      burned={burned}
      burnedByDate={burnedByDate}
      streak={user.streak}
      week={week}
      dailyHistory={dailyHistory}
      weightHistory={weightHistory}
      userProfile={{
        weightKg: latestWeight,
        heightCm: user.heightCm,
        sex: (user.sex as "male" | "female") || "male",
        age: 26,
      }}
    />
  );
}
