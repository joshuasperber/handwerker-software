import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { auditOrderStatusChange, auditEntityChange } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notifications";
import { syncTeamAppointmentsForOrder } from "@/lib/team-appointments";
import { ensureOrderPhases } from "@/lib/orders/phases";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("Auftrag nicht gefunden", 404);

  // Bestehende Aufträge ohne Phasen automatisch mit Standardphasen versorgen.
  await ensureOrderPhases(id);

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      appointments: { include: { employee: { include: { user: true } } } },
      files: true,
      checklists: { orderBy: { sortOrder: "asc" } },
      messages: { orderBy: { createdAt: "desc" }, include: { sender: true } },
      timeEntries: { include: { employee: { include: { user: true } } } },
      materialUsages: { include: { employee: { include: { user: true } } } },
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedTeam: { select: { id: true, name: true } },
          assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
          files: { orderBy: { createdAt: "desc" } },
        },
      },
      materialLines: { include: { article: true, reservations: true } },
      team: { include: { members: { include: { employee: { include: { user: true } } } } } },
      vehicle: true,
      planMarkers: { include: { article: true, file: true } },
    },
  });

  if (!order) return apiError("Auftrag nicht gefunden", 404);
  return apiSuccess(order);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const ip = getClientIp(request);

  const existing = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { customer: true },
  });

  if (!existing) return apiError("Auftrag nicht gefunden", 404);

  const { status, priority, description, internalNotes, scheduledStart, scheduledEnd, teamId, vehicleId, completionResult, customerConfirmationStatus } = body;

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      ...(scheduledStart ? { scheduledStart: new Date(scheduledStart) } : {}),
      ...(scheduledEnd ? { scheduledEnd: new Date(scheduledEnd) } : {}),
      ...(teamId !== undefined ? { teamId: teamId || null } : {}),
      ...(vehicleId !== undefined ? { vehicleId: vehicleId || null } : {}),
      ...(completionResult !== undefined ? { completionResult } : {}),
      ...(customerConfirmationStatus !== undefined ? { customerConfirmationStatus } : {}),
      ...(status === "ABGESCHLOSSEN" || status === "ABRECHNUNGSBEREIT" ? { completedAt: new Date() } : {}),
      ...(status === "ABGERECHNET" ? { invoicedAt: new Date() } : {}),
    },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      appointments: { include: { employee: { include: { user: true } } } },
    },
  });

  if (status && status !== existing.status) {
    await auditOrderStatusChange(auth, id, existing.status, status, ip);
    await notifyStatusChange(
      auth.tenantId,
      existing.customer.email,
      existing.orderNumber,
      status
    );
  } else {
    await auditEntityChange(auth, "Order", id, "UPDATE", existing, body, ip);
  }

  if (teamId !== undefined && teamId) {
    await syncTeamAppointmentsForOrder(auth.tenantId, id);
  }
  if ((scheduledStart || scheduledEnd) && existing.teamId) {
    await syncTeamAppointmentsForOrder(auth.tenantId, id);
  }

  return apiSuccess(order);
}
