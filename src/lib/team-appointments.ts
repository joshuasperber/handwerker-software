import { prisma } from "@/lib/prisma";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

/** Creates calendar appointments for all team members when order has scheduled times. */
export async function syncTeamAppointmentsForOrder(tenantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      team: { include: { members: true, vehicle: true } },
      appointments: true,
    },
  });

  if (!order?.teamId || !order.team || !order.scheduledStart || !order.scheduledEnd) {
    return { created: 0, skipped: 0, conflicts: [] as string[] };
  }

  let created = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const member of order.team.members) {
    const existing = order.appointments.find((a) => a.employeeId === member.employeeId);
    if (existing) {
      skipped++;
      continue;
    }

    const conflict = await findEmployeeScheduleConflict(
      tenantId,
      member.employeeId,
      order.scheduledStart,
      order.scheduledEnd
    );
    if (conflict) {
      const emp = await prisma.employee.findUnique({
        where: { id: member.employeeId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      conflicts.push(
        `${emp?.user.firstName ?? "Mitarbeiter"} ${emp?.user.lastName ?? ""}: ${conflict.message}`.trim()
      );
      continue;
    }

    await prisma.appointment.create({
      data: {
        tenantId,
        orderId: order.id,
        employeeId: member.employeeId,
        startTime: order.scheduledStart,
        endTime: order.scheduledEnd,
        status: "GEPLANT",
      },
    });
    created++;
  }

  if (order.team.vehicleId && !order.vehicleId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { vehicleId: order.team.vehicleId },
    });
  }

  if (created > 0 && order.status === "NEUE_ANFRAGE") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "EINGEPLANT" },
    });
  }

  return { created, skipped, conflicts };
}
