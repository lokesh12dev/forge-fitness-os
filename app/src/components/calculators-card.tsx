"use client";

import { useState } from "react";
import { Calculator, Dumbbell, Scale } from "lucide-react";
import {
  calculateBarbellPlates,
  calculateDotsScore,
  calculateFfmi,
  calculateNavyBodyFat,
} from "@/lib/fitness-calculators";
import { Card, CardHeader } from "@/components/page-header";
import { Badge } from "@/components/ui";

export function CalculatorsCard({
  defaultSex = "male",
  defaultWeightKg = 78,
  defaultHeightCm = 178,
  defaultTotalKg = 380,
}: {
  defaultSex?: "male" | "female";
  defaultWeightKg?: number;
  defaultHeightCm?: number;
  defaultTotalKg?: number;
}) {
  const [tab, setTab] = useState<"bodycomp" | "plates" | "dots">("bodycomp");
  const [sex, setSex] = useState<"male" | "female">(defaultSex);
  const [weightKg, setWeightKg] = useState(defaultWeightKg);
  const [heightCm, setHeightCm] = useState(defaultHeightCm);
  const [waistCm, setWaistCm] = useState(82);
  const [neckCm, setNeckCm] = useState(38);
  const [hipCm, setHipCm] = useState(95);

  const [targetBarKg, setTargetBarKg] = useState(142.5);
  const [barKg, setBarKg] = useState(20);
  const [totalKg, setTotalKg] = useState(defaultTotalKg);

  const navy = calculateNavyBodyFat({ sex, heightCm, waistCm, neckCm, hipCm });
  const ffmi = navy ? calculateFfmi(weightKg, heightCm, navy.bodyFatPct) : null;
  const plates = calculateBarbellPlates(targetBarKg, barKg);
  const dots = calculateDotsScore(sex, weightKg, totalKg);

  return (
    <Card className="p-5 md:p-6">
      <CardHeader
        label="Strength & Body-Comp Lab (wger / lyftr)"
        title="Precision Calculators"
        action={
          <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            {(
              [
                { id: "bodycomp", label: "Navy BF% & FFMI" },
                { id: "plates", label: "Plate Loader" },
                { id: "dots", label: "IPF DOTS" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  tab === item.id ? "bg-acid text-ink" : "text-mist hover:text-chalk"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {tab === "bodycomp" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-[11px] text-mist">
              Sex
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as "male" | "female")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 text-[12px] text-chalk"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label className="text-[11px] text-mist">
              Weight (kg)
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            <label className="text-[11px] text-mist">
              Height (cm)
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            <label className="text-[11px] text-mist">
              Waist (cm)
              <input
                type="number"
                value={waistCm}
                onChange={(e) => setWaistCm(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            <label className="text-[11px] text-mist">
              Neck (cm)
              <input
                type="number"
                value={neckCm}
                onChange={(e) => setNeckCm(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            {sex === "female" && (
              <label className="text-[11px] text-mist">
                Hip (cm)
                <input
                  type="number"
                  value={hipCm}
                  onChange={(e) => setHipCm(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
                />
              </label>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-mist">
                <Scale className="size-3.5 text-acid" /> US Navy Estimate
              </span>
              {navy && <Badge tone="acid">{navy.category}</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-dim">Body Fat</p>
                <p className="font-numeric text-2xl font-bold text-chalk">
                  {navy ? `${navy.bodyFatPct}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-dim">Lean Mass</p>
                <p className="font-numeric text-2xl font-bold text-acid">
                  {ffmi ? `${ffmi.leanMassKg}kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-dim">Norm FFMI</p>
                <p className="font-numeric text-2xl font-bold text-chalk">
                  {ffmi ? ffmi.normalizedFfmi : "—"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-mist">
              {ffmi ? `Muscle tier: ${ffmi.tier} (natural ceiling ~25.0).` : "Enter valid tape measurements."}
            </p>
          </div>
        </div>
      )}

      {tab === "plates" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-mist">
              Target Weight (kg)
              <input
                type="number"
                step={2.5}
                value={targetBarKg}
                onChange={(e) => setTargetBarKg(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            <label className="text-[11px] text-mist">
              Barbell Weight (kg)
              <select
                value={barKg}
                onChange={(e) => setBarKg(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 text-[12px] text-chalk"
              >
                <option value={20}>20 kg (Olympic)</option>
                <option value={15}>15 kg (Women&apos;s)</option>
                <option value={10}>10 kg (Technique)</option>
              </select>
            </label>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-mist">
                <Dumbbell className="size-3.5 text-acid" /> Per-side plate stack
              </span>
              <Badge tone="neutral">{plates.achievableKg} kg loaded</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {plates.perSide.length ? (
                plates.perSide.map((p) => (
                  <span
                    key={p.plateKg}
                    className="rounded-lg border border-acid/30 bg-acid/10 px-2.5 py-1 font-numeric text-[12px] font-semibold text-acid"
                  >
                    {p.count} × {p.plateKg} kg
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-dim">Empty bar ({barKg} kg)</span>
              )}
            </div>
            {plates.remainderKg !== 0 && (
              <p className="mt-2 text-[11px] text-amber">
                Nearest achievable load: {plates.achievableKg} kg (Δ {plates.remainderKg} kg)
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "dots" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-mist">
              Squat + Bench + Deadlift (kg)
              <input
                type="number"
                step={2.5}
                value={totalKg}
                onChange={(e) => setTotalKg(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
            <label className="text-[11px] text-mist">
              Bodyweight (kg)
              <input
                type="number"
                step={0.5}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-panel-2 px-3 py-2 font-numeric text-[12px] text-chalk"
              />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] text-mist">
                <Calculator className="size-3.5 text-acid" /> IPF DOTS Index
              </p>
              <p className="mt-1 font-numeric text-3xl font-bold text-acid">{dots}</p>
            </div>
            <Badge tone={dots >= 400 ? "acid" : dots >= 300 ? "mint" : "neutral"}>
              {dots >= 450 ? "National" : dots >= 380 ? "Competitive" : dots >= 300 ? "Strong" : "Building"}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  );
}
