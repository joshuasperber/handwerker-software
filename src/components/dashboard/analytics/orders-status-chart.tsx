"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ChartPoint } from "@/lib/dashboard/analytics";
import { ChartEmptyState } from "./empty-state";

const config = {
  value: { label: "Aufträge", color: "#0d5c63" },
} satisfies ChartConfig;

export function OrdersStatusChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Keine Aufträge vorhanden." />;
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={56}
          tick={{ fontSize: 11 }}
        />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
