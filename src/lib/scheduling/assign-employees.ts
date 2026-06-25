import { prisma } from "@/lib/prisma";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";
import { queueAssignmentNotification } from "@/lib/inngest/dispatch";
import { logger } from "@/lib/logger";
import { syncPhaseAppointments } from "@/lib/scheduling/sync-phase-appointments";

export interface AssignEmployeesInput {
  tenantId: string;
  orderId: string;
  employeeIds: string[];
  phaseId?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  notify?: boolean;
  isTentative?: boolean;
}

export interface AssignEmployeesResult {
  created: string[];
  updated: string[];
  skipped: { employeeId: string; reason: string }[];
  conflicts: { employeeId: string; message: string }[];
}

export async function assignEmployeesToOrder(
  input: AssignEmployeesInput
): Promise<AssignEmployeesResult> {
  const uniqueIds = [...new Set(input.employeeIds)];
  const result: AssignEmployeesResult = {
    created: [],
    updated: [],
    skipped: [],
    conflicts: [],
  };

  if (!uniqueIds.length) return result;

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
    select: {
      id: true,
      orderNumber: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
    },
  });
  if (!order) throw new Error("Auftrag nicht gefunden");

  let phase: { id: string; name: string } | null = null;
  if (input.phaseId) {
    phase = await prisma.orderPhase.findFirst({
      where: { id: input.phaseId, orderId: input.orderId },
      select: { id: true, name: true },
    });
    if (!phase) throw new Error("Phase nicht gefunden");
  }

  const slotStart = input.startTime ?? order.scheduledStart;
  const slotEnd =
    input.endTime ??
    order.scheduledEnd ??
    (slotStart ? new Date(slotStart.getTime() + 2 * 60 * 60 * 1000) : null);

  const validEmployees = await prisma.employee.findMany({
    where: { id: { in: uniqueIds }, tenantId: input.tenantId },
    select: { id: true },
  });
  const validSet = new Set(validEmployees.map((e) => e.id));

  for (const employeeId of uniqueIds) {
    if (!validSet.has(employeeId)) {
      result.skipped.push({ employeeId, reason: "Mitarbeiter nicht gefunden" });
      continue;
    }

    if (phase && uniqueIds.length === 1) {
      await prisma.orderPhase.update({
        where: { id: phase.id },
        data: {
          assignedEmployeeId: employeeId,
          ...(slotStart ? { plannedStart: slotStart } : {}),
          ...(slotEnd ? { plannedEnd: slotEnd } : {}),
        },
      });
    }

    if (!slotStart || !slotEnd) {
      result.skipped.push({
        employeeId,
        reason: "Kein Termin — nur Phase zugewiesen",
      });
      continue;
    }

    const existing = await prisma.appointment.findFirst({
      where: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        employeeId,
        ...(phase ? { orderPhaseId: phase.id } : {}),
        status: { not: "STORNIERT" },
      },
    });

    const conflict = await findEmployeeScheduleConflict(
      input.tenantId,
      employeeId,
      slotStart,
      slotEnd,
      existing?.id
    );
    if (conflict) {
      result.conflicts.push({ employeeId, message: conflict.message });
      continue;
    }

    if (existing) {
      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          startTime: slotStart,
          endTime: slotEnd,
          orderPhaseId: phase?.id ?? existing.orderPhaseId,
          isTentative: input.isTentative ?? false,
        },
      });
      result.updated.push(existing.id);
    } else {
      const created = await prisma.appointment.create({
        data: {
          tenantId: input.tenantId,
          orderId: input.orderId,
          employeeId,
          orderPhaseId: phase?.id ?? null,
          startTime: slotStart,
          endTime: slotEnd,
          status: "GEPLANT",
          isTentative: input.isTentative ?? false,
        },
      });
      result.created.push(created.id);
    }
  }

  if (slotStart && slotEnd) {
    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        scheduledStart: slotStart,
        scheduledEnd: slotEnd,
        status:
          order.status === "NEUE_ANFRAGE" || order.status === "TERMIN_GEBUCHT"
            ? "EINGEPLANT"
            : order.status,
      },
    });
  }

  if (phase && slotStart && slotEnd) {
    await syncPhaseAppointments(input.tenantId, phase.id);
  }

  const assignedIds = uniqueIds.filter(
    (id) =>
      !result.skipped.some((s) => s.employeeId === id && s.reason.includes("nicht gefunden")) &&
      !result.conflicts.some((c) => c.employeeId === id)
  );

  const notifiedIds = assignedIds.filter(
    (id) =>
      !result.conflicts.some((c) => c.employeeId === id) &&
      (result.created.length > 0 ||
        result.updated.length > 0 ||
        result.skipped.some((s) => s.employeeId === id && s.reason.includes("Phase")))
  );

  if (input.notify !== false && notifiedIds.length) {
    await queueAssignmentNotification({
      tenantId: input.tenantId,
      orderId: input.orderId,
      orderNumber: order.orderNumber,
      employeeIds: notifiedIds,
      startTime: slotStart,
      endTime: slotEnd,
      phaseName: phase?.name,
    }).catch((err) => logger.error("[assign-employees] notify:", { job: "assignment" }, err));
  }

  return result;
}
