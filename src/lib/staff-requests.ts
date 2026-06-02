import { prisma } from "@/lib/prisma";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

export async function acceptStaffRequest(requestId: string, tenantId: string) {
  const req = await prisma.staffAssignmentRequest.findFirst({
    where: { id: requestId, tenantId, status: "PENDING" },
    include: { order: true },
  });
  if (!req) throw new Error("Anfrage nicht gefunden oder bereits beantwortet");

  const startTime = req.startTime ?? req.order.scheduledStart ?? new Date();
  const endTime =
    req.endTime ??
    req.order.scheduledEnd ??
    new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000);

  const existing = await prisma.appointment.findFirst({
    where: { orderId: req.orderId, employeeId: req.employeeId },
  });

  if (!existing) {
    const conflict = await findEmployeeScheduleConflict(
      tenantId,
      req.employeeId,
      startTime,
      endTime
    );
    if (conflict) {
      throw new Error(conflict.message);
    }

    await prisma.appointment.create({
      data: {
        tenantId,
        orderId: req.orderId,
        employeeId: req.employeeId,
        startTime,
        endTime,
        status: "GEPLANT",
        notes: req.message ? `Verstärkung: ${req.message}` : "Verstärkung angenommen",
      },
    });
  }

  return prisma.staffAssignmentRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", respondedAt: new Date() },
    include: {
      order: { include: { customer: true } },
      employee: { include: { user: true } },
    },
  });
}

export async function declineStaffRequest(requestId: string, tenantId: string) {
  const req = await prisma.staffAssignmentRequest.findFirst({
    where: { id: requestId, tenantId, status: "PENDING" },
  });
  if (!req) throw new Error("Anfrage nicht gefunden oder bereits beantwortet");

  return prisma.staffAssignmentRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
}
