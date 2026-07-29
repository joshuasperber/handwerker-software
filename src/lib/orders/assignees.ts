import { prisma } from "@/lib/prisma";

/**
 * Ersetzt die Mitarbeiter-Zuordnung eines Auftrags.
 * Optional: Kalendertermine für alle Assignees anlegen/aktualisieren,
 * wenn Start/Ende bekannt sind.
 */
export async function setOrderAssignees(input: {
  tenantId: string;
  orderId: string;
  employeeIds: string[];
  /** Wenn true und Termine vorhanden: Appointment je Mitarbeiter syncen */
  syncAppointments?: boolean;
  startTime?: Date | null;
  endTime?: Date | null;
}) {
  const uniqueIds = [...new Set(input.employeeIds.filter(Boolean))];

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, tenantId: input.tenantId },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
    },
  });
  if (!order) throw new Error("Auftrag nicht gefunden");

  const valid = await prisma.employee.findMany({
    where: { id: { in: uniqueIds }, tenantId: input.tenantId },
    select: { id: true },
  });
  const validIds = valid.map((e) => e.id);

  await prisma.$transaction(async (tx) => {
    if (validIds.length === 0) {
      await tx.orderAssignee.deleteMany({ where: { orderId: input.orderId } });
    } else {
      await tx.orderAssignee.deleteMany({
        where: {
          orderId: input.orderId,
          employeeId: { notIn: validIds },
        },
      });
      for (const employeeId of validIds) {
        await tx.orderAssignee.upsert({
          where: {
            orderId_employeeId: { orderId: input.orderId, employeeId },
          },
          create: { orderId: input.orderId, employeeId },
          update: {},
        });
      }
    }
  });

  // Entfernte Assignees: zugehörige Einzeltermine immer stornieren
  const removedAppointments = await prisma.appointment.findMany({
    where: {
      tenantId: input.tenantId,
      orderId: input.orderId,
      employeeId:
        validIds.length > 0
          ? { not: null, notIn: validIds }
          : { not: null },
      status: { not: "STORNIERT" },
    },
    select: { id: true },
  });
  if (removedAppointments.length) {
    await prisma.appointment.updateMany({
      where: { id: { in: removedAppointments.map((r) => r.id) } },
      data: { status: "STORNIERT" },
    });
  }

  if (input.syncAppointments === false) {
    return { employeeIds: validIds };
  }

  const start =
    input.startTime ?? order.scheduledStart ?? null;
  const end =
    input.endTime ??
    order.scheduledEnd ??
    (start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null);

  if (start && end && validIds.length) {
    for (const employeeId of validIds) {
      const existing = await prisma.appointment.findFirst({
        where: {
          tenantId: input.tenantId,
          orderId: input.orderId,
          employeeId,
          status: { not: "STORNIERT" },
        },
      });
      if (existing) {
        await prisma.appointment.update({
          where: { id: existing.id },
          data: { startTime: start, endTime: end },
        });
      } else {
        await prisma.appointment.create({
          data: {
            tenantId: input.tenantId,
            orderId: input.orderId,
            employeeId,
            startTime: start,
            endTime: end,
            status: "GEPLANT",
          },
        });
      }
    }

    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        scheduledStart: start,
        scheduledEnd: end,
        status:
          order.status === "NEUE_ANFRAGE" || order.status === "TERMIN_GEBUCHT"
            ? "EINGEPLANT"
            : order.status,
      },
    });
  }

  return { employeeIds: validIds };
}

/** Stellt sicher, dass ein Mitarbeiter als Assignee hinterlegt ist. */
export async function ensureOrderAssignee(
  orderId: string,
  employeeId: string
) {
  await prisma.orderAssignee.upsert({
    where: { orderId_employeeId: { orderId, employeeId } },
    create: { orderId, employeeId },
    update: {},
  });
}

export const ORDER_ASSIGNEE_INCLUDE = {
  employee: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
        },
      },
      teamMemberships: {
        include: { team: { select: { id: true, name: true } } },
      },
    },
  },
} as const;
