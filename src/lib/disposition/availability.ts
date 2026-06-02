import { prisma } from "@/lib/prisma";

export async function getEmployeeAvailability(tenantId: string, date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const employees = await prisma.employee.findMany({
    where: { tenantId },
    include: {
      user: true,
      absences: {
        where: {
          startDate: { lte: dayEnd },
          endDate: { gte: dayStart },
        },
      },
      appointments: {
        where: {
          startTime: { lte: dayEnd },
          endTime: { gte: dayStart },
          status: { not: "STORNIERT" },
        },
        include: { order: true },
      },
      teamMemberships: { include: { team: true } },
    },
  });

  return employees.map((e) => {
    const onAbsence = e.absences.length > 0;
    const busy = e.appointments.length > 0;
    const available = !onAbsence && e.operationalStatus !== "KRANK" && e.operationalStatus !== "URLAUB";

    return {
      id: e.id,
      name: `${e.user.firstName} ${e.user.lastName}`,
      operationalStatus: e.operationalStatus,
      available: available && !busy,
      onAbsence,
      absenceType: e.absences[0]?.type,
      appointmentsToday: e.appointments.map((a) => ({
        id: a.id,
        orderNumber: a.order.orderNumber,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      teams: e.teamMemberships.map((m) => m.team.name),
    };
  });
}

export async function getTeamsWithMembers(tenantId: string) {
  return prisma.team.findMany({
    where: { tenantId, isActive: true },
    include: {
      members: { include: { employee: { include: { user: true } } } },
      vehicle: { include: { storageLocation: true } },
      orders: { where: { status: { notIn: ["STORNIERT", "ABGERECHNET"] } }, take: 5 },
    },
  });
}
