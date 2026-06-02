import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { auditEntityChange, auditOrderStatusChange } from "@/lib/audit";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("appointments.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const ip = getClientIp(request);

  const existing = await prisma.appointment.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      order: {
        include: { checklists: true },
      },
    },
  });

  if (!existing) return apiError("Termin nicht gefunden", 404);

  const { employeeId, startTime, endTime, status, notes } = body;

  const targetEmployeeId = employeeId ?? existing.employeeId;
  const targetStart = startTime ? new Date(startTime) : existing.startTime;
  const targetEnd = endTime ? new Date(endTime) : existing.endTime;

  if (targetEmployeeId && (startTime || endTime || employeeId)) {
    const conflict = await findEmployeeScheduleConflict(
      auth.tenantId,
      targetEmployeeId,
      targetStart,
      targetEnd,
      id
    );
    if (conflict) return apiError(conflict.message, 409);
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(employeeId !== undefined ? { employeeId } : {}),
      ...(startTime ? { startTime: new Date(startTime) } : {}),
      ...(endTime ? { endTime: new Date(endTime) } : {}),
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      order: { include: { customer: true, property: true, checklists: true } },
      employee: { include: { user: true } },
    },
  });

  if (startTime || endTime) {
    await prisma.order.update({
      where: { id: existing.orderId },
      data: {
        ...(startTime ? { scheduledStart: new Date(startTime) } : {}),
        ...(endTime ? { scheduledEnd: new Date(endTime) } : {}),
      },
    });
  }

  const orderStatusMap: Record<string, string> = {
    UNTERWEGS: "UNTERWEGS",
    ANGEKOMMEN: "UNTERWEGS",
    IN_ARBEIT: "IN_ARBEIT",
    ABGESCHLOSSEN: "ABGESCHLOSSEN",
    STORNIERT: "STORNIERT",
  };

  if (status && orderStatusMap[status]) {
    let newOrderStatus = orderStatusMap[status];

    if (status === "ABGESCHLOSSEN") {
      const checklists = existing.order.checklists;
      const allRequiredDone =
        checklists.length === 0 ||
        checklists.filter((c) => c.label).every((c) => c.isChecked);
      if (allRequiredDone) {
        newOrderStatus = "ABRECHNUNGSBEREIT";
      }
    }

    await auditOrderStatusChange(
      auth,
      existing.orderId,
      existing.order.status,
      newOrderStatus,
      ip
    );
    await prisma.order.update({
      where: { id: existing.orderId },
      data: {
        status: newOrderStatus as never,
        ...(status === "ABGESCHLOSSEN" ? { completedAt: new Date() } : {}),
      },
    });
  }

  await auditEntityChange(auth, "Appointment", id, "UPDATE", existing, body, ip);

  return apiSuccess(appointment);
}
