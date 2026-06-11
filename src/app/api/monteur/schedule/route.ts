import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import type { ReservationStatus } from "@/generated/prisma/client";

const OPEN_RESERVATION: ReservationStatus[] = ["VORGESCHLAGEN", "RESERVIERT"];

const orderInclude = {
  customer: true,
  property: true,
  services: { include: { service: true } },
  checklists: { orderBy: { sortOrder: "asc" as const } },
  files: true,
  phases: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      assignedTeam: { select: { id: true, name: true } },
      assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  },
  materialLines: {
    include: {
      reservations: {
        where: { status: { in: OPEN_RESERVATION } },
        include: { storageLocation: true },
      },
    },
  },
  team: { select: { id: true, name: true } },
  vehicle: { select: { id: true, name: true, licensePlate: true } },
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const weekStartStr = searchParams.get("weekStart");
  const dateStr = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });

  if (!employee) return apiSuccess(weekStartStr ? { week: [], days: {} } : []);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (weekStartStr) {
    const ws = startOfWeek(new Date(weekStartStr), { weekStartsOn: 1 });
    rangeStart = startOfDay(ws);
    rangeEnd = endOfWeek(ws, { weekStartsOn: 1 });
  } else {
    const date = new Date(dateStr);
    rangeStart = startOfDay(date);
    rangeEnd = endOfDay(date);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      employeeId: employee.id,
      startTime: { gte: rangeStart, lte: rangeEnd },
      status: { not: "STORNIERT" },
    },
    include: {
      order: { include: orderInclude },
    },
    orderBy: { startTime: "asc" },
  });

  if (weekStartStr) {
    const days: Record<string, typeof appointments> = {};
    for (const apt of appointments) {
      const key = format(new Date(apt.startTime), "yyyy-MM-dd");
      if (!days[key]) days[key] = [];
      days[key].push(apt);
    }
    return apiSuccess({
      weekStart: format(rangeStart, "yyyy-MM-dd"),
      weekEnd: format(rangeEnd, "yyyy-MM-dd"),
      days,
      total: appointments.length,
    });
  }

  return apiSuccess(appointments);
}
