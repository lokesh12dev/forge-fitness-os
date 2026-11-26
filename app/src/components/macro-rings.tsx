"use client";

import { useId } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroRingsProps {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
  size?: number;
  className?: string;
}

export function MacroRings({
  calories,
  protein,
  carbs,
  fat,
  size = 200,
  className,
}: MacroRingsProps) {
  const uid = useId().replace(/:/g, "");
  const center = size / 2;
  const strokeWidth = 10;
  const gap = 4;

  const rings = [
    {
      id: "cal",
      name: "Calories",
      radius: center - strokeWidth / 2 - 2,
      current: calories.current,
      target: calories.target,
      color: "#FFFFFF",
      trackColor: "rgba(255, 255, 255, 0.08)",
      unit: "kcal",
    },
    {
      id: "pro",
      name: "Protein",
      radius: center - strokeWidth / 2 - strokeWidth - gap - 2,
      current: protein.current,
      target: protein.target,
      color: "#C9F73A", // Acid Lime
      trackColor: "rgba(201, 247, 58, 0.15)",
      unit: "g",
    },
    {
      id: "carb",
      name: "Carbs",
      radius: center - strokeWidth / 2 - (strokeWidth + gap) * 2 - 2,
      current: carbs.current,
      target: carbs.target,
      color: "#6EA8FF", // Sky Blue
      trackColor: "rgba(110, 168, 255, 0.15)",
      unit: "g",
    },
    {
      id: "fat",
      name: "Fat",
      radius: center - strokeWidth / 2 - (strokeWidth + gap) * 3 - 2,
      current: fat.current,
      target: fat.target,
      color: "#FFD166", // Amber
      trackColor: "rgba(255, 209, 102, 0.15)",
      unit: "g",
    },
  ];

  const calRemaining = Math.max(0, calories.target - calories.current);

  return (
    <div className={cn("relative flex flex-col items-center justify-center select-none", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <defs>
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {rings.map((r) => {
          const circumference = 2 * Math.PI * r.radius;
          const ratio = r.target > 0 ? Math.min(1.0, r.current / r.target) : 0;
          const strokeDashoffset = circumference * (1 - ratio);

          return (
            <g key={r.id}>
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={r.radius}
                fill="none"
                stroke={r.trackColor}
                strokeWidth={strokeWidth}
              />
              {/* Animated Progress Ring */}
              <circle
                cx={center}
                cy={center}
                r={r.radius}
                fill="none"
                stroke={r.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Center Calorie Display */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <Flame className="size-4 text-acid mb-0.5" />
        <span className="font-numeric text-2xl font-black tracking-tight text-chalk">
          {Math.round(calories.current)}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-wider text-dim">
          {calRemaining > 0 ? `${calRemaining} left` : "Target hit"}
        </span>
      </div>
    </div>
  );
}
