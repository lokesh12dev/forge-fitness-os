"use client";

import { BarChart } from "@/components/charts";
import { formatVolume } from "@/lib/utils";

export function VolumeChart({
  data,
  height = 148,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return <BarChart data={data} height={height} format={(v) => `${formatVolume(v)} kg`} />;
}
