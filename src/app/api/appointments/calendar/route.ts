import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { calendarCreateAppointmentSchema } from "@/lib/schemas/orders";
import { auditEntityChange } from "@/lib/audit";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";
import { maybeSendBookingConfirmationForOrder } from "@/lib/customer-email-notifications";
import { requireTenantEmployee } from "@/lib/tenant-scope";
import { generateOrderNumber } from "@/lib/utils";
import { standardPhaseCreateData } from "@/lib/orders/phases";
import { resolveOrderTypeAssignment } from "@/lib/orders/order-types";
import { hasPermission } from "@/lib/permissions";
import { ensureOrderAssignee } from "@/lib/orders/assignees";

const appointmentInclude = {
  order: {
    include: {
      customer: true,
      property: true,
      project: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      vehicle: { select: { id: true, name: true, licensePlate: true } },
    },
  },
  project: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  vehicle: { select: { id: true, name: true, licensePlate: true } },
  employee: { include: { user: true } },
} as const;

/**
 * Kalender: bestehenden Auftrag einplanen, neuen Auftrag + Termin,
 * oder eigenständigen Termin ohne Auftrag.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("appointments.write");
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, calendarCreateAppointmentSchema);
  if (body instanceof Response) return body;

  const startTime = new Date(body.startTime);
  const endTime = new Date(body.endTime);
  const employeeId = body.employeeId?.trim() || null;
  const teamId = body.teamId?.trim() || null;
  const vehicleId = body.vehicleId?.trim() || null;
  const projectId = body.projectId?.trim() || null;
  const notes = body.notes?.trim() || null;
  const title = body.title?.trim() || null;
  const color = body.color?.trim() || null;
  const addressText = body.addressText?.trim() || null;
  const status = body.status ?? "GEPLANT";

  if (employeeId) {
    const employee = await requireTenantEmployee(auth.tenantId, employeeId);
    if (!employee) return apiError("Mitarbeiter nicht gefunden", 404);
    const conflict = await findEmployeeScheduleConflict(
      auth.tenantId,
      employeeId,
      startTime,
      endTime
    );
    if (conflict) return apiError(conflict.message, 409);
  }

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!team) return apiError("Team nicht gefunden", 404);
  }
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!vehicle) return apiError("Fahrzeug nicht gefunden", 404);
  }
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
      select: { id: true, customerId: true },
    });
    if (!project) return apiError("Projekt nicht gefunden", 404);
  }

  // --- Standalone: ohne Auftrag ---
  if (body.mode === "standalone") {
    const appointment = await prisma.appointment.create({
      data: {
        tenantId: auth.tenantId,
        orderId: null,
        employeeId,
        teamId,
        vehicleId,
        projectId,
        title,
        color,
        addressText,
        startTime,
        endTime,
        notes,
        status,
      },
      include: appointmentInclude,
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

  let orderId = body.orderId ?? "";

  if (body.mode === "new") {
    if (!hasPermission(auth.role, "orders.write")) {
      return apiError("Keine Berechtigung, Aufträge anzulegen", 403);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId!, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);

    const property = await prisma.property.findFirst({
      where: {
        id: body.propertyId!,
        customerId: body.customerId!,
        tenantId: auth.tenantId,
      },
      select: { id: true },
    });
    if (!property) return apiError("Adresse / Objekt nicht gefunden", 404);

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId: auth.tenantId },
        select: { customerId: true },
      });
      if (project && project.customerId !== body.customerId) {
        return apiError("Projekt gehört zu einem anderen Kunden", 400);
      }
    }

    const typeAssignment = await resolveOrderTypeAssignment(auth.tenantId, {
      orderTypeId: body.orderTypeId ?? null,
      orderTypeCustom: body.orderTypeCustom ?? null,
    });
    if ("error" in typeAssignment) {
      return apiError(typeAssignment.error, 400);
    }

    const order = await prisma.order.create({
      data: {
        tenantId: auth.tenantId,
        customerId: body.customerId!,
        propertyId: body.propertyId!,
        projectId,
        teamId,
        vehicleId,
        orderNumber: generateOrderNumber(),
        title: title!,
        orderType: typeAssignment.orderType,
        orderTypeId: typeAssignment.orderTypeId,
        orderTypeLabel: typeAssignment.orderTypeLabel,
        orderTypeCustom: typeAssignment.orderTypeCustom,
        description: notes,
        status: "EINGEPLANT",
        scheduledStart: startTime,
        scheduledEnd: endTime,
        phases: { create: standardPhaseCreateData() },
      },
    });
    orderId = order.id;
  } else {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: auth.tenantId },
      select: { id: true, customerId: true },
    });
    if (!order) return apiError("Auftrag nicht gefunden", 404);

    if (employeeId) {
      const duplicate = await prisma.appointment.findFirst({
        where: {
          tenantId: auth.tenantId,
          orderId,
          employeeId,
          status: { not: "STORNIERT" },
        },
      });
      if (duplicate) {
        return apiError(
          "Dieser Mitarbeiter ist für diesen Auftrag bereits eingeplant",
          400
        );
      }
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId: auth.tenantId },
        select: { customerId: true },
      });
      if (project && project.customerId !== order.customerId) {
        return apiError("Projekt gehört zu einem anderen Kunden", 400);
      }
    }
  }

  const priorAppointments = await prisma.appointment.count({
    where: { tenantId: auth.tenantId, orderId },
  });

  const appointment = await prisma.appointment.create({
    data: {
      tenantId: auth.tenantId,
      orderId,
      employeeId,
      teamId,
      vehicleId,
      projectId,
      title: title ?? undefined,
      color,
      addressText,
      startTime,
      endTime,
      notes,
      status,
    },
    include: appointmentInclude,
  });

  if (employeeId) {
    await ensureOrderAssignee(orderId, employeeId);
  }

  await prisma.order.update({
    where: { id: orderId, tenantId: auth.tenantId },
    data: {
      status: "EINGEPLANT",
      scheduledStart: startTime,
      scheduledEnd: endTime,
      ...(teamId !== null ? { teamId } : {}),
      ...(vehicleId !== null ? { vehicleId } : {}),
      ...(projectId !== null ? { projectId } : {}),
    },
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

  if (priorAppointments === 0) {
    await maybeSendBookingConfirmationForOrder(auth.tenantId, orderId).catch(
      (err) => {
        console.error("[appointments/calendar] Buchungsbestätigung:", err);
      }
    );
  }

  return apiSuccess(appointment, 201);
}
