import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });
  if (!employee) return apiSuccess({ entries: [], totalHours: 0 });

  const from = fromStr ? startOfDay(parseISO(fromStr)) : startOfDay(new Date());
  const to = toStr ? endOfDay(parseISO(toStr)) : endOfDay(new Date());

  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId: employee.id,
      startTime: { gte: from, lte: to },
    },
    include: {
      order: { select: { id: true, orderNumber: true, customer: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startTime: "desc" },
  });

  let totalMinutes = 0;
  for (const e of entries) {
    if (!e.endTime) continue;
    const ms = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
    totalMinutes += Math.max(0, ms / 60000 - (e.breakMinutes ?? 0));
  }

  return apiSuccess({
    entries,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
  });
}
