import { prisma } from "@/lib/prisma";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

/** Synchronisiert Appointments aus einer Phase (plannedStart/End + assignedEmployee). */
export async function syncPhaseAppointments(tenantId: string, phaseId: string) {
  const phase = await prisma.orderPhase.findFirst({
    where: { id: phaseId, order: { tenantId } },
    include: { order: { select: { id: true, orderNumber: true } } },
  });
  if (!phase) return;

  if (phase.status === "ABGESCHLOSSEN" || phase.status === "STORNIERT") {
    await prisma.appointment.updateMany({
      where: { orderPhaseId: phaseId, tenantId, status: { not: "STORNIERT" } },
      data: { status: "ABGESCHLOSSEN" },
    });
    return;
  }

  if (!phase.assignedEmployeeId || !phase.plannedStart || !phase.plannedEnd) {
    return;
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      tenantId,
      orderPhaseId: phaseId,
      employeeId: phase.assignedEmployeeId,
      status: { not: "STORNIERT" },
    },
  });

  const conflict = await findEmployeeScheduleConflict(
    tenantId,
    phase.assignedEmployeeId,
    phase.plannedStart,
    phase.plannedEnd,
    existing?.id
  );
  if (conflict) return;

  if (existing) {
    await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        startTime: phase.plannedStart,
        endTime: phase.plannedEnd,
        orderPhaseId: phaseId,
      },
    });
  } else {
    await prisma.appointment.create({
      data: {
        tenantId,
        orderId: phase.orderId,
        orderPhaseId: phaseId,
        employeeId: phase.assignedEmployeeId,
        startTime: phase.plannedStart,
        endTime: phase.plannedEnd,
        status: phase.status === "IN_ARBEIT" ? "IN_ARBEIT" : "GEPLANT",
      },
    });
  }
}
