import { requireUser } from "@/lib/auth";
import { getWorkspace, nutritionTotals } from "@/lib/queries";
import { dateKey, weekdayName } from "@/lib/date";
import { NutritionClient } from "@/components/nutrition-client";

export default async function NutritionPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);
  const targets = ws.targets;
  const totals = nutritionTotals(ws);

  const logs = ws.todayNutrition
    .filter((l) => l.meal !== "day")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((l) => ({
      id: l.id,
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

  const waterMl = ws.todayWater.reduce((a, w) => a + w.ml, 0);

  const todayKey = dateKey();
  const byDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const log of ws.nutrition) {
    const entry = byDate.get(log.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    entry.calories += log.calories;
    entry.protein += log.protein;
    entry.carbs += log.carbs;
    entry.fat += log.fat;
    byDate.set(log.date, entry);
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    const value = byDate.get(key) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      key,
      label: key === todayKey ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      ...value,
    };
  });

  const burned = ws.completedWorkouts
    .filter((w) => dateKey(new Date(w.startedAt)) === todayKey)
    .reduce((a, w) => a + (w.calories || Math.round((w.durationSec / 3600) * user.weightKg * 6.5)), 0);

  const dateLabel = `${weekdayName(new Date())}, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;

  return (
    <NutritionClient
      firstName={user.name.split(" ")[0]}
      dateLabel={dateLabel}
      targets={targets}
      totals={totals}
      logs={logs}
      waterMl={waterMl}
      burned={burned}
      streak={user.streak}
      week={week}
      userProfile={{
        weightKg: user.weightKg,
        heightCm: user.heightCm,
        sex: (user.sex as "male" | "female") || "male",
        age: 26,
      }}
    />
  );
}
