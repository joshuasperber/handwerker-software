import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import type { ReservationStatus } from "@/generated/prisma/client";
import {
  addCalendarDays,
  businessDateKey,
  businessDayRange,
  startOfIsoWeekDate,
} from "@/lib/calendar-day";

const OPEN_RESERVATION: ReservationStatus[] = ["VORGESCHLAGEN", "RESERVIERT"];
const TERMINAL_ORDER_STATUSES = ["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"] as const;

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
  const dateStr = searchParams.get("date") ?? businessDateKey(new Date());

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });

  if (!employee) return apiSuccess(weekStartStr ? { week: [], days: {} } : []);

  let rangeStart: Date;
  let rangeEnd: Date;

  try {
    if (weekStartStr) {
      const monday = startOfIsoWeekDate(weekStartStr);
      rangeStart = businessDayRange(monday).start;
      rangeEnd = businessDayRange(addCalendarDays(monday, 6)).end;
    } else {
      const range = businessDayRange(dateStr);
      rangeStart = range.start;
      rangeEnd = range.end;
    }
  } catch {
    return apiSuccess(weekStartStr ? { week: [], days: {}, total: 0 } : []);
  }

  const teamMemberships = await prisma.teamMember.findMany({
    where: { employeeId: employee.id },
    select: { teamId: true },
  });
  const teamIds = teamMemberships.map((m) => m.teamId);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      status: { not: "STORNIERT" },
      orderId: { not: null },
      order: { status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
      startTime: { gte: rangeStart, lte: rangeEnd },
      OR: [
        { employeeId: employee.id },
        ...(teamIds.length > 0 ? [{ order: { teamId: { in: teamIds } } }] : []),
      ],
    },
    include: {
      order: { include: orderInclude },
      orderPhase: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const phaseOnly = await prisma.orderPhase.findMany({
    where: {
      isEnabled: true,
      status: { notIn: ["ABGESCHLOSSEN", "STORNIERT", "UEBERSPRUNGEN"] },
      plannedStart: { gte: rangeStart, lte: rangeEnd },
      order: {
        tenantId: auth.tenantId,
        status: { notIn: [...TERMINAL_ORDER_STATUSES] },
      },
      OR: [
        { assignedEmployeeId: employee.id },
        ...(teamIds.length > 0 ? [{ assignedTeamId: { in: teamIds } }] : []),
      ],
    },
    include: {
      order: { include: orderInclude },
    },
    orderBy: { plannedStart: "asc" },
  });

  const coveredPhaseIds = new Set(
    appointments.map((a) => a.orderPhaseId).filter(Boolean) as string[]
  );

  const synthetic = phaseOnly
    .filter((p) => !coveredPhaseIds.has(p.id))
    .filter((p) => p.plannedStart && p.plannedEnd)
    .map((p) => ({
      id: `phase-${p.id}`,
      tenantId: auth.tenantId,
      orderId: p.orderId,
      orderPhaseId: p.id,
      employeeId: p.assignedEmployeeId ?? employee.id,
      title: p.name,
      color: null,
      projectId: p.order.projectId,
      teamId: p.order.teamId,
      vehicleId: p.order.vehicleId,
      addressText: null,
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
    })) as unknown as ScheduleEntry[];

  // Zugewiesene Aufträge ohne eigenen Termin, aber mit geplantem Zeitfenster
  const coveredOrderIds = appointments
    .map((a) => a.orderId)
    .filter((id): id is string => Boolean(id));
  const assigneeOrders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      status: { notIn: [...TERMINAL_ORDER_STATUSES] },
      scheduledStart: { gte: rangeStart, lte: rangeEnd },
      assignees: { some: { employeeId: employee.id } },
      id: { notIn: coveredOrderIds },
    },
    include: orderInclude,
  });

  const assigneeSynthetic = assigneeOrders
    .filter((o) => o.scheduledStart && o.scheduledEnd)
    .map((o) => ({
      id: `assignee-${o.id}`,
      tenantId: auth.tenantId,
      orderId: o.id,
      orderPhaseId: null,
      employeeId: employee.id,
      title: o.title,
      color: null,
      projectId: o.projectId,
      teamId: o.teamId,
      vehicleId: o.vehicleId,
      addressText: null,
      startTime: o.scheduledStart!,
      endTime: o.scheduledEnd!,
      status: "GEPLANT" as const,
      isTentative: true,
      notes: "Zugewiesen",
      reminderSentAt: null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      order: o,
      orderPhase: null,
    })) as unknown as ScheduleEntry[];

  const merged = [...appointments, ...synthetic, ...assigneeSynthetic]
    .filter((a) => a.order != null)
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (weekStartStr) {
    const days: Record<string, typeof merged> = {};
    for (const apt of merged) {
      const key = businessDateKey(new Date(apt.startTime));
      if (!days[key]) days[key] = [];
      days[key].push(apt);
    }
    return apiSuccess({
      weekStart: businessDateKey(rangeStart),
      weekEnd: businessDateKey(rangeEnd),
      days,
      total: merged.length,
    });
  }

  return apiSuccess(merged);
}
