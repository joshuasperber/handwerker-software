import { prisma } from "@/lib/prisma";

export interface ScheduleConflict {
  type: "APPOINTMENT" | "ABSENCE";
  message: string;
  orderNumber?: string;
}

/** Prüft ob Mitarbeiter im Zeitraum bereits verplant ist oder abwesend. */
export async function findEmployeeScheduleConflict(
  tenantId: string,
  employeeId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<ScheduleConflict | null> {
  const absence = await prisma.employeeAbsence.findFirst({
    where: {
      employeeId,
      startDate: { lte: endTime },
      endDate: { gte: startTime },
    },
  });
  if (absence) {
    return {
      type: "ABSENCE",
      message: `Mitarbeiter ist abwesend (${absence.type})`,
    };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { operationalStatus: true },
  });
  if (employee?.operationalStatus === "KRANK" || employee?.operationalStatus === "URLAUB") {
    return {
      type: "ABSENCE",
      message: `Mitarbeiter ist als ${employee.operationalStatus} markiert`,
    };
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      tenantId,
      employeeId,
      status: { not: "STORNIERT" },
      ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    include: { order: { select: { orderNumber: true } } },
  });

  if (conflict) {
    return {
      type: "APPOINTMENT",
      message: `Terminkonflikt mit Auftrag ${conflict.order.orderNumber}`,
      orderNumber: conflict.order.orderNumber,
    };
  }

  return null;
}
