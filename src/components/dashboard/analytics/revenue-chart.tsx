"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatEuro } from "@/lib/utils";
import type { RevenuePoint } from "@/lib/dashboard/analytics";
import { ChartEmptyState } from "./empty-state";

const config = {
  umsatz: { label: "Umsatz", color: "#0d5c63" },
} satisfies ChartConfig;

function compactEuro(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("de-DE", {
      maximumFractionDigits: 1,
    })} k €`;
  }
  return `${value} €`;
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const hasData = data.some((point) => point.umsatz > 0);
  if (!hasData) {
    return <ChartEmptyState message="Noch keine Umsätze im Zeitraum." />;
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillUmsatz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-umsatz)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-umsatz)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={compactEuro}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium text-foreground">
                  {formatEuro(Number(value))}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="umsatz"
          type="monotone"
          stroke="var(--color-umsatz)"
          fill="url(#fillUmsatz)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
