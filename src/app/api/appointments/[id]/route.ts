import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { appointmentUpdateSchema } from "@/lib/schemas/orders";
import { auditEntityChange, auditOrderStatusChange } from "@/lib/audit";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";
import { requireTenantEmployee, requireTenantOrder } from "@/lib/tenant-scope";
import { areOrderChecklistsComplete } from "@/lib/orders/checklist";
import { ensureOrderAssignee } from "@/lib/orders/assignees";

const appointmentInclude = {
  order: {
    include: {
      customer: true,
      property: true,
      project: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      vehicle: { select: { id: true, name: true, licensePlate: true } },
      checklists: true,
    },
  },
  project: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  vehicle: { select: { id: true, name: true, licensePlate: true } },
  employee: { include: { user: true } },
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("appointments.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await parseBody(request, appointmentUpdateSchema);
  if (body instanceof Response) return body;
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

  const targetEmployeeId =
    body.employeeId !== undefined ? body.employeeId : existing.employeeId;
  const targetStart = body.startTime ? new Date(body.startTime) : existing.startTime;
  const targetEnd = body.endTime ? new Date(body.endTime) : existing.endTime;

  if (
    targetEmployeeId &&
    (body.startTime || body.endTime || body.employeeId !== undefined)
  ) {
    const conflict = await findEmployeeScheduleConflict(
      auth.tenantId,
      targetEmployeeId,
      targetStart,
      targetEnd,
      id
    );
    if (conflict) return apiError(conflict.message, 409);
  }

  if (body.employeeId) {
    const employee = await requireTenantEmployee(auth.tenantId, body.employeeId);
    if (!employee) return apiError("Mitarbeiter nicht gefunden", 404);
  }

  if (body.orderId) {
    const order = await requireTenantOrder(auth.tenantId, body.orderId);
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }

  if (body.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!project) return apiError("Projekt nicht gefunden", 404);
  }
  if (body.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: body.teamId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!team) return apiError("Team nicht gefunden", 404);
  }
  if (body.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!vehicle) return apiError("Fahrzeug nicht gefunden", 404);
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(body.employeeId !== undefined ? { employeeId: body.employeeId } : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId } : {}),
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
      ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
      ...(body.orderId !== undefined ? { orderId: body.orderId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.addressText !== undefined ? { addressText: body.addressText } : {}),
      ...(body.startTime ? { startTime: new Date(body.startTime) } : {}),
      ...(body.endTime ? { endTime: new Date(body.endTime) } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    include: appointmentInclude,
  });

  const linkedOrderId = appointment.orderId ?? existing.orderId;
  if (linkedOrderId && appointment.employeeId) {
    await ensureOrderAssignee(linkedOrderId, appointment.employeeId);
  }

  if (linkedOrderId && (body.startTime || body.endTime)) {
    await prisma.order.update({
      where: { id: linkedOrderId },
      data: {
        ...(body.startTime ? { scheduledStart: new Date(body.startTime) } : {}),
        ...(body.endTime ? { scheduledEnd: new Date(body.endTime) } : {}),
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

  if (body.status && orderStatusMap[body.status] && existing.order) {
    let newOrderStatus = orderStatusMap[body.status];

    if (body.status === "ABGESCHLOSSEN") {
      if (areOrderChecklistsComplete(existing.order.checklists)) {
        newOrderStatus = "ABRECHNUNGSBEREIT";
      }
    }

    await auditOrderStatusChange(
      auth,
      existing.order.id,
      existing.order.status,
      newOrderStatus,
      ip
    );
    await prisma.order.update({
      where: { id: existing.order.id },
      data: {
        status: newOrderStatus as never,
        ...(body.status === "ABGESCHLOSSEN" ? { completedAt: new Date() } : {}),
      },
    });
  }

  await auditEntityChange(auth, "Appointment", id, "UPDATE", existing, body, ip);

  return apiSuccess(appointment);
}

/** Termin löschen (mit Sicherheitsabfrage im UI). Soft-Delete via STORNIERT wenn Auftrag verknüpft, sonst hart. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("appointments.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.appointment.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Termin nicht gefunden", 404);

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "1";

  if (hard || !existing.orderId) {
    await prisma.appointment.delete({ where: { id } });
  } else {
    await prisma.appointment.update({
      where: { id },
      data: { status: "STORNIERT" },
    });
  }

  await auditEntityChange(
    auth,
    "Appointment",
    id,
    "DELETE",
    existing,
    { hard: hard || !existing.orderId },
    getClientIp(request)
  );

  return apiSuccess({ deleted: true });
}
