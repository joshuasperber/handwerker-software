import { prisma } from "@/lib/prisma";

/** Distinct calendar colors – one per employee when possible */
export const EMPLOYEE_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // purple
];

export async function pickDistinctEmployeeColor(
  tenantId: string,
  excludeEmployeeId?: string
): Promise<string> {
  const used = await prisma.employee.findMany({
    where: {
      tenantId,
      ...(excludeEmployeeId ? { NOT: { id: excludeEmployeeId } } : {}),
    },
    select: { color: true },
  });
  const usedColors = new Set(used.map((e) => e.color.toLowerCase()));

  for (const color of EMPLOYEE_COLOR_PALETTE) {
    if (!usedColors.has(color.toLowerCase())) return color;
  }

  return EMPLOYEE_COLOR_PALETTE[used.length % EMPLOYEE_COLOR_PALETTE.length];
}

/** Ensures all employees in tenant have unique palette colors */
export async function normalizeEmployeeColors(tenantId: string) {
  const employees = await prisma.employee.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  const used = new Set<string>();
  for (const emp of employees) {
    const normalized = emp.color.toLowerCase();
    if (!used.has(normalized) && EMPLOYEE_COLOR_PALETTE.some((c) => c.toLowerCase() === normalized)) {
      used.add(normalized);
      continue;
    }
    const next = EMPLOYEE_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase()))
      ?? EMPLOYEE_COLOR_PALETTE[used.size % EMPLOYEE_COLOR_PALETTE.length];
    used.add(next.toLowerCase());
    await prisma.employee.update({ where: { id: emp.id }, data: { color: next } });
  }
}
