import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcLaborCost, calcWorkedHours } from "@/lib/time-entry";
import { startOfDay, endOfDay, parseISO } from "date-fns";

type EmployeeRow = {
  id: string;
  hourlyWageNet: number | null;
  user: { firstName: string; lastName: string; email: string };
};

/** Lädt Stundenlohn robust — auch wenn Prisma-Client/DB noch nicht synchron sind. */
async function loadHourlyWages(
  tenantId: string,
  employeeIds: string[]
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (employeeIds.length === 0) return map;

  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; hourlyWageNet: number | null }>
    >`
      SELECT id, "hourlyWageNet"
      FROM "Employee"
      WHERE "tenantId" = ${tenantId}
    `;
    const idSet = new Set(employeeIds);
    for (const row of rows) {
      if (idSet.has(row.id)) map.set(row.id, row.hourlyWageNet);
    }
  } catch (err) {
    console.warn("[time-entries] hourlyWageNet nicht lesbar:", err);
  }
  return map;
}

/** Team-Stunden-Auswertung für Büro / Meister / Admin */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("time_entries.read");
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const orderId = searchParams.get("orderId") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const q = searchParams.get("q")?.trim() || undefined;

    const from = fromStr ? startOfDay(parseISO(fromStr)) : startOfDay(new Date());
    const to = toStr ? endOfDay(parseISO(toStr)) : endOfDay(new Date());

    const employeesBase = await prisma.employee.findMany({
      where: {
        tenantId: auth.tenantId,
        user: { isActive: true },
        ...(employeeId ? { id: employeeId } : {}),
      },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { user: { lastName: "asc" } },
    });

    const employeeIds = employeesBase.map((e) => e.id);
    const wageById = await loadHourlyWages(auth.tenantId, employeeIds);
    const employees: EmployeeRow[] = employeesBase.map((e) => ({
      ...e,
      hourlyWageNet: wageById.get(e.id) ?? null,
    }));

    if (employeeIds.length === 0) {
      return apiSuccess({
        from: from.toISOString(),
        to: to.toISOString(),
        employees: [],
        entries: [],
        totalsByEmployee: [],
        orders: [],
        projects: [],
        totalHours: 0,
        totalLaborCostNet: null,
      });
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        employeeId: { in: employeeIds },
        startTime: { gte: from, lte: to },
        ...(status ? { status: status as "OPEN" | "REVIEWED" | "APPROVED" } : {}),
        ...(orderId ? { orderId } : {}),
        ...(projectId ? { order: { projectId } } : {}),
        ...(q
          ? {
              OR: [
                { activity: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
                { order: { orderNumber: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            projectId: true,
            project: { select: { id: true, name: true } },
            customer: { select: { firstName: true, lastName: true } },
          },
        },
        employee: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { startTime: "desc" },
    });

    const totalsByEmployee = employees.map((emp) => {
      const mine = entries.filter((e) => e.employeeId === emp.id);
      let hours = 0;
      let openCount = 0;
      let laborCost = 0;
      let hasWage = false;
      for (const e of mine) {
        if (e.status === "OPEN") openCount += 1;
        const h = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
        if (h != null) {
          hours += h;
          const cost = calcLaborCost(h, emp.hourlyWageNet);
          if (cost != null) {
            laborCost += cost;
            hasWage = true;
          }
        }
      }
      return {
        employeeId: emp.id,
        name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
        email: emp.user.email,
        hourlyWageNet: emp.hourlyWageNet,
        hours: Math.round(hours * 100) / 100,
        laborCostNet: hasWage ? Math.round(laborCost * 100) / 100 : null,
        entryCount: mine.length,
        openCount,
      };
    });

    const totalHours =
      Math.round(totalsByEmployee.reduce((s, t) => s + t.hours, 0) * 100) / 100;
    const laborParts = totalsByEmployee
      .map((t) => t.laborCostNet)
      .filter((v): v is number => v != null);
    const totalLaborCostNet =
      laborParts.length > 0
        ? Math.round(laborParts.reduce((s, v) => s + v, 0) * 100) / 100
        : null;

    const [orders, projects] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId: auth.tenantId,
          status: { not: "STORNIERT" },
        },
        select: { id: true, orderNumber: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.project.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 80,
      }),
    ]);

    return apiSuccess({
      from: from.toISOString(),
      to: to.toISOString(),
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.user.firstName} ${e.user.lastName}`.trim(),
        hourlyWageNet: e.hourlyWageNet,
      })),
      orders,
      projects,
      entries: entries.map((e) => {
        const hours = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
        const wage = wageById.get(e.employeeId) ?? null;
        return {
          ...e,
          hours,
          laborCostNet: calcLaborCost(hours, wage),
          employee: {
            ...e.employee,
            hourlyWageNet: wage,
          },
        };
      }),
      totalsByEmployee,
      totalHours,
      totalLaborCostNet,
    });
  } catch (err) {
    console.error("[time-entries]", err);
    return apiError(
      err instanceof Error
        ? `Team-Stunden konnten nicht geladen werden: ${err.message}`
        : "Team-Stunden konnten nicht geladen werden",
      500
    );
  }
}
