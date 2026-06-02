"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ChartPoint } from "@/lib/dashboard/analytics";
import { pickColor } from "./colors";
import { ChartEmptyState } from "./empty-state";

type InvoiceStatusPoint = ChartPoint & { status: string };

export function InvoiceStatusChart({ data }: { data: InvoiceStatusPoint[] }) {
  if (data.length === 0) {
    return <ChartEmptyState message="Noch keine Rechnungen erfasst." />;
  }

  const config: ChartConfig = {};
  data.forEach((entry, index) => {
    config[entry.label] = { label: entry.label, color: pickColor(index) };
  });

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-2">
      <ChartContainer
        config={config}
        className="aspect-square h-[200px] w-[200px] shrink-0"
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent nameKey="label" hideLabel />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.status} fill={pickColor(index)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="flex w-full flex-col gap-2 text-sm">
        {data.map((entry, index) => (
          <li key={entry.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: pickColor(index) }}
            />
            <span className="flex-1 text-muted-foreground">{entry.label}</span>
            <span className="font-medium tabular-nums">{entry.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {total > 0 ? Math.round((entry.value / total) * 100) : 0} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
