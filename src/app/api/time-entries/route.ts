import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcWorkedHours } from "@/lib/time-entry";
import { startOfDay, endOfDay, parseISO } from "date-fns";

/** Team-Stunden-Auswertung für Büro / Meister / Admin */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("time_entries.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const employeeId = searchParams.get("employeeId") || undefined;
  const status = searchParams.get("status") || undefined;

  const from = fromStr ? startOfDay(parseISO(fromStr)) : startOfDay(new Date());
  const to = toStr ? endOfDay(parseISO(toStr)) : endOfDay(new Date());

  const employees = await prisma.employee.findMany({
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

  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) {
    return apiSuccess({ from, to, employees: [], entries: [], totalsByEmployee: [] });
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId: { in: employeeIds },
      startTime: { gte: from, lte: to },
      ...(status ? { status: status as "OPEN" | "REVIEWED" | "APPROVED" } : {}),
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
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
    for (const e of mine) {
      if (e.status === "OPEN") openCount += 1;
      const h = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
      if (h != null) hours += h;
    }
    return {
      employeeId: emp.id,
      name: `${emp.user.firstName} ${emp.user.lastName}`.trim(),
      email: emp.user.email,
      hours: Math.round(hours * 100) / 100,
      entryCount: mine.length,
      openCount,
    };
  });

  const totalHours = Math.round(
    totalsByEmployee.reduce((s, t) => s + t.hours, 0) * 100
  ) / 100;

  return apiSuccess({
    from: from.toISOString(),
    to: to.toISOString(),
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.user.firstName} ${e.user.lastName}`.trim(),
    })),
    entries,
    totalsByEmployee,
    totalHours,
  });
}
