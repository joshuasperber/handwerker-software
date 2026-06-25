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

type ScheduleEntry = Awaited<
  ReturnType<typeof prisma.appointment.findMany<{ include: { order: { include: typeof orderInclude } } }>>
>[number];

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
      orderPhase: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const phaseOnly = await prisma.orderPhase.findMany({
    where: {
      assignedEmployeeId: employee.id,
      isEnabled: true,
      status: { notIn: ["ABGESCHLOSSEN", "STORNIERT", "UEBERSPRUNGEN"] },
      plannedStart: { gte: rangeStart, lte: rangeEnd },
      order: { tenantId: auth.tenantId },
    },
    include: {
      order: { include: orderInclude },
    },
    orderBy: { plannedStart: "asc" },
  });

  const coveredPhaseIds = new Set(
    appointments.map((a) => a.orderPhaseId).filter(Boolean) as string[]
  );

  const synthetic: ScheduleEntry[] = phaseOnly
    .filter((p) => !coveredPhaseIds.has(p.id))
    .filter((p) => p.plannedStart && p.plannedEnd)
    .map((p) => ({
      id: `phase-${p.id}`,
      tenantId: auth.tenantId,
      orderId: p.orderId,
      orderPhaseId: p.id,
      employeeId: employee.id,
      startTime: p.plannedStart!,
      endTime: p.plannedEnd!,
      status: p.status === "IN_ARBEIT" ? "IN_ARBEIT" : "GEPLANT",
      isTentative: true,
      notes: `Phase: ${p.name}`,
      reminderSentAt: null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      order: p.order,
      orderPhase: { id: p.id, name: p.name },
    })) as ScheduleEntry[];

  const merged = [...appointments, ...synthetic].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  if (weekStartStr) {
    const days: Record<string, typeof merged> = {};
    for (const apt of merged) {
      const key = format(new Date(apt.startTime), "yyyy-MM-dd");
      if (!days[key]) days[key] = [];
      days[key].push(apt);
    }
    return apiSuccess({
      weekStart: format(rangeStart, "yyyy-MM-dd"),
      weekEnd: format(rangeEnd, "yyyy-MM-dd"),
      days,
      total: merged.length,
    });
  }

  return apiSuccess(merged);
}
