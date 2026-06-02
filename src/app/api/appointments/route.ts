import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { auditEntityChange } from "@/lib/audit";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("appointments.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(from && to
        ? {
            startTime: { gte: new Date(from), lte: new Date(to) },
          }
        : {}),
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      order: {
        include: {
          customer: true,
          property: true,
          services: { include: { service: true } },
        },
      },
      employee: { include: { user: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return apiSuccess(appointments);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("appointments.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { orderId, employeeId, startTime, endTime, notes } = body;

  if (!orderId || !startTime || !endTime) {
    return apiError("Pflichtfelder fehlen", 400);
  }

  if (employeeId) {
    const duplicate = await prisma.appointment.findFirst({
      where: { tenantId: auth.tenantId, orderId, employeeId },
    });
    if (duplicate) {
      return apiError("Dieser Mitarbeiter ist für diesen Auftrag bereits eingeplant", 400);
    }

    const conflict = await findEmployeeScheduleConflict(
      auth.tenantId,
      employeeId,
      new Date(startTime),
      new Date(endTime)
    );
    if (conflict) {
      return apiError(conflict.message, 409);
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId: auth.tenantId,
      orderId,
      employeeId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      notes,
    },
    include: {
      order: { include: { customer: true, property: true } },
      employee: { include: { user: true } },
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "EINGEPLANT", scheduledStart: new Date(startTime), scheduledEnd: new Date(endTime) },
  });

  await auditEntityChange(
    auth,
    "Appointment",
    appointment.id,
    "CREATE",
    null,
    body,
    getClientIp(request)
  );

  return apiSuccess(appointment, 201);
}
